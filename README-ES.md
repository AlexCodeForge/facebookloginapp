# 🚀 Facebook Login Automation - Versión Avanzada con Gestión Completa

## 📋 Descripción

Sistema avanzado de automatización para login en Facebook con **cookies persistentes**, **cache del navegador**, **gestión de sesiones** y características humanas ultra-realistas. Incluye interfaz web moderna con gestión completa de datos y sistema de debug configurable.

## 🎯 Características Principales

### ✅ **Sistema de Cookies Persistentes**

- **Guardado automático**: Cookies se guardan por 7 días automáticamente
- **Login automático**: Reutiliza cookies para login instantáneo
- **Gestión por usuario**: Cada email tiene sus propias cookies
- **Limpieza automática**: Elimina cookies antiguas automáticamente

### ✅ **Cache del Navegador Persistente**

- **Cache por usuario**: Cada email tiene su propio directorio de cache
- **100MB de cache**: Configurado para almacenar recursos web
- **50MB de cache multimedia**: Optimizado para imágenes y videos
- **Acelera navegación**: Páginas cargan más rápido en visitas posteriores

### ✅ **Gestión Avanzada de Sesiones**

- **Sesiones persistentes**: Los navegadores NO se cierran automáticamente
- **Control manual**: Cierra sesiones cuando quieras desde la interfaz
- **Múltiples sesiones**: Mantén varios usuarios logueados simultáneamente
- **Monitoreo en tiempo real**: Ve todas las sesiones activas

### ✅ **Interfaz Web Moderna**

- **5 Pestañas organizadas**: Login, Sesiones, Cookies, Cache, Info
- **Gestión visual**: Ve y elimina cookies/cache desde la interfaz
- **Auto-actualización**: Datos se actualizan cada 30 segundos
- **Diseño responsive**: Funciona en móvil y escritorio

### ✅ **Tecleo Súper Humano**

- **Velocidad optimizada**: 200-400ms por carácter (más rápido pero humano)
- **Tecleo súper lento**: Opción de 800-1200ms para casos especiales
- **Variación natural**: Delays aleatorios entre caracteres
- **Pausas de pensamiento**: Simula reflexión humana

### ✅ **Emulación de Dispositivo Móvil**

- **Android 14**: Emula moto e14 con Chrome 137
- **User Agent realista**: Headers HTTP completamente auténticos
- **Viewport táctil**: 412x915 con soporte táctil completo
- **Headers móviles**: Sec-CH-UA-Mobile, Accept-Language español

### ✅ **Anti-Detección Avanzada**

- **Flags de evasión**: --disable-blink-features=AutomationControlled
- **Headers realistas**: Sec-CH-UA, Accept-Language, DNT
- **Comportamiento humano**: Movimientos naturales y delays variables
- **Cache persistente**: Simula uso normal del navegador

### ✅ **Soporte Completo para 2FA**

- **Detección automática**: Identifica cuando se requiere 2FA
- **Interfaz web**: Campo dedicado para código de 6 dígitos
- **Múltiples selectores**: Compatible con diferentes versiones de Facebook
- **Sesión abierta**: Página permanece abierta para ingreso manual

### ✅ **Sistema de Debug Configurable**

- **Variable de control**: DEBUG_ENABLED para habilitar/deshabilitar
- **Screenshots automáticos**: Captura cada etapa del proceso
- **Análisis de elementos**: Inventario completo de inputs/botones
- **HTML completo**: Página completa guardada para análisis
- **Archivos organizados**: Timestamped en carpeta `debug/`

## 📦 Instalación

```bash
# 1. Clonar o descargar el proyecto
cd fb-playwright-nodejs

# 2. Instalar dependencias
npm install

# 3. Instalar navegadores de Playwright
npx playwright install chromium

# 4. Iniciar el servidor
npm start
```

## 🚀 Uso

### **Método 1: Interfaz Web Completa**

