import React, { useState, useEffect, useRef, useCallback } from 'react';
import './tokens.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';
import StoryInput from './components/StoryInput';

// 🎮 MAIN APP COMPONENT - UX REORGANIZADA CON BARRA POPUPS UNIFICADA
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
  
  // UI States - REORGANIZADO
  const [narrativeVisible, setNarrativeVisible] = useState(true);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showEmotionsModal, setShowEmotionsModal] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);

  // BADGES para notificaciones
  const [newItems, setNewItems] = useState(0);
  const [newObjectives, setNewObjectives] = useState(0);
  const [newSkills, setNewSkills] = useState(0);
  const [newEmotions, setNewEmotions] = useState(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
  const fadeTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-fade narrativa después de 5 segundos
  useEffect(() => {
    if (narrativeVisible && gameState?.narrativeLog?.length > 0) {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
      fadeTimeoutRef.current = setTimeout(() => {
        setNarrativeVisible(false);
      }, 5000);
    }
    
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [narrativeVisible, gameState?.narrativeLog]);

  // Socket initialization - OPTIMIZADO
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
            setNarrativeVisible(true);
            
            // BADGES AUTOMÁTICOS - detectar cambios
            if (prevState) {
              // Nuevos items
              const prevItems = prevState.inventory?.length || 0;
              const newItemsCount = data.game_state.inventory?.length || 0;
              if (newItemsCount > prevItems) {
                setNewItems(prev => prev + (newItemsCount - prevItems));
              }

              // Nuevos objetivos
              const prevObjectives = prevState.questObjectives?.length || 0;
              const newObjectivesCount = data.game_state.questObjectives?.length || 0;
              if (newObjectivesCount > prevObjectives) {
                setNewObjectives(prev => prev + (newObjectivesCount - prevObjectives));
              }

              // Nuevas skills
              const prevSkills = prevState.skills?.length || 0;
              const newSkillsCount = data.game_state.skills?.length || 0;
              if (newSkillsCount > prevSkills) {
                setNewSkills(prev => prev + (newSkillsCount - prevSkills));
              }
            }
            
            return data.game_state;
          }
          return prevState;
        });
        
        if (data.suggested_actions) {
          setSuggestedActions(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(data.suggested_actions)) {
              return data.suggested_actions;
            }
            return prev;
          });
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
      setNarrativeVisible(true);
      
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

  // Submit action - OPTIMIZADO
  const submitAction = useCallback(async (actionText) => {
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
        setNarrativeVisible(true);
        
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
  }, [sessionId, loading, gameOver, BACKEND_URL]);

  const handleSuggestedAction = useCallback((suggestedAction) => {
    submitAction(suggestedAction);
  }, [submitAction]);

  // HELPER: input.blur() antes de abrir popups
  const blurInput = () => {
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Modal handlers CON BLUR Y BADGE RESET
  const toggleObjectives = (e) => {
    e.preventDefault();
    e.stopPropagation();
    blurInput();
    setShowObjectives(!showObjectives);
    if (!showObjectives) setNewObjectives(0); // Reset badge
  };

  const toggleInventory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    blurInput();
    setShowInventory(!showInventory);
    if (!showInventory) setNewItems(0); // Reset badge
  };

  const toggleSkills = (e) => {
    e.preventDefault();
    e.stopPropagation();
    blurInput();
    setShowSkills(!showSkills);
    if (!showSkills) setNewSkills(0); // Reset badge
  };

  const toggleEmotionsModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    blurInput();
    setShowEmotionsModal(!showEmotionsModal);
    if (!showEmotionsModal) setNewEmotions(0); // Reset badge
  };

  const toggleNarrativeModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    blurInput();
    setShowNarrativeModal(!showNarrativeModal);
  };

  const toggleNarrativeVisible = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (narrativeVisible) {
      // Si está visible, abrir modal completo
      toggleNarrativeModal(e);
    } else {
      // Si no está visible, mostrar overlay
      setNarrativeVisible(true);
    }
  };

  // Helper functions
  const getActionIcon = (action) => {
    if (!action) return '⚡';
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

  const getEmotionIcon = (emotion) => {
    const icons = {
      miedo: '😰', alerta: '⚠️', euforia: '😄', fatiga: '😴', 
      ira: '😡', serenidad: '😌'
    };
    return icons[emotion] || '😐';
  };

  // CRITICAL FIX: getSkillIcon con verificación robusta
  const getSkillIcon = (skill) => {
    const skillName = (skill?.id || skill || '').toString().toLowerCase();
    if (!skillName) return '✨';
    
    if (skillName.includes('exorcismo')) return '🔥';
    if (skillName.includes('percep')) return '⚡';
    if (skillName.includes('combate')) return '⚔️';
    if (skillName.includes('magia')) return '🔮';
    if (skillName.includes('social')) return '🗣️';
    return '✨';
  };

  // Canvas - UN SOLO PERGAMINO INTELIGENTE
  const IntegratedCanvas = () => {
    const canvasRef = useRef(null);
    
    useEffect(() => {
      if (canvasRef.current && gameState) {
        const ctx = canvasRef.current.getContext('2d');
        const canvas = canvasRef.current;
        
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#8C5E2A');
        gradient.addColorStop(1, '#5B3A1D');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#F3E7C6';
        ctx.font = 'bold 24px Cinzel';
        ctx.textAlign = 'center';
        ctx.fillText(
          `🖼️ ILUSTRACIÓN AI: ${gameState.location || 'Ubicación Desconocida'}`,
          canvas.width / 2,
          canvas.height / 2 - 15
        );
        
        ctx.font = '16px Cormorant Garamond';
        ctx.fillText(
          `Modo: ${gameState.mode || 'RPG'} ${loading ? '(Generando...)' : ''}`,
          canvas.width / 2,
          canvas.height / 2 + 15
        );
      }
    }, [gameState, loading]);

    const latestEntry = gameState?.narrativeLog?.slice(-1)[0];

    return (
      <div className="integrated-canvas-container">
        <canvas 
          ref={canvasRef} 
          className="ai-canvas" 
          // SIN onClick - solo visual
        />
        
        {narrativeVisible && latestEntry && (
          <div className="narrative-overlay">
            <div className="narrative-title">
              📜 {gameState.mode === 'sandbox' ? 'Tu Historia' : 'Crónica de la Aventura'}
            </div>
            <div className="narrative-preview">
              <strong>▶ {latestEntry.player_action}</strong>
            </div>
            <div className="narrative-preview">
              {latestEntry.narrative.length > 120 
                ? latestEntry.narrative.substring(0, 120) + '...' 
                : latestEntry.narrative
              }
            </div>
            <div className="narrative-hint">
              Click en 📜 para ver historia completa
            </div>
          </div>
        )}
        
        {/* UN SOLO PERGAMINO INTELIGENTE */}
        {gameState?.narrativeLog?.length > 0 && (
          <button 
            className="narrative-smart-toggle clickable"
            onClick={toggleNarrativeVisible}
            title={narrativeVisible ? "Ver historia completa" : "Mostrar resumen"}
          >
            📜
          </button>
        )}
        
        {loading && (
          <div className="loading-indicator">
            🎨 Generando respuesta...
          </div>
        )}
      </div>
    );
  };

  // Header con stats HORIZONTALES
  const CompactHeader = () => {
    const vitals = gameState?.vitals || { health: 85, mana: 60, stamina: 80 };
    
    return (
      <header className="compact-header">
        <div className="header-left">
          <h1 className="header-title">
            {/* MOBILE: Header ultra-compacto con ubicación */}
            <span className="mobile-ultra-compact">
              HELLBOUND | ❤️{vitals.health} 🔮{vitals.mana} ● {connectionStatus === 'connected' ? 'On' : 'Off'}
            </span>
            {/* DESKTOP: Header completo */}
            <span className="desktop-full">
              🔥 HELLBOUND RPG v2.0
            </span>
          </h1>
          
          {/* UBICACIÓN SIEMPRE VISIBLE */}
          {gameState?.location && (
            <div className="header-location">
              <span>📍</span>
              <span>{gameState.location}</span>
            </div>
          )}
        </div>
        
        {/* DESKTOP: Stats HORIZONTALES compactos */}
        <div className="header-stats-horizontal desktop-only">
          {Object.entries(vitals).map(([type, value]) => {
            const icons = { health: '❤️', mana: '🔮', stamina: '⚡' };
            const percentage = Math.max(0, Math.min(100, value));
            
            return (
              <div key={type} className="stat-horizontal">
                <span className="stat-icon">{icons[type]}</span>
                <div className="stat-bar-horizontal">
                  <div 
                    className={`stat-fill ${type}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="stat-value">{percentage}</span>
              </div>
            );
          })}
          
          <div className="connection-indicator">
            <div className={`status-dot ${connectionStatus === 'connected' ? 'connected' : ''}`} />
            <span>Conectado</span>
          </div>
        </div>
      </header>
    );
  };

  // MOBILE: Acciones CON TEXTO debajo del input
  const MobileActionsPanel = () => (
    <div className="mobile-actions-panel">
      <div className="mobile-actions-scroll">
        {suggestedActions.length === 0 ? (
          <div className="no-actions-text">
            Las acciones aparecerán aquí...
          </div>
        ) : (
          suggestedActions.map((suggestedAction, index) => (
            <button
              key={index}
              onClick={() => handleSuggestedAction(suggestedAction)}
              disabled={loading || gameOver}
              className="mobile-action-with-text clickable"
            >
              <span>{getActionIcon(suggestedAction)}</span>
              <span>{suggestedAction}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // BARRA POPUPS UNIFICADA
  const PopupsBar = () => (
    <div className="popups-bar">
      <button 
        className="popup-button clickable"
        onClick={toggleInventory}
        aria-label="Inventario"
      >
        📦
        <span className="popup-label">Inv.</span>
        {newItems > 0 && <div className="notification-badge">{newItems}</div>}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleObjectives}
        aria-label="Objetivos"
      >
        🎯
        <span className="popup-label">Obj.</span>
        {newObjectives > 0 && <div className="notification-badge">{newObjectives}</div>}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleSkills}
        aria-label="Habilidades"
      >
        📚
        <span className="popup-label">Skills</span>
        {newSkills > 0 && <div className="notification-badge">{newSkills}</div>}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleEmotionsModal}
        aria-label="Estados"
      >
        😌
        <span className="popup-label">Estados</span>
        {newEmotions > 0 && <div className="notification-badge">{newEmotions}</div>}
      </button>
    </div>
  );

  // DESKTOP: Acciones centradas responsivas
  const DesktopActionsSection = () => (
    <div className="desktop-actions-section">
      {suggestedActions.length === 0 ? (
        <div className="no-actions-placeholder">
          Acciones disponibles...
        </div>
      ) : (
        suggestedActions.slice(0, 3).map((suggestedAction, index) => (
          <button
            key={index}
            onClick={() => handleSuggestedAction(suggestedAction)}
            disabled={loading || gameOver}
            className="desktop-action-button clickable"
          >
            <span>{getActionIcon(suggestedAction)}</span>
            <span className="action-text">{suggestedAction}</span>
          </button>
        ))
      )}
    </div>
  );

  // Controls Bar REORGANIZADO
  const ControlsBar = () => (
    <div className="controls-bar">
      <div className="controls-content">
        <StoryInput 
          ref={inputRef}
          onSubmit={submitAction}
          loading={loading}
          gameOver={gameOver}
        />
        
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            const form = e.target.closest('.controls-content').querySelector('form');
            if (form) {
              form.requestSubmit();
            }
          }}
          disabled={loading || gameOver}
          className="actuar-button clickable"
        >
          {loading ? '...' : 'ACTUAR'}
        </button>
        
        {/* DESKTOP: Acciones centradas + Popups bar */}
        <div className="desktop-only desktop-extensions">
          <DesktopActionsSection />
          <PopupsBar />
        </div>
      </div>
    </div>
  );

  // Modal Skills AVANZADO con tabs
  const SkillsModal = () => {
    const skills = gameState?.skills || [];
    const [activeTab, setActiveTab] = useState('activas');

    // Categorizar skills
    const categorizedSkills = {
      activas: skills.filter(skill => skill?.type === 'active' || !skill?.type),
      magia: skills.filter(skill => skill?.type === 'magic'),
      pasivas: skills.filter(skill => skill?.type === 'passive')
    };

    const tabs = [
      { id: 'activas', label: 'Activas', skills: categorizedSkills.activas },
      { id: 'magia', label: 'Magia', skills: categorizedSkills.magia },
      { id: 'pasivas', label: 'Pasivas', skills: categorizedSkills.pasivas }
    ];

    const currentSkills = categorizedSkills[activeTab] || [];

    return (
      <>
        <div 
          className={`modal-overlay ${showSkills ? 'show' : ''}`}
          onClick={() => setShowSkills(false)}
        />
        <div className={`popup-modal skills-popup ${showSkills ? 'show' : ''}`}>
          <div className="modal-header">
            <span>📚 Habilidades</span>
            <button 
              className="modal-close clickable" 
              onClick={() => setShowSkills(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          
          {/* TABS HORIZONTALES */}
          <div className="skills-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`skill-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.skills.length > 0 && (
                  <span className="tab-count">({tab.skills.length})</span>
                )}
              </button>
            ))}
          </div>
          
          <div className="modal-content">
            {currentSkills.length === 0 ? (
              <p className="no-skills-message">
                No tienes habilidades {activeTab} aún.
              </p>
            ) : (
              <div className="skills-detailed-list">
                {currentSkills.map((skill, index) => (
                  <div key={skill?.id || index} className="skill-detailed-item">
                    <div className="skill-icon-large">{getSkillIcon(skill)}</div>
                    <div className="skill-detailed-info">
                      <div className="skill-detailed-name">
                        {skill?.id || skill || 'Habilidad'}
                        {skill?.isNew && <span className="new-badge">NEW</span>}
                      </div>
                      {skill?.level && (
                        <div className="skill-detailed-level">Nivel {skill.level}</div>
                      )}
                      {skill?.description && (
                        <div className="skill-detailed-desc">{skill.description}</div>
                      )}
                      {skill?.effects && (
                        <div className="skill-effects">
                          Efectos: {skill.effects}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // Modal Estados Emocionales - POPUP
  const EmotionsModal = () => {
    const emotionalStates = gameState?.emotionalStates || {};
    const allEmotions = [
      'serenidad', 'alerta', 'miedo', 'euforia', 'fatiga', 'ira'
    ];

    return (
      <>
        <div 
          className={`modal-overlay ${showEmotionsModal ? 'show' : ''}`}
          onClick={() => setShowEmotionsModal(false)}
        />
        <div className={`popup-modal ${showEmotionsModal ? 'show' : ''}`}>
          <div className="modal-header">
            <span>😌 Estados Mentales</span>
            <button 
              className="modal-close clickable" 
              onClick={() => setShowEmotionsModal(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="modal-content">
            <div className="emotions-list">
              {allEmotions.map((emotion) => {
                const value = emotionalStates[emotion] || 0;
                return (
                  <div key={emotion} className="emotion-row">
                    <div className="emotion-icon">{getEmotionIcon(emotion)}</div>
                    <div className="emotion-info">
                      <div className="emotion-name">{emotion}</div>
                      <div className="emotion-value">{Math.round(value)}%</div>
                    </div>
                    <div className="emotion-bar">
                      <div 
                        className="emotion-fill"
                        style={{ width: `${Math.round(value)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Modal Objetivos - POPUP
  const ObjectivesModal = () => {
    const defaultObjectives = [
      { description: "Investigar la figura misteriosa", completed: false },
      { description: "Encontrar a los compañeros", completed: false },
      { description: "Explorar Alicante nevada", completed: false }
    ];
    
    const objectives = gameState?.questObjectives || defaultObjectives;

    return (
      <>
        <div 
          className={`modal-overlay ${showObjectives ? 'show' : ''}`}
          onClick={() => setShowObjectives(false)}
        />
        <div className={`popup-modal ${showObjectives ? 'show' : ''}`}>
          <div className="modal-header">
            <span>🎯 Objetivos</span>
            <button 
              className="modal-close clickable" 
              onClick={() => setShowObjectives(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="modal-content">
            <div className="objective-list">
              {objectives.map((objective, index) => (
                <div 
                  key={index} 
                  className={`objective-item ${objective.completed ? 'objective-completed' : ''}`}
                >
                  <span className="objective-checkbox">
                    {objective.completed ? '☑️' : '☐'}
                  </span>
                  <span className="objective-text">
                    {objective.description || objective}
                    {objective.isNew && <span className="new-badge">NEW</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Modal Inventario - POPUP
  const InventoryModal = () => {
    const items = gameState?.inventory || [];
    const totalSlots = 9;
    const emptySlots = Math.max(0, totalSlots - items.length);

    return (
      <>
        <div 
          className={`modal-overlay ${showInventory ? 'show' : ''}`}
          onClick={() => setShowInventory(false)}
        />
        <div className={`popup-modal inventory-popup ${showInventory ? 'show' : ''}`}>
          <div className="modal-header">
            <span>📦 Inventario</span>
            <button 
              className="modal-close clickable" 
              onClick={() => setShowInventory(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="modal-content">
            <div className="inventory-grid">
              {items.map((item, index) => (
                <div key={index} className="inventory-slot clickable">
                  <div className="slot-icon">{item.icon || '📦'}</div>
                  <div className="slot-name">{item.name || `Item ${index + 1}`}</div>
                  {item.isNew && <div className="item-new-indicator">NEW</div>}
                </div>
              ))}
              {Array.from({ length: emptySlots }, (_, index) => (
                <div key={`empty-${index}`} className="inventory-slot empty">
                  <div className="slot-icon">+</div>
                  <div className="slot-name">Vacío</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Modal Narrativa Expandida - POPUP
  const NarrativeModal = () => (
    <>
      <div 
        className={`modal-overlay ${showNarrativeModal ? 'show' : ''}`}
        onClick={() => setShowNarrativeModal(false)}
      />
      <div className={`popup-modal narrative-popup ${showNarrativeModal ? 'show' : ''}`}>
        <div className="modal-header">
          <span>📜 {gameState?.mode === 'sandbox' ? 'Tu Historia' : 'Crónica de la Aventura'}</span>
          <button 
            className="modal-close clickable" 
            onClick={() => setShowNarrativeModal(false)}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="modal-content">
          {gameState?.narrativeLog?.length === 0 ? (
            <p className="no-narrative-message">
              Tu historia comienza aquí...
            </p>
          ) : (
            <div className="narrative-entries">
              {gameState?.narrativeLog?.map((entry, index) => (
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
    </>
  );

  // Formulario Sandbox
  const SandboxConceptForm = ({ onSubmit, loading }) => {
    const [concept, setConcept] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (concept.trim() && !loading) {
        onSubmit(concept.trim());
      }
    };

    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ maxWidth: '500px', width: '100%', padding: 'var(--space-lg)' }}>
          <div style={{ 
            background: 'var(--bg-card)', 
            border: 'var(--border-width) solid var(--color-primary)',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-lg)',
            textAlign: 'center'
          }}>
            <h2 style={{ 
              fontFamily: 'var(--font-title)', 
              fontSize: '2rem', 
              color: 'var(--color-primary)', 
              marginBottom: 'var(--space-lg)' 
            }}>
              Modo Sandbox - Historia Libre
            </h2>
            <p style={{ 
              fontSize: '1.1rem', 
              color: 'var(--text-medium)', 
              marginBottom: 'var(--space-lg)' 
            }}>
              Describe la historia que quieres vivir.
            </p>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ejemplo: 'Detective paranormal investigando desapariciones'..."
                disabled={loading}
                rows={4}
                className="clickable"
                style={{
                  width: '100%',
                  padding: 'var(--space-md)',
                  border: 'var(--border-width) solid var(--color-primary)',
                  borderRadius: 'var(--border-radius)',
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
                className="action-button clickable"
                style={{ fontSize: '1.1rem' }}
              >
                {loading ? 'Creando historia...' : 'Comenzar Aventura'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {!sessionId ? (
        // Pantalla de inicio
        !mode ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <h2 style={{ 
                fontFamily: 'var(--font-title)', 
                fontSize: '2.5rem', 
                color: 'var(--color-primary)', 
                marginBottom: 'var(--space-lg)' 
              }}>
                Bienvenido al Infierno
              </h2>
              <p style={{ 
                fontSize: '1.2rem', 
                color: 'var(--text-medium)', 
                marginBottom: 'var(--space-lg)' 
              }}>
                Elige tu camino en una aventura épica donde cada decisión forja tu destino.
              </p>
              <ModeSelector onSelect={setMode} />
            </div>
          </div>
        ) : showSandboxForm && mode === 'sandbox' ? (
          <SandboxConceptForm 
            onSubmit={(concept) => startNewSession('sandbox', null, concept)}
            loading={loading}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <div style={{ 
                background: 'var(--bg-card)', 
                border: 'var(--border-width) solid var(--color-primary)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--space-lg)'
              }}>
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
                    className="action-button clickable"
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
                    className="clickable"
                    style={{
                      background: 'var(--color-secondary)',
                      color: 'var(--text-light)',
                      border: 'none',
                      padding: 'var(--space-sm) var(--space-md)',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    Cambiar Modo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : gameOver ? (
        // Game Over
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-lg)' }}>
          <div style={{ 
            background: 'var(--bg-card)', 
            border: 'var(--border-width) solid var(--color-danger)',
            borderRadius: 'var(--border-radius)',
            padding: 'var(--space-lg)',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <h3 style={{ 
              fontFamily: 'var(--font-title)', 
              fontSize: '1.8rem', 
              color: 'var(--color-danger)', 
              marginBottom: 'var(--space-md)' 
            }}>
              💀 GAME OVER 💀
            </h3>
            <p style={{ color: 'var(--text-medium)', marginBottom: 'var(--space-lg)' }}>
              Tu aventura ha llegado a su fin. ¿Quieres intentarlo de nuevo?
            </p>
            <button
              onClick={() => window.location.reload()}
              className="action-button clickable"
              style={{ fontSize: '1.1rem' }}
            >
              Reiniciar Partida
            </button>
          </div>
        </div>
      ) : (
        // LAYOUT FINAL REORGANIZADO
        <>
          <CompactHeader />
          <IntegratedCanvas />
          
          {/* MOBILE LAYOUT */}
          <div className="mobile-only">
            <ControlsBar />
            <MobileActionsPanel />
            <PopupsBar />
          </div>
          
          {/* DESKTOP LAYOUT */}
          <div className="desktop-only">
            <ControlsBar />
          </div>
          
          {/* TODOS LOS MODALES */}
          <SkillsModal />
          <ObjectivesModal />
          <InventoryModal />
          <EmotionsModal />
          <NarrativeModal />
        </>
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
          zIndex: '200',
          maxWidth: '300px',
          fontSize: '1rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default React.memo(App);