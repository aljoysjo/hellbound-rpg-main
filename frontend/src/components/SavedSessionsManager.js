import React, { useState, useEffect } from 'react';

const SavedSessionsManager = ({ BACKEND_URL, onLoadSession, onCancel }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [loadingCode, setLoadingCode] = useState('');

  // Cargar lista de sesiones al montar
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/list_sessions`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron cargar las sesiones`);
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
      
    } catch (err) {
      console.error('Error cargando sesiones:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = async (code) => {
    setLoadingCode(code);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/load_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: code })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Sesión cargada exitosamente:', data);
      
      // Pasar los datos al componente padre
      onLoadSession(data);
      
    } catch (err) {
      console.error('Error cargando sesión:', err);
      setError(err.message);
    } finally {
      setLoadingCode('');
    }
  };

  const handleLoadByCode = async () => {
    if (!sessionCode.trim()) {
      setError('Por favor ingresa un código de sesión');
      return;
    }
    
    setLoadingCode('BY_CODE'); // Usar un valor específico para cargar por código
    await handleLoadSession(sessionCode.trim().toUpperCase());
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const getGameModeIcon = (mode) => {
    switch (mode) {
      case 'campaign': return '📖';
      case 'sandbox': return '🎨';
      default: return '🎮';
    }
  };

  const getHealthColor = (health) => {
    if (health >= 80) return 'text-green-600';
    if (health >= 50) return 'text-yellow-600';
    if (health >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--creamy-old)] to-[var(--light-caramel)] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* HEADER */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-[var(--cedar-brown)]">
            💾 Sesiones Guardadas
          </h1>
          <p className="text-[var(--cedar-brown)]/70">
            Carga una partida existente o ingresa un código de sesión
          </p>
        </div>

        {/* CARGAR POR CÓDIGO */}
        <div className="mb-8 rounded-xl bg-white/50 p-6 shadow-lg backdrop-blur-sm">
          <h2 className="mb-4 text-xl font-semibold text-[var(--cedar-brown)]">
            🔑 Cargar por Código
          </h2>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
              placeholder="Ej: RPG-ABC123"
              className="flex-1 rounded-lg border border-[var(--imperial-gold)]/30 bg-white/70 px-4 py-2 text-[var(--cedar-brown)] placeholder-[var(--cedar-brown)]/50 focus:border-[var(--imperial-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--imperial-gold)]/20"
              disabled={loadingCode !== ''}
            />
            
            <button
              onClick={handleLoadByCode}
              disabled={!sessionCode.trim() || loadingCode === 'BY_CODE'}
              className="rounded-lg bg-[var(--imperial-gold)] px-6 py-2 font-semibold text-white transition-all hover:bg-[var(--imperial-gold)]/90 disabled:bg-gray-400"
            >
              {loadingCode === 'BY_CODE' ? '🔄 Cargando...' : 'Cargar'}
            </button>
          </div>
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-100 border border-red-300 p-4 text-red-700">
            <div className="flex items-center justify-between">
              <span>❌ {error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-2 text-sm underline hover:no-underline"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/50 px-4 py-2 text-[var(--cedar-brown)]">
              <div className="size-4 animate-spin rounded-full border-2 border-[var(--imperial-gold)]/20 border-t-[var(--imperial-gold)]"></div>
              Cargando sesiones...
            </div>
          </div>
        )}

        {/* LISTA DE SESIONES */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--cedar-brown)]">
              📋 Sesiones Recientes ({sessions.length})
            </h2>
            
            <button
              onClick={loadSessions}
              disabled={loading}
              className="rounded-lg bg-[var(--cedar-brown)]/10 px-4 py-2 text-[var(--cedar-brown)] transition-all hover:bg-[var(--cedar-brown)]/20 disabled:opacity-50"
            >
              🔄 Actualizar
            </button>
          </div>

          {sessions.length === 0 && !loading ? (
            <div className="rounded-xl bg-white/30 p-8 text-center">
              <div className="mb-4 text-6xl">🎮</div>
              <h3 className="mb-2 text-xl font-semibold text-[var(--cedar-brown)]">
                No hay sesiones guardadas
              </h3>
              <p className="text-[var(--cedar-brown)]/70">
                Las partidas se guardan automáticamente mientras juegas
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <div
                  key={session.sessionCode}
                  className="rounded-xl bg-white/50 p-4 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl"
                >
                  {/* HEADER DE LA SESIÓN */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-2xl">
                      {getGameModeIcon(session.gameMode)}
                    </span>
                    
                    <div className="text-right">
                      <div className="text-xs text-[var(--cedar-brown)]/60">
                        {formatDate(session.lastPlayed)}
                      </div>
                      <div className="text-sm font-mono text-[var(--cedar-brown)]">
                        {session.sessionCode}
                      </div>
                    </div>
                  </div>

                  {/* TÍTULO */}
                  <h3 className="mb-2 font-semibold text-[var(--cedar-brown)] line-clamp-2">
                    {session.title}
                  </h3>

                  {/* INFORMACIÓN */}
                  <div className="mb-3 space-y-1 text-sm text-[var(--cedar-brown)]/70">
                    <div className="flex items-center justify-between">
                      <span>📍 {session.location}</span>
                      <span className={`font-semibold ${getHealthColor(session.health)}`}>
                        ❤️ {session.health}/100
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span>🎮 {session.gameMode === 'campaign' ? 'Campaña' : 'Sandbox'}</span>
                      <span>👥 {session.playerCount} jugador{session.playerCount !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>

                  {/* BOTÓN DE CARGAR */}
                  <button
                    onClick={() => handleLoadSession(session.sessionCode)}
                    disabled={loadingCode === session.sessionCode}
                    className="w-full rounded-lg bg-[var(--imperial-gold)] py-2 font-semibold text-white transition-all hover:bg-[var(--imperial-gold)]/90 disabled:bg-gray-400"
                  >
                    {loadingCode === session.sessionCode ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                        Cargando...
                      </span>
                    ) : (
                      '▶️ Continuar Partida'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTÓN VOLVER - MÁS VISIBLE */}
        <div className="mt-8 text-center">
          <button
            onClick={onCancel}
            className="rounded-lg bg-[var(--cedar-brown)] px-8 py-3 text-white font-semibold transition-all hover:bg-[var(--cedar-brown)]/90 shadow-lg"
          >
            ← Volver al Menú Principal
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavedSessionsManager;