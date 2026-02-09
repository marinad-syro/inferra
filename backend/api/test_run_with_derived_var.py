"""
Quick test to trigger the /api/run endpoint and capture diagnostic logs.
This simulates what happens when you click "Run Analysis" in the UI.
"""
import asyncio
import httpx

async def test_run():
    # You'll need to replace these with actual values from your UI session
    print("This test needs real session data from your UI.")
    print("\nTo get the data:")
    print("1. Open browser DevTools (F12)")
    print("2. Go to Network tab")
    print("3. Click 'Run Analysis' in the UI")
    print("4. Find the POST request to /api/run")
    print("5. Copy the request payload\n")

    print("Then paste the values here:")
    print("- dataset_reference (e.g., 'abc-123-def/file.csv')")
    print("- execution_spec (if using derived variable)")

    # Example structure (you need to fill in real values):
    """
    payload = {
        "dataset_reference": "YOUR_SESSION_ID/filename.csv",
        "execution_spec": {
            "library": "scipy.stats",
            "function": "chi2_contingency",
            "param_map": {
                "row_col": "Nervous_Breakdown_Binary",  # The derived variable
                "col_col": "Gender"
            }
        }
    }

    url = "http://localhost:8000/api/run"

    async with httpx.AsyncClient(timeout=60.0) as client:
        print(f"\nCalling: {url}")
        print(f"Payload: {payload}\n")

        response = await client.post(url, json=payload)

        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    """

if __name__ == "__main__":
    asyncio.run(test_run())
