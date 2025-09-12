"""
AWS Lambda handler for Health Waze API
Server-driven UI implementation with business rules
"""

import json
import os
import time
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import boto3
import jwt
from boto3.dynamodb.conditions import Key, Attr

# DynamoDB tables
DDB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT')
dynamodb = boto3.resource('dynamodb', endpoint_url=DDB_ENDPOINT)
users_table = dynamodb.Table(os.environ['USERS_TABLE'])
sessions_table = dynamodb.Table(os.environ['SESSIONS_TABLE'])
centres_table = dynamodb.Table(os.environ['CENTRES_TABLE'])
ledger_table = dynamodb.Table(os.environ['LEDGER_TABLE'])
entitlements_table = dynamodb.Table(os.environ['ENTITLEMENTS_TABLE'])

# Constants
SECRET_KEY = os.environ['JWT_SECRET']
RADIUS_1_METERS = 50
RADIUS_2_KM = 7
RADIUS_3_KM = 13

# T$ amounts
DISCOVER_COST = 60
FIRST_LOCATION_BONUS = 60
SIGNUP_REFERRAL_BONUS = 50

# Help earnings calculation
def calculate_help_earnings(centre_type: str, help_type: str, radius3_count: int) -> int:
    """Calculate T$ earnings based on centre type and help action"""
    if centre_type == 'A':
        total = 60 * radius3_count
        earnings = {
            'help.fullness_info': int(0.35 * total),
            'help.treatment_available': int(0.30 * total),
            'help.amount_doctors': int(0.075 * total),
            'help.doctors_on_call': int(0.075 * total),
            'help.drug_confirm': int(0.08 * total),
            'help.drug_deny': int(0.08 * total),
            'help.drug_add': int(0.04 * total),
            'help.doctor_confirm': int(0.08 * total),
            'help.doctor_deny': int(0.08 * total),
        }
    else:  # Type B
        total = 60 * radius3_count
        earnings = {
            'help.fullness_info': int(0.35 * total),
            'help.treatment_available': int(0.30 * total),
            'help.drug_confirm': int(0.25 * total / 2),  # Split for 2 per hour
            'help.drug_deny': int(0.25 * total / 2),
            'help.drug_add': int(0.10 * total),
        }
    
    return earnings.get(help_type, 0)

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in kilometers"""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Earth's radius in km
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

def get_user_radius_context(user_location: Dict, centres: List[Dict]) -> Dict:
    """Determine user's radius context for all centres"""
    context = {
        'radius1_centres': [],
        'radius2_centres': [],
        'radius3_centres': [],
        'radius3_count': 0
    }
    
    if not user_location:
        return context
    
    user_lat = user_location['lat']
    user_lng = user_location['lng']
    
    for centre in centres:
        distance_km = calculate_distance(
            user_lat, user_lng,
            centre['lat'], centre['lng']
        )
        distance_m = distance_km * 1000
        
        if distance_m <= RADIUS_1_METERS:
            context['radius1_centres'].append(centre['id'])
        elif distance_km <= RADIUS_2_KM:
            context['radius2_centres'].append(centre['id'])
        elif distance_km <= RADIUS_3_KM:
            context['radius3_centres'].append(centre['id'])
    
    context['radius3_count'] = len(context['radius3_centres'])
    return context

def lambda_handler(event, context):
    """Main Lambda handler with routing (works for REST v1 and HTTP v2)"""
    # Path
    path = event.get('path') or event.get('rawPath') or '/'
    for prefix in ('/dev', '/prod', '/staging'):
        if path.startswith(prefix + '/'):
            path = path[len(prefix):]
            break

    # Method
    if 'httpMethod' in event:  # REST v1
        method = event['httpMethod']
    else:  # HTTP v2
        method = (event.get('requestContext', {})
                      .get('http', {})
                      .get('method', 'GET'))

    # Body (handle base64 + non-JSON)
    body_raw = event.get('body') or '{}'
    if event.get('isBase64Encoded'):
        import base64
        body_raw = base64.b64decode(body_raw).decode('utf-8')
    try:
        body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})
    except json.JSONDecodeError:
        body = {}

    # Headers (be lenient on casing)
    headers = event.get('headers') or {}
    auth = headers.get('Authorization') or headers.get('authorization')
    if auth and auth.startswith('Bearer '):
        session_token = auth.split(' ', 1)[1]
    cookie_header = headers.get('Cookie') or headers.get('cookie') or ''

    # Extract session from cookie
    session_token = None
    if cookie_header:
        for cookie in cookie_header.split('; '):
            if cookie.startswith('session='):
                session_token = cookie.split('=', 1)[1]
                break
    if not session_token and auth and auth.startswith('Bearer '):
        session_token = auth.split(' ', 1)[1]
    
    # Route to appropriate handler
    if path == '/bootstrap' and method == 'POST':
        return handle_bootstrap(body, session_token)
    elif path == '/flow/map' and method == 'POST':
        return handle_flow_map(body, session_token)
    elif path.startswith('/centre/') and path.endswith('/open') and method == 'POST':
        centre_id = path.split('/')[2]
        return handle_open_centre(centre_id, body, session_token)
    elif path.startswith('/centre/') and path.endswith('/read') and method == 'GET':
        centre_id = path.split('/')[2]
        return handle_centre_read(centre_id, session_token)
    elif path == '/cta/execute' and method == 'POST':
        return handle_cta_execute(body, session_token)
    elif path == '/flow/nudges' and method == 'POST':
        return handle_nudges(body, session_token)
    elif path == '/help/plan' and method == 'POST':
        return handle_help_plan(body, session_token)

    return {
        "statusCode": 404,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": "Not found"})
    }

def _to_int(v, default=0):
    if isinstance(v, Decimal):
        return int(v)
    try:
        return int(v)
    except Exception:
        return default
    
def handle_centre_read(centre_id: str, session_token: Optional[str]) -> Dict:
    """
    Read-only payload for X:readStatusPage.
    Keeps rules on the server; returns presentation fields only.
    """
    # Ensure we have (or mint) a session; you may also set a cookie in other handlers
    _ = get_or_create_session(session_token)

    resp = centres_table.get_item(Key={"id": centre_id})
    item = resp.get("Item")
    if not item:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "centre not found"})
        }

    # Build the shape the frontend expects
    data = {
        "id": item["id"],
        "name": item.get("name", item["id"]),
        "status": item.get("status", "average"),      # keep simple, no rules leaked
        "peopleCount": _to_int(item.get("people_count", 0)),
        "doctorCount": _to_int(item.get("doctor_count", 0)),
        "medicines": item.get("medicines", []),       # should be a list
    }

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(data)
    }
    
def handle_bootstrap(body: Dict, session_token: Optional[str]) -> Dict:
    """Handle bootstrap - initial app load"""
    # Get or create session
    session = get_or_create_session(session_token)
    user_state = get_user_state(session['user_id'])
    
    # Determine if first access
    is_first_access = user_state.get('first_access_time') is None
    
    response = {
        'schema': '1',
        'balance': user_state.get('balance', 0),
        'shows': 'home',
        'first_access': is_first_access,
        'tutorial': {}
    }
    
    if is_first_access:
        # Mark first access
        users_table.update_item(
            Key={'user_id': session['user_id']},
            UpdateExpression='SET first_access_time = :time',
            ExpressionAttributeValues={':time': datetime.utcnow().isoformat()}
        )
        
        response['tutorial']['home'] = [
            {
                'message': 'Welcome to Health Waze! Save time finding healthcare.',
                'position': {'top': '50%', 'left': '50%'}
            }
        ]
    
    return {
        'statusCode': 200,
        'headers': {
            'Set-Cookie': f"session={session['session_id']}; HttpOnly; Secure; SameSite=Strict; Path=/",
            'Content-Type': 'application/json'
        },
        'body':json_dumps_safe(response)
    }

# small hot-cache with TTL; survives across warm invocations
_CENTRES_CACHE = {
    "items": None,
    "expires_at": 0.0,
    "ttl_seconds": 30.0,   # tune as you like; centres are basically static
}

def _now_epoch() -> float:
    return time.time()

def _normalize_centre_item(it: Dict) -> Optional[Dict]:
    """
    Convert a raw DynamoDB item to a normalized centre dict.
    Skips malformed/disabled records gracefully.
    """
    if not it or it.get("disabled") is True:
        return None

    try:
        lat = float(it["lat"])
        lng = float(it["lng"])
    except (KeyError, TypeError, ValueError):
        # Skip if location is missing or invalid
        return None

    return {
        "id": it["id"],
        "name": it.get("name", it["id"]),
        "lat": lat,
        "lng": lng,
        "type": it.get("type", "A"),
        # Status fields are optional; keep as-is if present
        "status": it.get("status"),
        "last_update": it.get("last_update"),
    }

def get_all_centres() -> List[Dict]:
    """
    Return every centre (as normalized dicts) from DynamoDB.
    Uses a short in-memory cache for warm Lambda invocations.
    """
    global _CENTRES_CACHE
    if _CENTRES_CACHE["items"] and _now_epoch() < _CENTRES_CACHE["expires_at"]:
        return _CENTRES_CACHE["items"]

    items: List[Dict] = []
    scan_kwargs: Dict = {}
    while True:
        resp = centres_table.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        scan_kwargs["ExclusiveStartKey"] = lek

    centres: List[Dict] = []
    for it in items:
        n = _normalize_centre_item(it)
        if n:
            centres.append(n)

    # cache the normalized list
    _CENTRES_CACHE["items"] = centres
    _CENTRES_CACHE["expires_at"] = _now_epoch() + _CENTRES_CACHE["ttl_seconds"]
    return centres

def get_centre(centre_id: str) -> Optional[Dict]:
    """Fetch a single centre by id (normalized)."""
    resp = centres_table.get_item(Key={"id": centre_id})
    it = resp.get("Item")
    return _normalize_centre_item(it) if it else None

def get_unlocked_centres(user_id: str) -> List[str]:
    """
    Minimal implementation: read a 'unlocked_centres' list from the user item.
    If absent, return empty list (pins will still render as locked).
    """
    try:
        resp = users_table.get_item(Key={"user_id": user_id}, ProjectionExpression="unlocked_centres")
        item = resp.get("Item") or {}
        unlocked = item.get("unlocked_centres") or []
        # DynamoDB string sets may arrive as set(...); normalize to list
        return list(unlocked) if not isinstance(unlocked, list) else unlocked
    except Exception:
        return []

def check_can_earn_by_info(user_id: str, radius_ctx: Dict) -> bool:
    """
    Conservative stub so low-balance overlay logic won't crash.
    You can expand this later with the full rules you outlined.
    """
    return bool(radius_ctx.get("radius1_centres") or radius_ctx.get("radius2_centres"))

