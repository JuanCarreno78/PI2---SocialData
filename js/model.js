//js/model.js
// ngrok gratuito muestra una página de aviso al navegador; con esta cabecera la omite.
const NGROK_HEADER = Object.freeze({ 'ngrok-skip-browser-warning': '1' });

// Capa de datos.

// Datos de indicadores

let data = null;

export async function loadData() {
  const session = getSession();
  data = session && session.mode === 'api' ? await loadFromApi() : await loadFromFile();
  addArea(data);
  return data;
}

// Área metropolitana como una zona más (zona_id 0)
// Así el chat, las métricas, la ficha y el reporte la tratan igual que a una zona.
export const AREA_ID = 0;

function weightedMean(pairs) {
  const valid = pairs.filter(([value]) => value !== null && value !== undefined);
  const weight = valid.reduce((sum, [, n]) => sum + n, 0);
  if (!weight) return null;
  return Math.round(valid.reduce((sum, [value, n]) => sum + Number(value) * n, 0) / weight * 10000) / 10000;
}

function addArea(d) {
  const zones = d.zonas;
  const households = (zone) => Number(zone.total_hogares);
  const total = zones.reduce((sum, zone) => sum + households(zone), 0);
  const counts = d.resumen.distribucion_grupos;

  const area = {
    zona_id: AREA_ID, isArea: true, cod_mpio: null, zona: 0,
    municipio: 'Área Metropolitana', zona_nombre: 'Área Metropolitana de Bucaramanga',
    total_hogares: total, total_personas: d.resumen.total_personas
  };
  ['a', 'b', 'c', 'd'].forEach((g) => {
    area[`pct_grupo_${g}`] = Math.round((counts[g.toUpperCase()] || 0) / total * 10000) / 10000;
  });
  Object.keys(zones[0])
    .filter((key) => (key.startsWith('pct_') && !key.startsWith('pct_grupo')) || key.startsWith('prom_'))
    .forEach((key) => { area[key] = weightedMean(zones.map((zone) => [zone[key], households(zone)])); });

  // Privaciones: la misma estructura que las de una zona.
  const first = d.detalle[String(zones[0].zona_id)].privaciones;
  const privaciones = {
    ...first, zona_id: AREA_ID, zona_nombre: area.zona_nombre, total_hogares: total,
    dimensiones: first.dimensiones.map((dim, i) => ({
      ...dim,
      indicadores: dim.indicadores.map((item, j) => ({
        ...item,
        prevalencia: weightedMean(zones.map((zone) => [
          d.detalle[String(zone.zona_id)].privaciones.dimensiones[i].indicadores[j].prevalencia,
          households(zone)]))
      }))
    }))
  };

  // Estimación del modelo: solo si está la de las ocho zonas.
  const predictions = zones.map((zone) => d.detalle[String(zone.zona_id)].prediccion);
  const prediccion = predictions.every(Boolean) ? {
    zona: { id: AREA_ID, nombre: area.zona_nombre, municipio: area.municipio },
    n_hogares: total,
    observado: { A: area.pct_grupo_a, B: area.pct_grupo_b, C: area.pct_grupo_c, D: area.pct_grupo_d },
    predicho: Object.fromEntries(['A', 'B', 'C', 'D'].map((g) => [g,
      weightedMean(zones.map((zone, i) => [predictions[i].predicho[g], households(zone)]))])),
    modelo: predictions[0].modelo
  } : null;

  // Los factores SHAP explican hogares de una zona: no hay versión del área.
  d.area = area;
  d.detalle[String(AREA_ID)] = { privaciones, prediccion, explicacion: null };
}

export function getArea() {
  return data.area;
}

// Corte de los indicadores publicado junto a la página.
async function loadFromFile() {
  const response = await fetch('api/data.json', { headers: NGROK_HEADER });

  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }

  return response.json();
}

// Predicción, explicación y ficha del modelo dependen de ia-predictor.
async function optional(pending) {
  try {
    return await pending;
  } catch (error) {
    if (error.code === 'expired') throw error;
    return null;
  }
}