1. Abrir navegador en `http://localhost:3000`
2. **Pestaña Login**: Completar email y contraseña
3. **Login automático**: Si hay cookies, login instantáneo
4. **Pestaña Sesiones**: Ver y cerrar sesiones activas
5. **Pestaña Cookies**: Gestionar cookies guardadas
6. **Pestaña Cache**: Monitorear cache del navegador
7. **Pestaña Info**: Ver documentación y endpoints

### **Método 2: API REST Completa**

#### Login con cookies persistentes:

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu_email@ejemplo.com",
    "password": "tu_contraseña"
  }'
```

#### Ver sesiones activas:

```bash
curl "http://localhost:3000/sessions"
```

#### Ver cookies guardadas:

```bash
curl "http://localhost:3000/cookies"
```

#### Ver información de cache:

```bash
curl "http://localhost:3000/cache"
```

#### Cerrar sesión específica:

```bash
curl -X POST http://localhost:3000/close-session \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "email@ejemplo.com-1234567890"}'
```

#### Eliminar cookies y cache de un usuario:

```bash
curl -X DELETE "http://localhost:3000/cookies/tu_email@ejemplo.com"
```

#### Limpiar cookies antiguas:

```bash
curl -X POST http://localhost:3000/clean-cookies
```

## 📊 Estructura de Archivos

```
fb-playwright-nodejs/
├── server.js              # Servidor principal con toda la lógica
├── helpers.js             # Funciones auxiliares (cookies, tecleo, debug)
├── package.json           # Dependencias y configuración
├── public/
│   └── index.html         # Interfaz web moderna con 5 pestañas
├── cookies/               # Cookies y sesiones persistentes
│   ├── email_cookies.json # Cookies del navegador
│   └── email_session.json # localStorage y sessionStorage
├── cache/                 # Cache del navegador por usuario
│   └── email_directory/   # Directorio de cache específico
├── debug/                 # Archivos de debug (configurable)
│   ├── timestamp_inicial_screenshot.png
│   ├── timestamp_inicial_snapshot.json
│   ├── timestamp_post-login_screenshot.png
│   └── timestamp_error_screenshot.png
└── README-ES.md          # Esta documentación
```

## 🔧 Configuración Avanzada

### **Habilitar/Deshabilitar Debug**

```javascript
// En server.js línea ~7
const DEBUG_ENABLED = true; // ✅ Debug activo
const DEBUG_ENABLED = false; // ❌ Debug deshabilitado
```

### **Modificar Tiempo de Cookies**

```javascript
// En helpers.js - función loadCookies
const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días (default)
const maxAge = 1 * 24 * 60 * 60 * 1000; // 1 día
const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días
```

### **Configurar Tamaño de Cache**

```javascript
// En server.js - función createPersistentContext
'--disk-cache-size=100000000',  // 100MB (default)
'--disk-cache-size=200000000',  // 200MB
'--media-cache-size=50000000',  // 50MB multimedia (default)
```

### **Cambiar Velocidad de Tecleo**

```javascript
// En helpers.js - función typeOptimized
await page.keyboard.type(char, { delay: randomDelay(200, 400) }); // Rápido
await page.keyboard.type(char, { delay: randomDelay(800, 1200) }); // Lento
```

### **Modificar User Agent**

```javascript
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; moto e14 Build/ULB34.66-116) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/137.0.7151.61 Mobile Safari/537.36";
```

## 🛠️ Solución de Problemas

### **❌ Error: "No se pudo encontrar el campo de email"**

- **Causa**: Facebook cambió sus selectores
- **Solución**:
  1. Verificar archivos de debug en `debug/` (si DEBUG_ENABLED = true)
  2. Actualizar selectores en helpers.js SELECTORS.email

### **❌ Login muy lento**

- **Causa**: Tecleo súper lento activado
- **Solución**: Usar typeOptimized en lugar de typeSlowHuman

### **❌ Cache no se llena**

- **Causa**: user-data-dir no configurado correctamente
- **Solución**: Verificar que los directorios en cache/ tengan archivos después del login

### **⚠️ Cookies no persisten**

- **Causa**: Error guardando cookies
- **Solución**:
  1. Verificar permisos de escritura en carpeta cookies/
  2. Revisar logs del servidor para errores

### **📱 Interfaz no se actualiza**

- **Causa**: JavaScript deshabilitado o error de red
- **Solución**:
  1. Refrescar página (F5)
  2. Verificar consola del navegador (F12)

## 📈 Análisis de Datos

### **Gestión de Cookies**

La interfaz muestra:

- **📧 Email**: Usuario de las cookies
- **📁 Archivos**: Cantidad de archivos (cookies + sesión)
- **🍪 Cookies**: Tamaño del archivo de cookies
- **💾 Sesión**: Tamaño del archivo de sesión
- **⏰ Edad**: Tiempo desde la creación
- **🗑️ Eliminar**: Botón para eliminar todo

### **Monitoreo de Cache**

La interfaz muestra:

- **📊 Resumen**: Total de usuarios, tamaño y archivos
- **📧 Por usuario**: Cache individual de cada email
- **📅 Fechas**: Creación y última actividad
- **💾 Tamaño**: En MB con código de colores:
  - 🟢 Normal (< 50MB)
  - 🟠 Vacío (0 archivos)
  - 🔴 Grande (> 50MB)

### **Control de Sesiones**

La interfaz muestra:

- **📧 Email**: Usuario de la sesión
- **📅 Creada**: Cuándo se inició la sesión
- **⏰ Tiempo activo**: Cuánto tiempo lleva abierta
- **🗑️ Cerrar**: Botón para cerrar manualmente

## 🔒 Seguridad y Privacidad

### **Datos Guardados Localmente**

- ✅ **Cookies**: Guardadas en `cookies/` por 7 días
- ✅ **Cache**: Guardado en `cache/` por usuario
- ✅ **Screenshots**: Solo si DEBUG_ENABLED = true
- ❌ **Contraseñas**: NUNCA se guardan
- ❌ **Códigos 2FA**: Solo se procesan en memoria

### **Recomendaciones de Seguridad**

1. **Deshabilitar debug** en producción: `DEBUG_ENABLED = false`
2. **No compartir** archivos de `cookies/` ni `cache/`
3. **Limpiar regularmente** datos antiguos usando la interfaz
4. **Usar cuentas de prueba** para desarrollo
5. **Revisar permisos** de carpetas de datos

## 🚨 Limitaciones y Consideraciones

### **Limitaciones Técnicas**

- ⚠️ **Rate Limiting**: Facebook puede limitar intentos frecuentes
- ⚠️ **Espacio en disco**: Cache puede crecer considerablemente
- ⚠️ **Memoria RAM**: Múltiples sesiones consumen más memoria
- ⚠️ **Cambios de UI**: Facebook actualiza constantemente su interfaz

### **Uso Responsable**

- ✅ **Solo cuentas propias**: No usar en cuentas ajenas
- ✅ **Fines educativos**: Ideal para aprender automatización
- ✅ **Respeto a ToS**: Cumplir términos de servicio de Facebook
- ✅ **Gestión de recursos**: Cerrar sesiones innecesarias
- ❌ **No spam**: No usar para actividades maliciosas

## 📞 Soporte y Logs

### **Logs del Servidor**

El servidor muestra información completa:

```
🚀 ====================================
🚀   FACEBOOK LOGIN AUTOMATION
🚀   VERSIÓN CON COOKIES PERSISTENTES
🚀 ====================================
🌐 Servidor: http://localhost:3000
📊 Debug: /ruta/debug ✅ ACTIVO
🍪 Cookies: /ruta/cookies
💾 Cache: /ruta/cache
🚀 ====================================
⚡ Características activas:
   ✅ Cookies persistentes (7 días)
   ✅ Cache del navegador
   ✅ Sesiones que NO se cierran
   ✅ Restauración de localStorage
   ✅ Login automático con cookies
   ✅ Gestión manual de sesiones
   ✅ Debug y capturas de pantalla
