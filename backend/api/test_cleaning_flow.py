"""
Test the full data cleaning flow:
1. Upload dataset with inconsistencies
2. Run consistency checks
3. Apply label standardization
4. Verify cleaning is applied during analysis
"""

import asyncio
import pandas as pd
import tempfile
import os
from app.services.database import database_service
from app.services.supabase_client import supabase_service

async def test_cleaning_flow():
    print("=" * 60)
    print("Testing Data Cleaning Flow")
    print("=" * 60)

    # Step 1: Create test dataset with inconsistencies
    print("\n1. Creating test dataset with case-inconsistent labels...")
    test_data = pd.DataFrame({
        'subject_id': ['S001', 'S002', 'S003', 'S004', 'S005', 'S006'],
        'condition': ['Control', 'control', 'CONTROL', 'Treatment', 'treatment', 'TREATMENT'],
        'gender': ['Male', 'male', 'Female', 'FEMALE', 'Male', 'female'],
        'score': [85, 90, 78, 92, 88, 75]
    })

    # Save to temp file
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
    test_data.to_csv(temp_file.name, index=False)
    temp_file.close()
    print(f"✓ Created dataset: {temp_file.name}")
    print(f"  Rows: {len(test_data)}")
    print(f"  Condition values: {test_data['condition'].unique().tolist()}")
    print(f"  Gender values: {test_data['gender'].unique().tolist()}")

    # Step 2: Create session and upload file
    print("\n2. Creating session and uploading file...")
    session = await database_service.create_session()
    session_id = session['id']
    print(f"✓ Created session: {session_id}")

    # Upload file to storage
    storage_path = f"{session_id}/test_cleaning.csv"
    with open(temp_file.name, 'rb') as f:
        file_data = f.read()

    # Upload to Supabase storage
    result = supabase_service.client.storage.from_('datasets').upload(
        storage_path,
        file_data,
        file_options={"content-type": "text/csv"}
    )
    print(f"✓ Uploaded to storage: {storage_path}")

    # Step 3: Create wrangling config
    print("\n3. Creating wrangling config...")
    wrangling_config = await database_service.create_wrangling_config(session_id)
    config_id = wrangling_config['id']
    print(f"✓ Created wrangling config: {config_id}")

    # Step 4: Run consistency checks
    print("\n4. Running consistency checks...")
    from app.services.apiClient import apiClient

    # Check what consistency checks endpoint returns
    print("\n   Checking consistency checks endpoint...")
    import httpx
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/wrangling/consistency-checks",
            json={
                "config_id": config_id,
                "data": test_data.to_dict(orient='records')
            }
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            checks = response.json()
            print(f"   ✓ Received {len(checks)} checks")
            for check in checks:
                print(f"\n   Check: {check['name']}")
                print(f"   Status: {check['status']}")
                print(f"   Details: {check.get('details', 'N/A')}")
                if 'inconsistencies' in check:
                    print(f"   Inconsistencies: {check['inconsistencies']}")
                else:
                    print(f"   ⚠ No 'inconsistencies' field found!")
        else:
            print(f"   ✗ Failed: {response.text}")

    # Step 5: Apply label standardization config
    print("\n5. Applying label standardization config...")
    label_standardization = {
        "condition": {
            "control": "Control",
            "CONTROL": "Control",
            "treatment": "Treatment",
            "TREATMENT": "Treatment"
        },
        "gender": {
            "male": "Male",
            "MALE": "Male",
            "female": "Female",
            "FEMALE": "Female"
        }
    }

    updated_config = await database_service.update_wrangling_config(
        config_id,
        {"label_standardization": label_standardization}
    )
    print(f"✓ Updated config with label standardization")
    print(f"  Columns: {list(label_standardization.keys())}")

    # Step 6: Test cleaning endpoint directly
    print("\n6. Testing Python service cleaning endpoint...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "http://localhost:8001/apply-cleaning",
            json={
                "dataset_reference": temp_file.name,
                "label_standardization": label_standardization,
                "duplicate_handling": "keep_all",
                "duplicate_id_column": None,
                "invalid_value_handling": {}
            }
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   ✓ Status: {result['status']}")
            print(f"   Rows: {result['rows_before']} → {result['rows_after']}")
            print(f"   Changes applied: {result['changes_applied']}")

            # Check cleaned data
            cleaned_df = pd.DataFrame(result['updated_dataset'])
            print(f"\n   Cleaned condition values: {cleaned_df['condition'].unique().tolist()}")
            print(f"   Cleaned gender values: {cleaned_df['gender'].unique().tolist()}")
        else:
            print(f"   ✗ Failed: {response.text}")

    # Step 7: Test apply_cleaning_to_dataset function
    print("\n7. Testing database service apply_cleaning_to_dataset...")
    try:
        cleaned_dataset = await database_service.apply_cleaning_to_dataset(
            dataset_reference=temp_file.name,
            wrangling_config=updated_config
        )
        print(f"✓ Cleaning applied via database service")
        print(f"  Rows returned: {len(cleaned_dataset)}")

        cleaned_df = pd.DataFrame(cleaned_dataset)
        print(f"  Condition values: {cleaned_df['condition'].unique().tolist()}")
        print(f"  Gender values: {cleaned_df['gender'].unique().tolist()}")
    except Exception as e:
        print(f"✗ Failed: {e}")

    # Cleanup
    print("\n8. Cleaning up...")
    os.unlink(temp_file.name)
    print(f"✓ Removed temp file")

    # Try to delete from storage
    try:
        supabase_service.client.storage.from_('datasets').remove([storage_path])
        print(f"✓ Removed from storage")
    except:
        pass

    print("\n" + "=" * 60)
    print("Test Complete!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_cleaning_flow())