// Arma el mismo objeto que api/data.json a partir de los endpoints del backend, que
// devuelven exactamente esas claves.
async function loadFromApi() {
  const [resumen, zonas, catalogo, modelo] = await Promise.all([
    request('/indicadores/resumen'),
    request('/indicadores/zonas'),
    request('/indicadores/catalogo'),
    optional(request('/ia/modelo'))
  ]);

  const detalle = {};
  await Promise.all(zonas.zonas.map(async (zone) => {
    const id = zone.zona_id;
    const [privaciones, prediccion, explicacion] = await Promise.all([
      request(`/indicadores/zonas/${id}/privaciones`),
      optional(request(`/ia/prediccion/${id}`)),
      optional(request(`/ia/explicacion/${id}?top=8`))
    ]);
    detalle[String(id)] = { privaciones, prediccion, explicacion };
  }));

  // generado queda en null: no es un corte publicado sino una consulta en vivo, y el
  // reporte lo dice así en vez de inventar una fecha de corte.
  return { generado: null, resumen, catalogo, modelo, zonas: zonas.zonas, detalle };
}

export function getSummary() {
  return data.resumen;
}

export function getCatalog() {
  return data.catalogo;
}

export function getModelCard() {
  return data.modelo;
}

export function getZones() {
  return data.zonas;
}

export function getZoneById(zoneId) {
  if (Number(zoneId) === AREA_ID) return data.area;
  return data.zonas.find((zone) => zone.zona_id === Number(zoneId));
}

export function getDeprivations(zoneId) {
  return data.detalle[String(zoneId)].privaciones;
}

export function getPrediction(zoneId) {
  return data.detalle[String(zoneId)].prediccion;
}

export function getExplanation(zoneId) {
  return data.detalle[String(zoneId)].explicacion;
}

// Zonas ordenadas de mayor a menor pobreza extrema.
export function getZonesRanked() {
  return [...data.zonas].sort((a, b) => Number(b.pct_grupo_a) - Number(a.pct_grupo_a));
}

// Sesión (RF-01, RNF-02)
// Dos modos: backend (JWT) o validación local de demostración.

// Versión con túnel: la dirección sale de config.js; con el proxy es '/api/v1'.
const API_URL = (window.SD_CONFIG && window.SD_CONFIG.apiUrl) || '/api/v1';

// Siempre hay backend detrás (el proxy o el túnel); si no responde, se usa la demostración.
const BACKEND_ENABLED = true;
const BACKEND_TIMEOUT_MS = 5000;

const SESSION_KEY = 'sd.session';
const NOTICE_KEY = 'sd.notice';
const USERS_KEY = 'sd.users';
const LOCKS_KEY = 'sd.locks';

// Mismos parámetros que backend/app/core/config.py.
const SESSION_MINUTES = 480;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const PBKDF2_ITERATIONS = 150000;

// Los usuarios de db/init/02_seed.sql.
const DEMO_USERS = [
  {
    id: 1, nombre: 'Administrador SocialData', email: 'admin@socialdata.co', rol: 'administrador',
    salt: 'nXBGed39PmzXJ9kp1zrqNw==', hash: '+6bSW/bgvGpU/v/UgC4eogYmWPHHvODmW4klyEjzyao='
  },
  {
    id: 2, nombre: 'Analista de la entidad', email: 'analista@socialdata.co', rol: 'analista',
    salt: 'Iek2KNYZflMnTkYLxPxKCA==', hash: 'pvMc2wBkYFGwY53+DJIwGRKw0I0xHRSfF3drsc8ZCvc='
  }
];

class AuthError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

async function derive(password, salt) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new AuthError('insecure', 'Se requiere un contexto seguro');
  }

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);

  return new Uint8Array(bits);
}

// Comparación que recorre siempre todos los bytes: no corta en el primero distinto.
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return { salt: toBase64(salt), hash: toBase64(hash) };
}

async function checkPassword(password, user) {
  const hash = await derive(password, fromBase64(user.salt));
  return sameBytes(hash, fromBase64(user.hash));
}

// Registro local: usuarios creados desde la administración y listas de desactivados y
// eliminados.
function localRegistry() {
  const stored = readJson(localStorage, USERS_KEY, {});
  return {
    created: stored.created || [],
    inactive: stored.inactive || [],
    deleted: stored.deleted || []
  };
}

function localUsers() {
  const registry = localRegistry();
  // "deleted" solo aplica a la semilla: si se crea otro usuario con ese correo, es uno
  // nuevo y se muestra.
  const seed = DEMO_USERS.filter((user) => !registry.deleted.includes(user.email));
  return [...seed, ...registry.created]
    .map((user) => ({ ...user, activo: !registry.inactive.includes(user.email) }));
}

function findLocalUser(email) {
  return localUsers().find((user) => user.email === email);
}

function lockOf(email) {
  return readJson(localStorage, LOCKS_KEY, {})[email] || { attempts: 0, until: 0 };
}

function saveLock(email, lock) {
  const locks = readJson(localStorage, LOCKS_KEY, {});
  if (lock) locks[email] = lock;
  else delete locks[email];
  writeJson(localStorage, LOCKS_KEY, locks);
}

// Mismo orden de comprobaciones que autenticar() del backend: usuario inexistente,
// desactivado, bloqueado y, por último, contraseña.
async function loginLocal(email, password) {
  const user = findLocalUser(email);

  // Con un correo inexistente también se deriva la clave: si no, la respuesta llegaría
  // mucho antes y delataría que correos están registrados.
  if (!user) {
    await derive(password, fromBase64(DEMO_USERS[0].salt));
    throw new AuthError('invalid', 'Credenciales inválidas');
  }
  if (!user.activo) throw new AuthError('inactive', 'El usuario está desactivado');

  const lock = lockOf(email);
  if (lock.until > Date.now()) {
    throw new AuthError('locked', 'Usuario bloqueado temporalmente',
      { minutes: Math.ceil((lock.until - Date.now()) / 60000) });
  }

  if (!(await checkPassword(password, user))) {
    const attempts = lock.attempts + 1;
    const until = attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60000 : 0;
    saveLock(email, { attempts, until });
    throw new AuthError('invalid', 'Credenciales inválidas');
  }

  saveLock(email, null);
  return {
    mode: 'local', email: user.email, name: user.nombre, role: user.rol,
    exp: Date.now() + SESSION_MINUTES * 60000
  };
}

function jwtClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    return JSON.parse(new TextDecoder().decode(fromBase64(padded)));
  } catch (error) {
    return {};
  }
}

async function loginApi(email, password) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(API_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...NGROK_HEADER },
      // Nombres de campo del esquema Credenciales del backend.
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  // 422: el backend valida el formato del correo con EmailStr.
  if (response.status === 401 || response.status === 422) {
    throw new AuthError('invalid', 'Credenciales inválidas');
  }
  if (response.status === 403) throw new AuthError('inactive', 'El usuario está desactivado');
  if (response.status === 429) {
    // Dos 429 distintos: la cuenta bloqueada tras 5 fallos, o demasiados intentos desde
    // la misma red (límite por IP del backend).
    const body = await response.json().catch(() => ({}));
    if (/desde esta red/.test(String(body.detail))) {
      throw new AuthError('throttled', 'Demasiados intentos desde esta red');
    }
    throw new AuthError('locked', 'Usuario bloqueado temporalmente', { minutes: LOCK_MINUTES });
  }
  if (!response.ok) throw new Error('HTTP ' + response.status);

  const body = await response.json();
  const claims = jwtClaims(body.access_token);

  return {
    mode: 'api', token: body.access_token,
    email: body.usuario.email, name: body.usuario.nombre, role: body.usuario.rol,
    exp: claims.exp ? claims.exp * 1000 : Date.now() + SESSION_MINUTES * 60000
  };
}

export async function login(email, password) {
  const normalized = String(email).trim().toLowerCase();
  let session = null;

  if (BACKEND_ENABLED) {
    try {
      session = await loginApi(normalized, password);
    } catch (error) {
      // Solo la falta de respuesta hace pasar al modo local.
      if (error instanceof AuthError || /^HTTP /.test(error.message)) throw error;
    }
  }

  if (!session) session = await loginLocal(normalized, password);

  writeJson(sessionStorage, SESSION_KEY, session);
  return session;
}

export function getSession() {
  const session = readJson(sessionStorage, SESSION_KEY, null);

  if (session && session.exp > Date.now()) return session;

  if (session) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(NOTICE_KEY, 'expired');
  }
  return null;
}

