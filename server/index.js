import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

  // 🎯 BASE DE DATOS DE ITEMS PARA EMPAREJAMIENTO INTELIGENTE
const ITEM_DATABASE = [
  // 🗡️ ARMAS Y COMBATE
  { type: 'espada', icon: '⚔️', keywords: ['espada', 'sable', 'hoja', 'blade', 'cuchilla', 'gladius', 'katana', 'espadón'] },
  { type: 'daga', icon: '🔪', keywords: ['daga', 'cuchillo', 'puñal', 'navaja', 'stiletto', 'dagger'] },
  { type: 'hacha', icon: '🪓', keywords: ['hacha', 'axe', 'machete', 'hachuela'] },
  { type: 'arco', icon: '🏹', keywords: ['arco', 'ballesta', 'bow', 'flecha', 'arrow'] },
  { type: 'revolver', icon: '🔫', keywords: ['revolver', 'pistola', 'arma', 'gun', 'weapon', 'firearm'] },
  
  // 🛡️ DEFENSAS
  { type: 'escudo', icon: '🛡️', keywords: ['escudo', 'shield', 'broquel', 'rodela', 'buckler'] },
  { type: 'armadura', icon: '🦺', keywords: ['armadura', 'armor', 'coraza', 'cota', 'peto', 'mail'] },
  
  // 🧿 AMULETOS Y PROTECCIÓN (AÑADIDO SEGÚN CHATGPT STEP 1.2)
  { type: 'amuleto', icon: '🧿', keywords: ['amuleto', 'amuleto protector', 'amuleto de protección', 'amuleto sagrado', 'talismán', 'protección'] },
  
  // 👕 ROPA Y VESTIMENTA
  { type: 'capa', icon: '🧥', keywords: ['capa', 'manto', 'cape', 'cloak', 'túnica', 'robe'] },
  { type: 'ropa', icon: '👔', keywords: ['camisa', 'pantalón', 'vestido', 'túnica', 'ropa', 'clothes', 'garment'] },
  { type: 'zapatos', icon: '👢', keywords: ['botas', 'zapatos', 'sandalias', 'shoes', 'boots', 'calzado'] },
  { type: 'guantes', icon: '🧤', keywords: ['guantes', 'gloves', 'manoplas', 'mitones'] },
  
  // 🍖 COMIDA Y CONSUMIBLES
  { type: 'comida', icon: '🍖', keywords: ['carne', 'comida', 'alimento', 'food', 'meat', 'jamón'] },
  { type: 'pan', icon: '🍞', keywords: ['pan', 'bread', 'hogaza', 'barra', 'bollo'] },
  { type: 'fruta', icon: '🍎', keywords: ['fruta', 'manzana', 'pera', 'fruit', 'apple', 'naranja'] },
  { type: 'bebida', icon: '🍷', keywords: ['vino', 'cerveza', 'agua', 'bebida', 'drink', 'líquido', 'wine', 'beer'] },
  
  // 🔧 HERRAMIENTAS Y UTILITARIOS
  { type: 'llave', icon: '🗝️', keywords: ['llave', 'key', 'llaves', 'keys'] },
  { type: 'cofre', icon: '📦', keywords: ['cofre', 'caja', 'chest', 'box', 'baúl', 'container'] },
  { type: 'candado', icon: '🔒', keywords: ['candado', 'lock', 'cerradura', 'cerrojo'] },
  { type: 'cuerda', icon: '🪢', keywords: ['cuerda', 'rope', 'soga', 'cable', 'hilo'] },
  { type: 'antorcha', icon: '🕯️', keywords: ['antorcha', 'torch', 'vela', 'candle', 'linterna', 'lámpara'] },
  { type: 'espejo', icon: '🪞', keywords: ['espejo', 'mirror', 'cristal', 'reflejo'] },
  
  // 🧪 CONSUMIBLES MÁGICOS
  { type: 'poción', icon: '🧪', keywords: ['poción', 'elixir', 'frasco', 'botella', 'tónico', 'brebaje'] },
  { type: 'frasco_cristal', icon: '🧪', keywords: ['frasco de cristal', 'frasco cristalino', 'recipiente de cristal'] },
  { type: 'varita', icon: '🪄', keywords: ['varita', 'vara', 'bastón', 'cetro', 'wand', 'staff'] },
  
  // 💎 TESOROS
  { type: 'gema', icon: '💎', keywords: ['gema', 'diamante', 'rubí', 'esmeralda', 'zafiro', 'cristal', 'piedra'] },
  { type: 'moneda', icon: '🪙', keywords: ['moneda', 'oro', 'plata', 'coin', 'dinero', 'tesoro'] },
  
  // 📚 CONOCIMIENTO
  { type: 'libro', icon: '📖', keywords: ['libro', 'grimorio', 'tomo', 'manuscrito', 'volumen', 'text'] },
  { type: 'diario', icon: '📓', keywords: ['diario', 'diario antiguo', 'diario personal', 'antiguo diario'] },
  { type: 'pergamino', icon: '📜', keywords: ['pergamino', 'scroll', 'mapa', 'carta', 'plano', 'documento'] },
  
  // 🏆 OBJETOS ESPECIALES
  { type: 'trofeo', icon: '🏆', keywords: ['trofeo', 'trophy', 'premio', 'medalla', 'copa', 'galardón'] },
  { type: 'reliquia', icon: '⚗️', keywords: ['reliquia', 'relic', 'artefacto', 'artifact', 'objeto sagrado', 'antigüedad'] },
  { type: 'cuerpo', icon: '💀', keywords: ['cabeza', 'cráneo', 'hueso', 'esqueleto', 'calavera', 'skull', 'bone', 'head'] },
  { type: 'crucifijo', icon: '✝️', keywords: ['crucifijo', 'el crucifijo', 'cruz', 'santo crucifijo', 'cross', 'símbolo religioso', 'cruz de plata', 'cruz adornada'] },
  
  // 💍 JOYERÍA Y ACCESORIOS
  { type: 'anillo', icon: '💍', keywords: ['anillo', 'ring', 'sortija', 'aro', 'alianza'] },
  { type: 'collar', icon: '📿', keywords: ['collar', 'necklace', 'cadena', 'pendiente'] },
  { type: 'brazalete', icon: '🔗', keywords: ['brazalete', 'pulsera', 'bracelet'] },
  
  // 🔧 MATERIALES Y METALES  
  { type: 'metal', icon: '🔩', keywords: ['hierro', 'acero', 'metal', 'barra de hierro', 'lingote', 'varilla', 'barra de acero', 'chatarra'] },
];

// 🎯 TABLA DE ALIASES PARA ITEMS SIMILARES (CHATGPT SOLUTION)
const ITEM_ALIASES = {
  'metal afilado': 'improvised_knife',
  'improvisado cuchillo': 'improvised_knife', 
  'cuchillo improvisado': 'improvised_knife',
  'trozo de metal': 'improvised_knife',
  'fragmento de metal': 'improvised_knife',
  'hoja afilada': 'improvised_knife',
  'frasco de cristal': 'frasco_cristal',
  'frasco cristalino': 'frasco_cristal',
  'recipiente de cristal': 'frasco_cristal',
  'diario antiguo': 'diario',
  'diario personal': 'diario',
  'viejo diario': 'diario'
};

// 🎯 FUNCIÓN: NORMALIZAR NOMBRES DE ITEMS (CHATGPT SOLUTION)
function canonicalName(raw) {
  const key = raw.toLowerCase().trim();
  return ITEM_ALIASES[key] || key;
}

// 🎲 SISTEMA DE EVENTOS ALEATORIOS D20
const RANDOM_EVENTS_DATABASE = {
  // 🎨 EVENTOS SANDBOX POR TEMÁTICA
  sandbox: {
    detective: [
      {
        id: 'clue_discovery',
        title: 'Pista Inesperada',
        description: 'Notas algo que otros investigadores pasaron por alto',
        triggers: ['investigar', 'examinar', 'buscar', 'observar'],
        difficulty: 12,
        success: { items: ['lupa', 'documento'], narrative: 'Tu ojo entrenado detecta una pista crucial que cambia el rumbo de la investigación.' },
        failure: { health: -5, narrative: 'Tu búsqueda exhaustiva te deja agotado y sin resultados claros.' }
      },
      {
        id: 'witness_encounter',
        title: 'Testigo Inesperado',
        description: 'Alguien se acerca con información valiosa',
        triggers: ['preguntar', 'hablar', 'interrogar'],
        difficulty: 10,
        success: { knowledge: { 'caso_actual': 25 }, narrative: 'El testigo revela información que encaja perfectamente con tus sospechas.' },
        failure: { narrative: 'El testigo se muestra reticente y se marcha sin compartir detalles importantes.' }
      }
    ],
    adventure: [
      {
        id: 'hidden_treasure',
        title: 'Tesoro Oculto',
        description: 'Descubres algo valioso en un lugar inesperado',
        triggers: ['explorar', 'buscar', 'examinar'],
        difficulty: 14,
        success: { items: ['gema', 'moneda'], gold: 50, narrative: 'Tu exploración meticulosa revela un tesoro escondido por aventureros anteriores.' },
        failure: { stamina: -10, narrative: 'Tras una búsqueda exhaustiva, solo encuentras polvo y desilusión.' }
      }
    ],
    horror: [
      {
        id: 'supernatural_encounter',
        title: 'Presencia Sobrenatural',
        description: 'Sientes que algo te observa desde las sombras',
        triggers: ['caminar', 'explorar', 'observar'],
        difficulty: 15,
        success: { skills: ['resistencia_mental'], narrative: 'Mantienes la calma ante la presencia perturbadora y aprendes a controlar tu miedo.' },
        failure: { health: -8, emotions: { miedo: 30 }, narrative: 'El encuentro te deja marcado, con cicatrices mentales que tardarán en sanar.' }
      }
    ]
  },
  
  // 📜 EVENTOS ESPECÍFICOS CAMPAÑA "CAMINOS DEL ABISMO"
  campaign: {
    alicante_supernatural: [
      {
        id: 'errante_sighting',
        title: 'Avistamiento de Errante',
        description: 'Una figura misteriosa aparece entre la niebla',
        triggers: ['caminar', 'patrullar', 'observar'],
        difficulty: 13,
        success: { 
          items: ['reliquia'], 
          knowledge: { 'errantes': 20 }, 
          narrative: 'El Errante te observa con curiosidad antes de desvanecerse, dejando atrás un objeto de poder.' 
        },
        failure: { 
          health: -6, 
          emotions: { miedo: 25, alerta: 40 }, 
          narrative: 'El encuentro con el Errante te desorienta, dejándote con más preguntas que respuestas.' 
        }
      },
      {
        id: 'demonic_influence',
        title: 'Influencia Demoníaca',
        description: 'Las fuerzas del infierno hacen sentir su presencia',
        triggers: ['invocar', 'ritual', 'orar'],
        difficulty: 16,
        success: { 
          skills: ['exorcismo'], 
          narrative: 'Tu fe y entrenamiento te permiten resistir la influencia demoníaca y purificar el área.' 
        },
        failure: { 
          health: -12, 
          mana: -15, 
          emotions: { miedo: 40 }, 
          narrative: 'Las fuerzas demoníacas te abruman, drenando tu energía espiritual y física.' 
        }
      }
    ]
  }
};

// 🧠 SISTEMA DE ANÁLISIS CONTEXTUAL DUAL

// 🧠 SISTEMA DE ANÁLISIS CONTEXTUAL DUAL
function analyzeGameContextForEvents(gameState, action, narrative) {
  const context = {
    mode: gameState.mode,
    location: gameState.location || '',
    action: action.toLowerCase(),
    narrative: narrative.toLowerCase(),
    themes: [],
    restrictions: [],
    availableEvents: []
  };

  if (gameState.mode === 'sandbox') {
    // 🎨 ANÁLISIS CONTEXTO SANDBOX
    const sandboxConcept = gameState.sandboxConcept || '';
    const conceptLower = sandboxConcept.toLowerCase();
    
    // Detectar temática principal
    if (conceptLower.includes('detective') || conceptLower.includes('investigar') || conceptLower.includes('misterio')) {
      context.themes.push('detective');
      context.availableEvents = RANDOM_EVENTS_DATABASE.sandbox.detective || [];
    } else if (conceptLower.includes('aventura') || conceptLower.includes('explorar') || conceptLower.includes('tesoro')) {
      context.themes.push('adventure');  
      context.availableEvents = RANDOM_EVENTS_DATABASE.sandbox.adventure || [];
    } else if (conceptLower.includes('horror') || conceptLower.includes('terror') || conceptLower.includes('miedo')) {
      context.themes.push('horror');
      context.availableEvents = RANDOM_EVENTS_DATABASE.sandbox.horror || [];
    } else {
      // Temática general - mezclar eventos apropiados
      context.themes.push('general');
      context.availableEvents = [
        ...(RANDOM_EVENTS_DATABASE.sandbox.adventure || []),
        ...(RANDOM_EVENTS_DATABASE.sandbox.detective || [])
      ];
    }
    
    // Extraer restricciones del concepto
    if (conceptLower.includes('realista') || conceptLower.includes('sin magia')) {
      context.restrictions.push('no_supernatural');
    }
    if (conceptLower.includes('moderno') || conceptLower.includes('contemporáneo')) {
      context.restrictions.push('modern_setting');
    }
    
  } else if (gameState.mode === 'campaign') {
    // 📜 ANÁLISIS CONTEXTO CAMPAÑA
    context.themes.push('alicante_supernatural');
    context.availableEvents = RANDOM_EVENTS_DATABASE.campaign.alicante_supernatural || [];
    
    // Considerar progreso de la campaña
    if (gameState.storyAct) {
      context.currentAct = gameState.storyAct;
    }
    if (gameState.location?.toLowerCase().includes('alicante')) {
      context.themes.push('urban_supernatural');
    }
  }
  
  console.log(`🧠 Contexto analizado: Modo=${context.mode}, Temas=[${context.themes.join(', ')}], Eventos disponibles=${context.availableEvents.length}`);
  return context;
}

// 🎯 SISTEMA DE TRIGGERS INTELIGENTES PARA EVENTOS
function shouldTriggerRandomEvent(gameState, action) {
  // Incrementar contador de acciones si no existe
  if (!gameState.actionsSinceLastEvent) {
    gameState.actionsSinceLastEvent = 0;
  }
  gameState.actionsSinceLastEvent++;
  
  // 🎯 TRIGGER TEMPORAL: Cada 4-6 acciones (probabilístico)
  const minActions = 4;
  const maxActions = 6;
  if (gameState.actionsSinceLastEvent < minActions) {
    console.log(`🎲 Trigger temporal: ${gameState.actionsSinceLastEvent}/${minActions} acciones mínimas`);
    return false;
  }
  
  // Probabilidad creciente después del mínimo
  const actionsSinceMin = gameState.actionsSinceLastEvent - minActions;
  const maxWait = maxActions - minActions;
  const probability = Math.min(0.3 + (actionsSinceMin / maxWait) * 0.4, 0.8); // 30% base, hasta 80%
  
  // 🎯 TRIGGER CONTEXTUAL: Ciertas acciones aumentan probabilidad
  const contextualTriggers = ['explorar', 'investigar', 'caminar', 'buscar', 'examinar', 'preguntar', 'observar'];
  const hasContextualTrigger = contextualTriggers.some(trigger => action.toLowerCase().includes(trigger));
  
  let finalProbability = probability;
  if (hasContextualTrigger) {
    finalProbability += 0.2; // +20% por acción contextual
  }
  
  // 🎯 TRIGGER DE UBICACIÓN: Ciertos lugares aumentan probabilidad
  const location = gameState.location?.toLowerCase() || '';
  const dangerousLocations = ['bosque', 'cueva', 'ruinas', 'cementerio', 'callejón', 'sótano'];
  const isDangerousLocation = dangerousLocations.some(loc => location.includes(loc));
  
  if (isDangerousLocation) {
    finalProbability += 0.15; // +15% en ubicaciones peligrosas
  }
  
  finalProbability = Math.min(finalProbability, 0.9); // Máximo 90%
  
  const roll = Math.random();
  const shouldTrigger = roll < finalProbability;
  
  console.log(`🎲 Trigger check: ${gameState.actionsSinceLastEvent} acciones | Contextual: ${hasContextualTrigger} | Ubicación: ${isDangerousLocation} | Probabilidad: ${(finalProbability*100).toFixed(1)}% | Roll: ${(roll*100).toFixed(1)}% | Resultado: ${shouldTrigger ? 'TRIGGER' : 'NO'}`);
  
  if (shouldTrigger) {
    gameState.actionsSinceLastEvent = 0; // Reset contador
  }
  
  return shouldTrigger;
}

// 🎯 SISTEMA DE FILTRADO DE EVENTOS CONTEXTUALES
function filterEventsForContext(context) {
  if (!context.availableEvents || context.availableEvents.length === 0) {
    return [];
  }
  
  let filteredEvents = context.availableEvents.filter(event => {
    // Verificar si algún trigger coincide con la acción actual
    const actionMatch = event.triggers.some(trigger => 
      context.action.includes(trigger) || context.narrative.includes(trigger)
    );
    
    if (!actionMatch) return false;
    
    // Aplicar restricciones de sandbox si existen
    if (context.restrictions.includes('no_supernatural') && 
        (event.id.includes('supernatural') || event.id.includes('demonic'))) {
      return false;
    }
    
    return true;
  });
  
  console.log(`🎯 Eventos filtrados: ${filteredEvents.length} de ${context.availableEvents.length} disponibles`);
  return filteredEvents;
}

// 🎲 SISTEMA D20 + APLICACIÓN DE CONSECUENCIAS
function rollD20AndApplyConsequences(event, gameState) {
  const roll = Math.floor(Math.random() * 20) + 1;
  const success = roll >= event.difficulty;
  
  console.log(`🎲 Evento: ${event.title} | Dificultad: ${event.difficulty} | Dado: ${roll} | Resultado: ${success ? 'ÉXITO' : 'FRACASO'}`);
  
  const consequence = success ? event.success : event.failure;
  let eventNarrative = consequence.narrative;
  
  // Aplicar consecuencias al gameState
  if (consequence.health) {
    gameState.vitals.health = Math.max(0, Math.min(100, gameState.vitals.health + consequence.health));
    console.log(`💗 Salud actualizada: ${gameState.vitals.health}`);
  }
  if (consequence.mana) {
    gameState.vitals.mana = Math.max(0, Math.min(100, gameState.vitals.mana + consequence.mana));
    console.log(`💙 Maná actualizado: ${gameState.vitals.mana}`);
  }
  if (consequence.stamina) {
    gameState.vitals.stamina = Math.max(0, Math.min(100, gameState.vitals.stamina + consequence.stamina));
    console.log(`💚 Stamina actualizada: ${gameState.vitals.stamina}`);
  }
  if (consequence.gold) {
    gameState.resources.gold = Math.max(0, gameState.resources.gold + consequence.gold);
    console.log(`💰 Oro actualizado: ${gameState.resources.gold}`);
  }
  if (consequence.emotions) {
    Object.entries(consequence.emotions).forEach(([emotion, value]) => {
      gameState.updateEmotionalState(emotion, value);
    });
  }
  if (consequence.items) {
    consequence.items.forEach(itemType => {
      const item = ITEM_DATABASE.find(dbItem => dbItem.type === itemType);
      if (item) {
        const newItem = {
          name: item.type,
          icon: item.icon,
          type: item.type,
          description: generateContextualDescription(item.type, item.type),
          rarity: success ? 'rare' : 'common',
          source: 'random_event',
          instanceId: crypto.randomUUID()
        };
        gameState.inventory.push(newItem);
        console.log(`🎁 Item de evento añadido: ${newItem.name} ${newItem.icon}`);
      }
    });
  }
  if (consequence.skills) {
    consequence.skills.forEach(skillId => {
      const existingSkill = gameState.skills.find(s => s.id === skillId);
      if (existingSkill) {
        existingSkill.level += 1;
      } else {
        gameState.skills.push({
          id: skillId,
          level: 1,
          tags: ['evento'],
          description: `Habilidad adquirida durante evento: ${event.title}`
        });
      }
      console.log(`⭐ Habilidad de evento: ${skillId}`);
    });
  }
  
  return {
    success,
    roll,
    event,
    narrative: eventNarrative,
    appliedConsequences: consequence
  };
}
function analyzeSandboxConcept(concept) {
  console.log(`🧠 Analizando sandbox concept: "${concept}"`);
  
  const themes = new Set();
  const conceptLower = concept.toLowerCase();
  
  const themeKeywords = {
    urban: ['ciudad', 'urbano', 'metrópolis', 'calle', 'edificio'],
    technology: ['cyberpunk', 'futurista', 'robot', 'cyber', 'digital', 'tech'],
    combat: ['guerra', 'batalla', 'soldado', 'guerrero', 'combate', 'militar'],
    exploration: ['explorador', 'aventurero', 'expedición', 'descubrimiento'],
    investigation: ['detective', 'investigador', 'misterio', 'crimen', 'policía'],
    mystical: ['magia', 'mágico', 'hechicero', 'brujo', 'sobrenatural', 'místico'],
    nautical: ['pirata', 'mar', 'océano', 'barco', 'navegante', 'corsario'],
    space: ['astronauta', 'espacial', 'nave', 'planeta', 'galaxia'],
    survival: ['supervivencia', 'apocalipsis', 'zombie', 'post-apocalíptico']
  };
  
  Object.entries(themeKeywords).forEach(([theme, keywords]) => {
    if (keywords.some(keyword => conceptLower.includes(keyword))) {
      themes.add(theme);
    }
  });
  
  if (themes.size === 0) {
    themes.add('exploration');
    themes.add('urban');
  }
  
  const result = Array.from(themes);
  console.log(`🧠 Temas detectados: ${result.join(', ')}`);
  return result;
}

// 🔍 OPCIÓN 5: ANÁLISIS REACTIVO MEJORADO
function detectNarrativeContext(narrative, action) {
  console.log(`🔍 Analizando contexto: action="${action}"`);
  
  const contexts = new Set();
  const text = (narrative + ' ' + action).toLowerCase();
  
  const contextKeywords = {
    mystical: ['medallón', 'amuleto', 'conjuro', 'exorcismo', 'magia', 'hechizo', 'ritual', 'místico', 'sobrenatural'],
    knowledge: ['libro', 'pergamino', 'tomo', 'grimorio', 'biblioteca', 'estudio', 'investigar'],
    combat: ['luchar', 'atacar', 'batalla', 'combate', 'pelear', 'arma', 'enemigo'],
    urban: ['ciudad', 'calle', 'edificio', 'oficina', 'urbano'],
    exploration: ['explorar', 'buscar', 'examinar', 'hurgar', 'descubrir'],
    survival: ['supervivencia', 'refugio', 'medicina para heridas', 'botiquín', 'sed', 'hambre'],
    technology: ['computadora', 'robot', 'digital', 'cyber', 'tecnología'],
    nautical: ['barco', 'mar', 'océano', 'puerto', 'navegar'],
    space: ['nave', 'planeta', 'estación', 'asteroide', 'galaxia']
  };
  
  Object.entries(contextKeywords).forEach(([context, keywords]) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      contexts.add(context);
    }
  });
  
  if (contexts.size === 0) {
    contexts.add('exploration');
  }
  
  const result = Array.from(contexts);
  console.log(`🔍 Contextos detectados: ${result.join(', ')}`);
  return result;
}

// 🌟 OPCIÓN 2: LOOT INTELIGENTE CONTEXTUAL
const INTELLIGENT_LOOT = {
  mystical: [
    { name: 'amuleto protector', icon: '🧿', weight: 30 },
    { name: 'cristal energético', icon: '🔮', weight: 25 },
    { name: 'pergamino sagrado', icon: '📜', weight: 20 },
    { name: 'reliquia antigua', icon: '⚗️', weight: 15 }
  ],
  knowledge: [
    { name: 'libro de conocimiento', icon: '📖', weight: 35 },
    { name: 'pergamino de datos', icon: '📜', weight: 30 },
    { name: 'mapa detallado', icon: '🗺️', weight: 25 },
    { name: 'archivo secreto', icon: '📁', weight: 20 }
  ],
  combat: [
    { name: 'daga afilada', icon: '🔪', weight: 35 },
    { name: 'escudo resistente', icon: '🛡️', weight: 30 },
    { name: 'armadura ligera', icon: '🦺', weight: 25 },
    { name: 'espada forjada', icon: '⚔️', weight: 20 }
  ],
  exploration: [
    { name: 'cuerda resistente', icon: '🪢', weight: 35 },
    { name: 'antorcha brillante', icon: '🕯️', weight: 30 },
    { name: 'brújula antigua', icon: '🧭', weight: 25 },
    { name: 'gema valiosa', icon: '💎', weight: 20 }
  ],
  urban: [
    { name: 'llave maestra', icon: '🗝️', weight: 35 },
    { name: 'moneda de oro', icon: '🪙', weight: 30 },
    { name: 'documento oficial', icon: '📜', weight: 25 },
    { name: 'gema preciosa', icon: '💎', weight: 20 }
  ]
};

function rollIntelligentLoot(gameState, action, narrative, quality = 'common') {
  console.log(`🎯 Generando loot inteligente con calidad: ${quality}...`);
  
  // Detectar contextos
  const narrativeContexts = detectNarrativeContext(narrative, action);
  let sandboxThemes = [];
  
  if (gameState.mode === 'sandbox' && gameState.sandboxConcept) {
    sandboxThemes = gameState.sandboxThemes || analyzeSandboxConcept(gameState.sandboxConcept);
    gameState.sandboxThemes = sandboxThemes;
  }
  
  // Combinar contextos
  const allContexts = [...new Set([...sandboxThemes, ...narrativeContexts])];
  console.log(`🎯 Contextos finales: ${allContexts.join(', ')}`);
  
  // Seleccionar categoría (priorizar narrativo)
  let selectedCategory = 'exploration';
  for (const context of narrativeContexts) {
    if (INTELLIGENT_LOOT[context]) {
      selectedCategory = context;
      break;
    }
  }
  
  console.log(`🎯 Categoría seleccionada: ${selectedCategory}`);
  
  // Generar item - MEJORADO CON SISTEMA DE CALIDAD
  const lootTable = INTELLIGENT_LOOT[selectedCategory] || INTELLIGENT_LOOT.exploration;
  
  // 🎯 FILTRAR POR CALIDAD
  let filteredLoot = lootTable;
  if (quality === 'rare') {
    // Para items raros, preferir items con mayor peso (más valiosos)
    filteredLoot = lootTable.filter(item => item.weight >= 15);
    if (filteredLoot.length === 0) filteredLoot = lootTable; // Fallback
  } else if (quality === 'epic') {
    // Para items épicos, preferir los más pesados y añadir prefijos especiales
    filteredLoot = lootTable.filter(item => item.weight >= 20);
    if (filteredLoot.length === 0) filteredLoot = lootTable.filter(item => item.weight >= 15);
    if (filteredLoot.length === 0) filteredLoot = lootTable; // Fallback
  }
  
  const totalWeight = filteredLoot.reduce((sum, item) => sum + item.weight, 0);
  let randomWeight = Math.random() * totalWeight;
  
  let selectedItem = null;
  for (const item of filteredLoot) {
    if (randomWeight < item.weight) {
      selectedItem = item;
      break;
    }
    randomWeight -= item.weight;
  }
  
  if (!selectedItem) selectedItem = filteredLoot[0];
  
  // 🌟 APLICAR MODIFICADORES DE CALIDAD AL NOMBRE
  let finalName = selectedItem.name;
  if (quality === 'rare') {
    const rarePrefixes = ['Refinado', 'Resistente', 'Mejorado', 'Superior', 'Excelente'];
    const randomPrefix = rarePrefixes[Math.floor(Math.random() * rarePrefixes.length)];
    finalName = `${randomPrefix} ${selectedItem.name}`;
  } else if (quality === 'epic') {
    const epicPrefixes = ['Legendario', 'Encantado', 'Mágico', 'Perfecto', 'Ancestral'];
    const randomPrefix = epicPrefixes[Math.floor(Math.random() * epicPrefixes.length)];
    finalName = `${randomPrefix} ${selectedItem.name}`;
  }
  
  const finalItem = {
    name: finalName,
    icon: selectedItem.icon,
    type: selectedCategory,
    description: `${finalName} encontrado durante la exploración`,
    rarity: quality,
    source: 'dynamic_intelligent',
    contexts: allContexts,
    instanceId: crypto.randomUUID()
  };
  
  console.log(`🎁 LOOT GENERADO: ${finalItem.name} ${finalItem.icon} (${selectedCategory}, ${quality})`);
  return finalItem;
}

const app = express();
const server = createServer(app);

// Middleware - CORS LIMPIO SEGÚN CHATGPT
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN  
                     || 'https://82bcbb31-ba5d-4ac4-997b-559356b55852.preview.emergentagent.com';

console.log('🌐 FRONTEND_ORIGIN configurado:', FRONTEND_ORIGIN);

// Socket.IO CORS con origen específico
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,     // ← SIN wildcard, origen específico
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// REST API CORS con origen específico
app.use(cors({
  origin: FRONTEND_ORIGIN,       // ← SIN wildcard, origen específico
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Accept', 'Origin']
}));

// ❌ ELIMINADOS: Headers manuales conflictivos (ChatGPT solution)
// Ya no necesitamos esto porque cors() maneja todo automáticamente
app.use(express.json());

// Middleware de debugging para todas las rutas
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'no-origin'}`);
  next();
});

// MongoDB setup
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/';
const client = new MongoClient(MONGO_URL);
let db;

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Load game configuration
function loadJsonFile(filename) {
  try {
    const data = readFileSync(`/app/${filename}`, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`Could not load ${filename}:`, error.message);
    return {};
  }
}

// Unified campaign loader
function loadFullCampaign(name) {
  const base = '/app/campaigns';
  const campaignFile = path.join(base, 'campaign.json');
  const mapFile = path.join(base, 'map.json');
  const scenesFile = path.join(base, 'scenes', `${name}.ink`);
  
  console.log(`🔍 Loading full campaign: ${name}`);
  
  try {
    // Load campaign.json
    const json = existsSync(campaignFile) ? 
      JSON.parse(readFileSync(campaignFile, 'utf8')) : 
      { titulo: 'Campaña Predeterminada' };
    
    // Load map.json
    const map = existsSync(mapFile) ? 
      JSON.parse(readFileSync(mapFile, 'utf8')) : 
      { nodes: [] };
    
    // Load and parse ink file (as text, not compiled)
    let firstText = '';
    
    if (existsSync(scenesFile)) {
      const inkText = readFileSync(scenesFile, 'utf8');
      
      // Parse ink text manually to get first narrative
      const lines = inkText.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('==') || line === '' || line.includes('suggestedActions')) continue;
        if (line.length > 30) {
          firstText = line;
          break;
        }
      }
      
      console.log(`✅ Loaded campaign: "${json.titulo}"`);
      console.log(`✅ Map with ${map.nodes?.length || 0} locations`);
      console.log(`✅ Ink text parsed, first narrative: "${firstText.substring(0, 50)}..."`);
    } else {
      console.log(`❌ Ink file not found: ${scenesFile}`);
    }
    
    return { 
      json, 
      map, 
      firstText: firstText || json.titulo || 'Aventura épica te espera'
    };
    
  } catch (error) {
    console.log(`❌ Error loading campaign: ${error.message}`);
    return null;
  }
}

// Generate suggested actions based on context using AI and emotional states
async function generateSuggestedActions(gameState, narrative, openaiClient) {
  try {
    // Analizar estados emocionales para sesgar acciones
    let emotionalBias = '';
    const strongEmotions = Object.entries(gameState.emotionalStates || {})
      .filter(([emotion, value]) => value > 70);
    
    if (strongEmotions.length > 0) {
      const emotionNames = strongEmotions.map(([emotion, value]) => `${emotion} (${value}%)`).join(', ');
      emotionalBias = `
