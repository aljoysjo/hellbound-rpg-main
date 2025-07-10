{/* 🎁 BLOQUE DE LOOT INLINE */}
                  {index === gameState.narrativeLog.length - 1 && discoveredItems.length > 0 && (
                    <InlineLootBlock
                      items={discoveredItems}
                      onCollectAll={collectAllItems}
                      onIgnoreAll={ignoreAllItems}
                    />
                  )}