import React from "react";

// Helper para iconos de items - CHATGPT APPROACH
const getItemIcon = (itemType) => {
  const iconMap = {
    // Tipos principales (alineados con backend)
    'libro': 'menu_book',
    'arma': 'sports_martial_arts',
    'armadura': 'security', 
    'amuleto': 'auto_awesome',
    'misceláneo': 'inventory',
    // Tipos específicos del backend
    'espada': 'sports_martial_arts',
    'daga': 'sports_martial_arts',
    'mystical': 'auto_awesome',
    'knowledge': 'menu_book',
    'cristal': 'diamond'
  };
  return iconMap[itemType?.toLowerCase()] || 'inventory';
};

export default function InlineLootBlock({
  items = [],
  onCollectAll,
  onIgnoreAll,
}) {
  if (!items.length) return null;

  return (
    <div className="loot-block bg-[var(--imperial-gold)]/10 p-4 rounded-lg border border-[var(--imperial-gold)] space-y-2 my-4">
      <h2 className="loot-title text-center text-xl font-bold text-[var(--cedar-brown)] mb-3">
        ✨ ¡Botín encontrado! ✨
      </h2>

      {items.map((itm) => (
        <div key={itm.instanceId} className="flex items-center gap-3">
          <span className="material-icons-outlined text-[var(--cedar-brown)] text-3xl">
            {getItemIcon(itm.type)}
          </span>
          <span className="item-name flex-1 text-lg text-[var(--cedar-brown)] font-medium">{itm.name}</span>
          <span className="rarity-tag text-sm text-[var(--imperial-gold)] px-2 py-1 rounded-full bg-[var(--imperial-gold)]/20">
            ({itm.rarity || "común"})
          </span>
        </div>
      ))}

      <div className="flex gap-3 pt-3 justify-center sm:justify-start">
        <button
          className="px-4 py-2 bg-[var(--imperial-gold)] hover:bg-[var(--imperial-gold)]/80 text-[var(--cedar-brown)] font-semibold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={onCollectAll}
        >
          Recoger
        </button>
        <button
          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-[var(--cedar-brown)] font-semibold rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={onIgnoreAll}
        >
          Ignorar
        </button>
      </div>
    </div>
  );
}