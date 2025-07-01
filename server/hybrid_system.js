    // 🔧 FUNCIÓN: DETECCIÓN INTELIGENTE DE ITEMS EN NARRATIVA
    function extractItemsFromNarrative(narrative) {
      console.log('📖 Analizando narrativa para detectar items...');
      
      const patterns = [
        /encuentras? (una?|el|la) ([^,.!?]+)/gi,
        /descubres? (una?|el|la) ([^,.!?]+)/gi,
        /hallas? (una?|el|la) ([^,.!?]+)/gi,
        /ves? (una?|el|la) ([^,.!?]+)/gi,
        /hay (una?|el|la) ([^,.!?]+)/gi,
        /aparece (una?|el|la) ([^,.!?]+)/gi,
        /observas? (una?|el|la) ([^,.!?]+)/gi,
        /localizas? (una?|el|la) ([^,.!?]+)/gi,
        /notas? (una?|el|la) ([^,.!?]+)/gi,
        /(una?|el|la) ([^,.!?]+) (sobre|en|bajo|dentro de|junto a)/gi,
        /se encuentra (una?|el|la) ([^,.!?]+)/gi
      ];
      
      let foundItems = [];
      
      patterns.forEach((pattern, index) => {
        let match;
        while ((match = pattern.exec(narrative)) !== null) {
          let itemName = '';
          
          // Para la mayoría de patrones, el item está en la posición 2
          if (index < 10) {
            itemName = match[2].trim();
          } else {
            // Para el último patrón es diferente
            itemName = match[2].trim();
          }
          
          // Limpiar y validar el item
          itemName = itemName.replace(/[,\.!?;]$/, '').trim();
          
          // Filtrar palabras demasiado cortas o genéricas
          if (itemName.length > 3 && !['lugar', 'sitio', 'cosa', 'algo', 'esto'].includes(itemName.toLowerCase())) {
            foundItems.push(itemName);
            console.log(`🔍 Item detectado: "${itemName}"`);
          }
        }
      });
      
      // Eliminar duplicados y limpiar
      const uniqueItems = [...new Set(foundItems.map(item => item.toLowerCase()))]
        .map(item => item.charAt(0).toUpperCase() + item.slice(1));
      
      console.log(`📦 Items únicos extraídos: ${uniqueItems.length > 0 ? uniqueItems.join(', ') : 'ninguno'}`);
      return uniqueItems;
    }
    
    // 🔧 FUNCIÓN: GENERAR PREGUNTA NARRATIVA PARA ITEMS
    function generateItemChoiceNarrative(items) {
      if (items.length === 0) return '';
      
      const phrases = [
        '¿Qué haces con',
        '¿Cómo procedes con',
        '¿Decides tomar',
        '¿Te interesa',
        '¿Examinas más de cerca'
      ];
      
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      
      if (items.length === 1) {
        return ` ${randomPhrase} ${items[0].toLowerCase()}?`;
      } else if (items.length === 2) {
        return ` ${randomPhrase} ${items[0].toLowerCase()} y ${items[1].toLowerCase()}?`;
      } else {
        const lastItem = items.pop();
        return ` ${randomPhrase} ${items.join(', ').toLowerCase()} y ${lastItem.toLowerCase()}?`;
      }
    }
    
    // 🎲 SISTEMA HÍBRIDO DE LOOT INTELIGENTE
    
    // Solo activar cuando el usuario busca/explora activamente
    if (/busco|buscar|examino|examinar|hurgo|hurgar|exploro|explorar|investigo|investigar|descubro|descubrir/.test(action.toLowerCase())) {
      console.log(`🎲 ACTIVANDO SISTEMA HÍBRIDO para acción: "${action}"`);
      
      // PASO 1: Extraer items de la narrativa existente
      const narrativeItems = extractItemsFromNarrative(narrative);
      
      if (narrativeItems.length > 0) {
        // CASO A: Hay items en la narrativa → Preguntar al jugador
        console.log(`📖 NARRATIVA CON ITEMS: Encontrados ${narrativeItems.length} items, extendiendo narrativa con decisión`);
        
        const itemChoiceText = generateItemChoiceNarrative(narrativeItems);
        narrative += itemChoiceText;
        
        console.log(`🎭 NARRATIVA EXTENDIDA: ${itemChoiceText}`);
        
      } else {
        // CASO B: No hay items → Generar loot dinámico + explicación
        console.log(`🎁 NARRATIVA SIN ITEMS: Generando loot dinámico con explicación`);
        
        const intelligentLoot = rollIntelligentLoot(gameState, action, narrative);
        
        if (intelligentLoot) {
          // Verificar anti-duplicados
          const existsInInventory = gameState.inventory.some(item => 
            item.name.toLowerCase() === intelligentLoot.name.toLowerCase()
          );
          
          if (!gameState.discoveredItems) gameState.discoveredItems = [];
          const existsInDiscovered = gameState.discoveredItems.some(item => 
            item.name.toLowerCase() === intelligentLoot.name.toLowerCase()
          );
          
          if (!existsInInventory && !existsInDiscovered) {
            // Añadir a discoveredItems (clickeable)
            gameState.discoveredItems.push(intelligentLoot);
            console.log(`🎁 LOOT DINÁMICO GENERADO (clickeable): ${intelligentLoot.name} ${intelligentLoot.icon}`);
            
            // Extender narrativa con explicación orgánica
            const explanationPhrases = [
              `Mientras rebuscas con más atención, descubres ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `Al examinar más detenidamente, encuentras ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `Durante tu búsqueda, das con ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `Tras una inspección minuciosa, localizas ${intelligentLoot.name} ${intelligentLoot.icon}`,
              `En un rincón poco visible, descubres ${intelligentLoot.name} ${intelligentLoot.icon}`
            ];
            
            const randomExplanation = explanationPhrases[Math.floor(Math.random() * explanationPhrases.length)];
            narrative += ` ${randomExplanation}.`;
            
            console.log(`📝 NARRATIVA EXTENDIDA: ${randomExplanation}`);
            console.log(`🎯 CONTEXTOS UTILIZADOS: ${intelligentLoot.contexts.join(', ')}`);
          } else {
            console.log(`⚠️ LOOT YA EXISTE: ${intelligentLoot.name}`);
          }
        }
      }
    } else {
      console.log(`🎲 Sistema híbrido no activado para: "${action}"`);
    }
