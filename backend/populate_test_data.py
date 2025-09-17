#!/usr/bin/env python3
"""
Script to populate the database with test data for development.

This script creates sample runs and live streams data to help with development
and testing when the database is empty.
"""

import asyncio
import httpx
from datetime import datetime, timedelta
import random
import string

# Sample data templates
SAMPLE_RUN_PAYLOAD = {
    "name": "Test Run",
    "difficulty": "medium",
    "target": 100.0,
    "max_nonces": 100000,
    "server_seed": "test_server_seed_123",
    "client_seed": "test_client_seed_123"
}

SAMPLE_BET_PAYLOAD_TEMPLATE = {
    "id": "bet_{}",
    "dateTime": "2025-09-08T20:31:11.123Z",
    "nonce": 12345,
    "amount": 0.2,
    "payout": 2240.13,
    "difficulty": "expert",
    "roundTarget": 400.02,
    "roundResult": 11200.65,
    "clientSeed": "abcd-123",
    "serverSeedHashed": "1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
}

def generate_random_string(length=10):
    """Generate a random string of given length."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def generate_random_hash():
    """Generate a random SHA256-like hash."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=64))

async def create_sample_run(client: httpx.AsyncClient, run_number: int):
    """Create a sample run via the API."""
    payload = SAMPLE_RUN_PAYLOAD.copy()
    payload["name"] = f"Sample Run {run_number}"
    payload["server_seed"] = f"server_seed_{run_number}_{generate_random_string()}"
    payload["client_seed"] = f"client_seed_{run_number}_{generate_random_string()}"

    try:
        response = await client.post("http://localhost:8000/runs", json=payload)
        if response.status_code == 201:
            print(f"✓ Created run {run_number}")
            return response.json()
        else:
            print(f"✗ Failed to create run {run_number}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Error creating run {run_number}: {e}")
        return None

async def create_sample_bets(client: httpx.AsyncClient, count: int = 5):
    """Create sample bets via the ingestion endpoint."""
    for i in range(count):
        payload = SAMPLE_BET_PAYLOAD_TEMPLATE.copy()
        payload["id"] = f"bet_{generate_random_string(8)}"
        payload["nonce"] = random.randint(1, 100000)
        payload["amount"] = round(random.uniform(0.1, 10.0), 2)
        payload["payout"] = round(random.uniform(1.0, 5000.0), 2)
        payload["clientSeed"] = generate_random_string(12)
        payload["serverSeedHashed"] = generate_random_hash()

        try:
            response = await client.post("http://localhost:8000/live/ingest", json=payload)
            if response.status_code == 200:
                print(f"✓ Created bet {i+1}/{count}")
            else:
                print(f"✗ Failed to create bet {i+1}: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"✗ Error creating bet {i+1}: {e}")

        # Small delay to avoid overwhelming the server
        await asyncio.sleep(0.1)

async def main():
    """Main function to populate test data."""
    print("🚀 Starting database population with test data...")
    print("Make sure the backend server is running on http://localhost:8000")
    print()

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create sample runs
        print("📝 Creating sample runs...")
        for i in range(1, 6):  # Create 5 sample runs
            await create_sample_run(client, i)

        print()

        # Create sample bets (which will create live streams)
        print("🎲 Creating sample bets and live streams...")
        await create_sample_bets(client, 20)  # Create 20 sample bets

    print()
    print("✅ Database population complete!")
    print("You can now check your application to see the test data.")
    print()
    print("To verify:")
    print("  curl http://localhost:8000/runs")
    print("  curl http://localhost:8000/live/streams")

if __name__ == "__main__":
    asyncio.run(main())