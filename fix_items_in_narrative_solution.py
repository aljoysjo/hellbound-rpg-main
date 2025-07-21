import requests
import sys
import time
import json
from datetime import datetime

def test_narrative_with_items():
    """Test a narrative that mentions items being picked up"""
    base_url = "https://bdd8441f-bc0a-4b84-9d25-f35dd5944ec5.preview.emergentagent.com"
    
    print(f"🔥 Testing Items in Narrative at {base_url}")
    
    # Step 1: Create a new campaign session
    print("\n==== 1. CREATE NEW CAMPAIGN SESSION ====")
    
    url = f"{base_url}/api/start_session"
    headers = {'Content-Type': 'application/json'}
    data = {"mode": "campaign"}
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to create campaign session - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        session_data = response.json()
        session_id = session_data.get('session_id')
        
        if not session_id:
            print("❌ No session_id in response")
            return False
        
        print(f"✅ Campaign session created - Session ID: {session_id}")
        
        # Step 2: Test narrative with items already picked up
        print("\n==== 2. TEST NARRATIVE WITH ITEMS ALREADY PICKED UP ====")
        
        url = f"{base_url}/api/free_input"
        data = {
            "session_id": session_id,
            "action": "decidiste que el crucifijo y el frasco de sal serán tus aliados en este momento incierto"
        }
        
        response = requests.post(url, json=data, headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to send free input - Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        response_data = response.json()
        
        # Check the narrative response
        narrative = response_data.get('new_narrative', '')
        print(f"Narrative Response: {narrative[:200]}...")
        
        # Check the updated inventory
        game_state = response_data.get('game_state', {})
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
            
            # Print issue analysis and recommended fix
            print("\n==== ISSUE ANALYSIS ====")
            print("The pattern matching for detecting items in the narrative works correctly, but the items are not being added to the inventory.")
            print("The issue is likely in the extractItemsFromNarrative function in the server code.")
            print("Specifically, the function is not correctly handling compound items like 'crucifijo y el frasco de sal'.")
            print("It's detecting the whole phrase as one item instead of separating them into two distinct items.")
            
            print("\n==== RECOMMENDED FIX ====")
            print("Modify the extractItemsFromNarrative function to split compound items when 'y' or 'e' is present.")
            print("Here's the fix that should be applied to the server code:")
            
            print("""
// Add this function after the extractItemsFromNarrative function
function splitCompoundItems(itemName) {
  // Check if the item name contains conjunctions that indicate multiple items
  if (itemName.includes(' y ') || itemName.includes(' e ')) {
    // Split by conjunctions
    let parts = itemName.split(/ y | e /);
    
    // Clean up each part
    return parts.map(part => {
      // If the part starts with "el", "la", "un", "una", remove it
      return part.replace(/^(el|la|un|una) /, '').trim();
    }).filter(part => part.length > 0); // Remove empty parts
  }
  
  // If no conjunctions found, return the original item name as a single-item array
  return [itemName];
}

// Then modify the alreadyPickedPatterns loop in extractItemsFromNarrative function:
alreadyPickedPatterns.forEach((pattern, index) => {
  let match;
  while ((match = pattern.exec(narrative)) !== null) {
    let itemName = '';
    
    // Extract item name based on pattern index
    if (index === 0) { // "decidiste que X será"
      itemName = match[2].trim();
    } else if (index < 7) { // "tomas X", "recoges X", etc.
      itemName = match[2].trim();
    } else if (index === 7) { // "X será tu aliado"
      itemName = match[2].trim();
    } else { // "tienes X", "portas X"
      itemName = match[2].trim();
    }
    
    // Clean the item name
    itemName = itemName.replace(/[,\.!?;]$/, '').trim();
    
    // Split compound items (NEW CODE)
    const itemNames = splitCompoundItems(itemName);
    
    // Process each individual item
    for (const singleItemName of itemNames) {
      // Filter words that are too short or generic
      if (singleItemName.length > 3 && 
          !["lugar", "sitio", "cosa", "algo", "esto", "habitación", "sala", "lugar", "ambiente", "aire", "sonido", "ruido", "sensación", "momento", "instante"].includes(singleItemName.toLowerCase()) && 
          singleItemName.length < 30 && 
          !singleItemName.includes("mientras") && 
          !singleItemName.includes("que se") && 
          !singleItemName.includes("de la")) {
        
        // Convert text to real item
        const realItem = convertTextToRealItem(singleItemName);
        if (realItem) {
          alreadyPickedItems.push(realItem);
          console.log(`🎁 Item ya recogido detectado: ${realItem.name} ${realItem.icon}`);
        } else {
          console.log(`❌ Item ya recogido no reconocido: "${singleItemName}"`);
        }
      }
    }
  }
});
""")
            
            return False
    
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    test_narrative_with_items()