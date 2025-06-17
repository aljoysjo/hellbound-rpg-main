import React from 'react';

// EnhancedHeader component that displays game stats and connection status
const EnhancedHeader = ({ gameState, connectionStatus }) => {
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

export default EnhancedHeader;