ESTADO EMOCIONAL INTENSO: ${emotionNames}
- Si MIEDO >70: prioriza "Escapar, Esconderse, Buscar ayuda, Preparar defensa"
- Si ALERTA >70: prioriza "Examinar peligros, Preparar combate, Usar habilidades, Mantenerse vigilante" 
- Si EUFORIA >70: prioriza "Avanzar audazmente, Explorar sin miedo, Confrontar enemigos"
- Si FATIGA >70: prioriza "Descansar, Buscar refugio, Tomar pociones, Meditar"
`;
    }

    const contextPrompt = `
Eres un maestro de juego para Hellbound RPG. Basándote en la narrativa actual y el estado del jugador, genera exactamente 4 acciones sugeridas específicas.

CONTEXTO ACTUAL:
- Ubicación: ${gameState.location}
- Narrativa actual: "${narrative}"
- Modo de juego: ${gameState.mode}
- Salud: ${gameState.vitals?.health || gameState.health}/100
- Maná: ${gameState.vitals?.mana || gameState.mana}/100
- Stamina: ${gameState.vitals?.stamina || 100}/100

HABILIDADES DISPONIBLES:
${gameState.skills && gameState.skills.length > 0 ? 
  gameState.skills.map(skill => typeof skill === 'object' ? 
    `${skill.id} (Nivel ${skill.level})` : skill).join(', ') : 'Ninguna habilidad específica'}

${emotionalBias}

RECURSOS ACTUALES:
- Oro: ${gameState.resources?.gold || gameState.gold || 0}
- Objetos: ${gameState.inventory?.length || 0} items

INSTRUCCIONES:
1. Las acciones deben ser específicas a la situación actual
2. Máximo 5-7 palabras por acción
3. En español
4. Considerar estados emocionales fuertes para sesgar opciones
5. Incluir variedad: exploración, interacción, habilidades, recursos

Responde SOLO con 4 acciones separadas por comas, sin numeración ni explicaciones.

Ejemplo: "Examinar las sombras cercanas, Usar habilidad de exorcismo, Buscar pistas en el suelo, Hablar con el compañero"
`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: contextPrompt }],
      temperature: 0.7,
      max_tokens: 80
    });

    const suggestedActionsText = response.choices[0].message.content.trim();
    const actions = suggestedActionsText.split(',').map(action => action.trim()).slice(0, 4);
    
    console.log(`🎯 Acciones dinámicas generadas: ${actions.join(', ')}`);
    return actions;

  } catch (error) {
    console.error('Error generando acciones sugeridas:', error);
    return generateFallbackActions(gameState);
  }
}

// Fallback actions when AI fails
function generateFallbackActions(gameState) {
  const baseActions = [];
  
  if (gameState.mode === 'campaign') {
    if (gameState.location === 'Alicante') {
      baseActions.push(
        "Investigar la figura misteriosa",
        "Buscar a un compañero",
        "Explorar la ciudad nevada",
        "Meditar sobre el presentimiento"
      );
    } else {
      baseActions.push(
        "Examinar el entorno",
        "Usar una habilidad",
        "Buscar pistas",
        "Avanzar con cautela"
      );
    }
  } else {
    baseActions.push(
      "Explorar los alrededores",
      "Usar una habilidad",
      "Buscar información",
      "Tomar un descanso"
    );
  }
  
  return baseActions.slice(0, 4);
}

const LORE = loadJsonFile('lore.json');
const FUNCTIONS = loadJsonFile('functions.json');
const LEXICON = loadJsonFile('lexicon.json');

// Game state management
const gameSessions = new Map();

class GameState {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.playerId = crypto.randomUUID();
    
    // 🔄 NUEVO SISTEMA DE STATS DINÁMICOS
    this.vitals = {
      health: 100,
      mana: 100,
      stamina: 100
    };
    
    this.resources = {
      gold: 50,
      rations: 3,
      gemas: 0,
      reliquias: 0
    };
    
    this.attributes = {
      fuerza: 5,
      agilidad: 5,
      sabiduría: 5,
      carisma: 5
    };
    
    this.emotionalStates = {
      miedo: 0,
      alerta: 20,
      euforia: 0,
      fatiga: 0,
      ira: 0,
      serenidad: 50
    };
    
    this.temporalEffects = new Map(); // "veneno": {intensity: 3, duration: 5}
    
    this.relationships = new Map(); // "Darius Blackwater": 60
    
    this.knowledge = new Map(); // "Uróboros": 30
    
    this.reputation = new Map(); // "Iglesia": 50
    
    // 🎯 SISTEMA DE HABILIDADES DINÁMICO ILIMITADO
    this.skills = []; // Array de objetos {id, level, tags, description}
    
    this.location = "Punto de Inicio";
    this.inventory = [];
    this.discoveredItems = []; // 🎁 SISTEMA DISCOVERED ITEMS
    this.narrativeLog = [];
    this.mode = 'sandbox';
    this.campaignMeta = null;
    this.map = null;
    
    // 📖 SISTEMA NARRATIVO MEJORADO
    this.toneBias = 0; // -5 (luminoso) a +5 (oscuro)
    this.usedPhrases = []; // Historial de frases para evitar repetición
    
    // Sombra Arcana DM fields
    this.questStage = 'I';
    this.divergenceScore = 0;
    this.memoryRaw = [];
    this.memorySummary = '';
    this.seasonId = null;
    this.createdAt = new Date();
    
    // 🧠 SISTEMA DE MEMORIA MEJORADO
    this.eventFlags = new Set();
    this.sessionSummaries = [];
    this.actionCount = 0;
    
    // 📖 GESTOR DE HISTORIA AVANZADO
    this.storyAct = 1;
    this.actProgress = 0;
    this.majorDecisions = [];
    this.questObjectives = [];
    this.storyFlags = new Set();
    this.companionStatus = new Map();
    
    // 🎨 SANDBOX CONCEPT-FIRST
    this.sandboxConcept = null; // Para modo sandbox: idea inicial del usuario
    
    // 💀 SISTEMA DE MUERTE
    this.isAlive = true;
    this.deathReason = null;
  }

  toDict() {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      
      // 🔄 STATS DINÁMICOS
      vitals: this.vitals,
      resources: this.resources,
      attributes: this.attributes,
      emotionalStates: this.emotionalStates,
      temporalEffects: Object.fromEntries(this.temporalEffects),
      relationships: Object.fromEntries(this.relationships),
      knowledge: Object.fromEntries(this.knowledge),
      reputation: Object.fromEntries(this.reputation),
      
      // 🎯 HABILIDADES DINÁMICAS
      skills: this.skills,
      
      location: this.location,
      inventory: this.inventory,
      discoveredItems: this.discoveredItems || [], // 🎁 SISTEMA DISCOVERED ITEMS
      narrativeLog: this.narrativeLog,
      mode: this.mode,
      campaignMeta: this.campaignMeta,
      map: this.map,
      
      // 📖 NARRATIVA MEJORADA
      toneBias: this.toneBias,
      usedPhrases: this.usedPhrases.slice(-20), // Solo últimas 20 frases
      
      questStage: this.questStage,
      divergenceScore: this.divergenceScore,
      memoryRaw: this.memoryRaw.slice(-10),
      memorySummary: this.memorySummary,
      sessionSummaries: this.sessionSummaries,
      eventFlags: Array.from(this.eventFlags),
      actionCount: this.actionCount,
      
      // 📖 GESTOR DE HISTORIA AVANZADO
      storyAct: this.storyAct,
      actProgress: this.actProgress,
      majorDecisions: this.majorDecisions,
      questObjectives: this.questObjectives,
      storyFlags: Array.from(this.storyFlags),
      companionStatus: Object.fromEntries(this.companionStatus),
      
      // 🎨 SANDBOX
      sandboxConcept: this.sandboxConcept,
      
      // 💀 SISTEMA DE MUERTE
      isAlive: this.isAlive,
      deathReason: this.deathReason,
      
      seasonId: this.seasonId,
      createdAt: this.createdAt.toISOString()
    };
  }

  // 🎯 CATEGORIZACIÓN AUTOMÁTICA DE HABILIDADES
  detectSkillCategory(skill) {
    const skillId = skill.id?.toLowerCase() || '';
    const skillDesc = skill.description?.toLowerCase() || '';
    const skillTags = skill.tags || [];
    
    // Palabras clave para PASIVAS
    const passiveKeywords = [
      'forja', 'herrera', 'craft', 'fabricar', 'crear', 'construcción',
      'reparación', 'reparar', 'cocina', 'cocinar', 'alquimia',
      'conocimiento', 'historia', 'idioma', 'tradición', 'cultura',
      'resistencia', 'inmunidad', 'tolerancia', 'oficio', 'artesanía'
    ];
    
    // Palabras clave para MAGIA
    const magicKeywords = [
      'hechizo', 'conjuro', 'magia', 'mágico', 'arcano', 'místico',
      'curación', 'sanar', 'heal', 'bola de fuego', 'telepatía',
      'teletransporte', 'invocación', 'ritual', 'bendición', 'maldición',
      'elemental', 'espiritual', 'divino', 'encantamiento'
    ];
    
    // Verificar PASIVAS
    if (passiveKeywords.some(keyword => 
      skillId.includes(keyword) || skillDesc.includes(keyword) ||
      skillTags.some(tag => tag.toLowerCase().includes(keyword))
    )) {
      return 'pasiva';
    }
    
    // Verificar MAGIA
    if (magicKeywords.some(keyword => 
      skillId.includes(keyword) || skillDesc.includes(keyword) ||
      skillTags.some(tag => tag.toLowerCase().includes(keyword))
    )) {
      return 'magia';
    }
    
    // Por defecto: ACTIVA (combate, movimiento, etc.)
    return 'activa';
  }

  // 🔄 SISTEMA DE CAMBIOS DE ESTADO DINÁMICOS
  applyStateChanges(stateChanges) {
    console.log('📊 Aplicando cambios de estado:', JSON.stringify(stateChanges, null, 2));
    
    // Cambios en vitales
    if (stateChanges.vitalDelta) {
      Object.entries(stateChanges.vitalDelta).forEach(([vital, delta]) => {
        if (this.vitals[vital] !== undefined) {
          this.vitals[vital] = Math.max(0, Math.min(100, this.vitals[vital] + delta));
          console.log(`💗 ${vital}: ${this.vitals[vital]}`);
          
          // 💀 VERIFICAR MUERTE
          if (vital === 'health' && this.vitals[vital] <= 0) {
            this.isAlive = false;
            this.deathReason = 'Has perdido toda tu salud';
            console.log('💀 JUGADOR HA MUERTO');
          }
        }
      });
    }
    
    // Cambios en recursos
    if (stateChanges.resourceDelta) {
      Object.entries(stateChanges.resourceDelta).forEach(([resource, delta]) => {
        if (this.resources[resource] !== undefined) {
          this.resources[resource] = Math.max(0, this.resources[resource] + delta);
          console.log(`💰 ${resource}: ${this.resources[resource]}`);
        }
      });
    }
    
    // Cambios en atributos
    if (stateChanges.attrDelta) {
      Object.entries(stateChanges.attrDelta).forEach(([attr, delta]) => {
        if (this.attributes[attr] !== undefined) {
          this.attributes[attr] = Math.max(1, this.attributes[attr] + delta);
          console.log(`💪 ${attr}: ${this.attributes[attr]}`);
        }
      });
    }
    
    // Establecer estados emocionales
    if (stateChanges.statusSet) {
      Object.entries(stateChanges.statusSet).forEach(([emotion, value]) => {
        this.emotionalStates[emotion] = Math.max(0, Math.min(100, value));
        console.log(`😊 ${emotion}: ${this.emotionalStates[emotion]}%`);
      });
    }
    
    // Limpiar estados emocionales
    if (stateChanges.statusClear) {
      stateChanges.statusClear.forEach(emotion => {
        if (this.emotionalStates[emotion] !== undefined) {
          this.emotionalStates[emotion] = 0;
          console.log(`🧹 ${emotion} limpiado`);
        }
      });
    }
    
    // Cambiar ubicación
    if (stateChanges.locationChange) {
      this.location = stateChanges.locationChange;
      console.log(`📍 Nueva ubicación: ${this.location}`);
    }
    
    // Añadir nueva habilidad CON CATEGORIZACIÓN
    if (stateChanges.newSkill) {
      const existingSkill = this.skills.find(s => s.id === stateChanges.newSkill.id);
      if (!existingSkill) {
        // Asegurar que tenga categoría correcta
        const newSkill = {
          ...stateChanges.newSkill,
          category: stateChanges.newSkill.category || this.detectSkillCategory(stateChanges.newSkill)
        };
        this.skills.push(newSkill);
        console.log(`⭐ Nueva habilidad (${newSkill.category}): ${newSkill.id} (Nivel ${newSkill.level})`);
      } else {
        existingSkill.level = Math.max(existingSkill.level, stateChanges.newSkill.level);
        console.log(`📈 Habilidad mejorada: ${existingSkill.id} (Nivel ${existingSkill.level})`);
      }
    }
    
    // Añadir nuevo item al inventario (SOLO SI TIENE NOMBRE VÁLIDO)
    if (stateChanges.newInventoryItem && stateChanges.newInventoryItem.name && stateChanges.newInventoryItem.name.trim()) {
      const newItem = {
        name: stateChanges.newInventoryItem.name,
        icon: stateChanges.newInventoryItem.icon || '📦',
        description: stateChanges.newInventoryItem.description || '',
        instanceId: crypto.randomUUID() // ID único para cada instancia
      };
      this.inventory.push(newItem);
      console.log(`📦 Nuevo item obtenido: ${newItem.name} ${newItem.icon}`);
    }
    
    // Remover item del inventario (consumibles, drops, etc.)
    if (stateChanges.removeInventoryItem) {
      const itemToRemove = stateChanges.removeInventoryItem;
      const itemIndex = this.inventory.findIndex(item => 
        (item?.name || '').toLowerCase().includes((itemToRemove?.name || '').toLowerCase()) ||
        (itemToRemove?.name || '').toLowerCase().includes((item?.name || '').toLowerCase())
      );
      
      if (itemIndex !== -1) {
        const removedItem = this.inventory.splice(itemIndex, 1)[0];
        console.log(`❌ Item eliminado: ${removedItem.name} ${removedItem.icon} (${itemToRemove.reason || 'usado'})`);
      } else {
        console.log(`⚠️ No se encontró item para eliminar: ${itemToRemove.name}`);
      }
    }
    
    // Remover habilidad
    if (stateChanges.removeSkill) {
      this.skills = this.skills.filter(s => s.id !== stateChanges.removeSkill);
      console.log(`❌ Habilidad perdida: ${stateChanges.removeSkill}`);
    }
    
    // Cambios en relaciones
    if (stateChanges.relationshipDelta) {
      Object.entries(stateChanges.relationshipDelta).forEach(([person, delta]) => {
        const current = this.relationships.get(person) || 50;
        this.relationships.set(person, Math.max(0, Math.min(100, current + delta)));
        console.log(`👥 ${person}: ${this.relationships.get(person)}`);
      });
    }
    
    // Cambios en conocimiento
    if (stateChanges.knowledgeDelta) {
      Object.entries(stateChanges.knowledgeDelta).forEach(([topic, delta]) => {
        const current = this.knowledge.get(topic) || 0;
        this.knowledge.set(topic, Math.max(0, Math.min(100, current + delta)));
        console.log(`🧠 Conocimiento de ${topic}: ${this.knowledge.get(topic)}%`);
      });
    }
    
    // 💀 VERIFICAR MUERTE POR OTROS FACTORES
    if (stateChanges.forceDeathCheck) {
      this.isAlive = false;
      this.deathReason = stateChanges.deathReason || 'Has muerto por circunstancias fatales';
      console.log(`💀 MUERTE FORZADA: ${this.deathReason}`);
    }
  }

  // 🧠 SISTEMA DE MEMORIA MEJORADO
  addEventFlag(flagType, description) {
    const flag = `${flagType}:${description}:${new Date().toISOString()}`;
    this.eventFlags.add(flag);
    console.log(`🏷️ Flag añadido: ${flag}`);
  }

  async generateSessionSummary(openaiClient) {
    if (this.narrativeLog.length < 10) return;

    try {
      const recentActions = this.narrativeLog.slice(-10).map(entry => 
        `${entry.player_action} → ${entry.narrative}`
      ).join('\n');

      const summaryPrompt = `Crea un resumen conciso (máximo 3 oraciones) de las últimas acciones del jugador en español:
