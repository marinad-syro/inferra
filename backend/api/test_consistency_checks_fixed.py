"""
Test consistency checks with the fixed endpoint.
"""

import asyncio
import httpx
import pandas as pd
from app.services.database import database_service

async def test_consistency_checks_fixed():
    print("=" * 60)
    print("Testing Fixed Consistency Checks")
    print("=" * 60)

    # Step 1: Create test data with inconsistencies
    test_data = pd.DataFrame({
        'subject_id': ['S001', 'S002', 'S003', 'S004', 'S005', 'S006'],
        'condition': ['Control', 'control', 'CONTROL', 'Treatment', 'treatment', 'TREATMENT'],
        'gender': ['Male', 'male', 'Female', 'FEMALE', 'Male', 'female'],
        'score': [85, 90, 78, 92, 88, 75]
    })

    print("\nTest Data:")
    print(f"  Rows: {len(test_data)}")
    print(f"  Condition values: {test_data['condition'].unique().tolist()}")
    print(f"  Gender values: {test_data['gender'].unique().tolist()}")

    # Step 2: Create session and wrangling config
    print("\n\nCreating session and wrangling config...")
    session = await database_service.create_session()
    session_id = session['id']
    print(f"✓ Session: {session_id}")

    wrangling_config = await database_service.create_wrangling_config(session_id)
    config_id = wrangling_config['id']
    print(f"✓ Config: {config_id}")

    # Step 3: Run consistency checks
    print("\n\nRunning consistency checks...")
    data_records = test_data.to_dict(orient='records')

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"http://localhost:8000/api/wrangling/{config_id}/consistency-checks",
            json={"data": data_records}
        )

        print(f"Status: {response.status_code}")

        if response.status_code == 200:
            checks = response.json()
            print(f"\n✓ Received {len(checks)} checks\n")

            for i, check in enumerate(checks, 1):
                print(f"\n{'=' * 60}")
                print(f"Check #{i}: {check['name']}")
                print(f"{'=' * 60}")
                print(f"ID: {check['id']}")
                print(f"Status: {check['status']}")
                print(f"Description: {check.get('description', 'N/A')}")
                print(f"Details: {check.get('details', 'N/A')}")

                # Check for inconsistencies field
                if 'inconsistencies' in check and check['inconsistencies'] is not None:
                    print(f"\n✓✓✓ HAS 'inconsistencies' field! ✓✓✓")
                    inconsistencies = check['inconsistencies']
                    print(f"\nNumber of inconsistency groups: {len(inconsistencies)}")

                    for group in inconsistencies:
                        print(f"\n  Column: {group['column']}")
                        print(f"  Variations: {len(group['variations'])}")
                        for variation in group['variations']:
                            print(f"    - '{variation['value']}': {variation['count']} rows")
                else:
                    print(f"\n  (No inconsistencies data)")

        else:
            print(f"\n✗ Request failed: {response.text}")

    print("\n" + "=" * 60)
    print("Test Complete!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_consistency_checks_fixed())
