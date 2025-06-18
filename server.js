const express = require('express');
const bodyParser = require('body-parser');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Importar helpers con nuevas funciones de cookies
const {
    sleep,
    randomDelay,
    typeOptimized,
    createDebugSnapshot,
    SELECTORS,
    findElement,
    detectFacebookVersion,
    getSelectorsForVersion,
    handleLoadingPage,
    handleSaveLoginDialog,
    waitForLoginButton,
    checkLoginSuccess,
    checkFor2FA,
    saveCookies,
    loadCookies,
    saveSessionState,
    restoreSessionState,
    cleanOldSessions
} = require('./helpers');

const app = express();
const port = 3000;

// 🔧 CONFIGURACIÓN DE DEBUG
// Cambiar a false para deshabilitar completamente el debug
const DEBUG_ENABLED = true;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración móvil
const MOBILE_USER_AGENT = 
  'Mozilla/5.0 (Linux; Android 14; moto e14 Build/ULB34.66-116) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/137.0.7151.61 Mobile Safari/537.36';

// Configuración desktop
const DESKTOP_USER_AGENT = 
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/137.0.7151.61 Safari/537.36';

const EXTRA_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
  'Sec-CH-UA': '"Chromium";v="137", "Not A(Brand";v="99", "Google Chrome";v="137"',
  'Sec-CH-UA-Mobile': '?1',
  'Sec-CH-UA-Platform': '"Android"'
};

const MOBILE_VIEWPORT = { 
  width: 412, 
  height: 915, 
  deviceScaleFactor: 2,
  isMobile: true, 
  hasTouch: true 
};

const DESKTOP_VIEWPORT = { 
  width: 1366, 
  height: 768, 
  deviceScaleFactor: 1,
  isMobile: false, 
  hasTouch: false 
};

// Directorios
const DEBUG_DIR = path.join(__dirname, 'debug');
const COOKIES_DIR = path.join(__dirname, 'cookies');
const CACHE_DIR = path.join(__dirname, 'cache');

[DEBUG_DIR, COOKIES_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Estados globales para sesiones persistentes
const activeSessions = Object.create(null);

// Almacenar sesiones que esperan 2FA
const pending2FASessions = new Map();

// Limpiar sesiones antiguas al iniciar
cleanOldSessions(COOKIES_DIR, 168); // 7 días

/**
 * Crea contexto con cookies persistentes
 * @param {string} email - Email del usuario
 * @param {string} version - 'mobile' o 'desktop'
 * @returns {Object} - Contexto y datos de cookies
 */
async function createPersistentContext(email, version = 'mobile') {
    console.log(`🍪 Creando contexto persistente ${version} para: ${email}`);
    
    // Cargar cookies existentes
    const savedCookies = loadCookies(email, COOKIES_DIR);
    
    // Configurar cache persistente por usuario
    const cacheDir = path.join(CACHE_DIR, `${email.replace(/[@.]/g, '_')}_${version}`);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Configurar opciones según la versión
    const isMobile = version === 'mobile';
    const contextOptions = {
        headless: false,
        slowMo: 300,
        userAgent: isMobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
        viewport: isMobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
        extraHTTPHeaders: {
            ...EXTRA_HEADERS,
            'Sec-CH-UA-Mobile': isMobile ? '?1' : '?0',
            'Sec-CH-UA-Platform': isMobile ? '"Android"' : '"Windows"'
        },
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disk-cache-size=100000000', // 100MB cache
            '--media-cache-size=50000000'   // 50MB media cache
        ],
        // Restaurar cookies si existen
        storageState: savedCookies ? {
            cookies: savedCookies.cookies,
            origins: []
        } : undefined
    };
    
    // Usar launchPersistentContext para cache persistente
    const context = await chromium.launchPersistentContext(cacheDir, contextOptions);
    
    console.log(`💾 Cache del navegador ${version} configurado en: ${cacheDir}`);
    
    // Obtener el browser desde el contexto
    const browser = context.browser();
    
    return { browser, context, savedCookies, cacheDir, version };
}

/**
 * Intenta login con una versión específica de Facebook
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña (opcional para quick login)
 * @param {string} version - 'mobile' o 'desktop'
 * @param {boolean} quickLogin - Si es login rápido (solo cookies)
 * @returns {Object} - Resultado del login
 */
