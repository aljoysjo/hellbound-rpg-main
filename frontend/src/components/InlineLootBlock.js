import React from "react";

// Helper para iconos de items
const getItemIcon = (itemType) => {
  const iconMap = {
    // ARMAS Y COMBATE
    'espada': 'sports_martial_arts',
    'daga': 'sports_martial_arts', 
    'hacha': 'sports_martial_arts',
    'arco': 'sports_martial_arts',
    'revolver': 'sports_martial_arts',
    // DEFENSAS
    'escudo': 'security',
    'armadura': 'security',
    // AMULETOS Y PROTECCIÓN
    'amuleto': 'auto_awesome',
    'talismán': 'auto_awesome',
    // VESTIMENTA
    'capa': 'checkroom',
    'ropa': 'checkroom',
    'zapatos': 'checkroom',
    'guantes': 'checkroom',
    // CONSUMIBLES Y OBJETOS
    'pergamino': 'auto_stories',
    'libro': 'menu_book',
    'pocion': 'science',
    'frasco': 'science',
    'cristal': 'diamond',
    'gema': 'diamond',
    'moneda': 'paid',
    'reliquia': 'museum',
    // TIPOS BACKEND ESPECÍFICOS
    'mystical': 'auto_awesome',
    'knowledge': 'menu_book',
    'default': 'inventory'
  };
  return iconMap[itemType?.toLowerCase()] || iconMap.default;
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