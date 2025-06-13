// Componente aislado para input fluido sin rerenders
import { useState, useRef, memo, forwardRef, useImperativeHandle } from 'react';

const StoryInput = forwardRef(({ onSubmit, loading, gameOver, placeholder = "Escribe lo que quieres que suceda..." }, ref) => {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef(null);

  // Exponer blur al componente padre
  useImperativeHandle(ref, () => ({
    blur: () => textareaRef.current?.blur(),
    focus: () => textareaRef.current?.focus()
  }));

  const handleSend = () => {
    if (!draft.trim() || loading || gameOver) return;
    onSubmit(draft.trim());
    setDraft('');
    // Reestablecer foco después de enviar
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSend();
  };

  const handleChange = (e) => {
    // CRITICAL FIX: Input completamente limpio sin preventDefault
    setDraft(e.target.value);
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="input-group"
    >
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
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