async function attemptLoginWithVersion(email, password, version, quickLogin = false) {
    const sessionId = `${quickLogin ? 'quick-' : ''}${email}-${version}-${Date.now()}`;
    
    try {
        console.log(`🚀 Intentando login ${version} ${quickLogin ? '(rápido)' : '(completo)'} para ${email}...`);
        
        if (quickLogin && !loadCookies(email, COOKIES_DIR)) {
            return {
                success: false,
                sessionId: null,
                message: `No hay cookies guardadas para ${email}. Usa login normal primero.`,
                error: 'NO_COOKIES',
                version
            };
        }
        
        let browser, context, savedCookies, cacheDir, page;
        
        if (quickLogin) {
            // Para quick login, usar contexto persistente con cookies
            const persistentData = await createPersistentContext(email, version);
            browser = persistentData.browser;
            context = persistentData.context;
            savedCookies = persistentData.savedCookies;
            cacheDir = persistentData.cacheDir;
            page = await context.newPage();
        } else {
            // Para login normal, crear contexto completamente fresco
            console.log(`🆕 Creando contexto fresco para login normal ${version}...`);
            
            const isMobile = version === 'mobile';
            browser = await chromium.launch({
                headless: false,
                slowMo: 300,
                args: [
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
            
            context = await browser.newContext({
                userAgent: isMobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
                viewport: isMobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
                extraHTTPHeaders: {
                    ...EXTRA_HEADERS,
                    'Sec-CH-UA-Mobile': isMobile ? '?1' : '?0',
                    'Sec-CH-UA-Platform': isMobile ? '"Android"' : '"Windows"'
                }
            });
            
            page = await context.newPage();
            savedCookies = null; // No hay cookies guardadas para contexto fresco
            cacheDir = null; // No hay cache para contexto fresco
        }
        
        // Guardar sesión activa
        activeSessions[sessionId] = { 
            browser, 
            context, 
            page, 
            email, 
            password: quickLogin ? null : password,
            cacheDir,
            version,
            createdAt: new Date(),
            quickLogin
        };
        
        // Elegir URL según versión
        const facebookUrl = version === 'mobile' ? 'https://m.facebook.com/' : 'https://www.facebook.com/';
        
        // Solo intentar acceso directo con cookies si es quick login o hay cookies guardadas
        if (quickLogin && savedCookies) {
            console.log(`🍪 Intentando acceso directo con cookies + cache ${version}...`);
            
            try {
                await page.goto(facebookUrl, { waitUntil: 'domcontentloaded' });
                await sleep(2000);
                
                // Restaurar estado de sesión
                await restoreSessionState(page, email, COOKIES_DIR);
                await sleep(1000);
                
                // Manejar posible diálogo de guardar login
                await handleSaveLoginDialog(page);
                
                // Verificar si ya estamos logueados
                if (await checkLoginSuccess(page)) {
                    console.log(`🎉 ¡Login exitoso usando cookies + cache ${version}!`);
                    
                    // Actualizar cookies SOLO si realmente se usaron cookies guardadas
                    await saveCookies(context, email, COOKIES_DIR);
                    await saveSessionState(context, page, email, COOKIES_DIR);
                    
                    return {
                        success: true,
                        sessionId: sessionId,
                        message: `¡Login exitoso usando cookies + cache ${version}! Página permanece abierta.`,
                        usedSavedData: true,
                        version,
                        quickLogin
                    };
                }
            } catch (error) {
                console.log(`⚠️ Error con cookies + cache ${version}, procediendo con login normal...`);
            }
        }
        
        // Si es quick login y llegamos aquí, falló
        if (quickLogin) {
            await browser.close();
            delete activeSessions[sessionId];
            
            return {
                success: false,
                sessionId: null,
                message: `Quick login ${version} falló para ${email}. Las cookies pueden haber expirado.`,
                error: 'QUICK_LOGIN_FAILED',
                version
            };
        }
        
        // Login normal - SIEMPRE entrar credenciales
        console.log(`📱 Navegando a Facebook ${version} para login normal con credenciales...`);
        await page.goto(facebookUrl, { waitUntil: 'domcontentloaded' });
        await sleep(randomDelay(1000, 1500));
        

        
        if (DEBUG_ENABLED) {
            await createDebugSnapshot(page, `inicial-${version}`, DEBUG_DIR);
        }
        
        // Obtener selectores según la versión detectada
        const selectors = await getSelectorsForVersion(page);
        
        // Buscar y llenar email
        console.log(`📧 Buscando campo de email ${version}...`);
        const emailField = await findElement(page, selectors.email, 'campo de email');
        if (!emailField) {
            throw new Error(`No se pudo encontrar el campo de email en versión ${version}`);
        }
        
        await typeOptimized(page, selectors.email[0], email);
        
        // Buscar y llenar contraseña
        console.log(`🔒 Buscando campo de contraseña ${version}...`);
        const passwordField = await findElement(page, selectors.password, 'campo de contraseña');
        if (!passwordField) {
            throw new Error(`No se pudo encontrar el campo de contraseña en versión ${version}`);
        }
        
        await typeOptimized(page, selectors.password[0], password);
        
        // Esperar a que el botón de login esté listo
        console.log(`🚀 Esperando botón de login ${version} listo...`);
        const loginButton = await waitForLoginButton(page, 15000);
        if (!loginButton) {
            console.log(`❌ Botón de login ${version} no encontrado, creando debug...`);
            if (DEBUG_ENABLED) {
                await createDebugSnapshot(page, `no-login-button-${version}`, DEBUG_DIR);
            }
            throw new Error(`No se pudo encontrar el botón de login en versión ${version}`);
        }
        
        console.log(`⏳ Haciendo click en login ${version}...`);
        await sleep(randomDelay(500, 800));
        await loginButton.click({ force: true });
        console.log('✅ Click realizado');
        
        // Esperar respuesta y manejar posibles diálogos
        await sleep(3000);
        
        // Manejar diálogo de guardar login si aparece
        await handleSaveLoginDialog(page);
        
        // Verificar 2FA
        if (await checkFor2FA(page)) {
            console.log(`🔐 Se requiere 2FA ${version} - esperando código del usuario...`);
            
            // Crear debug snapshot para 2FA
            if (DEBUG_ENABLED) {
                await createDebugSnapshot(page, `2fa-detected-${version}`, DEBUG_DIR);
                console.log(`📸 Debug snapshot creado para 2FA detectado - ${version}`);
            }
            
            // Crear una promesa que se resolverá cuando se envíe el código 2FA
            return new Promise((resolve, reject) => {
                // Guardar la sesión pendiente de 2FA
                pending2FASessions.set(sessionId, {
                    page,
                    email,
                    version,
                    timestamp: new Date(),
                    resolve,
                    reject
                });
                
                console.log(`💭 Sesión ${sessionId} esperando código 2FA...`);
                
                // No resolver inmediatamente - esperar a que el usuario envíe el código
                // La promesa se resolverá en el endpoint /submit-2fa
                
                // Timeout opcional (30 minutos)
                setTimeout(() => {
                    if (pending2FASessions.has(sessionId)) {
                        pending2FASessions.delete(sessionId);
                        reject(new Error('Timeout esperando código 2FA (30 minutos)'));
                    }
                }, 30 * 60 * 1000);
            });
        }
        
        if (DEBUG_ENABLED) {
            await createDebugSnapshot(page, `post-login-${version}`, DEBUG_DIR);
        }
        
        // Verificar éxito del login
        if (await checkLoginSuccess(page)) {
            console.log(`🎉 ¡Login ${version} exitoso con credenciales!`);
            
            // Guardar cookies y estado de sesión SOLO DESPUÉS del login exitoso
            await saveCookies(context, email, COOKIES_DIR);
            await saveSessionState(context, page, email, COOKIES_DIR);
            
            // Si es un contexto fresco, ahora crear el cache persistente para futuros quick logins
            if (!quickLogin && !cacheDir) {
                console.log(`💾 Creando cache persistente para futuros quick logins...`);
                cacheDir = path.join(CACHE_DIR, `${email.replace(/[@.]/g, '_')}_${version}`);
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }
            }
            
            console.log(`💾 Cookies y estado de sesión ${version} guardados exitosamente DESPUÉS del login`);
            console.log('🌐 Página permanece abierta - NO se cerrará automáticamente');
            
            return {
                success: true,
                sessionId: sessionId,
                message: `¡Login ${version} exitoso con credenciales! Cookies + cache guardados. Página permanece abierta.`,
                usedSavedData: false,
                version,
                quickLogin: false
            };
        }
        
        // Si no fue exitoso, crear debug adicional
        if (DEBUG_ENABLED) {
            await createDebugSnapshot(page, `login-failed-${version}`, DEBUG_DIR);
        }
        
        throw new Error(`El login ${version} no fue exitoso - verifica credenciales`);
        
    } catch (error) {
        console.error(`💥 Error durante login ${version}:`, error);
        
        if (activeSessions[sessionId]?.page && DEBUG_ENABLED) {
            await createDebugSnapshot(activeSessions[sessionId].page, `error-${version}`, DEBUG_DIR);
        }
        
        // Limpiar sesión en caso de error
        if (activeSessions[sessionId]) {
            if (activeSessions[sessionId].browser) {
                await activeSessions[sessionId].browser.close();
            }
            delete activeSessions[sessionId];
        }
        
        return {
            success: false,
            sessionId: null,
            message: `Error ${version}: ${error.message}`,
            error: error.message,
            version
        };
    }
}

/**
 * Login completo con cookies y cache persistente
 * Intenta primero móvil, luego desktop como fallback
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @param {string} versionChoice - 'auto', 'mobile', o 'desktop'
 * @returns {Object} - Resultado del login
 */
async function performFacebookLoginPersistent(email, password, versionChoice = 'auto') {
    if (versionChoice === 'mobile') {
        console.log('🚀 Iniciando login solo móvil por elección del usuario...');
        try {
            return await attemptLoginWithVersion(email, password, 'mobile', false);
        } catch (error) {
            // Si es un error de 2FA, significa que está esperando código
            if (pending2FASessions.size > 0) {
                const sessionId = Array.from(pending2FASessions.entries())
                    .find(([id, data]) => data.email === email && data.version === 'mobile')?.[0];
                if (sessionId) {
                    return {
                        success: false,
                        sessionId: sessionId,
                        message: `Se requiere código 2FA móvil. Usa el modal para ingresar el código.`,
                        requires2FA: true,
                        version: 'mobile'
                    };
                }
            }
            throw error;
        }
    }
    
    if (versionChoice === 'desktop') {
        console.log('🚀 Iniciando login solo desktop por elección del usuario...');
        try {
            return await attemptLoginWithVersion(email, password, 'desktop', false);
        } catch (error) {
            // Si es un error de 2FA, significa que está esperando código
            if (pending2FASessions.size > 0) {
                const sessionId = Array.from(pending2FASessions.entries())
                    .find(([id, data]) => data.email === email && data.version === 'desktop')?.[0];
                if (sessionId) {
                    return {
                        success: false,
                        sessionId: sessionId,
                        message: `Se requiere código 2FA desktop. Usa el modal para ingresar el código.`,
                        requires2FA: true,
                        version: 'desktop'
                    };
                }
            }
            throw error;
        }
    }
    
    // Auto (fallback)
    console.log('🚀 Iniciando login completo con fallback móvil → desktop...');
    
    // Intentar primero con versión móvil
    try {
        const mobileResult = await attemptLoginWithVersion(email, password, 'mobile', false);
        if (mobileResult.success) {
            return mobileResult;
        }
    } catch (error) {
        // Si es un error de 2FA, significa que está esperando código
        if (pending2FASessions.size > 0) {
            const sessionId = Array.from(pending2FASessions.entries())
                .find(([id, data]) => data.email === email && data.version === 'mobile')?.[0];
            if (sessionId) {
                return {
                    success: false,
                    sessionId: sessionId,
                    message: `Se requiere código 2FA móvil. Usa el modal para ingresar el código.`,
                    requires2FA: true,
                    version: 'mobile'
                };
            }
        }
    }
    
    console.log('📱 Login móvil falló, intentando desktop...');
    
    // Si móvil falló, intentar desktop
    try {
        const desktopResult = await attemptLoginWithVersion(email, password, 'desktop', false);
        if (desktopResult.success) {
            return desktopResult;
        }
    } catch (error) {
        // Si es un error de 2FA, significa que está esperando código
        if (pending2FASessions.size > 0) {
            const sessionId = Array.from(pending2FASessions.entries())
                .find(([id, data]) => data.email === email && data.version === 'desktop')?.[0];
            if (sessionId) {
                return {
                    success: false,
                    sessionId: sessionId,
                    message: `Se requiere código 2FA desktop. Usa el modal para ingresar el código.`,
                    requires2FA: true,
                    version: 'desktop'
                };
            }
        }
    }
    
    // Si ambos fallaron, retornar información de ambos intentos
    return {
        success: false,
        sessionId: null,
        message: `Login falló en ambas versiones para ${email}. Verifica credenciales.`,
        error: 'BOTH_VERSIONS_FAILED',
        attempts: {
            mobile: mobileResult.message,
            desktop: desktopResult.message
        }
    };
}

/**
 * Quick login usando SOLO cookies y cache (sin contraseña)
 * @param {string} email - Email del usuario
 * @param {string} versionChoice - 'auto', 'mobile', o 'desktop'
 * @returns {Object} - Resultado del login
 */
async function performQuickLogin(email, versionChoice = 'auto') {
    if (versionChoice === 'mobile') {
        console.log('⚡ Iniciando quick login solo móvil por elección del usuario...');
        return await attemptLoginWithVersion(email, null, 'mobile', true);
    }
    
    if (versionChoice === 'desktop') {
        console.log('⚡ Iniciando quick login solo desktop por elección del usuario...');
        return await attemptLoginWithVersion(email, null, 'desktop', true);
    }
    
    // Auto (fallback)
    console.log('⚡ Iniciando quick login con fallback móvil → desktop...');
    
    // Intentar primero con versión móvil
    const mobileResult = await attemptLoginWithVersion(email, null, 'mobile', true);
    if (mobileResult.success) {
        return mobileResult;
    }
    
    console.log('📱 Quick login móvil falló, intentando desktop...');
    
    // Si móvil falló, intentar desktop
    const desktopResult = await attemptLoginWithVersion(email, null, 'desktop', true);
    if (desktopResult.success) {
        return desktopResult;
    }
    
    // Si ambos fallaron, retornar el error más relevante
    if (mobileResult.error === 'NO_COOKIES') {
        return mobileResult; // No hay cookies es más importante que fallo de login
    }
    
    return {
        success: false,
        sessionId: null,
        message: `Quick login falló en ambas versiones para ${email}. Usa login normal para renovar cookies.`,
        error: 'BOTH_VERSIONS_FAILED',
        attempts: {
            mobile: mobileResult.message,
            desktop: desktopResult.message
        }
    };
}

/**
 * Cierra una sesión específica manualmente
 * @param {string} sessionId - ID de la sesión a cerrar
 * @returns {Object} - Resultado de la operación
 */
async function closeSession(sessionId) {
    try {
        if (!activeSessions[sessionId]) {
            return { success: false, message: 'Sesión no encontrada' };
        }
        
        const session = activeSessions[sessionId];
        
        // Guardar estado antes de cerrar
        if (session.context && session.page) {
            await saveCookies(session.context, session.email, COOKIES_DIR);
            await saveSessionState(session.context, session.page, session.email, COOKIES_DIR);
        }
        
        // Cerrar navegador
        if (session.browser) {
            await session.browser.close();
        }
        
        delete activeSessions[sessionId];
        
        console.log(`🔒 Sesión ${sessionId} cerrada manualmente`);
        return { success: true, message: 'Sesión cerrada exitosamente' };
        
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        return { success: false, message: `Error cerrando sesión: ${error.message}` };
    }
}

/**
 * Lista todas las sesiones activas
 * @returns {Array} - Lista de sesiones activas
 */
function getActiveSessions() {
    return Object.keys(activeSessions).map(sessionId => ({
        sessionId,
        email: activeSessions[sessionId].email,
        version: activeSessions[sessionId].version || 'unknown',
        quickLogin: activeSessions[sessionId].quickLogin || false,
        createdAt: activeSessions[sessionId].createdAt,
        uptime: Date.now() - activeSessions[sessionId].createdAt.getTime()
    }));
}

// Rutas de la API
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
    const { email, password, version } = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            error: 'Email y contraseña son requeridos.' 
        });
    }

    console.log(`🔐 Iniciando login persistente para: ${email} (versión: ${version || 'auto'})`);
    
    try {
        const result = await performFacebookLoginPersistent(email, password, version);
        
        if (result.success) {
            return res.json({
                success: true,
                sessionId: result.sessionId,
                message: result.message,
                usedSavedData: result.usedSavedData || false,
                version: result.version,
                quickLogin: result.quickLogin || false
            });
        }
        
        return res.status(401).json({
            success: false,
            sessionId: result.sessionId,
            message: result.message,
            error: result.error,
            requires2FA: result.requires2FA || false,
            version: result.version,
            attempts: result.attempts
        });
        
    } catch (error) {
        console.error('Error en ruta de login:', error);
        return res.status(500).json({
            error: 'Error interno del servidor: ' + error.message
        });
    }
});