${recentActions}`;

      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: summaryPrompt }],
        temperature: 0.3,
        max_tokens: 100
      });

      const summary = {
        summary: response.choices[0].message.content,
        actions_covered: 10,
        timestamp: new Date().toISOString()
      };

      this.sessionSummaries.push(summary);
      console.log(`📝 Resumen generado: ${summary.summary.substring(0, 50)}...`);
      
      // Limpiar narrativeLog manteniendo solo las últimas 3 entradas
      this.narrativeLog = this.narrativeLog.slice(-3);
      
    } catch (error) {
      console.error('Error generando resumen:', error);
    }
  }

  // 📖 GESTOR DE HISTORIA AVANZADO
  addMajorDecision(decision, impact) {
    const decisionEntry = {
      decision: decision,
      impact: impact,
      timestamp: new Date().toISOString(),
      storyAct: this.storyAct,
      actProgress: this.actProgress
    };
    this.majorDecisions.push(decisionEntry);
    console.log(`⚡ Decisión mayor registrada: ${decision} - Impacto: ${impact}`);
  }

  updateQuestProgress(action, narrative) {
    // Analizar si la acción avanza objetivos
    if (this.questObjectives.length > 0) {
      this.questObjectives.forEach(objective => {
        if (narrative.toLowerCase().includes(objective.keyword) || 
            action.toLowerCase().includes(objective.keyword)) {
          objective.progress = Math.min(100, objective.progress + 20);
          console.log(`📋 Objetivo actualizado: ${objective.description} - ${objective.progress}%`);
        }
      });
    }

    // Avanzar progreso del acto basado en eventos clave
    const progressEvents = ['compañero', 'iglesia', 'errante', 'figura misteriosa', 'plaza'];
    const foundEvent = progressEvents.find(event => 
      narrative.toLowerCase().includes(event) || action.toLowerCase().includes(event)
    );
    
    if (foundEvent && this.actProgress < 100) {
      this.actProgress = Math.min(100, this.actProgress + 15);
      console.log(`📈 Progreso del Acto ${this.storyAct}: ${this.actProgress}%`);
      
      // Cambiar de acto si se completa
      if (this.actProgress >= 100 && this.storyAct < (this.campaignMeta?.acto_total || 3)) {
        this.storyAct++;
        this.actProgress = 0;
        this.addStoryFlag('ACT_COMPLETED', `Acto ${this.storyAct - 1} completado`);
        console.log(`🎭 ¡Nuevo Acto! Ahora en Acto ${this.storyAct}`);
      }
    }
  }

  addStoryFlag(flagType, description) {
    const flag = `${flagType}:${description}:${new Date().toISOString()}`;
    this.storyFlags.add(flag);
    console.log(`🏛️ Story Flag añadido: ${flag}`);
  }

  updateCompanionStatus(companionName, relationship, value) {
    if (!this.companionStatus.has(companionName)) {
      this.companionStatus.set(companionName, { trust: 50, met: false });
    }
    
    const companion = this.companionStatus.get(companionName);
    if (relationship === 'trust') {
      companion.trust = Math.max(0, Math.min(100, companion.trust + value));
    } else if (relationship === 'met') {
      companion.met = true;
    }
    
    this.companionStatus.set(companionName, companion);
    console.log(`👥 ${companionName}: ${relationship} = ${companion[relationship]}`);
  }

  initializeCampaignObjectives() {
    if (this.mode === 'campaign' && this.campaignMeta) {
      // Objetivos iniciales del Acto I
      this.questObjectives = [
        {
          id: 'investigate_figure',
          description: 'Investigar la figura misteriosa',
          keyword: 'figura',
          progress: 0,
          completed: false
        },
        {
          id: 'find_companions',
          description: 'Encontrar a los compañeros',
          keyword: 'compañero',
          progress: 0,
          completed: false
        },
        {
          id: 'explore_alicante',
          description: 'Explorar Alicante nevada',
          keyword: 'alicante',
          progress: 0,
          completed: false
        }
      ];

      // Inicializar estado de compañeros
      if (this.campaignMeta.companions) {
        this.campaignMeta.companions.forEach(companion => {
          this.companionStatus.set(companion, { trust: 50, met: false });
          this.relationships.set(companion, 50);
        });
      }

      // Habilidades iniciales basadas en la campaña
      this.skills = [
        { id: "exorcismo", level: 2, tags: ["luz", "espiritual"], description: "Purificar entidades demoníacas" },
        { id: "percepcion_sobrenatural", level: 1, tags: ["detección", "mística"], description: "Detectar presencias sobrenaturales" }
      ];
      
      // Ubicación inicial de campaña
      this.location = "Alicante";

      console.log(`📜 Objetivos de campaña inicializados: ${this.questObjectives.length} objetivos`);
    }
  }

  initializeSandboxFromConcept(concept) {
    this.sandboxConcept = concept;
    
    // Stats emergentes básicos para sandbox
    this.skills = []; // Comenzar sin habilidades específicas
    this.vitals.health = 100;
    this.vitals.mana = 50; // Menos maná inicial en sandbox
    this.resources.gold = 20; // Menos oro inicial
    
    // Ubicación inicial basada en el concepto
    if (concept.toLowerCase().includes('restaurante')) {
      this.location = 'Tu Restaurante';
    } else if (concept.toLowerCase().includes('ciudad')) {
      this.location = 'Ciudad';
    } else if (concept.toLowerCase().includes('casa') || concept.toLowerCase().includes('habitación')) {
      this.location = 'Tu Hogar';
    } else {
      this.location = 'Lugar de Inicio';
    }
    
    console.log(`🎨 Sandbox inicializado con concepto: "${concept.substring(0, 50)}..."`);
  }
}

// 💀 ANÁLISIS MEJORADO PARA DETECTAR CAMBIOS Y MUERTE
/**
 * 🎯 SISTEMA HÍBRIDO: LOCAL + IA FALLBACK
 * Cache para evitar llamadas repetidas a IA
 */
const aiMatchCache = new Map();

/**
 * 🚀 MATCH LOCAL MEJORADO (90% de casos)
 */
function matchItemLocal(description) {
  if (!description || typeof description !== 'string') return null;
  
  // 🧹 NORMALIZAR: quitar tildes, puntuación, espacios extra
  const normalized = description.toLowerCase()
    .replace(/[áéíóú]/g, match => ({'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[match]))
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`🔍 [LOCAL] Analizando: "${description}" → normalizado: "${normalized}"`);
  
  // 🎯 BUSCAR EN BASE DE DATOS LOCAL
  for (const item of ITEM_DATABASE) {
    for (const keyword of item.keywords) {
      if (normalized.includes(keyword)) {
        const shortName = createShortName(description, keyword, item.type);
        
        console.log(`✅ [LOCAL] Match encontrado: "${keyword}" → ${shortName} ${item.icon}`);
        return {
          name: shortName,
          fullDescription: description,
          type: item.type,
          icon: item.icon,
          confidence: 'high',
          source: 'local',
          matchedKeyword: keyword
        };
      }
    }
  }
  
  console.log(`❌ [LOCAL] Sin match para: "${description}"`);
  return null;
}

/**
 * 🤖 FALLBACK IA CON CACHE (10% de casos edge)
 */
async function matchItemAI(description, openaiClient) {
  if (!description || !openaiClient) return null;
  
  // 🏆 VERIFICAR CACHE PRIMERO
  if (aiMatchCache.has(description)) {
    const cached = aiMatchCache.get(description);
    console.log(`💾 [AI-CACHE] Usando resultado cacheado para: "${description}" → ${cached.icon}`);
    return cached;
  }
  
  try {
    console.log(`🤖 [AI] Consultando fallback para: "${description}"`);
    
    const prompt = `Dame SOLO el emoji más apropiado para este objeto de RPG: "${description}". 
Responde SOLO con el emoji, nada más. Si no hay emoji específico, responde "📦".`;
    
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 5
    });
    
    const aiIcon = response.choices[0].message.content.trim();
    
    // 🎨 CREAR RESULTADO AI
    const result = {
      name: createShortName(description, description.split(' ')[0], 'unknown'),
      fullDescription: description,
      type: 'ai_detected',
      icon: /\p{Emoji}/u.test(aiIcon) ? aiIcon : '📦',
      confidence: 'medium',
      source: 'ai',
      matchedKeyword: 'ai_fallback'
    };
    
    // 💾 CACHEAR RESULTADO
    aiMatchCache.set(description, result);
    
    console.log(`✅ [AI] Match encontrado: "${description}" → ${result.name} ${result.icon}`);
    return result;
    
  } catch (error) {
    console.log(`❌ [AI] Error en fallback: ${error.message}`);
    return null;
  }
}

/**
 * 🎯 FUNCIÓN PRINCIPAL: LOCAL FIRST + AI FALLBACK
 */
async function matchItemIntelligent(description, openaiClient = null) {
  if (!description || typeof description !== 'string') {
    return { name: description, type: 'unknown', icon: '📦', confidence: 'none', source: 'fallback' };
  }
  
  // 1️⃣ INTENTAR MATCH LOCAL PRIMERO (RÁPIDO)
  const localMatch = matchItemLocal(description);
  if (localMatch) {
    return localMatch;
  }
  
  // 2️⃣ FALLBACK A IA (SOLO SI ES NECESARIO)
  if (openaiClient) {
    const aiMatch = await matchItemAI(description, openaiClient);
    if (aiMatch) {
      return aiMatch;
    }
  }
  
  // 3️⃣ FALLBACK FINAL
  console.log(`📦 [FALLBACK] Usando genérico para: "${description}"`);
  return {
    name: description.split(' ')[0].charAt(0).toUpperCase() + description.split(' ')[0].slice(1),
    fullDescription: description,
    type: 'unknown',
    icon: '📦',
    confidence: 'low',
    source: 'fallback',
    matchedKeyword: 'none'
  };
}

/**
 * 🎨 CREAR NOMBRES CORTOS PERO DESCRIPTIVOS
 * "espada de marfil bañada en lágrimas" → "Espada de marfil"
 */
function createShortName(fullText, keyword, type) {
  const words = fullText.toLowerCase().split(' ');
  const keywordIndex = words.findIndex(w => w.includes(keyword.toLowerCase()));
  
  if (keywordIndex === -1) {
    return keyword.charAt(0).toUpperCase() + keyword.slice(1);
  }
  
  // Tomar el keyword + 1-2 palabras descriptivas importantes
  let shortName = [words[keywordIndex]];
  
  // Añadir adjetivos importantes ANTES del keyword
  for (let i = keywordIndex - 1; i >= 0 && shortName.length < 3; i--) {
    const word = words[i];
    if (isImportantAdjective(word)) {
      shortName.unshift(word);
    }
  }
  
  // Añadir adjetivos importantes DESPUÉS del keyword  
  for (let i = keywordIndex + 1; i < words.length && shortName.length < 3; i++) {
    const word = words[i];
    if (isImportantAdjective(word)) {
      shortName.push(word);
    }
  }
  
  // Capitalizar primera letra
  return shortName.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * 🏷️ DETECTAR ADJETIVOS IMPORTANTES PARA NOMBRES CORTOS
 */
function isImportantAdjective(word) {
  const importantAdjectives = [
    // Materiales
    'marfil', 'oro', 'plata', 'hierro', 'acero', 'cristal', 'diamante',
    // Colores importantes
    'negro', 'dorado', 'plateado', 'rojo', 'azul', 'verde',
    // Orígenes/tipos
    'élfico', 'élfica', 'enano', 'enana', 'mágico', 'mágica', 'sagrado', 'sagrada',
    'ancestral', 'antiguo', 'antigua', 'legendario', 'legendaria',
    // Tamaños
    'grande', 'pequeño', 'pequeña', 'gigante'
  ];
  
  return importantAdjectives.includes(word.toLowerCase());
}

async function analyzeNarrativeForStateChanges(action, narrative, gameState, openaiClient) {
  try {
    const analysisPrompt = `
Analiza esta acción y narrativa de un RPG para determinar cambios REALES en el estado del personaje.

ACCIÓN: "${action}"
NARRATIVA: "${narrative}"

ESTADO ACTUAL:
- Salud: ${gameState.vitals.health}/100
- Ubicación actual: ${gameState.location}
- Miedo: ${gameState.emotionalStates.miedo}/100
- Alerta: ${gameState.emotionalStates.alerta}/100

IMPORTANTE: Analiza la narrativa REALMENTE y detecta SOLO:

🚫 NO DETECTES CAMBIOS DE INVENTARIO EN NINGÚN CASO
🚫 El inventario se maneja automáticamente por otro sistema
🚫 NUNCA incluyas "newInventoryItem" o "removeInventoryItem" en tu respuesta

SÍ DETECTA:
1. NUEVAS HABILIDADES con CLASIFICACIÓN:
   - ACTIVAS: combate, ataques, acciones que requieren activación (esgrima, tiro con arco, salto, etc.)
   - MAGIA: hechizos, conjuros, magia (curación, bola de fuego, telepatía, etc.)  
   - PASIVAS: conocimientos, oficios, resistencias (forja, cocina, resistencia veneno, etc.)
2. CAMBIOS DE SALUD/MANÁ/STAMINA (-10 salud, +20 maná, etc.)
3. CAMBIOS EMOCIONALES SIGNIFICATIVOS (terror extremo, calma total, ira, etc.)
4. CAMBIOS DE UBICACIÓN (entrar cueva, salir bosque, llegar pueblo, etc.)
5. NUEVOS OBJETIVOS (encontrar reliquia, hablar con X, etc.)

INVENTARIO ACTUAL:
${gameState.inventory.map((item, index) => `${index}: ${item.name} ${item.icon}`).join('\n')}

Responde SOLO con un JSON válido:

{
  "vitalDelta": {"health": -15, "mana": -20, "stamina": -10},
  "statusSet": {"miedo": 70, "alerta": 90, "fatiga": 30},
  "locationChange": "Nueva Ubicación Específica",
  "newSkill": {"id": "forja_espadas", "level": 1, "category": "pasiva", "tags": ["craft"], "description": "Habilidad para forjar armas"},
  "resourceDelta": {"gold": +10, "rations": -1},
  "relationshipDelta": {"Persona": +15},
  "knowledgeDelta": {"Tema": +20},
  "forceDeathCheck": false,
  "deathReason": ""
}

CLASIFICACIÓN DE SKILLS OBLIGATORIA:
- category: "activa" = Habilidades de combate y acciones (esgrima, arquería, salto, etc.)
- category: "magia" = Hechizos y poderes mágicos (curación, fuego, telepatía, etc.)  
- category: "pasiva" = Conocimientos y oficios (forja, cocina, historia, etc.)

