import React from 'react';

const ResponsiveHeader = ({ gameState, connectionStatus }) => {
  const vitals = gameState?.vitals || { health: 100, mana: 50, stamina: 100 };
  const location = gameState?.location || 'Ubicación Desconocida';

  return (
    <>
      {/* HEADER MINIMALISTA SOLO MÓVIL */}
      <header className="md:hidden flex-shrink-0 bg-gradient-to-r from-[#F3E7C6]/90 to-[#E8D5A6]/90 
                         backdrop-blur-sm border-b border-[#B98746]/50 px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <span 
            className="font-bold text-[#D14438] text-lg tracking-wide"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            HB
          </span>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span>❤️</span>
              <span className="font-semibold text-[#583A1D] text-xs">{vitals.health}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>🔮</span>
              <span className="font-semibold text-[#583A1D] text-xs">{vitals.mana}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>⚡</span>
              <span className="font-semibold text-[#583A1D] text-xs">{vitals.stamina || 80}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-[#583A1D]">
            <span className="text-xs">📍</span>
            <span className="font-medium text-xs max-w-16 truncate">
              {location}
            </span>
          </div>
        </div>
      </header>

      {/* HEADER COMPLETO SOLO DESKTOP */}
      <header className="hidden md:block flex-shrink-0 p-3 bg-gradient-to-b from-[var(--creamy-old)]/90 via-[var(--creamy-old)]/80 to-transparent backdrop-blur-sm border-b border-[var(--imperial-gold)]/30">
        {/* TÍTULO Y STATUS */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative w-3 h-3">
              <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 animate-ping"></div>
              <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-500 m-auto border border-white"></div>
            </div>
            <span className="text-xs font-medium text-[var(--cedar-brown)]">
              {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <h2 className="text-[var(--cedar-brown)] text-lg font-bold">Hellbound RPG</h2>
          <div className="w-20"></div>
        </div>

        {/* BARRAS DE STATS COMPLETAS DESKTOP */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">❤️</span>
            <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden border border-[var(--cedar-brown)]/30">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, vitals.health))}%`,
                  background: 'var(--health-bar)'
                }}
              />
            </div>
            <span className="text-xs font-bold text-[var(--cedar-brown)] min-w-[25px]">
              {vitals.health}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">🔮</span>
            <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden border border-[var(--cedar-brown)]/30">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, vitals.mana))}%`,
                  background: 'var(--mana-bar)'
                }}
              />
            </div>
            <span className="text-xs font-bold text-[var(--cedar-brown)] min-w-[25px]">
              {vitals.mana}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden border border-[var(--cedar-brown)]/30">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${Math.max(0, Math.min(100, vitals.stamina || 80))}%`,
                  background: 'var(--stamina-bar)'
                }}
              />
            </div>
            <span className="text-xs font-bold text-[var(--cedar-brown)] min-w-[25px]">
              {vitals.stamina || 80}
            </span>
          </div>
        </div>

        {/* UBICACIÓN */}
        <div className="text-center mt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cedar-brown)]">
            📍 <span className="font-bold text-[var(--text-accent-custom)]">{location}</span>
          </p>
        </div>
      </header>
    </>
  );
};

export default ResponsiveHeader;