"""
Lambda function for updating health center statuses
Runs every hour to simulate dynamic fullness changes
"""

import json
import os
import random
from datetime import datetime, timedelta
import boto3
from boto3.dynamodb.conditions import Key

DDB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT')
dynamodb = boto3.resource('dynamodb', endpoint_url=DDB_ENDPOINT)
centres_table = dynamodb.Table(os.environ['CENTRES_TABLE'])

# Fullness transition probabilities
TRANSITION_MATRIX = {
    'empty': {'empty': 0.6, 'average': 0.35, 'full': 0.05},
    'average': {'empty': 0.2, 'average': 0.5, 'full': 0.3},
    'full': {'empty': 0.05, 'average': 0.25, 'full': 0.7}
}

# Time-based modifiers (rush hours have higher fullness)
HOUR_MODIFIERS = {
    0: 0.5, 1: 0.3, 2: 0.2, 3: 0.1, 4: 0.1, 5: 0.2,
    6: 0.5, 7: 0.8, 8: 1.0, 9: 1.2, 10: 1.3, 11: 1.2,
    12: 1.0, 13: 1.1, 14: 1.2, 15: 1.3, 16: 1.2, 17: 1.0,
    18: 0.9, 19: 0.8, 20: 0.7, 21: 0.6, 22: 0.5, 23: 0.4
}

def lambda_handler(event, context):
    """Main handler - updates centre statuses based on time and patterns"""
    
    current_hour = datetime.utcnow().hour
    hour_modifier = HOUR_MODIFIERS.get(current_hour, 1.0)
    
    # Get all centres
    centres = get_all_centres()
    
    updates = []
    for centre in centres:
        new_status = calculate_new_status(centre, hour_modifier)
        
        if new_status != centre.get('status'):
            update_centre_status(centre['id'], new_status)
            updates.append({
                'centre_id': centre['id'],
                'old_status': centre.get('status'),
                'new_status': new_status
            })
    
    # Broadcast updates via WebSocket if enabled
    if updates:
        broadcast_status_updates(updates)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'updated': len(updates),
            'hour': current_hour,
            'modifier': hour_modifier
        })
    }

def get_all_centres():
    """Retrieve all centres from DynamoDB"""
    response = centres_table.scan()
    return response.get('Items', [])

def calculate_new_status(centre, hour_modifier):
    """Calculate new status based on current status and time"""
    current_status = centre.get('status', 'average')
    
    # Get base transition probabilities
    transitions = TRANSITION_MATRIX[current_status].copy()
    
    # Apply hour modifier (increase probability of being full during rush hours)
    if hour_modifier > 1.0:
        # Increase full probability
        full_increase = (hour_modifier - 1.0) * 0.2
        transitions['full'] = min(transitions['full'] + full_increase, 0.9)
        transitions['empty'] = max(transitions['empty'] - full_increase * 0.5, 0.05)
        transitions['average'] = 1.0 - transitions['full'] - transitions['empty']
    elif hour_modifier < 1.0:
        # Increase empty probability
        empty_increase = (1.0 - hour_modifier) * 0.3
        transitions['empty'] = min(transitions['empty'] + empty_increase, 0.8)
        transitions['full'] = max(transitions['full'] - empty_increase * 0.5, 0.05)
        transitions['average'] = 1.0 - transitions['full'] - transitions['empty']
    
    # Special handling for different centre types
    if centre.get('type') == 'A':
        # Type A centres (larger) tend to be fuller
        transitions['full'] = min(transitions['full'] * 1.2, 0.9)
        transitions['empty'] = transitions['empty'] * 0.8
        transitions['average'] = 1.0 - transitions['full'] - transitions['empty']
    
    # Random selection based on probabilities
    rand = random.random()
    cumulative = 0
    
    for status, probability in transitions.items():
        cumulative += probability
        if rand <= cumulative:
            return status
    
    return current_status

def update_centre_status(centre_id, new_status):
    """Update centre status in DynamoDB"""
    
    # Calculate people count based on status
    people_counts = {
        'empty': random.randint(1, 10),
        'average': random.randint(15, 40),
        'full': random.randint(45, 80)
    }
    
    centres_table.update_item(
        Key={'id': centre_id},
        UpdateExpression='SET #status = :status, last_update = :time, people_count = :count',
        ExpressionAttributeNames={
            '#status': 'status'  # status is a reserved word
        },
        ExpressionAttributeValues={
            ':status': new_status,
            ':time': datetime.utcnow().isoformat(),
            ':count': people_counts[new_status]
        }
    )

def broadcast_status_updates(updates):
    """Broadcast status updates via WebSocket API"""
    try:
        # Check if WebSocket endpoint is configured
        websocket_endpoint = os.environ.get('WEBSOCKET_ENDPOINT')
        if not websocket_endpoint:
            print("WebSocket endpoint not configured, skipping broadcast")
            return
        
        # Get connected clients from connections table
        apigw_management = boto3.client(
            'apigatewaymanagementapi',
            endpoint_url=websocket_endpoint
        )
        
        connections_table = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE', 'health-waze-connections'))
        response = connections_table.scan()
        connections = response.get('Items', [])
        
        # Prepare update message
        message = {
            'type': 'status_update',
            'timestamp': datetime.utcnow().isoformat(),
            'updates': updates
        }
        message_bytes = json.dumps(message).encode('utf-8')
        
        # Send to all connected clients
        stale_connections = []
        for connection in connections:
            connection_id = connection['connection_id']
            
            try:
                apigw_management.post_to_connection(
                    ConnectionId=connection_id,
                    Data=message_bytes
                )
            except apigw_management.exceptions.GoneException:
                # Connection is stale, mark for removal
                stale_connections.append(connection_id)
            except Exception as e:
                print(f"Error sending to connection {connection_id}: {e}")
        
        # Clean up stale connections
        for connection_id in stale_connections:
            connections_table.delete_item(
                Key={'connection_id': connection_id}
            )
            
    except Exception as e:
        print(f"Error broadcasting updates: {e}")
        # Don't fail the function if broadcast fails

def simulate_doctor_changes(centre):
    """Simulate doctor availability changes based on time"""
    current_hour = datetime.utcnow().hour
    doctor_count = centre.get('doctor_count', 4)
    
    # Doctors are less available at night
    if 0 <= current_hour < 6:
        new_count = max(1, doctor_count - random.randint(1, 3))
    elif 6 <= current_hour < 22:
        new_count = random.randint(3, 8)
    else:
        new_count = random.randint(2, 5)
    
    if new_count != doctor_count:
        centres_table.update_item(
            Key={'id': centre['id']},
            UpdateExpression='SET doctor_count = :count',
            ExpressionAttributeValues={':count': new_count}
        )