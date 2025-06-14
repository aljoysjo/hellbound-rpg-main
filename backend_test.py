
import requests
import sys
import time
import json
import websocket
import threading
import queue
from datetime import datetime

class HellboundRPGTester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.ws_messages = queue.Queue()
        self.ws = None
        self.ws_connected = False
        self.ws_thread = None

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
            
            # Validate that OpenAI is configured
            if not response.get('openai_configured'):
                print("❌ OpenAI is not configured")
                return False
        return success

    def test_start_session_sandbox(self):
        """Test starting a new sandbox game session with a specific concept"""
        success, response = self.run_test(
            "Start Sandbox Session API",
            "POST",
            "api/start_session",
            200,
            data={
                "mode": "sandbox", 
                "sandboxConcept": "Explorador encontrando tesoros"
            }
        )
        if success and 'session_id' in response:
            self.session_id = response['session_id']
            print(f"Session ID: {self.session_id}")
            print(f"Initial Narrative: {response.get('initial_narrative')}")
            
            # Check game state
            game_state = response.get('game_state', {})
            self.validate_game_state_structure(game_state)
            
            # Verify sandbox-specific elements
            if game_state.get('mode') != 'sandbox':
                print("❌ Game mode is not set to sandbox")
                return False
                
            # Check for sandbox concept
            if not game_state.get('sandboxConcept'):
                print("❌ Sandbox concept not found")
                return False
                
            print(f"Sandbox Mode: {game_state.get('mode')}")
            print(f"Sandbox Concept: {game_state.get('sandboxConcept')}")
            print(f"Initial Action Count: {game_state.get('actionCount', 0)}")
            
            # Connect to WebSocket for this session
            self.connect_websocket()
            
            return True
        return False

    def validate_game_state_structure(self, game_state):
        """Validate the structure of the game state"""
        print("\n🔍 Validating game state structure...")
        
        # Check for required fields
        required_fields = [
            'inventory', 'skills', 'emotionalStates', 'questObjectives',
            'vitals', 'resources', 'location', 'actionCount'
        ]
        
        for field in required_fields:
            if field not in game_state:
                print(f"❌ Missing required field: {field}")
                return False
        
        # Check inventory structure
        print(f"📦 Inventory: {game_state.get('inventory', [])}")
        
        # Check action count
        print(f"🔢 Action Count: {game_state.get('actionCount', 0)}")
        
        # Check skills structure
        skills = game_state.get('skills', [])
        print(f"🔧 Skills: {len(skills)} skills")
        if skills:
            for skill in skills:
                if isinstance(skill, dict):
                    print(f"  - {skill.get('id')} (Level {skill.get('level')}): {skill.get('description')}")
                else:
                    print(f"  - {skill}")
        
        # Check emotional states
        emotional_states = game_state.get('emotionalStates', {})
        print(f"😊 Emotional States:")
        for emotion, value in emotional_states.items():
            print(f"  - {emotion}: {value}%")
        
        # Check quest objectives
        objectives = game_state.get('questObjectives', [])
        print(f"🎯 Quest Objectives: {len(objectives)} objectives")
        for objective in objectives:
            if isinstance(objective, dict):
                print(f"  - {objective.get('description')} ({objective.get('progress')}%)")
        
        print("✅ Game state structure validation complete")
        return True

    def test_action_count_increment(self):
        """Test that actionCount increments correctly after actions"""
        if not self.session_id:
            print("❌ Cannot test action count without a valid session")
            return False
            
        # Get initial state
        _, initial_response = self.run_test(
            "Get Initial Session State",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_action_count = initial_response.get('game_state', {}).get('actionCount', 0)
        print(f"Initial Action Count: {initial_action_count}")
        
        # Send action to find a magical book
        success, response = self.run_test(
            "Action Count - Find Magical Book",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "Buscar un libro mágico en la biblioteca"
            }
        )
        
        if success:
            # Check if action count increased
            game_state = response.get('game_state', {})
            new_action_count = game_state.get('actionCount', 0)
            print(f"New Action Count: {new_action_count}")
            
            if new_action_count > initial_action_count:
                print(f"✅ Action count successfully incremented from {initial_action_count} to {new_action_count}")
                return True
            else:
                print(f"❌ Action count did not increment as expected")
                return False
        
        return False

    def test_inventory_item_acquisition(self):
        """Test acquiring items and verify they are not duplicated"""
        if not self.session_id:
            print("❌ Cannot test inventory changes without a valid session")
            return False
            
        # Get initial inventory
        _, initial_response = self.run_test(
            "Get Initial Inventory State",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_inventory = initial_response.get('game_state', {}).get('inventory', [])
        initial_count = len(initial_inventory)
        print(f"Initial Inventory Count: {initial_count}")
        print(f"Initial Inventory: {initial_inventory}")
        
        # Send action to find a treasure
        success, response = self.run_test(
            "Inventory Change - Find Treasure",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "Buscar un tesoro antiguo en la cueva"
            }
        )
        
        if success:
            # Check for inventory changes
            game_state = response.get('game_state', {})
            new_inventory = game_state.get('inventory', [])
            new_count = len(new_inventory)
            print(f"New Inventory Count: {new_count}")
            print(f"New Inventory: {new_inventory}")
            
            # Check if inventory changed
            if new_count > initial_count:
                print(f"✅ Inventory successfully changed from {initial_count} to {new_count} items")
                
                # Get the latest inventory state through polling endpoint
                _, polling_response = self.run_test(
                    "Poll Session State After Item Acquisition",
                    "GET",
                    f"api/get_session/{self.session_id}",
                    200
                )
                
                polling_inventory = polling_response.get('game_state', {}).get('inventory', [])
                polling_count = len(polling_inventory)
                print(f"Polled Inventory Count: {polling_count}")
                print(f"Polled Inventory: {polling_inventory}")
                
                # Verify no duplication occurred
                if polling_count == new_count:
                    print("✅ No inventory duplication detected")
                    return True
                else:
                    print(f"❌ Possible inventory duplication: {new_count} vs {polling_count}")
                    return False
            else:
                print("❌ Inventory did not change as expected")
                
                # Try another action
                success, response = self.run_test(
                    "Inventory Change - Second Attempt",
                    "POST",
                    "api/free_input",
                    200,
                    data={
                        "session_id": self.session_id,
                        "action": "Excavar en el suelo para encontrar reliquias"
                    }
                )
                
                if success:
                    game_state = response.get('game_state', {})
                    new_inventory = game_state.get('inventory', [])
                    new_count = len(new_inventory)
                    print(f"New Inventory Count (Second Attempt): {new_count}")
                    print(f"New Inventory (Second Attempt): {new_inventory}")
                    
                    if new_count > initial_count:
                        print(f"✅ Inventory successfully changed on second attempt")
                        
                        # Get the latest inventory state through polling endpoint
                        _, polling_response = self.run_test(
                            "Poll Session State After Second Item Acquisition",
                            "GET",
                            f"api/get_session/{self.session_id}",
                            200
                        )
                        
                        polling_inventory = polling_response.get('game_state', {}).get('inventory', [])
                        polling_count = len(polling_inventory)
                        print(f"Polled Inventory Count (Second Attempt): {polling_count}")
                        print(f"Polled Inventory (Second Attempt): {polling_inventory}")
                        
                        # Verify no duplication occurred
                        if polling_count == new_count:
                            print("✅ No inventory duplication detected on second attempt")
                            return True
                        else:
                            print(f"❌ Possible inventory duplication on second attempt: {new_count} vs {polling_count}")
                            return False
        
        return False

    def test_multiple_actions_and_polling(self):
        """Test multiple actions and verify polling endpoint correctly tracks changes"""
        if not self.session_id:
            print("❌ Cannot test multiple actions without a valid session")
            return False
            
        # Get initial state
        _, initial_response = self.run_test(
            "Get Initial State for Multiple Actions Test",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_action_count = initial_response.get('game_state', {}).get('actionCount', 0)
        initial_inventory = initial_response.get('game_state', {}).get('inventory', [])
        print(f"Initial Action Count: {initial_action_count}")
        print(f"Initial Inventory Count: {len(initial_inventory)}")
        
        # Execute multiple actions
        actions = [
            "Explorar la cueva oscura",
            "Buscar tesoros en el cofre",
            "Examinar las inscripciones en la pared"
        ]
        
        last_action_count = initial_action_count
        last_inventory_count = len(initial_inventory)
        
        for i, action in enumerate(actions):
            success, response = self.run_test(
                f"Multiple Actions Test - Action {i+1}",
                "POST",
                "api/free_input",
                200,
                data={
                    "session_id": self.session_id,
                    "action": action
                }
            )
            
            if success:
                game_state = response.get('game_state', {})
                new_action_count = game_state.get('actionCount', 0)
                new_inventory = game_state.get('inventory', [])
                
                print(f"Action {i+1} - Action Count: {new_action_count}")
                print(f"Action {i+1} - Inventory Count: {len(new_inventory)}")
                
                # Verify action count increased
                if new_action_count > last_action_count:
                    print(f"✅ Action count incremented from {last_action_count} to {new_action_count}")
                else:
                    print(f"❌ Action count did not increment as expected")
                    return False
                
                # Poll the session state
                _, polling_response = self.run_test(
                    f"Poll Session After Action {i+1}",
                    "GET",
                    f"api/get_session/{self.session_id}",
                    200
                )
                
                polling_action_count = polling_response.get('game_state', {}).get('actionCount', 0)
                polling_inventory = polling_response.get('game_state', {}).get('inventory', [])
                
                print(f"Polled Action Count: {polling_action_count}")
                print(f"Polled Inventory Count: {len(polling_inventory)}")
                
                # Verify polling endpoint returns correct data
                if polling_action_count == new_action_count:
                    print("✅ Polling endpoint correctly reports action count")
                else:
                    print(f"❌ Polling endpoint reports incorrect action count: {polling_action_count} vs {new_action_count}")
                    return False
                
                if len(polling_inventory) == len(new_inventory):
                    print("✅ Polling endpoint correctly reports inventory count")
                else:
                    print(f"❌ Polling endpoint reports incorrect inventory count: {len(polling_inventory)} vs {len(new_inventory)}")
                    return False
                
                last_action_count = new_action_count
                last_inventory_count = len(new_inventory)
            else:
                print(f"❌ Action {i+1} failed")
                return False
        
        # Final verification
        if last_action_count >= initial_action_count + len(actions):
            print(f"✅ Action count correctly incremented across multiple actions")
            return True
        else:
            print(f"❌ Action count did not increment correctly across multiple actions")
            return False

    def test_cors_configuration(self):
        """Test CORS configuration by checking OPTIONS request"""
        try:
            url = f"{self.base_url}/api/healthcheck"
            
            # Send OPTIONS request to check CORS headers
            response = requests.options(url)
            
            print(f"CORS Test - Status Code: {response.status_code}")
            print(f"CORS Headers: {response.headers}")
            
            # Check for CORS headers
            if 'Access-Control-Allow-Origin' in response.headers:
                allowed_origins = response.headers['Access-Control-Allow-Origin']
                print(f"Allowed Origins: {allowed_origins}")
                
                if '*' in allowed_origins or 'https://5270bdd3-7b2b-48fb-a3a5-345f7f9bb7d9.preview.emergentagent.com' in allowed_origins:
                    print("✅ CORS configuration allows appropriate origins")
                    return True
                else:
                    print("❌ CORS configuration does not allow appropriate origins")
            else:
                print("❌ CORS headers not found in response")
            
            return False
        except Exception as e:
            print(f"❌ CORS test failed with error: {str(e)}")
            return False

    def test_get_session_endpoint(self):
        """Test the /api/get_session/:sessionId endpoint specifically"""
        if not self.session_id:
            print("❌ Cannot test get_session endpoint without a valid session")
            return False
            
        success, response = self.run_test(
            "Get Session API Endpoint Test",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        if success:
            # Verify response structure
            if 'session_id' not in response:
                print("❌ Missing session_id in response")
                return False
                
            if 'game_state' not in response:
                print("❌ Missing game_state in response")
                return False
                
            # Verify session ID matches
            if response['session_id'] != self.session_id:
                print(f"❌ Session ID mismatch: {response['session_id']} vs {self.session_id}")
                return False
                
            # Verify game state structure
            game_state = response['game_state']
            if not self.validate_game_state_structure(game_state):
                print("❌ Invalid game state structure")
                return False
                
            print("✅ Get Session endpoint works correctly")
            return True
        
        return False

    def connect_websocket(self):
        """Connect to WebSocket for real-time updates"""
        if self.ws_connected:
            return
            
        # Extract WebSocket URL from REST API URL
        ws_url = self.base_url.replace('http://', 'ws://').replace('https://', 'wss://')
        ws_url = f"{ws_url}/socket.io/?EIO=4&transport=websocket"
        
        print(f"\n🔌 Connecting to WebSocket at {ws_url}")
        
        def on_message(ws, message):
            print(f"📩 WebSocket message received: {message[:100]}...")
            self.ws_messages.put(message)
            
        def on_error(ws, error):
            print(f"❌ WebSocket error: {error}")
            
        def on_close(ws, close_status_code, close_msg):
            print(f"🔌 WebSocket connection closed: {close_status_code} - {close_msg}")
            self.ws_connected = False
            
        def on_open(ws):
            print("✅ WebSocket connection established")
            self.ws_connected = True
            
            # Join the session room
            if self.session_id:
                join_message = json.dumps({
                    "event": "join_session",
                    "data": {"session_id": self.session_id}
                })
                ws.send(join_message)
                print(f"🔌 Joined session room: {self.session_id}")
        
        # Create WebSocket connection
        try:
            self.ws = websocket.WebSocketApp(
                ws_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            
            # Start WebSocket connection in a separate thread
            self.ws_thread = threading.Thread(target=self.ws.run_forever)
            self.ws_thread.daemon = True
            self.ws_thread.start()
            
            # Wait for connection to establish
            time.sleep(2)
            
            return True
        except Exception as e:
            print(f"❌ Failed to connect to WebSocket: {str(e)}")
            return False

    def check_websocket_updates(self, expected_field):
        """Check if WebSocket updates are received with the expected field"""
        if not self.ws_connected:
            print("❌ WebSocket not connected, cannot check updates")
            return False
            
        print(f"\n🔍 Checking WebSocket updates for '{expected_field}'...")
        
        # Wait for WebSocket messages
        timeout = 5  # seconds
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                # Check if there are any messages in the queue
                if not self.ws_messages.empty():
                    message = self.ws_messages.get(block=False)
                    
                    # Parse Socket.IO message format
                    if message.startswith('42'):
                        data_str = message[2:]
                        try:
                            data = json.loads(data_str)
                            if isinstance(data, list) and len(data) >= 2:
                                event_name = data[0]
                                event_data = data[1]
                                
                                print(f"📩 Received event: {event_name}")
                                
                                if event_name == 'game_update':
                                    game_state = event_data.get('game_state', {})
                                    
                                    # Check if the expected field is in the update
                                    if expected_field in game_state:
                                        print(f"✅ WebSocket update contains '{expected_field}'")
                                        return True
                        except json.JSONDecodeError:
                            print(f"❌ Failed to parse WebSocket message: {message}")
                
                time.sleep(0.1)
            except queue.Empty:
                time.sleep(0.1)
        
        print(f"❌ No WebSocket updates with '{expected_field}' received within {timeout} seconds")
        return False

    def cleanup(self):
        """Clean up resources"""
        if self.ws:
            self.ws.close()
            if self.ws_thread:
                self.ws_thread.join(timeout=1)

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
    
    try:
        # Run tests
        print("\n==== 1. BACKEND HEALTHCHECK ====")
        if not tester.test_healthcheck():
            print("❌ Healthcheck failed, stopping tests")
            return 1
        
        print("\n==== 2. TEST CORS CONFIGURATION ====")
        cors_success = tester.test_cors_configuration()
        print(f"{'✅' if cors_success else '❌'} CORS configuration test {'passed' if cors_success else 'failed'}")
        
        print("\n==== 3. CREATE NEW SANDBOX SESSION ====")
        if not tester.test_start_session_sandbox():
            print("❌ Sandbox session creation failed, stopping tests")
            return 1
        
        print("\n==== 4. TEST ACTION COUNT INCREMENT ====")
        action_count_success = tester.test_action_count_increment()
        print(f"{'✅' if action_count_success else '❌'} Action count increment test {'passed' if action_count_success else 'failed'}")
        
        print("\n==== 5. TEST INVENTORY ITEM ACQUISITION (NO DUPLICATION) ====")
        inventory_success = tester.test_inventory_item_acquisition()
        print(f"{'✅' if inventory_success else '❌'} Inventory item acquisition test {'passed' if inventory_success else 'failed'}")
        
        print("\n==== 6. TEST GET_SESSION ENDPOINT ====")
        get_session_success = tester.test_get_session_endpoint()
        print(f"{'✅' if get_session_success else '❌'} Get session endpoint test {'passed' if get_session_success else 'failed'}")
        
        print("\n==== 7. TEST MULTIPLE ACTIONS AND POLLING ====")
        multiple_actions_success = tester.test_multiple_actions_and_polling()
        print(f"{'✅' if multiple_actions_success else '❌'} Multiple actions and polling test {'passed' if multiple_actions_success else 'failed'}")
        
        # Print results
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        
        # Summary of badge system tests
        print("\n==== BADGE SYSTEM TEST SUMMARY ====")
        print(f"CORS Configuration: {'✅ PASSED' if cors_success else '❌ FAILED'}")
        print(f"Action Count Increment: {'✅ PASSED' if action_count_success else '❌ FAILED'}")
        print(f"Inventory Item Acquisition (No Duplication): {'✅ PASSED' if inventory_success else '❌ FAILED'}")
        print(f"Get Session Endpoint: {'✅ PASSED' if get_session_success else '❌ FAILED'}")
        print(f"Multiple Actions and Polling: {'✅ PASSED' if multiple_actions_success else '❌ FAILED'}")
        
        overall_success = (
            cors_success and
            action_count_success and 
            inventory_success and 
            get_session_success and
            multiple_actions_success
        )
        
        print(f"\n{'✅' if overall_success else '❌'} Badge System Tests: {'PASSED' if overall_success else 'FAILED'}")
        
        return 0 if overall_success else 1
    
    finally:
        # Clean up resources
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())
