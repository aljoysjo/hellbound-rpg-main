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

// Load campaign helper - loads complete campaign data
function loadCampaign(campaignName) {
  const campaignDir = `/app/campaigns`;
  const campaignFile = `${campaignDir}/campaign.json`;
  const mapFile = `${campaignDir}/map.json`;
  const scenesFile = `${campaignDir}/${campaignName}.ink`;
  
  console.log(`🔍 Loading campaign: ${campaignName}`);
  console.log(`🔍 Looking for files:`);
  console.log(`   - campaign.json: ${existsSync(campaignFile)}`);
  console.log(`   - map.json: ${existsSync(mapFile)}`);
  console.log(`   - ${campaignName}.ink: ${existsSync(scenesFile)}`);
  
  try {
    let campaign = {};
    let map = {};
    let scenes = '';
    
    // Load campaign.json if exists
    if (existsSync(campaignFile)) {
      campaign = JSON.parse(readFileSync(campaignFile, 'utf8'));
      console.log(`✅ Loaded campaign.json`);
    } else {
      console.log(`⚠️ campaign.json not found, using default`);
      campaign = {
        title: "Las Puertas de Ceniza",
        description: "Campaña épica del Reino Ardiente",
        intro: "Te encuentras ante las imponentes Puertas de Ceniza, donde comienza tu destino como exorcista."
      };
    }
    
    // Load map.json if exists
    if (existsSync(mapFile)) {
      map = JSON.parse(readFileSync(mapFile, 'utf8'));
      console.log(`✅ Loaded map.json`);
    }
    
    // Load scenes file if exists
    if (existsSync(scenesFile)) {
      scenes = readFileSync(scenesFile, 'utf8');
      console.log(`✅ Loaded ${campaignName}.ink`);
      
      // Extract intro from scenes if campaign.json doesn't have one
      if (!campaign.intro && scenes) {
        const lines = scenes.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('===') || line.startsWith('#') || line === '') {
            continue;
          }
          if (line.length > 20) {
            campaign.intro = line;
            break;
          }
        }
      }
    } else {
      console.log(`⚠️ ${campaignName}.ink not found`);
    }
    
    return {
      campaign,
      map,
      scenes,
      intro: campaign.intro || "Comienza tu campaña épica en las Puertas de Ceniza."
    };
    
  } catch (error) {
    console.log(`❌ Error loading campaign ${campaignName}:`, error.message);
    return null;
  }
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
    
    // Handle campaign mode
    if (mode === 'campaign') {
      const camp = loadCampaign(campaign || 'scenes_act1');
      if (!camp) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
      }
      
      // Use campaign intro
      initialNarrative = `[CAMPAÑA CARGADA] ${camp.intro}`;
      gameState.narrativeLog.push({
        timestamp: new Date().toISOString(),
        player_action: '[Inicio de Campaña]',
        narrative: camp.intro
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
    
    // Create the system prompt in Spanish
    const systemPrompt = `
    Eres la lógica narrativa del juego Hellbound RPG. 
    Responde SIEMPRE en español neutro, en frases cortas y oscuras.
    
    CONTEXTO DEL MUNDO:
    - ${LORE.setting || 'Un mundo devastado por la guerra donde los demonios caminan por la tierra'}
    - Héroe: ${LORE.hero || 'Un exorcista solitario buscando redención'}
    - Antagonista: ${LORE.antagonist || 'El Príncipe Caído gobernando el Reino Ardiente'}
    
    MODO DE JUEGO: ${gameState.mode}
    ${gameState.mode === 'campaign' ? 'NOTA: Usa la estructura de campaña definida en los archivos de escenarios.' : ''}
    
    ESTADO ACTUAL DEL JUGADOR:
    - Salud: ${gameState.health}/100
    - Maná: ${gameState.mana}/100
    - Oro: ${gameState.gold}
    - Ubicación: ${gameState.location}
    - Habilidades: ${gameState.skills.join(', ')}
    
    INSTRUCCIONES:
    1. Interpreta la acción del jugador de forma creativa
    2. Mantén el tono oscuro y atmosférico
    3. Ajusta los stats del jugador según lo que pase
    4. Usa máximo 3 oraciones
    5. Describe consecuencias de la acción
    ${gameState.mode === 'campaign' ? '6. Sigue la estructura narrativa de la campaña definida' : ''}
    
    ACCIÓN DEL JUGADOR: "${action}"
    
    Responde con una narrativa inmersiva y actualiza el estado del juego.
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