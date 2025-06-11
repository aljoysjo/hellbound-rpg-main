import React from 'react';

const ModeSelector = ({ onSelect }) => {
  const modes = [
    {
      id: 'sandbox',
      title: 'Sandbox',
      description: 'Explora libremente sin restricciones. Crea tu propia historia.',
      icon: '🎲',
      color: 'from-purple-600 to-purple-800'
    },
    {
      id: 'campaign',
      title: 'Campaña',
      description: 'Sigue una historia estructurada con actos y objetivos definidos.',
      icon: '📖',
      color: 'from-blue-600 to-blue-800'
    },
    {
      id: 'seasonal',
      title: 'Campaña Temporal',
      description: 'Aventuras especiales por tiempo limitado con recompensas únicas.',
      icon: '⏰',
      color: 'from-orange-600 to-orange-800'
    }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-red-400 mb-6 text-center">
        Elige tu Destino
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {modes.map((mode) => (
          <div
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className={`cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
          >
            <div className={`bg-gradient-to-br ${mode.color} p-6 rounded-lg border-2 border-yellow-600 shadow-lg`}>
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{mode.icon}</div>
                <h3 className="text-xl font-bold text-white">{mode.title}</h3>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed text-center">
                {mode.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModeSelector;