export function logout(notice = 'logout') {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.setItem(NOTICE_KEY, notice);
}

// Aviso que dejó la sesión anterior (cierre o caducidad).
export function takeNotice() {
  const notice = sessionStorage.getItem(NOTICE_KEY);
  sessionStorage.removeItem(NOTICE_KEY);
  return notice;
}

// Toda petición autenticada pasa por aquí: el token va en la cabecera y nunca en la URL.
async function request(path, options = {}) {
  const session = getSession();
  if (!session || session.mode !== 'api') throw new AuthError('expired', 'La sesión expiró');

  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...NGROK_HEADER,
      ...(options.headers || {}),
      Authorization: `Bearer ${session.token}`
    }
  });

  if (response.status === 401) throw new AuthError('expired', 'La sesión expiró');

  if (!response.ok) {
    let detail = 'HTTP ' + response.status;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') detail = body.detail;
      // 422: errores de validación de FastAPI, una lista.
      else if (Array.isArray(body.detail) && body.detail[0] && body.detail[0].msg) {
        detail = String(body.detail[0].msg).replace(/^Value error, /, '');
      }
    } catch (error) {
      // Sin cuerpo JSON: se queda el código HTTP.
    }
    throw new Error(detail);
  }

  // 204 (por ejemplo DELETE) no trae cuerpo.
  if (response.status === 204) return null;
  return response.json();
}

// Asistente de IA generativa (HU-18, HU-19)
// El modelo de lenguaje corre detrás del backend (ia-asistente + Ollama), así que solo
// existe con una sesión del backend.
export function assistantAvailable() {
  const session = getSession();
  return Boolean(session && session.mode === 'api');
}