// Nueva ruta para login rápido (solo cookies y cache)
app.post('/quick-login', async (req, res) => {
    const { email, version } = req.body;

    if (!email) {
        return res.status(400).json({ 
            error: 'Email es requerido para login rápido.' 
        });
    }

    console.log(`⚡ Iniciando login rápido para: ${email} (versión: ${version || 'auto'})`);
    
    try {
        const result = await performQuickLogin(email, version);
        
        if (result.success) {
            return res.json({
                success: true,
                sessionId: result.sessionId,
                message: result.message,
                quickLogin: true,
                usedSavedData: true,
                version: result.version
            });
        }
        
        return res.status(401).json({
            success: false,
            sessionId: result.sessionId,
            message: result.message,
            error: result.error,
            version: result.version,
            attempts: result.attempts
        });
        
    } catch (error) {
        console.error('Error en ruta de login rápido:', error);
        return res.status(500).json({
            error: 'Error interno del servidor: ' + error.message
        });
    }
});

// Nueva ruta para cerrar sesiones manualmente
app.post('/close-session', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId es requerido' });
    }
    
    const result = await closeSession(sessionId);
    
    if (result.success) {
        return res.json(result);
    } else {
        return res.status(404).json(result);
    }
});

// Nueva ruta para listar sesiones activas
app.get('/sessions', (req, res) => {
    const sessions = getActiveSessions();
    res.json({
        count: sessions.length,
        sessions: sessions
    });
});

