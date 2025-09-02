"""
Lambda function for validating pending help submissions
Runs every 30 minutes to process and validate community-provided information
"""

import json
import os
from datetime import datetime, timedelta
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key, Attr
from collections import Counter

DDB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT')
dynamodb = boto3.resource('dynamodb', endpoint_url=DDB_ENDPOINT)
entitlements_table = dynamodb.Table(os.environ['ENTITLEMENTS_TABLE'])
ledger_table = dynamodb.Table(os.environ['LEDGER_TABLE'])
centres_table = dynamodb.Table(os.environ['CENTRES_TABLE'])
users_table = dynamodb.Table(os.environ['USERS_TABLE'])

# Validation thresholds
MIN_CONFIRMATIONS = 3
CONSENSUS_THRESHOLD = 0.7  # 70% agreement required

def lambda_handler(event, context):
    """Main validator handler - processes pending validations"""
    
    # Get current validation window (last 30 minutes)
    current_time = datetime.utcnow()
    window_start = current_time.replace(minute=0 if current_time.minute < 30 else 30, second=0, microsecond=0)
    
    print(f"Processing validations for window: {window_start}")
    
    # Get all pending validations for this window
    pending_validations = get_pending_validations(window_start)
    
    # Group by centre and validation type
    validations_by_centre = group_validations_by_centre(pending_validations)
    
    # Process each centre's validations
    results = []
    for centre_id, centre_validations in validations_by_centre.items():
        result = process_centre_validations(centre_id, centre_validations)
        results.append(result)
    
    # Update centre statuses based on validated data
    update_centre_statuses(results)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'processed': len(results),
            'window': window_start.isoformat()
        })
    }

def get_pending_validations(window_start):
    """Retrieve all pending validations for the current window"""
    response = entitlements_table.scan(
        FilterExpression=Attr('type').eq('pending_validation') & 
                        Attr('validation_window').eq(window_start.isoformat()) &
                        Attr('validated').eq(False)
    )
    
    return response.get('Items', [])

def group_validations_by_centre(validations):
    """Group validations by centre ID and type"""
    grouped = {}
    
    for validation in validations:
        centre_id = validation['centre_id']
        if centre_id not in grouped:
            grouped[centre_id] = {
                'fullness': [],
                'doctors': [],
                'medicines': []
            }
        
        # Categorize by validation type
        if validation['cta'].startswith('help.fullness'):
            grouped[centre_id]['fullness'].append(validation)
        elif 'doctor' in validation['cta']:
            grouped[centre_id]['doctors'].append(validation)
        elif 'drug' in validation['cta']:
            grouped[centre_id]['medicines'].append(validation)
    
    return grouped

def process_centre_validations(centre_id, validations):
    """Process all validations for a specific centre"""
    result = {
        'centre_id': centre_id,
        'fullness_status': None,
        'validated_doctors': [],
        'validated_medicines': []
    }
    
    # Validate fullness reports
    if validations['fullness']:
        result['fullness_status'] = validate_fullness(validations['fullness'])
    
    # Validate doctor reports
    if validations['doctors']:
        result['validated_doctors'] = validate_doctors(validations['doctors'])
    
    # Validate medicine reports
    if validations['medicines']:
        result['validated_medicines'] = validate_medicines(validations['medicines'])
    
    # Credit users for validated submissions
    credit_validated_submissions(validations, result)
    
    return result

def validate_fullness(fullness_reports):
    """Validate fullness status based on consensus"""
    if len(fullness_reports) < MIN_CONFIRMATIONS:
        return None
    
    # Count status reports
    status_counts = Counter(report['payload']['status'] for report in fullness_reports)
    total_reports = sum(status_counts.values())
    
    # Find consensus status
    for status, count in status_counts.most_common():
        if count / total_reports >= CONSENSUS_THRESHOLD:
            return status
    
    return None

def validate_doctors(doctor_reports):
    """Validate doctor availability reports"""
    validated = []
    
    # Group by doctor ID
    doctors_data = {}
    for report in doctor_reports:
        doctor_id = report['payload'].get('doctor_id')
        action = report['payload'].get('action')
        
        if doctor_id not in doctors_data:
            doctors_data[doctor_id] = {'confirm': 0, 'deny': 0}
        
        doctors_data[doctor_id][action] += 1
    
    # Validate based on consensus
    for doctor_id, counts in doctors_data.items():
        total = counts['confirm'] + counts['deny']
        if total >= MIN_CONFIRMATIONS:
            if counts['confirm'] / total >= CONSENSUS_THRESHOLD:
                validated.append({'id': doctor_id, 'available': True})
            elif counts['deny'] / total >= CONSENSUS_THRESHOLD:
                validated.append({'id': doctor_id, 'available': False})
    
    return validated

def validate_medicines(medicine_reports):
    """Validate medicine availability reports"""
    validated = []
    
    # Group by medicine ID
    medicines_data = {}
    for report in medicine_reports:
        if report['cta'] == 'help.drug_add':
            # New medicine additions
            for med_name in report['payload'].get('medicines', []):
                if med_name not in medicines_data:
                    medicines_data[med_name] = {'add': 0, 'confirm': 0, 'deny': 0}
                medicines_data[med_name]['add'] += 1
        else:
            # Confirmations/denials
            med_id = report['payload'].get('drug_id')
            action = report['payload'].get('action')
            
            if med_id not in medicines_data:
                medicines_data[med_id] = {'add': 0, 'confirm': 0, 'deny': 0}
            
            medicines_data[med_id][action] += 1
    
    # Validate based on consensus
    for med_id, counts in medicines_data.items():
        if counts['add'] >= MIN_CONFIRMATIONS:
            validated.append({'id': med_id, 'available': True, 'new': True})
        else:
            total = counts['confirm'] + counts['deny']
            if total >= MIN_CONFIRMATIONS:
                if counts['confirm'] / total >= CONSENSUS_THRESHOLD:
                    validated.append({'id': med_id, 'available': True})
                elif counts['deny'] / total >= CONSENSUS_THRESHOLD:
                    validated.append({'id': med_id, 'available': False})
    
    return validated

