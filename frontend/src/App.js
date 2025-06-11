import React, { useState, useEffect, useRef } from 'react';
import './tokens.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';

// 🎮 HEADER COMPONENT
const GameHeader = ({ connectionStatus, gameOver }) => (
  <header className="bg-panel-light border-b-2 border-primary sticky top-0 z-50">
    <div className="container">
      <div className="flex items-center justify-between py-4">
        <h1 className="text-title text-2xl md:text-3xl text-primary">
          🔥 HELLBOUND RPG v2.0
        </h1>
        <div className="flex items-center gap-4">
          {gameOver && (
            <span className="text-danger font-bold animate-pulse">
              💀 GAME OVER
            </span>
          )}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'connected' ? 'bg-success' : 'bg-danger'
            }`} />
            <span className="text-medium hidden sm:inline">
              {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  </header>
);

// 🎨 AI CANVAS COMPONENT
const AICanvas = ({ location, gameMode, loading }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      // Placeholder background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvasRef.current.height);
      gradient.addColorStop(0, '#8C5E2A');
      gradient.addColorStop(1, '#5B3A1D');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Add location text
      ctx.fillStyle = '#F3E7C6';
      ctx.font = '24px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(
        `🖼️ Ilustración AI: ${location || 'Ubicación Desconocida'}`,
        canvasRef.current.width / 2,
        canvasRef.current.height / 2 - 10
      );
      ctx.font = '16px Cormorant Garamond';
      ctx.fillText(
        `Modo: ${gameMode || 'RPG'} ${loading ? '(Generando...)' : ''}`,
        canvasRef.current.width / 2,
        canvasRef.current.height / 2 + 20
      );
    }
  }, [location, gameMode, loading]);

  return (
    <div className="panel col-span-full lg:col-span-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-auto rounded-lg border-2 border-primary"
          style={{ aspectRatio: '16/9' }}
        />
        {loading && (
          <div className="absolute inset-0 bg-panel-dark rounded-lg flex items-center justify-center">
            <div className="text-light animate-pulse">🎨 Generando ilustración...</div>
          </div>
        )}
      </div>
    </div>
  );
};

// 💗 STAT ORBS COMPONENT
const StatOrbs = ({ vitals = {} }) => {
  const getOrbConfig = (type) => {
    const configs = {
      health: { icon: '❤️', color: 'text-red-500', bgColor: 'from-red-500 to-red-700' },
      mana: { icon: '🔮', color: 'text-blue-500', bgColor: 'from-blue-500 to-blue-700' },
      stamina: { icon: '⚡', color: 'text-green-500', bgColor: 'from-green-500 to-green-700' }
    };
    return configs[type] || configs.health;
  };

  return (
    <div className="panel panel-dark">
      <h3 className="panel-title text-light">Estado Vital</h3>
      <div className="space-y-4">
        {Object.entries(vitals).map(([type, value]) => {
          const config = getOrbConfig(type);
          const percentage = (value / 100) * 100;
          
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between text-light">
                <span className="flex items-center gap-2 font-title">
                  <span>{config.icon}</span>
                  <span className="capitalize">{type}</span>
                </span>
                <span className="font-bold">{value}/100</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 border border-primary">
                <div
                  className={`bg-gradient-to-r ${config.bgColor} h-3 rounded-full transition-all duration-500 border-r border-gray-600`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 😊 EMOTION CHIPS COMPONENT
const EmotionChips = ({ emotionalStates = {} }) => {
  const activeEmotions = Object.entries(emotionalStates).filter(([, value]) => value > 20);
  
  if (activeEmotions.length === 0) return null;

  const getEmotionConfig = (emotion, value) => {
    const configs = {
      miedo: { icon: '😰', color: 'bg-red-100 text-red-800 border-red-300' },
      alerta: { icon: '⚠️', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      euforia: { icon: '😄', color: 'bg-green-100 text-green-800 border-green-300' },
      fatiga: { icon: '😴', color: 'bg-gray-100 text-gray-800 border-gray-300' },
      ira: { icon: '😡', color: 'bg-red-100 text-red-800 border-red-300' },
      serenidad: { icon: '😌', color: 'bg-blue-100 text-blue-800 border-blue-300' }
    };
    return configs[emotion] || configs.serenidad;
  };

  return (
    <div className="panel panel-dark">
      <h3 className="panel-title text-light">Estado Mental</h3>
      <div className="flex flex-wrap gap-2">
        {activeEmotions.map(([emotion, value]) => {
          const config = getEmotionConfig(emotion, value);
          return (
            <div
              key={emotion}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-medium ${config.color}`}
            >
              <span>{config.icon}</span>
              <span className="capitalize">{emotion}</span>
              <span className="font-bold">{Math.round(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 🎯 SKILLS GRID COMPONENT
const SkillsGrid = ({ skills = [] }) => {
  if (skills.length === 0) {
    return (
      <div className="panel panel-dark">
        <h3 className="panel-title text-light">Habilidades</h3>
        <div className="text-center py-8 text-light opacity-75 italic">
          Las habilidades aparecerán según tus acciones
        </div>
      </div>
    );
  }

  return (
    <div className="panel panel-dark">
      <h3 className="panel-title text-light">Habilidades</h3>
      <div className="grid grid-cols-3 gap-3">
        {skills.slice(0, 6).map((skill, index) => (
          <div
            key={skill.id || index}
            className="relative group bg-primary bg-opacity-20 border border-primary rounded-lg p-3 hover:bg-opacity-30 transition-all cursor-pointer"
            title={skill.description || skill.id}
          >
            <div className="text-center">
              <div className="text-primary font-title font-bold text-sm">
                {index + 1}
              </div>
              {skill.level && (
                <div className="text-light text-xs">
                  Nv.{skill.level}
                </div>
              )}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-panel-dark text-light text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
              {typeof skill === 'object' ? skill.id : skill}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 📜 NARRATIVE PANEL COMPONENT
const NarrativePanel = ({ narrativeLog = [], gameMode, isExpanded, onToggle }) => {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current && isExpanded) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [narrativeLog, isExpanded]);

  const getTitle = (mode) => {
    switch (mode) {
      case 'sandbox': return 'Tu Historia';
      case 'campaign': return 'Crónica de la Aventura';
      default: return 'Registro de Eventos';
    }
  };

  return (
    <div className="panel bg-card col-span-full">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <h3 className="panel-title text-dark">{getTitle(gameMode)}</h3>
        <span className="text-primary text-xl font-bold lg:hidden">
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-96' : 'max-h-24 lg:max-h-96'
        }`}
      >
        <div 
          ref={logRef}
          className="custom-scrollbar overflow-y-auto"
          style={{ maxHeight: isExpanded ? '300px' : '80px' }}
        >
          {narrativeLog.length === 0 ? (
            <p className="text-center py-8 text-muted italic">
              Tu historia comienza aquí...
            </p>
          ) : (
            <div className="space-y-4">
              {narrativeLog.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="border-b border-gray-200 pb-3 last:border-b-0">
                  <p className="text-primary font-title font-semibold mb-2 text-sm">
                    ▶ {entry.player_action}
                  </p>
                  <p className="text-dark leading-relaxed">
                    {entry.narrative}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 🎮 ACTION INPUT COMPONENT
const ActionInput = ({ onSubmit, disabled, loading }) => {
  const [action, setAction] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (action.trim() && !disabled && !loading) {
      onSubmit(action.trim());
      setAction('');
    }
  };

  return (
    <div className="panel col-span-full">
      <form onSubmit={handleSubmit} className="flex gap-4">
        <input
          type="text"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Escribe lo que quieres que suceda..."
          disabled={disabled || loading}
          className="flex-1 px-4 py-3 border-2 border-primary rounded-lg bg-card text-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || loading || !action.trim()}
          className="btn btn-primary px-8 py-3 text-lg font-bold"
        >
          {loading ? (
            <span className="animate-pulse">...</span>
          ) : (
            'ACTUAR'
          )}
        </button>
      </form>
    </div>
  );
};

// 🗡️ ACTION BUTTONS COMPONENT
const ActionButtons = ({ suggestedActions = [], onAction, disabled }) => {
  const actionIcons = {
    'atacar': '⚔️', 'magia': '🔮', 'huir': '🏃', 'buscar': '👁️', 
    'hablar': '🗣️', 'defender': '🛡️', 'examinar': '🔍', 'usar': '🎒'
  };

  const getActionIcon = (action) => {
    const actionLower = action.toLowerCase();
    for (const [key, icon] of Object.entries(actionIcons)) {
      if (actionLower.includes(key)) return icon;
    }
    return '⚡';
  };

  if (suggestedActions.length === 0) return null;

  return (
    <div className="panel col-span-full">
      <h3 className="panel-title text-dark mb-4">Acciones Rápidas</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {suggestedActions.slice(0, 6).map((action, index) => (
          <button
            key={index}
            onClick={() => onAction(action)}
            disabled={disabled}
            className="btn btn-secondary flex-col h-20 text-sm hover:bg-primary hover:text-dark transition-all"
          >
            <span className="text-2xl mb-1">{getActionIcon(action)}</span>
            <span className="text-center leading-tight">{action}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// 📦 SIDEBAR COMPONENT
const Sidebar = ({ gameState }) => {
  return (
    <div className="space-y-6">
      {/* Inventario Placeholder */}
      <div className="panel panel-dark">
        <h3 className="panel-title text-light">Inventario</h3>
        <div className="text-center py-4 text-light opacity-75 italic text-sm">
          Los objetos aparecerán aquí
        </div>
      </div>

      {/* Objetivos Placeholder */}
      <div className="panel panel-dark">
        <h3 className="panel-title text-light">Objetivos</h3>
        <div className="text-light text-sm space-y-2">
          {gameState?.questObjectives?.slice(0, 3).map((objective, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-primary">□</span>
              <span>{objective.description}</span>
            </div>
          )) || (
            <div className="text-center py-4 opacity-75 italic">
              Sin objetivos activos
            </div>
          )}
        </div>
      </div>

      {/* Ubicación */}
      {gameState?.location && (
        <div className="panel panel-dark">
          <h3 className="panel-title text-light">Ubicación</h3>
          <div className="text-center">
            <span className="text-light text-lg">📍 {gameState.location}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// 🎮 MAIN APP COMPONENT
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
  const [gameOver, setGameOver] = useState(false);
  const [narrativeExpanded, setNarrativeExpanded] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

  // Socket initialization
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
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
        if (data.game_over) {
          setGameOver(true);
        }
      }
    });

    return () => newSocket.close();
  }, [BACKEND_URL, sessionId]);

  // Start new session
  const startNewSession = async (selectedMode = mode, campaignName, sandboxConcept) => {
    setLoading(true);
    setError(null);
    setGameOver(false);
    
    try {
      const requestBody = { mode: selectedMode || 'sandbox' };
      
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
        headers: { 'Content-Type': 'application/json' },
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

  // Submit action
  const submitAction = async (actionText) => {
    if (!sessionId || loading || gameOver) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/free_input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: actionText
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

  // Sandbox concept form
  const SandboxConceptForm = ({ onSubmit, loading }) => {
    const [concept, setConcept] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (concept.trim() && !loading) {
        onSubmit(concept.trim());
      }
    };

    return (
      <div className="container max-w-2xl mx-auto py-12">
        <div className="panel bg-card text-center">
          <h2 className="text-title text-3xl text-primary mb-6">
            Modo Sandbox - Historia Libre
          </h2>
          <p className="text-lg text-medium mb-8">
            Describe la historia que quieres vivir. Desde aventuras épicas hasta historias cotidianas con toques sobrenaturales.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ejemplo: 'Detective paranormal investigando desapariciones' o 'Mago aprendiz en academia flotante'..."
              disabled={loading}
              rows={4}
              className="w-full px-4 py-3 border-2 border-primary rounded-lg bg-card text-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              required
              minLength={20}
            />
            
            <button
              type="submit"
              disabled={loading || concept.trim().length < 20}
              className="btn btn-primary text-lg px-8 py-4"
            >
              {loading ? 'Creando historia...' : 'Comenzar Aventura'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <GameHeader connectionStatus={connectionStatus} gameOver={gameOver} />

      {!sessionId ? (
        // Start Screen
        <div className="container py-12">
          {!mode ? (
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-title text-4xl text-primary mb-6">
                Bienvenido al Infierno
              </h2>
              <p className="text-xl text-medium mb-8">
                Elige tu camino en una aventura épica donde cada decisión forja tu destino.
              </p>
              <ModeSelector onSelect={setMode} />
            </div>
          ) : showSandboxForm && mode === 'sandbox' ? (
            <SandboxConceptForm 
              onSubmit={(concept) => startNewSession('sandbox', null, concept)}
              loading={loading}
            />
          ) : (
            <div className="text-center max-w-xl mx-auto">
              <div className="panel bg-card">
                <p className="text-lg text-medium mb-6">
                  Modo seleccionado: <span className="text-title text-primary">
                    {mode === 'sandbox' ? 'Sandbox' : 
                     mode === 'campaign' ? 'Campaña' : 
                     'Campaña Temporal'}
                  </span>
                </p>
                <div className="space-y-4">
                  <button
                    onClick={() => startNewSession(mode, 'scenes_act1')}
                    disabled={loading}
                    className="btn btn-primary text-lg px-8 py-4 w-full"
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
                    className="btn btn-secondary px-4 py-2"
                  >
                    Cambiar Modo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : gameOver ? (
        // Game Over Screen
        <div className="container py-12">
          <div className="panel bg-card text-center max-w-xl mx-auto">
            <h3 className="text-title text-2xl text-danger mb-4">💀 GAME OVER 💀</h3>
            <p className="text-medium mb-6">Tu aventura ha llegado a su fin. ¿Quieres intentarlo de nuevo?</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary text-lg px-8 py-4"
            >
              Reiniciar Partida
            </button>
          </div>
        </div>
      ) : (
        // Game Interface
        <div className="container py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - HUD */}
            <div className="lg:col-span-1 space-y-6">
              <StatOrbs vitals={gameState?.vitals} />
              <EmotionChips emotionalStates={gameState?.emotionalStates} />
              <SkillsGrid skills={gameState?.skills} />
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              <AICanvas 
                location={gameState?.location} 
                gameMode={gameState?.mode}
                loading={loading}
              />
              <NarrativePanel 
                narrativeLog={gameState?.narrativeLog} 
                gameMode={gameState?.mode}
                isExpanded={narrativeExpanded}
                onToggle={() => setNarrativeExpanded(!narrativeExpanded)}
              />
              <ActionInput 
                onSubmit={submitAction} 
                disabled={loading || gameOver} 
                loading={loading}
              />
              <ActionButtons 
                suggestedActions={suggestedActions}
                onAction={submitAction}
                disabled={loading || gameOver}
              />
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-1">
              <Sidebar gameState={gameState} />
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-danger text-light px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  );
}

export default App;