🚀 ====================================
📖 Endpoints disponibles:
   POST /login - Login con cookies
   GET /sessions - Ver sesiones activas
   POST /close-session - Cerrar sesión
   GET /cookies - Listar cookies guardadas
   GET /cache - Ver información de cache
   DELETE /cookies/:email - Eliminar datos
   POST /clean-cookies - Limpiar cookies
🚀 ====================================
```

### **Estados de Operación**

- **🍪 Cookies guardadas**: Login exitoso con cookies persistentes
- **🔄 Login automático**: Usando cookies existentes
- **💾 Cache configurado**: Directorio de cache creado
- **🔐 2FA requerido**: Página permanece abierta para código
- **❌ Debug deshabilitado**: DEBUG_ENABLED = false

## 🎨 Personalización de la Interfaz

### **Colores por Pestaña**

```css
/* Login - Azul Facebook */
.login-tab {
  --color: #4267b2;
}

/* Sesiones - Gris */
.sessions-panel {
  background: #e9ecef;
}

/* Cookies - Naranja */
.cookies-panel {
  background: #fff8e1;
}

/* Cache - Verde */
.cache-panel {
  background: #e8f5e8;
}
```

### **Modificar Auto-refresh**

```javascript
// Cambiar intervalo de actualización (default: 30 segundos)
setInterval(() => {
  // Lógica de actualización
}, 60000); // 60 segundos
```

## 📚 API Endpoints Completos

### **POST /login**

- **Descripción**: Login con cookies persistentes
- **Body**: `{"email": "...", "password": "..."}`
- **Respuesta**: `{"success": true, "sessionId": "...", "usedSavedCookies": true}`

### **GET /sessions**

- **Descripción**: Lista sesiones activas
- **Respuesta**: `{"count": 2, "sessions": [...]}`

### **GET /cookies**

- **Descripción**: Lista cookies guardadas con detalles
- **Respuesta**: `{"count": 3, "cookies": [...]}`

### **GET /cache**

- **Descripción**: Información de cache del navegador
- **Respuesta**: `{"count": 2, "totalSize": 1024000, "caches": [...]}`

### **POST /close-session**

- **Descripción**: Cierra sesión específica
- **Body**: `{"sessionId": "email@ejemplo.com-1234567890"}`
- **Respuesta**: `{"success": true, "message": "..."}`

### **DELETE /cookies/:email**

- **Descripción**: Elimina cookies, sesión y cache de un usuario
- **Parámetro**: email del usuario
- **Respuesta**: `{"success": true, "filesDeleted": 3}`

### **POST /clean-cookies**

- **Descripción**: Limpia cookies antiguas (>7 días)
- **Respuesta**: `{"success": true, "message": "..."}`

### **GET /debug** (solo si DEBUG_ENABLED = true)

- **Descripción**: Acceso a archivos de debug
- **Respuesta**: Archivos estáticos de debug

---

## 🏆 Créditos

**Versión Avanzada con Gestión Completa** - Sistema integral de automatización con persistencia de datos, gestión visual y control total de sesiones.

**Características Principales**:

- ✅ **Cookies Persistentes** - Login automático por 7 días
- ✅ **Cache del Navegador** - Navegación más rápida
- ✅ **Gestión de Sesiones** - Control manual de navegadores
- ✅ **Interfaz Moderna** - 5 pestañas organizadas
- ✅ **Debug Configurable** - Sistema de debug opcional
- ✅ **API Completa** - 8 endpoints para gestión total

---

_Desarrollado con ❤️ para la comunidad de automatización web - Versión 2024 con gestión completa de datos_