// El modelo escribe a ~11 tokens/s: la respuesta llega en flujo (NDJSON) para mostrarla
// mientras se escribe.
async function requestStream(path, body, onEvent) {
  const session = getSession();
  if (!session || session.mode !== 'api') throw new AuthError('expired', 'La sesión expiró');

  const response = await fetch(API_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...NGROK_HEADER, Authorization: `Bearer ${session.token}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 401) throw new AuthError('expired', 'La sesión expiró');
  // 429: demasiadas consultas del usuario; 503: el asistente tiene la fila llena.
  if (response.status === 429 || response.status === 503) {
    let detail = 'El asistente está ocupado. Intenta de nuevo en un minuto.';
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch (error) {
      // Sin cuerpo JSON: queda el aviso genérico.
    }
    throw Object.assign(new Error(detail), { code: 'limit' });
  }
  if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      // Una línea puede llegar partida entre dos lecturas: la última espera.
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.filter((line) => line.trim()).forEach((line) => onEvent(JSON.parse(line)));

      if (done) break;
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer));
  } catch (error) {
    // Si onEvent corta (evento de error), se deja de leer el flujo.
    reader.cancel().catch(() => {});
    throw error;
  }
}

// historial: [{ rol: 'usuario' | 'asistente', contenido }], las claves que lee
// ia-asistente.
export function askAssistant(zoneId, question, history, onEvent) {
  return requestStream('/ia/chat/flujo', {
    pregunta: question, zona_id: zoneId === AREA_ID ? null : zoneId, historial: history
  }, onEvent);
}

// kind: 'interpretar' (conclusiones) o 'recomendar'.
export function interpretZone(zoneId, kind, onEvent) {
  const target = zoneId === AREA_ID ? 'area' : encodeURIComponent(zoneId);
  return requestStream(`/ia/interpretar/${target}/flujo?tipo=${encodeURIComponent(kind)}`,
    undefined, onEvent);
}

// Resumen de la conversación para el reporte en PDF (lo redacta la IA).
export function summarizeConversation(zoneId, history) {
  return request('/ia/resumir', {
    method: 'POST',
    body: JSON.stringify({ zona_id: zoneId === AREA_ID ? null : zoneId, historial: history })
  });
}

// Administración de usuarios (RF-09, HU-08)
// En modo API manda solo_administrador del backend.
function requireAdmin() {
  const session = getSession();
  if (!session) throw new AuthError('expired', 'La sesión expiró');
  if (session.role !== 'administrador') throw new Error('Acción reservada al administrador.');
  return session;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listUsers() {
  const session = requireAdmin();
  // La vista del backend envuelve la lista: {"usuarios": [...]}.
  if (session.mode === 'api') return (await request('/auth/usuarios')).usuarios;

  return localUsers().map(({ id, nombre, email, rol, activo }) => ({ id, nombre, email, rol, activo }));
}

// Mismas reglas que el esquema NuevoUsuario del backend.
export async function createUser({ nombre, email, password, rol }) {
  const session = requireAdmin();
  const user = {
    nombre: String(nombre).trim(),
    email: String(email).trim().toLowerCase(),
    password: String(password),
    rol
  };

  if (user.nombre.length < 3 || user.nombre.length > 120) {
    throw new Error('El nombre debe tener entre 3 y 120 caracteres.');
  }
  if (!EMAIL_PATTERN.test(user.email)) throw new Error('Escribe un correo válido.');
  if (user.password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  if (!['analista', 'administrador'].includes(user.rol)) throw new Error('Rol no válido.');

  if (session.mode === 'api') {
    return request('/auth/usuarios', { method: 'POST', body: JSON.stringify(user) });
  }

  if (findLocalUser(user.email)) throw new Error('Ya existe un usuario con ese correo.');

  const registry = localRegistry();
  const id = Math.max(...localUsers().map((item) => item.id)) + 1;
  const secret = await hashPassword(user.password);

  registry.created.push({ id, nombre: user.nombre, email: user.email, rol: user.rol, ...secret });
  writeJson(localStorage, USERS_KEY, registry);

  return { id, nombre: user.nombre, email: user.email, rol: user.rol, activo: true };
}

export async function setUserActive(user, active) {
  const session = requireAdmin();
  if (user.email === session.email) throw new Error('No puedes desactivar tu propio usuario.');

  if (session.mode === 'api') {
    return request(`/auth/usuarios/${encodeURIComponent(user.id)}/estado?activo=${active}`,
      { method: 'PATCH' });
  }

  const registry = localRegistry();
  registry.inactive = registry.inactive.filter((email) => email !== user.email);
  if (!active) registry.inactive.push(user.email);
  writeJson(localStorage, USERS_KEY, registry);

  return { ...user, activo: active };
}

// Mismas reglas que eliminar_usuario() del backend: nunca a uno mismo y solo a usuarios ya
// desactivados, para que borrar sea un segundo paso.
export async function deleteUser(user) {
  const session = requireAdmin();
  if (user.email === session.email) throw new Error('No puedes eliminar tu propio usuario.');
  if (user.activo) throw new Error('Desactiva el usuario antes de eliminarlo.');

  if (session.mode === 'api') {
    await request(`/auth/usuarios/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    return;
  }

  const current = findLocalUser(user.email);
  if (!current) throw new Error('Usuario no encontrado.');
  if (current.activo) throw new Error('Desactiva el usuario antes de eliminarlo.');

  // Los creados aquí se borran del todo; los de la semilla se marcan, porque vienen
  // escritos en el código.
  const registry = localRegistry();
  const created = registry.created.some((item) => item.email === user.email);
  registry.created = registry.created.filter((item) => item.email !== user.email);
  registry.inactive = registry.inactive.filter((email) => email !== user.email);
  if (!created) registry.deleted.push(user.email);
  writeJson(localStorage, USERS_KEY, registry);
  saveLock(user.email, null);
}

// Mi perfil
// Solo con backend: en modo local no hay dónde guardar una solicitud que apruebe otra
// persona, ni una contraseña que cambiar.
export function profileAvailable() {
  const session = getSession();
  return Boolean(session && session.mode === 'api');
}

function requireApi() {
  if (!profileAvailable()) throw new Error('Esta acción necesita la plataforma con el backend.');
}

// El backend devuelve una sesión nueva al cambiar la contraseña: las anteriores (incluida
// la de esta pestaña) dejaron de valer.
function replaceSession(body) {
  const session = getSession();
  const claims = jwtClaims(body.access_token);
  const next = {
    ...session, token: body.access_token,
    name: body.usuario ? body.usuario.nombre : session.name,
    exp: claims.exp ? claims.exp * 1000 : session.exp
  };
  writeJson(sessionStorage, SESSION_KEY, next);
  return next;
}

