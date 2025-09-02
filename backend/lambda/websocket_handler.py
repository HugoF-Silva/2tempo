"""
WebSocket handler for real-time updates
Manages connections and broadcasts status changes
"""

import json
import os
import boto3
from datetime import datetime

DDB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT')
dynamodb = boto3.resource('dynamodb', endpoint_url=DDB_ENDPOINT)
connections_table = dynamodb.Table(os.environ.get('CONNECTIONS_TABLE', 'health-waze-connections'))

def lambda_handler(event, context):
    """Main WebSocket handler with routing"""
    route_key = event['requestContext']['routeKey']
    connection_id = event['requestContext']['connectionId']
    
    if route_key == '$connect':
        return handle_connect(connection_id, event)
    elif route_key == '$disconnect':
        return handle_disconnect(connection_id)
    elif route_key == 'subscribe':
        return handle_subscribe(connection_id, event)
    elif route_key == 'unsubscribe':
        return handle_unsubscribe(connection_id, event)
    elif route_key == 'ping':
        return handle_ping(connection_id)
    else:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': f'Unknown route: {route_key}'})
        }

def handle_connect(connection_id, event):
    """Handle new WebSocket connection"""
    # Extract user info if authenticated
    user_id = None
    if 'authorizer' in event['requestContext']:
        user_id = event['requestContext']['authorizer'].get('principalId')
    
    # Store connection
    connections_table.put_item(
        Item={
            'connection_id': connection_id,
            'user_id': user_id,
            'connected_at': datetime.utcnow().isoformat(),
            'subscriptions': [],
            'ttl': int((datetime.utcnow().timestamp() + 86400))  # 24 hour TTL
        }
    )
    
    # Send welcome message
    send_to_connection(
        connection_id,
        {
            'type': 'connected',
            'message': 'Welcome to Health Waze real-time updates',
            'timestamp': datetime.utcnow().isoformat()
        },
        event
    )
    
    return {'statusCode': 200}

def handle_disconnect(connection_id):
    """Handle WebSocket disconnection"""
    try:
        connections_table.delete_item(
            Key={'connection_id': connection_id}
        )
    except Exception as e:
        print(f"Error removing connection {connection_id}: {e}")
    
    return {'statusCode': 200}

def handle_subscribe(connection_id, event):
    """Subscribe to specific centre updates"""
    try:
        body = json.loads(event['body'])
        centre_ids = body.get('centre_ids', [])
        
        if not centre_ids:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No centre_ids provided'})
            }
        
        # Update subscriptions
        connections_table.update_item(
            Key={'connection_id': connection_id},
            UpdateExpression='SET subscriptions = :subs',
            ExpressionAttributeValues={
                ':subs': list(set(centre_ids))  # Ensure unique
            }
        )
        
        # Send confirmation
        send_to_connection(
            connection_id,
            {
                'type': 'subscribed',
                'centre_ids': centre_ids,
                'timestamp': datetime.utcnow().isoformat()
            },
            event
        )
        
        return {'statusCode': 200}
        
    except Exception as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }

def handle_unsubscribe(connection_id, event):
    """Unsubscribe from centre updates"""
    try:
        body = json.loads(event['body'])
        centre_ids = body.get('centre_ids', [])
        
        if not centre_ids:
            # Unsubscribe from all
            connections_table.update_item(
                Key={'connection_id': connection_id},
                UpdateExpression='SET subscriptions = :empty',
                ExpressionAttributeValues={':empty': []}
            )
        else:
            # Remove specific subscriptions
            response = connections_table.get_item(
                Key={'connection_id': connection_id}
            )
            
            if 'Item' in response:
                current_subs = response['Item'].get('subscriptions', [])
                new_subs = [s for s in current_subs if s not in centre_ids]
                
                connections_table.update_item(
                    Key={'connection_id': connection_id},
                    UpdateExpression='SET subscriptions = :subs',
                    ExpressionAttributeValues={':subs': new_subs}
                )
        
        # Send confirmation
        send_to_connection(
            connection_id,
            {
                'type': 'unsubscribed',
                'centre_ids': centre_ids,
                'timestamp': datetime.utcnow().isoformat()
            },
            event
        )
        
        return {'statusCode': 200}
        
    except Exception as e:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': str(e)})
        }

def handle_ping(connection_id):
    """Handle ping to keep connection alive"""
    # Update TTL
    connections_table.update_item(
        Key={'connection_id': connection_id},
        UpdateExpression='SET ttl = :ttl',
        ExpressionAttributeValues={
            ':ttl': int((datetime.utcnow().timestamp() + 86400))
        }
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({'type': 'pong'})
    }

def send_to_connection(connection_id, data, event):
    """Send message to specific connection"""
    endpoint_url = f"https://{event['requestContext']['domainName']}/{event['requestContext']['stage']}"
    
    apigw_management = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=endpoint_url
    )
    
    try:
        apigw_management.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data).encode('utf-8')
        )
    except apigw_management.exceptions.GoneException:
        # Connection is stale, remove it
        connections_table.delete_item(
            Key={'connection_id': connection_id}
        )
        raise
    except Exception as e:
        print(f"Error sending to connection {connection_id}: {e}")
        raise

def broadcast_to_subscribers(centre_id, update_data):
    """Broadcast update to all subscribers of a centre"""
    # This function would be called by other Lambdas when centre status changes
    
    # Get all connections subscribed to this centre
    response = connections_table.scan(
        FilterExpression='contains(subscriptions, :centre_id)',
        ExpressionAttributeValues={':centre_id': centre_id}
    )
    
    connections = response.get('Items', [])
    
    # Get API Gateway management client
    # Note: This requires the WebSocket endpoint URL to be passed or stored
    endpoint_url = os.environ.get('WEBSOCKET_ENDPOINT')
    if not endpoint_url:
        print("WebSocket endpoint not configured")
        return
    
    apigw_management = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=endpoint_url
    )
    
    # Send update to each connection
    stale_connections = []
    message = {
        'type': 'centre_update',
        'centre_id': centre_id,
        'data': update_data,
        'timestamp': datetime.utcnow().isoformat()
    }
    message_bytes = json.dumps(message).encode('utf-8')
    
    for connection in connections:
        connection_id = connection['connection_id']
        
        try:
            apigw_management.post_to_connection(
                ConnectionId=connection_id,
                Data=message_bytes
            )
        except apigw_management.exceptions.GoneException:
            stale_connections.append(connection_id)
        except Exception as e:
            print(f"Error sending to connection {connection_id}: {e}")
    
    # Clean up stale connections
    for connection_id in stale_connections:
        try:
            connections_table.delete_item(
                Key={'connection_id': connection_id}
            )
        except:
            pass