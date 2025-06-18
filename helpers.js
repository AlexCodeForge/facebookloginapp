/*****************************************************************
 * helpers.js – Funciones auxiliares optimizadas
 * Funciones de tecleo, debug, cookies y utilidades separadas para mantenibilidad
 *****************************************************************/

const fs = require('fs');
const path = require('path');

/*─────────────────  UTILIDADES BÁSICAS  ──────────────────*/
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => min + Math.random() * (max - min);

// Función para generar timestamp para archivos
function getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
           now.toTimeString().split(' ')[0].replace(/:/g, '-');
}

/*─────────────────  GESTIÓN DE COOKIES Y CACHE  ──────────────────*/
/**
 * Guarda cookies de una sesión
 * @param {BrowserContext} context - Contexto del navegador
 * @param {string} email - Email del usuario para identificar sesión
 * @param {string} cookiesDir - Directorio donde guardar cookies
 */
async function saveCookies(context, email, cookiesDir) {
    try {
        const cookies = await context.cookies();
        const cookieData = {
            email: email,
            timestamp: new Date().toISOString(),
            cookies: cookies,
            userAgent: context._options.userAgent || '',
            viewport: context._options.viewport || {}
        };
        
        const cookieFile = path.join(cookiesDir, `${email.replace(/[@.]/g, '_')}_cookies.json`);
        fs.writeFileSync(cookieFile, JSON.stringify(cookieData, null, 2));
        
        console.log(`🍪 Cookies guardadas para ${email} en: ${cookieFile}`);
        return cookieFile;
    } catch (error) {
        console.error('❌ Error guardando cookies:', error.message);
        return null;
    }
}

/**
 * Carga cookies de una sesión previa
 * @param {string} email - Email del usuario
 * @param {string} cookiesDir - Directorio de cookies
 * @returns {Object|null} - Datos de cookies o null si no existen
 */
function loadCookies(email, cookiesDir) {
    try {
        const cookieFile = path.join(cookiesDir, `${email.replace(/[@.]/g, '_')}_cookies.json`);
        
        if (!fs.existsSync(cookieFile)) {
            console.log(`🍪 No hay cookies guardadas para ${email}`);
            return null;
        }
        
        const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
        
        // Verificar si las cookies no son muy antiguas (7 días)
        const cookieAge = Date.now() - new Date(cookieData.timestamp).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
        
        if (cookieAge > maxAge) {
            console.log(`🍪 Cookies de ${email} son muy antiguas, ignorando...`);
            return null;
        }
        
        console.log(`🍪 Cookies cargadas para ${email} (${Math.round(cookieAge / (60 * 60 * 1000))} horas de antigüedad)`);
        return cookieData;
    } catch (error) {
        console.error('❌ Error cargando cookies:', error.message);
        return null;
    }
}

/**
 * Guarda el estado de la sesión completa
 * @param {BrowserContext} context - Contexto del navegador
 * @param {Page} page - Página actual
 * @param {string} email - Email del usuario
 * @param {string} cookiesDir - Directorio de cookies
 */
