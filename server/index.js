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
  
  // 🛡️ DEFENSAS
  { type: 'escudo', icon: '🛡️', keywords: ['escudo', 'shield', 'broquel', 'rodela', 'buckler'] },
  { type: 'armadura', icon: '🦺', keywords: ['armadura', 'armor', 'coraza', 'cota', 'peto', 'mail'] },
  
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
  { type: 'varita', icon: '🪄', keywords: ['varita', 'vara', 'bastón', 'cetro', 'wand', 'staff'] },
  
  // 💎 TESOROS
  { type: 'gema', icon: '💎', keywords: ['gema', 'diamante', 'rubí', 'esmeralda', 'zafiro', 'cristal', 'piedra'] },
  { type: 'moneda', icon: '🪙', keywords: ['moneda', 'oro', 'plata', 'coin', 'dinero', 'tesoro'] },
  
  // 📚 CONOCIMIENTO
  { type: 'libro', icon: '📖', keywords: ['libro', 'grimorio', 'tomo', 'manuscrito', 'volumen', 'text'] },
  { type: 'pergamino', icon: '📜', keywords: ['pergamino', 'scroll', 'mapa', 'carta', 'plano', 'documento'] },
  
  // 🏆 OBJETOS ESPECIALES
  { type: 'trofeo', icon: '🏆', keywords: ['trofeo', 'trophy', 'premio', 'medalla', 'copa', 'galardón'] },
  { type: 'reliquia', icon: '⚗️', keywords: ['reliquia', 'relic', 'artefacto', 'artifact', 'objeto sagrado', 'antigüedad'] },
  { type: 'cuerpo', icon: '💀', keywords: ['cabeza', 'cráneo', 'hueso', 'esqueleto', 'calavera', 'skull', 'bone', 'head'] },
  { type: 'material', icon: '🌿', keywords: ['rama', 'madera', 'hierba', 'planta', 'root', 'leaf', 'wood', 'branch'] }
];

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware - CORS LIBERAL PARA DEBUGGING
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB setup
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/';
const client = new MongoClient(MONGO_URL);
let db;

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🎮 GAME CONFIGURATION LOADER
function loadJsonFile(filename) {
  try {
    const data = readFileSync(`/app/${filename}`, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`Could not load ${filename}:`, error.message);
    return {};
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
    this.discoveredItems = []; // 🎁 SISTEMA DE LOOT DESCUBIERTO
    this.ignoredItems = []; // 🚫 ITEMS IGNORADOS PERMANENTEMENTE
    this.narrativeLog = [];
    this.mode = 'sandbox'; // Solo sandbox mode disponible
    
    // 🆕 CHAPTER SYSTEM (solo se usa cuando hay chapter JSON disponible)
    this.chapterData = null;
    this.currentScene = null;
    
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
      discoveredItems: this.discoveredItems || [], // 🎁 LOOT DESCUBIERTO
      ignoredItems: this.ignoredItems || [], // 🚫 ITEMS IGNORADOS
      narrativeLog: this.narrativeLog,
      mode: this.mode,
      campaignMeta: this.campaignMeta,
      map: this.map,
      
      // 🆕 CHAPTER SYSTEM (solo incluir si existe)
      chapterData: this.chapterData || null,
      currentScene: this.currentScene || null,
      
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

  // 🆕 MÉTODOS DE PERSISTENCIA DE SESIONES (no afecta funcionamiento existente)
  
  // Serializar GameState completo a JSON para persistencia
  serialize() {
    return JSON.stringify(this.toDict());
  }
  
  // Crear GameState desde datos serializados
  static deserialize(jsonData, sessionId) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      const gameState = new GameState(sessionId || data.sessionId);
      
      // Restaurar todos los campos del estado
      gameState.playerId = data.playerId || gameState.playerId;
      gameState.vitals = data.vitals || gameState.vitals;
      gameState.resources = data.resources || gameState.resources;
      gameState.attributes = data.attributes || gameState.attributes;
      gameState.emotionalStates = data.emotionalStates || gameState.emotionalStates;
      gameState.skills = data.skills || gameState.skills;
      gameState.location = data.location || gameState.location;
      gameState.inventory = data.inventory || gameState.inventory;
      gameState.discoveredItems = data.discoveredItems || [];
      gameState.ignoredItems = data.ignoredItems || [];
      gameState.narrativeLog = data.narrativeLog || [];
      gameState.mode = data.mode || gameState.mode;
      gameState.campaignMeta = data.campaignMeta || null;
      gameState.map = data.map || null;
      gameState.chapterData = data.chapterData || null;
      gameState.currentScene = data.currentScene || null;
      gameState.toneBias = data.toneBias || 0;
      gameState.usedPhrases = data.usedPhrases || [];
      gameState.questStage = data.questStage || 'I';
      gameState.divergenceScore = data.divergenceScore || 0;
      gameState.memoryRaw = data.memoryRaw || [];
      gameState.memorySummary = data.memorySummary || '';
      gameState.sessionSummaries = data.sessionSummaries || [];
      gameState.actionCount = data.actionCount || 0;
      gameState.storyAct = data.storyAct || 1;
      gameState.actProgress = data.actProgress || 0;
      gameState.majorDecisions = data.majorDecisions || [];
      gameState.questObjectives = data.questObjectives || [];
      gameState.sandboxConcept = data.sandboxConcept || null;
      gameState.isAlive = data.isAlive !== undefined ? data.isAlive : true;
      gameState.deathReason = data.deathReason || null;
      gameState.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
      
      // Restaurar Maps desde objetos serializados
      gameState.temporalEffects = new Map(Object.entries(data.temporalEffects || {}));
      gameState.relationships = new Map(Object.entries(data.relationships || {}));
      gameState.knowledge = new Map(Object.entries(data.knowledge || {}));
      gameState.reputation = new Map(Object.entries(data.reputation || {}));
      gameState.companionStatus = new Map(Object.entries(data.companionStatus || {}));
      
      // Restaurar Sets desde arrays
      gameState.eventFlags = new Set(data.eventFlags || []);
      gameState.storyFlags = new Set(data.storyFlags || []);
      
      console.log(`🔄 GameState deserializado exitosamente: ${gameState.sessionId}`);
      return gameState;
      
    } catch (error) {
      console.error('❌ Error deserializando GameState:', error);
      throw new Error('No se pudo cargar la sesión guardada');
    }
  }
  
  // Auto-guardar sesión con debouncing
  async autoSave(delay = 3000) {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    
    this._saveTimeout = setTimeout(async () => {
      try {
        if (db && this.sessionCode) {
          const sessionData = {
            sessionCode: this.sessionCode,
            gameState: this.toDict(),
            metadata: {
              lastPlayed: new Date(),
              gameMode: this.mode,
              title: this._generateSessionTitle(),
              playerCount: 1
            },
            players: [{
              playerID: this.playerId,
              isHost: true
            }]
          };
          
          await db.collection('saved_sessions').updateOne(
            { sessionCode: this.sessionCode },
            { $set: sessionData },
            { upsert: true }
          );
          
          console.log(`💾 Sesión auto-guardada: ${this.sessionCode}`);
        }
      } catch (error) {
        console.error('❌ Error en auto-guardado:', error);
      }
    }, delay);
  }
  
  // Generar título descriptivo para la sesión
  _generateSessionTitle() {
    const concept = this.sandboxConcept ? 
      this.sandboxConcept.substring(0, 30) + '...' : 
      this.campaignMeta?.titulo || 'Aventura';
    
    const location = this.location !== 'Punto de Inicio' ? 
      ` en ${this.location}` : '';
    
    return `${concept}${location}`;
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

// Generate session code
function generateSessionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RPG-';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Check if session code exists
async function sessionCodeExists(code) {
  if (!db) return false;
  const existing = await db.collection('saved_sessions').findOne({ sessionCode: code });
  return !!existing;
}

// Generate unique session code
async function generateUniqueSessionCode() {
  let code;
  let attempts = 0;
  do {
    code = generateSessionCode();
    attempts++;
  } while (await sessionCodeExists(code) && attempts < 10);
  
  if (attempts >= 10) {
    throw new Error('No se pudo generar código único de sesión');
  }
  
  return code;
}

// 🆕 NUEVOS ENDPOINTS PARA PERSISTENCIA (no afectan endpoints existentes)

// Guardar sesión manualmente
app.post('/api/save_session', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id || !gameSessions.has(session_id)) {
      return res.status(400).json({ error: 'Sesión no válida' });
    }
    
    const gameState = gameSessions.get(session_id);
    
    // Generar código de sesión si no existe
    if (!gameState.sessionCode) {
      gameState.sessionCode = await generateUniqueSessionCode();
    }
    
    const sessionData = {
      sessionCode: gameState.sessionCode,
      gameState: gameState.toDict(),
      metadata: {
        created: gameState.createdAt || new Date(),
        lastPlayed: new Date(),
        gameMode: gameState.mode,
        title: gameState._generateSessionTitle(),
        playerCount: 1
      },
      players: [{
        playerID: gameState.playerId,
        isHost: true
      }]
    };
    
    if (db) {
      await db.collection('saved_sessions').updateOne(
        { sessionCode: gameState.sessionCode },
        { $set: sessionData },
        { upsert: true }
      );
    }
    
    res.json({
      success: true,
      sessionCode: gameState.sessionCode,
      title: sessionData.metadata.title,
      message: 'Sesión guardada exitosamente'
    });
    
  } catch (error) {
    console.error('Error guardando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cargar sesión por código
app.post('/api/load_session', async (req, res) => {
  try {
    const { sessionCode } = req.body;
    
    if (!sessionCode || !sessionCode.trim()) {
      return res.status(400).json({ error: 'Código de sesión requerido' });
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Base de datos no disponible' });
    }
    
    // Buscar sesión guardada
    const savedSession = await db.collection('saved_sessions').findOne({ 
      sessionCode: sessionCode.trim().toUpperCase() 
    });
    
    if (!savedSession) {
      return res.status(404).json({ error: 'Código de sesión no encontrado' });
    }
    
    // Crear nuevo ID de sesión para esta carga
    const newSessionId = crypto.randomUUID();
    
    // Restaurar GameState
    const gameState = GameState.deserialize(savedSession.gameState, newSessionId);
    gameState.sessionCode = savedSession.sessionCode; // Mantener código original
    
    // Registrar en memoria
    gameSessions.set(newSessionId, gameState);
    
    // Actualizar última vez jugado
    await db.collection('saved_sessions').updateOne(
      { sessionCode: savedSession.sessionCode },
      { $set: { 'metadata.lastPlayed': new Date() }}
    );
    
    // Obtener narrativa más reciente
    const lastNarrative = gameState.narrativeLog.length > 0 ? 
      gameState.narrativeLog[gameState.narrativeLog.length - 1].narrative :
      'Tu aventura continúa desde donde la dejaste...';
    
    // Generar acciones sugeridas para la situación actual
    const suggestedActions = await generateSuggestedActions(gameState, lastNarrative, openai);
    
    res.json({
      success: true,
      session_id: newSessionId,
      game_state: gameState.toDict(),
      current_narrative: lastNarrative,
      suggested_actions: suggestedActions,
      sessionCode: savedSession.sessionCode,
      title: savedSession.metadata.title,
      lastPlayed: savedSession.metadata.lastPlayed
    });
    
  } catch (error) {
    console.error('Error cargando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar sesiones guardadas (máximo 5 por dispositivo)
app.get('/api/list_sessions', async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    if (!db) {
      return res.status(500).json({ error: 'Base de datos no disponible' });
    }
    
    // Por ahora listar todas las sesiones (futuro: filtrar por deviceId)
    const sessions = await db.collection('saved_sessions')
      .find({})
      .sort({ 'metadata.lastPlayed': -1 })
      .limit(20)
      .toArray();
    
    const sessionsList = sessions.map(session => ({
      sessionCode: session.sessionCode,
      title: session.metadata.title,
      gameMode: session.metadata.gameMode,
      lastPlayed: session.metadata.lastPlayed,
      created: session.metadata.created,
      playerCount: session.metadata.playerCount,
      location: session.gameState.location,
      health: session.gameState.vitals?.health || session.gameState.health || 100
    }));
    
    res.json({
      success: true,
      sessions: sessionsList,
      total: sessionsList.length
    });
    
  } catch (error) {
    console.error('Error listando sesiones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar sesión
app.delete('/api/delete_session', async (req, res) => {
  try {
    const { sessionCode } = req.body;
    
    if (!sessionCode || !sessionCode.trim()) {
      return res.status(400).json({ error: 'Código de sesión requerido' });
    }
    
    if (!db) {
      return res.status(500).json({ error: 'Base de datos no disponible' });
    }
    
    const result = await db.collection('saved_sessions').deleteOne({ 
      sessionCode: sessionCode.trim().toUpperCase() 
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    
    res.json({
      success: true,
      message: 'Sesión eliminada exitosamente'
    });
    
  } catch (error) {
    console.error('Error eliminando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

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

      const conceptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: conceptPrompt }],
        temperature: 0.8,
        max_tokens: 200
      });

      initialNarrative = conceptResponse.choices[0].message.content || 
        `Tu historia comienza con una idea fascinante: ${sandboxConcept}. Te encuentras en el punto de partida de esta aventura, con el mundo ante ti esperando a ser moldeado por tus decisiones. ¿Cómo quieres que comience tu historia?`;
        
    } else if (mode === 'campaign') {
      // Handle campaign mode with full loading
      const camp = loadFullCampaign(campaign || 'scenes_act1');
      if (!camp) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }
      
      // Set campaign data in game state
      gameState.campaignMeta = camp.json;
      gameState.map = camp.map;
      
      // 🆕 USAR CHAPTER SYSTEM si está disponible (tu JSON)
      if (camp.chapterData) {
        gameState.chapterData = camp.chapterData;
        gameState.currentScene = camp.chapterData.scenes[0].id;
        console.log(`🔖 Using chapter system: ${camp.chapterData.title}`);
      }
      
      // 📖 INICIALIZAR GESTOR DE HISTORIA AVANZADO
      gameState.initializeCampaignObjectives();
      
      // Create immersive intro
      const bookTitle = "Hellbound: El infierno en la tierra";
      const campaignTitle = camp.json.titulo || "Aventura Épica";
      
      if (camp.chapterData && camp.chapterData.scenes) {
        // 🆕 PRIORIDAD: USAR NARRATIVA DE TU CHAPTER JSON
        const firstScene = camp.chapterData.scenes[0];
        initialNarrative = `📖 **${camp.chapterData.title}**

${camp.chapterData.description}

---

**${firstScene.title}**

${firstScene.narrative}`;
        console.log(`🎭 Using rich narrative from chapter: ${firstScene.title}`);
      } else if (camp.firstText && camp.firstText.includes("La nieve cae sobre Alicante")) {
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
      
      // 🎯 REGEX CONTEXTUAL SIMPLE Y EFECTIVO
      const contextualPattern = /\b(?:agarro|agarré|recojo|recogí|tomo|tomé|encuentro|encontré|consigo|conseguí|robo|robé|robaba|cogí|coger)\s+(?:un[ae]?|el|la|los|las)?\s*(.+)/gi;
      
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
      return allKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
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
    const dropRegex = /\b(?:suelto|soltar|dejo|tiro|abandono|desecho|boto)\b\s+(?:un[ae]?|la?|el)?\s*(.+?)(?:\s+(?:del?|de la?)\s.+|$)/i;
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
    
    // 🎁 SISTEMA DE LOOT DINÁMICO - Detectar acciones de búsqueda (MOVIDO DESPUÉS DE DROP)
    const actionLowerForLoot = action.toLowerCase();
    if (/busco|buscar|examino|examinar|hurgo|hurgar|exploro|explorar|investigo|investigar|descubro|descubrir|rebusco|reviso|miro|observo|inspecciono|registro/.test(actionLowerForLoot)) {
      console.log(`🎁 ACTIVANDO SISTEMA DE LOOT para acción: "${action}"`);
      
      // Generar loot inteligente
      const intelligentLoot = rollIntelligentLoot(gameState, action, narrative);
      
      if (intelligentLoot) {
        // Verificar que no existe ya en inventario
        const existsInInventory = gameState.inventory.some(item => 
          item.name.toLowerCase() === intelligentLoot.name.toLowerCase()
        );
        
        // Verificar que no existe ya en discoveredItems
        if (!gameState.discoveredItems) gameState.discoveredItems = [];
        const existsInDiscovered = gameState.discoveredItems.some(item => 
          item.name.toLowerCase() === intelligentLoot.name.toLowerCase()
        );
        
        // Verificar que no fue ignorado anteriormente
        if (!gameState.ignoredItems) gameState.ignoredItems = [];
        const wasIgnored = gameState.ignoredItems.some(ignoredId => 
          ignoredId === intelligentLoot.instanceId || 
          gameState.ignoredItems.some(id => id.includes(intelligentLoot.name.toLowerCase()))
        );
        
        if (!existsInInventory && !existsInDiscovered && !wasIgnored) {
          gameState.discoveredItems.push(intelligentLoot);
          console.log(`🎁 ITEM DESCUBIERTO (clickeable): ${intelligentLoot.name} ${intelligentLoot.icon}`);
          
          // Añadir a la narrativa que se descubrió algo
          narrative += ` Descubres ${intelligentLoot.name} ${intelligentLoot.icon} en el lugar.`;
        } else {
          console.log(`🔄 Item ya existe o fue ignorado: ${intelligentLoot.name}`);
        }
      } else {
        console.log(`🎁 No se generó loot para esta búsqueda`);
      }
    } else {
      console.log(`🎁 Sistema de loot no activado para: "${action}"`);
    }
    
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
    
    // 🆕 AUTO-GUARDADO NO INVASIVO (solo si hay sessionCode)
    if (gameState.sessionCode) {
      gameState.autoSave().catch(error => {
        console.error('⚠️ Error en auto-guardado:', error);
        // No afecta la respuesta principal
      });
    }
    
    res.json({
      success: true,
      narrative: narrative,
      suggested_actions: suggestedActions,
      game_state: gameState.toDict(),
      state_changes: stateChanges
    });
    
  } catch (error) {
    console.error('Error processing action:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🎁 ENDPOINT PARA RECOGER ITEMS DESCUBIERTOS
app.post('/api/pickup_item', async (req, res) => {
  try {
    const { session_id, item_instance_id } = req.body;
    
    if (!session_id || !gameSessions.has(session_id)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!item_instance_id) {
      return res.status(400).json({ error: 'item_instance_id required' });
    }
    
    const gameState = gameSessions.get(session_id);
    
    // Buscar item en discoveredItems
    if (!gameState.discoveredItems) gameState.discoveredItems = [];
    const itemIndex = gameState.discoveredItems.findIndex(item => item.instanceId === item_instance_id);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in discovered items' });
    }
    
    // Remover de discoveredItems y añadir a inventory
    const pickedItem = gameState.discoveredItems.splice(itemIndex, 1)[0];
    gameState.inventory.push(pickedItem);
    
    console.log(`✅ ITEM RECOGIDO: ${pickedItem.name} ${pickedItem.icon}`);
    
    // Emit real-time update
    io.to(session_id).emit('inventory_update', {
      session_id: session_id,
      game_state: gameState.toDict()
    });
    
    // Update in MongoDB
    if (db) {
      await db.collection('sessions').updateOne(
        { sessionId: session_id },
        { $set: gameState.toDict() }
      );
    }
    
    // 🆕 AUTO-GUARDADO NO INVASIVO (solo si hay sessionCode)
    if (gameState.sessionCode) {
      gameState.autoSave().catch(error => {
        console.error('⚠️ Error en auto-guardado pickup:', error);
      });
    }
    
    res.json({
      success: true,
      message: `Has recogido ${pickedItem.name}`,
      item: pickedItem,
      game_state: gameState.toDict()
    });
    
  } catch (error) {
    console.error('Error picking up item:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🚫 ENDPOINT PARA IGNORAR ITEMS DESCUBIERTOS 
app.post('/api/ignore_item', async (req, res) => {
  try {
    const { session_id, item_instance_id } = req.body;
    
    if (!session_id || !gameSessions.has(session_id)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!item_instance_id) {
      return res.status(400).json({ error: 'item_instance_id required' });
    }
    
    const gameState = gameSessions.get(session_id);
    
    // Buscar item en discoveredItems
    if (!gameState.discoveredItems) gameState.discoveredItems = [];
    const itemIndex = gameState.discoveredItems.findIndex(item => item.instanceId === item_instance_id);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in discovered items' });
    }
    
    // Remover de discoveredItems y añadir a ignoredItems
    const ignoredItem = gameState.discoveredItems.splice(itemIndex, 1)[0];
    if (!gameState.ignoredItems) gameState.ignoredItems = [];
    gameState.ignoredItems.push(ignoredItem.instanceId);
    
    console.log(`🚫 ITEM IGNORADO: ${ignoredItem.name} ${ignoredItem.icon}`);
    
    // Emit real-time update
    io.to(session_id).emit('inventory_update', {
      session_id: session_id,
      game_state: gameState.toDict()
    });
    
    // Update in MongoDB
    if (db) {
      await db.collection('sessions').updateOne(
        { sessionId: session_id },
        { $set: gameState.toDict() }
      );
    }
    
    // 🆕 AUTO-GUARDADO NO INVASIVO (solo si hay sessionCode)
    if (gameState.sessionCode) {
      gameState.autoSave().catch(error => {
        console.error('⚠️ Error en auto-guardado ignore:', error);
      });
    }
    
    res.json({
      success: true,
      message: `Has ignorado ${ignoredItem.name}`,
      item: ignoredItem,
      game_state: gameState.toDict()
    });
    
  } catch (error) {
    console.error('Error ignoring item:', error);
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

// 🎯 INTELLIGENT LOOT SYSTEM - Sistema de loot dinámico contextual
const INTELLIGENT_LOOT = {
  mystical: [
    { name: 'amuleto protector', icon: '🧿', weight: 30 },
    { name: 'cristal energético', icon: '🔮', weight: 25 },
    { name: 'pergamino sagrado', icon: '📜', weight: 20 },
    { name: 'reliquia antigua', icon: '⚗️', weight: 15 }
  ],
  knowledge: [
    { name: 'libro antiguo', icon: '📖', weight: 35 },
    { name: 'documento secreto', icon: '📋', weight: 30 },
    { name: 'mapa detallado', icon: '🗺️', weight: 25 },
    { name: 'diario personal', icon: '📓', weight: 20 }
  ],
  combat: [
    { name: 'daga afilada', icon: '🗡️', weight: 35 },
    { name: 'pistola antigua', icon: '🔫', weight: 30 },
    { name: 'armadura ligera', icon: '🦺', weight: 25 },
    { name: 'escudo pequeño', icon: '🛡️', weight: 20 }
  ],
  exploration: [
    { name: 'linterna robusta', icon: '🔦', weight: 35 },
    { name: 'cuerda resistente', icon: '🪢', weight: 30 },
    { name: 'herramientas básicas', icon: '🔧', weight: 25 },
    { name: 'brújula precisa', icon: '🧭', weight: 20 }
  ],
  urban: [
    { name: 'llave maestra', icon: '🗝️', weight: 35 },
    { name: 'moneda de oro', icon: '🪙', weight: 30 },
    { name: 'documento oficial', icon: '📜', weight: 25 },
    { name: 'gema preciosa', icon: '💎', weight: 20 }
  ]
};

function detectNarrativeContext(narrative, action) {
  console.log(`🔍 Detectando contexto narrativo...`);
  
  const text = (narrative + ' ' + action).toLowerCase();
  const contexts = [];
  
  // Detección de contextos
  if (/magia|místico|espiritual|sagrado|demonio|exorcismo|bruja|hechizo/.test(text)) {
    contexts.push('mystical');
  }
  
  if (/libro|leer|estudiar|investigar|documento|archivo|biblioteca/.test(text)) {
    contexts.push('knowledge');
  }
  
  if (/lucha|combate|pelea|atacar|defender|arma|enemigo/.test(text)) {
    contexts.push('combat');
  }
  
  if (/explorar|aventura|buscar|examinar|descubrir|hurgar/.test(text)) {
    contexts.push('exploration');
  }
  
  if (/ciudad|urbano|edificio|calle|oficina|tienda/.test(text)) {
    contexts.push('urban');
  }
  
  console.log(`🎯 Contextos detectados: ${contexts.join(', ')}`);
  return contexts.length > 0 ? contexts : ['exploration'];
}

function analyzeSandboxConcept(concept) {
  console.log(`🎯 Analizando concepto sandbox: "${concept}"`);
  
  const conceptLower = concept.toLowerCase();
  const themes = [];
  
  if (/detective|investigar|misterio|caso|policial/.test(conceptLower)) {
    themes.push('exploration', 'urban');
  }
  
  if (/paranormal|sobrenatural|fantasma|demonio|exorcista/.test(conceptLower)) {
    themes.push('mystical', 'knowledge');
  }
  
  if (/guerra|soldado|militar|combate|batalla/.test(conceptLower)) {
    themes.push('combat', 'exploration');
  }
  
  if (/aventurero|explorador|tesoro|ruinas/.test(conceptLower)) {
    themes.push('exploration', 'mystical');
  }
  
  console.log(`🎯 Temas del sandbox: ${themes.join(', ')}`);
  return themes.length > 0 ? themes : ['exploration'];
}

function rollIntelligentLoot(gameState, action, narrative) {
  console.log(`🎯 Generando loot inteligente...`);
  
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
  
  // Generar item
  const lootTable = INTELLIGENT_LOOT[selectedCategory] || INTELLIGENT_LOOT.exploration;
  const totalWeight = lootTable.reduce((sum, item) => sum + item.weight, 0);
  let randomWeight = Math.random() * totalWeight;
  
  let selectedItem = null;
  for (const item of lootTable) {
    if (randomWeight < item.weight) {
      selectedItem = item;
      break;
    }
    randomWeight -= item.weight;
  }
  
  if (!selectedItem) selectedItem = lootTable[0];
  
  const finalItem = {
    name: selectedItem.name,
    icon: selectedItem.icon,
    type: selectedCategory,
    description: `${selectedItem.name} encontrado durante la exploración`,
    rarity: 'common',
    source: 'dynamic_intelligent',
    contexts: allContexts,
    instanceId: crypto.randomUUID()
  };
  
  console.log(`🎁 LOOT GENERADO: ${finalItem.name} ${finalItem.icon} (${selectedCategory})`);
  return finalItem;
}

startServer().catch(console.error);