def handle_flow_map(body: Dict, session_token: str) -> Dict:
    session = get_or_create_session(session_token)
    user_state = get_user_state(session['user_id'])
    location = body.get('location')

    centres = get_all_centres()                  # ← implemented
    radius_ctx = get_user_radius_context(location, centres)
    unlocked = get_unlocked_centres(session['user_id'])  # ← implemented

    pins = []
    for c in centres:
        pin = {
            'id': c['id'],
            'name': c['name'],
            'lat': float(c['lat']),
            'lng': float(c['lng']),
            'locked': c['id'] not in unlocked,
            'type': c.get('type', 'A'),
        }
        # status only when unlocked or user currently in radius1 (read rules)
        if (not pin['locked']) or (c['id'] in radius_ctx['radius1_centres']):
            pin['status'] = c.get('status')
            pin['lastUpdate'] = c.get('last_update')
        pins.append(pin)

    highlights = []

    entitlements = []
    if user_state.get('balance', 0) >= DISCOVER_COST:
        for c in centres:
            if c['id'] in unlocked:
                continue
            entitlements.append({
                'cta': 'discover',
                'centre_id': c['id'],
                'token': generate_cta_token(
                    session['user_id'], 'discover', c['id'], radius_ctx['radius3_count']
                ),
                'limit': '1/h',
            })

    response = {
        'schema': '1',
        'pins': pins,
        'highlights': highlights,
        'overlays': [],
        'entitlements': entitlements,
        'pages_after': None
    }

    if location and user_state.get('first_location_shared') is None:
        credit_user_balance(session['user_id'], FIRST_LOCATION_BONUS, 'first_location_share')
        response['overlays'].append({
            'type': 'success',
            'message': 'Congrats! You earned 1 hour.',
            'position': {'top': '20%', 'left': '50%'}
        })
        users_table.update_item(
            Key={'user_id': session['user_id']},
            UpdateExpression='SET first_location_shared = :true',
            ExpressionAttributeValues={':true': True}
        )
        response['tutorial'] = {
            'map': [
                {
                    'message': 'Tap a grey pin to discover if it\'s full or not',
                    'highlight': {'selector': '.health-marker--locked'},
                    'finger': {'top': '50%', 'left': '50%', 'animation': 'tap'}
                }
            ]
        }

    if user_state.get('balance', 0) < DISCOVER_COST:
        # FIX: use radius_ctx (not radius_context)
        can_earn = check_can_earn_by_info(session['user_id'], radius_ctx)
        if can_earn:
            response['overlays'].append({
                'type': 'cta',
                'copy_key': 'It seems you don\'t have enough Time $aved',
                'actions': [
                    {'id': 'earn_more', 'label': 'Earn more', 'variant': 'primary'}
                ],
                'anchor': 'balance'
            })

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json_dumps_safe(response)   # safer for any Decimal left around
    }

def json_dumps_safe(obj):
    """json.dumps that converts Decimal -> int/float recursively"""
    def convert(o):
        if isinstance(o, list):
            return [convert(i) for i in o]
        if isinstance(o, dict):
            return {k: convert(v) for k, v in o.items()}
        if isinstance(o, Decimal):
            return int(o) if o % 1 == 0 else float(o)
        return o
    return json.dumps(convert(obj))

def handle_open_centre(centre_id: str, body: Dict, session_token: str) -> Dict:
    """Handle opening a centre - decides X vs Y pages"""
    # session = get_session(session_token)
    session = get_or_create_session(session_token)
    location = body.get('location')
    
    # Get centre and user context
    centre = get_centre(centre_id)
    radius_context = get_user_radius_context(location, [centre])
    
    # Determine page type
    if centre_id in radius_context['radius1_centres']:
        shows = 'Y'  # ReadWrite page
        entitlements = generate_write_entitlements(
            session['user_id'],
            centre_id,
            centre['type'],
            radius_context['radius3_count']
        )
    else:
        shows = 'X'  # ReadOnly page
        entitlements = []
    
    # Auto-unlock if in radius1
    if centre_id in radius_context['radius1_centres']:
        unlock_centre(session['user_id'], centre_id, 'radius1')
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'shows': shows,
            'entitlements': entitlements
        })
    }

def handle_cta_execute(body: Dict, session_token: str) -> Dict:
    """Execute a CTA with token validation"""
    # session = get_session(session_token)
    session = get_or_create_session(session_token)
    cta_id = body['cta_id']
    token = body['token']
    payload = body.get('payload', {})
    
    # Validate token
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        
        # Verify token claims
        if claims['sub'] != session['user_id']:
            raise ValueError('Token user mismatch')
        if claims['cta'] != cta_id:
            raise ValueError('Token CTA mismatch')
        if claims.get('centre_id') != payload.get('centre_id'):
            raise ValueError('Token centre mismatch')
            
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError) as e:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json'},
            'body': json_dumps_safe({'error': 'Invalid or expired token'})
        }
    
    # Execute CTA based on type
    if cta_id == 'discover':
        result = execute_discover(session['user_id'], payload['centre_id'])
    elif cta_id.startswith('help.'):
        result = execute_help_action(session['user_id'], cta_id, payload, claims)
    else:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json_dumps_safe({'error': 'Unknown CTA'})
        }
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json_dumps_safe(result)
    }

def execute_discover(user_id: str, centre_id: str) -> Dict:
    """Execute discover action - unlock a centre"""
    user_state = get_user_state(user_id)
    
    # Check balance
    if user_state['balance'] < DISCOVER_COST:
        raise ValueError('Insufficient balance')
    
    # Deduct cost
    debit_user_balance(user_id, DISCOVER_COST, f'discover:{centre_id}')
    
    # Unlock centre  
    unlock_centre(user_id, centre_id, 'radius2')
    
    # Get updated balance
    new_balance = user_state['balance'] - DISCOVER_COST
    
    return {
        'success': True,
        'balance': new_balance,
        'message': 'Centre unlocked!'
    }

def execute_help_action(user_id: str, cta_id: str, payload: Dict, claims: Dict) -> Dict:
    """Execute a help action"""
    centre_id = payload['centre_id']
    # centre = get_centre(centre_id)
    
    # Check rate limits
    # if not check_help_rate_limit(user_id, centre_id, cta_id):
        # raise ValueError('Rate limit exceeded')
    
    # Calculate earnings
    radius3_count = claims.get('radius3_count', 5)
    # earn_amount = calculate_help_earnings(centre['type'], cta_id, radius3_count)
    
    # Immediate vs validated earnings
    if cta_id == 'help.treatment_available':
        # Full immediate credit
        # credit_user_balance(user_id, earn_amount, f'{cta_id}:{centre_id}')
        validation_due_at = None
    # else:
        # 25% immediate, 75% on validation
        # immediate = int(earn_amount * 0.25)
        # pending = earn_amount - immediate
        
        # credit_user_balance(user_id, immediate, f'{cta_id}:{centre_id}:immediate')
        
        # Schedule validation
        # validation_time = get_next_validation_time()
        # create_pending_validation(user_id, centre_id, cta_id, pending, validation_time)
        
        # validation_due_at = validation_time.isoformat()
    
    # Record help action
    # record_help_action(user_id, centre_id, cta_id, payload)
    
    # Get updated balance
    user_state = get_user_state(user_id)
    bal = user_state.get('balance', 0)
    try:
        # Convert Decimal -> int (or float) explicitly
        from decimal import Decimal as _D
        if isinstance(bal, _D):
            bal = int(bal) if bal % 1 == 0 else float(bal)
    except Exception:
        pass
 
    return {
        'success': True,
        'balance': bal,
        # 'earn_amount': format_time_amount(earn_amount),
        'earn_amount': format_time_amount(60),
        'validation_due_at': validation_due_at
    }

def generate_write_entitlements(user_id: str, centre_id: str, centre_type: str, radius3_count: int) -> List[Dict]:
    """Generate CTA entitlements for write actions"""
    entitlements = []
    current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    
    # Check what help is available
    # help_counts = get_help_counts(user_id, centre_id, current_hour)
    
    # Treatment available (once per day)
    # if not help_counts.get('treatment_today'):
    if True:
        token = generate_cta_token(user_id, 'help.treatment_available', centre_id, radius3_count)
        entitlements.append({
            'cta': 'help.treatment_available',
            'token': token,
            'available': True,
            'earn_amount': format_time_amount(
                calculate_help_earnings(centre_type, 'help.treatment_available', radius3_count)
            )
        })
    
    # Fullness info (once per hour)
    # if not help_counts.get('fullness_this_hour'):
    if True:
        token = generate_cta_token(user_id, 'help.fullness_info', centre_id, radius3_count)
        entitlements.append({
            'cta': 'help.fullness_info',
            'token': token,
            'available': True,
            'earn_amount': format_time_amount(
                calculate_help_earnings(centre_type, 'help.fullness_info', radius3_count)
            )
        })
    
    # Add other entitlements based on centre type...
    
    return entitlements

