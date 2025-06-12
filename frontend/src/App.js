import React, { useState, useEffect, useRef, useCallback } from 'react';
import './tokens.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';
import StoryInput from './components/StoryInput';

// 🎮 MAIN APP COMPONENT - SISTEMA POPUPS "VIVOS" COMPLETO
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
  
  // UI States
  const [narrativeVisible, setNarrativeVisible] = useState(true);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showEmotionsModal, setShowEmotionsModal] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);

  // SISTEMA BADGES "VIVOS" MEJORADO
  const [badges, setBadges] = useState({
    inventory: { count: 0, newItems: [] },
    objectives: { count: 0, newObjectives: [], completedObjectives: [] },
    skills: { count: 0, newSkills: [], levelUps: [] },
    emotions: { count: 0, significantChanges: [] }
  });

  // Persistencia de elementos "NEW"
  const [newElements, setNewElements] = useState({
    inventory: new Set(),
    objectives: new Set(), 
    skills: new Set(),
    emotions: new Set()
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
  const fadeTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // HELPER: Safe string conversion
  const safeStringify = (value, fallback = '') => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') {
      return value.name || value.id || value.description || fallback;
    }
    return String(value);
  };

  // SISTEMA DE DETECCIÓN DE CAMBIOS ROBUSTO CORREGIDO
  const detectInventoryChanges = (prevInventory, currentInventory) => {
    const prev = Array.isArray(prevInventory) ? prevInventory : [];
    const current = Array.isArray(currentInventory) ? currentInventory : [];
    
    console.log('🔍 INVENTORY DEBUG:', { prev: prev.length, current: current.length });
    
    const prevIds = prev.map(item => item?.id || item?.name || JSON.stringify(item));
    const currentIds = current.map(item => item?.id || item?.name || JSON.stringify(item));
    
    // CORRECCIÓN: Filtrar items que NO están en prevIds
    const newItems = current.filter(item => {
      const itemId = item?.id || item?.name || JSON.stringify(item);
      return !prevIds.includes(itemId);
    });
    
    console.log('📦 INVENTORY CHANGES:', { prevIds, currentIds, newItems });
    
    return {
      newItems,
      totalCount: newItems.length
    };
  };

  const detectObjectivesChanges = (prevObjectives, currentObjectives) => {
    const prev = Array.isArray(prevObjectives) ? prevObjectives : [];
    const current = Array.isArray(currentObjectives) ? currentObjectives : [];
    
    console.log('🔍 OBJECTIVES DEBUG:', { prev: prev.length, current: current.length });
    
    const prevIds = prev.map(obj => obj?.id || obj?.description || JSON.stringify(obj));
    const currentIds = current.map(obj => obj?.id || obj?.description || JSON.stringify(obj));
    
    const prevCompleted = prev.filter(obj => obj?.completed).map(obj => obj?.id || obj?.description);
    const currentCompleted = current.filter(obj => obj?.completed).map(obj => obj?.id || obj?.description);
    
    // CORRECCIÓN: Nuevos objetivos son los que NO están en prevIds
    const newObjectives = current.filter(obj => {
      const objId = obj?.id || obj?.description || JSON.stringify(obj);
      return !prevIds.includes(objId);
    });
    
    // CORRECCIÓN: Objetivos recién completados
    const completedObjectives = currentCompleted.filter(id => !prevCompleted.includes(id));
    
    console.log('🎯 OBJECTIVES CHANGES:', { 
      prevIds, currentIds, newObjectives, 
      prevCompleted, currentCompleted, completedObjectives 
    });
    
    return {
      newObjectives,
      completedObjectives,
      totalCount: newObjectives.length + completedObjectives.length
    };
  };

  const detectSkillsChanges = (prevSkills, currentSkills) => {
    const prev = Array.isArray(prevSkills) ? prevSkills : [];
    const current = Array.isArray(currentSkills) ? currentSkills : [];
    
    console.log('🔍 SKILLS DEBUG:', { prev: prev.length, current: current.length });
    
    const prevIds = prev.map(skill => skill?.id || skill?.name || JSON.stringify(skill));
    const currentIds = current.map(skill => skill?.id || skill?.name || JSON.stringify(skill));
    
    // CORRECCIÓN: Nuevas skills son las que NO están en prevIds
    const newSkills = current.filter(skill => {
      const skillId = skill?.id || skill?.name || JSON.stringify(skill);
      return !prevIds.includes(skillId);
    });
    
    // Detectar level ups
    const levelUps = [];
    current.forEach(currentSkill => {
      const prevSkill = prev.find(p => (p?.id || p?.name) === (currentSkill?.id || currentSkill?.name));
      if (prevSkill && currentSkill?.level && prevSkill?.level && currentSkill.level > prevSkill.level) {
        levelUps.push(currentSkill);
      }
    });
    
    console.log('⭐ SKILLS CHANGES:', { prevIds, currentIds, newSkills, levelUps });
    
    return {
      newSkills,
      levelUps,
      totalCount: newSkills.length + levelUps.length
    };
  };

  const detectEmotionsChanges = (prevEmotions, currentEmotions) => {
    const prev = prevEmotions || {};
    const current = currentEmotions || {};
    
    console.log('🔍 EMOTIONS DEBUG:', { prev, current });
    
    const significantChanges = [];
    
    Object.keys(current).forEach(emotion => {
      const prevValue = prev[emotion] || 0;
      const currentValue = current[emotion] || 0;
      
      // Cambio significativo: ±15 puntos
      if (Math.abs(currentValue - prevValue) >= 15) {
        significantChanges.push({
          emotion,
          change: currentValue - prevValue,
          current: currentValue
        });
      }
    });
    
    console.log('😊 EMOTIONS CHANGES:', { significantChanges });
    
    return {
      significantChanges,
      totalCount: significantChanges.length
    };
  };

  // Auto-fade narrativa
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

  // Socket initialization CON DETECCIÓN AVANZADA + FALLBACK POLLING
  useEffect(() => {
    console.log('🔌 Iniciando conexión WebSocket a:', BACKEND_URL);
    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'], // Fallback a polling si websocket falla
      forceNew: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ WebSocket conectado exitosamente');
      setConnectionStatus('connected');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error de conexión WebSocket:', error);
      setConnectionStatus('disconnected');
    });

    newSocket.on('game_update', (data) => {
      console.log('🔥 WEBSOCKET UPDATE RECEIVED:', data);
      if (data.session_id === sessionId) {
        setGameState(prevState => {
          console.log('🔍 COMPARING STATES:', { prevState, newState: data.game_state });
          if (!prevState || data.game_state.actionCount > prevState.actionCount) {
            setNarrativeVisible(true);
            
            // SISTEMA DE BADGES AVANZADO
            if (prevState) {
              console.log('🔍 DETECTING CHANGES...');
              // Detectar cambios en inventario
              const inventoryChanges = detectInventoryChanges(
                prevState.inventory, 
                data.game_state.inventory
              );
              
              // Detectar cambios en objetivos
              const objectivesChanges = detectObjectivesChanges(
                prevState.questObjectives,
                data.game_state.questObjectives
              );
              
              // Detectar cambios en skills
              const skillsChanges = detectSkillsChanges(
                prevState.skills,
                data.game_state.skills
              );
              
              // Detectar cambios en estados emocionales
              const emotionsChanges = detectEmotionsChanges(
                prevState.emotionalStates,
                data.game_state.emotionalStates
              );
              
              console.log('🎯 CHANGES DETECTED:', { inventoryChanges, objectivesChanges, skillsChanges, emotionsChanges });
              
              // Actualizar badges si hay cambios
              if (inventoryChanges.totalCount > 0 || objectivesChanges.totalCount > 0 || 
                  skillsChanges.totalCount > 0 || emotionsChanges.totalCount > 0) {
                
                console.log('✨ UPDATING BADGES...');
                setBadges(prevBadges => {
                  const newBadges = {
                    inventory: {
                      count: prevBadges.inventory.count + inventoryChanges.totalCount,
                      newItems: [...prevBadges.inventory.newItems, ...inventoryChanges.newItems]
                    },
                    objectives: {
                      count: prevBadges.objectives.count + objectivesChanges.totalCount,
                      newObjectives: [...prevBadges.objectives.newObjectives, ...objectivesChanges.newObjectives],
                      completedObjectives: [...prevBadges.objectives.completedObjectives, ...objectivesChanges.completedObjectives]
                    },
                    skills: {
                      count: prevBadges.skills.count + skillsChanges.totalCount,
                      newSkills: [...prevBadges.skills.newSkills, ...skillsChanges.newSkills],
                      levelUps: [...prevBadges.skills.levelUps, ...skillsChanges.levelUps]
                    },
                    emotions: {
                      count: prevBadges.emotions.count + emotionsChanges.totalCount,
                      significantChanges: [...prevBadges.emotions.significantChanges, ...emotionsChanges.significantChanges]
                    }
                  };
                  console.log('🏆 NEW BADGES STATE:', newBadges);
                  return newBadges;
                });
                
                // Actualizar elementos NEW
                setNewElements(prevNew => ({
                  inventory: new Set([
                    ...prevNew.inventory,
                    ...inventoryChanges.newItems.map(item => item?.id || item?.name || JSON.stringify(item))
                  ]),
                  objectives: new Set([
                    ...prevNew.objectives,
                    ...objectivesChanges.newObjectives.map(obj => obj?.id || obj?.description || JSON.stringify(obj)),
                    ...objectivesChanges.completedObjectives
                  ]),
                  skills: new Set([
                    ...prevNew.skills,
                    ...skillsChanges.newSkills.map(skill => skill?.id || skill?.name || JSON.stringify(skill)),
                    ...skillsChanges.levelUps.map(skill => `${skill?.id || skill?.name}-levelup`)
                  ]),
                  emotions: new Set([
                    ...prevNew.emotions,
                    ...emotionsChanges.significantChanges.map(change => change.emotion)
                  ])
                }));
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

  // SISTEMA DE POLLING FORZADO para badges (independiente de WebSocket)
  useEffect(() => {
    let pollingInterval;
    
    if (sessionId) {
      console.log('🔄 Iniciando polling forzado para badges, connectionStatus:', connectionStatus);
      pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/get_session/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            
            setGameState(prevState => {
              if (!prevState || data.game_state.actionCount > prevState.actionCount) {
                console.log('🔄 POLLING UPDATE:', data.game_state);
                setNarrativeVisible(true);
                
                // Aplicar misma lógica de badges
                if (prevState) {
                  const inventoryChanges = detectInventoryChanges(prevState.inventory, data.game_state.inventory);
                  const objectivesChanges = detectObjectivesChanges(prevState.questObjectives, data.game_state.questObjectives);
                  const skillsChanges = detectSkillsChanges(prevState.skills, data.game_state.skills);
                  const emotionsChanges = detectEmotionsChanges(prevState.emotionalStates, data.game_state.emotionalStates);
                  
                  console.log('🎯 POLLING CHANGES:', { inventoryChanges, objectivesChanges, skillsChanges, emotionsChanges });
                  
                  if (inventoryChanges.totalCount > 0 || objectivesChanges.totalCount > 0 || 
                      skillsChanges.totalCount > 0 || emotionsChanges.totalCount > 0) {
                    
                    console.log('✨ POLLING BADGES UPDATE');
                    setBadges(prev => ({
                      inventory: { count: prev.inventory.count + inventoryChanges.totalCount, newItems: [...prev.inventory.newItems, ...inventoryChanges.newItems] },
                      objectives: { count: prev.objectives.count + objectivesChanges.totalCount, newObjectives: [...prev.objectives.newObjectives, ...objectivesChanges.newObjectives], completedObjectives: [...prev.objectives.completedObjectives, ...objectivesChanges.completedObjectives] },
                      skills: { count: prev.skills.count + skillsChanges.totalCount, newSkills: [...prev.skills.newSkills, ...skillsChanges.newSkills], levelUps: [...prev.skills.levelUps, ...skillsChanges.levelUps] },
                      emotions: { count: prev.emotions.count + emotionsChanges.totalCount, significantChanges: [...prev.emotions.significantChanges, ...emotionsChanges.significantChanges] }
                    }));
                  }
                }
                
                return data.game_state;
              }
              return prevState;
            });
          }
        } catch (error) {
          console.error('❌ Error en polling:', error);
        }
      }, 2000); // Poll cada 2 segundos
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [sessionId, BACKEND_URL]);
  // SISTEMA DE POLLING FORZADO para badges (independiente de WebSocket)
  useEffect(() => {
    let pollingInterval;
    
    if (sessionId) {
      console.log('🔄 Iniciando polling forzado para badges, connectionStatus:', connectionStatus);
      pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/get_session/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            
            setGameState(prevState => {
              if (!prevState || data.game_state.actionCount > prevState.actionCount) {
                console.log('🔄 POLLING UPDATE:', data.game_state);
                setNarrativeVisible(true);
                
                // Aplicar misma lógica de badges
                if (prevState) {
                  const inventoryChanges = detectInventoryChanges(prevState.inventory, data.game_state.inventory);
                  const objectivesChanges = detectObjectivesChanges(prevState.questObjectives, data.game_state.questObjectives);
                  const skillsChanges = detectSkillsChanges(prevState.skills, data.game_state.skills);
                  const emotionsChanges = detectEmotionsChanges(prevState.emotionalStates, data.game_state.emotionalStates);
                  
                  console.log('🎯 POLLING CHANGES:', { inventoryChanges, objectivesChanges, skillsChanges, emotionsChanges });
                  
                  if (inventoryChanges.totalCount > 0 || objectivesChanges.totalCount > 0 || 
                      skillsChanges.totalCount > 0 || emotionsChanges.totalCount > 0) {
                    
                    console.log('✨ POLLING BADGES UPDATE');
                    setBadges(prev => ({
                      inventory: { count: prev.inventory.count + inventoryChanges.totalCount, newItems: [...prev.inventory.newItems, ...inventoryChanges.newItems] },
                      objectives: { count: prev.objectives.count + objectivesChanges.totalCount, newObjectives: [...prev.objectives.newObjectives, ...objectivesChanges.newObjectives], completedObjectives: [...prev.objectives.completedObjectives, ...objectivesChanges.completedObjectives] },
                      skills: { count: prev.skills.count + skillsChanges.totalCount, newSkills: [...prev.skills.newSkills, ...skillsChanges.newSkills], levelUps: [...prev.skills.levelUps, ...skillsChanges.levelUps] },
                      emotions: { count: prev.emotions.count + emotionsChanges.totalCount, significantChanges: [...prev.emotions.significantChanges, ...emotionsChanges.significantChanges] }
                    }));
                  }
                }
                
                return data.game_state;
              }
              return prevState;
            });
          }
        } catch (error) {
          console.error('❌ Error en polling:', error);
        }
      }, 2000); // Poll cada 2 segundos
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [sessionId, BACKEND_URL]);

  // Start new session
  const startNewSession = async (selectedMode = mode, campaignName, sandboxConcept) => {
    setLoading(true);
    setError(null);
    setGameOver(false);
    
    // Reset badges y elementos new
    setBadges({
      inventory: { count: 0, newItems: [] },
      objectives: { count: 0, newObjectives: [], completedObjectives: [] },
      skills: { count: 0, newSkills: [], levelUps: [] },
      emotions: { count: 0, significantChanges: [] }
    });
    
    setNewElements({
      inventory: new Set(),
      objectives: new Set(),
      skills: new Set(),
      emotions: new Set()
    });
    
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

  // Submit action
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

  // Force blur para móvil
  const forceBlurAll = () => {
    if (document.activeElement) {
      document.activeElement.blur();
    }
    
    setTimeout(() => {
      document.querySelectorAll('input, textarea').forEach(el => {
        if (el.blur) el.blur();
      });
      
      if (window.innerWidth <= 767) {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
    }, 100);
  };

  // Modal handlers CON RESET DE BADGES
  const toggleObjectives = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowObjectives(!showObjectives);
    if (!showObjectives) {
      // Reset badge al abrir
      setBadges(prev => ({ ...prev, objectives: { count: 0, newObjectives: [], completedObjectives: [] } }));
    }
  };

  const toggleInventory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowInventory(!showInventory);
    if (!showInventory) {
      // Reset badge al abrir
      setBadges(prev => ({ ...prev, inventory: { count: 0, newItems: [] } }));
    }
  };

  const toggleSkills = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowSkills(!showSkills);
    if (!showSkills) {
      // Reset badge al abrir
      setBadges(prev => ({ ...prev, skills: { count: 0, newSkills: [], levelUps: [] } }));
    }
  };

  const toggleEmotionsModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowEmotionsModal(!showEmotionsModal);
    if (!showEmotionsModal) {
      // Reset badge al abrir
      setBadges(prev => ({ ...prev, emotions: { count: 0, significantChanges: [] } }));
    }
  };

  const toggleNarrativeModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowNarrativeModal(!showNarrativeModal);
  };

  const toggleNarrativeVisible = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (narrativeVisible) {
      toggleNarrativeModal(e);
    } else {
      setNarrativeVisible(true);
    }
  };

  // Helper para verificar si elemento es nuevo
  const isElementNew = (category, elementId) => {
    return newElements[category]?.has(elementId);
  };

  // Helper para limpiar elemento nuevo al verlo
  const markElementSeen = (category, elementId) => {
    setNewElements(prev => {
      const newSet = new Set(prev[category]);
      newSet.delete(elementId);
      return { ...prev, [category]: newSet };
    });
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

  const getSkillIcon = (skill) => {
    const skillName = safeStringify(skill?.id || skill, '').toLowerCase();
    if (!skillName) return '✨';
    
    if (skillName.includes('exorcismo')) return '🔥';
    if (skillName.includes('percep')) return '⚡';
    if (skillName.includes('combate')) return '⚔️';
    if (skillName.includes('magia')) return '🔮';
    if (skillName.includes('social')) return '🗣️';
    return '✨';
  };

  // Canvas
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
          `🖼️ ILUSTRACIÓN AI: ${safeStringify(gameState.location, 'Ubicación Desconocida')}`,
          canvas.width / 2,
          canvas.height / 2 - 15
        );
        
        ctx.font = '16px Cormorant Garamond';
        ctx.fillText(
          `Modo: ${safeStringify(gameState.mode, 'RPG')} ${loading ? '(Generando...)' : ''}`,
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
        />
        
        {narrativeVisible && latestEntry && (
          <div className="narrative-overlay">
            <div className="narrative-title">
              📜 {gameState.mode === 'sandbox' ? 'Tu Historia' : 'Crónica de la Aventura'}
            </div>
            <div className="narrative-preview">
              <strong>▶ {safeStringify(latestEntry.player_action, 'Acción del jugador')}</strong>
            </div>
            <div className="narrative-preview">
              {(() => {
                const narrative = safeStringify(latestEntry.narrative, '');
                return narrative.length > 120 
                  ? narrative.substring(0, 120) + '...' 
                  : narrative;
              })()}
            </div>
            <div className="narrative-hint">
              Click en 📜 para ver historia completa
            </div>
          </div>
        )}
        
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

  // Header
  const CompactHeader = () => {
    const vitals = gameState?.vitals || { health: 85, mana: 60, stamina: 80 };
    
    return (
      <header className="compact-header">
        <div className="header-left">
          <h1 className="header-title">
            <span className="mobile-ultra-compact">
              HELLBOUND | ❤️{vitals.health} 🔮{vitals.mana} ● {connectionStatus === 'connected' ? 'On' : 'Off'}
            </span>
            <span className="desktop-full">
              🔥 HELLBOUND RPG v2.0
            </span>
          </h1>
          
          {gameState?.location && (
            <div className="header-location">
              <span>📍</span>
              <span>{safeStringify(gameState.location, '')}</span>
            </div>
          )}
        </div>
        
        <div className="header-stats-real-horizontal desktop-only">
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-icon">❤️</span>
              <div className="stat-bar-inline">
                <div 
                  className="stat-fill health"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.health))}%` }}
                />
              </div>
              <span className="stat-text">{vitals.health}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-icon">🔮</span>
              <div className="stat-bar-inline">
                <div 
                  className="stat-fill mana"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.mana))}%` }}
                />
              </div>
              <span className="stat-text">{vitals.mana}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-icon">⚡</span>
              <div className="stat-bar-inline">
                <div 
                  className="stat-fill stamina"
                  style={{ width: `${Math.max(0, Math.min(100, vitals.stamina || 80))}%` }}
                />
              </div>
              <span className="stat-text">{vitals.stamina || 80}</span>
            </div>
            
            <div className="connection-item">
              <div className={`status-dot ${connectionStatus === 'connected' ? 'connected' : ''}`} />
              <span className="status-text">Conectado</span>
            </div>
          </div>
        </div>
      </header>
    );
  };

  // Desktop Actions
  const DesktopActionsSection = () => (
    <div className="desktop-actions-top">
      <div className="actions-label">Acciones Sugeridas:</div>
      <div className="actions-buttons">
        {suggestedActions.length === 0 ? (
          <div className="no-actions-text">
            Las acciones aparecerán aquí según el contexto...
          </div>
        ) : (
          suggestedActions.map((suggestedAction, index) => (
            <button
              key={index}
              onClick={() => handleSuggestedAction(suggestedAction)}
              disabled={loading || gameOver}
              className="desktop-action-full clickable"
            >
              <span>{getActionIcon(suggestedAction)}</span>
              <span>{safeStringify(suggestedAction, 'Acción')}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // Mobile Actions
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
              <span>{safeStringify(suggestedAction, 'Acción')}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // BARRA POPUPS CON BADGES VIVOS
  const PopupsBar = () => (
    <div className="popups-bar">
      <button 
        className="popup-button clickable"
        onClick={toggleInventory}
        aria-label="Inventario"
      >
        📦
        <span className="popup-label">Inv.</span>
        {badges.inventory.count > 0 && (
          <div className="notification-badge pulse-animation">
            {badges.inventory.count}
          </div>
        )}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleObjectives}
        aria-label="Objetivos"
      >
        🎯
        <span className="popup-label">Obj.</span>
        {badges.objectives.count > 0 && (
          <div className="notification-badge pulse-animation">
            {badges.objectives.count}
          </div>
        )}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleSkills}
        aria-label="Habilidades"
      >
        📚
        <span className="popup-label">Skills</span>
        {badges.skills.count > 0 && (
          <div className="notification-badge pulse-animation">
            {badges.skills.count}
          </div>
        )}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleEmotionsModal}
        aria-label="Estados"
      >
        😌
        <span className="popup-label">Estados</span>
        {badges.emotions.count > 0 && (
          <div className="notification-badge pulse-animation">
            {badges.emotions.count}
          </div>
        )}
      </button>
    </div>
  );

  // Controls Bar
  const ControlsBar = () => (
    <div className="controls-bar">
      <div className="controls-content-clean">
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
            const form = e.target.closest('.controls-bar').querySelector('form');
            if (form) {
              form.requestSubmit();
            }
          }}
          disabled={loading || gameOver}
          className="actuar-button clickable"
        >
          {loading ? '...' : 'ACTUAR'}
        </button>
        
        <div className="desktop-only desktop-popups-only">
          <PopupsBar />
        </div>
      </div>
    </div>
  );

  // MODAL SKILLS CON BADGES Y ELEMENTOS NEW
  const SkillsModal = () => {
    const skills = gameState?.skills || [];
    const [activeTab, setActiveTab] = useState('activas');

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
          
          <div className="skills-tabs">
            {tabs.map(tab => {
              const hasNewSkills = tab.skills.some(skill => 
                isElementNew('skills', skill?.id || skill?.name || JSON.stringify(skill))
              );
              
              return (
                <button
                  key={tab.id}
                  className={`skill-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.skills.length > 0 && (
                    <span className="tab-count">({tab.skills.length})</span>
                  )}
                  {hasNewSkills && <span className="tab-new-indicator">●</span>}
                </button>
              );
            })}
          </div>
          
          <div className="modal-content">
            {currentSkills.length === 0 ? (
              <p className="no-skills-message">
                No tienes habilidades {activeTab} aún.
              </p>
            ) : (
              <div className="skills-detailed-list">
                {currentSkills.map((skill, index) => {
                  const skillId = skill?.id || skill?.name || JSON.stringify(skill);
                  const isNew = isElementNew('skills', skillId);
                  const isLevelUp = isElementNew('skills', `${skillId}-levelup`);
                  
                  return (
                    <div 
                      key={skillId || index} 
                      className={`skill-detailed-item ${isNew || isLevelUp ? 'highlight-new' : ''}`}
                      onClick={() => {
                        if (isNew) markElementSeen('skills', skillId);
                        if (isLevelUp) markElementSeen('skills', `${skillId}-levelup`);
                      }}
                    >
                      <div className="skill-icon-large">{getSkillIcon(skill)}</div>
                      <div className="skill-detailed-info">
                        <div className="skill-detailed-name">
                          {safeStringify(skill?.id || skill, 'Habilidad')}
                          {isNew && <span className="new-badge fade-in">NEW</span>}
                          {isLevelUp && <span className="levelup-badge fade-in">LEVEL UP!</span>}
                        </div>
                        {skill?.level && (
                          <div className="skill-detailed-level">Nivel {skill.level}</div>
                        )}
                        {skill?.description && (
                          <div className="skill-detailed-desc">{safeStringify(skill.description, '')}</div>
                        )}
                        {skill?.effects && (
                          <div className="skill-effects">
                            Efectos: {safeStringify(skill.effects, '')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  // MODAL ESTADOS CON CAMBIOS SIGNIFICATIVOS
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
                const hasRecentChange = isElementNew('emotions', emotion);
                
                return (
                  <div 
                    key={emotion} 
                    className={`emotion-row ${hasRecentChange ? 'highlight-change' : ''}`}
                    onClick={() => hasRecentChange && markElementSeen('emotions', emotion)}
                  >
                    <div className="emotion-icon">{getEmotionIcon(emotion)}</div>
                    <div className="emotion-info">
                      <div className="emotion-name">
                        {emotion}
                        {hasRecentChange && <span className="change-indicator fade-in">!</span>}
                      </div>
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

  // MODAL OBJETIVOS CON NUEVOS Y COMPLETADOS
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
              {objectives.map((objective, index) => {
                const objectiveId = objective?.id || objective?.description || JSON.stringify(objective);
                const isNew = isElementNew('objectives', objectiveId);
                
                return (
                  <div 
                    key={index} 
                    className={`objective-item ${objective.completed ? 'objective-completed' : ''} ${isNew ? 'highlight-new' : ''}`}
                    onClick={() => isNew && markElementSeen('objectives', objectiveId)}
                  >
                    <span className="objective-checkbox">
                      {objective.completed ? '☑️' : '☐'}
                    </span>
                    <span className="objective-text">
                      {safeStringify(objective?.description || objective, 'Objetivo sin descripción')}
                      {isNew && <span className="new-badge fade-in">NEW</span>}
                      {objective.completed && isNew && <span className="completed-badge fade-in">COMPLETADO</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  // MODAL INVENTARIO CON NUEVOS ITEMS
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
              {items.map((item, index) => {
                const itemId = item?.id || item?.name || JSON.stringify(item);
                const isNew = isElementNew('inventory', itemId);
                
                return (
                  <div 
                    key={index} 
                    className={`inventory-slot clickable ${isNew ? 'highlight-new' : ''}`}
                    onClick={() => isNew && markElementSeen('inventory', itemId)}
                  >
                    <div className="slot-icon">{item.icon || '📦'}</div>
                    <div className="slot-name">{safeStringify(item.name, `Item ${index + 1}`)}</div>
                    {isNew && <div className="item-new-indicator fade-in">NEW</div>}
                  </div>
                );
              })}
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

  // Modal Narrativa
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
                    ▶ {safeStringify(entry.player_action, 'Acción del jugador')}
                  </p>
                  <p className="narrative-text">
                    {safeStringify(entry.narrative, 'Narrativa')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Components para pantallas de inicio
  const CampaignButton = ({ onClick, disabled, loading, children }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="campaign-button clickable"
    >
      {loading ? 'Iniciando...' : children}
    </button>
  );

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
          <div className="sandbox-form-container">
            <h2 className="sandbox-title">
              Modo Sandbox - Historia Libre
            </h2>
            <p className="sandbox-subtitle">
              Describe la historia que quieres vivir.
            </p>
            
            <form onSubmit={handleSubmit} className="sandbox-form">
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ejemplo: 'Detective paranormal investigando desapariciones'..."
                disabled={loading}
                rows={4}
                className="sandbox-textarea clickable"
                required
                minLength={20}
              />
              
              <button
                type="submit"
                disabled={loading || concept.trim().length < 20}
                className="campaign-button clickable"
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
        !mode ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <h2 className="welcome-title">
                Bienvenido al Infierno
              </h2>
              <p className="welcome-subtitle">
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
              <div className="mode-selection-container">
                <p className="mode-selected-text">
                  Modo seleccionado: <span className="mode-name">
                    {mode === 'sandbox' ? 'Sandbox' : 
                     mode === 'campaign' ? 'Campaña' : 
                     'Campaña Temporal'}
                  </span>
                </p>
                <div className="mode-buttons">
                  <CampaignButton
                    onClick={() => startNewSession(mode, 'scenes_act1')}
                    disabled={loading}
                    loading={loading}
                  >
                    {`Iniciar ${
                      mode === 'sandbox' ? 'Sandbox' : 
                      mode === 'campaign' ? 'Campaña' : 
                      'Campaña Temporal'
                    }`}
                  </CampaignButton>
                  <button
                    onClick={() => {
                      setMode(null);
                      setShowSandboxForm(false);
                    }}
                    disabled={loading}
                    className="mode-change-button clickable"
                  >
                    Cambiar Modo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : gameOver ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-lg)' }}>
          <div className="game-over-container">
            <h3 className="game-over-title">
              💀 GAME OVER 💀
            </h3>
            <p className="game-over-text">
              Tu aventura ha llegado a su fin. ¿Quieres intentarlo de nuevo?
            </p>
            <button
              onClick={() => window.location.reload()}
              className="campaign-button clickable"
            >
              Reiniciar Partida
            </button>
          </div>
        </div>
      ) : (
        <>
          <CompactHeader />
          <IntegratedCanvas />
          
          <div className="mobile-only">
            <ControlsBar />
            <MobileActionsPanel />
            <PopupsBar />
          </div>
          
          <div className="desktop-only">
            <DesktopActionsSection />
            <ControlsBar />
          </div>
          
          <SkillsModal />
          <ObjectivesModal />
          <InventoryModal />
          <EmotionsModal />
          <NarrativeModal />
        </>
      )}

      {error && (
        <div className="error-display">
          {safeStringify(error, 'Error desconocido')}
        </div>
      )}
    </div>
  );
}

export default React.memo(App);