// El nombre puede cambiar por una solicitud aprobada mientras la sesión sigue.
function rememberName(name) {
  const session = getSession();
  if (session && name && session.name !== name) {
    writeJson(sessionStorage, SESSION_KEY, { ...session, name });
  }
}

export async function getProfile() {
  const session = getSession();
  if (!session) throw new AuthError('expired', 'La sesión expiró');
  if (session.mode !== 'api') {
    // Lo que el navegador sabe de la cuenta de demostración.
    return { nombre: session.name, email: session.email, rol: session.role, local: true };
  }
  const profile = await request('/perfil');
  rememberName(profile.nombre);
  return profile;
}

// Mismas reglas que el esquema CambioNombre del backend.
export async function requestNameChange(name) {
  requireApi();
  const nombre = String(name).replace(/\s+/g, ' ').trim();
  if (nombre.length < 3 || nombre.length > 120) {
    throw new Error('El nombre debe tener entre 3 y 120 caracteres.');
  }
  const profile = await request('/perfil/nombre', { method: 'POST', body: JSON.stringify({ nombre }) });
  rememberName(profile.nombre);
  return profile;
}

export async function cancelNameChange() {
  requireApi();
  return request('/perfil/nombre', { method: 'DELETE' });
}

// Mismas reglas que CambioClave del backend; el servidor revisa además que no sea una
// contraseña conocida ni contenga el correo.
export async function changePassword(current, next, repeat) {
  requireApi();
  if (!current) throw new Error('Escribe tu contraseña actual.');
  if (next.length < 12) throw new Error('La contraseña nueva debe tener al menos 12 caracteres.');
  if (next !== repeat) throw new Error('Las dos contraseñas nuevas no coinciden.');
  if (next === current) throw new Error('La contraseña nueva debe ser distinta de la actual.');
  const body = await request('/perfil/clave', {
    method: 'POST', body: JSON.stringify({ actual: current, nueva: next })
  });
  return replaceSession(body);
}

// Solicitudes de cambio de nombre: solo el administrador, solo con backend.
export async function listNameRequests() {
  const session = requireAdmin();
  if (session.mode !== 'api') return [];
  return (await request('/auth/solicitudes')).solicitudes;
}

export async function resolveNameRequest(id, approve, reason) {
  requireAdmin();
  requireApi();
  const path = `/auth/solicitudes/${encodeURIComponent(id)}/${approve ? 'aprobar' : 'rechazar'}`;
  return request(path, {
    method: 'POST',
    body: approve ? undefined : JSON.stringify({ motivo: String(reason || '').trim() || null })
  });
}

// Reporte de zona (HU-12)
// Solo cifras agregadas por zona: ningún identificador de hogar (RNF-02).
export function buildZoneReport(zoneId) {
  const zone = getZoneById(zoneId);
  const prediction = getPrediction(zoneId);
  const explanation = getExplanation(zoneId);
  const session = getSession();

  return {
    zone: zone.zona_nombre,
    isArea: Boolean(zone.isArea),
    municipality: zone.isArea ? data.resumen.cobertura : zone.municipio,
    households: Number(zone.total_hogares),
    people: Number(zone.total_personas),
    source: data.resumen.fuente,
    // Sin fecha de corte cuando los datos vienen en vivo del backend.
    dataDate: data.generado || 'Consulta en vivo a la base de datos del proyecto',
    exportedBy: session ? { name: session.name, role: session.role } : null,
    exportedAt: new Date(),
    observed: {
      A: Number(zone.pct_grupo_a), B: Number(zone.pct_grupo_b),
      C: Number(zone.pct_grupo_c), D: Number(zone.pct_grupo_d)
    },
    predicted: prediction ? prediction.predicho : null,
    indicators: getDeprivations(zoneId).dimensiones.flatMap((group) =>
      group.indicadores.map((item) => ({
        dimension: group.dimension, code: item.codigo, name: item.nombre, rate: item.prevalencia
      }))),
    predictedGroup: explanation ? explanation.grupo_predicho : null,
    drivers: ((explanation && explanation.contribuciones) || []).slice(0, 8).map((item) => ({
      name: item.etiqueta, dimension: item.dimension, weight: item.contribucion
    }))
  };
}
