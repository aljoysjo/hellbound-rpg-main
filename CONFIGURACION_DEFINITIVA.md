# 🚨 CONFIGURACIÓN DEFINITIVA - NO TOCAR

## ⚠️ INSTRUCCIONES CRÍTICAS:

### 1. NUNCA CAMBIAR ESTAS URLs:
- Frontend .env: `REACT_APP_BACKEND_URL=https://bdd8441f-bc0a-4b84-9d25-f35dd5944ec5.preview.emergentagent.com`
- Backend .env: `FRONTEND_URL=https://bdd8441f-bc0a-4b84-9d25-f35dd5944ec5.preview.emergentagent.com`

### 2. HEADERS PERMITIDOS EN CORS (línea 270 server/index.js):
```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Accept']
```

### 3. HEADERS MÍNIMOS EN FRONTEND:
```javascript
headers: { 
  'Content-Type': 'application/json'
}
```

## 🔧 SI HAY PROBLEMAS DE CORS:

### Síntoma: "Request header field X is not allowed"
**Solución:** Añadir el header X a `allowedHeaders` en server/index.js línea 270

### Síntoma: "Access to fetch blocked by CORS policy"
**Verificar:**
1. Frontend .env tiene URL correcta
2. Backend permite origin del frontend
3. Headers son mínimos

## 🚀 REINICIO SEGURO:
```bash
# Backend
sudo pkill -f "node index.js" || true
cd /app/server && node index.js > server.log 2>&1 &

# Frontend  
sudo supervisorctl restart frontend

# Verificar
curl -s http://localhost:8001/api/healthcheck
```

## ❌ NO HACER NUNCA:
- ❌ Cambiar URLs en .env sin actualizar CORS
- ❌ Añadir headers innecesarios en fetch
- ❌ Modificar CORS sin entender qué headers se necesitan
- ❌ Usar URLs hardcodeadas en lugar de variables de entorno

## ✅ CONFIGURACIÓN ACTUAL FUNCIONANDO:
- ✅ Frontend: https://bdd8441f-bc0a-4b84-9d25-f35dd5944ec5.preview.emergentagent.com
- ✅ Backend: Mismo dominio, rutas /api/*
- ✅ CORS: Configurado para ambos dominios
- ✅ Headers: Mínimos y permitidos
- ✅ Timeouts: Optimizados para móviles

**Esta configuración NO debe modificarse sin una razón muy específica.**