def generate_cta_token(user_id: str, cta: str, centre_id: str, radius3_count: int) -> str:
    """Generate a short-lived CTA token"""
    exp = datetime.utcnow() + timedelta(minutes=10)
    
    payload = {
        'sub': user_id,
        'cta': cta,
        'centre_id': centre_id,
        'radius3_count': radius3_count,
        'exp': exp,
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def format_time_amount(minutes: int) -> str:
    """Format minutes as human-readable time"""
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    mins = minutes % 60
    if mins == 0:
        return f"{hours} hour{'s' if hours > 1 else ''}"
    return f"{hours}h {mins}min"

# Helper functions for data access
def get_or_create_session(session_token: Optional[str]) -> Dict:
    """Get existing session or create new anonymous one"""
    if session_token:
        try:
            response = sessions_table.get_item(Key={'session_id': session_token})
            if 'Item' in response:
                return response['Item']
        except:
            pass
    
    # Create new anonymous session
    import uuid
    session_id = str(uuid.uuid4())
    user_id = f"anon_{uuid.uuid4()}"
    
    # Create anonymous user
    users_table.put_item(Item={
        'user_id': user_id,
        'anonymous': True,
        'balance': 0,
        'created_at': datetime.utcnow().isoformat()
    })
    
    # Create session
    sessions_table.put_item(Item={
        'session_id': session_id,
        'user_id': user_id,
        'created_at': datetime.utcnow().isoformat(),
        'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())
    })
    
    return {'session_id': session_id, 'user_id': user_id}

def get_user_state(user_id: str) -> Dict:
    """Get complete user state"""
    response = users_table.get_item(Key={'user_id': user_id})
    return response.get('Item', {'balance': 0})

def credit_user_balance(user_id: str, amount: int, reason: str):
    """Add to user balance and record in ledger"""
    # Update balance
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

def debit_user_balance(user_id: str, amount: int, reason: str) -> int:
    """
    Atomically subtract `amount` from user balance (non-negative).
    Returns the updated balance (int).
    Raises ValueError if insufficient funds or user missing.
    """
    if amount <= 0:
        raise ValueError('Amount must be positive')

    try:
        resp = users_table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='SET balance = if_not_exists(balance, :zero) - :amt',
            ConditionExpression=Attr('balance').gte(Decimal(amount)),
            ExpressionAttributeValues={
                ':amt': Decimal(amount),
                ':zero': Decimal(0),
            },
            ReturnValues='UPDATED_NEW'
        )
    except users_table.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValueError('Insufficient balance')

    # Record in ledger (negative)
    ledger_table.put_item(Item={
        'ledger_id': f"{user_id}#{datetime.utcnow().isoformat()}",
        'user_id': user_id,
        'amount': -int(amount),
        'type': 'debit',
        'reason': reason,
        'timestamp': datetime.utcnow().isoformat()
    })

    new_bal = resp.get('Attributes', {}).get('balance', 0)
    # new_bal may be Decimal
    return int(new_bal) if isinstance(new_bal, Decimal) else int(new_bal or 0)

def unlock_centre(user_id: str, centre_id: str, scope: str):
    """
    Persist unlock for a centre.
    - Prefers a String Set 'unlocked_centres' (ADD).
    - Falls back to list if the attribute exists as a list.
    """
    # Fast path: ADD to a String Set
    try:
        users_table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='ADD unlocked_centres :c',
            ExpressionAttributeValues={
                ':c': set([centre_id])
            }
        )
        return
    except users_table.meta.client.exceptions.ValidationException:
        # Type mismatch (likely a list) -> fall back below
        pass

    # Fallback: ensure no duplicates, then list_append
    # Prevent duplicates with a condition
    try:
        users_table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='SET unlocked_centres = list_append(if_not_exists(unlocked_centres, :empty), :new)',
            ConditionExpression=Attr('unlocked_centres').not_exists() | Attr('unlocked_centres').contains(centre_id).negate(),
            ExpressionAttributeValues={
                ':empty': [],
                ':new': [centre_id],
            }
        )
    except users_table.meta.client.exceptions.ConditionalCheckFailedException:
        # Already present in the list -> nothing else to do
        pass

    # (Optional) You can persist scope/expiry later in a dedicated table as per your full rules.