// Nueva ruta para limpiar cookies antiguas
app.post('/clean-cookies', (req, res) => {
    try {
        cleanOldSessions(COOKIES_DIR, 168); // 7 días
        res.json({ success: true, message: 'Cookies antiguas limpiadas' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nueva ruta para listar cookies guardadas
app.get('/cookies', (req, res) => {
    try {
        const allFiles = fs.readdirSync(COOKIES_DIR);
        
        // Agrupar archivos por email
        const emailGroups = {};
        
        allFiles.forEach(file => {
            if (file.endsWith('_cookies.json') || file.endsWith('_session.json')) {
                const emailPart = file.replace(/_cookies\.json$|_session\.json$/, '');
                if (!emailGroups[emailPart]) {
                    emailGroups[emailPart] = {};
                }
                
                const filePath = path.join(COOKIES_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (file.endsWith('_cookies.json')) {
                    const cookieData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    emailGroups[emailPart].cookies = {
                        filename: file,
                        created: cookieData.timestamp,
                        lastModified: stats.mtime,
                        size: stats.size,
                        age: Date.now() - new Date(cookieData.timestamp).getTime(),
                        email: cookieData.email
                    };
                } else if (file.endsWith('_session.json')) {
                    const sessionData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    emailGroups[emailPart].session = {
                        filename: file,
                        created: sessionData.timestamp,
                        lastModified: stats.mtime,
                        size: stats.size,
                        age: Date.now() - new Date(sessionData.timestamp).getTime(),
                        email: sessionData.email
                    };
                }
            }
        });
        
        // Convertir a array y agregar información combinada
        const cookiesList = Object.entries(emailGroups)
            .map(([emailKey, data]) => {
                const email = data.cookies?.email || data.session?.email || emailKey.replace(/_/g, '@');
                const totalSize = (data.cookies?.size || 0) + (data.session?.size || 0);
                const oldestAge = Math.max(data.cookies?.age || 0, data.session?.age || 0);
                const newestModified = new Date(Math.max(
                    data.cookies?.lastModified?.getTime() || 0,
                    data.session?.lastModified?.getTime() || 0
                ));
                
                return {
                    email: email,
                    totalSize: totalSize,
                    age: oldestAge,
                    lastModified: newestModified,
                    files: {
                        cookies: data.cookies || null,
                        session: data.session || null
                    },
                    fileCount: (data.cookies ? 1 : 0) + (data.session ? 1 : 0)
                };
            })
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

        res.json({
            count: cookiesList.length,
            cookies: cookiesList
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nueva ruta para eliminar cookies específicas
app.delete('/cookies/:email', (req, res) => {
    try {
        const email = req.params.email;
        const cookieFile = path.join(COOKIES_DIR, `${email.replace(/[@.]/g, '_')}_cookies.json`);
        const sessionFile = path.join(COOKIES_DIR, `${email.replace(/[@.]/g, '_')}_session.json`);
        const cacheDir = path.join(CACHE_DIR, email.replace(/[@.]/g, '_'));
        
        let deleted = 0;
        
        // Eliminar archivos de cookies y sesión
        if (fs.existsSync(cookieFile)) {
            fs.unlinkSync(cookieFile);
            deleted++;
        }
        
        if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
            deleted++;
        }
        
        // Eliminar cache del navegador
        if (fs.existsSync(cacheDir)) {
            fs.rmSync(cacheDir, { recursive: true, force: true });
            deleted++;
        }
        
        if (deleted > 0) {
            res.json({ 
                success: true, 
                message: `Datos eliminados para ${email} (${deleted} elementos)`,
                filesDeleted: deleted
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: `No se encontraron datos para ${email}` 
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nueva ruta para listar información de cache
app.get('/cache', (req, res) => {
    try {
        const cacheInfo = [];
        
        if (fs.existsSync(CACHE_DIR)) {
            const cacheDirs = fs.readdirSync(CACHE_DIR, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => {
                    const dirPath = path.join(CACHE_DIR, dirent.name);
                    const stats = fs.statSync(dirPath);
                    
                    // Calcular tamaño del directorio
                    let totalSize = 0;
                    let fileCount = 0;
                    
                    try {
                        const calculateDirSize = (dirPath) => {
                            const files = fs.readdirSync(dirPath, { withFileTypes: true });
                            files.forEach(file => {
                                const filePath = path.join(dirPath, file.name);
                                if (file.isDirectory()) {
                                    calculateDirSize(filePath);
                                } else {
                                    const fileStats = fs.statSync(filePath);
                                    totalSize += fileStats.size;
                                    fileCount++;
                                }
                            });
                        };
                        
                        calculateDirSize(dirPath);
                    } catch (error) {
                        console.log(`Error calculando tamaño de ${dirPath}:`, error.message);
                    }
                    
                    return {
                        email: dirent.name.replace(/_/g, '@'),
                        directory: dirent.name,
                        path: dirPath,
                        created: stats.birthtime,
                        lastModified: stats.mtime,
                        size: totalSize,
                        fileCount: fileCount,
                        age: Date.now() - stats.mtime.getTime()
                    };
                })
                .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
            
            cacheInfo.push(...cacheDirs);
        }
        
        const totalSize = cacheInfo.reduce((sum, cache) => sum + cache.size, 0);
        const totalFiles = cacheInfo.reduce((sum, cache) => sum + cache.fileCount, 0);
        
        res.json({
            count: cacheInfo.length,
            totalSize: totalSize,
            totalFiles: totalFiles,
            caches: cacheInfo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para enviar código 2FA
app.post('/submit-2fa', async (req, res) => {
    try {
        const { sessionId, code, source = 'manual' } = req.body;
        
        if (!sessionId || !code) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere sessionId y código 2FA'
            });
        }
        
        // Verificar que la sesión existe y está esperando 2FA
        if (!pending2FASessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                message: 'Sesión no encontrada o no está esperando 2FA'
            });
        }
        
        const sessionData = pending2FASessions.get(sessionId);
        const { page, email, version, resolve, reject } = sessionData;
        
        console.log(`🔐 Procesando código 2FA para ${email} (${version}): ${code} [${source}]`);
        
        try {
            // Buscar campo de código 2FA con selectores mejorados
            const codeInputSelectors = [
                'input[placeholder*="código" i]',
                'input[placeholder*="code" i]',
                'input[name="approvals_code"]',
                'input[id="approvals_code"]',
                'input[data-testid="2fa_code"]',
                'input[inputmode="numeric"]',
                'input[type="text"][maxlength="6"]', // Campo de 6 dígitos específico
                'input[autocomplete="one-time-code"]', // Campo de código único
                'input[type="text"]:not([name="email"]):not([name="pass"])',
                'input[aria-label*="código" i]',
                'input[aria-label*="Código" i]',
                'input[aria-label*="code" i]'
            ];
            
            let codeInput = null;
            for (const selector of codeInputSelectors) {
                try {
                    const element = page.locator(selector);
                    if (await element.isVisible({ timeout: 1000 })) {
                        codeInput = element;
                        console.log(`✅ Campo de código encontrado: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!codeInput) {
                // Crear debug snapshot si no encuentra el campo
                if (DEBUG_ENABLED) {
                    await createDebugSnapshot(page, `2fa-field-not-found-${version}`, DEBUG_DIR);
                    console.log(`📸 Debug snapshot creado - campo 2FA no encontrado - ${version}`);
                }
                throw new Error('No se pudo encontrar el campo de código 2FA');
            }
            
            // Limpiar campo y escribir código
            await codeInput.click();
            await codeInput.fill('');
            await sleep(500);
            await typeOptimized(page, codeInputSelectors[0], code);
            await sleep(1000);
            
            // Buscar botón de continuar/enviar
            const submitButtonSelectors = [
                'div[role="button"][aria-label*="Continuar"]',
                'div[role="button"]:has-text("Continuar")',
                'div[role="button"]:has-text("Continue")',
                'div[role="button"]:has-text("Submit")',
                'div[role="button"]:has-text("Enviar")',
                'button[type="submit"]',
                'button:has-text("Continuar")',
                'button:has-text("Continue")',
                '[data-testid="2fa_submit_button"]'
            ];
            
            let submitButton = null;
            for (const selector of submitButtonSelectors) {
                try {
                    const element = page.locator(selector);
                    if (await element.isVisible({ timeout: 1000 })) {
                        // Verificar que no esté deshabilitado
                        const isDisabled = await element.getAttribute('disabled') !== null ||
                                         await element.getAttribute('aria-disabled') === 'true';
                        if (!isDisabled) {
                            submitButton = element;
                            console.log(`✅ Botón de envío encontrado: ${selector}`);
                            break;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!submitButton) {
                throw new Error('No se pudo encontrar el botón de envío 2FA');
            }
            
            // Hacer click en enviar
            console.log('🚀 Enviando código 2FA...');
            await submitButton.click({ force: true });
            await sleep(3000);
            
            // Verificar resultado
            if (await checkFor2FA(page)) {
                // Aún requiere 2FA - código incorrecto
                res.json({
                    success: false,
                    message: 'Código 2FA incorrecto. Intenta nuevamente.',
                    stillRequires2FA: true
                });
                return;
            }
            
            // Verificar si el login fue exitoso
            if (await checkLoginSuccess(page)) {
                console.log(`🎉 ¡Login exitoso después de 2FA ${version}!`);
                
                // Guardar cookies y estado de sesión solo DESPUÉS del login exitoso
                const session = activeSessions[sessionId];
                if (session) {
                    await saveCookies(session.context, email, COOKIES_DIR);
                    await saveSessionState(session.context, page, email, COOKIES_DIR);
                    console.log(`💾 Cookies y estado de sesión ${version} guardados exitosamente`);
                }
                
                // Limpiar sesión pendiente
                pending2FASessions.delete(sessionId);
                
                // Resolver la promesa del login
                resolve({
                    success: true,
                    sessionId: sessionId,
                    message: `¡Login ${version} exitoso con 2FA! Cookies + cache guardados. Página permanece abierta.`,
                    usedSavedData: false,
                    version,
                    completed2FA: true
                });
                
                res.json({
                    success: true,
                    message: `¡Login ${version} exitoso con 2FA!`,
                    loginCompleted: true
                });
                
            } else {
                throw new Error('Login no exitoso después de 2FA');
            }
            
        } catch (error) {
            console.error(`❌ Error procesando 2FA: ${error.message}`);
            
            // Mantener la sesión pendiente para otro intento
            res.json({
                success: false,
                message: `Error procesando 2FA: ${error.message}`,
                stillRequires2FA: true
            });
        }
        
    } catch (error) {
        console.error('❌ Error en endpoint 2FA:', error);
        res.status(500).json({
            success: false,
            message: `Error del servidor: ${error.message}`
        });
    }
});

// Endpoint para cancelar 2FA
app.post('/cancel-2fa', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere sessionId'
            });
        }
        
        if (pending2FASessions.has(sessionId)) {
            const sessionData = pending2FASessions.get(sessionId);
            pending2FASessions.delete(sessionId);
            
            // Rechazar la promesa del login
            sessionData.reject(new Error('2FA cancelado por el usuario'));
            
            console.log(`❌ 2FA cancelado para sesión: ${sessionId}`);
        }
        
        // Cerrar la sesión
        await closeSession(sessionId);
        
        res.json({
            success: true,
            message: '2FA cancelado y sesión cerrada'
        });
        
    } catch (error) {
        console.error('❌ Error cancelando 2FA:', error);
        res.status(500).json({
            success: false,
            message: `Error del servidor: ${error.message}`
        });
    }
});

// Endpoint para obtener sesiones pendientes de 2FA
app.get('/pending-2fa', (req, res) => {
    try {
        const pendingSessions = Array.from(pending2FASessions.entries()).map(([sessionId, data]) => ({
            sessionId,
            email: data.email,
            version: data.version,
            timestamp: data.timestamp
        }));
        
        res.json({
            success: true,
            pendingSessions
        });
        
    } catch (error) {
        console.error('❌ Error obteniendo sesiones 2FA pendientes:', error);
        res.status(500).json({
            success: false,
            message: `Error del servidor: ${error.message}`
        });
    }
});

// Servir archivos de debug (solo si está habilitado)
if (DEBUG_ENABLED) {
app.use('/debug', express.static(DEBUG_DIR));
}

// Servir archivos de cookies (solo para debug - remover en producción)
app.use('/cookies-debug', express.static(COOKIES_DIR));

// Iniciar servidor
app.listen(port, () => {
    console.log('🚀 ====================================');
    console.log('🚀   FACEBOOK LOGIN AUTOMATION');
    console.log('🚀   VERSIÓN CON COOKIES PERSISTENTES');
    console.log('🚀 ====================================');
    console.log(`🌐 Servidor: http://localhost:${port}`);
    console.log(`📊 Debug: ${DEBUG_DIR} ${DEBUG_ENABLED ? '✅ ACTIVO' : '❌ DESHABILITADO'}`);
    console.log(`🍪 Cookies: ${COOKIES_DIR}`);
    console.log(`💾 Cache: ${CACHE_DIR}`);
    console.log('🚀 ====================================');
    console.log('⚡ Características activas:');
    console.log('   ✅ Cookies persistentes (7 días)');
    console.log('   ✅ Cache del navegador');
    console.log('   ✅ Sesiones que NO se cierran');
    console.log('   ✅ Restauración de localStorage');
    console.log('   ✅ Login automático con cookies');
    console.log('   ✅ Gestión manual de sesiones');
    console.log(`   ${DEBUG_ENABLED ? '✅' : '❌'} Debug y capturas de pantalla`);
    console.log('🚀 ====================================');
    console.log('📖 Endpoints disponibles:');
    console.log('   POST /login - Login con cookies');
    console.log('   POST /quick-login - Login rápido (solo cookies)');
    console.log('   GET /sessions - Ver sesiones activas');
    console.log('   POST /close-session - Cerrar sesión');
    console.log('   GET /cookies - Listar cookies guardadas');
    console.log('   GET /cache - Ver información de cache');
    console.log('   DELETE /cookies/:email - Eliminar datos');
    console.log('   POST /clean-cookies - Limpiar cookies');
    console.log('   POST /submit-2fa - Enviar código 2FA');
    console.log('   POST /cancel-2fa - Cancelar 2FA');
    console.log('   GET /pending-2fa - Ver sesiones pendientes de 2FA');
    console.log('🚀 ====================================');
    console.log('📖 Abre http://localhost:3000 para probar');
}); 