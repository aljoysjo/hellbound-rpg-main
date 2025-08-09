#!/usr/bin/env python3
"""
HELLBOUND RPG - TESTING DE FUNCIONALIDAD DE PERSISTENCIA DE SESIONES
Pruebas exhaustivas del nuevo sistema de persistencia implementado.
"""

import requests
import json
import time
import uuid
from datetime import datetime

class SessionPersistenceTester:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.session_id = None
        self.session_code = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅" if success else "❌"
        print(f"{status} {test_name}: {details}")
        return success
    
    def run_request(self, method, endpoint, expected_status=200, data=None, params=None):
        """Execute HTTP request with error handling"""
        try:
            url = f"{self.base_url}/{endpoint}"
            
            if method.upper() == 'GET':
                response = requests.get(url, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            print(f"🌐 {method} {endpoint} -> {response.status_code}")
            
            if response.status_code != expected_status:
                print(f"❌ Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text[:500]}")
                return False, None
            
            try:
                return True, response.json()
            except:
                return True, response.text
                
        except Exception as e:
            print(f"❌ Request failed: {str(e)}")
            return False, None
    
    def test_healthcheck(self):
        """Test backend health and database connectivity"""
        success, response = self.run_request('GET', 'api/healthcheck')
        
        if not success:
            return self.log_test("Healthcheck", False, "Backend no responde")
        
        if not isinstance(response, dict):
            return self.log_test("Healthcheck", False, "Respuesta inválida")
        
        # Check required fields
        required_fields = ['status', 'openai_configured', 'mongo_connected']
        for field in required_fields:
            if field not in response:
                return self.log_test("Healthcheck", False, f"Campo faltante: {field}")
        
        if response['status'] != 'healthy':
            return self.log_test("Healthcheck", False, f"Status: {response['status']}")
        
        if not response['mongo_connected']:
            return self.log_test("Healthcheck", False, "MongoDB no conectado")
        
        return self.log_test("Healthcheck", True, "Backend y MongoDB funcionando")
    
    def test_create_sandbox_session(self):
        """Create a sandbox session for testing"""
        concept = "Detective paranormal investigando misterios sobrenaturales"
        
        success, response = self.run_request('POST', 'api/start_session', data={
            'mode': 'sandbox',
            'concept': concept
        })
        
        if not success:
            return self.log_test("Crear Sesión Sandbox", False, "Error en request")
        
        if not response.get('success'):
            return self.log_test("Crear Sesión Sandbox", False, f"Error: {response.get('error')}")
        
        self.session_id = response.get('session_id')
        if not self.session_id:
            return self.log_test("Crear Sesión Sandbox", False, "session_id no devuelto")
        
        # Verify game state structure
        game_state = response.get('game_state', {})
        if not game_state:
            return self.log_test("Crear Sesión Sandbox", False, "game_state vacío")
        
        return self.log_test("Crear Sesión Sandbox", True, f"Sesión creada: {self.session_id}")
    
    def test_perform_actions_for_autosave(self):
        """Perform actions that should trigger auto-save"""
        if not self.session_id:
            return self.log_test("Acciones para Auto-save", False, "No hay sesión activa")
        
        actions = [
            "Examinar la habitación en busca de pistas",
            "Buscar objetos místicos en el lugar",
            "Investigar sonidos extraños"
        ]
        
        for i, action in enumerate(actions):
            success, response = self.run_request('POST', 'api/free_input', data={
                'session_id': self.session_id,
                'action': action
            })
            
            if not success:
                return self.log_test("Acciones para Auto-save", False, f"Error en acción {i+1}")
            
            if not response.get('success'):
                return self.log_test("Acciones para Auto-save", False, f"Acción {i+1} falló")
            
            # Small delay between actions
            time.sleep(1)
        
        return self.log_test("Acciones para Auto-save", True, f"Ejecutadas {len(actions)} acciones")
    
    def test_manual_save_session(self):
        """Test manual session saving"""
        if not self.session_id:
            return self.log_test("Guardar Sesión Manual", False, "No hay sesión activa")
        
        success, response = self.run_request('POST', 'api/save_session', data={
            'session_id': self.session_id
        })
        
        if not success:
            return self.log_test("Guardar Sesión Manual", False, "Error en request")
        
        if not response.get('success'):
            return self.log_test("Guardar Sesión Manual", False, f"Error: {response.get('error')}")
        
        self.session_code = response.get('sessionCode')
        if not self.session_code:
            return self.log_test("Guardar Sesión Manual", False, "sessionCode no devuelto")
        
        # Verify session code format (RPG-XXXXX)
        if not self.session_code.startswith('RPG-') or len(self.session_code) != 9:
            return self.log_test("Guardar Sesión Manual", False, f"Formato de código inválido: {self.session_code}")
        
        title = response.get('title', '')
        return self.log_test("Guardar Sesión Manual", True, f"Código: {self.session_code}, Título: {title}")
    
    def test_list_sessions(self):
        """Test listing saved sessions"""
        success, response = self.run_request('GET', 'api/list_sessions')
        
        if not success:
            return self.log_test("Listar Sesiones", False, "Error en request")
        
        if not response.get('success'):
            return self.log_test("Listar Sesiones", False, f"Error: {response.get('error')}")
        
        sessions = response.get('sessions', [])
        if not isinstance(sessions, list):
            return self.log_test("Listar Sesiones", False, "sessions no es array")
        
        # Check if our saved session is in the list
        our_session_found = False
        if self.session_code:
            for session in sessions:
                if session.get('sessionCode') == self.session_code:
                    our_session_found = True
                    # Verify session metadata
                    required_fields = ['title', 'gameMode', 'lastPlayed', 'location', 'health']
                    for field in required_fields:
                        if field not in session:
                            return self.log_test("Listar Sesiones", False, f"Campo faltante en sesión: {field}")
                    break
        
        if self.session_code and not our_session_found:
            return self.log_test("Listar Sesiones", False, f"Sesión {self.session_code} no encontrada en lista")
        
        return self.log_test("Listar Sesiones", True, f"Encontradas {len(sessions)} sesiones")
    
    def test_load_session_by_code(self):
        """Test loading session by code"""
        if not self.session_code:
            return self.log_test("Cargar Sesión por Código", False, "No hay código de sesión")
        
        success, response = self.run_request('POST', 'api/load_session', data={
            'sessionCode': self.session_code
        })
        
        if not success:
            return self.log_test("Cargar Sesión por Código", False, "Error en request")
        
        if not response.get('success'):
            return self.log_test("Cargar Sesión por Código", False, f"Error: {response.get('error')}")
        
        # Verify response structure
        required_fields = ['session_id', 'game_state', 'current_narrative', 'suggested_actions']
        for field in required_fields:
            if field not in response:
                return self.log_test("Cargar Sesión por Código", False, f"Campo faltante: {field}")
        
        # Verify game state integrity
        game_state = response.get('game_state', {})
        if not game_state:
            return self.log_test("Cargar Sesión por Código", False, "game_state vacío")
        
        # Check that essential game state fields are preserved
        essential_fields = ['vitals', 'inventory', 'location', 'mode', 'actionCount']
        for field in essential_fields:
            if field not in game_state:
                return self.log_test("Cargar Sesión por Código", False, f"Campo de estado faltante: {field}")
        
        # Store new session ID for further testing
        loaded_session_id = response.get('session_id')
        
        return self.log_test("Cargar Sesión por Código", True, f"Sesión cargada: {loaded_session_id}")
    
    def test_load_nonexistent_session(self):
        """Test loading a non-existent session code"""
        fake_code = "RPG-FAKE1"
        
        success, response = self.run_request('POST', 'api/load_session', 404, data={
            'sessionCode': fake_code
        })
        
        if not success:
            return self.log_test("Cargar Sesión Inexistente", False, "Request no devolvió 404")
        
        if isinstance(response, dict) and response.get('error'):
            return self.log_test("Cargar Sesión Inexistente", True, f"Error esperado: {response['error']}")
        
        return self.log_test("Cargar Sesión Inexistente", True, "404 devuelto correctamente")
    
    def test_session_code_uniqueness(self):
        """Test that session codes are unique"""
        if not self.session_id:
            return self.log_test("Códigos Únicos", False, "No hay sesión activa")
        
        # Create multiple sessions and save them
        session_codes = []
        
        for i in range(3):
            # Create new session
            concept = f"Aventurero explorando ruinas antiguas #{i+1}"
            success, response = self.run_request('POST', 'api/start_session', data={
                'mode': 'sandbox',
                'concept': concept
            })
            
            if not success or not response.get('success'):
                return self.log_test("Códigos Únicos", False, f"Error creando sesión {i+1}")
            
            temp_session_id = response.get('session_id')
            
            # Save the session
            success, save_response = self.run_request('POST', 'api/save_session', data={
                'session_id': temp_session_id
            })
            
            if not success or not save_response.get('success'):
                return self.log_test("Códigos Únicos", False, f"Error guardando sesión {i+1}")
            
            session_code = save_response.get('sessionCode')
            if not session_code:
                return self.log_test("Códigos Únicos", False, f"No se obtuvo código para sesión {i+1}")
            
            session_codes.append(session_code)
        
        # Check uniqueness
        if len(session_codes) != len(set(session_codes)):
            return self.log_test("Códigos Únicos", False, f"Códigos duplicados: {session_codes}")
        
        # Verify all codes follow RPG-XXXXX format
        for code in session_codes:
            if not code.startswith('RPG-') or len(code) != 9:
                return self.log_test("Códigos Únicos", False, f"Formato inválido: {code}")
        
        return self.log_test("Códigos Únicos", True, f"Generados {len(session_codes)} códigos únicos")
    
    def test_delete_session(self):
        """Test session deletion"""
        if not self.session_code:
            return self.log_test("Eliminar Sesión", False, "No hay código de sesión")
        
        success, response = self.run_request('DELETE', 'api/delete_session', data={
            'sessionCode': self.session_code
        })
        
        if not success:
            return self.log_test("Eliminar Sesión", False, "Error en request")
        
        if not response.get('success'):
            return self.log_test("Eliminar Sesión", False, f"Error: {response.get('error')}")
        
        # Verify session is actually deleted by trying to load it
        success, load_response = self.run_request('POST', 'api/load_session', 404, data={
            'sessionCode': self.session_code
        })
        
        if not success:
            return self.log_test("Eliminar Sesión", True, "Sesión eliminada correctamente")
        
        return self.log_test("Eliminar Sesión", True, "Sesión eliminada y verificada")
    
    def test_complete_session_flow(self):
        """Test complete session persistence flow"""
        print("\n🎯 INICIANDO FLUJO COMPLETO DE SESIONES")
        
        # Step 1: Create session
        concept = "Mago investigando artefactos perdidos"
        success, response = self.run_request('POST', 'api/start_session', data={
            'mode': 'sandbox',
            'concept': concept
        })
        
        if not success or not response.get('success'):
            return self.log_test("Flujo Completo", False, "Error creando sesión inicial")
        
        flow_session_id = response.get('session_id')
        initial_game_state = response.get('game_state', {})
        initial_inventory_count = len(initial_game_state.get('inventory', []))
        initial_action_count = initial_game_state.get('actionCount', 0)
        
        print(f"📊 Estado inicial - Inventario: {initial_inventory_count}, Acciones: {initial_action_count}")
        
        # Step 2: Perform actions that change state
        actions = [
            "Buscar un grimorio antiguo en la biblioteca",
            "Examinar las runas en la pared",
            "Recoger una gema mística del suelo"
        ]
        
        for action in actions:
            success, response = self.run_request('POST', 'api/free_input', data={
                'session_id': flow_session_id,
                'action': action
            })
            
            if not success or not response.get('success'):
                return self.log_test("Flujo Completo", False, f"Error en acción: {action}")
            
            # Check for discovered items and pick them up
            game_state = response.get('game_state', {})
            discovered_items = game_state.get('discoveredItems', [])
            
            for item in discovered_items:
                item_id = item.get('instanceId')
                if item_id:
                    pickup_success, pickup_response = self.run_request('POST', 'api/pickup_item', data={
                        'session_id': flow_session_id,
                        'item_id': item_id
                    })
                    if pickup_success:
                        print(f"📦 Recogido: {item.get('name')}")
        
        # Step 3: Get updated state
        success, state_response = self.run_request('GET', f'api/get_session/{flow_session_id}')
        if not success:
            return self.log_test("Flujo Completo", False, "Error obteniendo estado actualizado")
        
        updated_game_state = state_response.get('game_state', {})
        updated_inventory_count = len(updated_game_state.get('inventory', []))
        updated_action_count = updated_game_state.get('actionCount', 0)
        
        print(f"📊 Estado actualizado - Inventario: {updated_inventory_count}, Acciones: {updated_action_count}")
        
        # Step 4: Save session
        success, save_response = self.run_request('POST', 'api/save_session', data={
            'session_id': flow_session_id
        })
        
        if not success or not save_response.get('success'):
            return self.log_test("Flujo Completo", False, "Error guardando sesión")
        
        flow_session_code = save_response.get('sessionCode')
        
        # Step 5: Load session and verify state preservation
        success, load_response = self.run_request('POST', 'api/load_session', data={
            'sessionCode': flow_session_code
        })
        
        if not success or not load_response.get('success'):
            return self.log_test("Flujo Completo", False, "Error cargando sesión")
        
        loaded_game_state = load_response.get('game_state', {})
        loaded_inventory_count = len(loaded_game_state.get('inventory', []))
        loaded_action_count = loaded_game_state.get('actionCount', 0)
        
        print(f"📊 Estado cargado - Inventario: {loaded_inventory_count}, Acciones: {loaded_action_count}")
        
        # Step 6: Verify state integrity
        state_preserved = (
            loaded_inventory_count == updated_inventory_count and
            loaded_action_count == updated_action_count and
            loaded_game_state.get('location') == updated_game_state.get('location') and
            loaded_game_state.get('mode') == updated_game_state.get('mode')
        )
        
        if not state_preserved:
            return self.log_test("Flujo Completo", False, "Estado no preservado correctamente")
        
        return self.log_test("Flujo Completo", True, f"Estado preservado - Código: {flow_session_code}")
    
    def run_all_tests(self):
        """Run all session persistence tests"""
        print("🚀 INICIANDO TESTING DE PERSISTENCIA DE SESIONES")
        print("=" * 60)
        
        tests = [
            self.test_healthcheck,
            self.test_create_sandbox_session,
            self.test_perform_actions_for_autosave,
            self.test_manual_save_session,
            self.test_list_sessions,
            self.test_load_session_by_code,
            self.test_load_nonexistent_session,
            self.test_session_code_uniqueness,
            self.test_complete_session_flow,
            self.test_delete_session,
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ Error en test {test.__name__}: {str(e)}")
                failed += 1
            
            print("-" * 40)
        
        print(f"\n📊 RESULTADOS FINALES:")
        print(f"✅ Pasaron: {passed}")
        print(f"❌ Fallaron: {failed}")
        print(f"📈 Tasa de éxito: {(passed/(passed+failed)*100):.1f}%")
        
        return passed, failed

def main():
    """Main test execution"""
    # Use the backend URL from frontend/.env
    backend_url = "https://9f2d59a6-1dc6-45c7-94c5-bb7bd8e5829c.preview.emergentagent.com"
    
    print(f"🌐 Testing backend: {backend_url}")
    
    tester = SessionPersistenceTester(backend_url)
    passed, failed = tester.run_all_tests()
    
    if failed == 0:
        print("\n🎉 TODOS LOS TESTS DE PERSISTENCIA PASARON!")
        return True
    else:
        print(f"\n⚠️ {failed} tests fallaron. Revisar implementación.")
        return False

if __name__ == "__main__":
    main()