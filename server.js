const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;

loadEnvFile(path.join(ROOT, '.env'));

const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';
const runtimeSessionSecret = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
  ? process.env.SESSION_SECRET
  : crypto.randomBytes(32).toString('base64url');

const CONFIG = {
  baseUrl: (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, ''),
  payphoneApiUrl: process.env.PAYPHONE_API_URL || 'https://pay.payphonetodoesposible.com/api/Sale',
  payphoneToken: process.env.PAYPHONE_TOKEN || '',
  payphoneStoreId: process.env.PAYPHONE_STORE_ID || '',
  payphoneReferencePrefix: process.env.PAYPHONE_REFERENCE_PREFIX || 'GENIOSBOT',
  deferredEnabled: process.env.PAYPHONE_DEFERRED_ENABLED !== 'false',
  deferredInstallments: (process.env.PAYPHONE_DEFERRED_INSTALLMENTS || '3,6,9,12')
    .split(',')
    .map(value => Number(value.trim()))
    .filter(Boolean),
  payphoneCardTypeField: process.env.PAYPHONE_CARD_TYPE_FIELD || 'cardType',
  payphoneCreditPlanField: process.env.PAYPHONE_CREDIT_PLAN_FIELD || 'creditPlan',
  payphoneInstallmentsField: process.env.PAYPHONE_INSTALLMENTS_FIELD || 'installments',
  sessionSecret: runtimeSessionSecret,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || ''
};

const PLANS = {
  mensual_1: {
    id: 'mensual_1',
    name: 'Formación mensual',
    type: '1 mes de estudio',
    months: 1,
    amountCents: 9000,
    savingsCents: 0
  },
  bimestre_2: {
    id: 'bimestre_2',
    name: 'Formación 2 meses',
    type: '2 meses de estudio',
    months: 2,
    amountCents: 17500,
    savingsCents: 500
  },
  trimestre_3: {
    id: 'trimestre_3',
    name: 'Formación trimestral',
    type: '3 meses de estudio',
    months: 3,
    amountCents: 25500,
    savingsCents: 1500
  },
  semestre_6: {
    id: 'semestre_6',
    name: 'Formación semestral',
    type: '6 meses de estudio',
    months: 6,
    amountCents: 48500,
    savingsCents: 5500
  },
  anual_12: {
    id: 'anual_12',
    name: 'Formación anual',
    type: '12 meses de estudio',
    months: 12,
    amountCents: 92000,
    savingsCents: 16000
  }
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const loginAttempts = new Map();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]\n');
}

function requireProductionSecrets() {
  if (!IS_PROD) return;
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.warn('SESSION_SECRET no está configurado. Se usará un secreto efímero; las sesiones se cerrarán al reiniciar.');
  }
  if (!CONFIG.adminPasswordHash) {
    console.warn('ADMIN_PASSWORD_HASH no está configurado. El panel administrador queda deshabilitado hasta configurarlo.');
  }
}

requireProductionSecrets();

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...securityHeaders(),
    ...headers
  });
  res.end(payload);
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  };
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
    const index = cookie.indexOf('=');
    return [cookie.slice(0, index).trim(), decodeURIComponent(cookie.slice(index + 1))];
  }));
}

function sign(value) {
  return crypto.createHmac('sha256', CONFIG.sessionSecret).update(value).digest('base64url');
}

function createSessionCookie(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + 1000 * 60 * 60 * 8
  })).toString('base64url');
  const cookie = `gb_session=${payload}.${sign(payload)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`;
  return IS_PROD ? `${cookie}; Secure` : cookie;
}

function clearSessionCookie() {
  return `gb_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${IS_PROD ? '; Secure' : ''}`;
}

