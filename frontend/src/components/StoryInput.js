// Componente aislado para input fluido sin rerenders
import { useState, useRef, useEffect, memo, forwardRef, useImperativeHandle } from 'react';

const StoryInput = forwardRef(({ onSubmit, loading, gameOver, placeholder = "Escribe lo que quieres que suceda..." }, ref) => {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef(null);

  // Exponer blur al componente padre
  useImperativeHandle(ref, () => ({
    blur: () => textareaRef.current?.blur(),
    focus: () => textareaRef.current?.focus()
  }));

  // Mantiene foco siempre que el componente siga montado
  useEffect(() => {
    textareaRef.current?.focus();
  });

  const handleSend = () => {
    if (!draft.trim() || loading || gameOver) return;
    onSubmit(draft.trim());
    setDraft('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="input-group"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
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
    </form>
  );
});

StoryInput.displayName = 'StoryInput';

// Evita rerender salvo que cambien las props
export default memo(StoryInput);