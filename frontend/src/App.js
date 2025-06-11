import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';

// 🎯 COMPONENTE GENÉRICO PARA STATS DINÁMICOS con nueva paleta
const StatOrb = ({ type, value, max = 100 }) => {
  const getOrbStyle = (statType) => {
    const styles = {
      health: { border: 'var(--c-health)', icon: '❤️' },
      mana: { border: 'var(--c-mana)', icon: '🔮' },
      stamina: { border: 'var(--c-stamina)', icon: '⚡' },
      default: { border: 'var(--c-cedar)', icon: '📊' }
    };
    return styles[statType] || styles.default;
  };

  const style = getOrbStyle(type);
  const percentage = (value / max) * 100;

  return (
    <div className={`stat-orb stat-orb-${type}`}>
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medieval font-semibold capitalize flex items-center gap-1" style={{color: 'var(--c-text)'}}>
          <span>{style.icon}</span>
          {type}
        </span>
        <span style={{color: 'var(--c-text)'}}>{value}/{max}</span>
      </div>
      <div className="w-full bg-gray-300 rounded-full h-3 border" style={{borderColor: style.border, backgroundColor: 'rgba(140, 91, 44, 0.2)'}}>
        <div 
          className="stat-bar h-3 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 🏷️ COMPONENTE PARA ESTADOS EMOCIONALES con paleta pergamino
const StatusChip = ({ label, value, type = 'emotion' }) => {
  const getChipClass = (val) => {
    if (val > 70) return 'emotion-high';
    if (val > 50) return 'emotion-medium';
    return 'emotion-low';
  };

  const getIcon = (emotion) => {
    const icons = {
      miedo: '😰', alerta: '⚠️', euforia: '😄', fatiga: '😴', 
      ira: '😡', serenidad: '😌', default: '😐'
    };
    return icons[emotion] || icons.default;
  };

  if (value < 20) return null;

  return (
    <div className={`emotion-chip ${getChipClass(value)}`}>
      <span>{getIcon(label)}</span>
      <span className="capitalize">{label}</span>
      <span className="font-bold">{Math.round(value)}</span>
    </div>
  );
};

// 📊 COMPONENTE PARA RECURSOS Y ATRIBUTOS con estilo pergamino
const ResourceGrid = ({ title, data, icons = {} }) => {
  if (!data || Object.keys(data).length === 0) return null;

  const getIcon = (key) => {
    const defaultIcons = {
      gold: '💰', rations: '🍞', gemas: '💎', reliquias: '⚱️',
      fuerza: '💪', agilidad: '🏃', sabiduría: '🧠', carisma: '💬'
    };
    return icons[key] || defaultIcons[key] || '📄';
  };

  return (
    <div className="hud-panel">
      <h3>{title}</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="flex items-center gap-1" style={{color: 'var(--c-cedar)'}}>
              <span>{getIcon(key)}</span>
              <span className="capitalize">{key}</span>
            </span>
            <span className="font-semibold" style={{color: 'var(--c-text)'}}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🎯 COMPONENTE DE HABILIDADES DINÁMICO con nuevo diseño
const DynamicSkillBar = ({ skills = [], gameMode = 'rpg' }) => {
  if (skills.length === 0) {
    const placeholder = gameMode === 'sandbox' ? 
      'Las habilidades emergerán según tus acciones' : 
      'Sin habilidades específicas';
    
    return (
      <div className="text-center py-4">
        <span style={{color: 'var(--c-cedar)'}} className="text-sm italic">{placeholder}</span>
      </div>
    );
  }

  return (
    <div className="skills-grid">
      {skills.map((skill, index) => (
        <div key={skill.id || index} className="skill-slot group">
          <div className="text-center">
            <div style={{color: 'var(--c-border)'}} className="text-xs font-bold">{index + 1}</div>
            {skill.level && (
              <div style={{color: 'var(--c-text)'}} className="text-xs">Nv.{skill.level}</div>
            )}
          </div>
          <div className="skill-tooltip">
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

const ActionInput = ({ onSubmit, disabled, suggestedActions = [], gameOver = false }) => {
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

  if (gameOver) {
    return (
      <div className="w-full space-y-4 text-center">
        <div className="hud-panel" style={{background: 'rgba(220, 38, 38, 0.1)', borderColor: '#dc2626'}}>
          <h3 style={{color: '#dc2626'}} className="text-xl mb-4">💀 GAME OVER 💀</h3>
          <p style={{color: 'var(--c-text)'}} className="mb-4">Tu aventura ha llegado a su fin. ¿Quieres intentarlo de nuevo?</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Reiniciar Partida
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {suggestedActions && suggestedActions.length > 0 && (
        <div>
          <h4 style={{color: 'var(--c-border)'}} className="font-semibold mb-2 text-sm font-medieval">Acciones Sugeridas:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {suggestedActions.slice(0, 4).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedAction(suggestion)}
                disabled={disabled}
                className="btn-suggested"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 style={{color: 'var(--c-border)'}} className="font-semibold mb-2 text-sm font-medieval">O escribe tu propia acción:</h4>
        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative">
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Escribe tu acción..."
              disabled={disabled}
              className="w-full px-4 py-3 border-2 rounded-lg font-narrative placeholder-gray-500 focus:outline-none disabled:opacity-50 transition-all"
              style={{
                background: 'var(--c-bg)',
                borderColor: 'var(--c-border)',
                color: 'var(--c-text)'
              }}
            />
            <button
              type="submit"
              disabled={disabled || !action.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 btn-primary text-sm"
            >
              Actuar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 📜 LOG FEED MEJORADO con estilo pergamino
const LogFeed = ({ narrativeLog, gameMode = 'rpg' }) => {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [narrativeLog]);

  const getLogTitle = (mode) => {
    if (mode === 'sandbox') return 'Tu Historia';
    if (mode === 'campaign') return 'Crónica de la Aventura';
    return 'Registro de Eventos';
  };

  return (
    <div className="narrative-area">
      <h3 className="font-medieval text-lg mb-4" style={{color: 'var(--c-border)'}}>{getLogTitle(gameMode)}</h3>
      <div 
        ref={logRef}
        className="h-64 max-h-[50vh] overflow-y-auto scrollbar-thin"
      >
        {narrativeLog.length === 0 ? (
          <p className="italic" style={{color: 'var(--c-cedar)'}}>Tu historia comienza aquí...</p>
        ) : (
          narrativeLog.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="mb-4 border-b pb-3 last:border-b-0" style={{borderColor: 'rgba(140, 91, 44, 0.3)'}}>
              <p className="text-sm font-semibold mb-2 font-medieval" style={{color: 'var(--c-border)'}}>
                &gt; {entry.player_action}
              </p>
              <p className="narrative-text font-narrative">
                {entry.narrative}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 🎨 COMPONENTE SANDBOX CONCEPT-FIRST con nueva paleta
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
      <h2 className="text-4xl font-bold mb-4 font-medieval" style={{color: 'var(--c-border)'}}>
        Modo Sandbox - Historia Libre
      </h2>
      <p className="text-xl mb-8 font-narrative" style={{color: 'var(--c-text)'}}>
        Describe la historia que quieres vivir. Puede ser cualquier cosa: desde una aventura épica hasta una historia de la vida cotidiana con toques sobrenaturales.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-semibold mb-2 text-lg font-medieval" style={{color: 'var(--c-border)'}}>
            ¿Qué historia quieres contar?
          </label>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ejemplo: 'Quiero ser un detective paranormal investigando desapariciones misteriosas en una ciudad moderna' o 'Soy un mago aprendiz en una academia flotante llena de secretos'..."
            disabled={loading}
            rows={4}
            className="w-full px-4 py-3 border-2 rounded-lg font-narrative placeholder-gray-500 focus:outline-none disabled:opacity-50 resize-none"
            style={{
              background: 'var(--c-bg)',
              borderColor: 'var(--c-border)',
              color: 'var(--c-text)'
            }}
            required
            minLength={20}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || concept.trim().length < 20}
          className="btn-primary text-lg px-8 py-4"
        >
          {loading ? 'Creando tu historia...' : 'Comenzar Aventura'}
        </button>
      </form>
      
      <div className="mt-6 text-sm" style={{color: 'var(--c-cedar)'}}>
        <p>💡 <strong>Tip:</strong> Sé específico sobre el tipo de personaje, el mundo, y la situación inicial que te interesa.</p>
        <p className="mt-2">⚠️ <strong>Advertencia:</strong> Las decisiones peligrosas pueden tener consecuencias mortales.</p>
      </div>
    </div>
  );
};

// Componente para mostrar cambios de estado
const StateChangeNotification = ({ stateChanges, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!stateChanges || Object.keys(stateChanges).length === 0) return null;

  return (
    <div className="fixed top-4 right-4 hud-panel max-w-sm z-50 shadow-xl">
      <div className="flex justify-between items-start mb-2">
        <h4 style={{color: 'var(--c-border)'}} className="font-bold text-sm font-medieval">Cambios Detectados</h4>
        <button onClick={onClose} style={{color: 'var(--c-cedar)'}} className="hover:text-white">✕</button>
      </div>
      
      <div className="space-y-1 text-xs">
        {stateChanges.vitalDelta && Object.entries(stateChanges.vitalDelta).map(([vital, delta]) => (
          <div key={vital} className={delta > 0 ? 'text-green-600' : 'text-red-600'}>
            💗 {vital}: {delta > 0 ? '+' : ''}{delta}
          </div>
        ))}
        
        {stateChanges.statusSet && Object.entries(stateChanges.statusSet).map(([emotion, value]) => (
          <div key={emotion} className="text-purple-600">
            😊 {emotion}: {value}%
          </div>
        ))}
        
        {stateChanges.locationChange && (
          <div className="text-blue-600">
            📍 Ubicación: {stateChanges.locationChange}
          </div>
        )}
        
        {stateChanges.newSkill && stateChanges.newSkill.id && (
          <div style={{color: 'var(--c-emerald)'}}>
            ⭐ Nueva habilidad: {stateChanges.newSkill.id}
          </div>
        )}
        
        {stateChanges.resourceDelta && Object.entries(stateChanges.resourceDelta).map(([resource, delta]) => (
          <div key={resource} className={delta > 0 ? 'text-green-600' : 'text-red-600'}>
            💰 {resource}: {delta > 0 ? '+' : ''}{delta}
          </div>
        ))}
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
  const [gameOver, setGameOver] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

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
        setGameState(prevState => {
          if (!prevState || data.game_state.actionCount > prevState.actionCount) {
            return data.game_state;
          }
          return prevState;
        });
        
        if (data.suggested_actions) {
          setSuggestedActions(data.suggested_actions);
        }
        if (data.state_changes) {
          setStateChangeNotification(data.state_changes);
        }
        if (data.game_over) {
          setGameOver(true);
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
    setGameOver(false);
    
    try {
      const requestBody = {
        mode: selectedMode || 'sandbox'
      };
      
      if (selectedMode === 'campaign') {
        requestBody.campaign = campaignName || 'scenes_act1';
      }
      
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
      
      if (data.suggested_actions) {
        setSuggestedActions(data.suggested_actions);
      }
      
      if (socket) {
        socket.emit('join_session', { session_id: data.session_id });
      }

    } catch (err) {
      setError('Error al iniciar sesión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit player action
  const submitAction = async (action) => {
    if (!sessionId || loading || gameOver) return;

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
      
      if (data.success || data.game_over) {
        setGameState(data.game_state);
        
        if (data.suggested_actions) {
          setSuggestedActions(data.suggested_actions);
        }
        
        if (data.state_changes && Object.keys(data.state_changes).length > 0) {
          setStateChangeNotification(data.state_changes);
        }
        
        if (data.game_over) {
          setGameOver(true);
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
    <div className="min-h-screen main-background font-narrative">
      {/* State Change Notifications */}
      {stateChangeNotification && (
        <StateChangeNotification 
          stateChanges={stateChangeNotification} 
          onClose={() => setStateChangeNotification(null)} 
        />
      )}

      {/* Header */}
      <header className="border-b-2 hud-panel relative z-10 mb-6 rounded-none border-l-0 border-r-0 border-t-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-medieval tracking-wider" style={{color: 'var(--c-border)'}}>
              🔥 HELLBOUND RPG v2.0
            </h1>
            <div className="flex items-center space-x-4">
              {gameOver && (
                <div className="text-red-600 font-bold animate-pulse font-medieval">
                  💀 GAME OVER
                </div>
              )}
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm" style={{color: 'var(--c-cedar)'}}>
                {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="relative z-10 container mx-auto px-4">
        {!sessionId ? (
          // Start Screen
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            {!mode ? (
              <div className="text-center">
                <h2 className="text-5xl font-bold mb-4 font-medieval" style={{color: 'var(--c-border)'}}>
                  Bienvenido al Infierno
                </h2>
                <p className="text-xl mb-8 max-w-2xl font-narrative" style={{color: 'var(--c-text)'}}>
                  Elige tu camino en una aventura épica donde cada decisión forja tu destino. 
                  Tres modos diferentes te esperan para explorar mundos únicos.
                </p>
                <div className="w-full">
                  <ModeSelector onSelect={setMode} />
                </div>
              </div>
            ) : showSandboxForm && mode === 'sandbox' ? (
              <SandboxConceptForm 
                onSubmit={(concept) => startNewSession('sandbox', null, concept)}
                loading={loading}
              />
            ) : (
              <div className="text-center">
                <p className="text-lg mb-4 font-narrative" style={{color: 'var(--c-text)'}}>
                  Modo seleccionado: <span className="font-bold" style={{color: 'var(--c-border)'}}>
                    {mode === 'sandbox' ? 'Sandbox' : 
                     mode === 'campaign' ? 'Campaña' : 
                     'Campaña Temporal'}
                  </span>
                </p>
                <div className="space-y-4">
                  <button
                    onClick={() => startNewSession(mode, 'scenes_act1')}
                    disabled={loading}
                    className="btn-primary text-lg px-8 py-4"
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
                    className="block mx-auto btn-secondary text-sm"
                  >
                    Cambiar Modo
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Game Interface con nuevo layout
          <div className="game-layout">
            {/* Left Panel - HUD DINÁMICO */}
            <div className="space-y-4">
              {/* Vitales Dinámicos */}
              {gameState?.vitals && Object.keys(gameState.vitals).length > 0 && (
                <div className="hud-panel">
                  <h3>Estado Vital</h3>
                  <div className="space-y-3">
                    {Object.entries(gameState.vitals).map(([type, value]) => (
                      <StatOrb key={type} type={type} value={value} max={100} />
                    ))}
                  </div>
                </div>
              )}

              {/* Estados Emocionales Dinámicos */}
              {gameState?.emotionalStates && Object.entries(gameState.emotionalStates).some(([,v]) => v > 20) && (
                <div className="hud-panel">
                  <h3>Estado Mental</h3>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(gameState.emotionalStates).map(([emotion, value]) => (
                      <StatusChip key={emotion} label={emotion} value={value} />
                    ))}
                  </div>
                </div>
              )}

              {/* Habilidades Dinámicas */}
              <div className="hud-panel">
                <h3>{gameState?.mode === 'sandbox' ? 'Capacidades' : 'Habilidades'}</h3>
                <DynamicSkillBar skills={gameState?.skills || []} gameMode={gameState?.mode} />
              </div>

              {/* Recursos Dinámicos */}
              <ResourceGrid 
                title="Recursos" 
                data={gameState?.resources} 
              />

              {/* Atributos Dinámicos */}
              <ResourceGrid 
                title="Atributos" 
                data={gameState?.attributes} 
              />

              {/* Ubicación Dinámica */}
              {gameState?.location && (
                <div className="hud-panel">
                  <h3>{gameState?.mode === 'sandbox' ? 'Lugar Actual' : 'Ubicación'}</h3>
                  <p className="text-center" style={{color: 'var(--c-text)'}}>{gameState.location}</p>
                </div>
              )}
            </div>

            {/* Right Panel - Narrativa y Acciones */}
            <div className="space-y-4">
              {/* Log Feed */}
              <LogFeed 
                narrativeLog={gameState?.narrativeLog || []} 
                gameMode={gameState?.mode} 
              />

              {/* Action Input */}
              <div className="hud-panel">
                <h3>
                  {gameOver ? '💀 Partida Terminada' :
                   gameState?.mode === 'sandbox' ? '¿Qué haces ahora?' : '¿Qué harás?'}
                </h3>
                <ActionInput 
                  onSubmit={submitAction} 
                  disabled={loading} 
                  suggestedActions={suggestedActions}
                  gameOver={gameOver}
                />
                {loading && !gameOver && (
                  <p className="text-sm mt-2" style={{color: 'var(--c-border)'}}>
                    {gameState?.mode === 'sandbox' ? 
                      'Tu historia se está escribiendo...' : 
                      'El destino se está escribiendo...'}
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