function getSession(req) {
  const cookie = parseCookies(req).gb_session;
  if (!cookie || !cookie.includes('.')) return null;
  const [payload, signature] = cookie.split('.');
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function isAdmin(req) {
  return getSession(req)?.username === CONFIG.adminUsername;
}

function readJsonBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(new Error('El cuerpo de la solicitud es demasiado grande.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function readOrders() {
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}

function writeOrders(orders) {
  const tmp = `${ORDERS_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(orders, null, 2)}\n`);
  fs.renameSync(tmp, ORDERS_FILE);
}

function saveOrder(order) {
  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
}

function updateOrder(orderId, patch) {
  const orders = readOrders();
  const index = orders.findIndex(order => order.id === orderId);
  if (index === -1) return null;
  orders[index] = { ...orders[index], ...patch, updatedAt: new Date().toISOString() };
  writeOrders(orders);
  return orders[index];
}

function sanitizeText(value, maxLength = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function validateCheckout(data) {
  const plan = PLANS[data.planId];
  const buyer = sanitizeText(data.buyer);
  const age = Number(data.age);
  const interest = sanitizeText(data.interest, 80);
  const schedule = sanitizeText(data.schedule, 80);
  const payment = sanitizeText(data.payment, 80);
  const cardType = sanitizeText(data.cardType, 20) || 'credit';
  const creditPlan = sanitizeText(data.creditPlan, 20) || 'current';
  const installments = Number(data.installments || 0);
  const phone = sanitizeText(data.phone || '', 40);
  const email = sanitizeText(data.email || '', 120);

  if (!plan) throw new Error('Selecciona un plan válido.');
  if (buyer.length < 2) throw new Error('Ingresa el nombre del representante.');
  if (!Number.isInteger(age) || age < 5 || age > 18) throw new Error('Ingresa una edad válida entre 5 y 18 años.');
  if (!interest) throw new Error('Selecciona el área de interés.');
  if (!schedule) throw new Error('Selecciona un horario preferido.');
  if (!['debit', 'credit'].includes(cardType)) throw new Error('Selecciona débito o crédito.');
  if (cardType === 'credit' && !['current', 'deferred'].includes(creditPlan)) throw new Error('Selecciona crédito corriente o diferido.');
  if (cardType === 'debit' && creditPlan === 'deferred') throw new Error('El diferido solo aplica para tarjeta de crédito.');
  if (creditPlan === 'deferred') {
    if (!CONFIG.deferredEnabled) throw new Error('El diferido no está habilitado todavía.');
    if (!CONFIG.deferredInstallments.includes(installments)) throw new Error('Selecciona un plazo de diferido válido.');
  }

  return { plan, buyer, age, interest, schedule, payment, cardType, creditPlan, installments, phone, email };
}

function money(amountCents) {
  return `$${(amountCents / 100).toFixed(2)}`;
}

async function createPayphonePayment(order) {
  if (!CONFIG.payphoneToken) {
    return {
      configured: false,
      message: 'PAYPHONE_TOKEN no está configurado. La orden quedó guardada como pendiente.'
    };
  }

  const responseUrl = `${CONFIG.baseUrl}/pago-exitoso?order=${encodeURIComponent(order.id)}`;
  const cancellationUrl = `${CONFIG.baseUrl}/pago-cancelado?order=${encodeURIComponent(order.id)}`;
  const payload = {
    amount: order.amountCents,
    amountWithoutTax: order.amountCents,
    amountWithTax: 0,
    tax: 0,
    service: 0,
    tip: 0,
    currency: 'USD',
    clientTransactionId: order.id,
    reference: `${CONFIG.payphoneReferencePrefix}-${order.id}`,
    responseUrl,
    cancellationUrl
  };

  if (CONFIG.payphoneStoreId) {
    payload.storeId = CONFIG.payphoneStoreId;
  }

  payload[CONFIG.payphoneCardTypeField] = order.cardType;
  payload[CONFIG.payphoneCreditPlanField] = order.creditPlan;
  if (order.creditPlan === 'deferred') {
    payload[CONFIG.payphoneInstallmentsField] = order.installments;
  }

  const response = await fetch(CONFIG.payphoneApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CONFIG.payphoneToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `PayPhone respondió HTTP ${response.status}`);
  }

  const paymentUrl = data.paymentUrl || data.payUrl || data.url || data.link || data.payWithCard || data.redirectUrl || '';
  return {
    configured: true,
    paymentUrl,
    response: data
  };
}

async function handleCheckout(req, res) {
  try {
    const input = validateCheckout(await readJsonBody(req));
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      status: 'created',
      createdAt: now,
      updatedAt: now,
      planId: input.plan.id,
      planName: input.plan.name,
      planType: input.plan.type,
      studyMonths: input.plan.months,
      amountCents: input.plan.amountCents,
      amountLabel: money(input.plan.amountCents),
      savingsCents: input.plan.savingsCents,
      savingsLabel: money(input.plan.savingsCents),
      buyer: input.buyer,
      age: input.age,
      interest: input.interest,
      schedule: input.schedule,
      paymentMethod: input.payment || 'PayPhone',
      cardType: input.cardType,
      creditPlan: input.cardType === 'credit' ? input.creditPlan : 'debit',
      installments: input.creditPlan === 'deferred' ? input.installments : null,
      phone: input.phone,
      email: input.email
    };

    saveOrder(order);

    try {
      const payphone = await createPayphonePayment(order);
      updateOrder(order.id, {
        status: payphone.configured ? 'payment_created' : 'pending_payphone_config',
        payphone
      });
      send(res, 201, {
        ok: true,
        orderId: order.id,
        status: payphone.configured ? 'payment_created' : 'pending_payphone_config',
        paymentUrl: payphone.paymentUrl || '',
        payphoneConfigured: payphone.configured,
        message: payphone.configured
          ? 'Orden creada. Redirigiendo a PayPhone.'
          : payphone.message
      });
    } catch (error) {
      updateOrder(order.id, {
        status: 'payment_error',
        paymentError: error.message
      });
      send(res, 502, {
        ok: false,
        orderId: order.id,
        message: `No se pudo crear el pago en PayPhone: ${error.message}`
      });
    }
  } catch (error) {
    send(res, 400, { ok: false, message: error.message });
  }
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return !IS_PROD && password === 'admin123';
  }

  const [algorithm, iterations, salt, hash] = storedHash.split(':');
  if (algorithm !== 'pbkdf2-sha256') return false;
  const candidate = crypto.pbkdf2Sync(password, salt, Number(iterations), 32, 'sha256').toString('base64url');
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

