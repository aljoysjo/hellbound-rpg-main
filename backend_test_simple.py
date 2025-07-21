import requests
import json
import time

# Base URL for the API
BASE_URL = "https://bdd8441f-bc0a-4b84-9d25-f35dd5944ec5.preview.emergentagent.com"

def test_healthcheck():
    """Test the healthcheck endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/healthcheck", timeout=10)
        if response.status_code == 200:
            print("✅ Healthcheck passed")
            return True
        else:
            print(f"❌ Healthcheck failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Healthcheck error: {str(e)}")
        return False

def test_start_session():
    """Test starting a new sandbox session"""
    try:
        data = {
            "mode": "sandbox",
            "sandboxConcept": "Detective paranormal investigando misterios"
        }
        response = requests.post(f"{BASE_URL}/api/start_session", json=data, timeout=15)
        if response.status_code == 200:
            session_data = response.json()
            session_id = session_data.get('session_id')
            print(f"✅ Session created: {session_id}")
            return session_id
        else:
            print(f"❌ Session creation failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Session creation error: {str(e)}")
        return None

def test_search_action(session_id, action):
    """Test a search action to trigger discovered items"""
    try:
        data = {
            "session_id": session_id,
            "action": action
        }
        response = requests.post(f"{BASE_URL}/api/free_input", json=data, timeout=15)
        if response.status_code == 200:
            response_data = response.json()
            game_state = response_data.get('game_state', {})
            discovered_items = game_state.get('discoveredItems', [])
            
            print(f"✅ Search action successful: {action}")
            print(f"📦 Discovered items: {len(discovered_items)}")
            
            if discovered_items:
                for item in discovered_items:
                    print(f"  - {item.get('name')} {item.get('icon')}")
                return discovered_items[0].get('instanceId') if discovered_items else None
            else:
                print("❌ No items discovered")
                return None
        else:
            print(f"❌ Search action failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Search action error: {str(e)}")
        return None

def test_pickup_item(session_id, item_id):
    """Test picking up a discovered item"""
    try:
        data = {
            "session_id": session_id,
            "item_id": item_id
        }
        response = requests.post(f"{BASE_URL}/api/pickup_item", json=data, timeout=10)
        if response.status_code == 200:
            response_data = response.json()
            game_state = response_data.get('game_state', {})
            inventory = game_state.get('inventory', [])
            
            print(f"✅ Item pickup successful: {item_id}")
            print(f"📦 Inventory items: {len(inventory)}")
            
            if inventory:
                for item in inventory:
                    print(f"  - {item.get('name')} {item.get('icon')}")
                return True
            else:
                print("❌ No items in inventory")
                return False
        else:
            print(f"❌ Item pickup failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Item pickup error: {str(e)}")
        return False

def test_compound_items(session_id):
    """Test compound items functionality"""
    try:
        data = {
            "session_id": session_id,
            "action": "tomas el crucifijo y el frasco de sal para protegerte"
        }
        response = requests.post(f"{BASE_URL}/api/free_input", json=data, timeout=15)
        if response.status_code == 200:
            response_data = response.json()
            game_state = response_data.get('game_state', {})
            inventory = game_state.get('inventory', [])
            
            print(f"✅ Compound items action successful")
            print(f"📦 Inventory items: {len(inventory)}")
            
            crucifijo_found = False
            frasco_found = False
            
            for item in inventory:
                item_name = item.get('name', '').lower()
                if 'crucifijo' in item_name:
                    crucifijo_found = True
                    print(f"  - ✅ Crucifijo found: {item.get('name')} {item.get('icon')}")
                if 'frasco' in item_name and 'sal' in item_name:
                    frasco_found = True
                    print(f"  - ✅ Frasco de sal found: {item.get('name')} {item.get('icon')}")
            
            if crucifijo_found and frasco_found:
                print("✅ Both compound items found in inventory")
                return True
            else:
                print("❌ Not all compound items found in inventory")
                return False
        else:
            print(f"❌ Compound items action failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Compound items error: {str(e)}")
        return False

def test_random_events(session_id):
    """Test random events system"""
    try:
        actions = [
            "explorar los alrededores",
            "examinar la habitación",
            "buscar pistas",
            "investigar el área",
            "caminar por el pasillo"
        ]
        
        for i, action in enumerate(actions):
            data = {
                "session_id": session_id,
                "action": action
            }
            print(f"🔍 Testing action {i+1}: {action}")
            response = requests.post(f"{BASE_URL}/api/free_input", json=data, timeout=15)
            
            if response.status_code == 200:
                response_data = response.json()
                if 'random_event' in response_data and response_data['random_event']:
                    random_event = response_data['random_event']
                    print(f"✅ Random event triggered on action {i+1}")
                    print(f"🎲 Event: {random_event.get('event', {}).get('title')}")
                    print(f"🎲 Roll: {random_event.get('roll')}")
                    print(f"🎲 Success: {random_event.get('success')}")
                    return True
            else:
                print(f"❌ Action {i+1} failed: {response.status_code}")
            
            time.sleep(1)
        
        print("❌ No random event triggered after all actions")
        return False
    except Exception as e:
        print(f"❌ Random events error: {str(e)}")
        return False

def main():
    print("🔥 Testing Hellbound RPG Backend")
    print("🎯 FOCUS: Modal discovered items and Random Events D20")
    
    # Test healthcheck
    print("\n==== 1. HEALTHCHECK ====")
    if not test_healthcheck():
        print("❌ Healthcheck failed, stopping tests")
        return
    
    # Test start session
    print("\n==== 2. START SESSION ====")
    session_id = test_start_session()
    if not session_id:
        print("❌ Session creation failed, stopping tests")
        return
    
    # Test search action
    print("\n==== 3. SEARCH ACTION ====")
    item_id = test_search_action(session_id, "buscar objetos valiosos")
    
    # Test pickup item
    if item_id:
        print("\n==== 4. PICKUP ITEM ====")
        test_pickup_item(session_id, item_id)
    
    # Test compound items
    print("\n==== 5. COMPOUND ITEMS ====")
    test_compound_items(session_id)
    
    # Test random events
    print("\n==== 6. RANDOM EVENTS ====")
    test_random_events(session_id)
    
    print("\n==== TEST COMPLETE ====")

if __name__ == "__main__":
    main()