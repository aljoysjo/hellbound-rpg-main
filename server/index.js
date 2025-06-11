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
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
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

// Generate suggested actions based on context using AI
async function generateSuggestedActions(gameState, narrative, openaiClient) {
  try {
    // Crear un prompt contextual para generar acciones relevantes
    const contextPrompt = `
Eres un maestro de juego para Hellbound RPG. Basándote en la narrativa actual, genera exactamente 4 acciones sugeridas breves y específicas que el jugador pueda realizar.

CONTEXTO ACTUAL:
- Ubicación: ${gameState.location}
- Narrativa actual: "${narrative}"
- Modo de juego: ${gameState.mode}
- Salud: ${gameState.health}/100
- Maná: ${gameState.mana}/100

INSTRUCCIONES:
1. Las acciones deben ser específicas a la situación actual
2. Máximo 4-6 palabras por acción
3. En español
4. Que tengan sentido con lo que acaba de pasar en la narrativa
5. Incluir variedad: exploración, interacción, combate, habilidades

Responde SOLO con 4 acciones separadas por comas, sin numeración ni explicaciones.

Ejemplo de formato: "Hablar con Darius, Examinar la fuente helada, Usar Exorcismo, Buscar pistas en la plaza"
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
    // Fallback a acciones genéricas
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
    this.health = 100;
    this.mana = 100;
    this.gold = 50;
    this.skills = ["Exorcismo", "Fuego Sagrado", "Barrera", "Curación"];
    this.location = "Puertas de Ceniza";
    this.inventory = [];
    this.narrativeLog = [];
    this.mode = 'sandbox';
    this.campaignMeta = null;
    this.map = null;
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
  }

  toDict() {
    return {
      sessionId: this.sessionId,
      playerId: this.playerId,
      health: this.health,
      mana: this.mana,
      gold: this.gold,
      skills: this.skills,
      location: this.location,
      inventory: this.inventory,
      narrativeLog: this.narrativeLog.slice(-5),
      mode: this.mode,
      campaignMeta: this.campaignMeta,
      map: this.map,
      questStage: this.questStage,
      divergenceScore: this.divergenceScore,
      memoryRaw: this.memoryRaw.slice(-10),
      memorySummary: this.memorySummary,
      sessionSummaries: this.sessionSummaries,
      eventFlags: Array.from(this.eventFlags),
      actionCount: this.actionCount,
      seasonId: this.seasonId,
      createdAt: this.createdAt.toISOString()
    };
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

app.post('/api/start_session', async (req, res) => {
  try {
    const { mode = 'sandbox', campaign } = req.body;
    const sessionId = crypto.randomUUID();
    const gameState = new GameState(sessionId);
    
    gameState.mode = mode;
    gameSessions.set(sessionId, gameState);
    
    let initialNarrative;
    let suggestedActions = [];
    
    // Handle campaign mode with full loading
    if (mode === 'campaign') {
      const camp = loadFullCampaign(campaign || 'scenes_act1');
      if (!camp) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }
      
      // Set campaign data in game state
      gameState.campaignMeta = camp.json;
      gameState.map = camp.map;
      
      // Use campaign location or first map node
      if (camp.map.nodes && camp.map.nodes.length > 0) {
        gameState.location = camp.map.nodes[0].name;
      }
      
      // Create immersive intro
      const bookTitle = "Hellbound: El infierno en la tierra";
      const campaignTitle = camp.json.titulo || "Aventura Épica";
      
      if (camp.firstText && camp.firstText.includes("La nieve cae sobre Alicante")) {
        initialNarrative = `Despiertas en tu habitación en Alicante, y lo primero que notas es el frío que se filtra por las ventanas. La nieve cae silenciosamente sobre la ciudad, creando un manto blanco que parece sofocar incluso los sonidos más leves. 

Algo no está bien. Un presentimiento oscuro te invade mientras observas por la ventana, y entonces la ves: una figura misteriosa te observa desde la distancia. Sus ojos rojos brillan en la penumbra y una sonrisa imposible se dibuja en su rostro.

Bienvenido a "${campaignTitle}", una historia basada en el universo de ${bookTitle}. Tu aventura comienza aquí, en este momento de inquietud y misterio.`;
      } else {
        initialNarrative = `Bienvenido a "${campaignTitle}", una aventura épica basada en ${bookTitle}. 

${camp.firstText || 'Tu historia comienza ahora.'}`;
      }
      
      // Generate initial suggested actions
      suggestedActions = generateSuggestedActions(gameState, initialNarrative);
      
      // Add to narrative log
      gameState.narrativeLog.push({
        timestamp: new Date().toISOString(),
        player_action: '[Inicio de Campaña]',
        narrative: initialNarrative
      });
      
    } else {
      // Default narratives for other modes
      switch (mode) {
        case 'seasonal':
          initialNarrative = `¡Evento especial activo! Las estrellas se alinean de manera extraña, otorgando poderes temporales. Te encuentras ante las ${gameState.location} durante esta época mística.`;
          break;
        default: // sandbox
          initialNarrative = `Te encuentras ante las ${gameState.location}. El viento trae susurros de almas condenadas. En este mundo abierto, tu destino es tuyo. ¿Qué harás, exorcista?`;
      }
      suggestedActions = generateSuggestedActions(gameState, initialNarrative);
    }
    
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
    
    // Create enhanced system prompt following Sombra Arcana DM v2.0
    let campaignContext = '';
    
    if (gameState.campaignMeta) {
      const storyMode = gameState.campaignMeta.story_mode || 'campaign';
      
      campaignContext = `
MODO DE HISTORIA: ${storyMode.toUpperCase()}
CAMPAÑA: "${gameState.campaignMeta.titulo}"
NIVEL DE TONO: ${gameState.campaignMeta.tone_level || 5}/10
`;

      if (storyMode === 'campaign') {
        campaignContext += `
ACTO ACTUAL: 1 de ${gameState.campaignMeta.acto_total}
COMPAÑEROS DISPONIBLES: ${gameState.campaignMeta.companions?.join(', ') || 'Ninguno'}
QUEST_STAGE: I (Inicio de campaña)
DIVERGENCE_SCORE: 0 (siguiendo trama canónica)
LOCACIONES DEL MUNDO: ${gameState.campaignMeta.locations?.join(' → ') || 'Desconocidas'}

CONTEXTO NARRATIVO ESPECÍFICO DE "${gameState.campaignMeta.titulo}":
- BASADO EN: "Hellbound: El infierno en la tierra"
- El jugador ha despertado en Alicante con un presentimiento oscuro
- Una figura misteriosa lo observa desde la ventana con ojos rojos
- Hay una presencia sobrenatural que genera inquietud  
- Los Errantes y el Uróboros son elementos importantes del mundo
- El Rey Hawkeye y los desequilibrios entre reinos son temas centrales
- La nieve cae constantemente, creando una atmósfera melancólica
- SIEMPRE HABLA EN SEGUNDA PERSONA: Dirígete al jugador como "tú", nunca "el jugador"
`;
      }
    }
    
    const systemPrompt = `
    Eres **Sombra Arcana**, IA Dungeon Master del ARPG Hellbound siguiendo el protocolo v2.0.
    Trabajas en **español neutro** y generas narrativa rica basada en el contexto de campaña.
    
    ${campaignContext}
    
    LORE_BASE (Mundo general si no hay campaña específica):
    - ${LORE.setting || 'Un mundo devastado por la guerra donde los demonios caminan por la tierra'}
    - Héroe: ${LORE.hero || 'Un exorcista solitario buscando redención'}
    - Antagonista: ${LORE.antagonist || 'El Príncipe Caído gobernando el Reino Ardiente'}
    
    ESTADO ACTUAL DEL JUGADOR:
    - Salud: ${gameState.health}/100
    - Maná: ${gameState.mana}/100  
    - Oro: ${gameState.gold}
    - Ubicación: ${gameState.location}
    - Habilidades: ${gameState.skills.join(', ')}
    
    PROTOCOLO SOMBRA ARCANA:
    1. **Respeta tone_level**: Ajusta la intensidad narrativa (0=luminoso, 10=sombrío)
    2. **Mantén coherencia**: Usa contexto de campaña y personajes establecidos
    3. **Incluye consecuencias**: Describe efectos atmosféricos y emocionales
    4. **Actualiza progresión**: Si es campaña, considera divergence_score
    5. **Memoria activa**: Recuerda eventos previos y mantén consistencia
    
    ESTILO NARRATIVO:
    - Máximo 4 oraciones descriptivas y evocativas
    - Usa vocabulario rico pero accesible
    - Integra elementos del mundo específico de la campaña
    - Crea atmósfera inmersiva que respete el tone_level
    - SIEMPRE en segunda persona ("tú", nunca "el jugador")
    
    ACCIÓN DEL JUGADOR: "${action}"
    
    Genera una narrativa inmersiva que expanda el mundo de "${gameState.campaignMeta?.titulo || 'la aventura'}" 
    manteniendo coherencia con el lore establecido y la progresión de la historia.
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
    let narrative = message.content || "El eco de tu acción resuena en la oscuridad...";
    
    // Generate new suggested actions based on the narrative and context
    const suggestedActions = generateSuggestedActions(gameState, narrative);
    
    // Add to narrative log
    gameState.narrativeLog.push({
      timestamp: new Date().toISOString(),
      player_action: action,
      narrative: narrative
    });

    // 🧠 SISTEMA DE MEMORIA MEJORADO - Detectar eventos importantes
    gameState.actionCount++;
    
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
      suggested_actions: suggestedActions
    });
    
    res.json({
      success: true,
      narrative: narrative,
      suggested_actions: suggestedActions,
      game_state: gameState.toDict()
    });
    
  } catch (error) {
    console.error('Error processing action:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/get_session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  if (!gameSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const gameState = gameSessions.get(sessionId);
  res.json({
    session_id: sessionId,
    game_state: gameState.toDict()
  });
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