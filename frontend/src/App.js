import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';

// HUD Components
const LifeOrb = ({ health }) => (
  <div className="relative w-20 h-20">
    <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-900 rounded-full border-4 border-yellow-500 shadow-lg">
      <div 
        className="absolute bottom-0 left-0 right-0 bg-red-800 rounded-full transition-all duration-300"
        style={{ height: `${health}%` }}
      />
    </div>
    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
      {health}
    </div>
  </div>
);

const ManaOrb = ({ mana }) => (
  <div className="relative w-20 h-20">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 rounded-full border-4 border-yellow-500 shadow-lg">
      <div 
        className="absolute bottom-0 left-0 right-0 bg-blue-800 rounded-full transition-all duration-300"
        style={{ height: `${mana}%` }}
      />
    </div>
    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
      {mana}
    </div>
  </div>
);

const SkillBar = ({ skills }) => (
  <div className="flex space-x-2">
    {skills.map((skill, index) => (
      <div key={index} className="relative group">
        <div className="w-12 h-12 bg-gray-800 border-2 border-yellow-600 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
          <span className="text-yellow-400 text-xs font-bold">{index + 1}</span>
        </div>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {skill}
        </div>
      </div>
    ))}
  </div>
);

const GoldCounter = ({ gold }) => (
  <div className="flex items-center space-x-2 bg-yellow-900 bg-opacity-80 px-4 py-2 rounded-lg border border-yellow-600">
    <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
      <span className="text-yellow-900 text-xs font-bold">$</span>
    </div>
    <span className="text-yellow-200 font-bold">{gold}</span>
  </div>
);

const ActionInput = ({ onSubmit, disabled }) => {
  const [action, setAction] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (action.trim() && !disabled) {
      onSubmit(action.trim());
      setAction('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Escribe tu acción..."
          disabled={disabled}
          className="w-full px-4 py-3 bg-gray-900 border-2 border-red-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !action.trim()}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          Actuar
        </button>
      </div>
    </form>
  );
};

const LogFeed = ({ narrativeLog }) => {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [narrativeLog]);

  return (
    <div 
      ref={logRef}
      className="h-64 bg-black bg-opacity-80 border-2 border-gray-700 rounded-lg p-4 overflow-y-auto text-gray-300"
    >
      {narrativeLog.length === 0 ? (
        <p className="italic text-gray-500">El silencio reina en la oscuridad...</p>
      ) : (
        narrativeLog.map((entry, index) => (
          <div key={index} className="mb-3 border-b border-gray-800 pb-2">
            <p className="text-yellow-400 text-sm font-semibold mb-1">
              &gt; {entry.player_action}
            </p>
            <p className="text-gray-200 leading-relaxed">
              {entry.narrative}
            </p>
          </div>
        ))
      )}
    </div>
  );
};

// Main App Component
function App() {
  const [gameState, setGameState] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [mode, setMode] = useState(null); // Nuevo estado para el modo seleccionado

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
  
  console.log('🔍 DEBUG - BACKEND_URL:', BACKEND_URL);
  console.log('🔍 DEBUG - process.env.REACT_APP_BACKEND_URL:', process.env.REACT_APP_BACKEND_URL);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from server');
    });

    newSocket.on('game_update', (data) => {
      if (data.session_id === sessionId) {
        setGameState(data.game_state);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [BACKEND_URL, sessionId]);

  // Start new game session
  const startNewSession = async (selectedMode = mode) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/start_session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: selectedMode || 'sandbox'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setGameState(data.game_state);
      
      // Join socket room
      if (socket) {
        socket.emit('join_session', { session_id: data.session_id });
      }

      // Add initial narrative to log
      if (data.initial_narrative) {
        setGameState(prev => ({
          ...prev,
          narrative_log: [...(prev?.narrative_log || []), {
            player_action: '[Inicio del juego]',
            narrative: data.initial_narrative,
            timestamp: new Date().toISOString()
          }]
        }));
      }

    } catch (err) {
      setError('Error al iniciar sesión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit player action
  const submitAction = async (action) => {
    if (!sessionId || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/free_input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          action: action
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit action');
      }

      const data = await response.json();
      console.log('🚚 Datos recibidos en frontend:', data);   // DEBUG
      
      if (data.success) {
        // Actualizar el game state con la nueva narrativa incluida
        const updatedGameState = {
          ...data.game_state,
          narrative_log: data.game_state.narrative_log || []
        };
        
        // Si hay narrativa nueva, agregarla al log
        if (data.narrative) {
          updatedGameState.narrative_log = [
            ...updatedGameState.narrative_log,
            {
              timestamp: new Date().toISOString(),
              player_action: action,
              narrative: data.narrative
            }
          ];
        }
        
        setGameState(updatedGameState);
      } else {
        setError('Error en la acción: ' + data.error);
      }

    } catch (err) {
      setError('Error al procesar acción: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black text-white font-medieval">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-repeat" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M30 30c0-11.046-8.954-20-20-20s-20 8.954-20 20 8.954 20 20 20 20-8.954 20-20zM10 30c0-11.046 8.954-20 20-20s20 8.954 20 20-8.954 20-20 20-20-8.954-20-20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b-2 border-red-800 bg-black bg-opacity-50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-red-400 tracking-wider">
              🔥 HELLBOUND RPG
            </h1>
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-400">
                {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="relative z-10 container mx-auto px-4 py-6">
        {!sessionId ? (
          // Start Screen
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-5xl font-bold text-red-400 mb-4">
              Bienvenido al Infierno
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl">
              Un mundo devastado por la guerra donde los demonios caminan por la tierra. 
              Eres un exorcista solitario buscando redención en el Reino Ardiente.
            </p>
            <button
              onClick={startNewSession}
              disabled={loading}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
            >
              {loading ? 'Iniciando...' : 'Comenzar Aventura'}
            </button>
          </div>
        ) : (
          // Game Interface
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - HUD */}
            <div className="space-y-4">
              {/* Health & Mana */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Estado</h3>
                <div className="flex justify-center space-x-6">
                  <div className="text-center">
                    <LifeOrb health={gameState?.health || 0} />
                    <p className="text-red-400 text-sm mt-2">Vida</p>
                  </div>
                  <div className="text-center">
                    <ManaOrb mana={gameState?.mana || 0} />
                    <p className="text-blue-400 text-sm mt-2">Maná</p>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Habilidades</h3>
                <div className="flex justify-center">
                  <SkillBar skills={gameState?.skills || []} />
                </div>
              </div>

              {/* Gold */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Recursos</h3>
                <div className="flex justify-center">
                  <GoldCounter gold={gameState?.gold || 0} />
                </div>
              </div>

              {/* Location */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-2">Ubicación</h3>
                <p className="text-gray-300 text-center">{gameState?.location || 'Desconocido'}</p>
              </div>
            </div>

            {/* Center Panel - Narrative Log */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Crónica del Exorcista</h3>
                <LogFeed narrativeLog={gameState?.narrative_log || []} />
              </div>

              {/* Action Input */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">¿Qué harás?</h3>
                <ActionInput onSubmit={submitAction} disabled={loading} />
                {loading && (
                  <p className="text-yellow-400 text-sm mt-2">
                    El destino se está escribiendo...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;