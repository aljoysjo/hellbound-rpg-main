import React, { useState } from 'react';

const NewOnboardingFlow = ({ BACKEND_URL, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Onboarding Data
  const [worldConcept, setWorldConcept] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedThemes, setSelectedThemes] = useState([]);
  
  const [playerCount, setPlayerCount] = useState(1);
  const [dmType, setDmType] = useState('ai');
  const [adventureType, setAdventureType] = useState('sandbox');
  
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  const [character, setCharacter] = useState({
    name: '',
    archetype: '',
    background: '',
    appearance: '',
    personality: '',
    strengths: [],
    weaknesses: [],
    stats: { strength: 10, dexterity: 10, intelligence: 10, charisma: 10 }
  });

  // Templates predefinidos
  const worldTemplates = [
    { id: 'scifi', icon: '🚀', name: 'Ciencia Ficción', description: 'Exploradores espaciales en galaxia peligrosa' },
    { id: 'fantasy', icon: '🏰', name: 'Fantasía', description: 'Aventureros en reino mágico medieval' },
    { id: 'modern', icon: '🕵️', name: 'Moderno', description: 'Investigadores de casos paranormales' },
    { id: 'postapoc', icon: '🏜️', name: 'Post-Apocalíptico', description: 'Supervivientes en mundo devastado' },
    { id: 'pirate', icon: '🌊', name: 'Piratas', description: 'Piratas buscando tesoros en mares míticos' },
    { id: 'custom', icon: '⚡', name: 'Personalizado', description: 'Crea tu propio mundo único' }
  ];

  const adventureThemes = [
    { id: 'exploration', name: 'Exploración', icon: '🗺️' },
    { id: 'combat', name: 'Combate', icon: '⚔️' },
    { id: 'mystery', name: 'Misterio', icon: '🔍' },
    { id: 'social', name: 'Social', icon: '👥' },
    { id: 'survival', name: 'Supervivencia', icon: '🏕️' }
  ];

  const characterArchetypes = [
    { id: 'explorer', name: 'Explorador', description: 'Curioso y aventurero' },
    { id: 'warrior', name: 'Guerrero', description: 'Fuerte y valiente' },
    { id: 'scholar', name: 'Erudito', description: 'Inteligente y sabio' },
    { id: 'rogue', name: 'Pícaro', description: 'Ágil y astuto' },
    { id: 'mystic', name: 'Místico', description: 'Mágico y espiritual' },
    { id: 'leader', name: 'Líder', description: 'Carismático e inspirador' }
  ];

  const characterTemplates = [
    {
      name: 'Contrabandista Espacial',
      archetype: 'rogue',
      background: 'Ex-piloto militar convertido en contrabandista intergaláctico',
      appearance: 'Alto, cicatriz en la mejilla, chaqueta de cuero gastada',
      personality: 'Audaz pero calculador, leal a sus amigos',
      strengths: ['Pilotaje', 'Combate a distancia', 'Persuasión'],
      weaknesses: ['Magia', 'Tecnología avanzada', 'Autoridad']
    },
    {
      name: 'Erudito Místico',
      archetype: 'scholar',
      background: 'Investigador de artefactos mágicos en universidad arcana',
      appearance: 'Mediana estatura, lentes, túnica con símbolos místicos',
      personality: 'Curioso pero cauteloso, perfeccionista',
      strengths: ['Magia', 'Historia', 'Investigación'],
      weaknesses: ['Combate físico', 'Deportes', 'Vida social']
    },
    {
      name: 'Superviviente del Yermo',
      archetype: 'warrior',
      background: 'Nacido tras el apocalipsis, conoce las ruinas como su hogar',
      appearance: 'Musculoso, cicatrices, ropa improvisada pero funcional',
      personality: 'Directo pero protector, desconfía de extraños',
      strengths: ['Supervivencia', 'Combate cuerpo a cuerpo', 'Resistencia'],
      weaknesses: ['Tecnología pre-guerra', 'Diplomacia', 'Lectura']
    }
  ];

  const handleTemplateSelect = (template) => {
    if (template.id === 'custom') {
      setSelectedTemplate('');
      setWorldConcept('');
    } else {
      setSelectedTemplate(template.id);
      setWorldConcept(template.description);
    }
  };

  const toggleTheme = (themeId) => {
    setSelectedThemes(prev => 
      prev.includes(themeId) 
        ? prev.filter(id => id !== themeId)
        : [...prev, themeId]
    );
  };

  const applyCharacterTemplate = (template) => {
    setCharacter(prev => ({
      ...prev,
      name: template.name,
      archetype: template.archetype,
      background: template.background,
      appearance: template.appearance,
      personality: template.personality,
      strengths: template.strengths,
      weaknesses: template.weaknesses
    }));
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      // Construir concepto final del mundo
      let finalConcept = worldConcept;
      if (selectedThemes.length > 0) {
        const themeNames = selectedThemes.map(id => 
          adventureThemes.find(t => t.id === id)?.name
        ).join(', ');
        finalConcept += ` [Temas: ${themeNames}]`;
      }

      // Datos para enviar al backend
      const sessionData = {
        sandboxConcept: finalConcept,
        playerCount,
        dmType,
        adventureType,
        character
      };

      console.log('🚀 Creando sesión con datos:', sessionData);
      
      // Llamar al backend para crear sesión
      const response = await fetch(`${BACKEND_URL}/api/start_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Sesión creada exitosamente:', data);

      // Pasar datos al componente padre
      onComplete(data);

    } catch (err) {
      console.error('Error creando sesión:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-[var(--cedar-brown)] mb-2">
                🌍 Describe tu Mundo
              </h2>
              <p className="text-[var(--cedar-brown)]/70">
                ¿Qué tipo de aventura quieres vivir?
              </p>
            </div>

            {/* Templates */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {worldTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedTemplate === template.id
                      ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                      : 'border-gray-300 hover:border-[var(--imperial-gold)]/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{template.icon}</div>
                  <div className="font-semibold text-[var(--cedar-brown)]">{template.name}</div>
                  <div className="text-xs text-[var(--cedar-brown)]/70">{template.description}</div>
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                Describe tu mundo (personaliza o crea desde cero):
              </label>
              <textarea
                value={worldConcept}
                onChange={(e) => setWorldConcept(e.target.value)}
                placeholder="Ej: Piratas espaciales explorando galaxias misteriosas llenas de tesoros alienígenas..."
                className="w-full h-24 rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--imperial-gold)]/20"
              />
            </div>

            {/* Adventure themes */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                ¿Qué tipo de aventura buscas? (opcional):
              </label>
              <div className="flex flex-wrap gap-2">
                {adventureThemes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => toggleTheme(theme.id)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all ${
                      selectedThemes.includes(theme.id)
                        ? 'bg-[var(--imperial-gold)] text-white'
                        : 'bg-gray-200 text-[var(--cedar-brown)] hover:bg-gray-300'
                    }`}
                  >
                    {theme.icon} {theme.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-[var(--cedar-brown)] mb-2">
                👥 Configuración Multijugador
              </h2>
              <p className="text-[var(--cedar-brown)]/70">
                ¿Cómo quieres jugar?
              </p>
            </div>

            {/* Player count */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                Cantidad de jugadores:
              </label>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setPlayerCount(1)}
                  className={`px-4 py-2 rounded-lg ${
                    playerCount === 1 ? 'bg-[var(--imperial-gold)] text-white' : 'bg-gray-200 text-[var(--cedar-brown)]'
                  }`}
                >
                  👤 Solo
                </button>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={playerCount > 1 ? playerCount : 2}
                  onChange={(e) => setPlayerCount(Number(e.target.value))}
                  className="flex-1"
                  disabled={playerCount === 1}
                />
                <span className="text-[var(--cedar-brown)] font-semibold">
                  {playerCount > 1 ? `${playerCount} jugadores` : ''}
                </span>
              </div>
            </div>

            {/* DM Type (only if multiplayer) */}
            {playerCount > 1 && (
              <div>
                <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                  ¿Quién será el Dungeon Master?
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setDmType('ai')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      dmType === 'ai'
                        ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                        : 'border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">🤖</div>
                    <div className="font-semibold text-[var(--cedar-brown)]">IA como DM</div>
                    <div className="text-sm text-[var(--cedar-brown)]/70">
                      La IA controla todo, ustedes se divierten (Recomendado)
                    </div>
                  </button>

                  <button
                    onClick={() => setDmType('player')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      dmType === 'player'
                        ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                        : 'border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">👤</div>
                    <div className="font-semibold text-[var(--cedar-brown)]">Jugador como DM</div>
                    <div className="text-sm text-[var(--cedar-brown)]/70">
                      Uno de ustedes guía la historia
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Adventure type */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                Estructura de aventura:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setAdventureType('sandbox')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    adventureType === 'sandbox'
                      ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                      : 'border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">🌊</div>
                  <div className="font-semibold text-[var(--cedar-brown)]">Sandbox Libre</div>
                  <div className="text-sm text-[var(--cedar-brown)]/70">
                    Sin objetivos, exploramos lo que surja
                  </div>
                </button>

                <button
                  onClick={() => setAdventureType('quick')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    adventureType === 'quick'
                      ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                      : 'border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="font-semibold text-[var(--cedar-brown)]">Quick Adventure</div>
                  <div className="text-sm text-[var(--cedar-brown)]/70">
                    Historia de 20-30 minutos con objetivos
                  </div>
                </button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-[var(--cedar-brown)] mb-2">
                🏠 {playerCount > 1 ? 'Sala Multijugador' : 'Preparar Aventura'}
              </h2>
              <p className="text-[var(--cedar-brown)]/70">
                {playerCount > 1 
                  ? 'Crear sala o únete a una existente'
                  : 'Todo listo para comenzar tu aventura solo'
                }
              </p>
            </div>

            {playerCount > 1 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsJoining(false)}
                    className={`p-6 rounded-xl border-2 text-center transition-all ${
                      !isJoining
                        ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                        : 'border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🏗️</div>
                    <div className="font-semibold text-[var(--cedar-brown)]">Crear Sala</div>
                    <div className="text-sm text-[var(--cedar-brown)]/70">
                      Sé el anfitrión de la aventura
                    </div>
                  </button>

                  <button
                    onClick={() => setIsJoining(true)}
                    className={`p-6 rounded-xl border-2 text-center transition-all ${
                      isJoining
                        ? 'border-[var(--imperial-gold)] bg-[var(--imperial-gold)]/10'
                        : 'border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">🚪</div>
                    <div className="font-semibold text-[var(--cedar-brown)]">Unirse a Sala</div>
                    <div className="text-sm text-[var(--cedar-brown)]/70">
                      Únete con código de sala
                    </div>
                  </button>
                </div>

                {isJoining && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                      Código de sala:
                    </label>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="ROOM-ABC12"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--imperial-gold)]/20"
                    />
                  </div>
                )}

                {!isJoining && (
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-[var(--cedar-brown)]">
                      Al crear la sala, recibirás un código para compartir con tus amigos
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 bg-green-50 rounded-xl">
                <div className="text-4xl mb-4">🎮</div>
                <h3 className="font-semibold text-[var(--cedar-brown)] mb-2">
                  ¡Listo para la Aventura!
                </h3>
                <p className="text-[var(--cedar-brown)]/70">
                  Tu mundo está creado y tu personaje listo. ¡Hora de jugar!
                </p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-[var(--cedar-brown)] mb-2">
                🎭 Crea tu Personaje
              </h2>
              <p className="text-[var(--cedar-brown)]/70">
                Define quién eres en esta aventura
              </p>
            </div>

            {/* Character Templates */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                Templates rápidos (opcional):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {characterTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => applyCharacterTemplate(template)}
                    className="p-3 rounded-lg border border-gray-300 text-left hover:border-[var(--imperial-gold)] transition-all"
                  >
                    <div className="font-semibold text-[var(--cedar-brown)] text-sm">{template.name}</div>
                    <div className="text-xs text-[var(--cedar-brown)]/70">{template.background.substring(0, 40)}...</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Character Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                  Nombre:
                </label>
                <input
                  type="text"
                  value={character.name}
                  onChange={(e) => setCharacter(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Zara Nightblade"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none"
                />
              </div>

              {/* Archetype */}
              <div>
                <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                  Arquetipo:
                </label>
                <select
                  value={character.archetype}
                  onChange={(e) => setCharacter(prev => ({ ...prev, archetype: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] focus:border-[var(--imperial-gold)] focus:outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {characterArchetypes.map((arch) => (
                    <option key={arch.id} value={arch.id}>{arch.name} - {arch.description}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Background */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                Historia personal:
              </label>
              <textarea
                value={character.background}
                onChange={(e) => setCharacter(prev => ({ ...prev, background: e.target.value }))}
                placeholder="Ej: Ex-piloto militar convertido en contrabandista..."
                className="w-full h-20 rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none"
              />
            </div>

            {/* Appearance */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                Apariencia física:
              </label>
              <textarea
                value={character.appearance}
                onChange={(e) => setCharacter(prev => ({ ...prev, appearance: e.target.value }))}
                placeholder="Ej: Alto, cicatriz en mejilla, chaqueta de cuero..."
                className="w-full h-16 rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none"
              />
            </div>

            {/* Personality */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                Personalidad:
              </label>
              <textarea
                value={character.personality}
                onChange={(e) => setCharacter(prev => ({ ...prev, personality: e.target.value }))}
                placeholder="Ej: Audaz pero calculador, leal a sus amigos..."
                className="w-full h-16 rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none"
              />
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                  Fortalezas (separadas por comas):
                </label>
                <input
                  type="text"
                  value={character.strengths.join(', ')}
                  onChange={(e) => setCharacter(prev => ({ 
                    ...prev, 
                    strengths: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                  }))}
                  placeholder="Pilotaje, Combate, Persuasión"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-1">
                  Debilidades (separadas por comas):
                </label>
                <input
                  type="text"
                  value={character.weaknesses.join(', ')}
                  onChange={(e) => setCharacter(prev => ({ 
                    ...prev, 
                    weaknesses: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                  }))}
                  placeholder="Magia, Tecnología avanzada"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[var(--cedar-brown)] placeholder-gray-500 focus:border-[var(--imperial-gold)] focus:outline-none"
                />
              </div>
            </div>

            {/* Stats (Optional) */}
            <div>
              <label className="block text-sm font-semibold text-[var(--cedar-brown)] mb-2">
                Estadísticas (opcional):
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(character.stats).map(([stat, value]) => (
                  <div key={stat}>
                    <label className="block text-xs text-[var(--cedar-brown)] mb-1 capitalize">
                      {stat === 'strength' ? 'Fuerza' : stat === 'dexterity' ? 'Destreza' : stat === 'intelligence' ? 'Inteligencia' : 'Carisma'}
                    </label>
                    <input
                      type="range"
                      min="6"
                      max="18"
                      value={value}
                      onChange={(e) => setCharacter(prev => ({
                        ...prev,
                        stats: { ...prev.stats, [stat]: Number(e.target.value) }
                      }))}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-semibold text-[var(--cedar-brown)]">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--creamy-old)] to-[var(--light-caramel)] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[var(--cedar-brown)]">
              Paso {currentStep} de 4
            </span>
            <span className="text-sm text-[var(--cedar-brown)]/70">
              {Math.round((currentStep / 4) * 100)}% completado
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[var(--imperial-gold)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-6 shadow-lg mb-6">
          {renderStep()}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-100 border border-red-300 p-4 text-red-700">
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

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-6 py-3 rounded-lg bg-gray-300 text-gray-700 font-semibold transition-all hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 1 && !worldConcept.trim()) ||
                (currentStep === 3 && playerCount > 1 && isJoining && !roomCode.trim()) ||
                (currentStep === 4 && !character.name.trim())
              }
              className="px-6 py-3 rounded-lg bg-[var(--imperial-gold)] text-white font-semibold transition-all hover:bg-[var(--imperial-gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={loading || !character.name.trim() || !character.archetype}
              className="px-8 py-3 rounded-lg bg-[var(--cedar-brown)] text-white font-bold transition-all hover:bg-[var(--cedar-brown)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '🔄 Creando Aventura...' : '🚀 ¡Comenzar Aventura!'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewOnboardingFlow;