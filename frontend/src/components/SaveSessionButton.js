import React, { useState } from 'react';

const SaveSessionButton = ({ sessionId, BACKEND_URL, compact = false }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!sessionId || saving) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/save_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Sesión guardada:', data);
      
      setSessionCode(data.sessionCode);
      setSaved(true);
      
      // Auto-hide después de 5 segundos
      setTimeout(() => setSaved(false), 5000);
      
    } catch (err) {
      console.error('Error guardando sesión:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (!sessionCode) return;
    
    try {
      await navigator.clipboard.writeText(sessionCode);
      // Mostrar feedback visual
      const button = document.getElementById('copy-code-btn');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Copiado!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Error copiando al portapapeles:', err);
    }
  };

  if (compact) {
    // Versión compacta para header
    return (
      <div className="relative">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-lg bg-[var(--cedar-brown)]/10 px-3 py-1 text-sm text-[var(--cedar-brown)] transition-all hover:bg-[var(--cedar-brown)]/20 disabled:opacity-50"
        >
          {saving ? '💾' : saved ? '✅' : '💾'}
          <span className="hidden sm:inline">
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
          </span>
        </button>
        
        {saved && sessionCode && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg bg-white border border-[var(--imperial-gold)]/30 p-3 shadow-xl">
            <div className="text-sm font-semibold text-[var(--cedar-brown)] mb-1">
              📝 Código de partida:
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-gray-100 px-2 py-1 text-xs font-mono text-[var(--cedar-brown)]">
                {sessionCode}
              </code>
              <button
                id="copy-code-btn"
                onClick={copyToClipboard}
                className="rounded bg-[var(--imperial-gold)] px-2 py-1 text-xs text-white hover:bg-[var(--imperial-gold)]/90"
              >
                📋
              </button>
            </div>
            <div className="mt-1 text-xs text-[var(--cedar-brown)]/70">
              Guarda este código para recuperar tu partida
            </div>
          </div>
        )}
      </div>
    );
  }

  // Versión completa para modales
  return (
    <div className="space-y-3">
      {/* BOTÓN GUARDAR */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-[var(--imperial-gold)] py-3 font-semibold text-white transition-all hover:bg-[var(--imperial-gold)]/90 disabled:bg-gray-400"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <div className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
            Guardando partida...
          </span>
        ) : saved ? (
          '✅ Partida guardada exitosamente'
        ) : (
          '💾 Guardar partida'
        )}
      </button>

      {/* CÓDIGO DE SESIÓN */}
      {saved && sessionCode && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="mb-2 font-semibold text-green-800">
            🎉 ¡Partida guardada exitosamente!
          </div>
          
          <div className="mb-2 text-sm text-green-700">
            Tu código de partida es:
          </div>
          
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white border border-green-300 px-3 py-2 font-mono text-lg font-bold text-green-800">
              {sessionCode}
            </code>
            <button
              id="copy-code-btn"
              onClick={copyToClipboard}
              className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              📋 Copiar
            </button>
          </div>
          
          <div className="mt-2 text-xs text-green-600">
            💡 Guarda este código en un lugar seguro. Lo necesitarás para recuperar tu partida más tarde.
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="text-sm text-red-700">
            ❌ Error al guardar: {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default SaveSessionButton;