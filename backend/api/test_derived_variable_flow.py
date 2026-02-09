"""
Test to diagnose where derived variable columns get lost in the analysis flow.

This test simulates:
1. Creating a derived variable
2. Running an analysis that uses it
3. Checking if the column actually makes it to the python service
"""
import asyncio
import os
import sys
import tempfile
import pandas as pd
import httpx
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.services.database import database_service
from app.config.settings import settings


async def test_derived_variable_flow():
    """Test the complete flow of derived variables through analysis execution."""

    print("\n" + "="*80)
    print("DERIVED VARIABLE FLOW DIAGNOSTIC TEST")
    print("="*80)

    # Step 1: Create a test dataset
    print("\n[1] Creating test dataset...")
    test_data = pd.DataFrame({
        'Gender': ['Male', 'Female', 'Male', 'Female'],
        'Diagnosis': ['Normal', 'Bipolar', 'Normal', 'Bipolar'],
        'Score': [75, 82, 68, 91]
    })

    # Save to temp file
    fd, dataset_path = tempfile.mkstemp(suffix='.csv')
    os.close(fd)
    test_data.to_csv(dataset_path, index=False)
    print(f"   Created dataset at: {dataset_path}")
    print(f"   Original columns: {list(test_data.columns)}")

    # Step 2: Simulate creating a derived variable in the database
    print("\n[2] Simulating derived variable creation...")
    # We'll use a fake session_id for this test
    test_session_id = "00000000-0000-0000-0000-000000000001"

    # Create a derived variable directly in Supabase
    test_variable = {
        "name": "Gender_Binary",
        "formula": "map_binary('Gender', {'Male': 1, 'Female': 0})",
        "formula_type": "transform",
        "description": "Binary encoding of gender"
    }

    try:
        created_var = await database_service.create_derived_variable(
            session_id=test_session_id,
            variable=test_variable
        )
        print(f"   ✓ Created derived variable: {test_variable['name']}")
    except Exception as e:
        print(f"   ✗ Failed to create variable in DB: {e}")
        print("   → This test requires a working Supabase connection")
        return

    # Step 3: Test apply_derived_variables_to_dataset
    print("\n[3] Applying derived variables to dataset...")
    print(f"   Input dataset path: {dataset_path}")
    print(f"   Session ID: {test_session_id}")
    print(f"   Python service URL: {settings.python_service_url}")

    try:
        updated_dataset_path = await database_service.apply_derived_variables_to_dataset(
            dataset_path=dataset_path,
            session_id=test_session_id,
            python_service_url=settings.python_service_url
        )
        print(f"   ✓ Updated dataset path: {updated_dataset_path}")

        # Check columns in updated dataset
        updated_df = pd.read_csv(updated_dataset_path)
        print(f"   Updated columns: {list(updated_df.columns)}")

        if test_variable["name"] in updated_df.columns:
            print(f"   ✓ Derived variable '{test_variable['name']}' IS present in updated dataset")
            print(f"     Sample values: {updated_df[test_variable['name']].tolist()}")
        else:
            print(f"   ✗ Derived variable '{test_variable['name']}' is MISSING from updated dataset")

    except Exception as e:
        print(f"   ✗ Failed to apply derived variables: {e}")
        import traceback
        traceback.print_exc()
        return

    # Step 4: Simulate running an analysis with execution_spec
    print("\n[4] Simulating analysis execution with execution_spec...")

    execution_spec = {
        "library": "scipy.stats",
        "function": "chi2_contingency",
        "param_map": {
            "row_col": "Gender_Binary",  # Using the derived variable
            "col_col": "Diagnosis"
        }
    }

    print(f"   execution_spec: {execution_spec}")

    # Build the payload exactly as run.py does
    param_map_for_service = {
        k: {"column": v}
        for k, v in execution_spec["param_map"].items()
    }

    payload = {
        "dataset_reference": updated_dataset_path,
        "decision": {
            "library": execution_spec["library"],
            "function": execution_spec["function"],
            "param_map": param_map_for_service
        },
        "job_id": "test"
    }

    print(f"   Payload to python-service:")
    print(f"     dataset_reference: {payload['dataset_reference']}")
    print(f"     function: {payload['decision']['library']}.{payload['decision']['function']}")
    print(f"     param_map: {payload['decision']['param_map']}")

    # Call python service
    python_service_url = f"{settings.python_service_url}/analyze"
    print(f"\n   Calling: {python_service_url}")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(python_service_url, json=payload)

            if response.status_code != 200:
                print(f"   ✗ Python service error: {response.status_code}")
                print(f"     Response: {response.text}")
            else:
                result = response.json()
                if result.get("status") == "error":
                    print(f"   ✗ Analysis error: {result.get('error')}")
                else:
                    print(f"   ✓ Analysis succeeded!")
                    print(f"     Results: {result.get('results', {})}")

    except Exception as e:
        print(f"   ✗ Failed to call python service: {e}")
        import traceback
        traceback.print_exc()

    # Step 5: Test the MISSING session_id scenario (reproducing the bug)
    print("\n[5] Testing analysis WITHOUT session_id (reproducing the bug)...")
    print("   This simulates what happens when session_id is None in run.py")

    # Call apply_derived_variables with original dataset and a non-existent session
    fake_session = "99999999-9999-9999-9999-999999999999"

    print(f"   Using fake session_id: {fake_session}")
    no_vars_path = await database_service.apply_derived_variables_to_dataset(
        dataset_path=dataset_path,  # Original dataset, not updated
        session_id=fake_session,
        python_service_url=settings.python_service_url
    )

    df_no_vars = pd.read_csv(no_vars_path)
    print(f"   Columns without derived variables: {list(df_no_vars.columns)}")

    if test_variable["name"] in df_no_vars.columns:
        print(f"   ✗ Unexpected: derived variable is present")
    else:
        print(f"   ✓ Expected: derived variable is NOT present (no session variables found)")

    # Now try to run analysis - this should fail
    print("\n   Attempting analysis on dataset without derived variables...")
    payload_no_vars = {
        "dataset_reference": no_vars_path,
        "decision": {
            "library": execution_spec["library"],
            "function": execution_spec["function"],
            "param_map": param_map_for_service
        },
        "job_id": "test_fail"
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(python_service_url, json=payload_no_vars)
            result = response.json()

            if result.get("status") == "error":
                print(f"   ✓ Expected error: {result.get('error')}")
                print(f"   → This is the bug you're seeing!")
            else:
                print(f"   ✗ Unexpected: analysis succeeded")

    except Exception as e:
        print(f"   Error calling python service: {e}")

    # Cleanup
    print("\n[6] Cleaning up...")
    try:
        await database_service.delete_derived_variable(created_var["id"])
        print(f"   ✓ Deleted test variable from database")
    except:
        pass

    for path in [dataset_path, updated_dataset_path, no_vars_path]:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

    print("\n" + "="*80)
    print("DIAGNOSIS COMPLETE")
    print("="*80)
    print("\nKEY QUESTION TO CHECK:")
    print("  When you run analysis from the UI, is session_id being extracted correctly")
    print("  from the dataset_reference? Check the backend logs for:")
    print("  - 'Extracted session_id: ...' (should show actual session ID)")
    print("  - 'Applying derived variables for session ...' (should appear)")
    print("  - If these logs are missing, session_id is None and variables won't be applied!")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(test_derived_variable_flow())
