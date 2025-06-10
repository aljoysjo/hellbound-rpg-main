import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
import openai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["*"])
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URL)
db = client.hellbound_rpg

# OpenAI setup
openai.api_key = os.environ.get('OPENAI_API_KEY')

# Load game configuration
def load_json_file(filename):
    try:
        with open(f'/app/{filename}', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

LORE = load_json_file('lore.json')
FUNCTIONS = load_json_file('functions.json')
LEXICON = load_json_file('lexicon.json')

# Game state management
game_sessions = {}

class GameState:
    def __init__(self, session_id):
        self.session_id = session_id
        self.player_id = str(uuid.uuid4())
        self.health = 100
        self.mana = 100
        self.gold = 50
        self.skills = ["Exorcismo", "Fuego Sagrado", "Barrera", "Curación"]
        self.location = "Puertas de Ceniza"
        self.inventory = []
        self.narrative_log = []
        self.created_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'session_id': self.session_id,
            'player_id': self.player_id,
            'health': self.health,
            'mana': self.mana,
            'gold': self.gold,
            'skills': self.skills,
            'location': self.location,
            'inventory': self.inventory,
            'narrative_log': self.narrative_log[-10:],  # Last 10 entries
            'created_at': self.created_at.isoformat()
        }

@app.route('/api/healthcheck', methods=['GET'])
def healthcheck():
    return jsonify({
        'status': 'healthy',
        'message': 'Hellbound RPG backend is running',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/start_session', methods=['POST'])
def start_session():
    session_id = str(uuid.uuid4())
    game_state = GameState(session_id)
    game_sessions[session_id] = game_state
    
    # Save to MongoDB
    db.sessions.insert_one(game_state.to_dict())
    
    # Initial narrative
    initial_narrative = f"Te encuentras ante las {game_state.location}. El viento trae susurros de almas condenadas. ¿Qué harás, exorcista?"
    
    return jsonify({
        'session_id': session_id,
        'game_state': game_state.to_dict(),
        'initial_narrative': initial_narrative
    })

@app.route('/api/free_input', methods=['POST'])
def free_input():
    data = request.get_json()
    session_id = data.get('session_id')
    player_action = data.get('action', '').strip()
    
    if not session_id or session_id not in game_sessions:
        return jsonify({'error': 'Invalid session'}), 400
    
    if not player_action:
        return jsonify({'error': 'No action provided'}), 400
    
    game_state = game_sessions[session_id]
    
    try:
        # Create the system prompt in Spanish
        system_prompt = f"""
        Eres la lógica narrativa del juego Hellbound RPG. 
        Responde SIEMPRE en español neutro, en frases cortas y oscuras.
        
        CONTEXTO DEL MUNDO:
        - {LORE.get('setting', 'Un mundo devastado por la guerra donde los demonios caminan por la tierra')}
        - Héroe: {LORE.get('hero', 'Un exorcista solitario buscando redención')}
        - Antagonista: {LORE.get('antagonist', 'El Príncipe Caído gobernando el Reino Ardiente')}
        
        ESTADO ACTUAL DEL JUGADOR:
        - Salud: {game_state.health}/100
        - Maná: {game_state.mana}/100
        - Oro: {game_state.gold}
        - Ubicación: {game_state.location}
        - Habilidades: {', '.join(game_state.skills)}
        
        INSTRUCCIONES:
        1. Interpreta la acción del jugador de forma creativa
        2. Mantén el tono oscuro y atmosférico
        3. Ajusta los stats del jugador según lo que pase
        4. Usa máximo 3 oraciones
        5. Describe consecuencias de la acción
        
        ACCIÓN DEL JUGADOR: "{player_action}"
        
        Responde con una narrativa inmersiva y actualiza el estado del juego.
        """
        
        # Call OpenAI with function calling
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"El jugador dice: '{player_action}'"}
            ],
            functions=FUNCTIONS,
            function_call="auto",
            temperature=0.8,
            max_tokens=500
        )
        
        message = response.choices[0].message
        
        # Handle function calling if present
        if message.get("function_call"):
            function_call = message["function_call"]
            if function_call["name"] == "apply_player_action":
                function_args = json.loads(function_call["arguments"])
                narrative = function_args.get("narrative", "")
                state_changes = function_args.get("stateChanges", {})
                
                # Apply state changes
                if "health" in state_changes:
                    game_state.health = max(0, min(100, state_changes["health"]))
                if "mana" in state_changes:
                    game_state.mana = max(0, min(100, state_changes["mana"]))
                if "gold" in state_changes:
                    game_state.gold = max(0, state_changes["gold"])
                if "location" in state_changes:
                    game_state.location = state_changes["location"]
                
                # Add to narrative log
                game_state.narrative_log.append({
                    'timestamp': datetime.utcnow().isoformat(),
                    'player_action': player_action,
                    'narrative': narrative
                })
                
                # Update in MongoDB
                db.sessions.update_one(
                    {'session_id': session_id},
                    {'$set': game_state.to_dict()}
                )
                
                # Emit to WebSocket
                socketio.emit('game_update', {
                    'session_id': session_id,
                    'game_state': game_state.to_dict(),
                    'new_narrative': narrative
                }, room=session_id)
                
                return jsonify({
                    'success': True,
                    'narrative': narrative,
                    'game_state': game_state.to_dict()
                })
        
        # Fallback if no function call
        narrative = message.get("content", "El eco de tu acción resuena en la oscuridad...")
        game_state.narrative_log.append({
            'timestamp': datetime.utcnow().isoformat(),
            'player_action': player_action,
            'narrative': narrative
        })
        
        return jsonify({
            'success': True,
            'narrative': narrative,
            'game_state': game_state.to_dict()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_session/<session_id>', methods=['GET'])
def get_session(session_id):
    if session_id not in game_sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    game_state = game_sessions[session_id]
    return jsonify({
        'session_id': session_id,
        'game_state': game_state.to_dict()
    })

# WebSocket events
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connected', {'data': 'Conectado al servidor Hellbound RPG'})

@socketio.on('join_session')
def handle_join_session(data):
    session_id = data.get('session_id')
    if session_id:
        socketio.join_room(session_id)
        emit('joined_session', {'session_id': session_id})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8001, debug=True)
