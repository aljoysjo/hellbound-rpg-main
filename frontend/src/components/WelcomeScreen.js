import React from 'react';

const WelcomeScreen = ({ onSelect }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3E7C6] to-[#E8D5A6] flex items-center justify-center p-6">
      <div className="bg-[#F3E7C6]/90 border-2 border-[#B98746] rounded-3xl shadow-2xl backdrop-blur-lg p-10 max-w-md w-full text-center">
        
        {/* LOGO ELEGANTE */}
        <h1 
          className="text-4xl font-black tracking-wider text-[#D14438] mb-6 leading-tight drop-shadow-lg"
          style={{ 
            fontFamily: 'Cinzel, serif',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          HELLBOUND RPG
        </h1>

        {/* STATS BARS INTEGRADAS VISUALMENTE */}
        <div className="flex justify-center items-center gap-6 mb-6">
          <div className="flex items-center gap-2 bg-[#583A1D] px-4 py-3 rounded-full shadow-md">
            <span className="text-xl">❤️</span>
            <span className="text-sm font-semibold text-[#F3E7C6]">100/100</span>
          </div>
          <div className="flex items-center gap-2 bg-[#583A1D] px-4 py-3 rounded-full shadow-md">
            <span className="text-xl">⚡</span>
            <span className="text-sm font-semibold text-[#F3E7C6]">50/50</span>
          </div>
        </div>

        {/* SUBTITLE ELEGANTE */}
        <p className="text-lg font-medium text-[#583A1D] mb-8 leading-relaxed px-4">
          Choose your path in an epic adventure...
        </p>

        {/* BOTONES CON HOVER EFFECTS PROFESIONALES */}
        <div className="space-y-4">
          <button
            onClick={() => onSelect('sandbox')}
            className="w-full py-4 px-8 bg-[#D14438] text-[#F3E7C6] font-bold text-lg rounded-xl 
                       shadow-lg hover:bg-[#B83A30] hover:shadow-xl hover:-translate-y-1 
                       transition-all duration-300 ease-out transform active:scale-95"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Sandbox
          </button>
          
          <button
            onClick={() => onSelect('campaign')}
            className="w-full py-4 px-8 bg-[#B98746] text-[#F3E7C6] font-bold text-lg rounded-xl 
                       shadow-lg hover:bg-[#A67B47] hover:shadow-xl hover:-translate-y-1 
                       transition-all duration-300 ease-out transform active:scale-95"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Campaign
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;