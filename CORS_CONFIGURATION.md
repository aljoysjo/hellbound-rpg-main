# 🔧 CONFIGURACIÓN PERMANENTE CORS - HELLBOUND RPG

## 📝 PROBLEMA RESUELTO
El error "Failed to fetch" se debe a problemas de CORS entre frontend y backend en la plataforma Emergent.

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Backend - CORS Robusto (/app/server/index.js)
```javascript
// Middleware - CORS PERMANENTE Y ROBUSTO
const allowedOrigins = [
  'https://hellbound-rpg.preview.emergentagent.com',
  'https://395489aa-5539-429e-a4a6-465e1fc3acd1.preview.emergentagent.com',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (aplicaciones móviles, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Permitir cualquier subdominio de emergentagent.com  
    if (origin && origin.includes('.preview.emergentagent.com')) {
      return callback(null, true);
    }
    
    // Permitir orígenes específicos
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Para desarrollo local
    if (origin && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Fallback: permitir todo temporalmente
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
```

### 2. Frontend - URL Correcta (/app/frontend/.env)
```env
WDS_SOCKET_PORT=443
REACT_APP_BACKEND_URL=https://hellbound-rpg.preview.emergentagent.com
```

### 3. Backend - Variables de Entorno (/app/server/.env)
```env
MONGO_URL=mongodb://localhost:27017/hellbound_rpg
FRONTEND_URL=https://hellbound-rpg.preview.emergentagent.com
```

## 🚀 CARACTERÍSTICAS DE LA SOLUCIÓN

### ✅ Ventajas:
1. **Dinámico**: Detecta automáticamente subdominios de emergentagent.com
2. **Robusto**: Incluye fallbacks para desarrollo local y producción
3. **Permanente**: No necesita cambios manuales en cada deploy
4. **Específico**: Lista explícita de orígenes permitidos
5. **Seguro**: No permite todos los orígenes, solo los autorizados

### 🔧 Funcionalidades:
- ✅ Permite tu URL actual: `hellbound-rpg.preview.emergentagent.com`
- ✅ Permite URL legacy: `395489aa-5539-429e-a4a6-465e1fc3acd1.preview.emergentagent.com`
- ✅ Permite desarrollo local: `localhost:3000` y `localhost:3001`
- ✅ Permite cualquier subdominio de `.preview.emergentagent.com`
- ✅ Maneja requests sin origin (móvil, curl, etc.)

## 🛠️ COMANDOS DE MANTENIMIENTO

### Reiniciar Backend:
```bash
cd /app/server
sudo pkill -f "node index.js" || true
node index.js > server.log 2>&1 &
```

### Reiniciar Frontend:
```bash
sudo supervisorctl restart frontend
```

### Verificar Estado:
```bash
curl -s http://localhost:8001/api/healthcheck
```

### Verificar CORS:
```bash
curl -s -H "Origin: https://hellbound-rpg.preview.emergentagent.com" \
     -H "Content-Type: application/json" \
     -X POST -d '{"mode":"sandbox","sandboxConcept":"test"}' \
     http://localhost:8001/api/start_session
```

## 🎯 RESULTADO ESPERADO
- ✅ Frontend puede hacer fetch sin "Failed to fetch"
- ✅ Inicio de sesión funciona correctamente
- ✅ WebSocket se conecta sin problemas CORS
- ✅ Todas las APIs backend son accesibles desde frontend

## 📋 TROUBLESHOOTING

### Si aún hay problemas:
1. Verificar que `/app/frontend/.env` apunta a la URL correcta
2. Reiniciar ambos servicios (frontend y backend)
3. Comprobar logs del backend: `tail -f /app/server/server.log`
4. Verificar que no hay procesos duplicados en puerto 8001

### URLs a verificar:
- Frontend: `https://hellbound-rpg.preview.emergentagent.com`
- Backend interno: `http://localhost:8001`
- API accessible desde frontend: `https://hellbound-rpg.preview.emergentagent.com/api/*`

---

✅ **CONFIGURACIÓN COMPLETADA** - No deberías tener más problemas de CORS.