CRITERIOS ESPECÍFICOS:
- Combate/Daño = health -10 a -30
- Magia/Hechizos = mana -10 a -25
- Correr/Esfuerzo = stamina -15 a -30
- Situaciones aterradoras = miedo 40-90
- Peligro inminente = alerta 70-95
- Mover entre lugares = locationChange obligatorio
- Acciones mortales (caer de acantilado, explosión, veneno letal) = forceDeathCheck: true

Si NO hay cambios evidentes, responde: {}
`;

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.2,
      max_tokens: 400
    });

    const stateChangesText = response.choices[0].message.content.trim();
    console.log('🔍 Análisis IA raw:', stateChangesText);
    
    // Limpiar respuesta para asegurar JSON válido
    const jsonMatch = stateChangesText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const stateChanges = JSON.parse(jsonMatch[0]);
      console.log('📊 Cambios detectados:', stateChanges);
      return stateChanges;
    }
    
    return {};
  } catch (error) {
    console.error('Error analizando cambios de estado:', error);
    return {};
  }
}

// Initialize MongoDB connection
async function initDatabase() {
  try {
    await client.connect();
    db = client.db('hellbound_rpg');
    console.log('📄 Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  }
}

// Routes
app.get('/api/healthcheck', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Hellbound RPG Node.js backend is running',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY,
    mongo_connected: !!db
  });
});

// ENDPOINT PARA POLLING DE BADGES
app.get('/api/get_session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || !gameSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const gameState = gameSessions.get(sessionId);
    
    res.json({
      session_id: sessionId,
      game_state: gameState.toDict()
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/start_session', async (req, res) => {
  try {
    const { mode = 'sandbox', campaign, sandboxConcept } = req.body;
    const sessionId = crypto.randomUUID();
    const gameState = new GameState(sessionId);
    
    gameState.mode = mode;
    gameSessions.set(sessionId, gameState);
    
    let initialNarrative;
    let suggestedActions = [];
    
    // 🎨 NUEVO FLUJO SANDBOX CONCEPT-FIRST
    if (mode === 'sandbox') {
      if (!sandboxConcept || !sandboxConcept.trim()) {
        return res.status(400).json({ 
          error: 'Para modo Sandbox, debes proporcionar un campo "sandboxConcept" con tu idea de historia' 
        });
      }
      
      gameState.initializeSandboxFromConcept(sandboxConcept);
      
      // Generar narrativa inicial basada en el concepto del usuario
      const conceptPrompt = `
El usuario quiere jugar una historia RPG con esta idea: "${sandboxConcept}"

Crea una narrativa inicial inmersiva (máximo 4 oraciones) en segunda persona que:
1. Establezca la situación inicial basada en su concepto
2. Sea envolvente y específica 
3. Termine con una situación que requiera una decisión
4. Use un tono natural, no dramático
5. En español

Responde SOLO con la narrativa, sin explicaciones.
`;

    try {
      const conceptResponse = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: conceptPrompt }],
          temperature: 0.8,
          max_tokens: 200
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI timeout')), 15000)
        )
      ]);
      initialNarrative = conceptResponse.choices[0].message.content || fallbackNarrative;
    } catch (error) {
      console.log("⚠️ OpenAI timeout o error, usando narrativa rápida:", error.message);
      initialNarrative = `Tu historia comienza con una idea fascinante: ${sandboxConcept}. Te encuentras en el punto de partida de esta aventura, con el mundo ante ti esperando a ser moldeado por tus decisiones. ¿Cómo quieres que comience tu historia?`;
    }

        
    } else if (mode === 'campaign') {
      // Handle campaign mode with full loading
      const camp = loadFullCampaign(campaign || 'scenes_act1');
      if (!camp) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }
      
      // Set campaign data in game state
      gameState.campaignMeta = camp.json;
      gameState.map = camp.map;
      
      // 📖 INICIALIZAR GESTOR DE HISTORIA AVANZADO
      gameState.initializeCampaignObjectives();
      
      // Create immersive intro
      const bookTitle = "Hellbound: El infierno en la tierra";
      const campaignTitle = camp.json.titulo || "Aventura Épica";
      
      if (camp.firstText && camp.firstText.includes("La nieve cae sobre Alicante")) {
        initialNarrative = `Despiertas en tu habitación en Alicante. Lo primero que notas es el frío que se filtra por las ventanas, y una extraña quietud en el aire. Algo en el ambiente te pone en alerta, como si una presencia invisible observara cada uno de tus movimientos.

A través de la ventana, entre la niebla matutina, vislumbras una figura que no debería estar ahí. Tus instintos de exorcista se despiertan inmediatamente.

Bienvenido a "${campaignTitle}", una historia basada en el universo de ${bookTitle}. Tu entrenamiento te ha preparado para enfrentar lo sobrenatural, pero esta situación parece diferente.`;
      } else {
        initialNarrative = `Bienvenido a "${campaignTitle}", una aventura épica basada en ${bookTitle}. 

${camp.firstText || 'Tu historia comienza ahora.'}`;
      }
      
    } else {
      // Seasonal mode
      initialNarrative = `¡Evento especial activo! Las energías cósmicas se alinean de manera inusual, alterando las reglas conocidas del mundo. Te encuentras en ${gameState.location} durante esta época de cambios místicos, donde nuevas oportunidades y peligros aguardan.`;
      
      // Habilidades especiales para modo temporal
      gameState.skills.push({
        id: "resonancia_temporal", 
        level: 1, 
        tags: ["temporal", "especial"], 
        description: "Sincronizar con energías estacionales"
      });
    }
    
    // Generate initial suggested actions with AI
    suggestedActions = await generateSuggestedActions(gameState, initialNarrative, openai);
    
    // Add to narrative log - SIN DUPLICACIÓN
    gameState.narrativeLog = [{
      timestamp: new Date().toISOString(),
      player_action: `[Inicio de ${mode}]`,
      narrative: initialNarrative
    }];
    
    // Save to MongoDB
    if (db) {
      await db.collection('sessions').insertOne(gameState.toDict());
    }
    
    res.json({
      session_id: sessionId,
      game_state: gameState.toDict(),
      initial_narrative: initialNarrative,
      suggested_actions: suggestedActions,
      mode: mode
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/free_input', async (req, res) => {
  try {
    const { session_id, action } = req.body;
    
    if (!session_id || !gameSessions.has(session_id)) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    if (!action || !action.trim()) {
      return res.status(400).json({ error: 'No action provided' });
    }
    
    const gameState = gameSessions.get(session_id);
    
    // 💀 VERIFICAR SI EL JUGADOR ESTÁ VIVO
    if (!gameState.isAlive) {
      return res.json({
        success: false,
        narrative: `💀 GAME OVER 💀\n\n${gameState.deathReason}\n\nTu aventura ha llegado a su fin. Las decisiones tienen consecuencias... y algunas son fatales.`,
        suggested_actions: ["Reiniciar partida"],
        game_state: gameState.toDict(),
        game_over: true
      });
    }
    
    function generateSandboxRestrictions(sandboxConcept) {
      if (!sandboxConcept) return '- Sin restricciones específicas';
      
      const concept = sandboxConcept.toLowerCase();
      let restrictions = [];
      
      // Detectar temas y aplicar restricciones correspondientes
      if (concept.includes('real') || concept.includes('realista') || concept.includes('sin magia') || 
          concept.includes('sin sobrenatural') || concept.includes('normal') || concept.includes('mundano')) {
        restrictions.push('- NO incluir magia, hechizos, poderes sobrenaturales o elementos fantásticos');
        restrictions.push('- Mantener todo realista y creíble en el mundo real');
        restrictions.push('- Las acciones sugeridas deben ser realistas y posibles para un humano normal');
      }
      
      if (concept.includes('moderno') || concept.includes('contemporáneo') || concept.includes('actual')) {
        restrictions.push('- Ambientación moderna/contemporánea (tecnología actual)');
        restrictions.push('- No incluir elementos medievales o anacronismos');
      }
      
      if (concept.includes('pacífico') || concept.includes('sin violencia') || concept.includes('tranquilo')) {
        restrictions.push('- Evitar violencia, combates o situaciones agresivas');
        restrictions.push('- Enfocarse en resolución pacífica de conflictos');
      }
      
      if (concept.includes('serio') || concept.includes('profesional') || concept.includes('formal')) {
        restrictions.push('- Mantener tono serio y profesional');
        restrictions.push('- Evitar humor o situaciones cómicas');
      }
      
      if (concept.includes('investigación') || concept.includes('detective') || concept.includes('misterio')) {
        restrictions.push('- Enfocarse en pistas, deducciones y metodología investigativa');
        restrictions.push('- Las acciones deben ser propias de un investigador o detective');
      }
      
      if (concept.includes('urbano') || concept.includes('ciudad') || concept.includes('metropolitano')) {
        restrictions.push('- Mantener ambientación urbana/citadina');
        restrictions.push('- No incluir elementos rurales o salvajes sin justificación');
      }
      
      // Si no se detectan restricciones específicas, dar flexibilidad
      if (restrictions.length === 0) {
        restrictions.push('- Respetar el tono y tema general del concepto proporcionado');
        restrictions.push('- Mantener coherencia con la visión original del usuario');
      }
      
      return restrictions.join('\n');
    }
    
    // Create enhanced system prompt following Sombra Arcana DM v2.0
    let campaignContext = '';
    
    if (gameState.campaignMeta) {
      const storyMode = gameState.campaignMeta.story_mode || 'campaign';
      
      campaignContext = `
MODO DE HISTORIA: ${storyMode.toUpperCase()}
CAMPAÑA: "${gameState.campaignMeta.titulo}"
NIVEL DE TONO: ${gameState.campaignMeta.tone_level || 5}/10
SESGO DE TONO ACTUAL: ${gameState.toneBias} (-5=luminoso, +5=oscuro)
ACTO ACTUAL: ${gameState.storyAct} de ${gameState.campaignMeta.acto_total}
PROGRESO DEL ACTO: ${gameState.actProgress}%
`;

      if (storyMode === 'campaign') {
        campaignContext += `
COMPAÑEROS DISPONIBLES: ${gameState.campaignMeta.companions?.join(', ') || 'Ninguno'}
QUEST_STAGE: ${gameState.questStage}
DIVERGENCE_SCORE: ${gameState.divergenceScore}
LOCACIONES DEL MUNDO: ${gameState.campaignMeta.locations?.join(' → ') || 'Desconocidas'}

CONTEXTO NARRATIVO ESPECÍFICO DE "${gameState.campaignMeta.titulo}":
- BASADO EN: "Hellbound: El infierno en la tierra"
- Situación: Alicante con presencias sobrenaturales detectadas
- Los Errantes y el Uróboros son elementos importantes del mundo
- El Rey Hawkeye y los desequilibrios entre reinos son temas centrales
- SIEMPRE HABLA EN SEGUNDA PERSONA: Dirígete al jugador como "tú", nunca "el jugador"
`;
      }
    } else if (gameState.mode === 'sandbox') {
      campaignContext = `
MODO SANDBOX - CONCEPTO DEL USUARIO: "${gameState.sandboxConcept || 'Historia libre'}"
SESGO DE TONO ACTUAL: ${gameState.toneBias} (-5=luminoso, +5=oscuro)
- Desarrolla la historia según la visión del usuario
- Los stats y habilidades emergen orgánicamente
- Tono natural y adaptativo
- LAS ACCIONES PELIGROSAS PUEDEN SER MORTALES

RESTRICCIONES IMPORTANTES DEL CONCEPTO SANDBOX:
${generateSandboxRestrictions(gameState.sandboxConcept)}
`;
    }
    
    // Construir contexto de acciones recientes para mantener continuidad
    let recentContext = '';
    if (gameState.narrativeLog.length > 0) {
      const lastEntries = gameState.narrativeLog.slice(-3);
      recentContext = `
CONTEXTO DE ACCIONES RECIENTES (mantén continuidad):
${lastEntries.map((entry, index) => 
  `${index + 1}. "${entry.player_action}" → "${entry.narrative}"`
).join('\n')}

INSTRUCCIÓN CRÍTICA: Continúa DIRECTAMENTE desde la última situación. NO retrocedas ni describas situaciones previas.
`;
    }

    // Frases usadas recientemente para evitar repetición
    let antiRepetitionContext = '';
    if (gameState.usedPhrases.length > 0) {
      antiRepetitionContext = `
FRASES USADAS RECIENTEMENTE (evita repetir estos conceptos):
${gameState.usedPhrases.slice(-10).join(', ')}

INSTRUCCIÓN: Evita repetir palabras, frases o conceptos similares a los listados arriba. Busca sinónimos y enfoques narrativos frescos.
`;
    }

    // Construir contexto de objetivos activos
    let questContext = '';
    if (gameState.questObjectives.length > 0) {
      const activeObjectives = gameState.questObjectives.filter(obj => !obj.completed);
      if (activeObjectives.length > 0) {
        questContext = `
OBJETIVOS ACTIVOS:
${activeObjectives.map(obj => `- ${obj.description} (${obj.progress}%)`).join('\n')}
`;
      }
    }

    // Contexto de estados emocionales
    let emotionalContext = '';
    const strongEmotions = Object.entries(gameState.emotionalStates)
      .filter(([emotion, value]) => value > 60);
    if (strongEmotions.length > 0) {
      emotionalContext = `