def credit_validated_submissions(validations, result):
    """Credit users for submissions that were validated"""
    credited_users = set()
    
    # Process fullness validations
    if result['fullness_status']:
        for report in validations['fullness']:
            if report['payload']['status'] == result['fullness_status']:
                credit_user(report['user_id'], report['pending_amount'], f"validated:{report['cta']}")
                credited_users.add(report['user_id'])
    
    # Process doctor validations
    validated_doctor_ids = {d['id']: d['available'] for d in result['validated_doctors']}
    for report in validations['doctors']:
        doctor_id = report['payload'].get('doctor_id')
        action = report['payload'].get('action')
        
        if doctor_id in validated_doctor_ids:
            expected_availability = validated_doctor_ids[doctor_id]
            if (action == 'confirm' and expected_availability) or (action == 'deny' and not expected_availability):
                credit_user(report['user_id'], report['pending_amount'], f"validated:{report['cta']}")
                credited_users.add(report['user_id'])
    
    # Process medicine validations
    validated_medicine_ids = {m['id']: m['available'] for m in result['validated_medicines']}
    for report in validations['medicines']:
        if report['cta'] == 'help.drug_add':
            # Credit for new additions that were validated
            for med_name in report['payload'].get('medicines', []):
                if med_name in validated_medicine_ids:
                    credit_user(report['user_id'], report['pending_amount'], f"validated:{report['cta']}")
                    credited_users.add(report['user_id'])
                    break
        else:
            med_id = report['payload'].get('drug_id')
            action = report['payload'].get('action')
            
            if med_id in validated_medicine_ids:
                expected_availability = validated_medicine_ids[med_id]
                if (action == 'confirm' and expected_availability) or (action == 'deny' and not expected_availability):
                    credit_user(report['user_id'], report['pending_amount'], f"validated:{report['cta']}")
                    credited_users.add(report['user_id'])
    
    # Mark all validations as processed
    for validation_type in ['fullness', 'doctors', 'medicines']:
        for report in validations[validation_type]:
            mark_validation_processed(report['entitlement_id'])

def credit_user(user_id, amount, reason):
    """Credit user balance for validated submission"""
    # Update user balance
    users_table.update_item(
        Key={'user_id': user_id},
        UpdateExpression='ADD balance :amount',
        ExpressionAttributeValues={':amount': amount}
    )
    
    # Record in ledger
    ledger_table.put_item(Item={
        'ledger_id': f"{user_id}#{datetime.utcnow().isoformat()}",
        'user_id': user_id,
        'amount': amount,
        'type': 'credit',
        'reason': reason,
        'timestamp': datetime.utcnow().isoformat()
    })

def mark_validation_processed(entitlement_id):
    """Mark a validation as processed"""
    entitlements_table.update_item(
        Key={'entitlement_id': entitlement_id},
        UpdateExpression='SET validated = :true, validated_at = :time',
        ExpressionAttributeValues={
            ':true': True,
            ':time': datetime.utcnow().isoformat()
        }
    )

def update_centre_statuses(results):
    """Update centre statuses based on validated data"""
    for result in results:
        update_data = {}
        
        if result['fullness_status']:
            update_data['status'] = result['fullness_status']
            update_data['last_update'] = datetime.utcnow().isoformat()
        
        if result['validated_doctors']:
            # Update doctor availability
            current_doctors = get_centre_doctors(result['centre_id'])
            for validated_doctor in result['validated_doctors']:
                if validated_doctor['available']:
                    current_doctors.append(validated_doctor['id'])
                else:
                    current_doctors = [d for d in current_doctors if d != validated_doctor['id']]
            
            update_data['available_doctors'] = list(set(current_doctors))
            update_data['doctor_count'] = len(update_data['available_doctors'])
        
        if result['validated_medicines']:
            # Update medicine availability
            current_medicines = get_centre_medicines(result['centre_id'])
            for validated_medicine in result['validated_medicines']:
                if validated_medicine.get('new') and validated_medicine['available']:
                    current_medicines.append({
                        'id': validated_medicine['id'],
                        'name': validated_medicine['id'],
                        'added_at': datetime.utcnow().isoformat()
                    })
                elif not validated_medicine['available']:
                    current_medicines = [m for m in current_medicines if m['id'] != validated_medicine['id']]
            
            update_data['medicines'] = current_medicines
        
        if update_data:
            update_centre(result['centre_id'], update_data)

def get_centre_doctors(centre_id):
    """Get current doctors list for a centre"""
    response = centres_table.get_item(Key={'id': centre_id})
    return response.get('Item', {}).get('available_doctors', [])

def get_centre_medicines(centre_id):
    """Get current medicines list for a centre"""
    response = centres_table.get_item(Key={'id': centre_id})
    return response.get('Item', {}).get('medicines', [])

def update_centre(centre_id, update_data):
    """Update centre data in DynamoDB"""
    update_expression = []
    expression_values = {}
    
    for key, value in update_data.items():
        update_expression.append(f"{key} = :{key}")
        expression_values[f":{key}"] = value
    
    if update_expression:
        centres_table.update_item(
            Key={'id': centre_id},
            UpdateExpression='SET ' + ', '.join(update_expression),
            ExpressionAttributeValues=expression_values
        )