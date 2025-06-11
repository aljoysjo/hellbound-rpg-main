import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import OpenAI from 'openai';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Story } from 'inkjs';

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

// Unified campaign loader with inkjs
function loadFullCampaign(name) {
  const base = '/app/campaigns';
  const campaignFile = path.join(base, 'campaign.json');
  const mapFile = path.join(base, 'map.json');
  const inkFile = path.join(base, 'scenes', `${name}.ink`);
  
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
    
    if (existsSync(inkFile)) {
      const inkText = readFileSync(inkFile, 'utf8');
      
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
      console.log(`❌ Ink file not found: ${inkFile}`);
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

const LORE = loadJsonFile('lore.json');
const FUNCTIONS = loadJsonFile('functions.json');
const LEXICON = loadJsonFile('lexicon.json');

// Game state management
const gameSessions = new Map();
const activeStories = new Map(); // Store ink stories

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
      narrativeLog: this.narrativeLog.slice(-10),
      mode: this.mode,
      campaignMeta: this.campaignMeta,
      map: this.map,
      questStage: this.questStage,
      divergenceScore: this.divergenceScore,
      memoryRaw: this.memoryRaw.slice(-20), // Keep last 20 events
      memorySummary: this.memorySummary,
      seasonId: this.seasonId,
      createdAt: this.createdAt.toISOString()
    };
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
      
      // Use campaign intro with enhanced context and immersion
      const bookTitle = "Hellbound: El infierno en la tierra";
      const campaignTitle = camp.json.titulo || "Aventura Épica";
      
      // Create immersive intro in second person
      let immersiveIntro = '';
      if (camp.firstText) {
        // Convert third person text to second person and make it immersive
        let baseText = camp.firstText;
        
        // Transform robotic text to immersive narrative
        if (baseText.includes("La nieve cae sobre Alicante")) {
          immersiveIntro = `Despiertas en tu habitación en Alicante, y lo primero que notas es el frío que se filtra por las ventanas. La nieve cae silenciosamente sobre la ciudad, creando un manto blanco que parece sofocar incluso los sonidos más leves. 

Algo no está bien. Un presentimiento oscuro te invade mientras observas por la ventana, y entonces la ves: una figura misteriosa te observa desde la distancia. Sus ojos rojos brillan en la penumbra y una sonrisa imposible se dibuja en su rostro.

Bienvenido a "${campaignTitle}", una historia basada en el universo de ${bookTitle}. Tu aventura comienza aquí, en este momento de inquietud y misterio.`;
        } else {
          // For other campaign texts, make them immersive
          immersiveIntro = `Bienvenido a "${campaignTitle}", una aventura épica basada en ${bookTitle}. 

${baseText.replace(/El jugador/g, 'Tú').replace(/el jugador/g, 'tú')}

Tu historia comienza ahora. ¿Qué harás?`;
        }
      } else {
        immersiveIntro = `Bienvenido a "${campaignTitle}", una campaña épica basada en el universo de ${bookTitle}. 

Tu aventura está a punto de comenzar en un mundo donde cada decisión puede cambiar el curso de la historia.`;
      }
      
      initialNarrative = immersiveIntro;
      
      // Store the ink story for continued interaction
      if (camp.story) {
        activeStories.set(sessionId, camp.story);
      }
      
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
    }
    
    // Save to MongoDB
    if (db) {
      await db.collection('sessions').insertOne(gameState.toDict());
    }
    
    res.json({
      session_id: sessionId,
      game_state: gameState.toDict(),
      initial_narrative: initialNarrative,
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
    let memorySystem = '';
    
    if (gameState.campaignMeta) {
      const storyMode = gameState.campaignMeta.story_mode || 'campaign';
      
      // Campaign context based on story mode
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
      } else if (storyMode === 'sandbox') {
        campaignContext += `
WORLD_SEED: Basado en idea del jugador
MEMORY_RAW: [Eventos recientes del jugador]
MEMORY_SUMMARY: [Síntesis de aventuras previas]
`;
      } else if (storyMode === 'seasonal') {
        campaignContext += `
SEASON_ID: ${gameState.campaignMeta.season_id || 'temp_event'}
TTL: ${gameState.campaignMeta.ttl || 'Sin límite'}
TEMÁTICA ESPECIAL: Evento temporal único
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
    4. **Sugiere acciones**: Mentalmente piensa 2-4 opciones relevantes 
    5. **Actualiza progresión**: Si es campaña, considera divergence_score
    6. **Memoria activa**: Recuerda eventos previos y mantén consistencia
    
    ESTILO NARRATIVO:
    - Máximo 4 oraciones descriptivas y evocativas
    - Usa vocabulario rico pero accesible
    - Integra elementos del mundo específico de la campaña
    - Crea atmósfera inmersiva que respete el tone_level
    
    ACCIÓN DEL JUGADOR: "${action}"
    
    Genera una narrativa inmersiva que expanda el mundo de "${gameState.campaignMeta?.titulo || 'la aventura'}" 
    manteniendo coherencia con el lore establecido y la progresión de la historia.
    `;
    
    // Call OpenAI without function calling (simplified)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `El jugador dice: '${action}'` }
      ],
      temperature: 0.8,
      max_tokens: 200
    });
    
    console.log('🔍 DEBUG - OpenAI response:', response.choices[0]);
    
    const message = response.choices[0].message;
    console.log('🔍 GPT RAW:', JSON.stringify(message, null, 2));
    
    let narrative = message.content || "El eco de tu acción resuena en la oscuridad...";
    
    console.log('🔍 DEBUG - Final narrative:', narrative);
    
    // Add to narrative log
    gameState.narrativeLog.push({
      timestamp: new Date().toISOString(),
      player_action: action,
      narrative: narrative
    });
    
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
      new_narrative: narrative
    });
    
    res.json({
      success: true,
      narrative: narrative,
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