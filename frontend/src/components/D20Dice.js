import React, { useState, useEffect } from 'react';

const D20Dice = ({ isRolling, finalValue, onRollComplete }) => {
  const [currentValue, setCurrentValue] = useState(1);
  const [animationPhase, setAnimationPhase] = useState('idle'); // idle, rolling, settling, complete

  useEffect(() => {
    if (isRolling && animationPhase === 'idle') {
      startRollAnimation();
    }
  }, [isRolling]);

  const startRollAnimation = () => {
    setAnimationPhase('rolling');
    
    // Fase 1: Agitación rápida (1 segundo)
    let rollInterval = setInterval(() => {
      setCurrentValue(Math.floor(Math.random() * 20) + 1);
    }, 50);

    setTimeout(() => {
      clearInterval(rollInterval);
      setAnimationPhase('settling');
      
      // Fase 2: Ralentización gradual (1 segundo)
      let settleInterval = setInterval(() => {
        setCurrentValue(Math.floor(Math.random() * 20) + 1);
      }, 150);

      setTimeout(() => {
        clearInterval(settleInterval);
        setAnimationPhase('complete');
        setCurrentValue(finalValue);
        
        // Notificar completación después de un momento
        setTimeout(() => {
          onRollComplete && onRollComplete();
        }, 500);
      }, 1000);
    }, 1000);
  };

  const getDiceRotation = () => {
    if (animationPhase === 'rolling') {
      return `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg) rotateZ(${Math.random() * 360}deg)`;
    }
    if (animationPhase === 'settling') {
      return `rotateX(${Math.random() * 180}deg) rotateY(${Math.random() * 180}deg)`;
    }
    return 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)';
  };

  const getDiceScale = () => {
    if (animationPhase === 'rolling') return '1.2';
    if (animationPhase === 'settling') return '1.1';
    return '1';
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* Dado D20 */}
      <div className="relative mb-6">
        <div 
          className={`
            w-24 h-24 mx-auto relative transition-all duration-300 ease-out
            ${animationPhase === 'rolling' ? 'animate-bounce' : ''}
          `}
          style={{
            transform: `${getDiceRotation()} scale(${getDiceScale()})`,
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Cara del dado - Icosaedro simplificado como círculo con número */}
          <div className={`
            w-full h-full rounded-full border-4 flex items-center justify-center text-2xl font-bold
            transition-all duration-300 shadow-lg
            ${animationPhase === 'complete' && finalValue >= 15 ? 'bg-green-100 border-green-500 text-green-800' :
              animationPhase === 'complete' && finalValue <= 7 ? 'bg-red-100 border-red-500 text-red-800' :
              animationPhase === 'complete' ? 'bg-yellow-100 border-yellow-500 text-yellow-800' :
              'bg-amber-50 border-amber-600 text-amber-900'}
          `}>
            {currentValue}
          </div>
        </div>

        {/* Partículas de magia alrededor del dado */}
        {animationPhase === 'rolling' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`
                  absolute w-2 h-2 bg-amber-400 rounded-full opacity-70
                  animate-ping
                `}
                style={{
                  top: `${20 + Math.sin(i * Math.PI / 4) * 40}%`,
                  left: `${50 + Math.cos(i * Math.PI / 4) * 40}%`,
                  animationDelay: `${i * 100}ms`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Estado del dado */}
      <div className="text-center">
        {animationPhase === 'idle' && (
          <p className="text-amber-700 font-medium">🎲 Listo para lanzar</p>
        )}
        {animationPhase === 'rolling' && (
          <p className="text-amber-600 font-bold animate-pulse">🌟 Rodando...</p>
        )}
        {animationPhase === 'settling' && (
          <p className="text-amber-700 font-medium">⏳ Estableciendo...</p>
        )}
        {animationPhase === 'complete' && (
          <div className="space-y-2">
            <p className={`font-bold text-lg ${
              finalValue >= 15 ? 'text-green-700' :
              finalValue <= 7 ? 'text-red-700' :
              'text-yellow-700'
            }`}>
              🎯 Resultado: {finalValue}
            </p>
            <p className={`text-sm ${
              finalValue >= 15 ? 'text-green-600' :
              finalValue <= 7 ? 'text-red-600' :
              'text-yellow-600'
            }`}>
              {finalValue >= 15 ? '✨ ¡Éxito excepcional!' :
               finalValue <= 7 ? '💥 Fracaso crítico' :
               '⚡ Éxito parcial'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default D20Dice;