function tooManyLoginAttempts(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter(timestamp => now - timestamp < 15 * 60 * 1000);
  attempts.push(now);
  loginAttempts.set(ip, attempts);
  return attempts.length > 8;
}

async function handleAdminLogin(req, res) {
  try {
    if (IS_PROD && !CONFIG.adminPasswordHash) {
      send(res, 503, { ok: false, message: 'Admin no configurado. Define ADMIN_PASSWORD_HASH en variables de entorno.' });
      return;
    }

    if (tooManyLoginAttempts(req)) {
      send(res, 429, { ok: false, message: 'Demasiados intentos. Intenta más tarde.' });
      return;
    }

    const { username, password } = await readJsonBody(req);
    if (username === CONFIG.adminUsername && verifyPassword(String(password || ''), CONFIG.adminPasswordHash)) {
      send(res, 200, { ok: true }, { 'Set-Cookie': createSessionCookie(username) });
      return;
    }

    send(res, 401, { ok: false, message: 'Credenciales inválidas.' });
  } catch (error) {
    send(res, 400, { ok: false, message: error.message });
  }
}

function handleAdminOrders(req, res) {
  if (!isAdmin(req)) {
    send(res, 401, { ok: false, message: 'No autorizado.' });
    return;
  }
  send(res, 200, { ok: true, orders: readOrders() });
}

async function handleAdminOrderPatch(req, res, orderId) {
  if (!isAdmin(req)) {
    send(res, 401, { ok: false, message: 'No autorizado.' });
    return;
  }

  try {
    const data = await readJsonBody(req);
    const allowed = new Set(['created', 'payment_created', 'paid', 'pending_payphone_config', 'payment_error', 'cancelled', 'contacted']);
    const status = sanitizeText(data.status, 40);
    if (!allowed.has(status)) throw new Error('Estado inválido.');
    const order = updateOrder(orderId, { status });
    if (!order) {
      send(res, 404, { ok: false, message: 'Orden no encontrada.' });
      return;
    }
    send(res, 200, { ok: true, order });
  } catch (error) {
    send(res, 400, { ok: false, message: error.message });
  }
}

function serveFile(req, res, pathname) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const publicFiles = new Set([
    '/index.html',
    '/styles.css',
    '/script.js',
    '/login.html',
    '/login.js',
    '/admin.html',
    '/admin.js'
  ]);

  if (cleanPath === '/admin' || cleanPath === '/admin.html') {
    if (!isAdmin(req)) {
      res.writeHead(302, { Location: '/login.html', ...securityHeaders() });
      res.end();
      return;
    }
    pathname = '/admin.html';
  } else if (cleanPath === '/pago-exitoso' || cleanPath === '/pago-cancelado') {
    pathname = '/index.html';
  } else {
    pathname = cleanPath;
  }

  if (!publicFiles.has(pathname) && !pathname.startsWith('/assets/')) {
    send(res, 404, 'No encontrado.');
    return;
  }

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Ruta no permitida.');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, 'No encontrado.');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
      ...securityHeaders()
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, CONFIG.baseUrl);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    send(res, 200, { ok: true, service: 'geniosbot' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    await handleCheckout(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    await handleAdminLogin(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    send(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    handleAdminOrders(req, res);
    return;
  }

  const patchMatch = url.pathname.match(/^\/api\/admin\/orders\/([a-f0-9-]+)$/);
  if (req.method === 'PATCH' && patchMatch) {
    await handleAdminOrderPatch(req, res, patchMatch[1]);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Método no permitido.');
    return;
  }

  serveFile(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`GeniosBot listo en http://${HOST}:${PORT}`);
});
