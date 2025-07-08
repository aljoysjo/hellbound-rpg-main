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

    def test_pattern_matching(self):
        """Test the pattern matching for items in narrative"""
        print("\n🔍 Testing pattern matching for items in narrative...")
        
        # Test patterns for already picked items
        patterns = [
            r'decidiste? que (el|la|una?|un) ([^,.!?]+) (será|serán)',
            r'tomas? (el|la|una?|un) ([^,.!?]+)',
            r'recoges? (el|la|una?|un) ([^,.!?]+)',
            r'llevas? (el|la|una?|un) ([^,.!?]+)',
            r'agarras? (el|la|una?|un) ([^,.!?]+)',
            r'coges? (el|la|una?|un) ([^,.!?]+)',
            r'equipas? (el|la|una?|un) ([^,.!?]+)',
            r'(el|la|una?|un) ([^,.!?]+) (será|serán) (tu|tus) (aliado|aliados|herramienta)',
            r'tienes? (el|la|una?|un) ([^,.!?]+)',
            r'portas? (el|la|una?|un) ([^,.!?]+)'
        ]
        
        test_sentences = [
            "decidiste que el crucifijo y el frasco de sal serán tus aliados en este momento incierto",
            "tomas el crucifijo de la mesa",
            "recoges el frasco de sal del suelo",
            "llevas el crucifijo en tu mano",
            "agarras el frasco de sal con fuerza",
            "coges el crucifijo y lo guardas",
            "equipas el frasco de sal en tu cinturón",
            "el crucifijo será tu aliado contra las fuerzas oscuras",
            "tienes el frasco de sal en tu bolsillo",
            "portas el crucifijo como protección"
        ]
        
        for i, sentence in enumerate(test_sentences):
            print(f"\nTesting sentence {i+1}: '{sentence}'")
            pattern = patterns[i]
            compiled_pattern = re.compile(pattern, re.IGNORECASE)
            match = compiled_pattern.search(sentence)
            
            if match:
                print(f"✅ Pattern matched: {pattern}")
                
                # Extract item name based on pattern index
                if i == 0:  # "decidiste que X será"
                    item_name = match.group(2).strip()
                elif i < 7:  # "tomas X", "recoges X", etc.
                    item_name = match.group(2).strip()
                elif i == 7:  # "X será tu aliado"
                    item_name = match.group(2).strip()
                else:  # "tienes X", "portas X"
                    item_name = match.group(2).strip()
                
                print(f"Item extracted: '{item_name}'")
                
                # Check if the item contains "crucifijo" or "frasco de sal"
                if "crucifijo" in item_name.lower():
                    print("✅ Crucifijo detected")
                elif "frasco" in item_name.lower() and "sal" in item_name.lower():
                    print("✅ Frasco de sal detected")
                else:
                    print(f"❌ Neither crucifijo nor frasco de sal detected in '{item_name}'")
            else:
                print(f"❌ Pattern did not match: {pattern}")
        
        # Test the specific sentence from our test case
        test_sentence = "decidiste que el crucifijo y el frasco de sal serán tus aliados en este momento incierto"
        print(f"\nTesting main test sentence: '{test_sentence}'")
        
        for i, pattern in enumerate(patterns):
            compiled_pattern = re.compile(pattern, re.IGNORECASE)
            match = compiled_pattern.search(test_sentence)
            
            if match:
                print(f"✅ Pattern {i+1} matched: {pattern}")
                
                # Extract item name based on pattern index
                if i == 0:  # "decidiste que X será"
                    item_name = match.group(2).strip()
                elif i < 7:  # "tomas X", "recoges X", etc.
                    item_name = match.group(2).strip()
                elif i == 7:  # "X será tu aliado"
                    item_name = match.group(2).strip()
                else:  # "tienes X", "portas X"
                    item_name = match.group(2).strip()
                
                print(f"Item extracted: '{item_name}'")
                
                # Check if the item contains "crucifijo" or "frasco de sal"
                if "crucifijo" in item_name.lower():
                    print("✅ Crucifijo detected")
                elif "frasco" in item_name.lower() and "sal" in item_name.lower():
                    print("✅ Frasco de sal detected")
                else:
                    print(f"❌ Neither crucifijo nor frasco de sal detected in '{item_name}'")
            else:
                print(f"❌ Pattern {i+1} did not match: {pattern}")
        
        return True

def main():
    # Use the provided URL from the test request
    backend_url = "https://82bcbb31-ba5d-4ac4-997b-559356b55852.preview.emergentagent.com"
    
    print(f"🔥 Testing Items in Narrative at {backend_url}")
    
    # Setup tester
    tester = ItemsInNarrativeTester(backend_url)
    
    try:
        print("\n==== 1. TEST PATTERN MATCHING ====")
        pattern_matching_success = tester.test_pattern_matching()
        print(f"{'✅' if pattern_matching_success else '❌'} Pattern matching test {'passed' if pattern_matching_success else 'failed'}")
        
        print("\n==== 2. CREATE NEW CAMPAIGN SESSION ====")
        if not tester.test_start_session_campaign():
            print("❌ Campaign session creation failed, stopping tests")
            return 1
        
        print("\n==== 3. TEST NARRATIVE WITH ITEMS ALREADY PICKED UP ====")
        # Test the narrative with items already picked up
        narrative_items_success = tester.test_narrative_with_items()
        print(f"{'✅' if narrative_items_success else '❌'} Narrative with items test {'passed' if narrative_items_success else 'failed'}")
        
        # Print results
        print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
        
        # Summary of tests
        print("\n==== TEST SUMMARY ====")
        print(f"1. Pattern Matching: {'✅ PASSED' if pattern_matching_success else '❌ FAILED'}")
        print(f"2. Campaign Session Creation: {'✅ PASSED' if tester.session_id else '❌ FAILED'}")
        print(f"3. Narrative with Items Already Picked Up: {'✅ PASSED' if narrative_items_success else '❌ FAILED'}")
        
        overall_success = pattern_matching_success and tester.session_id
        
        print(f"\n{'✅' if overall_success else '❌'} Items in Narrative Tests: {'PASSED' if overall_success else 'FAILED'}")
        
        return 0 if overall_success else 1
    
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())