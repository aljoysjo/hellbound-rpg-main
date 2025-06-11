import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';

// 🔄 COMPONENTES DE STATS DINÁMICOS
const VitalBars = ({ vitals = {} }) => (
  <div className="space-y-3">
    <div className="relative">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-red-400 font-bold">Vida</span>
        <span className="text-white">{vitals.health || 100}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 border border-red-600">
        <div 
          className="bg-gradient-to-r from-red-600 to-red-400 h-3 rounded-full transition-all duration-300"
          style={{ width: `${vitals.health || 100}%` }}
        />
      </div>
    </div>
    
    <div className="relative">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-blue-400 font-bold">Maná</span>
        <span className="text-white">{vitals.mana || 100}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 border border-blue-600">
        <div 
          className="bg-gradient-to-r from-blue-600 to-blue-400 h-3 rounded-full transition-all duration-300"
          style={{ width: `${vitals.mana || 100}%` }}
        />
      </div>
    </div>
    
    <div className="relative">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-green-400 font-bold">Stamina</span>
        <span className="text-white">{vitals.stamina || 100}/100</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 border border-green-600">
        <div 
          className="bg-gradient-to-r from-green-600 to-green-400 h-3 rounded-full transition-all duration-300"
          style={{ width: `${vitals.stamina || 100}%` }}
        />
      </div>
    </div>
  </div>
);

const ResourceDisplay = ({ resources = {} }) => (
  <div className="grid grid-cols-2 gap-2 text-sm">
    <div className="flex items-center space-x-2">
      <span className="text-yellow-400">💰</span>
      <span className="text-white">{resources.gold || 0}</span>
    </div>
    <div className="flex items-center space-x-2">
      <span className="text-amber-400">🍞</span>
      <span className="text-white">{resources.rations || 0}</span>
    </div>
    <div className="flex items-center space-x-2">
      <span className="text-purple-400">💎</span>
      <span className="text-white">{resources.gemas || 0}</span>
    </div>
    <div className="flex items-center space-x-2">
      <span className="text-orange-400">⚱️</span>
      <span className="text-white">{resources.reliquias || 0}</span>
    </div>
  </div>
);

const AttributeDisplay = ({ attributes = {} }) => (
  <div className="grid grid-cols-2 gap-2 text-sm">
    <div className="flex justify-between">
      <span className="text-red-400">💪 Fuerza</span>
      <span className="text-white font-bold">{attributes.fuerza || 5}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-green-400">🏃 Agilidad</span>
      <span className="text-white font-bold">{attributes.agilidad || 5}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-blue-400">🧠 Sabiduría</span>
      <span className="text-white font-bold">{attributes.sabiduría || 5}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-yellow-400">💬 Carisma</span>
      <span className="text-white font-bold">{attributes.carisma || 5}</span>
    </div>
  </div>
);

