import React from 'react';
import { createPortal } from 'react-dom';

const DiscoveredItemsModal = ({ 
  discoveredItems, 
  showDiscoveredItems, 
  onPickupItem, 
  onIgnoreItem,
  onCloseModal 
}) => {
  // OPCIÓN A CHATGPT: Solo usar showDiscoveredItems, NO discoveredItems.length
  if (!showDiscoveredItems) {
    return null;
  }

  // Si no hay items, mostrar mensaje pero mantener modal abierto
  const itemsToShow = discoveredItems || [];

  const modalContent = (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[var(--cedar-brown)] font-bold text-center flex-1">
            🎁 Items Descubiertos
          </h3>
          <button 
            onClick={onCloseModal}
            className="text-[var(--cedar-brown)] hover:text-[var(--cedar-brown)]/70 font-bold text-lg"
          >
            ×
          </button>
        </div>
        <div className="space-y-3">
          {itemsToShow.length > 0 ? (
            itemsToShow.map((item, index) => (
            <div
              key={item.instanceId || index}
              className="p-4 bg-[var(--creamy-old)] border border-[var(--imperial-gold)] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-[var(--imperial-gold)]/20 rounded-lg flex items-center justify-center">
                  <span className="text-lg">{item.icon}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--cedar-brown)]">{item.name}</h4>
                  <p className="text-sm text-[var(--cedar-brown)]/70 mt-1">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onPickupItem(item.instanceId)}
                    className="px-3 py-1 bg-[var(--imperial-gold)] text-[var(--cedar-brown)] text-xs font-medium rounded hover:bg-[var(--imperial-gold)]/80 transition-colors"
                  >
                    Pick Up
                  </button>
                  <button
                    onClick={() => onIgnoreItem(item.instanceId)}
                    className="px-3 py-1 bg-gray-300 text-[var(--cedar-brown)] text-xs font-medium rounded hover:bg-gray-400 transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DiscoveredItemsModal;