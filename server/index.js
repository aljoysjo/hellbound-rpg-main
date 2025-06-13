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

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://f9c456b2-5118-4176-bb10-69ae2c6a13d5.preview.emergentagent.com', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ['https://f9c456b2-5118-4176-bb10-69ae2c6a13d5.preview.emergentagent.com', '*'],
  credentials: true
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
    
    // Añadir nueva habilidad
    if (stateChanges.newSkill) {
      const existingSkill = this.skills.find(s => s.id === stateChanges.newSkill.id);
      if (!existingSkill) {
        this.skills.push(stateChanges.newSkill);
        console.log(`⭐ Nueva habilidad: ${stateChanges.newSkill.id} (Nivel ${stateChanges.newSkill.level})`);
      } else {
        existingSkill.level = Math.max(existingSkill.level, stateChanges.newSkill.level);
        console.log(`📈 Habilidad mejorada: ${existingSkill.id} (Nivel ${existingSkill.level})`);
      }
    }
    
    // Añadir nuevo item al inventario
    if (stateChanges.newInventoryItem) {
      const newItem = {
        name: stateChanges.newInventoryItem.name,
        icon: stateChanges.newInventoryItem.icon || '📦',
        description: stateChanges.newInventoryItem.description || ''
      };
      this.inventory.push(newItem);
      console.log(`📦 Nuevo item obtenido: ${newItem.name} ${newItem.icon}`);
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

IMPORTANTE: Analiza la narrativa REALMENTE y detecta:
1. OBTENER OBJETOS (encontrar, tomar, recoger libros, armas, pociones, llaves, etc.)
2. NUEVAS HABILIDADES (aprender, entrenar, dominar nuevas técnicas)
3. DAÑO FÍSICO real (caídas, ataques, heridas)
4. GASTO DE ENERGÍA (magia, esfuerzo físico)
5. CAMBIOS DE UBICACIÓN explícitos
6. ESTADOS EMOCIONALES por situaciones intensas
7. MUERTE si la situación es mortal

Responde SOLO con un JSON válido:

{
  "vitalDelta": {"health": -15, "mana": -20, "stamina": -10},
  "statusSet": {"miedo": 70, "alerta": 90, "fatiga": 30},
  "locationChange": "Nueva Ubicación Específica",
  "newSkill": {"id": "nueva_habilidad", "level": 1, "tags": ["tag"], "description": "desc"},
  "newInventoryItem": {"name": "Libro de Hechizos", "icon": "📖", "description": "Manual de conjuros básicos"},
  "resourceDelta": {"gold": +10, "rations": -1},
  "relationshipDelta": {"Persona": +15},
  "knowledgeDelta": {"Tema": +20},
  "forceDeathCheck": true,
  "deathReason": "Razón específica de muerte"
}

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
    
    const message = response.choices[0].message;
    let narrative = message.content || "El eco de tu acción resuena en el silencio...";
    
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
    const actionLower = action.toLowerCase();
    const narrativeLower = narrative.toLowerCase();
    
    if (actionLower.includes('morir') || narrativeLower.includes('mueres') || narrativeLower.includes('muerte')) {
      gameState.addEventFlag('MUERTE', 'Evento de muerte detectado');
    }
    if (actionLower.includes('combate') || actionLower.includes('atacar') || narrativeLower.includes('batalla')) {
      gameState.addEventFlag('COMBATE', `Combate en ${gameState.location}`);
    }
    if (actionLower.includes('compañero') || narrativeLower.includes('compañero') || narrativeLower.includes('aliado')) {
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

startServer().catch(console.error);