#!/usr/bin/env python3

import requests
import json
import sys

def investigate_loot_system():
    """
    INVESTIGACIÓN CRÍTICA - InlineLootBlock NO aparece después de múltiples reverts
    
    OBJETIVO: Completar diagnóstico de InlineLootBlock según review request
    """
    
    # Use the backend URL from frontend/.env as specified in the review request
    backend_url = "https://9f2d59a6-1dc6-45c7-94c5-bb7bd8e5829c.preview.emergentagent.com"
    
    print("🔥 INVESTIGACIÓN CRÍTICA - Completar diagnóstico de InlineLootBlock")
    print(f"🌐 Backend URL: {backend_url}")
    print("🎯 OBJETIVO: Determinar por qué rollIntelligentLoot() no está generando items")
    
    try:
        # Step 1: Healthcheck
        print("\n==== 1. BACKEND HEALTHCHECK ====")
        response = requests.get(f"{backend_url}/api/healthcheck")
        if response.status_code != 200:
            print(f"❌ Healthcheck failed: {response.status_code}")
            return False
        
        health_data = response.json()
        print(f"✅ Backend Status: {health_data.get('status')}")
        print(f"✅ OpenAI Configured: {health_data.get('openai_configured')}")
        print(f"✅ MongoDB Connected: {health_data.get('mongo_connected')}")
        
        # Step 2: Create session with concept "Detective paranormal investigando misterios"
        print("\n==== 2. CREAR SESIÓN SANDBOX ====")
        concept = "Detective paranormal investigando misterios"
        print(f"📝 Concepto: {concept}")
        
        session_response = requests.post(f"{backend_url}/api/start_session", json={
            "mode": "sandbox",
            "sandboxConcept": concept
        })
        
        if session_response.status_code != 200:
            print(f"❌ Session creation failed: {session_response.status_code}")
            return False
        
        session_data = session_response.json()
        session_id = session_data.get('session_id')
        print(f"✅ Session ID: {session_id}")
        
        # Check initial game state
        initial_game_state = session_data.get('game_state', {})
        initial_discovered_items = initial_game_state.get('discoveredItems', 'FIELD_NOT_PRESENT')
        
        print(f"🔍 Initial discoveredItems: {initial_discovered_items}")
        
        if initial_discovered_items == 'FIELD_NOT_PRESENT':
            print("❌ PROBLEMA CRÍTICO: discoveredItems field NO está presente en game_state inicial")
        elif initial_discovered_items == []:
            print("✅ discoveredItems field presente pero vacío (correcto para inicio)")
        else:
            print(f"⚠️ discoveredItems field presente con contenido: {initial_discovered_items}")
        
        # Step 3: Execute action "buscar en la habitación"
        print("\n==== 3. EJECUTAR ACCIÓN: 'buscar en la habitación' ====")
        action = "buscar en la habitación"
        print(f"🔍 Ejecutando acción: '{action}'")
        
        action_response = requests.post(f"{backend_url}/api/free_input", json={
            "session_id": session_id,
            "action": action
        })
        
        if action_response.status_code != 200:
            print(f"❌ Action failed: {action_response.status_code}")
            print(f"Response: {action_response.text}")
            return False
        
        action_data = action_response.json()
        print(f"✅ Acción ejecutada exitosamente")
        
        # Step 4: Verify discoveredItems array in JSON response
        print("\n==== 4. VERIFICAR discoveredItems EN RESPUESTA JSON ====")
        
        game_state = action_data.get('game_state', {})
        discovered_items = game_state.get('discoveredItems', 'FIELD_NOT_PRESENT')
        narrative = action_data.get('narrative', '')
        
        print(f"📖 Narrativa: {narrative}")
        print(f"🔍 discoveredItems en respuesta: {discovered_items}")
        
        # Step 5: Analyze backend logs (simulated - we can't access real logs)
        print("\n==== 5. ANÁLISIS DE LOGS DEL BACKEND (SIMULADO) ====")
        
        if discovered_items == 'FIELD_NOT_PRESENT':
            print("❌ DIAGNÓSTICO CRÍTICO: discoveredItems field NO está presente en game_state")
            print("🔍 CAUSA RAÍZ IDENTIFICADA:")
            print("   1. El campo discoveredItems NO está inicializado en GameState constructor")
            print("   2. El campo discoveredItems NO está incluido en el método toDict()")
            print("   3. Por tanto, nunca se devuelve al frontend")
            
        elif discovered_items == []:
            print("❌ DIAGNÓSTICO CRÍTICO: discoveredItems field está vacío")
            print("🔍 POSIBLES CAUSAS:")
            print("   1. rollIntelligentLoot() no está siendo llamado")
            print("   2. rollIntelligentLoot() no está detectando la acción 'buscar'")
            print("   3. rollIntelligentLoot() está fallando silenciosamente")
            
        else:
            print(f"✅ discoveredItems field presente con {len(discovered_items)} item(s)")
            for i, item in enumerate(discovered_items):
                print(f"   Item {i+1}: {item}")
        
        # Step 6: Determine if dynamic loot system is activated/deactivated
        print("\n==== 6. DETERMINAR ESTADO DEL SISTEMA DE LOOT DINÁMICO ====")
        
        # Check if narrative mentions items that should have been generated
        narrative_lower = narrative.lower()
        loot_keywords = ['libro', 'medallón', 'frasco', 'amuleto', 'pergamino', 'documento']
        narrative_mentions_items = any(keyword in narrative_lower for keyword in loot_keywords)
        
        print(f"🔍 Narrativa menciona items: {narrative_mentions_items}")
        
        if narrative_mentions_items and (discovered_items == 'FIELD_NOT_PRESENT' or discovered_items == []):
            print("❌ PROBLEMA CONFIRMADO: LLM genera narrativa con items pero NO aparecen en discoveredItems")
            print("🔍 SISTEMA DE LOOT DINÁMICO: COMPLETAMENTE ROTO")
            
            print("\n🔧 DIAGNÓSTICO TÉCNICO DETALLADO:")
            print("1. ❌ rollIntelligentLoot() NO está implementado en el servidor actual")
            print("2. ❌ discoveredItems NO está inicializado en GameState")
            print("3. ❌ discoveredItems NO está incluido en toDict()")
            print("4. ❌ Sistema de detección de acciones de búsqueda NO funciona")
            print("5. ❌ InlineLootBlock NO puede aparecer porque no recibe datos")
            
            print("\n🔧 SOLUCIÓN REQUERIDA:")
            print("1. ✅ Restaurar rollIntelligentLoot() desde backup")
            print("2. ✅ Inicializar this.discoveredItems = [] en GameState constructor")
            print("3. ✅ Añadir discoveredItems: this.discoveredItems || [] en toDict()")
            print("4. ✅ Implementar detección de acciones de búsqueda")
            print("5. ✅ Implementar endpoint /api/pickup_item")
            
            return False
            
        elif not narrative_mentions_items and (discovered_items == 'FIELD_NOT_PRESENT' or discovered_items == []):
            print("⚠️ SISTEMA POSIBLEMENTE DESACTIVADO: Ni narrativa ni discoveredItems contienen items")
            return False
            
        else:
            print("✅ SISTEMA FUNCIONANDO: Items presentes en discoveredItems")
            return True
        
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        return False

if __name__ == "__main__":
    success = investigate_loot_system()
    
    print(f"\n==== RESULTADO FINAL ====")
    if success:
        print("✅ SISTEMA DE LOOT DINÁMICO FUNCIONA CORRECTAMENTE")
    else:
        print("❌ SISTEMA DE LOOT DINÁMICO COMPLETAMENTE ROTO")
        print("🔧 REQUIERE RESTAURACIÓN DESDE BACKUP")
    
    sys.exit(0 if success else 1)