ESTADOS EMOCIONALES INTENSOS:
${strongEmotions.map(([emotion, value]) => `- ${emotion}: ${value}%`).join('\n')}
INSTRUCCIÓN: Refleja estos estados en la narrativa de manera sutil.
`;
    }

    const systemPrompt = `
    Eres **Sombra Arcana**, IA Dungeon Master del ARPG Hellbound siguiendo el protocolo v3.0.
    Trabajas en **español neutro** y generas narrativa natural, variada y envolvente.
    
    ${campaignContext}
    
    LORE_BASE (si no hay campaña específica):
    - ${LORE.setting || 'Un mundo devastado por la guerra donde los demonios caminan por la tierra'}
    - Héroe: ${LORE.hero || 'Un exorcista solitario buscando redención'}
    - Antagonista: ${LORE.antagonist || 'El Príncipe Caído gobernando el Reino Ardiente'}
    
    ESTADO ACTUAL DEL JUGADOR:
    - Salud: ${gameState.vitals.health}/100, Maná: ${gameState.vitals.mana}/100, Stamina: ${gameState.vitals.stamina}/100
    - Oro: ${gameState.resources.gold}, Ubicación: ${gameState.location}
    - Habilidades: ${gameState.skills.length > 0 ? 
        gameState.skills.map(s => `${s.id} (Nv.${s.level})`).join(', ') : 'Ninguna habilidad específica'}
    - Fuerza: ${gameState.attributes.fuerza}, Agilidad: ${gameState.attributes.agilidad}, Sabiduría: ${gameState.attributes.sabiduría}
    
    ${recentContext}
    
    ${antiRepetitionContext}
    
    ${questContext}
    
    ${emotionalContext}
    
    PROTOCOLO SOMBRA ARCANA v3.0:
    1. **Tono Natural**: Ajusta según toneBias, pero prioriza naturalidad sobre drama forzado
    2. **Variedad Narrativa**: Evita repetir conceptos, palabras o estructuras previas
    3. **Continuidad Temporal**: Continúa directamente desde la última situación
    4. **Realismo Emocional**: Los estados intensos influyen sutilmente en la narrativa
    5. **Coherencia**: Mantén consistencia con el mundo establecido
    6. **Progresión Orgánica**: Los cambios emergen naturalmente de las acciones
    7. **CONSECUENCIAS REALES**: Las acciones peligrosas pueden ser mortales
    
    ESTILO NARRATIVO:
    - Máximo 4 oraciones descriptivas y fluidas
    - Vocabulario variado y fresco
    - Tono que fluye con la situación (no siempre dramático)
    - Segunda persona ("tú")
    - NO repetir descripciones de elementos ya establecidos
    - Enfoque en avanzar la acción y situación
    - SER REALISTA: acciones estúpidas tienen consecuencias graves
    
    ACCIÓN DEL JUGADOR: "${action}"
    
    Genera una narrativa que continúe naturalmente la historia, evitando repeticiones y manteniendo un flujo envolvente.
    `;
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `El jugador dice: '${action}'` }
      ],
      temperature: 0.8,
      max_tokens: 300
    });
    
    const message = response.choices?.[0]?.message;
    let narrative = message?.content || "El eco de tu acción resuena en el silencio...";
    
    // 🎯 DETECCIÓN MANUAL DE ITEMS PARA TESTING (ANTES DE IA)
    const actionLowerForFlags = (action || '').toLowerCase();
    console.log('🔍 ANALYZING ACTION:', actionLowerForFlags);
    
    // 🎯 SISTEMA DE DETECCIÓN DE ITEMS INTELIGENTE Y ROBUSTO
    console.log('🔍 ANALYZING ACTION:', actionLowerForFlags);
    
    // FUNCIÓN PARA VALIDAR SI ES UN ITEM FÍSICO REAL - DINÁMICO DESDE ITEM_DATABASE
    const isPhysicalItem = (itemText) => {
      // ✅ EXTRAER TODAS LAS KEYWORDS DE LA BASE DE DATOS AUTOMÁTICAMENTE
      const physicalKeywords = ITEM_DATABASE.flatMap(item => item.keywords);
      
      // ❌ Palabras que NO son items físicos (EXPANDIDO)
      const nonPhysicalKeywords = [
        'hechizo', 'conjuro', 'spell', 'magia', 'encantamiento',
        'lección', 'enseñanza', 'conocimiento', 'sabiduría',
        'poder', 'habilidad', 'técnica', 'destreza',
        'experiencia', 'recuerdo', 'memoria',
        'piso', 'suelo', 'mesa', 'lugar', 'sitio', // ubicaciones
        'usarlo', 'usarla', 'weapon', 'tool', 'para', 'como' // contexto
      ];
      
      const lowerItem = itemText.toLowerCase();
      
      // ❌ Si contiene palabras no-físicas, rechazar inmediatamente
      if (nonPhysicalKeywords.some(keyword => lowerItem.includes(keyword))) {
        return false;
      }
      
      // ❌ Si es muy corto o contiene solo preposiciones, rechazar
      if (itemText.length < 3 || /^(de|del|la|el|en|para|como|con)$/i.test(lowerItem)) {
        return false;
      }
      
      // ✅ Si contiene palabras físicas, aceptar (DINÁMICO)
      return physicalKeywords.some(keyword => lowerItem.includes(keyword.toLowerCase()));
    };
    
    // DETECTAR ITEMS DE FORMA CONTEXTUAL E INTELIGENTE - CORREGIDO PARA MÚLTIPLES ITEMS
    const detectMultipleItems = (action) => {
      const items = [];
      
      // 🎯 REGEX CONTEXTUAL SIMPLE Y EFECTIVO - INCLUYE GUARDAR
      const contextualPattern = /\b(?:agarro|agarré|recojo|recogí|tomo|tomé|encuentro|encontré|consigo|conseguí|robo|robé|robaba|cogí|coger|guardo|guardaba|guardar|me quedo)\s+(?:un[ae]?|el|la|los|las)?\s*(.+)/gi;
      
      let match;
      while ((match = contextualPattern.exec(action)) !== null) {
        let fullText = match[1].trim();
        
        console.log(`🔍 Texto completo detectado: "${fullText}"`);
        
        // 🧹 LIMPIAR: Remover contexto de ubicación al final
        fullText = fullText.replace(/\s+(que\s+están?\s+en\s+.+|del?\s+piso|de\s+la\s+mesa|del?\s+suelo|para\s+usar|como\s+arma|de\s+arma|para\s+atacar)$/gi, '').trim();
        
        console.log(`🔍 Texto limpio: "${fullText}"`);
        
        // 🎯 DIVIDIR POR COMAS Y "Y" PARA MÚLTIPLES ITEMS
        const itemList = fullText
          .split(/\s*[,]\s*|\s+y\s+/i) // Dividir por "," o " y "
          .map(item => item.trim())
          .filter(item => item.length > 0);
        
        console.log(`🔍 Items individuales detectados:`, itemList);
        
        // 🎯 PROCESAR CADA ITEM INDIVIDUALMENTE
        for (let itemText of itemList) {
          // 🧹 LIMPIAR ARTÍCULOS DE CADA ITEM
          itemText = itemText.replace(/^(un[ae]?|el|la|los|las)\s+/i, '').trim();
          
          console.log(`🔍 Item individual limpio: "${itemText}"`);
          
          // ❌ FILTROS BÁSICOS
          if (itemText.length < 3) {
            console.log(`❌ Muy corto: "${itemText}"`);
            continue;
          }
          
          // ❌ Si es solo preposiciones/artículos
          if (/^(que|del|de|la|el|en|para|como|con|sin|por|desde|hasta|sobre|bajo|un|una|los|las)$/i.test(itemText)) {
            console.log(`❌ Solo preposiciones: "${itemText}"`);
            continue;
          }
          
          // ✅ VERIFICAR QUE CONTENGA AL MENOS UN KEYWORD FÍSICO
          if (containsPhysicalKeyword(itemText)) {
            // 🔍 EVITAR DUPLICADOS INTELIGENTE
            const isDuplicate = items.some(existing => {
              const lowerExisting = existing.toLowerCase();
              const lowerItem = itemText.toLowerCase();
              // Si el 80% de las palabras coinciden, es duplicado
              const overlap = calculateWordOverlap(lowerExisting, lowerItem);
              return overlap > 0.8;
            });
            
            if (!isDuplicate) {
              items.push(itemText);
              console.log(`✅ Item válido detectado: "${itemText}"`);
            } else {
              console.log(`⚠️ Duplicado evitado: "${itemText}"`);
            }
          } else {
            console.log(`❌ No contiene keywords físicos: "${itemText}"`);
          }
        }
      }
      
      return items;
    };
    
    // 🔍 VERIFICAR SI CONTIENE AL MENOS UN KEYWORD DE ITEM FÍSICO - DINÁMICO DESDE ITEM_DATABASE
    const containsPhysicalKeyword = (text) => {
      // ✅ EXTRAER TODAS LAS KEYWORDS DE LA BASE DE DATOS AUTOMÁTICAMENTE
      const allKeywords = ITEM_DATABASE.flatMap(item => item.keywords);
      
      console.log(`🔍 KEYWORDS DINÁMICAS DISPONIBLES: ${allKeywords.length} total`);
      
      const lowerText = text.toLowerCase();
      // 🔧 USAR WORD BOUNDARIES PARA EVITAR FALSOS POSITIVOS (ej: "daga" dentro de "desgastada")
      return allKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
        return regex.test(lowerText);
      });
    };
    
    // 📊 CALCULAR OVERLAP DE PALABRAS PARA DETECTAR DUPLICADOS
    const calculateWordOverlap = (text1, text2) => {
      const words1 = text1.split(' ').filter(w => w.length > 2);
      const words2 = text2.split(' ').filter(w => w.length > 2);
      
      if (words1.length === 0 || words2.length === 0) return 0;
      
      const commonWords = words1.filter(w => words2.includes(w)).length;
      const totalWords = Math.max(words1.length, words2.length);
      
      return commonWords / totalWords;
    };
    
    // APLICAR DETECCIÓN MÚLTIPLE
    const detectedItems = detectMultipleItems(actionLowerForFlags);
    console.log('📦 ITEMS DETECTADOS:', detectedItems);
    
    // AÑADIR CADA ITEM DETECTADO CON SISTEMA HÍBRIDO
    for (const itemName of detectedItems) {
      // 🎯 USAR SISTEMA HÍBRIDO: LOCAL + AI FALLBACK
      const matchResult = await matchItemIntelligent(itemName, openai);
      
      console.log(`📦 [${matchResult.source.toUpperCase()}] Item procesado: "${itemName}" → ${matchResult.name} ${matchResult.icon} (${matchResult.confidence})`);
      
      const newItem = {
        name: matchResult.name, // Nombre corto para UI
        fullDescription: matchResult.fullDescription, // Descripción completa
        type: matchResult.type,
        icon: matchResult.icon,
        description: `${matchResult.name} encontrado`,
        confidence: matchResult.confidence,
        source: matchResult.source, // NUEVO: tracking de origen
        instanceId: crypto.randomUUID()
      };
      
      // Verificar que no existe ya (evitar duplicados)
      const exists = gameState.inventory.some(item => 
        item.name.toLowerCase() === newItem.name.toLowerCase()
      );
      
      if (!exists) {
        gameState.inventory.push(newItem);
        console.log(`📦 ITEM AÑADIDO: ${newItem.name} ${newItem.icon}`);
        narrative += ` Añades ${newItem.name} a tu inventario.`;
      } else {
        console.log(`⚠️ ITEM YA EXISTE: ${newItem.name}`);
      }
    }
    
    // Detectar soltar items CON SOPORTE PARA MÚLTIPLES ITEMS
    const dropRegex = /\b(?:suelto|dejo|tiro|abandono|desecho|boto)\b\s+(?:un[ae]?|la?|el)?\s*(.+?)(?:\s+(?:del?|de la?)\s.+|$)/i;
    const dropMatch = actionLowerForFlags.match(dropRegex);
    
    if (dropMatch) {
      let itemsToDrop = dropMatch[1].trim();
      console.log('❌ TEXTO DETECTADO PARA DROP:', itemsToDrop);
      
      // Dividir por "y" para múltiples items: "escudo y libro" → ["escudo", "libro"]
      const itemList = itemsToDrop.split(/\s+y\s+/i).map(item => 
        item.trim().replace(/^(un[ae]?|el|la|los|las)\s+/i, '')
      );
      
      console.log('❌ ITEMS INDIVIDUALES PARA DROP:', itemList);
      
      // Procesar cada item por separado
      for (const itemNameToDrop of itemList) {
        if (!itemNameToDrop) continue;
        
        const itemIndex = gameState.inventory.findIndex(item => 
          (item?.name || '').toLowerCase().includes(itemNameToDrop.toLowerCase())
        );
        
        if (itemIndex !== -1) {
          const removedItem = gameState.inventory.splice(itemIndex, 1)[0];
          console.log(`❌ ITEM ELIMINADO EXITOSAMENTE: ${removedItem.name} ${removedItem.icon}`);
          narrative += ` Sueltas ${removedItem.name}.`;
        } else {
          console.log(`⚠️ ITEM NO ENCONTRADO PARA DROP: "${itemNameToDrop}"`);
        }
      }
    }
    
    console.log('🔍 CURRENT INVENTORY:', gameState.inventory.map(item => `${item.name} ${item.icon}`));
    
    // 📊 ANALIZAR CAMBIOS DE ESTADO DINÁMICOS (MEJORADO)
    const stateChanges = await analyzeNarrativeForStateChanges(action, narrative, gameState, openai);
    
    // Aplicar cambios de estado
    if (Object.keys(stateChanges).length > 0) {
      gameState.applyStateChanges(stateChanges);
    }
    
    // 💀 VERIFICAR MUERTE DESPUÉS DE APLICAR CAMBIOS
    if (!gameState.isAlive) {
      return res.json({
        success: false,
        narrative: `${narrative}\n\n💀 GAME OVER 💀\n\n${gameState.deathReason}`,
        suggested_actions: ["Reiniciar partida"],
        game_state: gameState.toDict(),
        state_changes: stateChanges,
        game_over: true
      });
    }
    
    // Actualizar historial de frases usadas para evitar repetición
    const narrativeWords = narrative.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4)
      .slice(0, 5);
    gameState.usedPhrases.push(...narrativeWords);
    gameState.usedPhrases = gameState.usedPhrases.slice(-30); // Mantener solo últimas 30
    
    // Actualizar sesgo de tono si es necesario
    if (stateChanges.toneBiasChange) {
      gameState.toneBias = Math.max(-5, Math.min(5, gameState.toneBias + stateChanges.toneBiasChange));
    }
    
    // Generate new suggested actions based on the narrative and context with AI
    const suggestedActions = await generateSuggestedActions(gameState, narrative, openai);
    
    // Add to narrative log - EVITAR DUPLICACIÓN
    const newEntry = {
      timestamp: new Date().toISOString(),
      player_action: action,
      narrative: narrative
    };
    
    gameState.narrativeLog.push(newEntry);
    // Mantener solo las últimas 10 entradas para evitar acumulación
    gameState.narrativeLog = gameState.narrativeLog.slice(-10);

    // 🧠 SISTEMA DE MEMORIA MEJORADO - Detectar eventos importantes
    gameState.actionCount++;
    
    // 📖 GESTOR DE HISTORIA AVANZADO - Actualizar progreso
    if (gameState.mode === 'campaign') {
      gameState.updateQuestProgress(action, narrative);
    }
    
    // Detectar decisiones importantes
    const importantDecisionKeywords = ['matar', 'salvar', 'elegir', 'rechazar', 'aceptar', 'traicionar', 'aliarse'];
    if (importantDecisionKeywords.some(keyword => action.toLowerCase().includes(keyword))) {
      gameState.addMajorDecision(action, 'media');
    }
    
    // Detectar interacciones con compañeros
    if (gameState.campaignMeta && gameState.campaignMeta.companions) {
      gameState.campaignMeta.companions.forEach(companion => {
        const companionFirst = companion.split(' ')[0].toLowerCase();
        if (action.toLowerCase().includes(companionFirst) || narrative.toLowerCase().includes(companionFirst)) {
          gameState.updateCompanionStatus(companion, 'met', true);
          if (action.toLowerCase().includes('hablar') || action.toLowerCase().includes('conversar')) {
            gameState.updateCompanionStatus(companion, 'trust', 10);
            // Actualizar también en relationships
            const currentRel = gameState.relationships.get(companion) || 50;
            gameState.relationships.set(companion, Math.min(100, currentRel + 10));
          }
        }
      });
    }
    
    // Detectar flags de eventos importantes basados en palabras clave
    const narrativeLower = (narrative || '').toLowerCase();
    
    if (actionLowerForFlags.includes('morir') || narrativeLower.includes('mueres') || narrativeLower.includes('muerte')) {
      gameState.addEventFlag('MUERTE', 'Evento de muerte detectado');
    }
    if (actionLowerForFlags.includes('combate') || actionLowerForFlags.includes('atacar') || narrativeLower.includes('batalla')) {
      gameState.addEventFlag('COMBATE', `Combate en ${gameState.location}`);
    }
    if (actionLowerForFlags.includes('compañero') || narrativeLower.includes('compañero') || narrativeLower.includes('aliado')) {
      gameState.addEventFlag('COMPAÑERO', 'Interacción con compañero detectada');
    }
    if (narrativeLower.includes('quest') || narrativeLower.includes('misión') || narrativeLower.includes('objetivo')) {
      gameState.addEventFlag('QUEST', 'Progreso de misión detectado');
    }

    // Generar resumen automático cada 10 acciones
    if (gameState.actionCount % 10 === 0) {
      await gameState.generateSessionSummary(openai);
    }
    
    // Update in MongoDB
    if (db) {
      await db.collection('sessions').updateOne(
        { sessionId: session_id },
        { $set: gameState.toDict() }
      );
    }
    
    // Emit to WebSocket
    io.to(session_id).emit('game_update', {
      session_id: session_id,
      game_state: gameState.toDict(),
      new_narrative: narrative,
      suggested_actions: suggestedActions,
      state_changes: stateChanges
    });
    
    
    // 🎯 FUNCIÓN: SEPARAR ITEMS COMPUESTOS CONECTADOS POR CONJUNCIONES
    function splitCompoundItems(itemText) {
      if (!itemText || typeof itemText !== 'string') return [itemText];
      
      // Separar por conjunciones comunes según ChatGPT
      const separators = [' y ', ' e ', ' y el ', ' y la ', ' e el ', ' e la ', ' y junto ', ' con ', ', y ', ',', ';'];
      let items = [itemText];
      
      separators.forEach(separator => {
        let newItems = [];
        items.forEach(item => {
          if (item.includes(separator)) {
            const parts = item.split(separator);
            newItems.push(...parts.map(part => part.trim()));
          } else {
            newItems.push(item);
          }
        });
        items = newItems;
      });
      
      // Limpiar items vacíos o demasiado cortos
      const cleanedItems = items
        .map(item => item.trim())
        .filter(item => item.length > 2 && !['el', 'la', 'un', 'una', 'de', 'del', 'y', 'e', 'con', 'junto'].includes(item.toLowerCase()));
      
      console.log(`🔧 splitCompoundItems: "${itemText}" → [${cleanedItems.join(', ')}]`);
      return cleanedItems;
    }
    
    // 🔧 FUNCIÓN: DETECCIÓN INTELIGENTE DE ITEMS EN NARRATIVA
    function extractItemsFromNarrative(narrative) {
      console.log('📖 Analizando narrativa para detectar items...');
      
      // 🔧 ARREGLO GPT-4: Procesar solo la última frase para evitar ítems fantasma
      const lastSentence = narrative?.trim()?.split(/[.!?]/)?.pop()?.trim() || '';
      console.log(`📝 Procesando solo la última frase: "${lastSentence}"`);
      
      // 🔧 VALIDACIÓN: Si no hay última frase, no procesar
      if (!lastSentence || lastSentence.length < 5) {
        console.log('❌ No hay última frase válida para procesar');
        return { foundItems: [], alreadyPickedItems: [] };
      }
      // 🔧 TRY/CATCH CHATGPT: Evitar crashes por regex errors
      try {
      
      const patterns = [
        // 🔍 PATRONES NON-GREEDY CON LOOK-AHEAD (CHATGPT SOLUTION)
        /encuentras?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /descubres?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /hallas?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /ves?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /hay\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /aparece\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /observas?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /localizas?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /notas?\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi,
        /(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])\s+(?:sobre|en|bajo|dentro de|junto a)/gi,
        /se encuentra\s+(?:un(?:a)?s?|el|la|los|las)\s+(.+?)(?=\s+(?:y|e|o)\s+(?:un(?:a)?s?|el|la|los|las)\s+|[,.!?])/gi
      ];
      
      // 🎁 PATRONES REFINADOS Y FLEXIBLES PARA AUTO-PICK (CHATGPT SOLUTION V2)
      const alreadyPickedPatterns = [
        // Admite infinitivo, primera persona o imperativo; artículo opcional; plural/singular
        /\b(?:agarra(?:r|s|mos)?|toma(?:r|s|mos)?|coge(?:r|s|mos)?|recoge(?:r|s|mos)?|guarda(?:r|s|mos)?|meta(?:r|s|mos)?)\s+(?:el|la|los|las|un|una|unos|unas)?\s*([^,.!?]+)/gi,
        // Expresiones de decisión directa más flexibles
        /\b(?:decido|decides|decidimos)\s+(?:que\s+)?(?:me|nos)?\s*(?:quedo|quedamos|quedare|quedaremos)\s+con\s+(?:el|la|los|las|un|una|unos|unas)?\s*([^,.!?]+)/gi,
        // Patrones de posesión actuales
        /\b(?:llevo|cargo|porto|tengo)\s+(?:el|la|los|las|un|una|unos|unas)?\s*([^,.!?]+)/gi
      ];
      
      let foundItems = [];
      let alreadyPickedItems = [];
      
      // 🔍 PROCESAR PATRONES DE ITEMS DISPONIBLES (para discovered items)
      patterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(lastSentence)) !== null) {
          // Extraer el nombre del item - SIMPLIFICADO (CHATGPT SOLUTION)
          let itemName = '';
          
          // Para los nuevos patrones non-greedy, el item está en la posición 1
          if (index < 10) {
            // 🔧 ARREGLO CHATGPT: Validar que match[1] existe antes de trim() (NUEVO REGEX)
            itemName = match[1] ? match[1].trim() : '';
          } else {
            // Para el último patrón es diferente
            // 🔧 ARREGLO CHATGPT: Validar que match[1] existe antes de trim()
            itemName = match[1] ? match[1].trim() : '';
          }
          
          // 🔧 FILTRO CHATGPT: Evitar items vacíos
          if (!itemName || itemName.length === 0) {
            console.log(`⚠️ Item vacío detectado, saltando...`);
            continue;
          }
          
          // Limpiar y validar el item
          itemName = itemName.replace(/[,\.!?;]$/, '').trim();
          
          // Filtrar palabras demasiado cortas o genéricas
          if (itemName.length > 3 && !["lugar", "sitio", "cosa", "algo", "esto", "habitación", "sala", "lugar", "ambiente", "aire", "sonido", "ruido", "sensación", "momento", "instante"].includes(itemName.toLowerCase()) && itemName.length < 30 && !itemName.includes("mientras") && !itemName.includes("que se") && !itemName.includes("de la")) {
            
            // 🎯 NUEVO: CONVERTIR TEXTO A ITEM REAL DE DATABASE
            const realItem = convertTextToRealItem(itemName);
            if (realItem) {
              foundItems.push(realItem);
              console.log(`🔍 Item disponible detectado: ${realItem.name} ${realItem.icon}`);
            } else {
              console.log(`❌ Item no reconocido: "${itemName}"`);
            }
          }
        }
      });
      
      // 🔍 PROCESAR PATRONES DE ITEMS YA RECOGIDOS (para autopick)
      alreadyPickedPatterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(lastSentence)) !== null) {
          // Extraer el nombre del item - SIMPLIFICADO (CHATGPT SOLUTION)
          let itemName2 = '';
          
          // Los nuevos patrones todos capturan en el primer grupo disponible
          for (let i = 1; i < match.length; i++) {
            if (match[i] && match[i].trim()) {
              itemName2 = match[i].trim();
              break;
            }
          }
          
          // Limpiar y validar el item - REFINADO SEGÚN CHATGPT
          const raw = itemName2.trim()
                              .split(/[,;.]/)[0]          // corta en coma/punto
                              .replace(/\s+(de|con|en|que|durante|mientras|porque|para)\s+.*/i,'') // corta en preposiciones
                              .trim();
          itemName2 = raw;
          
          // 🎯 NUEVA FUNCIÓN: SEPARAR ITEMS COMPUESTOS
          const individualItems = splitCompoundItems(itemName2);
          console.log(`🔍 Items compuestos separados: "${itemName2}" → [${individualItems.join(', ')}]`);
          
          individualItems.forEach(singleItemName => {
            // Filtrar palabras demasiado cortas o genéricas
            if (singleItemName.length > 3 && !["lugar", "sitio", "cosa", "algo", "esto", "habitación", "sala", "lugar", "ambiente", "aire", "sonido", "ruido", "sensación", "momento", "instante"].includes(singleItemName.toLowerCase()) && singleItemName.length < 30 && !singleItemName.includes("mientras") && !singleItemName.includes("que se") && !singleItemName.includes("de la")) {
              
              // 🎯 CONVERTIR TEXTO A ITEM REAL CON CANONICAL NAME (CHATGPT SOLUTION)
              const realItem = convertTextToRealItem(singleItemName);
              if (realItem) {
                // Usar canonical name para evitar duplicaciones
                const canonicalId = canonicalName(realItem.name);
                const itemWithCanonical = {
                  ...realItem,
                  canonicalId: canonicalId
                };
                alreadyPickedItems.push(itemWithCanonical);
                console.log(`🎁 Item ya recogido detectado: ${realItem.name} ${realItem.icon} (canonical: ${canonicalId})`);
                console.log(`[AUTO-PICK] añadido "${realItem.name}" al inventario para session ${gameState.sessionId}`); // AÑADIDO SEGÚN CHATGPT STEP 1.4
              } else {
                console.log(`❌ Item ya recogido no reconocido: "${singleItemName}"`);
              }
            }
          });
        }
      });
      
      // Eliminar duplicados para items disponibles
      const uniqueItems = foundItems.filter((item, index, self) => 
        index === self.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase())
      );
      
      // Eliminar duplicados para items ya recogidos
      const uniquePickedItems = alreadyPickedItems.filter((item, index, self) => 
        index === self.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase())
      );
      
      console.log(`📦 Items disponibles extraídos: ${uniqueItems.length > 0 ? uniqueItems.map(i => `${i.name} ${i.icon}`).join(', ') : 'ninguno'}`);
      console.log(`🎁 Items ya recogidos extraídos: ${uniquePickedItems.length > 0 ? uniquePickedItems.map(i => `${i.name} ${i.icon}`).join(', ') : 'ninguno'}`);
      
      return {
        availableItems: uniqueItems,
        alreadyPickedItems: uniquePickedItems
      };
      
      // 🔧 CATCH CHATGPT: Manejar errores de regex sin crashear
      } catch (error) {
        console.error(`❌ Error en extractItemsFromNarrative: ${error.message}`);
        console.error(`❌ Narrativa problemática: ${narrative.substring(0, 100)}...`);
        return {
          availableItems: [],
          alreadyPickedItems: []
        };
      }
    }
    
    // 🎯 NUEVA FUNCIÓN: CONVERTIR TEXTO DE NARRATIVA A ITEM REAL
    function convertTextToRealItem(itemText) {
      const textLower = itemText.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
        .replace(/[^a-z0-9áéíóúüñ\s]/g, ' ') // quita símbolos pero mantiene espacios
        .replace(/\b(el|la|los|las|un|una|unos|unas|del|de|y|junto|junto del|con)\b/g, ' ') // quita artículos y conectores
        .replace(/\s+/g, ' ') // normaliza espacios múltiples
        .trim();
      
      console.log(`🪄 Text→Item: "${itemText}" → normalizado: "${textLower}"`);
      
      // 🚫 FILTRO DE PORTABILIDAD: Items que NO se pueden llevar
      const nonPortableKeywords = [
        'mapa muy grande', 'mapa grande', 'mapa enorme', 'mapa gigante',
        'edificio', 'casa', 'puerta', 'ventana', 'pared', 'suelo', 'techo',
        'mesa grande', 'escritorio grande', 'armario', 'estantería',
        'árbol', 'roca grande', 'piedra grande', 'estatua grande',
        'fuente', 'pozo', 'columna', 'pilar', 'escalera', 'escalón'
      ];
      
      for (const nonPortable of nonPortableKeywords) {
        if (textLower.includes(nonPortable)) {
          console.log(`🚫 Item NO portable detectado: "${itemText}" (keyword: "${nonPortable}")`);
          return null; // No es portable
        }
      }
      
      // Evaluar tamaño por contexto
      if (textLower.includes('muy grande') || textLower.includes('enorme') || 
          textLower.includes('gigante') || textLower.includes('masivo')) {
        console.log(`🚫 Item demasiado grande: "${itemText}"`);
        return null;
      }
      
      // Buscar en ITEM_DATABASE por keywords - ANCLAS PALABRA COMPLETA (CHATGPT FIX)
      for (const dbItem of ITEM_DATABASE) {
        for (const keyword of dbItem.keywords) {
          const normalizedKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          // 🔧 CHATGPT FIX: Anclas de palabra completa \b + requiere artículo
          const wordBoundaryPattern = new RegExp(`\\b(?:un(?:a|o)?|el|la|los|las)\\s+${normalizedKeyword}\\b`, 'i');
          const simpleWordPattern = new RegExp(`\\b${normalizedKeyword}\\b`, 'i');
          
          if (wordBoundaryPattern.test(textLower) || simpleWordPattern.test(textLower)) {
            console.log(`✅ Match encontrado: "${itemText}" → ${dbItem.type} (keyword: "${keyword}") - WORD BOUNDARY`);
            
            const foundItem = {
              name: itemText, // Usar nombre original de la narrativa
              icon: dbItem.icon,
              type: dbItem.type,
              description: generateContextualDescription(itemText, dbItem.type),
              rarity: 'common',
              source: 'narrative_extraction',
              instanceId: crypto.randomUUID()
            };
            
            console.log(`🪄 Text→Item resultado: ${foundItem.name} → ${foundItem.type} ${foundItem.icon}`);
            return foundItem;
          }
        }
      }
      
      console.log(`🪄 Text→Item: "${itemText}" → NO ENCONTRADO`);
      return null; // No se encontró match
    }
    
    // 🎯 NUEVA FUNCIÓN: GENERAR DESCRIPCIONES CONTEXTUALES ÚTILES
    function generateContextualDescription(itemName, itemType) {
      const nameLower = itemName.toLowerCase();
      
      // Descripciones específicas por tipo de item
      if (itemType === 'revolver' || itemType === 'daga' || itemType === 'arco') {
        return `Un arma que podría ser útil para defenderte en situaciones peligrosas.`;
      }
      
      if (itemType === 'libro' || itemType === 'pergamino') {
        return `Podría contener información valiosa o conocimientos importantes.`;
      }
      
      if (itemType === 'diario') {
        return `Un registro personal que podría revelar secretos o información crucial.`;
      }
      
      if (itemType === 'frasco_cristal') {
        return `Un recipiente de cristal que podría contener algo valioso o misterioso.`;
      }
      
      if (itemType === 'llave') {
        return `Probablemente abre algo importante en esta área.`;
      }
      
      if (itemType === 'poción' || itemType === 'bebida') {
        return `Un líquido que podría tener efectos beneficiosos si lo consumes.`;
      }
      
      if (itemType === 'moneda' || itemType === 'gema') {
        return `Tiene valor monetario y podría ser útil para intercambios.`;
      }
      
      if (itemType === 'anillo' || itemType === 'collar') {
        return `Una pieza de joyería que podría tener valor o significado especial.`;
      }
      
      if (itemType === 'metal') {
        return `Material resistente que podría servir como herramienta o arma improvisada.`;
      }
      
      // Descripción genérica pero útil
      return `Un objeto que encontraste y que podría ser útil en tu aventura.`;
    }
    
    // 🔧 FUNCIÓN: GENERAR PREGUNTA NARRATIVA PARA ITEMS REALES
    function generateItemChoiceNarrative(items) {
      if (items.length === 0) return '';
      
      // Añadir items a discoveredItems para que aparezcan en la UI
      if (!gameState.discoveredItems) gameState.discoveredItems = [];
      
      items.forEach(item => {
        // Verificar anti-duplicados
        const existsInInventory = gameState.inventory.some(invItem => 
          invItem.name.toLowerCase() === item.name.toLowerCase()
        );
        const existsInDiscovered = gameState.discoveredItems.some(discItem => 
          discItem.name.toLowerCase() === item.name.toLowerCase()
        );
        
        if (!existsInInventory && !existsInDiscovered) {
          gameState.discoveredItems.push(item);
          console.log(`🎁 Item de narrativa añadido a discovered: ${item.name} ${item.icon}`);
        }
      });
      
      const phrases = [
        'Encuentras varios objetos interesantes.',
        'Descubres algunos items que podrían ser útiles.',
        'Hay varios objetos que llaman tu atención.',
        'Observas algunos items que podrían interesarte.',
        'Localizas varios objetos durante tu búsqueda.'
      ];
      
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      return ` ${randomPhrase}`;
    }
    
    // 🎁 PASO 0: EXTRAER TODOS LOS CANDIDATOS Y REORDENAR FLUJO (CHATGPT SOLUTION)
    console.log(`🔍 PASO 0: Extrayendo candidatos de narrativa y acción para procesamiento ordenado...`);
    
    // Analizar tanto la narrativa generada como la acción del usuario
    const fullText = `${action} ${narrative}`;
    console.log(`🔍 Texto completo para análisis: "${fullText}"`);
    
    const narrativeExtraction = extractItemsFromNarrative(fullText);
    const allCandidates = [
      ...(narrativeExtraction.availableItems || []),
      ...(narrativeExtraction.alreadyPickedItems || [])
    ];
    
    console.log(`📦 CANDIDATOS TOTALES EXTRAÍDOS: ${allCandidates.length} items`);
    
    // 🎯 PASO 0A: PROCESAR DISCOVERED ITEMS PRIMERO (CHATGPT SOLUTION - PRIORIDAD AL MODAL)
    const candidatesForDiscovered = narrativeExtraction.availableItems || [];
    if (candidatesForDiscovered.length > 0) {
      console.log(`🎁 DISCOVERED ITEMS DETECTADOS: ${candidatesForDiscovered.length} items para modal`);
      
      // Añadir a discoveredItems para que aparezcan en modal
      if (!gameState.discoveredItems) gameState.discoveredItems = [];
      
      candidatesForDiscovered.forEach(item => {
        const existsInInventory = gameState.inventory.some(invItem => 
          invItem.name.toLowerCase() === item.name.toLowerCase()
        );
        const existsInDiscovered = gameState.discoveredItems.some(discItem => 
          discItem.name.toLowerCase() === item.name.toLowerCase()
        );
        
        if (!existsInInventory && !existsInDiscovered) {
          gameState.discoveredItems.push(item);
          console.log(`🎁 Item añadido a discovered para modal: ${item.name} ${item.icon}`);
        }
      });
    }
    
    // 🎯 PASO 0B: PROCESAR AUTO-PICK DESPUÉS (CHATGPT SOLUTION - SECUNDARIO)
    const alreadyPickedItems = narrativeExtraction.alreadyPickedItems || [];
    if (alreadyPickedItems.length > 0) {
      console.log(`🤖 AUTO-PICK DETECTADO: ${alreadyPickedItems.length} items para inventario directo`);
      
      alreadyPickedItems.forEach(item => {
        // Verificar que no existe ya en inventario usando canonical name (CHATGPT SOLUTION)
        const canonicalId = item.canonicalId || canonicalName(item.name);
        const existsInInventory = gameState.inventory.some(invItem => {
          const invCanonicalId = invItem.canonicalId || canonicalName(invItem.name);
          return invCanonicalId === canonicalId;
        });
        
        if (!existsInInventory) {
          gameState.inventory.push(item);
          console.log(`🤖 AUTO-PICK: Item añadido al inventario: ${item.name} ${item.icon} (canonical: ${canonicalId})`);
        } else {
          console.log(`⚠️ AUTO-PICK: Item ya existe en inventario (canonical match): ${item.name} ≈ ${canonicalId}`);
        }
      });
      
      // 🎯 EMITIR INVENTORY UPDATE VIA WEBSOCKET (CHATGPT SOLUTION)
      const socketSessionId = gameState.sessionId;
      io.to(socketSessionId).emit('inventory_update', {
        inventory: gameState.inventory,
        discoveredItems: gameState.discoveredItems || []
      });
      console.log(`📡 AUTO-PICK: Inventory update emitted via WebSocket for ${alreadyPickedItems.length} items`);
    }
    
    // 🎲 SISTEMA HÍBRIDO DE LOOT INTELIGENTE (SOLO PARA BÚSQUEDAS)
    
    // Solo activar cuando el usuario busca/explora activamente
    if (/busco|buscar|examino|examinar|hurgo|hurgar|exploro|explorar|investigo|investigar|descubro|descubrir/.test(action.toLowerCase())) {
      console.log(`🎲 ACTIVANDO SISTEMA HÍBRIDO para acción: "${action}"`);
      
      // 🎯 NUEVO SISTEMA 100% GARANTIZADO - SIEMPRE GENERA ITEMS CONTEXTUALES
      console.log(`🎁 SISTEMA 100% GARANTIZADO: Siempre se generan items al buscar`);
      
      const location = gameState.location || '';
      const currentAction = action.toLowerCase();
      
      // 🔺 CALIDAD DE ITEMS BASADA EN CONTEXTO (no probabilidad)
      let itemQuality = 'common'; // Base
      
      if (location.toLowerCase().includes('tesoro') || location.toLowerCase().includes('cofre') || 
          location.toLowerCase().includes('biblioteca') || location.toLowerCase().includes('cueva') ||
          location.toLowerCase().includes('ruinas') || location.toLowerCase().includes('templo')) {
        itemQuality = 'rare'; // Items más valiosos en ubicaciones especiales
        console.log(`🏛️ Ubicación especial detectada, generando items de mejor calidad`);
      }
      
      if (currentAction.includes('minuciosamente') || currentAction.includes('cuidadosamente') || 
          currentAction.includes('detalladamente') || currentAction.includes('exhaustivamente')) {
        itemQuality = itemQuality === 'rare' ? 'epic' : 'rare'; // Mejorar calidad por búsqueda detallada
        console.log(`🔍 Búsqueda detallada detectada, mejorando calidad de items`);
      }
      
      // Reset contador de búsquedas vacías (ya no es necesario)
      gameState.consecutiveEmptySearches = 0;
      
      // Actualizar último descubrimiento
      gameState.lastDiscoveryAction = gameState.actionCount;
      
      console.log(`🎯 Calidad de items determinada: ${itemQuality}`);
      
      // 🎁 SIEMPRE GENERAR ITEMS (100% garantizado)
      const shouldGenerateItem = true; // Cambiado de probabilidad a 100%
      
      console.log(`🎰 Sistema garantizado: SIEMPRE ÉXITO - Generando items contextuales`);
      
      if (shouldGenerateItem) {
        // 🎁 GENERAR ITEM - LÓGICA ORIGINAL
        gameState.lastDiscoveryAction = gameState.actionCount;
        gameState.consecutiveEmptySearches = 0;
        console.log(`✅ ¡Descubrimiento exitoso! Reseteando contadores`);
      
        // PASO 1: Usar items disponibles ya extraídos de la narrativa
      const availableItems = narrativeExtraction.availableItems || [];
      if (availableItems.length > 0) {
        // CASO A: Hay items disponibles en la narrativa → Preguntar al jugador
        console.log(`📖 NARRATIVA CON ITEMS DISPONIBLES: Encontrados ${availableItems.length} items, extendiendo narrativa con decisión`);
        
        const itemChoiceText = generateItemChoiceNarrative(availableItems);
        narrative += itemChoiceText;
        
        console.log(`🎭 NARRATIVA EXTENDIDA: ${itemChoiceText}`);
        
      } else if (availableItems.length === 0) {
        // CASO B: No hay items disponibles → Generar loot dinámico + explicación
        console.log(`🎁 NARRATIVA SIN ITEMS DISPONIBLES: Generando loot dinámico con explicación`);
        
        const intelligentLoot = rollIntelligentLoot(gameState, action, narrative, itemQuality);
        
        if (intelligentLoot) {
          // 🚫 VERIFICAR ITEMS IGNORADOS PERMANENTEMENTE
          if (!gameState.ignoredItems) gameState.ignoredItems = [];
          const wasIgnored = gameState.ignoredItems.some(ignoredId => 
            ignoredId === intelligentLoot.instanceId || 
            gameState.ignoredItems.some(id => id.includes(intelligentLoot.name.toLowerCase()))
          );
          
          if (wasIgnored) {
            console.log(`🚫 Item previamente ignorado, no se añadirá: ${intelligentLoot.name}`);
            return; // No añadir item ignorado
          }
          
          // Verificar anti-duplicados
          const existsInInventory = gameState.inventory.some(item => 
            item.name.toLowerCase() === intelligentLoot.name.toLowerCase()
          );
          
          if (!gameState.discoveredItems) gameState.discoveredItems = [];
          const existsInDiscovered = gameState.discoveredItems.some(item => 
            item.name.toLowerCase() === intelligentLoot.name.toLowerCase()
          );
          
          if (!existsInInventory && !existsInDiscovered) {
            // Añadir a discoveredItems (clickeable)
            gameState.discoveredItems.push(intelligentLoot);
            console.log(`🎁 LOOT DINÁMICO GENERADO (clickeable): ${intelligentLoot.name} ${intelligentLoot.icon}`);
            
            // Extender narrativa con explicación orgánica
            const explanationPhrases = [
              `Mientras rebuscas con más atención, descubres ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `Al examinar más detenidamente, encuentras ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `Durante tu búsqueda, das con ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `Tras una inspección minuciosa, localizas ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `En un rincón poco visible, descubres ${intelligentLoot.name} ${intelligentLoot.icon}`
            ];
            
            const randomExplanation = explanationPhrases[Math.floor(Math.random() * explanationPhrases.length)];
            narrative += ` ${randomExplanation}.`;
            
            console.log(`📝 NARRATIVA EXTENDIDA: ${randomExplanation}`);
            console.log(`🎯 CONTEXTOS UTILIZADOS: ${intelligentLoot.contexts.join(', ')}`);
          } else {
            console.log(`⚠️ LOOT YA EXISTE: ${intelligentLoot.name}`);
          }
        }
      }
    } // ← CERRAR BLOQUE DEL SISTEMA DE PROBABILIDAD
    } else {
      console.log(`🎲 Sistema híbrido no activado para: "${action}"`);
    }
    
    // 🎲 PASO FINAL: SISTEMA DE EVENTOS ALEATORIOS D20
    let randomEventResult = null;
    
    // Verificar si debe activarse un evento aleatorio
    if (shouldTriggerRandomEvent(gameState, action)) {
      console.log(`🎲 ACTIVANDO SISTEMA DE EVENTOS ALEATORIOS`);
      
      const context = analyzeGameContextForEvents(gameState, action, narrative);
      const availableEvents = filterEventsForContext(context);
      
      if (availableEvents.length > 0) {
        const selectedEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
        randomEventResult = rollD20AndApplyConsequences(selectedEvent, gameState);
        
        // Extender narrativa con el evento
        narrative += `\n\n🎲 **${selectedEvent.title}**: ${selectedEvent.description}\n\n*[Lanzas un D20... Resultado: ${randomEventResult.roll}]*\n\n${randomEventResult.narrative}`;
        
        console.log(`🎲 EVENTO EJECUTADO: ${selectedEvent.title} (${randomEventResult.success ? 'ÉXITO' : 'FRACASO'})`);
      }
    }
    
    res.json({
      success: true,
      narrative: narrative,
      suggested_actions: suggestedActions,
      game_state: gameState.toDict(),
      state_changes: stateChanges,
      random_event: randomEventResult // Para el frontend
    });
    
  } catch (error) {
    console.error('Error processing action:', error);
    res.status(500).json({ error: error.message });
  }
});



// WebSocket events
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.emit('connected', { data: 'Conectado al servidor Hellbound RPG' });
  
  socket.on('join_session', (data) => {
    const sessionId = data.session_id;
    if (sessionId) {
      socket.join(sessionId);
      socket.emit('joined_session', { session_id: sessionId });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

/* eslint-disable */
// 🚫 ENDPOINT: IGNORAR ITEM PERSISTENTEMENTE
app.post('/api/ignore_item', async (req, res) => {
  try {
    const { session_id, item_id } = req.body;
    
    if (!session_id || !gameSessions.has(session_id)) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    if (!item_id) {
      return res.status(400).json({ error: 'No item_id provided' });
    }
    
    const gameState = gameSessions.get(session_id);
    
    // Inicializar array de items ignorados si no existe
    if (!gameState.ignoredItems) {
      gameState.ignoredItems = [];
    }
    
    // Añadir item a lista de ignorados (si no está ya)
    if (!gameState.ignoredItems.includes(item_id)) {
      gameState.ignoredItems.push(item_id);
      console.log(`🚫 Item ignorado permanentemente: ${item_id}`);
    }
    
    // Remover de discoveredItems si está presente
    if (gameState.discoveredItems) {
      gameState.discoveredItems = gameState.discoveredItems.filter(
        item => item.instanceId !== item_id
      );
    }
    
    // Save to MongoDB
    if (db) {
      await db.collection('sessions').replaceOne(
        { sessionId: session_id },
        gameState.toDict()
      );
    }
    
    res.json({ 
      success: true, 
      message: 'Item ignored permanently',
      game_state: gameState.toDict()
    });
    
  } catch (error) {
    console.error('Error ignoring item:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🚫 ENDPOINT: IGNORAR ITEM PERSISTENTEMENTE
app.post('/api/ignore_item', async (req, res) => {
  try {
    const { session_id, item_id } = req.body;
    
    if (!session_id || !gameSessions.has(session_id)) {
      return res.status(400).json({ error: 'Invalid session' });
    }
    
    if (!item_id) {
      return res.status(400).json({ error: 'No item_id provided' });
    }
    
    const gameState = gameSessions.get(session_id);
    
    // Inicializar array de items ignorados si no existe
    if (!gameState.ignoredItems) {
      gameState.ignoredItems = [];
    }
    
    // Añadir item a lista de ignorados (si no está ya)
    if (!gameState.ignoredItems.includes(item_id)) {
      gameState.ignoredItems.push(item_id);
      console.log(`🚫 Item ignorado permanentemente: ${item_id}`);
    }
    
    // Remover de discoveredItems si está presente
    if (gameState.discoveredItems) {
      gameState.discoveredItems = gameState.discoveredItems.filter(
        item => item.instanceId !== item_id
      );
    }
    
    // Save to MongoDB
    if (db) {
      await db.collection('sessions').replaceOne(
        { sessionId: session_id },
        gameState.toDict()
      );
    }
    
    res.json({ 
      success: true, 
      message: 'Item ignored permanently',
      game_state: gameState.toDict()
    });
    
  } catch (error) {
    console.error('Error ignoring item:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🎁 ENDPOINT: Recoger item descubierto
app.post('/api/pickup_item', async (req, res) => {
  try {
    const { session_id, item_id } = req.body;
    
    if (!session_id || !item_id) {
      return res.status(400).json({ error: 'session_id and item_id are required' });
    }
    
    const gameState = gameSessions.get(session_id);
    if (!gameState) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Buscar el item en discoveredItems
    if (!gameState.discoveredItems) gameState.discoveredItems = [];
    const itemIndex = gameState.discoveredItems.findIndex(item => item.instanceId === item_id);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in discovered items' });
    }
    
    const item = gameState.discoveredItems[itemIndex];
    
    // Verificar que no existe ya en inventario
    const existsInInventory = gameState.inventory.some(invItem => 
      invItem.name.toLowerCase() === item.name.toLowerCase()
    );
    
    if (existsInInventory) {
      return res.status(400).json({ error: 'Item already in inventory' });
    }
    
    // Mover el item de discoveredItems a inventory
    gameState.discoveredItems.splice(itemIndex, 1);
    gameState.inventory.push(item);
    
    console.log(`🎁 ITEM RECOGIDO: ${item.name} ${item.icon} por session ${session_id}`);
    
    // Emitir actualización via WebSocket
    io.to(session_id).emit('game_update', {
      session_id: session_id,
      game_state: gameState.toDict(),
      item_picked_up: item,
      message: `Has recogido ${item.name} ${item.icon}`
    });
    
    res.json({
      success: true,
      message: `Has recogido ${item.name} ${item.icon}`,
      item: item,
      game_state: gameState.toDict()
    });
    
  } catch (error) {
    console.error('Error picking up item:', error);
    res.status(500).json({ error: error.message });
  }
});
/* eslint-enable */

// Start server
const PORT = process.env.PORT || 8001;

async function startServer() {
  await initDatabase();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 Hellbound RPG Backend running on port ${PORT}`);
    console.log(`📊 Game configuration loaded:`);
    console.log(`   - Lore: ${Object.keys(LORE).length} entries`);
    console.log(`   - Functions: ${FUNCTIONS.length || 0} functions`);
    console.log(`   - Lexicon: ${Object.keys(LEXICON).length} words`);
  });
}

startServer().catch(console.error);