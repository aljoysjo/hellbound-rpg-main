import React, { useState, useEffect, useRef } from 'react';
import './tokens.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';

// 🎮 HEADER COMPONENT
const GameHeader = ({ connectionStatus, gameOver }) => (
  <header className="panel" style={{ borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none', marginBottom: 'var(--space-lg)' }}>
    <div className="game-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', color: 'var(--color-primary)', fontWeight: '700' }}>
          🔥 HELLBOUND RPG v2.0
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          {gameOver && (
            <span style={{ color: 'var(--color-danger)', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>
              💀 GAME OVER
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '0.8rem' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connectionStatus === 'connected' ? 'var(--color-success)' : 'var(--color-danger)'
            }} />
            <span style={{ color: 'var(--text-medium)' }}>
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
      const canvas = canvasRef.current;
      
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#8C5E2A');
      gradient.addColorStop(1, '#5B3A1D');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Location text
      ctx.fillStyle = '#F3E7C6';
      ctx.font = 'bold 20px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(
        `🖼️ ILUSTRACIÓN AI: ${location || 'Ubicación Desconocida'}`,
        canvas.width / 2,
        canvas.height / 2 - 10
      );
      
      ctx.font = '14px Cormorant Garamond';
      ctx.fillText(
        `Modo: ${gameMode || 'RPG'} ${loading ? '(Generando...)' : ''}`,
        canvas.width / 2,
        canvas.height / 2 + 20
      );
    }
  }, [location, gameMode, loading]);

  return (
    <div className="canvas-container">
      <div className="panel" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="ai-canvas"
        />
        {loading && (
          <div style={{
            position: 'absolute',
            inset: '0',
            background: 'var(--bg-panel-dark)',
            borderRadius: 'var(--border-radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
            animation: 'pulse 2s infinite'
          }}>
            🎨 Generando ilustración...
          </div>
        )}
      </div>
    </div>
  );
};

