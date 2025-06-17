import React, { useState, useEffect, useRef, useCallback } from 'react';
import './tokens.css';
import io from 'socket.io-client';
import ModeSelector from './components/ModeSelector';
import StoryInput from './components/StoryInput';

// 🎮 MAIN APP COMPONENT - SISTEMA POPUPS "VIVOS" COMPLETO + DISCOVERED ITEMS
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
  const [sandboxConcept, setSandboxConcept] = useState(''); // 🎨 NUEVO: Para el rediseño
  
  // UI States
  const [narrativeVisible, setNarrativeVisible] = useState(true);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showEmotionsModal, setShowEmotionsModal] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);
  const [showDiscoveredItems, setShowDiscoveredItems] = useState(false);

  // 🎁 SISTEMA DISCOVERED ITEMS - NUEVO
  const [discoveredItems, setDiscoveredItems] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(null); // item siendo recogido

  // SISTEMA BADGES "VIVOS" MEJORADO - INCLUYE ITEMS SOLTADOS
  const [badges, setBadges] = useState({
    inventory: { count: 0, newItems: [], removedItems: [] }, // AGREGADO: removedItems
    objectives: { count: 0, newObjectives: [], completedObjectives: [] },
    skills: { count: 0, newSkills: [], levelUps: [] },
    emotions: { count: 0, significantChanges: [] },
    discovered: { count: 0, newItems: [] } // NUEVO: badge para discovered items
  });

  // Persistencia de elementos "NEW"
  const [newElements, setNewElements] = useState({
    inventory: new Set(),
    objectives: new Set(), 
    skills: new Set(),
    emotions: new Set(),
    discovered: new Set() // NUEVO: para discovered items
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
  const fadeTimeoutRef = useRef(null);
  
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

  // 🎁 FUNCIÓN PICKUP ITEM - NUEVA
  const pickupItem = async (item) => {
    if (!sessionId || !item || pickupLoading) return;
    
    setPickupLoading(item.instanceId);
    
    try {
      console.log('🎁 Recogiendo item:', item);
      
      const response = await fetch(`${BACKEND_URL}/api/pickup_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          item_id: item.instanceId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Item recogido exitosamente:', data);
      
      // Actualizar estado local inmediatamente
      setGameState(data.game_state);
      setDiscoveredItems(prev => prev.filter(i => i.instanceId !== item.instanceId));
      
      // Mostrar feedback visual (se puede mejorar más adelante)
      // TODO: Añadir notificación toast
      
    } catch (error) {
      console.error('❌ Error recogiendo item:', error);
      setError(`Error recogiendo ${item.name}: ${error.message}`);
    } finally {
      setPickupLoading(null);
    }
  };

  // Función para ignorar items descubiertos
  const ignoreItem = (item) => {
    console.log('🚫 Ignorando item:', item);
    setDiscoveredItems(prev => prev.filter(i => i.instanceId !== item.instanceId));
  };

  // SISTEMA DE DETECCIÓN DE CAMBIOS BASADO EN INSTANCE ID (DEFINITIVO) - CORREGIDO PARA ITEMS SOLTADOS
  const detectInventoryChanges = (prevInventory, currentInventory) => {
    const prev = Array.isArray(prevInventory) ? prevInventory : [];
    const current = Array.isArray(currentInventory) ? currentInventory : [];
    
    // Usar instanceId para detección precisa
    const prevIds = new Set(prev.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    const currentIds = new Set(current.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    
    // Detectar items realmente nuevos (RECOGIDOS)
    const newItems = current.filter(item => {
      const itemId = item?.instanceId || item?.name || JSON.stringify(item);
      return !prevIds.has(itemId);
    });
    
    // 🔥 NUEVO: Detectar items eliminados (SOLTADOS)
    const removedItems = prev.filter(item => {
      const itemId = item?.instanceId || item?.name || JSON.stringify(item);
      return !currentIds.has(itemId);
    });
    
    console.log('📦 INVENTORY CHANGES DETECTED:', { 
      prevCount: prev.length, 
      currentCount: current.length,
      prevIds: Array.from(prevIds),
      currentIds: Array.from(currentIds),
      newItems: newItems.map(i => i?.name),
      removedItems: removedItems.map(i => i?.name) // NUEVO LOG
    });
    
    return {
      newItems,
      removedItems, // NUEVO: items soltados
      totalCount: newItems.length + removedItems.length // NUEVO: contar ambos tipos
    };
  };

  // 🎁 NUEVO: Detectar cambios en discovered items
  const detectDiscoveredChanges = (prevDiscovered, currentDiscovered) => {
    const prev = Array.isArray(prevDiscovered) ? prevDiscovered : [];
    const current = Array.isArray(currentDiscovered) ? currentDiscovered : [];
    
    const prevIds = new Set(prev.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    const currentIds = new Set(current.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    
    const newItems = current.filter(item => {
      const itemId = item?.instanceId || item?.name || JSON.stringify(item);
      return !prevIds.has(itemId);
    });
    
    console.log('🎁 DISCOVERED CHANGES DETECTED:', { 
      prevCount: prev.length, 
      currentCount: current.length,
      newItems: newItems.map(i => i?.name)
    });
    
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
            
            // 🎁 ACTUALIZAR DISCOVERED ITEMS
            if (data.game_state.discoveredItems) {
              setDiscoveredItems(data.game_state.discoveredItems);
            }
            
            // SISTEMA DE BADGES AVANZADO
            if (prevState) {
              console.log('🔍 DETECTING CHANGES...');
              // Detectar cambios en inventario
              const inventoryChanges = detectInventoryChanges(
                prevState.inventory, 
                data.game_state.inventory
              );
              
              // 🎁 NUEVO: Detectar cambios en discovered items
              const discoveredChanges = detectDiscoveredChanges(
                prevState.discoveredItems,
                data.game_state.discoveredItems
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
              
              console.log('🎯 CHANGES DETECTED:', { inventoryChanges, discoveredChanges, objectivesChanges, skillsChanges, emotionsChanges });
              
              // Actualizar badges si hay cambios
              if (inventoryChanges.totalCount > 0 || discoveredChanges.totalCount > 0 || objectivesChanges.totalCount > 0 || 
                  skillsChanges.totalCount > 0 || emotionsChanges.totalCount > 0) {
                
                console.log('✨ UPDATING BADGES...');
                setBadges(prevBadges => {
                  const newBadges = {
                    inventory: {
                      count: prevBadges.inventory.count + inventoryChanges.totalCount,
                      newItems: [...prevBadges.inventory.newItems, ...inventoryChanges.newItems]
                    },
                    discovered: {
                      count: prevBadges.discovered.count + discoveredChanges.totalCount,
                      newItems: [...prevBadges.discovered.newItems, ...discoveredChanges.newItems]
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
                  
                  // BADGES PERSISTEN HASTA QUE SE ABRA EL MODAL
                  return newBadges;
                });
                
                // Actualizar elementos NEW
                setNewElements(prevNew => ({
                  inventory: new Set([
                    ...prevNew.inventory,
                    ...inventoryChanges.newItems.map(item => item?.id || item?.name || JSON.stringify(item))
                  ]),
                  discovered: new Set([
                    ...prevNew.discovered,
                    ...discoveredChanges.newItems.map(item => item?.instanceId || item?.name || JSON.stringify(item))
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

  // SISTEMA DE POLLING ÚNICO PARA BADGES (CORREGIDO - SIN DUPLICACIÓN) + DISCOVERED ITEMS
  useEffect(() => {
    if (!sessionId) return;
    
    console.log('🔄 INICIANDO POLLING ÚNICO para sessionId:', sessionId);
    const intervalId = setInterval(async () => {
      try {
        console.log('🔄 Haciendo polling request...');
        const response = await fetch(`${BACKEND_URL}/api/get_session/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔄 POLLING RESPONSE RAW:', {
            inventory: data.game_state?.inventory,
            inventoryLength: data.game_state?.inventory?.length,
            discoveredItems: data.game_state?.discoveredItems,
            discoveredLength: data.game_state?.discoveredItems?.length,
            actionCount: data.game_state?.actionCount
          });
          
          setGameState(prevState => {
            if (!prevState) {
              console.log('🔄 No prevState, returning new state');
              // 🎁 SINCRONIZAR DISCOVERED ITEMS EN PRIMER ESTADO
              if (data.game_state.discoveredItems) {
                setDiscoveredItems(data.game_state.discoveredItems);
              }
              return data.game_state;
            }
            
            // MEJORADO: Detectar cambios por múltiples campos, incluyendo discoveredItems
            const hasInventoryChanges = (data.game_state.inventory?.length || 0) > (prevState.inventory?.length || 0);
            const hasDiscoveredChanges = (data.game_state.discoveredItems?.length || 0) !== (prevState.discoveredItems?.length || 0);
            const hasSkillsChanges = (data.game_state.skills?.length || 0) > (prevState.skills?.length || 0);
            const hasObjectivesChanges = (data.game_state.questObjectives?.length || 0) > (prevState.questObjectives?.length || 0);
            const hasActionCountChange = data.game_state.actionCount > prevState.actionCount;
            
            if (hasActionCountChange || hasInventoryChanges || hasDiscoveredChanges || hasSkillsChanges || hasObjectivesChanges) {
              console.log('🔄 CAMBIOS DETECTADOS:', { 
                actionCount: `${prevState.actionCount} → ${data.game_state.actionCount}`,
                inventory: `${prevState.inventory?.length || 0} → ${data.game_state.inventory?.length || 0}`,
                discovered: `${prevState.discoveredItems?.length || 0} → ${data.game_state.discoveredItems?.length || 0}`,
                skills: `${prevState.skills?.length || 0} → ${data.game_state.skills?.length || 0}`,
                objectives: `${prevState.questObjectives?.length || 0} → ${data.game_state.questObjectives?.length || 0}`
              });
              
              setNarrativeVisible(true);
              
              // 🎁 ACTUALIZAR DISCOVERED ITEMS
              if (data.game_state.discoveredItems) {
                setDiscoveredItems(data.game_state.discoveredItems);
              }
              
              // DETECTAR CAMBIOS ESPECÍFICOS PARA BADGES
              const inventoryChanges = detectInventoryChanges(prevState.inventory, data.game_state.inventory);
              const discoveredChanges = detectDiscoveredChanges(prevState.discoveredItems, data.game_state.discoveredItems);
              const objectivesChanges = detectObjectivesChanges(prevState.questObjectives, data.game_state.questObjectives);
              const skillsChanges = detectSkillsChanges(prevState.skills, data.game_state.skills);
              const emotionsChanges = detectEmotionsChanges(prevState.emotionalStates, data.game_state.emotionalStates);
              
              console.log('🎯 CAMBIOS ESPECÍFICOS:', { inventoryChanges, discoveredChanges, objectivesChanges, skillsChanges, emotionsChanges });
              
              if (inventoryChanges.totalCount > 0 || discoveredChanges.totalCount > 0 || objectivesChanges.totalCount > 0 || 
                  skillsChanges.totalCount > 0 || emotionsChanges.totalCount > 0) {
                
                console.log('✨ ACTUALIZANDO BADGES!');
                setBadges(prev => {
                  const newBadges = {
                    inventory: { 
                      count: prev.inventory.count + inventoryChanges.totalCount, 
                      newItems: [...prev.inventory.newItems, ...inventoryChanges.newItems],
                      removedItems: [...prev.inventory.removedItems, ...(inventoryChanges.removedItems || [])]
                    },
                    discovered: {
                      count: prev.discovered.count + discoveredChanges.totalCount,
                      newItems: [...prev.discovered.newItems, ...discoveredChanges.newItems]
                    },
                    objectives: { count: prev.objectives.count + objectivesChanges.totalCount, newObjectives: [...prev.objectives.newObjectives, ...objectivesChanges.newObjectives], completedObjectives: [...prev.objectives.completedObjectives, ...objectivesChanges.completedObjectives] },
                    skills: { count: prev.skills.count + skillsChanges.totalCount, newSkills: [...prev.skills.newSkills, ...skillsChanges.newSkills], levelUps: [...prev.skills.levelUps, ...skillsChanges.levelUps] },
                    emotions: { count: prev.emotions.count + emotionsChanges.totalCount, significantChanges: [...prev.emotions.significantChanges, ...emotionsChanges.significantChanges] }
                  };
                  
                  // BADGES PERSISTEN HASTA QUE SE ABRA EL MODAL
                  return newBadges;
                });
                
                // Actualizar elementos NEW
                setNewElements(prevNew => ({
                  inventory: new Set([
                    ...prevNew.inventory,
                    ...inventoryChanges.newItems.map(item => item?.id || item?.name || JSON.stringify(item))
                  ]),
                  discovered: new Set([
                    ...prevNew.discovered,
                    ...discoveredChanges.newItems.map(item => item?.instanceId || item?.name || JSON.stringify(item))
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
              
              return data.game_state;
            }
            
            console.log('🔄 Sin cambios significativos');
            return prevState;
          });
        } else {
          console.error('❌ Error response:', response.status);
        }
      } catch (error) {
        console.error('❌ Error en polling:', error);
      }
    }, 2000);
    
    return () => {
      console.log('🔄 Limpiando polling interval');
      clearInterval(intervalId);
    };
  }, [sessionId, BACKEND_URL]);

  // Start new session - SOLUCION DEFINITIVA CON DEBUGGING COMPLETO
  const startNewSession = async (selectedMode = mode, campaignName, sandboxConcept) => {
    setLoading(true);
    setError(null);
    setGameOver(false);
    
    // 🔥 DEBUGGING COMPLETO OBLIGATORIO
    console.log('🚀 INICIANDO NUEVA SESIÓN:', {
      selectedMode,
      campaignName,
      sandboxConcept,
      BACKEND_URL,
      fullEndpoint: `${BACKEND_URL}/api/start_session`
    });
    
    // Reset badges y elementos new
    setBadges({
      inventory: { count: 0, newItems: [], removedItems: [] }, // CORREGIDO: incluir removedItems
      objectives: { count: 0, newObjectives: [], completedObjectives: [] },
      skills: { count: 0, newSkills: [], levelUps: [] },
      emotions: { count: 0, significantChanges: [] },
      discovered: { count: 0, newItems: [] } // NUEVO: reset discovered badge
    });
    
    setNewElements({
      inventory: new Set(),
      objectives: new Set(),
      skills: new Set(),
      emotions: new Set(),
      discovered: new Set() // NUEVO: reset discovered elements
    });
    
    // 🎁 RESET DISCOVERED ITEMS
    setDiscoveredItems([]);
    
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
      
      // Verificar que la URL no esté undefined
      if (!BACKEND_URL) {
        throw new Error('BACKEND_URL está undefined - revisar .env');
      }
      
      const endpoint = `${BACKEND_URL}/api/start_session`;
      console.log('📤 Haciendo fetch a:', endpoint);
      console.log('📦 Enviando body:', requestBody);

      // 📱 CONFIGURACIÓN MEJORADA PARA MÓVILES
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          
          
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        // Configuración adicional para móviles
        mode: 'cors',
        credentials: 'omit', // Simplificar para móviles
        keepalive: false
      });

      clearTimeout(timeoutId);

      console.log('📥 Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Respuesta no OK:', { status: response.status, errorText });
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to start session'}`);
      }

      const data = await response.json();
      console.log('✅ Sesión iniciada exitosamente:', data);
      
      setSessionId(data.session_id);
      setGameState(data.game_state);
      setShowSandboxForm(false);
      setNarrativeVisible(true);
      
      // 🎁 INICIALIZAR DISCOVERED ITEMS
      if (data.game_state.discoveredItems) {
        setDiscoveredItems(data.game_state.discoveredItems);
      }
      
      if (data.suggested_actions) {
        setSuggestedActions(data.suggested_actions);
      }
      
      if (socket) {
        socket.emit('join_session', { session_id: data.session_id });
      }

    } catch (err) {
      console.error('💥 ERROR COMPLETO EN startNewSession:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        BACKEND_URL,
        selectedMode,
        userAgent: navigator.userAgent,
        onLine: navigator.onLine,
        requestBody: {
          mode: selectedMode || 'sandbox',
          campaign: campaignName,
          sandboxConcept: sandboxConcept ? sandboxConcept.substring(0, 50) + '...' : undefined
        }
      });
      
      // 📱 MENSAJES DE ERROR ESPECÍFICOS PARA MÓVILES
      let errorMessage = 'Error al iniciar sesión';
      
      if (err.name === 'AbortError') {
        errorMessage = 'La conexión tardó demasiado. Verifica tu internet e intenta de nuevo.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMessage = 'Sin conexión al servidor. Verifica tu internet y intenta de nuevo.';
      } else if (err.message.includes('CORS')) {
        errorMessage = 'Error de configuración del servidor. Por favor reporta este problema.';
      } else if (!navigator.onLine) {
        errorMessage = 'Sin conexión a internet. Conéctate y intenta de nuevo.';
      } else {
        errorMessage = `Error de conexión: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Submit action - SOLUCION DEFINITIVA CON DEBUGGING COMPLETO
  const submitAction = useCallback(async (actionText) => {
    if (!sessionId || loading || gameOver) return;

    setLoading(true);
    setError(null);

    // 🔥 DEBUGGING COMPLETO OBLIGATORIO
    console.log('🚀 INICIANDO ENVÍO DE ACCIÓN:', {
      actionText,
      sessionId,
      BACKEND_URL,
      fullEndpoint: `${BACKEND_URL}/api/free_input`
    });

    try {
      const endpoint = `${BACKEND_URL}/api/free_input`;
      
      // Verificar que la URL no esté undefined
      if (!BACKEND_URL) {
        throw new Error('BACKEND_URL está undefined - revisar .env');
      }
      
      console.log('📤 Haciendo fetch a:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: actionText
        }),
      });

      console.log('📥 Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: response.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Respuesta no OK:', { status: response.status, errorText });
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to submit action'}`);
      }

      const data = await response.json();
      console.log('✅ Datos procesados exitosamente:', data);
      
      if (data.success || data.game_over) {
        setGameState(data.game_state);
        setNarrativeVisible(true);
        
        // 🎁 ACTUALIZAR DISCOVERED ITEMS
        if (data.game_state.discoveredItems) {
          setDiscoveredItems(data.game_state.discoveredItems);
        }
        
        if (data.suggested_actions) {
          setSuggestedActions(data.suggested_actions);
        }
        
        if (data.game_over) {
          setGameOver(true);
        }
      } else {
        console.error('❌ Error en respuesta del servidor:', data);
        setError('Error en la acción: ' + (data.error || 'Respuesta inesperada del servidor'));
      }

    } catch (err) {
      console.error('💥 ERROR COMPLETO EN submitAction:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        BACKEND_URL,
        sessionId,
        actionText
      });
      setError(`Error de conexión: ${err.message}`);
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
      setBadges(prev => ({ ...prev, inventory: { count: 0, newItems: [], removedItems: [] } })); // CORREGIDO: reset removedItems también
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

  // 🎁 NUEVO: Toggle discovered items modal
  const toggleDiscoveredItems = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowDiscoveredItems(!showDiscoveredItems);
    if (!showDiscoveredItems) {
      // Reset badge al abrir
      setBadges(prev => ({ ...prev, discovered: { count: 0, newItems: [] } }));
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

  // NARRATIVA COMPLETAMENTE REFACTORIZADA CON STATS + AUTO-SCROLL + ACCIONES INLINE + LOOT INTEGRADO
  const EnhancedNarrativeSection = () => {
    const vitals = gameState?.vitals || { health: 85, mana: 60, stamina: 80 };
    const location = gameState?.location || 'Ubicación Desconocida';
    const [inputText, setInputText] = useState('');
    
    // Auto-scroll effect para narrativa persistente
    const narrativeRef = useRef(null);
    
    useEffect(() => {
      if (narrativeRef.current) {
        narrativeRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, [gameState?.narrativeLog]);

    // Handler para input de texto
    const handleInputSubmit = (e) => {
      e.preventDefault();
      if (inputText.trim() && !loading) {
        submitAction(inputText.trim());
        setInputText('');
      }
    };

    // Handler para acciones embebidas
    const handleInlineAction = (action) => {
      handleSuggestedAction(action);
    };
    
    return (
      <div className="relative flex size-full min-h-screen flex-col justify-between group/design-root overflow-x-hidden bg-cover bg-center" style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAJWH6EnSX-8Xkhnosm7oS2bl_sKSqRdDChZEN7-PuoUUIU6zlqiS9llB7magO-XHBs_1teM4UBnYJyCxZcPdZakJHfhOq3kwM3a9W31YiPpaP81SyIMm9gdFl_SEwPYk5nkH0GUzOZVBhRhOXSCuXVq_CBR8IYg6k1k4hFdrPe0qsj9Bi6r4U7n_65tYw3-fMBpe1_Jl7wzMcdYwUXCoSHCFpWEiibVXic4EW4RvneThgIHeMv_kmoiMY1iYDxRse-fRf-JsLjGmY')"}}>
        <div className="flex-grow bg-white/30 backdrop-blur-sm">
          <header className="flex flex-col items-center p-4 sticky top-0 z-10 bg-gradient-to-b from-[var(--creamy-old)]/80 via-[var(--creamy-old)]/80 to-transparent">
            {/* TÍTULO Y STATUS */}
            <div className="flex items-center w-full mb-3">
              <div className="flex items-center gap-2">
                <div className="relative w-3 h-3">
                  <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 animate-ping"></div>
                  <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-500 m-auto border border-white"></div>
                </div>
                <span className="text-xs font-medium text-[var(--cedar-brown)]">
                  {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <h2 className="text-[var(--cedar-brown)] text-xl font-bold leading-tight tracking-tight flex-1 text-center">Hellbound RPG</h2>
              <div className="w-20"></div>
            </div>

            {/* BARRAS DE STATS INTEGRADAS - FINALMENTE VISIBLES */}
            <div className="w-full space-y-2 mb-2">
              {/* SALUD */}
              <div className="flex items-center gap-2">
                <span className="text-xl">❤️</span>
                <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden border border-[var(--cedar-brown)]/30">
                  <div 
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${Math.max(0, Math.min(100, vitals.health))}%`,
                      background: 'var(--health-bar)'
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-[var(--cedar-brown)] min-w-[25px]">
                  {vitals.health}
                </span>
              </div>

              {/* MANÁ */}
              <div className="flex items-center gap-2">
                <span className="text-xl">🔮</span>
                <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden border border-[var(--cedar-brown)]/30">
                  <div 
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${Math.max(0, Math.min(100, vitals.mana))}%`,
                      background: 'var(--mana-bar)'
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-[var(--cedar-brown)] min-w-[25px]">
                  {vitals.mana}
                </span>
              </div>

              {/* STAMINA */}
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden border border-[var(--cedar-brown)]/30">
                  <div 
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${Math.max(0, Math.min(100, vitals.stamina || 80))}%`,
                      background: 'var(--stamina-bar)'
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-[var(--cedar-brown)] min-w-[25px]">
                  {vitals.stamina || 80}
                </span>
              </div>
            </div>

            {/* UBICACIÓN */}
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--cedar-brown)]">
                📍 <span className="font-bold text-[var(--text-accent-custom)]">{location}</span>
              </p>
            </div>
          </header>
          
          {/* ÁREA PRINCIPAL DE NARRATIVA - APROVECHA TODA LA PANTALLA */}
          <main className="flex flex-col flex-grow p-4">
              
            {/* NARRATIVA PERSISTENTE CON AUTO-SCROLL + ACCIONES INLINE + LOOT INTEGRADO */}
            <div className="flex-grow flex flex-col">
              <div 
                ref={narrativeRef}
                className="flex-grow overflow-y-auto max-h-[60vh] bg-white/20 backdrop-blur-sm rounded-lg p-4 space-y-4 scrollbar-hide"
              >
                {gameState?.narrativeLog?.length === 0 ? (
                  <div className="text-center text-[var(--cedar-brown)]/70 italic">
                    Tu aventura está a punto de comenzar...
                  </div>
                ) : (
                  gameState?.narrativeLog?.map((entry, index) => (
                    <div key={index} className="narrative-text-enter opacity-0 animate-fadeIn" style={{animationDelay: `${index * 0.1}s`}}>
                      {/* ACCIÓN DEL JUGADOR */}
                      <div className="mb-2">
                        <p className="text-[var(--text-accent-custom)] text-base font-semibold flex items-center gap-2">
                          <span className="text-lg">▶️</span>
                          "{safeStringify(entry.player_action, 'Acción del jugador')}"
                        </p>
                      </div>
                      
                      {/* NARRATIVA DEL JUEGO */}
                      <div className="mb-3">
                        <p className="text-[var(--text-primary-custom)] text-sm leading-relaxed">
                          {safeStringify(entry.narrative, 'Narrativa del juego')}
                        </p>
                      </div>

                      {/* ACCIONES INLINE EMBEBIDAS (Solo en última entrada) */}
                      {index === gameState.narrativeLog.length - 1 && suggestedActions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 justify-center">
                          {suggestedActions.map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              onClick={() => handleInlineAction(action)}
                              disabled={loading || gameOver}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--imperial-gold)]/80 hover:bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-xs font-medium rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                            >
                              <span>{getActionIcon(action)}</span>
                              <span>{action}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* LOOT INTEGRADO (Solo en última entrada si hay items) */}
                      {index === gameState.narrativeLog.length - 1 && discoveredItems.length > 0 && (
                        <div className="mt-4 p-3 bg-[var(--light-caramel)]/50 border border-[var(--imperial-gold)] rounded-lg">
                          <h4 className="text-sm font-bold text-[var(--imperial-gold)] mb-2 flex items-center gap-1">
                            ✨ Objetos encontrados
                          </h4>
                          {discoveredItems.slice(0, 2).map((item, itemIndex) => (
                            <div key={item.instanceId || itemIndex} className="flex items-center justify-between mb-2 last:mb-0">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{item.icon || '📦'}</span>
                                <span className="text-xs font-medium text-[var(--cedar-brown)]">
                                  {safeStringify(item.name, 'Objeto')}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <button 
                                  className="px-2 py-1 bg-[var(--imperial-gold)] text-[var(--creamy-old)] text-xs font-bold rounded hover:bg-[var(--imperial-gold)]/80 transition-all duration-150 shadow-sm"
                                  onClick={() => pickupItem(item)}
                                  disabled={pickupLoading === item.instanceId}
                                >
                                  {pickupLoading === item.instanceId ? '...' : 'Recoger'}
                                </button>
                                <button 
                                  className="px-2 py-1 bg-transparent text-[var(--cedar-brown)] border border-[var(--cedar-brown)] text-xs font-bold rounded hover:bg-[var(--cedar-brown)] hover:text-[var(--creamy-old)] transition-all duration-150"
                                  onClick={() => ignoreItem(item)}
                                >
                                  Ignorar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* CUADRO DE LOOT ENCONTRADO */}
              {discoveredItems.length > 0 && (
                <div className="mt-4 p-4 bg-[var(--light-caramel)]/50 border border-[var(--imperial-gold)] rounded-lg shadow-md max-w-md mx-auto w-full">
                  <h3 className="text-xl font-bold text-[var(--imperial-gold)] mb-3">✨ ¡Botín Encontrado!</h3>
                  {discoveredItems.slice(0, 1).map((item, index) => (
                    <div key={item.instanceId || index}>
                      <div className="flex items-center mb-3">
                        <span className="material-icons text-3xl text-[var(--cedar-brown)] mr-3">{item.icon || 'shield'}</span>
                        <div>
                          <p className="text-[var(--cedar-brown)] font-semibold">{safeStringify(item.name, 'Escudo Antiguo')}</p>
                          <span className="text-sm font-medium text-[var(--emerald)] bg-emerald-500/10 px-2 py-0.5 rounded-full">Poco común</span>
                        </div>
                      </div>
                      <div className="flex justify-center gap-3">
                        <button 
                          className="ripple-effect flex items-center justify-center rounded-lg h-10 px-4 bg-[var(--imperial-gold)] text-[var(--creamy-old)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-highlight)] focus:ring-opacity-75"
                          onClick={() => pickupItem(item)}
                          disabled={pickupLoading === item.instanceId}
                        >
                          {pickupLoading === item.instanceId ? 'Recogiendo...' : 'Recoger'}
                        </button>
                        <button 
                          className="ripple-effect flex items-center justify-center rounded-lg h-10 px-4 bg-transparent text-[var(--cedar-brown)] border-2 border-[var(--cedar-brown)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 hover:bg-[var(--cedar-brown)] hover:text-[var(--emerald-highlight)] focus:outline-none focus:ring-2 focus:ring-[var(--imperial-gold)] focus:ring-opacity-75"
                          onClick={() => ignoreItem(item)}
                        >
                          Ignorar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ACCIONES RÁPIDAS CONTEXTUALES - SIEMPRE VISIBLES */}
              <div className="pt-4 grid grid-cols-2 gap-4 max-w-md mx-auto flex-shrink-0">
                {suggestedActions.length === 0 ? (
                  <>
                    <button 
                      className="ripple-effect flex items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-highlight)] focus:ring-opacity-75"
                      onClick={() => handleSuggestedAction('Luchar')}
                      disabled={loading || gameOver}
                    >
                      <span className="mr-2">⚔️</span>
                      <span className="truncate">Luchar</span>
                    </button>
                    <button 
                      className="ripple-effect flex items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-highlight)] focus:ring-opacity-75"
                      onClick={() => handleSuggestedAction('Huir')}
                      disabled={loading || gameOver}
                    >
                      <span className="mr-2">🏃</span>
                      <span className="truncate">Huir</span>
                    </button>
                    <button 
                      className="ripple-effect flex items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-highlight)] focus:ring-opacity-75"
                      onClick={() => handleSuggestedAction('Explorar')}
                      disabled={loading || gameOver}
                    >
                      <span className="material-icons align-middle mr-2">explore</span>
                      <span className="truncate">Explorar</span>
                    </button>
                    <button 
                      className="ripple-effect flex items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-highlight)] focus:ring-opacity-75"
                      onClick={() => handleSuggestedAction('Hablar')}
                      disabled={loading || gameOver}
                    >
                      <span className="material-icons align-middle mr-2">chat</span>
                      <span className="truncate">Hablar</span>
                    </button>
                  </>
                ) : (
                  suggestedActions.map((suggestedAction, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedAction(suggestedAction)}
                      disabled={loading || gameOver}
                      className="ripple-effect flex items-center justify-center overflow-hidden rounded-xl h-12 px-4 bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-sm font-bold leading-normal tracking-wide shadow-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--emerald-highlight)] focus:ring-opacity-75"
                    >
                      <span className="mr-2">{getActionIcon(suggestedAction)}</span>
                      <span className="truncate">{safeStringify(suggestedAction, 'Acción')}</span>
                    </button>
                  ))
                )}
              </div>
              {/* INPUT FIELD STICKY BOTTOM - FINALMENTE IMPLEMENTADO */}
              <div className="mt-4 sticky bottom-20 z-20">
                <form onSubmit={handleInputSubmit} className="relative">
                  <div className="relative bg-[var(--creamy-old)]/90 backdrop-blur-md rounded-full border-2 border-[var(--imperial-gold)] shadow-lg">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Escribe tu acción..."
                      disabled={loading || gameOver}
                      className="w-full px-4 py-3 pr-12 bg-transparent text-[var(--cedar-brown)] placeholder-[var(--cedar-brown)]/60 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--imperial-gold)] font-medium"
                    />
                    <button
                      type="submit"
                      disabled={loading || gameOver || !inputText.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--imperial-gold)] text-[var(--creamy-old)] rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-[var(--imperial-gold)]/80 transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--creamy-old)] border-t-transparent"></div>
                      ) : (
                        <span className="material-icons text-sm">send</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>

        {/* FOOTER STICKY CON 4 BOTONES CORRECTOS */}
        <footer className="sticky bottom-0 z-10">
          <nav className="flex gap-1 border-t border-[var(--imperial-gold)]/50 bg-[var(--creamy-old)]/80 backdrop-blur-md px-2 pt-2 pb-safe-bottom">
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--imperial-gold)] hover:bg-black/5 transition-colors"
              onClick={toggleInventory}
            >
              <span className="material-icons text-2xl">inventory</span>
              <span className="text-xs font-medium text-[var(--cedar-brown)]">Inventario</span>
            </button>
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--cedar-brown)] opacity-70 hover:opacity-100 hover:bg-black/5 transition-colors"
              onClick={toggleSkills}
            >
              <span className="material-icons text-2xl">school</span>
              <span className="text-xs font-medium">Habilidades</span>
            </button>
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--cedar-brown)] opacity-70 hover:opacity-100 hover:bg-black/5 transition-colors"
              onClick={toggleObjectives}
            >
              <span className="material-icons text-2xl">flag</span>
              <span className="text-xs font-medium">Objetivos</span>
            </button>
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--cedar-brown)] opacity-70 hover:opacity-100 hover:bg-black/5 transition-colors"
              onClick={toggleEmotionsModal}
            >
              <span className="material-icons text-2xl">mood</span>
              <span className="text-xs font-medium">Estados</span>
            </button>
          </nav>
          <div className="h-safe-bottom bg-[var(--creamy-old)]/80"></div>
        </footer>
      </div>
    );
  };

  // Header
  const GameHeader = () => {
    const vitals = gameState?.vitals || { health: 85, mana: 60, stamina: 80 };
    const location = gameState?.location || 'Ubicación Desconocida';
    
    return (
      <header className="hellbound-header sticky top-0 z-50 p-3">
        {/* STATUS Y TÍTULO */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 animate-ping"></div>
              <div className="relative w-2 h-2 rounded-full bg-emerald-500 m-auto border border-white"></div>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--cedar-brown)' }}>
              {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--cedar-brown)' }}>
            Hellbound RPG
          </h1>
          <div className="w-8"></div>
        </div>

        {/* STATS BARS */}
        <div className="space-y-2">
          {/* SALUD */}
          <div className="flex items-center gap-2">
            <span className="text-2xl icon-shadow">❤️</span>
            <div className="w-full h-3 stats-bar-bg rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, vitals.health))}%`,
                  background: 'var(--health-bar)'
                }}
              />
            </div>
            <span className="text-xs font-medium min-w-[30px]" style={{ color: 'var(--cedar-brown)' }}>
              {vitals.health}
            </span>
          </div>

          {/* MANÁ */}
          <div className="flex items-center gap-2">
            <span className="text-2xl icon-shadow">🔮</span>
            <div className="w-full h-3 stats-bar-bg rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, vitals.mana))}%`,
                  background: 'var(--mana-bar)'
                }}
              />
            </div>
            <span className="text-xs font-medium min-w-[30px]" style={{ color: 'var(--cedar-brown)' }}>
              {vitals.mana}
            </span>
          </div>

          {/* STAMINA */}
          <div className="flex items-center gap-2">
            <span className="text-2xl icon-shadow">⚡</span>
            <div className="w-full h-3 stats-bar-bg rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, vitals.stamina || 80))}%`,
                  background: 'var(--stamina-bar)'
                }}
              />
            </div>
            <span className="text-xs font-medium min-w-[30px]" style={{ color: 'var(--cedar-brown)' }}>
              {vitals.stamina || 80}
            </span>
          </div>
        </div>

        {/* UBICACIÓN */}
        <div className="mt-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--cedar-brown)' }}>
            Ubicación: <span className="font-bold" style={{ color: 'var(--text-accent-custom)' }}>
              {location}
            </span>
          </p>
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

  // BARRA POPUPS CON BADGES VIVOS - CORREGIDO CON CSS INLINE + DISCOVERED ITEMS
  const PopupsBar = () => (
    <div className="popups-bar">
      <button 
        className="popup-button clickable"
        onClick={toggleInventory}
        aria-label="Inventario"
        style={{ position: 'relative' }}
      >
        📦
        <span className="popup-label">Inv.</span>
        {/* BADGE INVENTARIO: CSS inline funcionando */}
        {badges.inventory.count > 0 ? (
          <div style={{
            position: 'absolute',
            top: '-8px', 
            right: '-8px',
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 10,
            animation: 'pulse 2s infinite'
          }}>
            {badges.inventory.count}
          </div>
        ) : null}
      </button>
      
      {/* 🎁 NUEVO: Botón discovered items */}
      <button 
        className="popup-button clickable"
        onClick={toggleDiscoveredItems}
        aria-label="Items Descubiertos"
        style={{ position: 'relative' }}
      >
        🎁
        <span className="popup-label">Items</span>
        {/* BADGE DISCOVERED: CSS inline funcionando */}
        {badges.discovered.count > 0 ? (
          <div style={{
            position: 'absolute',
            top: '-8px', 
            right: '-8px',
            background: '#f59e0b',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 10,
            animation: 'pulse 2s infinite'
          }}>
            {badges.discovered.count}
          </div>
        ) : null}
        {/* Mostrar badge también si hay items sin recoger */}
        {discoveredItems.length > 0 && badges.discovered.count === 0 ? (
          <div style={{
            position: 'absolute',
            top: '-8px', 
            right: '-8px',
            background: '#10b981',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 10
          }}>
            {discoveredItems.length}
          </div>
        ) : null}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleObjectives}
        aria-label="Objetivos"
        style={{ position: 'relative' }}
      >
        🎯
        <span className="popup-label">Obj.</span>
        {/* BADGE OBJETIVOS: CSS inline funcionando */}
        {badges.objectives.count > 0 ? (
          <div style={{
            position: 'absolute',
            top: '-8px', 
            right: '-8px',
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 10,
            animation: 'pulse 2s infinite'
          }}>
            {badges.objectives.count}
          </div>
        ) : null}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleSkills}
        aria-label="Habilidades"
        style={{ position: 'relative' }}
      >
        📚
        <span className="popup-label">Skills</span>
        {/* BADGE SKILLS: CORREGIDO - CSS inline */}
        {badges.skills.count > 0 ? (
          <div style={{
            position: 'absolute',
            top: '-8px', 
            right: '-8px',
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 10,
            animation: 'pulse 2s infinite'
          }}>
            {badges.skills.count}
          </div>
        ) : null}
      </button>
      
      <button 
        className="popup-button clickable"
        onClick={toggleEmotionsModal}
        aria-label="Estados"
        style={{ position: 'relative' }}
      >
        😌
        <span className="popup-label">Estados</span>
        {/* BADGE EMOTIONS: CORREGIDO - CSS inline */}
        {badges.emotions.count > 0 ? (
          <div style={{
            position: 'absolute',
            top: '-8px', 
            right: '-8px',
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            zIndex: 10,
            animation: 'pulse 2s infinite'
          }}>
            {badges.emotions.count}
          </div>
        ) : null}
      </button>
    </div>
  );

  // Controls Bar
  const ControlsBar = () => (
    <div className="controls-bar">
      <div className="controls-content-clean">
        <StoryInput 
          
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
      activas: skills.filter(skill => {
        const category = skill?.category || skill?.type;
        return category === 'activa' || category === 'active' || !category;
      }),
      magia: skills.filter(skill => {
        const category = skill?.category || skill?.type;
        return category === 'magia' || category === 'magic';
      }),
      pasivas: skills.filter(skill => {
        const category = skill?.category || skill?.type;
        return category === 'pasiva' || category === 'passive';
      })
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

  // 🎁 NUEVO: Modal Discovered Items
  const DiscoveredItemsModal = () => {
    return (
      <>
        <div 
          className={`modal-overlay ${showDiscoveredItems ? 'show' : ''}`}
          onClick={() => setShowDiscoveredItems(false)}
        />
        <div className={`popup-modal discovered-popup ${showDiscoveredItems ? 'show' : ''}`}>
          <div className="modal-header">
            <span>🎁 Items Descubiertos ({discoveredItems.length})</span>
            <button 
              className="modal-close clickable" 
              onClick={() => setShowDiscoveredItems(false)}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="modal-content">
            {discoveredItems.length === 0 ? (
              <p className="no-items-message">
                No hay items descubiertos. Usa acciones como "busco algo valioso" para encontrar tesoros.
              </p>
            ) : (
              <div className="discovered-items-grid-large">
                {discoveredItems.map((item, index) => {
                  const isNew = isElementNew('discovered', item?.instanceId || item?.name || JSON.stringify(item));
                  return (
                    <div 
                      key={item.instanceId || index} 
                      className={`discovered-item-card-large clickable ${isNew ? 'new-item' : ''} ${pickupLoading === item.instanceId ? 'loading' : ''}`}
                      onClick={() => {
                        if (isNew) markElementSeen('discovered', item?.instanceId || item?.name || JSON.stringify(item));
                        pickupItem(item);
                      }}
                      disabled={pickupLoading === item.instanceId}
                    >
                      <div className="item-icon-large">{item.icon || '📦'}</div>
                      <div className="item-info">
                        <div className="item-name-large">{safeStringify(item.name, 'Item Desconocido')}</div>
                        {item.description && (
                          <div className="item-description">{safeStringify(item.description, '')}</div>
                        )}
                        {item.type && (
                          <div className="item-type">Tipo: {safeStringify(item.type, '')}</div>
                        )}
                        {item.contexts && item.contexts.length > 0 && (
                          <div className="item-contexts">
                            Contexto: {item.contexts.join(', ')}
                          </div>
                        )}
                      </div>
                      {isNew && <div className="new-indicator-large">NEW!</div>}
                      {pickupLoading === item.instanceId ? (
                        <div className="pickup-loading-large">Recogiendo...</div>
                      ) : (
                        <div className="pickup-hint">Click para recoger</div>
                      )}
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
          <div className="welcome-screen">
            <div className="welcome-container">
              <header className="w-full flex flex-col items-center mb-8">
                <h1 className="welcome-title">HELLBOUND RPG</h1>
                <div className="status-bars-container">
                  <div className="status-bar-new">
                    <span className="material-icons">favorite</span>
                    <span>100/100</span>
                  </div>
                  <div className="status-bar-new">
                    <span className="material-icons">bolt</span>
                    <span>50/50</span>
                  </div>
                </div>
              </header>
              
              <p className="welcome-subtitle">
                Elige tu camino en una aventura épica donde cada decisión forja tu destino...
              </p>
              
              <div className="mode-buttons-container">
                <button 
                  className="btn-primary-new" 
                  onClick={() => {
                    setMode('sandbox');
                    setShowSandboxForm(true);
                  }}
                >
                  Modo Libre
                </button>
                <button 
                  className="btn-secondary-new" 
                  onClick={() => setMode('campaign')}
                >
                  Campaña
                </button>
              </div>
            </div>
          </div>
        ) : showSandboxForm && mode === 'sandbox' ? (
          <div className="welcome-screen">
            <div className="welcome-container">
              <h2 className="welcome-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                Modo Libre - Historia Personalizada
              </h2>
              <p className="welcome-subtitle">
                Describe la historia que quieres vivir.
              </p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <textarea
                  value={sandboxConcept}
                  onChange={(e) => setSandboxConcept(e.target.value)}
                  placeholder="Ejemplo: 'Detective paranormal investigando desapariciones misteriosas en una ciudad sombría.'"
                  className="textarea-new"
                  required
                  minLength={20}
                />
              </div>
              
              <div className="buttons-row">
                <button
                  onClick={() => startNewSession('sandbox', null, sandboxConcept)}
                  disabled={loading || sandboxConcept.trim().length < 20}
                  className="btn-primary-new"
                >
                  {loading ? 'Creando historia...' : 'Iniciar Aventura'}
                </button>
                <button
                  onClick={() => {
                    setMode(null);
                    setShowSandboxForm(false);
                    setSandboxConcept('');
                  }}
                  disabled={loading}
                  className="btn-secondary-new"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-container">
              <h2 className="welcome-title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                {mode === 'campaign' ? 'Campaña' : 'Modo Temporal'}
              </h2>
              <p className="welcome-subtitle">
                Modo seleccionado: <strong>
                  {mode === 'sandbox' ? 'Modo Libre' : 
                   mode === 'campaign' ? 'Campaña' : 
                   'Campaña Temporal'}
                </strong>
              </p>
              
              <div className="buttons-row">
                <button
                  onClick={() => startNewSession(mode, 'scenes_act1')}
                  disabled={loading}
                  className="btn-primary-new"
                >
                  {loading ? 'Iniciando...' : `Iniciar ${
                    mode === 'sandbox' ? 'Modo Libre' : 
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
                  className="btn-secondary-new"
                >
                  Cambiar Modo
                </button>
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
          {/* Header integrado dentro de EnhancedNarrativeSection */}
          <EnhancedNarrativeSection />
          
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
          <DiscoveredItemsModal />
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