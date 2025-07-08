import requests
import sys
import time
import json
import re
from datetime import datetime

class ItemsInNarrativeTester:
    def __init__(self, base_url="https://82bcbb31-ba5d-4ac4-997b-559356b55852.preview.emergentagent.com"):
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

    def test_start_session_campaign(self):
        """Test starting a new campaign game session"""
        success, response = self.run_test(
            "Start Campaign Session API",
            "POST",
            "api/start_session",
            200,
            data={
                "mode": "campaign"
            }
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
                
            print(f"Campaign Mode: {game_state.get('mode')}")
            print(f"Initial Action Count: {game_state.get('actionCount', 0)}")
            
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
        
        print("✅ Game state structure validation complete")
        return True

    def test_narrative_with_items(self):
        """Test a narrative that mentions items being picked up"""
        if not self.session_id:
            print("❌ Cannot test narrative with items without a valid session")
            return False
            
        # First, get the initial state to check inventory
        _, initial_response = self.run_test(
            "Get Initial State Before Item Narrative",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_game_state = initial_response.get('game_state', {})
        initial_inventory = initial_game_state.get('inventory', [])
        
        print(f"Initial Inventory: {initial_inventory}")
        
        # Send an action that should generate a narrative with items already picked up
        success, response = self.run_test(
            "Narrative With Items Already Picked Up",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "decidiste que el crucifijo y el frasco de sal serán tus aliados en este momento incierto"
            }
        )
        
        if success:
            # Check the narrative response
            narrative = response.get('new_narrative', '')
            print(f"Narrative Response: {narrative[:200]}...")
            
            # Check if the narrative mentions the items
            if 'crucifijo' in narrative.lower() and 'frasco' in narrative.lower() and 'sal' in narrative.lower():
                print("✅ Narrative mentions crucifijo and frasco de sal")
            else:
                print("❌ Narrative does not mention crucifijo and frasco de sal")
            
            # Check the updated inventory
            game_state = response.get('game_state', {})
            updated_inventory = game_state.get('inventory', [])
            
            print(f"Updated Inventory: {updated_inventory}")
            
            # Check if the items are in the inventory
            crucifijo_in_inventory = any('crucifijo' in item.get('name', '').lower() for item in updated_inventory)
            frasco_in_inventory = any('frasco' in item.get('name', '').lower() and 'sal' in item.get('name', '').lower() for item in updated_inventory)
            
            if crucifijo_in_inventory:
                print("✅ Crucifijo found in inventory")
            else:
                print("❌ Crucifijo not found in inventory")
                
            if frasco_in_inventory:
                print("✅ Frasco de sal found in inventory")
            else:
                print("❌ Frasco de sal not found in inventory")
            
            # Check if the items are in discoveredItems
            discovered_items = game_state.get('discoveredItems', [])
            print(f"Discovered Items: {discovered_items}")
            
            crucifijo_discovered = any('crucifijo' in item.get('name', '').lower() for item in discovered_items)
            frasco_discovered = any('frasco' in item.get('name', '').lower() and 'sal' in item.get('name', '').lower() for item in discovered_items)
            
            if crucifijo_discovered:
                print("✅ Crucifijo found in discoveredItems")
            else:
                print("❌ Crucifijo not found in discoveredItems")
                
            if frasco_discovered:
                print("✅ Frasco de sal found in discoveredItems")
            else:
                print("❌ Frasco de sal not found in discoveredItems")
            
            # Overall test result
            if (crucifijo_in_inventory or crucifijo_discovered) and (frasco_in_inventory or frasco_discovered):
                print("✅ Items mentioned in narrative are properly detected")
                return True
            else:
                print("❌ Items mentioned in narrative are not properly detected")
                return False
        
        return False
        
    def test_narrative_with_items_debug(self):
        """Test a narrative that mentions items being picked up with debug output"""
        if not self.session_id:
            print("❌ Cannot test narrative with items without a valid session")
            return False
            
        # First, get the initial state to check inventory
        _, initial_response = self.run_test(
            "Get Initial State Before Item Narrative",
            "GET",
            f"api/get_session/{self.session_id}",
            200
        )
        
        initial_game_state = initial_response.get('game_state', {})
        initial_inventory = initial_game_state.get('inventory', [])
        
        print(f"Initial Inventory: {initial_inventory}")
        
        # Send an action that should generate a narrative with items already picked up
        success, response = self.run_test(
            "Narrative With Items Already Picked Up (Debug)",
            "POST",
            "api/free_input",
            200,
            data={
                "session_id": self.session_id,
                "action": "decidiste que el crucifijo y el frasco de sal serán tus aliados en este momento incierto"
            }
        )
        
        if success:
            # Check the narrative response
            narrative = response.get('new_narrative', '')
            print(f"Narrative Response: {narrative[:200]}...")
            
            # Check the updated inventory
            game_state = response.get('game_state', {})
            updated_inventory = game_state.get('inventory', [])
            
            print(f"Updated Inventory: {updated_inventory}")
            
            # Check if the items are in the inventory
            crucifijo_in_inventory = any('crucifijo' in item.get('name', '').lower() for item in updated_inventory)
            frasco_in_inventory = any('frasco' in item.get('name', '').lower() and 'sal' in item.get('name', '').lower() for item in updated_inventory)
            
            # Check if the items are in discoveredItems
            discovered_items = game_state.get('discoveredItems', [])
            print(f"Discovered Items: {discovered_items}")
            
            crucifijo_discovered = any('crucifijo' in item.get('name', '').lower() for item in discovered_items)
            frasco_discovered = any('frasco' in item.get('name', '').lower() and 'sal' in item.get('name', '').lower() for item in discovered_items)
            
            # Check the raw response for debug information
            raw_response = response
            print("\n🔍 Checking raw response for debug information...")
            
            # Look for specific log messages in the response
            crucifijo_detected = False
            frasco_detected = False
            items_added = False
            
            # Print all keys in the response
            print(f"Response keys: {raw_response.keys()}")
            
            # Check if there's any debug information in the response
            if 'debug' in raw_response:
                debug_info = raw_response['debug']
                print(f"Debug info: {debug_info}")
                
                # Look for specific log messages
                if isinstance(debug_info, str):
                    if '🎁 Item ya recogido detectado: crucifijo' in debug_info:
                        crucifijo_detected = True
                        print("✅ Debug shows crucifijo was detected")
                    
                    if '🎁 Item ya recogido detectado: frasco de sal' in debug_info:
                        frasco_detected = True
                        print("✅ Debug shows frasco de sal was detected")
                    
                    if '🎁 ITEM AÑADIDO AL INVENTARIO AUTOMÁTICAMENTE' in debug_info:
                        items_added = True
                        print("✅ Debug shows items were added to inventory")
            
            # Overall test result
            if (crucifijo_in_inventory or crucifijo_discovered) and (frasco_in_inventory or frasco_discovered):
                print("✅ Items mentioned in narrative are properly detected")
                return True
            else:
                print("❌ Items mentioned in narrative are not properly detected")
                return False
        
        return False

def main():
    # Use the provided URL from the test request
    backend_url = "https://82bcbb31-ba5d-4ac4-997b-559356b55852.preview.emergentagent.com"
    
    print(f"🔥 Testing Items in Narrative at {backend_url}")
    
    # Setup tester
    tester = ItemsInNarrativeTester(backend_url)
    
    try:
        print("\n==== 1. CREATE NEW CAMPAIGN SESSION ====")
        if not tester.test_start_session_campaign():
            print("❌ Campaign session creation failed, stopping tests")
            return 1
        
        print("\n==== 2. TEST NARRATIVE WITH ITEMS ALREADY PICKED UP ====")
        # Test the narrative with items already picked up
        narrative_items_success = tester.test_narrative_with_items()
        print(f"{'✅' if narrative_items_success else '❌'} Narrative with items test {'passed' if narrative_items_success else 'failed'}")
        
        print("\n==== 3. TEST NARRATIVE WITH ITEMS ALREADY PICKED UP (DEBUG) ====")
        # Test the narrative with items already picked up with debug output
        narrative_items_debug_success = tester.test_narrative_with_items_debug()
        print(f"{'✅' if narrative_items_debug_success else '❌'} Narrative with items debug test {'passed' if narrative_items_debug_success else 'failed'}")
        
        # Print results
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        
        # Summary of tests
        print("\n==== TEST SUMMARY ====")
        print(f"1. Campaign Session Creation: {'✅ PASSED' if tester.session_id else '❌ FAILED'}")
        print(f"2. Narrative with Items Already Picked Up: {'✅ PASSED' if narrative_items_success else '❌ FAILED'}")
        print(f"3. Narrative with Items Debug: {'✅ PASSED' if narrative_items_debug_success else '❌ FAILED'}")
        
        overall_success = tester.session_id and (narrative_items_success or narrative_items_debug_success)
        
        print(f"\n{'✅' if overall_success else '❌'} Items in Narrative Tests: {'PASSED' if overall_success else 'FAILED'}")
        
        return 0 if overall_success else 1
    
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())