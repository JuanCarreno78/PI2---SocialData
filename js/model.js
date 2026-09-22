// Capa de datos. No toca el DOM.
// Al conectar el backend solo cambia este archivo: las firmas se mantienen.

// ---------------------------------------------------------------
// Configuracion de la API
// ---------------------------------------------------------------
// Base de la API del backend. Es el unico valor que cambia entre entornos.
export const API_URL = 'http://localhost:8000/api/v1';

// Nombres de los campos que espera POST /auth/login. Si el esquema del backend
// usa otros nombres, se ajustan aqui y en ningun otro sitio.
const LOGIN_FIELDS = { email: 'correo', password: 'contrasena' };

// Duracion de la sesion en el backend (JWT_MINUTOS). Solo se usa si el token no
// trae el claim exp, para no dejar una sesion sin caducidad en el cliente.
const SESSION_MINUTES = 480;

// sessionStorage y no localStorage: la sesion muere al cerrar la pestaña.
const SESSION_KEY = 'socialdata.sesion';
const EXPIRED_KEY = 'socialdata.sesion-expirada';

// ---------------------------------------------------------------
// Sesion
// ---------------------------------------------------------------

// Error de autenticacion con un motivo que la vista traduce a un mensaje.
// Motivos: invalid (401), disabled (403), locked (429), network, server.
export class AuthError extends Error {
  constructor(reason, status = null) {
    super(reason);
    this.name = 'AuthError';
    this.reason = reason;
    this.status = status;
  }
}

const REASON_BY_STATUS = { 401: 'invalid', 403: 'disabled', 429: 'locked' };

function readStorage(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch (error) {
    // Sin almacenamiento (modo privado estricto) la sesion vive solo en memoria
    // hasta la siguiente recarga, que es el comportamiento mas seguro posible.
  }
}

let memorySession = null;

// Lee los claims del JWT sin verificar la firma. La verificacion la hace el
// backend; aqui solo interesan la caducidad y los datos de presentacion.
function readClaims(token) {
  try {
    const part = token.split('.')[1];
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return {};
  }
}

function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return String(value.nombre || value.name || '');
  return String(value);
}

// Normaliza la respuesta del login. Acepta el usuario dentro del cuerpo o, si
// no viene, lo toma de los claims del token.
function sessionFrom(body) {
  const token = body.access_token || body.token;
  if (!token) throw new AuthError('server');

  const claims = readClaims(token);
  const user = body.usuario || body.user || {};
  const expiresAt = claims.exp
    ? claims.exp * 1000
    : Date.now() + SESSION_MINUTES * 60 * 1000;

  return {
    token,
    expiresAt,
    user: {
      name: textOf(user.nombre || user.nombre_completo || user.name || claims.nombre) ||
            textOf(user.correo || user.email || claims.sub),
      role: textOf(user.rol || user.role || claims.rol || claims.role)
    }
  };
}

function saveSession(session) {
  memorySession = session;
  writeStorage(SESSION_KEY, JSON.stringify(session));
}

// La contraseña solo existe como argumento de esta funcion: se envia en el
// cuerpo del POST y no se guarda en ninguna variable de modulo ni almacenamiento.
export async function login(email, password) {
  let response;

  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [LOGIN_FIELDS.email]: email, [LOGIN_FIELDS.password]: password })
    });
  } catch (error) {
    throw new AuthError('network');
  }

  if (!response.ok) {
    throw new AuthError(REASON_BY_STATUS[response.status] || 'server', response.status);
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new AuthError('server', response.status);
  }

  const session = sessionFrom(body);
  saveSession(session);
  writeStorage(EXPIRED_KEY, null);
  return session;
}

// Sesion vigente o null. Una sesion caducada se descarta al leerla.
export function getSession() {
  let session = memorySession;

  if (!session) {
    const raw = readStorage(SESSION_KEY);
    if (!raw) return null;
    try {
      session = JSON.parse(raw);
    } catch (error) {
      writeStorage(SESSION_KEY, null);
      return null;
    }
  }

  if (!session || !session.token || !session.expiresAt || Date.now() >= session.expiresAt) {
    logout({ expired: Boolean(session && session.token) });
    return null;
  }

  memorySession = session;
  return session;
}

export function getToken() {
  const session = getSession();
  return session ? session.token : null;
}

// Borra el token. Con expired se deja constancia para que la pantalla de login
// explique por que se volvio a ella.
export function logout({ expired = false } = {}) {
  memorySession = null;
  writeStorage(SESSION_KEY, null);
  writeStorage(EXPIRED_KEY, expired ? '1' : null);
}

// Devuelve si la ultima sesion termino por caducidad y consume el aviso.
export function takeExpiredNotice() {
  const expired = readStorage(EXPIRED_KEY) === '1';
  writeStorage(EXPIRED_KEY, null);
  return expired;
}

let unauthorizedHandler = () => {};

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

// Punto unico por el que pasan las peticiones autenticadas a la API. El token
// viaja siempre en la cabecera Authorization, nunca en la URL.
export async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(API_URL + path, { ...options, headers });

  if (response.status === 401) {
    logout({ expired: true });
    unauthorizedHandler();
    throw new Error('Sesión expirada');
  }

  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.status === 204 ? null : response.json();
}

// ---------------------------------------------------------------
// Datos de indicadores
// ---------------------------------------------------------------

let data = null;

// Corte local de los indicadores. Pasara a request('/...') cuando el backend
// publique los endpoints de datos; el resto de funciones no cambia.
export async function loadData() {
  const response = await fetch('api/data.json');

  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }

  data = await response.json();
  return data;
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