async function saveSessionState(context, page, email, cookiesDir) {
    try {
        // Guardar cookies
        await saveCookies(context, email, cookiesDir);
        
        // Guardar estado de la página
        const sessionState = {
            email: email,
            timestamp: new Date().toISOString(),
            url: page.url(),
            title: await page.title(),
            localStorage: await page.evaluate(() => {
                const storage = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    storage[key] = localStorage.getItem(key);
                }
                return storage;
            }),
            sessionStorage: await page.evaluate(() => {
                const storage = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    storage[key] = sessionStorage.getItem(key);
                }
                return storage;
            })
        };
        
        const sessionFile = path.join(cookiesDir, `${email.replace(/[@.]/g, '_')}_session.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(sessionState, null, 2));
        
        console.log(`💾 Estado de sesión guardado para ${email}`);
        return sessionFile;
    } catch (error) {
        console.error('❌ Error guardando estado de sesión:', error.message);
        return null;
    }
}

/**
 * Restaura el estado de localStorage y sessionStorage
 * @param {Page} page - Página donde restaurar
 * @param {string} email - Email del usuario
 * @param {string} cookiesDir - Directorio de cookies
 */
async function restoreSessionState(page, email, cookiesDir) {
    try {
        const sessionFile = path.join(cookiesDir, `${email.replace(/[@.]/g, '_')}_session.json`);
        
        if (!fs.existsSync(sessionFile)) {
            console.log(`💾 No hay estado de sesión guardado para ${email}`);
            return false;
        }
        
        const sessionState = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        
        // Restaurar localStorage
        if (sessionState.localStorage) {
            await page.evaluate((storage) => {
                for (const [key, value] of Object.entries(storage)) {
                    localStorage.setItem(key, value);
                }
            }, sessionState.localStorage);
        }
        
        // Restaurar sessionStorage
        if (sessionState.sessionStorage) {
            await page.evaluate((storage) => {
                for (const [key, value] of Object.entries(storage)) {
                    sessionStorage.setItem(key, value);
                }
            }, sessionState.sessionStorage);
        }
        
        console.log(`💾 Estado de sesión restaurado para ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error restaurando estado de sesión:', error.message);
        return false;
    }
}

/**
 * Limpia cookies y sesiones antiguas
 * @param {string} cookiesDir - Directorio de cookies
 * @param {number} maxAgeHours - Edad máxima en horas (default: 168 = 7 días)
 */
function cleanOldSessions(cookiesDir, maxAgeHours = 168) {
    try {
        const files = fs.readdirSync(cookiesDir);
        const maxAge = maxAgeHours * 60 * 60 * 1000;
        let cleaned = 0;
        
        files.forEach(file => {
            const filePath = path.join(cookiesDir, file);
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtime.getTime();
            
            if (age > maxAge) {
                fs.unlinkSync(filePath);
                cleaned++;
                console.log(`🧹 Eliminado archivo antiguo: ${file}`);
            }
        });
        
        if (cleaned > 0) {
            console.log(`🧹 Limpieza completada: ${cleaned} archivos eliminados`);
        }
    } catch (error) {
        console.error('❌ Error limpiando sesiones antiguas:', error.message);
    }
}

/*─────────────────  TECLEO OPTIMIZADO  ──────────────────*/
/**
 * Teclea texto de forma más rápida pero aún humana
 * Sin borrar/reescribir cada letra - solo delays naturales
 * @param {Page} page - Página de Playwright
 * @param {string} selector - Selector del input
 * @param {string} text - Texto a escribir
 */
async function typeOptimized(page, selector, text) {
  console.log(`⌨️  Escribiendo "${text}" optimizado...`);
  
  await page.click(selector);
  await sleep(300);
  
  // Solo 200-400ms por carácter, sin borrar/reescribir
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    await page.keyboard.type(char, { delay: randomDelay(200, 400) });
    
    // Pausa ocasional para simular pensamiento
    if (i > 0 && i % randomDelay(3, 5) === 0) {
      await sleep(randomDelay(500, 800));
    }
  }
  
  console.log(`✅ Texto escrito`);
}

/**
 * Tecleo súper lento para casos especiales (opcional)
 * @param {Page} page - Página de Playwright
 * @param {string} selector - Selector del input
 * @param {string} text - Texto a escribir
 */
async function typeSlowHuman(page, selector, text) {
  console.log(`⌨️  Escribiendo "${text}" SÚPER lento (solo si es necesario)...`);
  
  await page.click(selector);
  await sleep(300);
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Escribir con delay largo
    await page.keyboard.type(char, { delay: randomDelay(800, 1200) });
    
    // Ocasionalmente simular error (solo 20% de las veces)
    if (Math.random() < 0.2) {
      // Simular backspace y reescribir
      await page.keyboard.press('Backspace');
      await sleep(randomDelay(200, 400));
      await page.keyboard.type(char, { delay: randomDelay(600, 900) });
    }
    
    // Pausa ocasional más larga
    if (i > 0 && i % randomDelay(2, 4) === 0) {
      await sleep(randomDelay(1000, 2000));
    }
  }
  
  console.log(`✅ Texto escrito súper lento`);
}

