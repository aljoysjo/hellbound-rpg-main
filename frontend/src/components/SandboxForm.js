import React, { useState } from 'react';

const SandboxForm = ({ onSubmit, loading, onBack }) => {
  const [concept, setConcept] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (concept.trim() && !loading) {
      onSubmit(concept.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F3E7C6] to-[#E8D5A6] flex items-center justify-center p-6">
      <div className="bg-[#F3E7C6]/90 border-2 border-[#B98746] rounded-3xl shadow-2xl backdrop-blur-lg p-10 max-w-lg w-full">
        
        {/* TÍTULO EN ESPAÑOL */}
        <h2 
          className="text-3xl font-bold text-[#D14438] mb-4 text-center"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          Modo Sandbox - Historia Libre
        </h2>
        
        <p className="text-[#583A1D] mb-8 text-center text-lg leading-relaxed">
          Describe la historia que quieres vivir.
        </p>
        
        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Ejemplo: 'Detective paranormal investigando desapariciones'..."
            disabled={loading}
            rows={5}
            className="w-full p-4 border-2 border-[#B98746] rounded-xl bg-[#F3E7C6]/80 
                       text-[#583A1D] placeholder:text-[#583A1D]/60 
                       focus:outline-none focus:ring-4 focus:ring-[#D14438]/30 focus:border-[#D14438]
                       transition-all duration-300 resize-none"
            style={{ fontFamily: 'Cormorant Garamond, serif' }}
            required
            minLength={20}
          />
          
          {/* BOTONES EN ESPAÑOL */}
          <button
            type="submit"
            disabled={loading || concept.trim().length < 20}
            className="w-full py-4 px-8 bg-[#D14438] text-[#F3E7C6] font-bold text-lg rounded-xl 
                       shadow-lg hover:bg-[#B83A30] hover:shadow-xl hover:-translate-y-1 
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none
                       transition-all duration-300 ease-out transform active:scale-95"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {loading ? 'Creando historia...' : 'Comenzar Aventura'}
          </button>
          
          <button
            type="button"
            onClick={onBack}
            className="w-full py-3 px-6 bg-transparent text-[#583A1D] border-2 border-[#583A1D] 
                       rounded-xl hover:bg-[#583A1D] hover:text-[#F3E7C6] 
                       transition-all duration-300 ease-out transform active:scale-95"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Volver
          </button>
        </form>
      </div>
    </div>
  );
};

export default SandboxForm;