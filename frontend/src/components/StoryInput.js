// Componente aislado para input fluido sin rerenders
import { useState, useRef, useEffect, memo } from 'react';

function StoryInput({ onSubmit, loading, gameOver, placeholder = "Escribe lo que quieres que suceda..." }) {
  const [draft, setDraft] = useState('');
  const ref = useRef(null);

  // Mantiene foco siempre que el componente siga montado
  useEffect(() => {
    ref.current?.focus();
  });

  const handleSend = () => {
    if (!draft.trim() || loading || gameOver) return;
    onSubmit(draft.trim());
    setDraft('');
  };

  return (
    <div 
      className="input-group"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        rows={2}
        className="main-input clickable"
        style={{ resize: 'none' }}
        placeholder={placeholder}
        disabled={loading || gameOver}
        autoFocus
        data-no-rebuild
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      <button
        onClick={handleSend}
        disabled={loading || gameOver || !draft.trim()}
        className="action-button clickable"
        type="button"
      >
        {loading ? '...' : 'ACTUAR'}
      </button>
    </div>
  );
}

// Evita rerender salvo que cambien las props
export default memo(StoryInput);