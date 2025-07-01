// Configuración mejorada para móviles - timeout más largo y mejor manejo de errores
const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...options.headers
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('La conexión tardó demasiado tiempo. Intenta de nuevo.');
    }
    throw error;
  }
};

// Reemplazar la llamada fetch en startNewSession
const response = await fetchWithTimeout(endpoint, {
  method: 'POST',
  body: JSON.stringify(requestBody)
}, 60000); // 60 segundos timeout para móviles
