import React, { useState, useEffect, useRef } from 'react';
import './tokens.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';

// 🎯 COMPONENTE STAT ORB - Mobile First
const StatOrb = ({ type, value, max = 100 }) => {
  const getStatConfig = (statType) => {
    const configs = {
      health: { icon: '❤️', class: 'health' },
      mana: { icon: '🔮', class: 'mana' },
      stamina: { icon: '⚡', class: 'stamina' },
      default: { icon: '📊', class: 'default' }
    };
    return configs[statType] || configs.default;
  };

  const config = getStatConfig(type);
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="stat-orb">
      <div className="stat-header">
        <span className="stat-name">
          <span>{config.icon}</span>
          <span>{type}</span>
        </span>
        <span>{value}/{max}</span>
      </div>
      <div className="stat-bar-container">
        <div 
          className={`stat-bar ${config.class}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 🏷️ COMPONENTE EMOTION CHIP - Mobile First
const EmotionChip = ({ label, value }) => {
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
      <span>{label}</span>
      <span>{Math.round(value)}</span>
    </div>
  );
};

// 📊 COMPONENTE RESOURCE GRID - Mobile First
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
    <div className="panel">
      <h3 className="panel-title">{title}</h3>
      <div className="resource-grid">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="resource-item">
            <span className="resource-label">
              <span>{getIcon(key)}</span>
              <span>{key}</span>
            </span>
            <span className="resource-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🎯 COMPONENTE SKILLS - Mobile First
const SkillsGrid = ({ skills = [], gameMode = 'rpg' }) => {
  if (skills.length === 0) {
    const placeholder = gameMode === 'sandbox' ? 
      'Las habilidades emergerán según tus acciones' : 
      'Sin habilidades específicas';
    
    return (
      <div className="panel">
        <h3 className="panel-title">{gameMode === 'sandbox' ? 'Capacidades' : 'Habilidades'}</h3>
        <div style={{ textAlign: 'center', padding: '1rem', fontStyle: 'italic', color: 'var(--c-cedar)' }}>
          {placeholder}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3 className="panel-title">{gameMode === 'sandbox' ? 'Capacidades' : 'Habilidades'}</h3>
      <div className="skills-grid">
        {skills.map((skill, index) => (
          <div key={skill.id || index} className="skill-slot" title={skill.description || skill.id || skill}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 'bold', color: 'var(--c-border)' }}>
                {index + 1}
              </div>
              {skill.level && (
                <div style={{ fontSize: '0.5rem', color: 'var(--c-text)' }}>
                  Nv.{skill.level}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 📜 COMPONENTE NARRATIVA - Mobile First
const NarrativeArea = ({ narrativeLog, gameMode }) => {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [narrativeLog]);

  const getTitle = (mode) => {
    if (mode === 'sandbox') return 'Tu Historia';
    if (mode === 'campaign') return 'Crónica de la Aventura';
    return 'Registro de Eventos';
  };

  return (
    <div className="narrative-area">
      <h3 className="panel-title">{getTitle(gameMode)}</h3>
      <div ref={logRef} className="narrative-log">
        {narrativeLog.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: 'var(--c-cedar)', textAlign: 'center' }}>
            Tu historia comienza aquí...
          </p>
        ) : (
          narrativeLog.map((entry, index) => (
            <div key={`${entry.timestamp}-${index}`} className="narrative-entry">
              <p className="player-action">
                &gt; {entry.player_action}
              </p>
              <p className="narrative-text">
                {entry.narrative}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 🎮 COMPONENTE ACCIONES SUGERIDAS - Mobile First
const SuggestedActions = ({ actions, onAction, disabled }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div>
      <h4 className="panel-title" style={{ marginBottom: 'var(--spacing-sm)', fontSize: '0.875rem' }}>
        Acciones Sugeridas:
      </h4>
      <div className="suggested-actions">
        {actions.slice(0, 4).map((action, index) => (
          <button
            key={index}
            onClick={() => onAction(action)}
            disabled={disabled}
            className="btn-suggested"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
};

// 🎨 COMPONENTE SANDBOX FORM - Mobile First
const SandboxConceptForm = ({ onSubmit, loading }) => {
  const [concept, setConcept] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (concept.trim() && !loading) {
      onSubmit(concept.trim());
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
      <h2 style={{ fontSize: '2rem', fontFamily: 'var(--font-title)', color: 'var(--c-border)', marginBottom: 'var(--spacing-lg)' }}>
        Modo Sandbox - Historia Libre
      </h2>
      <p style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-xl)', color: 'var(--c-text)' }}>
        Describe la historia que quieres vivir. Cualquier cosa: aventura épica, vida cotidiana con toques sobrenaturales...
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div>
          <label style={{ display: 'block', fontFamily: 'var(--font-title)', color: 'var(--c-border)', marginBottom: 'var(--spacing-sm)' }}>
            ¿Qué historia quieres contar?
          </label>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ejemplo: 'Detective paranormal investigando desapariciones' o 'Mago aprendiz en academia flotante'..."
            disabled={loading}
            rows={4}
            style={{
              width: '100%',
              padding: 'var(--spacing-md)',
              border: '2px solid var(--c-border)',
              borderRadius: '8px',
              background: 'var(--c-bg)',
              color: 'var(--c-text)',
              fontFamily: 'var(--font-body)',
              resize: 'none'
            }}
            required
            minLength={20}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || concept.trim().length < 20}
          className="btn-action"
          style={{ alignSelf: 'center', fontSize: '1.1rem' }}
        >
          {loading ? 'Creando historia...' : 'Comenzar Aventura'}
        </button>
      </form>
    </div>
  );
};

// 🔔 COMPONENTE NOTIFICACIÓN - Mobile First
const StateChangeNotification = ({ stateChanges, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!stateChanges || Object.keys(stateChanges).length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: 'var(--spacing-md)',
      background: 'var(--c-panel)',
      border: '2px solid var(--c-border)',
      borderRadius: '8px',
      padding: 'var(--spacing-md)',
      maxWidth: '280px',
      zIndex: 60,
      fontSize: '0.75rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
        <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--c-border)', fontSize: '0.875rem' }}>
          Cambios Detectados
        </h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-cedar)', cursor: 'pointer' }}>
          ✕
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {stateChanges.vitalDelta && Object.entries(stateChanges.vitalDelta).map(([vital, delta]) => (
          <div key={vital} style={{ color: delta > 0 ? '#22c55e' : '#ef4444' }}>
            💗 {vital}: {delta > 0 ? '+' : ''}{delta}
          </div>
        ))}
        
        {stateChanges.newSkill && stateChanges.newSkill.id && (
          <div style={{ color: 'var(--c-emerald)' }}>
            ⭐ Nueva habilidad: {stateChanges.newSkill.id}
          </div>
        )}
      </div>
    </div>
  );
};

// 🎮 COMPONENTE PRINCIPAL - Mobile First
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
  const [action, setAction] = useState('');

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
  const submitAction = async (actionText) => {
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

  const handleActionSubmit = (e) => {
    e.preventDefault();
    if (action.trim()) {
      submitAction(action.trim());
      setAction('');
    }
  };

  const handleSuggestedAction = (suggestedAction) => {
    submitAction(suggestedAction);
  };

  return (
    <div className="app-container">
      {/* State Change Notifications */}
      {stateChangeNotification && (
        <StateChangeNotification 
          stateChanges={stateChangeNotification} 
          onClose={() => setStateChangeNotification(null)} 
        />
      )}

      {/* Header fijo */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-logo">🔥 HELLBOUND RPG v2.0</h1>
          <div className="connection-status">
            {gameOver && (
              <span style={{ color: '#ef4444', fontWeight: 'bold', marginRight: 'var(--spacing-sm)' }}>
                💀 GAME OVER
              </span>
            )}
            <div className={`status-dot ${connectionStatus === 'connected' ? 'connected' : ''}`} />
            <span>{connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}</span>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      {!sessionId ? (
        // Pantalla de inicio
        <div style={{ padding: 'var(--spacing-lg)', minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!mode ? (
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <h2 style={{ fontSize: '2.5rem', fontFamily: 'var(--font-title)', color: 'var(--c-border)', marginBottom: 'var(--spacing-lg)' }}>
                Bienvenido al Infierno
              </h2>
              <p style={{ fontSize: '1.2rem', marginBottom: 'var(--spacing-xl)', color: 'var(--c-text)' }}>
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
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-lg)', color: 'var(--c-text)' }}>
                Modo seleccionado: <span style={{ fontFamily: 'var(--font-title)', color: 'var(--c-border)' }}>
                  {mode === 'sandbox' ? 'Sandbox' : mode === 'campaign' ? 'Campaña' : 'Campaña Temporal'}
                </span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                <button
                  onClick={() => startNewSession(mode, 'scenes_act1')}
                  disabled={loading}
                  className="btn-action"
                  style={{ fontSize: '1.1rem' }}
                >
                  {loading ? 'Iniciando...' : `Iniciar ${mode === 'sandbox' ? 'Sandbox' : mode === 'campaign' ? 'Campaña' : 'Campaña Temporal'}`}
                </button>
                <button
                  onClick={() => {
                    setMode(null);
                    setShowSandboxForm(false);
                  }}
                  disabled={loading}
                  style={{
                    background: 'var(--c-cedar)',
                    color: 'var(--c-bg)',
                    border: 'none',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cambiar Modo
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Interfaz del juego - Mobile First Layout
        <div className="game-layout">
          {/* Contenido principal */}
          <div className="main-content">
            {/* Área de ilustración AI (solo desktop) */}
            <div className="illustration-area">
              <span>Ilustración AI generada según ubicación y contexto</span>
            </div>

            {/* Narrativa */}
            <NarrativeArea 
              narrativeLog={gameState?.narrativeLog || []} 
              gameMode={gameState?.mode} 
            />

            {/* Acciones sugeridas */}
            <SuggestedActions 
              actions={suggestedActions}
              onAction={handleSuggestedAction}
              disabled={loading || gameOver}
            />

            {/* Barra de acción */}
            {gameOver ? (
              <div className="panel" style={{ textAlign: 'center', background: 'rgba(220, 38, 38, 0.1)', borderColor: '#dc2626' }}>
                <h3 style={{ color: '#dc2626', marginBottom: 'var(--spacing-md)' }}>💀 GAME OVER 💀</h3>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>Tu aventura ha llegado a su fin. ¿Quieres intentarlo de nuevo?</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-action"
                >
                  Reiniciar Partida
                </button>
              </div>
            ) : (
              <div className="action-bar">
                <form onSubmit={handleActionSubmit} className="action-input-container">
                  <input
                    type="text"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="Escribe tu acción..."
                    disabled={loading}
                    className="action-input"
                  />
                  <button
                    type="submit"
                    disabled={loading || !action.trim()}
                    className="btn-action"
                  >
                    {loading ? (
                      <span className="loading-pulse">...</span>
                    ) : (
                      'Actuar'
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar HUD */}
          <div className="hud-sidebar">
            {/* Vitales */}
            {gameState?.vitals && Object.keys(gameState.vitals).length > 0 && (
              <div className="panel">
                <h3 className="panel-title">Estado Vital</h3>
                {Object.entries(gameState.vitals).map(([type, value]) => (
                  <StatOrb key={type} type={type} value={value} max={100} />
                ))}
              </div>
            )}

            {/* Estados emocionales */}
            {gameState?.emotionalStates && Object.entries(gameState.emotionalStates).some(([,v]) => v > 20) && (
              <div className="panel">
                <h3 className="panel-title">Estado Mental</h3>
                <div className="emotion-chips">
                  {Object.entries(gameState.emotionalStates).map(([emotion, value]) => (
                    <EmotionChip key={emotion} label={emotion} value={value} />
                  ))}
                </div>
              </div>
            )}

            {/* Habilidades */}
            <SkillsGrid skills={gameState?.skills || []} gameMode={gameState?.mode} />

            {/* Recursos */}
            <ResourceGrid title="Recursos" data={gameState?.resources} />

            {/* Atributos */}
            <ResourceGrid title="Atributos" data={gameState?.attributes} />

            {/* Ubicación */}
            {gameState?.location && (
              <div className="panel">
                <h3 className="panel-title">{gameState?.mode === 'sandbox' ? 'Lugar Actual' : 'Ubicación'}</h3>
                <p style={{ textAlign: 'center', color: 'var(--c-text)' }}>{gameState.location}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--spacing-md)',
          right: 'var(--spacing-md)',
          background: '#ef4444',
          color: 'white',
          padding: 'var(--spacing-md)',
          borderRadius: '8px',
          zIndex: 50,
          maxWidth: '300px',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default App;