import React, { useState } from 'react';

// 🎯 COMPONENTE SIMPLIFICADO - SIN FORWARDREF, SIN FOCUS AUTOMÁTICO
const StoryInput = ({ onSubmit, loading, gameOver, placeholder = "Escribe lo que quieres que suceda..." }) => {
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    console.log('📝 StoryInput handleSend llamado:', { 
      draft: draft.trim(), 
      draftLength: draft.trim().length,
      loading, 
      gameOver,
      onSubmit: typeof onSubmit
    });
    
    if (!draft.trim() || loading || gameOver) {
      console.log('❌ StoryInput: Bloqueado envío:', {
        noDraft: !draft.trim(),
        loading,
        gameOver
      });
      return;
    }
    
    console.log('✅ StoryInput: Enviando acción:', draft.trim());
    onSubmit(draft.trim());
    setDraft('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-group">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        className="main-input clickable"
        style={{ 
          resize: 'none',
          width: '100%',
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: '14px'
        }}
        placeholder={placeholder}
        disabled={loading || gameOver}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </form>
  );
};

export default StoryInput;