// 😊 COMPONENTE DE ESTADOS EMOCIONALES
const EmotionalStates = ({ emotionalStates = {} }) => {
  const emotionIcons = {
    miedo: '😰',
    alerta: '⚡',
    euforia: '😄',
    fatiga: '😴',
    ira: '😡',
    serenidad: '😌'
  };

  const strongEmotions = Object.entries(emotionalStates)
    .filter(([emotion, value]) => value > 50)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  if (strongEmotions.length === 0) return null;

  return (
    <div className="bg-black bg-opacity-60 p-3 rounded-lg border border-purple-800">
      <h4 className="text-purple-400 font-bold mb-2 text-sm">Estado Emocional</h4>
      <div className="space-y-2">
        {strongEmotions.map(([emotion, value]) => (
          <div key={emotion} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{emotionIcons[emotion] || '😐'}</span>
              <span className="text-white text-sm capitalize">{emotion}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-16 bg-gray-800 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    value > 80 ? 'bg-red-500' :
                    value > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{Math.round(value)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🎯 COMPONENTE DE HABILIDADES DINÁMICO ILIMITADO
const DynamicSkillBar = ({ skills = [] }) => {
  if (skills.length === 0) {
    return (
      <div className="text-center py-4">
        <span className="text-gray-400 text-sm italic">Sin habilidades específicas</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill, index) => (
        <div key={skill.id || index} className="relative group">
          <div className="min-w-12 h-12 bg-gray-800 border-2 border-yellow-600 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer p-1">
            <div className="text-center">
              <div className="text-yellow-400 text-xs font-bold">{index + 1}</div>
              {skill.level && (
                <div className="text-white text-xs">Nv.{skill.level}</div>
              )}
            </div>
          </div>
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-48">
            <div className="font-bold">{typeof skill === 'object' ? skill.id : skill}</div>
            {skill.description && (
              <div className="text-gray-300">{skill.description}</div>
            )}
            {skill.tags && (
              <div className="text-blue-300 text-xs mt-1">{skill.tags.join(', ')}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const ActionInput = ({ onSubmit, disabled, suggestedActions = [] }) => {
  const [action, setAction] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (action.trim() && !disabled) {
      onSubmit(action.trim());
      setAction('');
    }
  };

  const handleSuggestedAction = (suggestedAction) => {
    if (!disabled) {
      onSubmit(suggestedAction);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Suggested Actions */}
      {suggestedActions && suggestedActions.length > 0 && (
        <div>
          <h4 className="text-yellow-400 font-semibold mb-2 text-sm">Acciones Sugeridas:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {suggestedActions.slice(0, 4).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedAction(suggestion)}
                disabled={disabled}
                className="px-3 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-600 text-white text-sm rounded transition-colors border border-yellow-500 hover:border-yellow-400"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Free Text Input */}
      <div>
        <h4 className="text-yellow-400 font-semibold mb-2 text-sm">O escribe tu propia acción:</h4>
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
      </div>
    </div>
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

// 🎨 COMPONENTE SANDBOX CONCEPT-FIRST
const SandboxConceptForm = ({ onSubmit, loading }) => {
  const [concept, setConcept] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (concept.trim() && !loading) {
      onSubmit(concept.trim());
    }
  };

  return (
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-4xl font-bold text-red-400 mb-4">
        Modo Sandbox - Historia Libre
      </h2>
      <p className="text-xl text-gray-300 mb-8">
        Describe la historia que quieres vivir. Puede ser cualquier cosa: desde una aventura épica hasta una historia de la vida cotidiana con toques sobrenaturales.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-yellow-400 font-semibold mb-2 text-lg">
            ¿Qué historia quieres contar?
          </label>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ejemplo: 'Quiero ser un detective paranormal investigando desapariciones misteriosas en una ciudad moderna' o 'Soy un mago aprendiz en una academia flotante llena de secretos' o 'Un superviviente en un apocalipsis zombie que busca a su familia'..."
            disabled={loading}
            rows={4}
            className="w-full px-4 py-3 bg-gray-900 border-2 border-red-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400 disabled:opacity-50 resize-none"
            required
            minLength={20}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || concept.trim().length < 20}
          className="px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
        >
          {loading ? 'Creando tu historia...' : 'Comenzar Aventura'}
        </button>
      </form>
      
      <div className="mt-6 text-sm text-gray-400">
        <p>💡 <strong>Tip:</strong> Sé específico sobre el tipo de personaje, el mundo, y la situación inicial que te interesa.</p>
      </div>
    </div>
  );
};

// Componente para mostrar cambios de estado en tiempo real
const StateChangeNotification = ({ stateChanges, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!stateChanges || Object.keys(stateChanges).length === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-90 border border-yellow-600 rounded-lg p-4 max-w-sm z-50">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-yellow-400 font-bold text-sm">Cambios de Estado</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>
      
      <div className="space-y-1 text-xs">
        {stateChanges.vitalDelta && Object.entries(stateChanges.vitalDelta).map(([vital, delta]) => (
          <div key={vital} className={`${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {vital}: {delta > 0 ? '+' : ''}{delta}
          </div>
        ))}
        
        {stateChanges.statusSet && Object.entries(stateChanges.statusSet).map(([emotion, value]) => (
          <div key={emotion} className="text-purple-400">
            {emotion}: {value}%
          </div>
        ))}
        
        {stateChanges.newSkill && (
          <div className="text-yellow-400">
            ⭐ Nueva habilidad: {stateChanges.newSkill.id}
          </div>
        )}
      </div>
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
  const [mode, setMode] = useState(null);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [showSandboxForm, setShowSandboxForm] = useState(false);
  const [stateChangeNotification, setStateChangeNotification] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
  
  console.log('🔍 DEBUG - BACKEND_URL:', BACKEND_URL);

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
        if (data.suggested_actions) {
          setSuggestedActions(data.suggested_actions);
        }
        if (data.state_changes) {
          setStateChangeNotification(data.state_changes);
        }
      }
    });

    return () => {
      newSocket.close();
    };
  }, [BACKEND_URL, sessionId]);

  // Start new game session
  const startNewSession = async (selectedMode = mode, campaignName, sandboxConcept) => {
    setLoading(true);
    setError(null);
    
    try {
      const requestBody = {
        mode: selectedMode || 'sandbox'
      };
      
      // Add campaign name for campaign mode
      if (selectedMode === 'campaign') {
        requestBody.campaign = campaignName || 'scenes_act1';
      }
      
      // Add sandbox concept for sandbox mode
      if (selectedMode === 'sandbox') {
        if (!sandboxConcept) {
          setShowSandboxForm(true);
          setLoading(false);
          return;
        }
        requestBody.sandboxConcept = sandboxConcept;
      }
      
      const response = await fetch(`${BACKEND_URL}/api/start_session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setGameState(data.game_state);
      setShowSandboxForm(false);
      
      // Set initial suggested actions if provided
      if (data.suggested_actions) {
        setSuggestedActions(data.suggested_actions);
      }
      
      // Join socket room
      if (socket) {
        socket.emit('join_session', { session_id: data.session_id });
      }

      // Add initial narrative to log
      if (data.initial_narrative) {
        setGameState(prev => ({
          ...prev,
          narrativeLog: [...(prev?.narrativeLog || []), {
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
      console.log('🚚 Datos recibidos en frontend:', data);
      
      if (data.success) {
        const updatedGameState = {
          ...data.game_state,
          narrativeLog: data.game_state.narrativeLog || []
        };
        
        if (data.narrative) {
          updatedGameState.narrativeLog = [
            ...updatedGameState.narrativeLog,
            {
              timestamp: new Date().toISOString(),
              player_action: action,
              narrative: data.narrative
            }
          ];
        }
        
        setGameState(updatedGameState);
        
        if (data.suggested_actions) {
          setSuggestedActions(data.suggested_actions);
        }
        
        if (data.state_changes && Object.keys(data.state_changes).length > 0) {
          setStateChangeNotification(data.state_changes);
        }
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

      {/* State Change Notifications */}
      {stateChangeNotification && (
        <StateChangeNotification 
          stateChanges={stateChangeNotification} 
          onClose={() => setStateChangeNotification(null)} 
        />
      )}

      {/* Header */}
      <header className="relative z-10 border-b-2 border-red-800 bg-black bg-opacity-50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-red-400 tracking-wider">
              🔥 HELLBOUND RPG v2.0
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
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {!mode ? (
              // Mode Selection
              <div className="text-center">
                <h2 className="text-5xl font-bold text-red-400 mb-4">
                  Bienvenido al Infierno
                </h2>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl">
                  Elige tu camino en una aventura épica donde cada decisión forja tu destino. 
                  Tres modos diferentes te esperan para explorar mundos únicos.
                </p>
                <div className="w-full">
                  <ModeSelector onSelect={setMode} />
                </div>
              </div>
            ) : showSandboxForm && mode === 'sandbox' ? (
              // Sandbox Concept Form
              <SandboxConceptForm 
                onSubmit={(concept) => startNewSession('sandbox', null, concept)}
                loading={loading}
              />
            ) : (
              // Start Button after mode selection
              <div className="text-center">
                <p className="text-lg text-gray-300 mb-4">
                  Modo seleccionado: <span className="text-red-400 font-bold">
                    {mode === 'sandbox' ? 'Sandbox' : 
                     mode === 'campaign' ? 'Campaña' : 
                     'Campaña Temporal'}
                  </span>
                </p>
                <div className="space-y-4">
                  <button
                    onClick={() => startNewSession(mode, 'scenes_act1')}
                    disabled={loading}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
                  >
                    {loading ? 'Iniciando...' : `Iniciar ${
                      mode === 'sandbox' ? 'Sandbox' : 
                      mode === 'campaign' ? 'Campaña' : 
                      'Campaña Temporal'
                    }`}
                  </button>
                  <button
                    onClick={() => {
                      setMode(null);
                      setShowSandboxForm(false);
                    }}
                    disabled={loading}
                    className="block mx-auto px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                  >
                    Cambiar Modo
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Game Interface
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel - Enhanced HUD */}
            <div className="space-y-4">
              {/* Vitals */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Estado Vital</h3>
                <VitalBars vitals={gameState?.vitals} />
              </div>

              {/* Emotional States */}
              <EmotionalStates emotionalStates={gameState?.emotionalStates} />

              {/* Skills */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Habilidades</h3>
                <DynamicSkillBar skills={gameState?.skills} />
              </div>

              {/* Resources */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Recursos</h3>
                <ResourceDisplay resources={gameState?.resources} />
              </div>

              {/* Attributes */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">Atributos</h3>
                <AttributeDisplay attributes={gameState?.attributes} />
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
                <LogFeed narrativeLog={gameState?.narrativeLog || []} />
              </div>

              {/* Action Input */}
              <div className="bg-black bg-opacity-60 p-4 rounded-lg border border-red-800">
                <h3 className="text-red-400 font-bold mb-4">¿Qué harás?</h3>
                <ActionInput 
                  onSubmit={submitAction} 
                  disabled={loading} 
                  suggestedActions={suggestedActions}
                />
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