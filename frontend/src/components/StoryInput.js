import { useState, useRef, memo, forwardRef, useImperativeHandle, useEffect } from 'react';

const StoryInput = forwardRef(({ onSubmit, loading, gameOver, placeholder = "Escribe lo que quieres que suceda..." }, ref) => {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef(null);

  // Exponer blur y focus al componente padre
  useImperativeHandle(ref, () => ({
    blur: () => textareaRef.current?.blur(),
    focus: () => textareaRef.current?.focus()
  }));

  // Asegurar foco inicial
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

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
    
    // Enfocar después de enviar
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        console.log('🎯 StoryInput: Foco restaurado al textarea');
      }
    }, 100);
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
        ref={textareaRef}
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
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </form>
  );
});

StoryInput.displayName = 'StoryInput';

export default memo(StoryInput);