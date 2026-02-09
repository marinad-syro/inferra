"""
Simple test to check what consistency checks endpoint returns.
"""

import asyncio
import httpx
import pandas as pd

async def test_consistency_checks():
    print("=" * 60)
    print("Testing Consistency Checks Endpoint")
    print("=" * 60)

    # Create test data with inconsistencies
    test_data = pd.DataFrame({
        'subject_id': ['S001', 'S002', 'S003', 'S004', 'S005', 'S006'],
        'condition': ['Control', 'control', 'CONTROL', 'Treatment', 'treatment', 'TREATMENT'],
        'gender': ['Male', 'male', 'Female', 'FEMALE', 'Male', 'female'],
        'score': [85, 90, 78, 92, 88, 75]
    })

    print("\nTest Data:")
    print(f"  Condition values: {test_data['condition'].unique().tolist()}")
    print(f"  Gender values: {test_data['gender'].unique().tolist()}")

    # Convert to records format
    data_records = test_data.to_dict(orient='records')

    print("\n\nCalling consistency checks endpoint...")
    print("POST http://localhost:8000/api/wrangling/consistency-checks")

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/wrangling/consistency-checks",
                json={
                    "config_id": "dummy-id",  # May not need real ID for this test
                    "data": data_records
                }
            )

            print(f"\nResponse Status: {response.status_code}")

            if response.status_code == 200:
                checks = response.json()
                print(f"\n✓ Received {len(checks)} checks\n")

                for i, check in enumerate(checks, 1):
                    print(f"\n{'=' * 50}")
                    print(f"Check #{i}: {check['name']}")
                    print(f"{'=' * 50}")
                    print(f"ID: {check['id']}")
                    print(f"Status: {check['status']}")
                    print(f"Description: {check.get('description', 'N/A')}")
                    print(f"Details: {check.get('details', 'N/A')}")
                    print(f"Affected Rows: {check.get('affectedRows', 'N/A')}")

                    # THIS IS THE KEY CHECK
                    if 'inconsistencies' in check:
                        print(f"\n✓ HAS 'inconsistencies' field!")
                        print(f"Inconsistencies: {check['inconsistencies']}")
                    else:
                        print(f"\n✗ MISSING 'inconsistencies' field!")
                        print(f"Available keys: {list(check.keys())}")

            elif response.status_code == 404:
                print(f"\n✗ Endpoint not found!")
                print(f"Response: {response.text}")
            else:
                print(f"\n✗ Request failed")
                print(f"Response: {response.text}")

        except httpx.ConnectError:
            print("\n✗ Could not connect to backend!")
            print("Make sure backend is running on http://localhost:8000")
        except Exception as e:
            print(f"\n✗ Error: {e}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(test_consistency_checks())
