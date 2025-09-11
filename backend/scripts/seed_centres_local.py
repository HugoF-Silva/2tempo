#!/usr/bin/env python3
import os
from datetime import datetime
from decimal import Decimal
import re
import boto3

# ---- config (match your local dev) ----
DYNAMODB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT', 'http://localhost:8000')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
# IMPORTANT: this must match api_handler.py env var CENTRES_TABLE
CENTRES_TABLE = os.environ.get('CENTRES_TABLE', 'health-waze-centres-dev')

# ---- input centres (from your list) ----
RAW_CENTRES = [
  { "name": "CIAMS Urias Magalhães", "lat": -16.6514931, "lng": -49.3280203 },
  { "name": "CAIS Cândida de Moraes", "lat": -16.6121551, "lng": -49.3427299 },
  { "name": "UBS Jardim América", "lat": -16.635675,   "lng": -49.2749015 },
  { "name": "CAIS Novo Mundo",       "lat": -16.6179383, "lng": -49.3535845 },
  { "name": "CAIS Campinas",         "lat": -16.667448,  "lng": -49.277836 },
  { "name": "UBS Setor Oeste",       "lat": -16.6892,    "lng": -49.2654 },
  { "name": "CIAMS Pedro Ludovico",  "lat": -16.6423,    "lng": -49.3156 },
  { "name": "UBS Vila Nova",         "lat": -16.6789,    "lng": -49.2987 },
]

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[áàãâä]", "a", s)
    s = re.sub(r"[éèêë]", "e", s)
    s = re.sub(r"[íìîï]", "i", s)
    s = re.sub(r"[óòõôö]", "o", s)
    s = re.sub(r"[úùûü]", "u", s)
    s = re.sub(r"[ç]", "c", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

def normalize_item(raw):
    now = datetime.utcnow().isoformat()
    return {
        # REQUIRED by backend (_normalize_centre_item / get_all_centres)
        "id": slugify(raw["name"]),
        "name": raw["name"],
        # DynamoDB stores numbers as Decimal — backend converts to float
        "lat": Decimal(str(raw["lat"])),
        "lng": Decimal(str(raw["lng"])),
        # Optional but useful for earnings rules; default to 'A'
        "type": "A",
        # Optional: status snapshot (can be absent; map pins still render)
        "status": {
            "fullness": "unknown",           # unknown|low|medium|high
            "available_doctors": None,       # True|False|None
            "doctors_count": None,           # int or None
            "available_drugs": []            # list[str] or empty
        },
        "last_update": now,
        # do NOT set "disabled": True — that would hide the centre
    }

def main():
    print("Seeding centres to:", CENTRES_TABLE)
    dynamodb = boto3.resource(
        "dynamodb",
        endpoint_url=DYNAMODB_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )
    table = dynamodb.Table(CENTRES_TABLE)

    # put items
    with table.batch_writer(overwrite_by_pkeys=["id"]) as batch:
        for raw in RAW_CENTRES:
            item = normalize_item(raw)
            batch.put_item(Item=item)
            print("  +", item["id"], "→", item["name"])

    # sanity check
    resp = table.scan(ProjectionExpression="#i, #n, lat, lng",
                      ExpressionAttributeNames={"#i": "id", "#n": "name"})
    print(f"\n✓ Seeded {len(resp.get('Items', []))} centres.")
    for it in resp.get("Items", []):
        print("   -", it["id"], "(", it["name"], ")")

if __name__ == "__main__":
    main()
