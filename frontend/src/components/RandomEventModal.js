import React, { useState, useEffect } from 'react';
import D20Dice from './D20Dice';

const RandomEventModal = ({ event, isVisible, onComplete }) => {
  const [phase, setPhase] = useState('intro'); // intro, rolling, result, complete
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (isVisible && event) {
      setPhase('intro');
    }
  }, [isVisible, event]);

  const handleStartRoll = () => {
    setPhase('rolling');
    setIsRolling(true);
  };

  const handleRollComplete = () => {
    setPhase('result');
    setIsRolling(false);
  };

  const handleContinue = () => {
    setPhase('complete');
    onComplete && onComplete();
  };

  if (!isVisible || !event) return null;

  // 🎲 DETECTAR TIPO DE EVENTO
  const isD20Roll = event.type === 'd20_roll';
  const eventData = isD20Roll ? event : event.event;

  const getDifficultyColor = (difficulty) => {
    if (difficulty <= 10) return 'text-green-600 bg-green-50';
    if (difficulty <= 14) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getDifficultyText = (difficulty) => {
    if (difficulty <= 10) return 'Fácil';
    if (difficulty <= 14) return 'Medio';
    return 'Difícil';
  };

  const getConsequencesList = (consequences) => {
    const items = [];
    if (consequences.health) {
      items.push(`${consequences.health > 0 ? '❤️ +' : '💔 '}${consequences.health} Salud`);
    }
    if (consequences.mana) {
      items.push(`${consequences.mana > 0 ? '💙 +' : '🔵 '}${consequences.mana} Maná`);
    }
    if (consequences.stamina) {
      items.push(`${consequences.stamina > 0 ? '💚 +' : '🟢 '}${consequences.stamina} Stamina`);
    }
    if (consequences.gold) {
      items.push(`💰 +${consequences.gold} Oro`);
    }
    if (consequences.items && consequences.items.length > 0) {
      items.push(`🎁 Items: ${consequences.items.join(', ')}`);
    }
    if (consequences.skills && consequences.skills.length > 0) {
      items.push(`⭐ Habilidades: ${consequences.skills.join(', ')}`);
    }
    return items;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-amber-50 border-2 border-amber-600 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-amber-600 text-white p-4 rounded-t-md">
          <h2 className="text-xl font-bold text-center">🎲 Evento Aleatorio</h2>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Fase Intro */}
          {phase === 'intro' && (
            <>
              <div className="text-center space-y-4">
                <h3 className="text-lg font-bold text-amber-900">{event.event.title}</h3>
                <p className="text-amber-700">{event.event.description}</p>
                
                {/* Dificultad */}
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-amber-800 font-medium">Dificultad:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getDifficultyColor(event.event.difficulty)}`}>
                    {getDifficultyText(event.event.difficulty)} ({event.event.difficulty}+)
                  </span>
                </div>

                {/* Preview de consecuencias */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <h4 className="font-bold text-green-800 mb-2">✅ Si tienes éxito:</h4>
                    <ul className="space-y-1 text-green-700">
                      {getConsequencesList(event.event.success).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <h4 className="font-bold text-red-800 mb-2">❌ Si fallas:</h4>
                    <ul className="space-y-1 text-red-700">
                      {getConsequencesList(event.event.failure).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartRoll}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
              >
                🎲 Lanzar D20
              </button>
            </>
          )}

          {/* Fase Rolling */}
          {phase === 'rolling' && (
            <div className="text-center">
              <D20Dice 
                isRolling={isRolling}
                finalValue={event.roll}
                onRollComplete={handleRollComplete}
              />
            </div>
          )}

          {/* Fase Result */}
          {phase === 'result' && (
            <>
              <div className="text-center space-y-4">
                <div className={`p-4 rounded-lg border-2 ${
                  event.success 
                    ? 'bg-green-50 border-green-500 text-green-800' 
                    : 'bg-red-50 border-red-500 text-red-800'
                }`}>
                  <h3 className="text-xl font-bold mb-2">
                    {event.success ? '🎉 ¡ÉXITO!' : '💥 FRACASO'}
                  </h3>
                  <p className="text-lg">
                    Resultado: <strong>{event.roll}</strong> / {event.event.difficulty}+
                  </p>
                </div>

                {/* Narrativa del resultado */}
                <div className="bg-amber-100 border border-amber-300 rounded p-4">
                  <p className="text-amber-900 italic">"{event.narrative}"</p>
                </div>

                {/* Consecuencias aplicadas */}
                {event.appliedConsequences && (
                  <div className="bg-white border border-amber-200 rounded p-4">
                    <h4 className="font-bold text-amber-900 mb-2">📋 Consecuencias:</h4>
                    <ul className="space-y-1 text-amber-800">
                      {getConsequencesList(event.appliedConsequences).map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                onClick={handleContinue}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
              >
                ✅ Continuar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RandomEventModal;