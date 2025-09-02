"""
Script to set up local DynamoDB tables for development
Run this after starting docker-compose
"""

import boto3
import os
import sys
from datetime import datetime

# Local DynamoDB configuration
DYNAMODB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT', 'http://localhost:8000')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Table definitions
TABLES = [
    {
        'TableName': 'health-waze-users-dev',
        'KeySchema': [
            {'AttributeName': 'user_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'user_id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-sessions-dev',
        'KeySchema': [
            {'AttributeName': 'session_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'session_id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-centres-dev',
        'KeySchema': [
            {'AttributeName': 'id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-ledger-dev',
        'KeySchema': [
            {'AttributeName': 'ledger_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'ledger_id', 'AttributeType': 'S'},
            {'AttributeName': 'user_id', 'AttributeType': 'S'},
            {'AttributeName': 'timestamp', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'user-timestamp-index',
                'KeySchema': [
                    {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                    {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-entitlements-dev',
        'KeySchema': [
            {'AttributeName': 'entitlement_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'entitlement_id', 'AttributeType': 'S'},
            {'AttributeName': 'user_id', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'user-index',
                'KeySchema': [
                    {'AttributeName': 'user_id', 'KeyType': 'HASH'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-connections-dev',
        'KeySchema': [
            {'AttributeName': 'connection_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'connection_id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    }
]

def create_tables():
    """Create all DynamoDB tables for local development"""
    # Connect to local DynamoDB
    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url=DYNAMODB_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id='local',
        aws_secret_access_key='local'
    )
    
    # Get existing tables
    existing_tables = []
    try:
        existing_tables = [table.name for table in dynamodb.tables.all()]
    except Exception as e:
        print(f"Error listing tables: {e}")
        print("Make sure DynamoDB Local is running (docker-compose up)")
        sys.exit(1)
    
    # Create each table
    for table_def in TABLES:
        table_name = table_def['TableName']
        
        if table_name in existing_tables:
            print(f"✓ Table {table_name} already exists")
            continue
        
        try:
            # Create table
            table = dynamodb.create_table(**table_def)
            
            # Wait for table to be created
            print(f"Creating table {table_name}...")
            table.wait_until_exists()
            print(f"✓ Table {table_name} created successfully")
            
        except Exception as e:
            print(f"✗ Error creating table {table_name}: {e}")
            sys.exit(1)

def verify_tables():
    """Verify all tables were created successfully"""
    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url=DYNAMODB_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id='local',
        aws_secret_access_key='local'
    )
    
    print("\nVerifying tables...")
    
    for table_def in TABLES:
        table_name = table_def['TableName']
        try:
            table = dynamodb.Table(table_name)
            table.load()
            print(f"✓ {table_name}: {table.table_status}")
        except Exception as e:
            print(f"✗ {table_name}: Error - {e}")

def main():
    """Main function"""
    print("=== Health Waze Local Database Setup ===")
    print(f"DynamoDB Endpoint: {DYNAMODB_ENDPOINT}")
    print(f"AWS Region: {AWS_REGION}")
    print()
    
    # Create tables
    create_tables()
    
    # Verify creation
    verify_tables()
    
    print("\n✓ Local database setup complete!")
    print("\nNext steps:")
    print("1. Run seed data: npm run seed:local")
    print("2. Start backend: npm run dev")
    print("3. View DynamoDB Admin at: http://localhost:8001")

if __name__ == '__main__':
    main()