/*─────────────────  DEBUG MEJORADO  ──────────────────*/
/**
 * Crea un snapshot de debug con información detallada de la página
 * @param {Page} page - Página de Playwright
 * @param {string} stage - Etapa del proceso (inicial, post-login, error, etc.)
 * @param {string} debugDir - Directorio donde guardar archivos de debug
 * @returns {Object} - Datos del debug
 */
async function createDebugSnapshot(page, stage = 'general', debugDir) {
    try {
        const timestamp = getTimestamp();
        const filename = `${timestamp}_${stage}`;
        
        // Screenshot
        const screenshotPath = path.join(debugDir, `${filename}_screenshot.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // Información detallada de la página
        const debugData = {
            timestamp: new Date().toISOString(),
            stage: stage,
            url: page.url(),
            title: await page.title(),
            
            // Todos los inputs visibles
            allInputs: await page.evaluate(() => {
                const inputs = Array.from(document.querySelectorAll('input'));
                return inputs.map((input, index) => ({
                    index,
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    ariaLabel: input.getAttribute('aria-label'),
                    visible: input.offsetParent !== null
                }));
            }),
            
            // Todos los botones visibles
            allButtons: await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                return buttons.map((btn, index) => ({
                    index,
                    tagName: btn.tagName,
                    ariaLabel: btn.getAttribute('aria-label'),
                    textContent: btn.textContent?.trim(),
                    visible: btn.offsetParent !== null
                }));
            })
        };
        
        // Guardar JSON
        const jsonPath = path.join(debugDir, `${filename}_snapshot.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(debugData, null, 2));
        
        console.log(`📸 Debug snapshot guardado: ${stage}`);
        console.log(`   Screenshot: ${screenshotPath}`);
        console.log(`   Data: ${jsonPath}`);
        
        return debugData;
        
    } catch (error) {
        console.log('❌ Error en debug:', error.message);
        return null;
    }
}

/*─────────────────  SELECTORES MEJORADOS (MOBILE + DESKTOP)  ──────────────────*/
const SELECTORS = {
  // MOBILE SELECTORS (m.facebook.com)
  mobile: {
    email: [
      'input[name="email"]',
      'input[type="email"]',
      'input[type="text"]:first-of-type',
      'input[id="m_login_email"]'
    ],
    password: [
      'input[name="pass"]',
      'input[type="password"]',
      'input[id="m_login_password"]'
    ],
    loginButton: [
      // Español - evitar botones con spinner
      'div[role="button"][aria-label="Iniciar sesión"]:not(:has-text("Spinner"))',
      'div[role="button"]:has-text("Iniciar sesión"):not(:has-text("Spinner"))',
      // Inglés
      'div[role="button"][aria-label="Log in"]:not(:has-text("Spinner"))',
      'div[role="button"]:has-text("Log in"):not(:has-text("Spinner"))',
      // Genéricos
      'button[name="login"]',
      'button[type="submit"]',
      // Fallback si hay spinner
      'div[role="button"]:has-text("Iniciar sesión")',
      'div[role="button"]:has-text("Log in")'
    ]
  },
  
  // DESKTOP SELECTORS (www.facebook.com)
  desktop: {
    email: [
      'input[name="email"]',
      'input[type="email"]',
      'input[data-testid="royal_email"]',
      'input[id="email"]'
    ],
    password: [
      'input[name="pass"]',
      'input[type="password"]',
      'input[data-testid="royal_pass"]',
      'input[id="pass"]'
    ],
    loginButton: [
      // Español
      'button[name="login"]',
      'button[type="submit"]',
      'button[data-testid="royal_login_button"]',
      'div[role="button"]:has-text("Iniciar sesión")',
      // Inglés
      'div[role="button"]:has-text("Log in")',
      'input[type="submit"][value="Log In"]',
      'input[type="submit"][value="Iniciar sesión"]'
    ]
  },
  
  // COMMON SELECTORS (ambas versiones)
  saveLoginDialog: [
    // Botones para guardar información de login
    'div[role="button"]:has-text("Guardar")',
    'div[role="button"]:has-text("Save")',
    'div[role="button"]:has-text("Ahora no")',
    'div[role="button"]:has-text("Not now")',
    'button:has-text("Guardar")',
    'button:has-text("Save")',
    'button:has-text("Ahora no")',
    'button:has-text("Not now")',
    'div[role="button"]:has-text("No guardar")',
    'div[role="button"]:has-text("Don\'t save")',
    // Desktop específicos
    'button[data-testid="save_device_checkbox"]',
    'div[aria-label="Not Now"]',
    'div[aria-label="Ahora no"]'
  ]
};

