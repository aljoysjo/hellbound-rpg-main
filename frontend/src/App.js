import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './App.css';
import WelcomeScreen from './components/WelcomeScreen';
import SandboxForm from './components/SandboxForm';
import ResponsiveHeader from './components/ResponsiveHeader';
import StoryInput from './components/StoryInput';
import RandomEventModal from './components/RandomEventModal';
import DiscoveredItemsModal from './components/DiscoveredItemsModal'; // NUEVO MODAL PORTAL (CHATGPT)

// this is test comment

// 🎮 MAIN APP COMPONENT - LAYOUT CORREGIDO + PANTALLA INICIO RESTAURADA
function App() {
  // 🎲 ESTADO EVENTOS ALEATORIOS
  const [randomEvent, setRandomEvent] = useState(null);
  const [showRandomEventModal, setShowRandomEventModal] = useState(false);
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
  const [sandboxConcept, setSandboxConcept] = useState('');
  
  // UI States
  const [narrativeVisible, setNarrativeVisible] = useState(true);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showEmotionsModal, setShowEmotionsModal] = useState(false);
  const [showNarrativeModal, setShowNarrativeModal] = useState(false);
  const [showDiscoveredItems, setShowDiscoveredItems] = useState(false);

  // 🎁 SISTEMA DISCOVERED ITEMS
  const [discoveredItems, setDiscoveredItems] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(null);

  // 🔧 FUNCIÓN CLOSE MODAL SIMPLIFICADA (CHATGPT - SOLO MANUAL)
  const closeDiscoveredModal = () => {
    console.log('🎁 CLOSING MODAL: User manually closed modal');
    setShowDiscoveredItems(false);
  };

  // SISTEMA BADGES "VIVOS" MEJORADO
  const [badges, setBadges] = useState({
    inventory: { count: 0, newItems: [], removedItems: [] },
    objectives: { count: 0, newObjectives: [], completedObjectives: [] },
    skills: { count: 0, newSkills: [], levelUps: [] },
    emotions: { count: 0, significantChanges: [] },
    discovered: { count: 0, newItems: [] }
  });

  // 🎯 USEEFFECT SIMPLIFICADO (CHATGPT SOLUTION) 
  useEffect(() => {
    console.log(`🔍 DISCOVEREDTEMS CHANGE: length=${discoveredItems.length}, showModal=${showDiscoveredItems}`);
    // 👇 se dispara SOLO cuando llega un lote nuevo y showDiscoveredItems está en false
    if (discoveredItems.length > 0 && !showDiscoveredItems) {
      console.log(`🎁 ABRIENDO MODAL: ${discoveredItems.length} items descubiertos`);
      setShowDiscoveredItems(true);
      console.log(`🎁 Modal abierto - sin modalLocked`);
    }
  }, [discoveredItems, showDiscoveredItems]);

  // 🔍 PASO 2.4 CHATGPT: Instrumentación para debugging modal rendering
  useEffect(() => {
    if (showDiscoveredItems) {
      console.log('💥 Render modal ahora - showDiscoveredItems is TRUE');
    } else {
      console.log('❌ Modal NOT rendering - showDiscoveredItems is FALSE');
    }
  }, [showDiscoveredItems]);

  // Persistencia de elementos "NEW"
  const [newElements, setNewElements] = useState({
    inventory: new Set(),
    objectives: new Set(), 
    skills: new Set(),
    emotions: new Set(),
    discovered: new Set()
  });

  // 🖼️ NUEVO: Estado para imagen de escena
  const [sceneImage, setSceneImage] = useState('/images/placeholder_scene.svg');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
  const fadeTimeoutRef = useRef(null);
  const narrativeRef = useRef(null);
  
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

  // 🎁 FUNCIÓN PICKUP ITEM
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
      
      // 🎮 ACTUALIZAR GAMESTATE Y ACTIVAR BADGES
      setGameState(prevState => {
        if (prevState && data.game_state) {
          // 🏆 DETECTAR CAMBIOS DE INVENTARIO PARA BADGES
          const inventoryChanges = detectInventoryChanges(
            prevState.inventory, 
            data.game_state.inventory
          );
          
          if (inventoryChanges.totalCount > 0) {
            console.log('🏆 ACTIVANDO BADGE POR PICKUP:', inventoryChanges);
            
            // Actualizar badges
            setBadges(prevBadges => ({
              ...prevBadges,
              inventory: {
                count: prevBadges.inventory.count + inventoryChanges.totalCount,
                newItems: [...prevBadges.inventory.newItems, ...inventoryChanges.newItems]
              }
            }));
            
            // Marcar como nuevo elemento
            setNewElements(prevNew => ({
              ...prevNew,
              inventory: new Set([
                ...prevNew.inventory,
                ...inventoryChanges.newItems.map(item => item?.id || item?.name || JSON.stringify(item))
              ])
            }));
          }
        }
        
        return data.game_state;
      });
      
      setDiscoveredItems(prev => prev.filter(i => i.instanceId !== item.instanceId));
      
    } catch (error) {
      console.error('❌ Error recogiendo item:', error);
      setError(`Error recogiendo ${item.name}: ${error.message}`);
    } finally {
      setPickupLoading(null);
    }
  };

  // 🔧 ESTADO PARA ITEMS IGNORADOS PERSISTENTES
  const [ignoredItems, setIgnoredItems] = useState(new Set());

  const ignoreItem = (item) => {
    console.log('🚫 Ignorando item permanentemente:', item);
    
    // Añadir a lista de ignorados
    setIgnoredItems(prev => new Set([...prev, item.instanceId]));
    
    // Remover de discovered items
    setDiscoveredItems(prev => prev.filter(i => i.instanceId !== item.instanceId));
    
    // 📡 COMUNICAR AL BACKEND QUE SE IGNORÓ EL ITEM
    if (sessionId) {
      fetch(`${BACKEND_URL}/api/ignore_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          item_id: item.instanceId
        })
      }).catch(error => {
        console.error('❌ Error comunicando item ignorado:', error);
      });
    }
  };

  // 🔧 ARREGLO: Funciones de manejo para componentes nuevos
  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
  };

  const handleSandboxSubmit = (concept) => {
    startNewSession('sandbox', null, concept);
  };

  const handleBackToModeSelection = () => {
    setShowSandboxForm(false);
    setMode(null);
  };

  // Auto-scroll effect para narrativa persistente
  useEffect(() => {
    if (narrativeRef.current) {
      narrativeRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [gameState?.narrativeLog]);

  // Handler para acciones embebidas
  const handleInlineAction = (action) => {
    handleSuggestedAction(action);
  };

  // 🖼️ SISTEMA DE IMAGEN CONTEXTUAL
  const getContextualImage = (location, narrative) => {
    // Placeholder por defecto
    const defaultPlaceholder = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm6u8nnWv-JiuMn-jRh5QHLwXtoBWwvHDYjbp58LipPXqnKl_bxngkbZMEfbpbPq_JogV8gh7VFojqy2M2l7Qzl5dv-nbu5SYDuB-rIsT3JZgACXWOxNeas25kigZu65isTVYl5-rBgzkuWHB5DF4hJRQ7fKQe2v3GJ_lbUlXiSB2pEvMsKSTlDg9w02KtOdKqnlWqiRbUQCZGuCGX0pXVSMf-3xyesYbdn3K1wPJP3ecu6cipjCWaF9wmqRlRsahCe41b6Pd_igs';
    
    // TODO: Aquí se puede implementar lógica para cambiar imagen según contexto
    if (location?.toLowerCase().includes('alicante')) {
      return 'https://lh3.googleusercontent.com/aida-public/AB6AXuAJWH6EnSX-8Xkhnosm7oS2bl_sKSqRdDChZEN7-PuoUUIU6zlqiS9llB7magO-XHBs_1teM4UBnYJyCxZcPdZakJHfhOq3kwM3a9W31YiPpaP81SyIMm9gdFl_SEwPYk5nkH0GUzOZVBhRhOXSCuXVq_CBR8IYg6k1k4hFdrPe0qsj9Bi6r4U7n_65tYw3-fMBpe1_Jl7wzMcdYwUXCoSHCFpWEiibVXic4EW4RvneThgIHeMv_kmoiMY1iYDxRse-fRf-JsLjGmY';
    }
    
    return defaultPlaceholder;
  };

  // DETECCIÓN DE CAMBIOS Y BADGES (código existente)
  const detectInventoryChanges = (prevInventory, currentInventory) => {
    const prev = Array.isArray(prevInventory) ? prevInventory : [];
    const current = Array.isArray(currentInventory) ? currentInventory : [];
    
    const prevIds = new Set(prev.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    const currentIds = new Set(current.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    
    const newItems = current.filter(item => {
      const itemId = item?.instanceId || item?.name || JSON.stringify(item);
      return !prevIds.has(itemId);
    });
    
    const removedItems = prev.filter(item => {
      const itemId = item?.instanceId || item?.name || JSON.stringify(item);
      return !currentIds.has(itemId);
    });
    
    return {
      newItems,
      removedItems,
      totalCount: newItems.length + removedItems.length
    };
  };

  const detectDiscoveredChanges = (prevDiscovered, currentDiscovered) => {
    const prev = Array.isArray(prevDiscovered) ? prevDiscovered : [];
    const current = Array.isArray(currentDiscovered) ? currentDiscovered : [];
    
    const prevIds = new Set(prev.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    const currentIds = new Set(current.map(item => item?.instanceId || item?.name || JSON.stringify(item)));
    
    const newItems = current.filter(item => {
      const itemId = item?.instanceId || item?.name || JSON.stringify(item);
      return !prevIds.has(itemId);
    });
    
    return {
      newItems,
      totalCount: newItems.length
    };
  };

  const detectObjectivesChanges = (prevObjectives, currentObjectives) => {
    const prev = Array.isArray(prevObjectives) ? prevObjectives : [];
    const current = Array.isArray(currentObjectives) ? currentObjectives : [];
    
    const prevIds = prev.map(obj => obj?.id || obj?.description || JSON.stringify(obj));
    const currentIds = current.map(obj => obj?.id || obj?.description || JSON.stringify(obj));
    
    const prevCompleted = prev.filter(obj => obj?.completed).map(obj => obj?.id || obj?.description);
    const currentCompleted = current.filter(obj => obj?.completed).map(obj => obj?.id || obj?.description);
    
    const newObjectives = current.filter(obj => {
      const objId = obj?.id || obj?.description || JSON.stringify(obj);
      return !prevIds.includes(objId);
    });
    
    const completedObjectives = currentCompleted.filter(id => !prevCompleted.includes(id));
    
    return {
      newObjectives,
      completedObjectives,
      totalCount: newObjectives.length + completedObjectives.length
    };
  };

  const detectSkillsChanges = (prevSkills, currentSkills) => {
    const prev = Array.isArray(prevSkills) ? prevSkills : [];
    const current = Array.isArray(currentSkills) ? currentSkills : [];
    
    const prevIds = prev.map(skill => skill?.id || skill?.name || JSON.stringify(skill));
    const currentIds = current.map(skill => skill?.id || skill?.name || JSON.stringify(skill));
    
    const newSkills = current.filter(skill => {
      const skillId = skill?.id || skill?.name || JSON.stringify(skill);
      return !prevIds.includes(skillId);
    });
    
    const levelUps = [];
    current.forEach(currentSkill => {
      const prevSkill = prev.find(p => (p?.id || p?.name) === (currentSkill?.id || currentSkill?.name));
      if (prevSkill && currentSkill?.level && prevSkill?.level && currentSkill.level > prevSkill.level) {
        levelUps.push(currentSkill);
      }
    });
    
    return {
      newSkills,
      levelUps,
      totalCount: newSkills.length + levelUps.length
    };
  };

  const detectEmotionsChanges = (prevEmotions, currentEmotions) => {
    const prev = prevEmotions || {};
    const current = currentEmotions || {};
    
    const significantChanges = [];
    
    Object.keys(current).forEach(emotion => {
      const prevValue = prev[emotion] || 0;
      const currentValue = current[emotion] || 0;
      
      if (Math.abs(currentValue - prevValue) >= 15) {
        significantChanges.push({
          emotion,
          change: currentValue - prevValue,
          current: currentValue
        });
      }
    });
    
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

  // 🔧 ARREGLO CRÍTICO: Auto-iniciar sandbox cuando se selecciona el modo
  useEffect(() => {
    if (mode === 'sandbox' && !gameState && !loading && !showSandboxForm) {
      console.log('🎮 Auto-iniciando sandbox mode');
      startNewSession('sandbox');
    }
  }, [mode, gameState, loading, showSandboxForm]);

  // Socket initialization CON DETECCIÓN AVANZADA + FALLBACK POLLING
  useEffect(() => {
    console.log('🔌 Iniciando conexión WebSocket a:', BACKEND_URL);
    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
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
            
            // 🖼️ ACTUALIZAR IMAGEN CONTEXTUAL
            const newImage = getContextualImage(data.game_state.location, data.game_state.narrativeLog?.[data.game_state.narrativeLog.length - 1]?.narrative);
            if (newImage !== sceneImage) {
              setSceneImage(newImage);
            }
            
            if (data.game_state.discoveredItems) {
              console.log('🎁 FRONTEND: Recibidos discovered items:', data.game_state.discoveredItems);
              setDiscoveredItems(prev => {
                console.log('📝 setDiscoveredItems - prev', prev, 'next', data.game_state.discoveredItems); // PUNTO 2 CHATGPT
                return data.game_state.discoveredItems;
              });
            } else {
              console.log('🎁 FRONTEND: No hay discovered items en la respuesta');
            }
            
            // 🔍 DETAILED INVENTORY DEBUG  
          console.log('📦 FRONTEND: Current gameState.inventory:', gameState?.inventory);
          console.log('📦 FRONTEND: Inventory length:', gameState?.inventory?.length || 0);
            if (prevState) {
              console.log('🔍 DETECTING CHANGES...');
              const inventoryChanges = detectInventoryChanges(
                prevState.inventory, 
                data.game_state.inventory
              );
              
              const discoveredChanges = detectDiscoveredChanges(
                prevState.discoveredItems,
                data.game_state.discoveredItems
              );
              
              const objectivesChanges = detectObjectivesChanges(
                prevState.questObjectives,
                data.game_state.questObjectives
              );
              
              const skillsChanges = detectSkillsChanges(
                prevState.skills,
                data.game_state.skills
              );
              
              const emotionsChanges = detectEmotionsChanges(
                prevState.emotionalStates,
                data.game_state.emotionalStates
              );
              
              console.log('🎯 CHANGES DETECTED:', { inventoryChanges, discoveredChanges, objectivesChanges, skillsChanges, emotionsChanges });
              
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
                  
                  return newBadges;
                });
                
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

  // SISTEMA DE POLLING ÚNICO PARA BADGES
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
              if (data.game_state.discoveredItems) {
                setDiscoveredItems(prev => {
                  console.log('📝 setDiscoveredItems - prev', prev, 'next', data.game_state.discoveredItems); // PUNTO 2 CHATGPT
                  return data.game_state.discoveredItems;
                });
              }
              return data.game_state;
            }
            
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
              
              // 🎯 BADGE POLLING - DUAL APPROACH (CHATGPT SOLUTION)
              if ((data.game_state.inventory?.length || 0) !== (prevState.inventory?.length || 0)) {
                console.log(`📦 BADGE UPDATE: inventory ${prevState.inventory?.length || 0} → ${data.game_state.inventory?.length || 0}`);
                setBadges(prev => ({
                  ...prev,
                  inventory: {
                    ...prev.inventory,
                    count: data.game_state.inventory?.length || 0
                  }
                }));
              }
              
              setNarrativeVisible(true);
              
              if (data.game_state.discoveredItems) {
                setDiscoveredItems(prev => {
                  console.log('📝 setDiscoveredItems - prev', prev, 'next', data.game_state.discoveredItems); // PUNTO 2 CHATGPT
                  return data.game_state.discoveredItems;
                });
              }
              
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
                  
                  return newBadges;
                });
                
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

  // Start new session
  const startNewSession = async (selectedMode = mode, campaignName, sandboxConcept) => {
    setLoading(true);
    setError(null);
    setGameOver(false);
    
    console.log('🚀 INICIANDO NUEVA SESIÓN:', {
      selectedMode,
      campaignName,
      sandboxConcept,
      BACKEND_URL,
      fullEndpoint: `${BACKEND_URL}/api/start_session`
    });
    
    setBadges({
      inventory: { count: 0, newItems: [], removedItems: [] },
      objectives: { count: 0, newObjectives: [], completedObjectives: [] },
      skills: { count: 0, newSkills: [], levelUps: [] },
      emotions: { count: 0, significantChanges: [] },
      discovered: { count: 0, newItems: [] }
    });
    
    setNewElements({
      inventory: new Set(),
      objectives: new Set(),
      skills: new Set(),
      emotions: new Set(),
      discovered: new Set()
    });
    
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
      
      if (!BACKEND_URL) {
        throw new Error('BACKEND_URL está undefined - revisar .env');
      }
      
      const endpoint = `${BACKEND_URL}/api/start_session`;
      console.log('📤 Haciendo fetch a:', endpoint);
      console.log('📦 Enviando body:', requestBody);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
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
      
      // 🖼️ ESTABLECER IMAGEN INICIAL
      const initialImage = getContextualImage(data.game_state.location, data.game_state.narrativeLog?.[0]?.narrative);
      setSceneImage(initialImage);
      
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

  // Submit action
  const submitAction = useCallback(async (actionText) => {
    if (!sessionId || loading || gameOver) return;

    setLoading(true);
    setError(null);

    console.log('🚀 INICIANDO ENVÍO DE ACCIÓN:', {
      actionText,
      sessionId,
      BACKEND_URL,
      fullEndpoint: `${BACKEND_URL}/api/free_input`
    });

    try {
      const endpoint = `${BACKEND_URL}/api/free_input`;
      
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
        
        // 🎲 MANEJAR EVENTOS ALEATORIOS
        if (data && data.random_event) {
          console.log('🎲 Evento aleatorio recibido:', data.random_event);
          setRandomEvent(data.random_event);
          setShowRandomEventModal(true);
        }
        
        // 🖼️ ACTUALIZAR IMAGEN CONTEXTUAL
        const newImage = getContextualImage(data.game_state.location, data.game_state.narrativeLog?.[data.game_state.narrativeLog.length - 1]?.narrative);
        if (newImage !== sceneImage) {
          setSceneImage(newImage);
        }
        
        if (data.game_state.discoveredItems) {
          console.log('🛬 API payload.discoveredItems =', data.game_state.discoveredItems); // PUNTO 1 CHATGPT
          console.log('🎁 FRONTEND: Recibidos discovered items:', data.game_state.discoveredItems);
          console.log('🎁 FRONTEND: discoveredItems.length:', data.game_state.discoveredItems.length);
          console.log('🎁 FRONTEND: Setting discoveredItems state...');
          setDiscoveredItems(prev => {
            console.log('📝 setDiscoveredItems - prev', prev, 'next', data.game_state.discoveredItems); // PUNTO 2 CHATGPT
            return data.game_state.discoveredItems;
          });
          console.log('🎁 FRONTEND: discoveredItems state updated');
        } else {
          console.log('🎁 FRONTEND: No hay discovered items en la respuesta');
          console.log('🎁 FRONTEND: data.game_state keys:', Object.keys(data.game_state || {}));
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
  }, [sessionId, loading, gameOver, BACKEND_URL, sceneImage]);

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
      setBadges(prev => ({ ...prev, objectives: { count: 0, newObjectives: [], completedObjectives: [] } }));
    }
  };

  const toggleInventory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowInventory(!showInventory);
    if (!showInventory) {
      setBadges(prev => ({ ...prev, inventory: { count: 0, newItems: [], removedItems: [] } }));
    }
  };

  const toggleSkills = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowSkills(!showSkills);
    if (!showSkills) {
      setBadges(prev => ({ ...prev, skills: { count: 0, newSkills: [], levelUps: [] } }));
    }
  };

  const toggleEmotionsModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowEmotionsModal(!showEmotionsModal);
    if (!showEmotionsModal) {
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

  const toggleDiscoveredItems = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceBlurAll();
    setShowDiscoveredItems(!showDiscoveredItems);
    if (!showDiscoveredItems) {
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
    if (actionLower.includes('usar') || actionLower.includes('utilizar')) return '🛠️';
    if (actionLower.includes('abrir') || actionLower.includes('entrar')) return '🚪';
    if (actionLower.includes('explorar') || actionLower.includes('investigar')) return '🔍';
    return '⚡';
  };

  const getSkillIcon = (skillName) => {
    if (!skillName || typeof skillName !== 'string') return '⭐';
    if (skillName.includes('combate')) return '⚔️';
    if (skillName.includes('magia')) return '🔮';
    if (skillName.includes('stealth')) return '🥷';
    if (skillName.includes('social')) return '🗣️';
    return '✨';
  };

  // 🎮 LAYOUT PRINCIPAL COMPLETO CON TODO FUNCIONANDO
  const EnhancedNarrativeSection = () => {
    return (
      <div className="flex flex-col h-screen bg-gradient-to-br from-[var(--creamy-old)] to-[var(--light-caramel)]">
        
        {/* HEADER RESPONSIVO: MINIMALISTA MÓVIL + COMPLETO DESKTOP */}
        <ResponsiveHeader gameState={gameState} connectionStatus={connectionStatus} />

        {/* MAIN CON SCROLL CONTENIDO - SIN INPUT DENTRO */}
        <main className="flex-1 overflow-y-auto px-4 space-y-4">
          
          {/* 🖼️ IMAGEN/PLACEHOLDER CONTEXTUAL */}
          <div
            className="w-full aspect-[16/9] rounded-xl bg-center bg-cover shadow-lg"
            style={{ backgroundImage: `url(${sceneImage})` }}
          />

          {/* NARRATIVA PERSISTENTE + CHIPS INLINE */}
          <article className="prose max-w-none text-[var(--text-primary-custom)] space-y-4 mb-4">
            {gameState?.narrativeLog?.length === 0 ? (
              <div className="text-center text-[var(--cedar-brown)]/70 italic py-8">
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

                  {/* CHIPS DE ACCIÓN INLINE (Solo en última entrada) */}
                  {index === gameState.narrativeLog.length - 1 && suggestedActions.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                      {suggestedActions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => handleInlineAction(action)}
                          disabled={loading || gameOver}
                          className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-full bg-[var(--imperial-gold)]/10 hover:bg-[var(--imperial-gold)] text-[var(--cedar-brown)] font-medium transition-all duration-200 hover:scale-105 active:scale-95 border border-[var(--imperial-gold)]/30"
                        >
                          <span>{getActionIcon(action)}</span>
                          <span>{action}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={narrativeRef} />
          </article>

          {/* 🎁 MODAL DISCOVERED ITEMS - PORTAL DEFINITIVO (CHATGPT SOLUCIÓN 100% SEGURA) */}
          {showDiscoveredItems && (
            <DiscoveredItemsModal
              discoveredItems={cachedItems}
              showDiscoveredItems={showDiscoveredItems}
              onPickupItem={pickupItem}
              onIgnoreItem={ignoreItem}
              onCloseModal={closeDiscoveredModal}
            />
          )}

        </main>
      </div>
    );
  };

  // Game Over screen
  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-black flex items-center justify-center">
        <div className="game-over-container">
          <h1 className="game-over-title">GAME OVER</h1>
          <p className="game-over-text">
            Tu aventura ha llegado a su fin. Las decisiones tienen consecuencias...
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="campaign-button"
          >
            Reiniciar Aventura
          </button>
        </div>
      </div>
    );
  }

  // Loading states
  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--creamy-old)] to-[var(--light-caramel)] flex items-center justify-center">
        <div className="loading-indicator">
          Cargando tu aventura...
        </div>
      </div>
    );
  }

  // Mode selection screen - NUEVO DISEÑO PROFESIONAL EN ESPAÑOL
  if (!mode) {
    return <WelcomeScreen onSelect={handleModeSelect} />;
  }

  // Sandbox form - NUEVO COMPONENTE EN ESPAÑOL
  if (showSandboxForm && mode === 'sandbox') {
    return (
      <SandboxForm 
        onSubmit={handleSandboxSubmit}
        loading={loading}
        onBack={handleBackToModeSelection}
      />
    );
  }

  // Main game screen - LAYOUT COMPLETO CON TODO FUNCIONAL
  if (gameState) {
    return (
      <div className="flex flex-col h-screen">
        {/* HEADER RESPONSIVO */}
        <ResponsiveHeader gameState={gameState} connectionStatus={connectionStatus} />

        {/* MAIN CON SCROLL CONTENIDO */}
        <main className="flex-1 overflow-y-auto px-4 space-y-4">
          
          {/* 🖼️ IMAGEN/PLACEHOLDER CONTEXTUAL */}
          <div
            className="w-full aspect-[16/9] rounded-xl bg-center bg-cover shadow-lg"
            style={{ backgroundImage: `url(${sceneImage})` }}
          />

          {/* NARRATIVA PERSISTENTE + CHIPS INLINE */}
          <article className="prose max-w-none text-[var(--text-primary-custom)] space-y-4 mb-4">
            {gameState?.narrativeLog?.length === 0 ? (
              <div className="text-center text-[var(--cedar-brown)]/70 italic py-8">
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

                  {/* CHIPS DE ACCIÓN INLINE (Solo en última entrada) */}
                  {index === gameState.narrativeLog.length - 1 && suggestedActions.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                      {suggestedActions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => handleInlineAction(action)}
                          disabled={loading || gameOver}
                          className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-full bg-[var(--imperial-gold)]/10 hover:bg-[var(--imperial-gold)] text-[var(--cedar-brown)] font-medium transition-all duration-200 hover:scale-105 active:scale-95 border border-[var(--imperial-gold)]/30"
                        >
                          <span>{getActionIcon(action)}</span>
                          <span>{action}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={narrativeRef} />
          </article>


        </main>

        {/* INPUT FIELD FIJO FUERA DEL SCROLL - CRÍTICO */}
        <div className="flex-shrink-0 p-4 bg-[var(--creamy-old)]/90 border-t border-[var(--imperial-gold)]/50">
          <StoryInput
            onSubmit={submitAction}
            loading={loading}
            gameOver={gameOver}
            placeholder="Escribe tu acción..."
          />
        </div>

        {/* FOOTER FIJO CON NAVIGATION - CRÍTICO */}
        <footer className="flex-shrink-0 border-t border-[var(--imperial-gold)]/50 bg-[var(--creamy-old)]/80 backdrop-blur-md">
          <nav className="flex gap-1 px-2 pt-2 pb-safe-bottom">
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--imperial-gold)] hover:bg-black/5 transition-colors relative"
              onClick={toggleInventory}
            >
              {badges.inventory.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {badges.inventory.count}
                </span>
              )}
              <span className="material-icons text-2xl">inventory</span>
              <span className="text-xs font-medium text-[var(--cedar-brown)]">Inventario</span>
            </button>
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--cedar-brown)] opacity-70 hover:opacity-100 hover:bg-black/5 transition-colors relative"
              onClick={toggleSkills}
            >
              {badges.skills.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {badges.skills.count}
                </span>
              )}
              <span className="material-icons text-2xl">school</span>
              <span className="text-xs font-medium">Habilidades</span>
            </button>
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--cedar-brown)] opacity-70 hover:opacity-100 hover:bg-black/5 transition-colors relative"
              onClick={toggleObjectives}
            >
              {badges.objectives.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {badges.objectives.count}
                </span>
              )}
              <span className="material-icons text-2xl">flag</span>
              <span className="text-xs font-medium">Objetivos</span>
            </button>
            <button 
              className="flex flex-1 flex-col items-center justify-end gap-0.5 rounded-lg py-1 text-[var(--cedar-brown)] opacity-70 hover:opacity-100 hover:bg-black/5 transition-colors relative"
              onClick={toggleEmotionsModal}
            >
              {badges.emotions.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {badges.emotions.count}
                </span>
              )}
              <span className="material-icons text-2xl">mood</span>
              <span className="text-xs font-medium">Estados</span>
            </button>
          </nav>
          <div className="h-safe-bottom bg-[var(--creamy-old)]/80"></div>
        </footer>

        {/* Error display */}
        {error && (
          <div className="error-display">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-sm underline"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="loading-indicator">
            Procesando...
          </div>
        )}

        {/* TODOS LOS MODALES RESTAURADOS */}
        {/* Inventory Modal */}
        <div className={`popup-modal inventory-popup ${showInventory ? 'show' : ''}`}>
          <div className="modal-header">
            <span>📦 Inventario ({gameState.inventory?.length || 0})</span>
            <button onClick={toggleInventory} className="modal-close">×</button>
          </div>
          <div className="modal-content">
            {gameState.inventory?.length > 0 ? (
              <div className="inventory-grid">
                {gameState.inventory.map((item, index) => {
                  const itemId = item?.id || item?.name || JSON.stringify(item);
                  const isNew = isElementNew('inventory', itemId);
                  
                  return (
                    <div 
                      key={index} 
                      className={`inventory-slot ${isNew ? 'animate-pulse bg-green-100' : ''}`}
                      onClick={() => isNew && markElementSeen('inventory', itemId)}
                    >
                      {isNew && <span className="absolute top-1 right-1 text-xs bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center">!</span>}
                      <div className="slot-icon">{item?.icon || '📦'}</div>
                      <div className="slot-name">{safeStringify(item?.name, 'Item')}</div>
                    </div>
                  );
                })}
                {Array.from({ length: Math.max(0, 12 - (gameState.inventory?.length || 0)) }).map((_, index) => (
                  <div key={`empty-${index}`} className="inventory-slot empty">
                    <div className="slot-icon">⬜</div>
                    <div className="slot-name">Vacío</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-skills-message">Tu inventario está vacío</div>
            )}
          </div>
        </div>

        {/* Skills Modal */}
        <div className={`popup-modal skills-popup ${showSkills ? 'show' : ''}`}>
          <div className="modal-header">
            <span>⭐ Habilidades ({gameState.skills?.length || 0})</span>
            <button onClick={toggleSkills} className="modal-close">×</button>
          </div>
          <div className="modal-content">
            {gameState.skills?.length > 0 ? (
              <div className="skills-detailed-list">
                {gameState.skills.map((skill, index) => {
                  const skillId = skill?.id || skill?.name || JSON.stringify(skill);
                  const isNew = isElementNew('skills', skillId);
                  const isLevelUp = isElementNew('skills', `${skillId}-levelup`);
                  
                  return (
                    <div 
                      key={index} 
                      className={`skill-detailed-item ${(isNew || isLevelUp) ? 'animate-pulse bg-blue-100' : ''}`}
                      onClick={() => {
                        if (isNew) markElementSeen('skills', skillId);
                        if (isLevelUp) markElementSeen('skills', `${skillId}-levelup`);
                      }}
                    >
                      {(isNew || isLevelUp) && <span className="absolute top-2 right-2 text-xs bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">{isLevelUp ? '↗' : '!'}</span>}
                      <div className="skill-icon-large">{getSkillIcon(skill?.id || skill?.name)}</div>
                      <div className="skill-detailed-info">
                        <div className="skill-detailed-name">
                          {safeStringify(skill?.id || skill?.name, 'Habilidad')}
                          {isLevelUp && <span className="text-yellow-500 text-sm ml-1">LEVEL UP!</span>}
                        </div>
                        <div className="skill-detailed-level">Nivel {skill?.level || 1}</div>
                        <div className="skill-detailed-desc">{safeStringify(skill?.description, 'Habilidad misteriosa')}</div>
                        <div className="skill-effects">Tags: {skill?.tags?.join(', ') || 'Ninguno'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-skills-message">Aún no has desarrollado habilidades específicas</div>
            )}
          </div>
        </div>

        {/* Objectives Modal */}
        <div className={`popup-modal ${showObjectives ? 'show' : ''}`}>
          <div className="modal-header">
            <span>🎯 Objetivos ({gameState.questObjectives?.length || 0})</span>
            <button onClick={toggleObjectives} className="modal-close">×</button>
          </div>
          <div className="modal-content">
            {gameState.questObjectives?.length > 0 ? (
              <div className="objective-list">
                {gameState.questObjectives.map((objective, index) => {
                  const objId = objective?.id || objective?.description || JSON.stringify(objective);
                  const isNew = isElementNew('objectives', objId);
                  const isCompleted = objective?.completed;
                  
                  return (
                    <div 
                      key={index} 
                      className={`objective-item ${isNew ? 'animate-pulse bg-green-100' : ''} ${isCompleted ? 'objective-completed' : ''}`}
                      onClick={() => isNew && markElementSeen('objectives', objId)}
                    >
                      {isNew && <span className="absolute top-2 right-2 text-xs bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">!</span>}
                      <div className="objective-checkbox">
                        {isCompleted ? '✅' : '🎯'}
                      </div>
                      <div className="objective-text">
                        <span>{safeStringify(objective?.description, 'Objetivo misterioso')}</span>
                        {objective?.progress !== undefined && (
                          <span className="text-sm text-gray-600 ml-2">({objective.progress}%)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-skills-message">No tienes objetivos activos</div>
            )}
          </div>
        </div>

        {/* Emotions Modal */}
        <div className={`popup-modal ${showEmotionsModal ? 'show' : ''}`}>
          <div className="modal-header">
            <span>😌 Estados Emocionales</span>
            <button onClick={toggleEmotionsModal} className="modal-close">×</button>
          </div>
          <div className="modal-content">
            {gameState.emotionalStates ? (
              <div className="emotions-list">
                {Object.entries(gameState.emotionalStates).map(([emotion, value]) => {
                  const isSignificant = isElementNew('emotions', emotion);
                  
                  return (
                    <div 
                      key={emotion} 
                      className={`emotion-row ${isSignificant ? 'animate-pulse bg-purple-100' : ''}`}
                      onClick={() => isSignificant && markElementSeen('emotions', emotion)}
                    >
                      {isSignificant && <span className="absolute top-2 right-2 text-xs bg-purple-500 text-white rounded-full w-5 h-5 flex items-center justify-center">!</span>}
                      <div className="emotion-icon">
                        {emotion === 'miedo' && '😱'}
                        {emotion === 'alerta' && '👁️'}
                        {emotion === 'euforia' && '🎉'}
                        {emotion === 'fatiga' && '😴'}
                        {emotion === 'ira' && '😡'}
                        {emotion === 'serenidad' && '😌'}
                      </div>
                      <div className="emotion-info">
                        <div className="emotion-name">{emotion}</div>
                        <div className="emotion-value">{value}%</div>
                      </div>
                      <div className="emotion-bar">
                        <div 
                          className="emotion-fill" 
                          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-skills-message">Estados emocionales no disponibles</div>
            )}
          </div>
        </div>

        {/* Narrative Modal */}
        <div className={`popup-modal narrative-popup ${showNarrativeModal ? 'show' : ''}`}>
          <div className="modal-header">
            <span>📖 Historial Narrativo</span>
            <button onClick={toggleNarrativeModal} className="modal-close">×</button>
          </div>
          <div className="modal-content">
            {gameState.narrativeLog?.length > 0 ? (
              <div className="narrative-entries">
                {gameState.narrativeLog.map((entry, index) => (
                  <div key={index} className="narrative-entry">
                    <div className="narrative-action">
                      "{safeStringify(entry.player_action, 'Acción del jugador')}"
                    </div>
                    <div className="narrative-text">
                      {safeStringify(entry.narrative, 'Narrativa del juego')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-narrative-message">Aún no hay historia que contar</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Campaign selection - Solo para modo campaign
  if (mode === 'campaign') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--creamy-old)] to-[var(--light-caramel)] flex items-center justify-center p-4">
        <div className="mode-selection-container">
          <p className="mode-selected-text">
            Has seleccionado: <span className="mode-name">{mode}</span>
          </p>
          <div className="mode-buttons">
            <button 
              onClick={() => startNewSession('campaign', 'scenes_act1')}
              disabled={loading}
              className="campaign-button"
            >
              {loading ? 'Iniciando...' : 'Iniciar Campaña Principal'}
            </button>
            <button 
              onClick={() => setMode(null)}
              className="mode-change-button"
            >
              Cambiar Modo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - volver a selección de modo
  return (
    <div className="app-container">
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--space-lg)' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <h2 className="welcome-title">Error</h2>
          <p className="welcome-subtitle">Modo no reconocido. Selecciona un modo válido.</p>
          <button onClick={() => setMode(null)} className="campaign-button">
            Volver a Selección
          </button>
        </div>
      </div>
      {/* 🎲 MODAL EVENTOS ALEATORIOS */}
      <RandomEventModal 
        event={randomEvent}
        isVisible={showRandomEventModal}
        onComplete={() => {
          setShowRandomEventModal(false);
          setRandomEvent(null);
        }}
      />
    </div>
  );
}

export default App;