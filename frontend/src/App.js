import React, { useState, useEffect, useRef } from 'react';
import ModeSelector from "./components/ModeSelector";
import './App.css';
import io from 'socket.io-client';

/* ---------------- HUD Components (sin cambios) ---------------- */
const LifeOrb = ({ health }) => (/* …igual que antes… */);
const ManaOrb = ({ mana }) => (/* …igual que antes… */);
const SkillBar  = ({ skills }) => (/* …igual que antes… */);
const GoldCounter = ({ gold }) => (/* …igual que antes… */);
const ActionInput = ({ onSubmit, disabled }) => (/* …igual que antes… */);
const LogFeed = ({ narrativeLog }) => (/* …igual que antes… */);

/* -------------------- Main App -------------------- */
function App() {
  const [mode, setMode] = useState(null);          // NUEVO estado
  const [gameState, setGameState] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  /* --------- Socket.IO ---------- */
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () =>  setConnectionStatus('connected'));
    newSocket.on('disconnect', () => setConnectionStatus('disconnected'));

    newSocket.on('game_update', (data) => {
      if (data.session_id === sessionId) setGameState(data.game_state);
    });

    return () => newSocket.close();
  }, [BACKEND_URL, sessionId]);

  /* --------- Start Session ---------- */
  const startNewSession = async (selectedMode) => {
    if (!selectedMode) return;          // seguridad
    setLoading(true); setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/start_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode })
      });
      if (!res.ok) throw new Error('Failed to start session');

      const data = await res.json();
      setSessionId(data.session_id);
      setGameState(data.game_state);

      socket?.emit('join_session', { session_id: data.session_id });

      if (data.initial_narrative) {
        setGameState(prev => ({
          ...prev,
          narrative_log: [
            ...(prev?.narrative_log || []),
            { player_action: '[Inicio del juego]', narrative: data.initial_narrative }
          ]
        }));
      }
    } catch (err) {
      setError('Error al iniciar sesión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* --------- Submit Action ---------- */
  const submitAction = async (action) => { /* …sin cambios… */ };

  /* ------------------ UI ------------------ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black text-white font-medieval">
      {/* …header igual… */}

      <main className="relative z-10 container mx-auto px-4 py-6">
        {!sessionId ? (
          /* ---------- Pantalla de inicio ---------- */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-5xl font-bold text-red-400 mb-4">Bienvenido al Infierno</h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl">
              Un mundo devastado por la guerra donde los demonios caminan por la tierra. 
              Eres un exorcista solitario buscando redención en el Reino Ardiente.
            </p>

            {/* Selector de modo */}
            {!mode && <ModeSelector onSelect={setMode} />}

            {/* Botón de iniciar según modo */}
            {mode && (
              <button
                onClick={() => startNewSession(mode)}
                disabled={loading}
                className="mt-4 px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-lg font-bold rounded-lg transition-colors shadow-lg"
              >
                {loading ? 'Iniciando...' :
                  `Iniciar ${mode === 'sandbox' ? 'Sandbox' :
                            mode === 'campaign' ? 'Campaña' : 'Temporal'}`}
              </button>
            )}
          </div>
        ) : (
          /* ---------- Interfaz de juego (sin cambios) ---------- */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* …HUD, LogFeed, ActionInput tal como ya los tienes… */}
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