/*─────────────────  FUNCIONES DE BÚSQUEDA  ──────────────────*/
/**
 * Busca un elemento usando múltiples selectores
 * @param {Page} page - Página de Playwright
 * @param {Array} selectors - Array de selectores a probar
 * @param {string} elementType - Tipo de elemento para logging
 * @returns {Object|null} - Elemento encontrado o null
 */
async function findElement(page, selectors, elementType = 'elemento') {
  console.log(`🔍 Buscando ${elementType}...`);
  
  for (const selector of selectors) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ ${elementType} encontrado: ${selector}`);
        return element;
      }
    } catch (e) {
      continue;
    }
  }
  
  console.log(`❌ No se encontró ${elementType}`);
  return null;
}

/**
 * Detecta si estamos en versión móvil o desktop
 * @param {Page} page - Página de Playwright
 * @returns {string} - 'mobile' o 'desktop'
 */
async function detectFacebookVersion(page) {
    const url = page.url();
    if (url.includes('m.facebook.com')) {
        console.log('📱 Detectada versión móvil de Facebook');
        return 'mobile';
    } else if (url.includes('www.facebook.com') || url.includes('facebook.com')) {
        console.log('🖥️ Detectada versión desktop de Facebook');
        return 'desktop';
    }
    
    // Fallback: detectar por elementos en la página
    try {
        const mobileIndicator = await page.locator('input[id="m_login_email"]').isVisible({ timeout: 1000 });
        if (mobileIndicator) {
            console.log('📱 Detectada versión móvil por elementos');
            return 'mobile';
        }
        
        const desktopIndicator = await page.locator('input[data-testid="royal_email"]').isVisible({ timeout: 1000 });
        if (desktopIndicator) {
            console.log('🖥️ Detectada versión desktop por elementos');
            return 'desktop';
        }
    } catch (e) {
        // Ignorar errores de detección
    }
    
    console.log('❓ No se pudo detectar versión, asumiendo móvil');
    return 'mobile';
}

/**
 * Obtiene selectores según la versión de Facebook
 * @param {Page} page - Página de Playwright
 * @returns {Object} - Selectores apropiados
 */
async function getSelectorsForVersion(page) {
    const version = await detectFacebookVersion(page);
    return SELECTORS[version];
}

/**
 * Maneja diálogo de guardar información de login
 * @param {Page} page - Página de Playwright
 * @returns {boolean} - True si se manejó el diálogo
 */
async function handleSaveLoginDialog(page) {
    console.log('🔍 Verificando diálogo de guardar login...');
    
    try {
        // Esperar un poco para que aparezca el diálogo
        await sleep(2000);
        
        // Buscar botones de "Ahora no" o "Not now" primero
        const notNowButton = await findElement(page, [
            'div[role="button"]:has-text("Ahora no")',
            'div[role="button"]:has-text("Not now")',
            'button:has-text("Ahora no")',
            'button:has-text("Not now")',
            'div[aria-label="Not Now"]',
            'div[aria-label="Ahora no"]'
        ], 'botón "Ahora no"');
        
        if (notNowButton) {
            console.log('🚫 Clickeando "Ahora no" en diálogo de guardar login...');
            await notNowButton.click();
            await sleep(2000);
            return true;
        }
        
        // Si no hay "Ahora no", buscar "Guardar" para cerrarlo
        const saveButton = await findElement(page, [
            'div[role="button"]:has-text("Guardar")',
            'div[role="button"]:has-text("Save")',
            'button:has-text("Guardar")',
            'button:has-text("Save")',
            'button[data-testid="save_device_checkbox"]'
        ], 'botón "Guardar"');
        
        if (saveButton) {
            console.log('💾 Clickeando "Guardar" en diálogo de login...');
            await saveButton.click();
            await sleep(2000);
            return true;
        }
        
        console.log('✅ No se encontró diálogo de guardar login');
        return false;
        
    } catch (error) {
        console.log('❌ Error manejando diálogo de guardar login:', error.message);
        return false;
    }
}

/**
 * Maneja página de carga de Facebook
 * @param {Page} page - Página de Playwright
 */
async function handleLoadingPage(page) {
    const pageText = await page.textContent('body');
    if (pageText.includes('FacebookLoading') || pageText.includes('Try Again') || pageText.includes('Intentar de nuevo')) {
        console.log('⚠️ Página de carga detectada, intentando continuar...');
        
        const tryAgainSelectors = [
            'a:has-text("Try Again")',
            'button:has-text("Try Again")',
            'a:has-text("Reintentar")',
            'button:has-text("Reintentar")',
            'a:has-text("Intentar de nuevo")',
            'button:has-text("Intentar de nuevo")'
        ];
        
        for (const selector of tryAgainSelectors) {
            try {
                const element = page.locator(selector);
                if (await element.isVisible({ timeout: 2000 })) {
                    console.log('🔄 Clickeando "Try Again"...');
                    await element.click();
                    await sleep(3000);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }
    }
    return false;
}

/**
 * Espera a que el botón de login esté listo (sin spinner)
 * @param {Page} page - Página de Playwright
 * @param {number} maxWaitMs - Tiempo máximo de espera en ms
 * @returns {Object|null} - Botón de login listo o null
 */
async function waitForLoginButton(page, maxWaitMs = 10000) {
    console.log('⏳ Esperando a que el botón de login esté listo...');
    
    const startTime = Date.now();
    const selectors = await getSelectorsForVersion(page);
    
    while (Date.now() - startTime < maxWaitMs) {
        // Buscar botón sin spinner
        const readyButton = await findElement(page, [
            // Selectores específicos sin spinner
            'div[role="button"][aria-label="Iniciar sesión"]:not(:has-text("Spinner"))',
            'div[role="button"]:has-text("Iniciar sesión"):not(:has-text("Spinner"))',
            'div[role="button"][aria-label="Log in"]:not(:has-text("Spinner"))',
            'div[role="button"]:has-text("Log in"):not(:has-text("Spinner"))',
            'button[name="login"]',
            'button[type="submit"]'
        ], 'botón de login listo');
        
        if (readyButton) {
            console.log('✅ Botón de login listo para usar');
            return readyButton;
        }
        
        console.log('⏳ Botón aún cargando, esperando...');
        await sleep(1000);
    }
    
    console.log('⚠️ Timeout esperando botón de login, intentando con cualquier botón disponible');
    return await findElement(page, selectors.loginButton, 'botón de login (fallback)');
}

/*─────────────────  VERIFICACIONES DE ESTADO  ──────────────────*/
/**
 * Verifica si el login fue exitoso
 * @param {Page} page - Página de Playwright
 * @returns {boolean} - True si el login fue exitoso
 */
async function checkLoginSuccess(page) {
    const currentUrl = page.url();
    console.log(`🌐 URL actual: ${currentUrl}`);
    
    // Primero verificar si estamos en una pantalla de 2FA - si es así, NO es login exitoso
    // Usar la misma lógica completa que checkFor2FA
    const twoFAIndicators = [
        // Campos de código específicos
        'input[placeholder*="código" i]',
        'input[placeholder*="code" i]',
        'input[name="approvals_code"]',
        'input[id="approvals_code"]',
        'input[data-testid="2fa_code"]',
        'input[inputmode="numeric"]',
        'input[aria-label*="código" i]',
        'input[aria-label*="Código" i]',
        'input[type="text"][maxlength="6"]',
        'input[autocomplete="one-time-code"]',
        
        // Textos específicos del screenshot - EXACTOS
        'text=Ve a tu app de autenticación',
        'text=Ingresa el código de 6 dígitos para esta cuenta',
        'text=desde la app de autenticación en dos pasos que configuraste',
        'text=app de autenticación',
        'text=Duo Mobile',
        'text=Google Authenticator',
        'text=Confía en este dispositivo y omite este paso',
        
        // Textos parciales más flexibles
        ':text("Ve a tu app")',
        ':text("código de 6 dígitos")',
        ':text("app de autenticación")',
        ':text("Ingresa el código")',
        ':text("dos pasos")',
        ':text("autenticación en dos")',
        
        // Textos comunes
        'text=código de verificación',
        'text=authentication code',
        'text=two-factor',
        'text=verificación',
        'text=verification',
        
        // Elementos contenedores
        'div:has-text("Ve a tu app de autenticación")',
        'div:has-text("Ingresa el código de 6 dígitos")',
        'form:has-text("código de 6 dígitos")'
    ];
    
    for (const indicator of twoFAIndicators) {
        try {
            const element = page.locator(indicator);
            if (await element.isVisible({ timeout: 1000 })) {
                console.log(`❌ Login NO exitoso: detectada pantalla 2FA por ${indicator}`);
                return false;
            }
        } catch (e) {
            continue;
        }
    }
    
    // URLs que indican login exitoso
    const successUrls = [
        'home.php', 
        '/?', 
        '/feed',
        '/home',
        'facebook.com/?sk=h_chr', // Timeline
        'facebook.com/?ref=tn_tnmn' // Home
    ];
    
    for (const url of successUrls) {
        if (currentUrl.includes(url)) {
            console.log(`✅ Login exitoso por URL: ${url}`);
            return true;
        }
    }
    
    try {
        // Verificar ausencia de campos de login
        const loginFields = await page.locator('input[name="email"], input[type="password"]').count();
        if (loginFields === 0) {
            console.log('✅ Login exitoso: no hay campos de login');
            return true;
        }
        
        // Buscar indicadores de login exitoso
        const successIndicators = [
            '[data-testid="search"]', // Barra de búsqueda (desktop)
            '[aria-label="Facebook"]', // Logo de Facebook logueado
            'div[role="main"]', // Contenido principal
            '[data-testid="blue_bar"]' // Barra azul superior
        ];
        
        for (const indicator of successIndicators) {
            try {
                const element = page.locator(indicator);
                if (await element.isVisible({ timeout: 2000 })) {
                    console.log(`✅ Login exitoso por indicador: ${indicator}`);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }
        
    } catch (e) {
        console.log('⚠️ Error verificando campos:', e.message);
    }
    
    console.log('❌ Login no exitoso');
    return false;
}

/**
 * Verifica si se requiere 2FA
 * @param {Page} page - Página de Playwright
 * @returns {boolean} - True si se requiere 2FA
 */
async function checkFor2FA(page) {
    try {
        console.log('🔐 Verificando si se requiere 2FA...');
        console.log(`🔍 URL actual: ${page.url()}`);
        console.log(`📄 Título de página: ${await page.title()}`);
        
        // Buscar indicadores de 2FA (texto y elementos)
        const twoFAIndicators = [
            // Campos de código específicos
            'input[placeholder*="código" i]',
            'input[placeholder*="code" i]',
            'input[name="approvals_code"]',
            'input[id="approvals_code"]',
            'input[data-testid="2fa_code"]',
            'input[inputmode="numeric"]',
            'input[aria-label*="código" i]',
            'input[aria-label*="Código" i]',
            'input[type="text"][maxlength="6"]', // Campo de 6 dígitos típico
            'input[autocomplete="one-time-code"]', // Campo de código único
            
            // Textos específicos del screenshot - EXACTOS
            'text=Ve a tu app de autenticación',
            'text=Ingresa el código de 6 dígitos para esta cuenta',
            'text=desde la app de autenticación en dos pasos que configuraste',
            'text=app de autenticación',
            'text=Duo Mobile',
            'text=Google Authenticator',
            'text=Confía en este dispositivo y omite este paso',
            
            // Textos parciales más flexibles
            ':text("Ve a tu app")',
            ':text("código de 6 dígitos")',
            ':text("app de autenticación")',
            ':text("Ingresa el código")',
            ':text("dos pasos")',
            ':text("autenticación en dos")',
            
            // Textos en español
            'text=código de',
            'text=código de verificación',
            'text=autenticación de dos factores',
            'text=Ingresa el código de 6 dígitos',
            'text=Revisa tu dispositivo de autenticación',
            'text=Código de seguridad',
            'text=Código',
            
            // Textos en inglés
            'text=authentication code',
            'text=two-factor',
            'text=verificación',
            'text=verification',
            'text=Enter the 6-digit code',
            'text=Check your authentication device',
            'text=Security code',
            'text=Two-Factor Authentication',
            'text=Go to your authentication app',
            
            // Selectores específicos por versión
            '[data-testid="2fa-form"]',
            '[role="dialog"]:has-text("código")',
            '[role="dialog"]:has-text("code")',
            'form:has-text("código de verificación")',
            'form:has-text("authentication code")',
            
            // Botones específicos del screenshot
            'button:has-text("Continuar")',
            'div[role="button"]:has-text("Continuar")',
            'button:has-text("Continue")',
            'div[role="button"]:has-text("Continue")',
            'button:has-text("Usar otro método")',
            'div[role="button"]:has-text("Usar otro método")',
            
            // Elementos contenedores específicos
            'div:has-text("Ve a tu app de autenticación")',
            'div:has-text("Ingresa el código de 6 dígitos")',
            'form:has-text("código de 6 dígitos")'
        ];
        
        console.log(`🔍 Probando ${twoFAIndicators.length} indicadores de 2FA...`);
        for (let i = 0; i < twoFAIndicators.length; i++) {
            const indicator = twoFAIndicators[i];
            try {
                const element = page.locator(indicator);
                if (await element.isVisible({ timeout: 2000 })) {
                    console.log(`🔐✅ Indicador de 2FA encontrado (${i+1}/${twoFAIndicators.length}): ${indicator}`);
                    console.log('💡 Sugerencia: Crear debug snapshot para 2FA desde server.js');
                    return true;
                } else {
                    console.log(`🔐❌ Indicador ${i+1}/${twoFAIndicators.length} no visible: ${indicator}`);
                }
            } catch (e) {
                console.log(`🔐⚠️ Error probando indicador ${i+1}/${twoFAIndicators.length}: ${indicator} - ${e.message}`);
                continue;
            }
        }
        
        // Verificación adicional por URL
        const currentUrl = page.url();
        console.log(`🔍 URL actual para verificar 2FA: ${currentUrl}`);
        const twoFAUrlPatterns = [
            'checkpoint',
            'two_factor',
            'approvals',
            'security',
            'verify',
            'auth-app',
            'authentication',
            'confirm',
            'mfa', // Multi-factor authentication
            'otp', // One-time password
            'factor'
        ];
        
        for (const pattern of twoFAUrlPatterns) {
            if (currentUrl.includes(pattern)) {
                console.log(`🔐 2FA detectado por URL: ${pattern}`);
                return true;
            }
        }
        
        console.log('✅ No se requiere 2FA');
        return false;
    } catch (error) {
        console.log('❌ Error verificando 2FA:', error.message);
        return false;
    }
}

/*─────────────────  EXPORTS  ──────────────────*/
module.exports = {
    // Utilidades
    sleep,
    randomDelay,
    getTimestamp,
    
    // Tecleo
    typeOptimized,
    typeSlowHuman,
    
    // Debug
    createDebugSnapshot,
    
    // Selectores
    SELECTORS,
    
    // Búsqueda
    findElement,
    detectFacebookVersion,
    getSelectorsForVersion,
    handleLoadingPage,
    handleSaveLoginDialog,
    waitForLoginButton,
    
    // Verificaciones
    checkLoginSuccess,
    checkFor2FA,
    
    // Gestión de cookies y cache
    saveCookies,
    loadCookies,
    saveSessionState,
    restoreSessionState,
    cleanOldSessions
}; 