// 📍 UBICACIÓN + STATS COMPACTOS
const CompactHUD = ({ gameState }) => {
  const vitals = gameState?.vitals || {};
  const emotionalStates = gameState?.emotionalStates || {};
  const location = gameState?.location;

  const activeEmotions = Object.entries(emotionalStates).filter(([, value]) => value > 20);

  const getEmotionIcon = (emotion) => {
    const icons = {
      miedo: '😰', alerta: '⚠️', euforia: '😄', fatiga: '😴', 
      ira: '😡', serenidad: '😌'
    };
    return icons[emotion] || '😐';
  };

  return (
    <div className="panel panel-dark panel-compact">
      {/* Ubicación */}
      {location && (
        <div className="location-compact">
          <span>📍</span>
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: '600' }}>{location}</span>
        </div>
      )}

      {/* Stats Vitales */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div className="panel-title">Estado Vital</div>
        {Object.entries(vitals).map(([type, value]) => {
          const icons = { health: '❤️', mana: '🔮', stamina: '⚡' };
          const percentage = (value / 100) * 100;
          
          return (
            <div key={type} className="stat-bar-container">
              <span className="stat-icon">{icons[type] || '📊'}</span>
              <span className="stat-name">{type}</span>
              <div className="stat-bar">
                <div 
                  className={`stat-fill ${type}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="stat-value">{value}%</span>
            </div>
          );
        })}
      </div>

      {/* Estados Emocionales */}
      {activeEmotions.length > 0 && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div className="panel-title">Estado Mental</div>
          <div className="emotion-list">
            {activeEmotions.map(([emotion, value]) => (
              <div key={emotion} className="emotion-item">
                <span className="emotion-icon">{getEmotionIcon(emotion)}</span>
                <span className="emotion-name">{emotion}</span>
                <span className="emotion-value">{Math.round(value)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Habilidades */}
      <div>
        <div className="panel-title">🎯 Habilidades</div>
        {(!gameState?.skills || gameState.skills.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
            Las habilidades aparecerán según tus acciones
          </div>
        ) : (
          <div className="skills-grid">
            {gameState.skills.slice(0, 6).map((skill, index) => (
              <div
                key={skill.id || index}
                className="skill-slot"
                title={skill.description || skill.id}
              >
                <div style={{ fontFamily: 'var(--font-title)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  {index + 1}
                </div>
                {skill.level && (
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-light)' }}>
                    Nv.{skill.level}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 🎯 OBJETIVOS SIDEBAR
const ObjectivesSidebar = ({ gameState }) => {
  // Objetivos simulados basados en el contexto de la campaña
  const defaultObjectives = [
    "Investigar la figura misteriosa",
    "Encontrar a los compañeros",
    "Explorar Alicante nevada"
  ];

  const objectives = gameState?.questObjectives || defaultObjectives.map(desc => ({ description: desc }));

  return (
    <div className="panel panel-dark panel-compact">
      <div className="panel-title">🎯 Objetivos</div>
      <div className="objectives-list">
        {objectives.slice(0, 4).map((objective, index) => (
          <div key={index} className="objective-item">
            <span className="objective-checkbox">☐</span>
            <span>{objective.description || objective}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🎒 INVENTARIO SIDEBAR
const InventorySidebar = ({ gameState }) => {
  // Items simulados - en el futuro vendrán del gameState
  const items = ['🗡️', '🛡️', '🧪', '📜', '💰', '🔑'];
  const emptySlots = 6 - items.length;

  return (
    <div className="panel panel-dark panel-compact">
      <div className="panel-title">🎒 Inventario</div>
      <div className="inventory-grid">
        {items.map((item, index) => (
          <div key={index} className="inventory-slot" title={`Item ${index + 1}`}>
            {item}
          </div>
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div key={`empty-${index}`} className="inventory-slot empty">
            •
          </div>
        ))}
      </div>
    </div>
  );
};

// 📜 NARRATIVA EXPANDIBLE
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
    <div className="narrative-panel">
      <div 
        className="narrative-header"
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <h3 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '1rem', fontWeight: '600' }}>
          📜 {getTitle(gameMode)}
        </h3>
        <span style={{ color: 'var(--color-primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>
      
      <div 
        ref={logRef}
        className={`narrative-content ${!isExpanded ? 'collapsed' : ''}`}
      >
        {narrativeLog.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Tu historia comienza aquí...
          </p>
        ) : (
          <div>
            {narrativeLog.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="narrative-entry">
                <p className="narrative-action">
                  ▶ {entry.player_action}
                </p>
                <p className="narrative-text">
                  {entry.narrative}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 🎮 INPUT GRANDE + ACCIONES RÁPIDAS
const ActionControls = ({ onSubmit, suggestedActions = [], disabled, loading }) => {
  const [action, setAction] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (action.trim() && !disabled && !loading) {
      onSubmit(action.trim());
      setAction('');
    }
  };

  const handleSuggestedAction = (suggestedAction) => {
    if (!disabled && !loading) {
      onSubmit(suggestedAction);
    }
  };

  const getActionIcon = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('atacar') || actionLower.includes('luchar')) return '⚔️';
    if (actionLower.includes('magia') || actionLower.includes('hechizo')) return '🔮';
    if (actionLower.includes('huir') || actionLower.includes('escapar')) return '🏃';
    if (actionLower.includes('buscar') || actionLower.includes('examinar') || actionLower.includes('observar')) return '👁️';
    if (actionLower.includes('hablar') || actionLower.includes('conversar')) return '🗣️';
    if (actionLower.includes('defender') || actionLower.includes('proteger')) return '🛡️';
    if (actionLower.includes('usar') || actionLower.includes('activar')) return '🎒';
    if (actionLower.includes('preparar') || actionLower.includes('ritual')) return '📿';
    if (actionLower.includes('salir') || actionLower.includes('moverse')) return '🚪';
    return '⚡';
  };

  return (
    <div>
      {/* Input Principal */}
      <form onSubmit={handleSubmit} className="action-input-container">
        <input
          type="text"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Escribe lo que quieres que suceda..."
          disabled={disabled || loading}
          className="action-input"
        />
        <button
          type="submit"
          disabled={disabled || loading || !action.trim()}
          className="action-button"
        >
          {loading ? '...' : 'ACTUAR'}
        </button>
      </form>

      {/* Acciones Rápidas */}
      {suggestedActions.length > 0 && (
        <div className="quick-actions">
          <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
            🎮 Acciones Rápidas:
          </h4>
          <div className="quick-actions-grid">
            {suggestedActions.slice(0, 6).map((suggestedAction, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedAction(suggestedAction)}
                disabled={disabled || loading}
                className="quick-action-btn"
              >
                <span className="quick-action-icon">{getActionIcon(suggestedAction)}</span>
                <span className="quick-action-text">{suggestedAction}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 🎨 FORMULARIO SANDBOX
const SandboxConceptForm = ({ onSubmit, loading }) => {
  const [concept, setConcept] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (concept.trim() && !loading) {
      onSubmit(concept.trim());
    }
  };

  return (
    <div className="game-container" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: 'var(--space-xl)' }}>
      <div className="panel" style={{ background: 'var(--bg-card)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--color-primary)', marginBottom: 'var(--space-lg)' }}>
          Modo Sandbox - Historia Libre
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-medium)', marginBottom: 'var(--space-xl)' }}>
          Describe la historia que quieres vivir. Desde aventuras épicas hasta historias cotidianas con toques sobrenaturales.
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ejemplo: 'Detective paranormal investigando desapariciones' o 'Mago aprendiz en academia flotante'..."
            disabled={loading}
            rows={4}
            style={{
              width: '100%',
              padding: 'var(--space-md)',
              border: 'var(--border-width) solid var(--color-primary)',
              borderRadius: 'var(--border-radius-lg)',
              background: 'var(--bg-card)',
              color: 'var(--text-dark)',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              resize: 'none'
            }}
            required
            minLength={20}
          />
          
          <button
            type="submit"
            disabled={loading || concept.trim().length < 20}
            className="action-button"
            style={{ alignSelf: 'center', fontSize: '1.1rem' }}
          >
            {loading ? 'Creando historia...' : 'Comenzar Aventura'}
          </button>
        </form>
      </div>
    </div>
  );
};

// 🎮 COMPONENTE PRINCIPAL
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

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <GameHeader connectionStatus={connectionStatus} gameOver={gameOver} />

      {!sessionId ? (
        // Pantalla de inicio
        <div className="game-container" style={{ paddingTop: 'var(--space-xl)' }}>
          {!mode ? (
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2.5rem', color: 'var(--color-primary)', marginBottom: 'var(--space-lg)' }}>
                Bienvenido al Infierno
              </h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-medium)', marginBottom: 'var(--space-xl)' }}>
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
            <div style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
              <div className="panel" style={{ background: 'var(--bg-card)' }}>
                <p style={{ fontSize: '1.1rem', color: 'var(--text-medium)', marginBottom: 'var(--space-lg)' }}>
                  Modo seleccionado: <span style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)' }}>
                    {mode === 'sandbox' ? 'Sandbox' : 
                     mode === 'campaign' ? 'Campaña' : 
                     'Campaña Temporal'}
                  </span>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <button
                    onClick={() => startNewSession(mode, 'scenes_act1')}
                    disabled={loading}
                    className="action-button"
                    style={{ fontSize: '1.1rem' }}
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
                    style={{
                      background: 'var(--color-secondary)',
                      color: 'var(--text-light)',
                      border: 'none',
                      padding: 'var(--space-sm) var(--space-md)',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer'
                    }}
                  >
                    Cambiar Modo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : gameOver ? (
        // Game Over
        <div className="game-container" style={{ paddingTop: 'var(--space-xl)' }}>
          <div className="panel" style={{ background: 'var(--bg-card)', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', color: 'var(--color-danger)', marginBottom: 'var(--space-md)' }}>
              💀 GAME OVER 💀
            </h3>
            <p style={{ color: 'var(--text-medium)', marginBottom: 'var(--space-lg)' }}>
              Tu aventura ha llegado a su fin. ¿Quieres intentarlo de nuevo?
            </p>
            <button
              onClick={() => window.location.reload()}
              className="action-button"
              style={{ fontSize: '1.1rem' }}
            >
              Reiniciar Partida
            </button>
          </div>
        </div>
      ) : (
        // Interfaz del juego
        <div className="game-container">
          <div className="game-grid">
            {/* HUD Izquierdo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <CompactHUD gameState={gameState} />
            </div>

            {/* Contenido Central */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
              <ActionControls 
                onSubmit={submitAction} 
                suggestedActions={suggestedActions}
                disabled={loading || gameOver} 
                loading={loading}
              />
            </div>

            {/* Sidebar Derecho */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <ObjectivesSidebar gameState={gameState} />
              <InventorySidebar gameState={gameState} />
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--space-md)',
          right: 'var(--space-md)',
          background: 'var(--color-danger)',
          color: 'var(--text-light)',
          padding: 'var(--space-md)',
          borderRadius: 'var(--border-radius)',
          zIndex: '50',
          maxWidth: '300px',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default App;