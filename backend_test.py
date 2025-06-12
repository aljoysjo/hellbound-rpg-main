
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

    def test_start_session_campaign(self):
        """Test starting a new campaign game session"""
        success, response = self.run_test(
            "Start Campaign Session API",
            "POST",
            "api/start_session",
            200,
            data={"mode": "campaign"}
        )
        if success and 'session_id' in response:
            self.session_id = response['session_id']
            print(f"Session ID: {self.session_id}")
            print(f"Initial Narrative: {response.get('initial_narrative')}")
            
            # Check game state
            game_state = response.get('game_state', {})
            self.validate_game_state_structure(game_state)
            
            # Verify campaign-specific elements
            if game_state.get('mode') != 'campaign':
                print("❌ Game mode is not set to campaign")
                return False
                
            # Check for campaign objectives
            if not game_state.get('questObjectives'):
                print("❌ Campaign objectives not found")
                return False
                
            print(f"Campaign Mode: {game_state.get('mode')}")
            print(f"Quest Objectives: {len(game_state.get('questObjectives', []))} objectives")
            
            # Connect to WebSocket for this session
            self.connect_websocket()
            
            return True
        return False

    def test_start_session_sandbox(self):
        """Test starting a new sandbox game session"""
        success, response = self.run_test(
            "Start Sandbox Session API",
            "POST",
            "api/start_session",
            200,
            data={
                "mode": "sandbox", 
                "sandboxConcept": "Un exorcista investigando fenómenos paranormales en una mansión abandonada"
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
                
            print(f"Sandbox Mode: {game_state.get('mode')}")
            print(f"Sandbox Concept: {game_state.get('sandboxConcept')}")
            
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
            'vitals', 'resources', 'location'
        ]
        
        for field in required_fields:
            if field not in game_state:
                print(f"❌ Missing required field: {field}")
                return False
        
        # Check inventory structure
        print(f"📦 Inventory: {game_state.get('inventory', [])}")
        
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

    def test_inventory_change(self):
        """Test actions that change inventory"""
        if not self.session_id:
            print("❌ Cannot test inventory changes without a valid session")
            return False
            
        # Get initial inventory
        _, initial_response = self.run_test(
            "Get Initial Session State",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_inventory = initial_response.get('game_state', {}).get('inventory', [])
        print(f"Initial Inventory: {initial_inventory}")
        
        # Send action to find objects
        success, response = self.run_test(
            "Inventory Change - Find Objects",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "Buscar objetos en la habitación"
            }
        )
        
        if success:
            # Check for inventory changes
            game_state = response.get('game_state', {})
            new_inventory = game_state.get('inventory', [])
            print(f"New Inventory: {new_inventory}")
            
            # Check if inventory changed
            if len(new_inventory) > len(initial_inventory):
                print("✅ Inventory successfully changed")
                
                # Check WebSocket updates
                self.check_websocket_updates("inventory")
                return True
            else:
                print("❌ Inventory did not change as expected")
                
                # Try another action
                success, response = self.run_test(
                    "Inventory Change - Examine Room",
                    "POST",
                    "api/free_input",
                    200,
                    data={
                        "session_id": self.session_id,
                        "action": "Examinar la habitación en busca de objetos útiles"
                    }
                )
                
                if success:
                    game_state = response.get('game_state', {})
                    new_inventory = game_state.get('inventory', [])
                    print(f"New Inventory after second attempt: {new_inventory}")
                    
                    if len(new_inventory) > len(initial_inventory):
                        print("✅ Inventory successfully changed on second attempt")
                        
                        # Check WebSocket updates
                        self.check_websocket_updates("inventory")
                        return True
        
        return False

    def test_skills_change(self):
        """Test actions that change skills"""
        if not self.session_id:
            print("❌ Cannot test skills changes without a valid session")
            return False
            
        # Get initial skills
        _, initial_response = self.run_test(
            "Get Initial Skills State",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_skills = initial_response.get('game_state', {}).get('skills', [])
        print(f"Initial Skills: {[s.get('id') if isinstance(s, dict) else s for s in initial_skills]}")
        
        # Send action to use exorcism
        success, response = self.run_test(
            "Skills Change - Use Exorcism",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "Usar exorcismo para purificar el área"
            }
        )
        
        if success:
            # Check for skills changes
            game_state = response.get('game_state', {})
            new_skills = game_state.get('skills', [])
            print(f"New Skills: {[s.get('id') if isinstance(s, dict) else s for s in new_skills]}")
            
            # Try another action for meditation
            success, response = self.run_test(
                "Skills Change - Meditate",
                "POST",
                "api/free_input",
                200,
                data={
                    "session_id": self.session_id,
                    "action": "Meditar para aumentar mi percepción sobrenatural"
                }
            )
            
            if success:
                game_state = response.get('game_state', {})
                final_skills = game_state.get('skills', [])
                print(f"Final Skills: {[s.get('id') if isinstance(s, dict) else s for s in final_skills]}")
                
                # Check if skills changed (either new skills or level changes)
                skills_changed = False
                
                # Check for new skills
                if len(final_skills) > len(initial_skills):
                    skills_changed = True
                    print("✅ New skills added")
                
                # Check for skill level changes
                for skill in final_skills:
                    if isinstance(skill, dict):
                        skill_id = skill.get('id')
                        skill_level = skill.get('level')
                        
                        # Find matching initial skill
                        initial_skill = next((s for s in initial_skills if isinstance(s, dict) and s.get('id') == skill_id), None)
                        
                        if initial_skill and skill_level is not None and initial_skill.get('level') is not None:
                            if skill_level > initial_skill.get('level', 0):
                                skills_changed = True
                                print(f"✅ Skill '{skill_id}' level increased from {initial_skill.get('level')} to {skill_level}")
                        elif not initial_skill:
                            # This is a new skill
                            skills_changed = True
                            print(f"✅ New skill '{skill_id}' added with level {skill_level}")
                
                if skills_changed:
                    # Check WebSocket updates
                    self.check_websocket_updates("skills")
                    return True
                else:
                    print("❌ Skills did not change as expected")
        
        return False

    def test_emotional_states_change(self):
        """Test actions that change emotional states"""
        if not self.session_id:
            print("❌ Cannot test emotional states without a valid session")
            return False
            
        # Get initial emotional states
        _, initial_response = self.run_test(
            "Get Initial Emotional States",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_states = initial_response.get('game_state', {}).get('emotionalStates', {})
        print(f"Initial Emotional States:")
        for emotion, value in initial_states.items():
            print(f"  - {emotion}: {value}%")
        
        # Send action to explore a scary place
        success, response = self.run_test(
            "Emotional States Change - Explore Scary Place",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "Explorar el lugar tenebroso y oscuro que hay al fondo del pasillo"
            }
        )
        
        if success:
            # Check for emotional state changes
            game_state = response.get('game_state', {})
            new_states = game_state.get('emotionalStates', {})
            print(f"New Emotional States:")
            for emotion, value in new_states.items():
                print(f"  - {emotion}: {value}%")
            
            # Check if fear increased
            if new_states.get('miedo', 0) > initial_states.get('miedo', 0):
                print(f"✅ Fear increased from {initial_states.get('miedo', 0)}% to {new_states.get('miedo', 0)}%")
                
                # Check WebSocket updates
                self.check_websocket_updates("emotionalStates")
                return True
            else:
                print("❌ Fear did not increase as expected")
                
                # Try another action
                success, response = self.run_test(
                    "Emotional States Change - Face Danger",
                    "POST",
                    "api/free_input",
                    200,
                    data={
                        "session_id": self.session_id,
                        "action": "Enfrentar el peligro inminente con valentía"
                    }
                )
                
                if success:
                    game_state = response.get('game_state', {})
                    final_states = game_state.get('emotionalStates', {})
                    print(f"Final Emotional States:")
                    for emotion, value in final_states.items():
                        print(f"  - {emotion}: {value}%")
                    
                    # Check if any emotional state changed significantly
                    for emotion, value in final_states.items():
                        if abs(value - initial_states.get(emotion, 0)) > 10:
                            print(f"✅ Emotional state '{emotion}' changed significantly from {initial_states.get(emotion, 0)}% to {value}%")
                            
                            # Check WebSocket updates
                            self.check_websocket_updates("emotionalStates")
                            return True
        
        return False

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
            
            # Validate game state structure
            self.validate_game_state_structure(game_state)
            
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
        
        print("\n==== 2. CREATE NEW CAMPAIGN SESSION ====")
        if not tester.test_start_session_campaign():
            print("❌ Campaign session creation failed, trying sandbox mode")
            
            print("\n==== 2. CREATE NEW SANDBOX SESSION (FALLBACK) ====")
            if not tester.test_start_session_sandbox():
                print("❌ Both session creation modes failed, stopping tests")
                return 1
        
        print("\n==== 3. TEST INVENTORY CHANGES ====")
        inventory_success = tester.test_inventory_change()
        print(f"{'✅' if inventory_success else '❌'} Inventory change test {'passed' if inventory_success else 'failed'}")
        
        print("\n==== 4. TEST SKILLS CHANGES ====")
        skills_success = tester.test_skills_change()
        print(f"{'✅' if skills_success else '❌'} Skills change test {'passed' if skills_success else 'failed'}")
        
        print("\n==== 5. TEST EMOTIONAL STATES CHANGES ====")
        emotional_success = tester.test_emotional_states_change()
        print(f"{'✅' if emotional_success else '❌'} Emotional states change test {'passed' if emotional_success else 'failed'}")
        
        print("\n==== 6. VERIFY SESSION STATE STRUCTURE ====")
        if not tester.test_get_session():
            print("❌ Get session test failed")
        
        # Print results
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        
        # Summary of dynamic state tests
        print("\n==== DYNAMIC STATE SYSTEM TEST SUMMARY ====")
        print(f"Inventory Changes: {'✅ PASSED' if inventory_success else '❌ FAILED'}")
        print(f"Skills Changes: {'✅ PASSED' if skills_success else '❌ FAILED'}")
        print(f"Emotional States Changes: {'✅ PASSED' if emotional_success else '❌ FAILED'}")
        
        overall_success = (
            inventory_success and 
            skills_success and 
            emotional_success
        )
        
        print(f"\n{'✅' if overall_success else '❌'} Dynamic State System Tests: {'PASSED' if overall_success else 'FAILED'}")
        
        return 0 if overall_success else 1
    
    finally:
        # Clean up resources
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())
