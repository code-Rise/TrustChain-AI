import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoints():
    print("Testing TrustChain AI Backend Integration\n")
    print("=" * 50)
    
    # Test 1: Root endpoint
    print("\n1. Testing root endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"   ✓ Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 2: Get all borrowers
    print("\n2. Testing GET /api/borrowers...")
    try:
        response = requests.get(f"{BASE_URL}/api/borrowers")
        print(f"   ✓ Status: {response.status_code}")
        data = response.json()
        print(f"   Found {len(data)} borrowers")
        if data:
            print(f"   Sample: {data[0]['first_name']} {data[0]['last_name']}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 3: Register new user
    print("\n3. Testing POST /api/register-user...")
    try:
        payload = {
            "fullNameOrBusiness": "Test Integration User",
            "entityType": "Individual",
            "country": "Rwanda",
            "city": "Kigali"
        }
        response = requests.post(f"{BASE_URL}/api/register-user", json=payload)
        print(f"   ✓ Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 4: Global stats
    print("\n4. Testing GET /api/stats/global...")
    try:
        response = requests.get(f"{BASE_URL}/api/stats/global")
        print(f"   ✓ Status: {response.status_code}")
        print(f"   Stats: {response.json()}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 5: Regional stats
    print("\n5. Testing GET /api/stats/regions...")
    try:
        response = requests.get(f"{BASE_URL}/api/stats/regions")
        print(f"   ✓ Status: {response.status_code}")
        data = response.json()
        print(f"   Found {len(data)} regions with data")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n" + "=" * 50)
    print("Testing complete!\n")

if __name__ == "__main__":
    print("Make sure the backend server is running on http://localhost:8000")
    input("Press Enter to start tests...")
    test_endpoints()
