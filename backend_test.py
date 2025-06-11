
import requests
import sys
import time
import json
from datetime import datetime

class HellboundRPGTester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.text}")
                except:
                    pass
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_healthcheck(self):
        """Test the healthcheck endpoint"""
        success, response = self.run_test(
            "Healthcheck API",
            "GET",
            "api/healthcheck",
            200
        )
        if success:
            print(f"Backend Status: {response.get('status')}")
            print(f"OpenAI Configured: {response.get('openai_configured')}")
            print(f"MongoDB Connected: {response.get('mongo_connected')}")
        return success

    def test_start_session(self):
        """Test starting a new game session"""
        success, response = self.run_test(
            "Start Session API",
            "POST",
            "api/start_session",
            200,
            data={}
        )
        if success and 'session_id' in response:
            self.session_id = response['session_id']
            print(f"Session ID: {self.session_id}")
            print(f"Initial Narrative: {response.get('initial_narrative')}")
            
            # Check game state
            game_state = response.get('game_state', {})
            print(f"Player Health: {game_state.get('health')}")
            print(f"Player Mana: {game_state.get('mana')}")
            print(f"Player Gold: {game_state.get('gold')}")
            print(f"Player Location: {game_state.get('location')}")
            print(f"Player Skills: {', '.join(game_state.get('skills', []))}")
        return success

    def test_free_input(self, action):
        """Test submitting a free-form action in Spanish"""
        if not self.session_id:
            print("❌ Cannot test free input without a valid session")
            return False
            
        success, response = self.run_test(
            f"Free Input API - '{action}'",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": action
            }
        )
        if success:
            print(f"Narrative Response: {response.get('narrative')}")
            
            # Check game state updates
            game_state = response.get('game_state', {})
            print(f"Updated Health: {game_state.get('health')}")
            print(f"Updated Mana: {game_state.get('mana')}")
            print(f"Updated Gold: {game_state.get('gold')}")
            print(f"Updated Location: {game_state.get('location')}")
            
            # Check narrative log
            narrative_log = game_state.get('narrativeLog', [])
            if narrative_log:
                print(f"Narrative Log Entries: {len(narrative_log)}")
                last_entry = narrative_log[-1]
                print(f"Last Action: {last_entry.get('player_action')}")
                print(f"Last Narrative: {last_entry.get('narrative')}")
        return success

    def test_get_session(self):
        """Test retrieving an existing session"""
        if not self.session_id:
            print("❌ Cannot test get session without a valid session")
            return False
            
        success, response = self.run_test(
            "Get Session API",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        if success:
            print(f"Retrieved Session ID: {response.get('session_id')}")
            game_state = response.get('game_state', {})
            print(f"Retrieved Game State: Health={game_state.get('health')}, Mana={game_state.get('mana')}")
        return success

def main():
    # Get backend URL from frontend .env file
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    backend_url = line.strip().split('=')[1]
                    break
    except:
        backend_url = "http://localhost:8001"
    
    print(f"🔥 Testing Hellbound RPG Backend at {backend_url}")
    
    # Setup tester
    tester = HellboundRPGTester(backend_url)
    
    # Run tests
    if not tester.test_healthcheck():
        print("❌ Healthcheck failed, stopping tests")
        return 1
    
    if not tester.test_start_session():
        print("❌ Session creation failed, stopping tests")
        return 1
    
    # Test Spanish actions
    spanish_actions = [
        "Abro las puertas lentamente",
        "Examino los alrededores",
        "Uso mi habilidad de exorcismo"
    ]
    
    for action in spanish_actions:
        if not tester.test_free_input(action):
            print(f"❌ Free input test failed for action: {action}")
            break
        time.sleep(1)  # Small delay between requests
    
    if not tester.test_get_session():
        print("❌ Get session test failed")
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
