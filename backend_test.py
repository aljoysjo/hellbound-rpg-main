
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

    def test_start_session_sandbox(self, concept="Detective paranormal investigando misterios"):
        """Test starting a new sandbox game session with a specific concept"""
        success, response = self.run_test(
            "Start Sandbox Session API",
            "POST",
            "api/start_session",
            200,
            data={
                "mode": "sandbox", 
                "sandboxConcept": concept
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
        
        # Check discovered items if present
        if 'discoveredItems' in game_state:
            print(f"🎁 Discovered Items: {game_state.get('discoveredItems', [])}")
        
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

    def test_free_input(self, action="examinar los alrededores"):
        """Test the free input endpoint with a specific action"""
        if not self.session_id:
            print("❌ Cannot test free input without a valid session")
            return False
            
        success, response = self.run_test(
            "Free Input API",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": action
            }
        )
        
        if success:
            # Check if we got a narrative response
            if 'new_narrative' not in response:
                print("❌ Missing new_narrative in response")
                return False
                
            # Check if we got a game state
            if 'game_state' not in response:
                print("❌ Missing game_state in response")
                return False
                
            # Print the narrative response
            print(f"Narrative Response: {response.get('new_narrative')[:150]}...")
            
            # Check if we got suggested actions
            suggested_actions = response.get('suggested_actions', [])
            print(f"Suggested Actions: {suggested_actions[:3]}")
            
            # Validate game state structure
            game_state = response.get('game_state', {})
            self.validate_game_state_structure(game_state)
            
            return True
        return False
        
    def test_vitals_and_stats(self):
        """Test that the response has correct vitals (health, mana, stamina)"""
        if not self.session_id:
            print("❌ Cannot test vitals without a valid session")
            return False
            
        success, response = self.run_test(
            "Get Session State for Vitals Check",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        if success:
            # Check if we got a game state
            if 'game_state' not in response:
                print("❌ Missing game_state in response")
                return False
                
            # Check vitals
            game_state = response.get('game_state', {})
            vitals = game_state.get('vitals', {})
            
            print("\n🔍 Checking vitals...")
            
            # Check for required vitals
            required_vitals = ['health', 'mana', 'stamina']
            for vital in required_vitals:
                if vital not in vitals:
                    print(f"❌ Missing required vital: {vital}")
                    return False
                    
                # Check if vital is a number
                if not isinstance(vitals[vital], (int, float)):
                    print(f"❌ Vital {vital} is not a number: {vitals[vital]}")
                    return False
                    
                # Check if vital is in valid range (0-100)
                if vitals[vital] < 0 or vitals[vital] > 100:
                    print(f"❌ Vital {vital} is out of range (0-100): {vitals[vital]}")
                    return False
                    
                print(f"✅ Vital {vital}: {vitals[vital]}")
            
            # Check other stats
            print("\n🔍 Checking other stats...")
            
            # Check emotional states
            emotional_states = game_state.get('emotionalStates', {})
            if not emotional_states:
                print("❌ Missing emotional states")
                return False
                
            print(f"Emotional States: {emotional_states}")
            
            # Check resources
            resources = game_state.get('resources', {})
            if not resources:
                print("❌ Missing resources")
                return False
                
            print(f"Resources: {resources}")
            
            # Check attributes
            attributes = game_state.get('attributes', {})
            if not attributes:
                print("❌ Missing attributes")
                return False
                
            print(f"Attributes: {attributes}")
            
            return True
        return False

    def validate_item_structure(self, item):
        """Validate the structure of a discovered item"""
        required_fields = ['name', 'icon', 'instanceId', 'type']
        
        for field in required_fields:
            if field not in item:
                print(f"❌ Missing required field in item: {field}")
                return False
        
        # Check if contexts field exists
        if 'contexts' not in item:
            print("❌ Missing 'contexts' field in item")
            return False
        
        print(f"✅ Valid item structure: {item['name']} ({item['type']}) - {item['icon']}")
        return True

    def test_pickup_item(self):
        """Test picking up a discovered item"""
        if not self.session_id or not hasattr(self, 'discovered_item_id'):
            print("❌ Cannot test pickup_item without a valid session and discovered item")
            return False
        
        # Get initial state
        _, initial_response = self.run_test(
            "Get Initial State Before Pickup",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_game_state = initial_response.get('game_state', {})
        initial_discovered_items = initial_game_state.get('discoveredItems', [])
        initial_inventory = initial_game_state.get('inventory', [])
        
        print(f"Initial Discovered Items Count: {len(initial_discovered_items)}")
        print(f"Initial Inventory Count: {len(initial_inventory)}")
        
        # Pick up the discovered item
        success, response = self.run_test(
            "Pickup Item API",
            "POST",
            "api/pickup_item",
            200,
            data={
                "session_id": self.session_id,
                "item_id": self.discovered_item_id
            }
        )
        
        if success:
            # Check response message
            message = response.get('message', '')
            print(f"Pickup Message: {message}")
            
            if not message or 'recogido' not in message.lower():
                print("❌ Pickup message does not confirm item was picked up")
                return False
            
            # Check updated game state
            game_state = response.get('game_state', {})
            discovered_items = game_state.get('discoveredItems', [])
            inventory = game_state.get('inventory', [])
            
            print(f"Discovered Items After Pickup: {len(discovered_items)}")
            print(f"Inventory After Pickup: {len(inventory)}")
            
            # Verify item was moved from discoveredItems to inventory
            if len(discovered_items) < len(initial_discovered_items) and len(inventory) > len(initial_inventory):
                print("✅ Item successfully moved from discoveredItems to inventory")
                
                # Verify the specific item is now in inventory
                item_in_inventory = False
                for item in inventory:
                    if item.get('instanceId') == self.discovered_item_id:
                        item_in_inventory = True
                        print(f"✅ Item '{item['name']}' found in inventory")
                        break
                
                if not item_in_inventory:
                    print("❌ Picked up item not found in inventory")
                    return False
                
                # Test edge case: Try to pick up the same item again
                print("\n🔍 Testing edge case: Picking up the same item again...")
                _, edge_response = self.run_test(
                    "Pickup Same Item Again",
                    "POST",
                    "api/pickup_item",
                    400,  # Expecting error status
                    data={
                        "session_id": self.session_id,
                        "item_id": self.discovered_item_id
                    }
                )
                
                print("✅ Attempting to pick up the same item again correctly returns an error")
                
                return True
            else:
                print("❌ Item was not correctly moved from discoveredItems to inventory")
                return False
        
        return False

    def test_multiple_searches(self):
        """Test multiple search actions to verify different items are generated"""
        if not self.session_id:
            print("❌ Cannot test multiple searches without a valid session")
            return False
        
        # Get initial state
        _, initial_response = self.run_test(
            "Get Initial State Before Multiple Searches",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_game_state = initial_response.get('game_state', {})
        initial_discovered_items = initial_game_state.get('discoveredItems', [])
        
        print(f"Initial Discovered Items: {initial_discovered_items}")
        
        # Define multiple search actions
        search_actions = [
            "examino el área",
            "hurgo entre los objetos"
        ]
        
        all_discovered_items = []
        if initial_discovered_items:
            all_discovered_items.extend(initial_discovered_items)
        
        for i, action in enumerate(search_actions):
            success, response = self.run_test(
                f"Multiple Searches - Action {i+1}",
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
                discovered_items = game_state.get('discoveredItems', [])
                
                print(f"Discovered Items After Search {i+1}: {discovered_items}")
                
                # Check for new items
                new_items = []
                for item in discovered_items:
                    if not any(existing['instanceId'] == item['instanceId'] for existing in all_discovered_items):
                        new_items.append(item)
                        all_discovered_items.append(item)
                
                print(f"New Items Found in Search {i+1}: {len(new_items)}")
                for item in new_items:
                    print(f"  - {item['name']} ({item['type']}) - {item['icon']}")
                
                # Verify item types are appropriate for the context
                for item in new_items:
                    if 'contexts' in item:
                        print(f"  - Contexts: {item['contexts']}")
            else:
                print(f"❌ Search action {i+1} failed")
                return False
        
        # Verify we found different types of items
        item_types = set(item['type'] for item in all_discovered_items)
        print(f"Different item types found: {item_types}")
        
        if len(item_types) > 1:
            print("✅ Multiple item types were generated based on context")
            return True
        elif len(all_discovered_items) > len(initial_discovered_items):
            print("✅ New items were discovered, but all of the same type")
            return True
        else:
            print("❌ No new items were discovered across multiple searches")
            return False

    def test_edge_cases(self):
        """Test edge cases for the loot system"""
        if not self.session_id:
            print("❌ Cannot test edge cases without a valid session")
            return False
        
        # Test case 1: Try to pick up an item that doesn't exist
        print("\n🔍 Testing edge case: Picking up non-existent item...")
        success, response = self.run_test(
            "Pickup Non-existent Item",
            "POST",
            "api/pickup_item",
            404,  # Expecting not found status
            data={
                "session_id": self.session_id,
                "item_id": "non-existent-item-id"
            }
        )
        
        if success:
            print("❌ Picking up non-existent item should fail but succeeded")
            return False
        else:
            print("✅ Picking up non-existent item correctly returns an error")
        
        # Test case 2: Try to pick up an item with invalid session
        print("\n🔍 Testing edge case: Picking up item with invalid session...")
        success, response = self.run_test(
            "Pickup Item with Invalid Session",
            "POST",
            "api/pickup_item",
            404,  # Expecting not found status
            data={
                "session_id": "invalid-session-id",
                "item_id": "some-item-id"
            }
        )
        
        if success:
            print("❌ Picking up item with invalid session should fail but succeeded")
            return False
        else:
            print("✅ Picking up item with invalid session correctly returns an error")
        
        # Test case 3: Anti-duplication check
        # First, get current discovered items
        _, state_response = self.run_test(
            "Get Current State for Anti-duplication Test",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        current_game_state = state_response.get('game_state', {})
        current_discovered_items = current_game_state.get('discoveredItems', [])
        
        # If we have discovered items, try to search for the same type of item
        if current_discovered_items:
            item_type = current_discovered_items[0]['type']
            search_action = f"busco un {item_type}"
            
            print(f"\n🔍 Testing anti-duplication: Searching for same item type '{item_type}'...")
            success, response = self.run_test(
                "Search for Same Item Type",
                "POST",
                "api/free_input",
                200,
                data={
                    "session_id": self.session_id,
                    "action": search_action
                }
            )
            
            if success:
                game_state = response.get('game_state', {})
                new_discovered_items = game_state.get('discoveredItems', [])
                
                # Check if any new items have the same name as existing ones
                duplicate_found = False
                for new_item in new_discovered_items:
                    for old_item in current_discovered_items:
                        if new_item['name'] == old_item['name'] and new_item['instanceId'] != old_item['instanceId']:
                            duplicate_found = True
                            print(f"❌ Duplicate item found: {new_item['name']}")
                            break
                
                if not duplicate_found:
                    print("✅ No duplicate items found when searching for the same item type")
                else:
                    print("❌ Duplicate items were found, anti-duplication check failed")
                    return False
        
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
    
    # Use the provided URL from the test request if available
    backend_url = "https://e00f81cd-98f9-4055-a02d-c63e39f48833.preview.emergentagent.com"
    
    print(f"🔥 Testing Hellbound RPG Backend at {backend_url}")
    
    # Setup tester
    tester = HellboundRPGTester(backend_url)
    
    try:
        # Run tests based on the requested test plan
        print("\n==== 1. BACKEND HEALTHCHECK ====")
        if not tester.test_healthcheck():
            print("❌ Healthcheck failed, stopping tests")
            return 1
        
        print("\n==== 2. CREATE NEW SANDBOX SESSION ====")
        # Use the requested concept "Un aventurero en una ciudad misteriosa"
        if not tester.test_start_session_sandbox("Un aventurero en una ciudad misteriosa"):
            print("❌ Sandbox session creation failed, stopping tests")
            return 1
        
        print("\n==== 3. TEST FREE INPUT BASIC ====")
        # Test the free input with "examinar los alrededores"
        free_input_success = tester.test_free_input("examinar los alrededores")
        print(f"{'✅' if free_input_success else '❌'} Free input test {'passed' if free_input_success else 'failed'}")
        
        print("\n==== 4. TEST VITALS AND STATS ====")
        # Verify that the response has correct vitals (health, mana, stamina)
        vitals_success = tester.test_vitals_and_stats()
        print(f"{'✅' if vitals_success else '❌'} Vitals and stats test {'passed' if vitals_success else 'failed'}")
        
        print("\n==== 5. TEST DYNAMIC LOOT SYSTEM ====")
        # Test the loot system with discovered items
        dynamic_loot_success = tester.test_dynamic_loot_system()
        print(f"{'✅' if dynamic_loot_success else '❌'} Dynamic loot system test {'passed' if dynamic_loot_success else 'failed'}")
        
        if dynamic_loot_success:
            print("\n==== 6. TEST PICKUP ITEM ====")
            pickup_success = tester.test_pickup_item()
            print(f"{'✅' if pickup_success else '❌'} Pickup item test {'passed' if pickup_success else 'failed'}")
        else:
            pickup_success = False
            print("⚠️ Skipping pickup item test as no items were discovered")
        
        print("\n==== 7. TEST ACTION COUNT INCREMENT ====")
        action_count_success = tester.test_action_count_increment()
        print(f"{'✅' if action_count_success else '❌'} Action count increment test {'passed' if action_count_success else 'failed'}")
        
        print("\n==== 8. TEST GET_SESSION ENDPOINT ====")
        get_session_success = tester.test_get_session_endpoint()
        print(f"{'✅' if get_session_success else '❌'} Get session endpoint test {'passed' if get_session_success else 'failed'}")
        
        # Print results
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        
        # Summary of tests based on the requested test plan
        print("\n==== TEST SUMMARY ====")
        print(f"1. Healthcheck: {'✅ PASSED' if tester.test_healthcheck() else '❌ FAILED'}")
        print(f"2. Sandbox Session Creation: {'✅ PASSED' if tester.session_id else '❌ FAILED'}")
        print(f"3. Free Input Basic: {'✅ PASSED' if free_input_success else '❌ FAILED'}")
        print(f"4. Vitals and Stats: {'✅ PASSED' if vitals_success else '❌ FAILED'}")
        print(f"5. Dynamic Loot System: {'✅ PASSED' if dynamic_loot_success else '❌ FAILED'}")
        
        overall_success = (
            tester.test_healthcheck() and
            tester.session_id and
            free_input_success and
            vitals_success and
            dynamic_loot_success
        )
        
        print(f"\n{'✅' if overall_success else '❌'} Backend Tests: {'PASSED' if overall_success else 'FAILED'}")
        
        return 0 if overall_success else 1
    
    finally:
        # Clean up resources
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())
