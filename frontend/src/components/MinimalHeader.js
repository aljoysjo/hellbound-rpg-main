import React from 'react';

const MinimalHeader = ({ gameState, connectionStatus }) => {
  const vitals = gameState?.vitals || { health: 100, mana: 50, stamina: 100 };
  const location = gameState?.location || 'Unknown Location';

  return (
    <header className="flex-shrink-0 bg-gradient-to-r from-[#F3E7C6]/90 to-[#E8D5A6]/90 
                       backdrop-blur-sm border-b border-[#B98746]/50 px-4 py-2">
      
      {/* HEADER COMPACTO OPCIÓN A: UNA SOLA LÍNEA HORIZONTAL */}
      <div className="flex items-center justify-between text-sm">
        
        {/* TÍTULO COMPACTO */}
        <span 
          className="font-bold text-[#D14438] text-lg tracking-wide"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          <span className="hidden md:inline">HELLBOUND RPG</span>
          <span className="md:hidden">HB</span>
        </span>
        
        {/* STATS HORIZONTALES EN UNA LÍNEA */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span>❤️</span>
            <span className="font-semibold text-[#583A1D]">{vitals.health}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🔮</span>
            <span className="font-semibold text-[#583A1D]">{vitals.mana}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⚡</span>
            <span className="font-semibold text-[#583A1D]">{vitals.stamina || 80}</span>
          </div>
        </div>
        
        {/* UBICACIÓN COMPACTA */}
        <div className="flex items-center gap-1 text-[#583A1D]">
          <span className="text-xs">📍</span>
          <span className="font-medium text-xs md:text-sm max-w-24 md:max-w-none truncate">
            {location}
          </span>
        </div>
      </div>
    </header>
  );
};

export default MinimalHeader;