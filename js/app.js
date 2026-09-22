// Controlador. Cablea los eventos, guarda el estado y reparte el trabajo entre
// el modelo, la vista, el mapa y el asistente.

import {
  loadData, getSummary, getCatalog, getZones, getZonesRanked,
  getDeprivations, getPrediction, getExplanation,
  login, logout, getSession, takeExpiredNotice, onUnauthorized
} from './model.js';

import { initMap, drawZones, flyToZone, fitMetroArea, setLargeMode } from './map.js';
import { greet, ask, getMessages, resetChat, SUGGESTIONS } from './chat.js';

import {
  renderSummary, renderBreadcrumb, renderDimensions, renderIndicators,
  setDimensionExpanded, renderIndicatorsNote, renderCollapseButton,
  renderMetrics, clearMetrics, renderDistribution,
  renderExplanation, renderDeprivations, renderMessages, renderSuggestions,
  renderLoginError, renderLoginNotice, setLoginBusy, renderSession
} from './view.js';

const refs = {
  loginScreenEl: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginSubmit: document.getElementById('login-submit'),
  loginErrorEl: document.getElementById('login-error'),
  loginNoticeEl: document.getElementById('login-notice'),

  appEl: document.getElementById('app'),
  sessionNameEl: document.getElementById('session-name'),
  sessionRoleEl: document.getElementById('session-role'),
  logoutBtn: document.getElementById('logout'),

  mapEl: document.getElementById('map'),
  mapPlaceholderEl: document.getElementById('map-placeholder'),
  mapBtn: document.getElementById('toggle-map'),
  mapBtnTextEl: document.getElementById('toggle-map-text'),
  mapPanelEl: document.getElementById('map-panel'),
  mapPanelBodyEl: document.getElementById('map-panel-body'),
  mapPanelLayerEl: document.getElementById('map-panel-layer'),
  closeMapBtn: document.getElementById('close-map'),

  breadcrumbEl: document.getElementById('breadcrumb'),
  summaryEl: document.getElementById('map-summary'),
  layerNameEl: document.getElementById('layer-name'),

  dimensionsEl: document.getElementById('dimension-list'),
  indicatorsNoteEl: document.getElementById('indicators-note'),
  collapseBtn: document.getElementById('collapse-dimensions'),

  householdsValueEl: document.getElementById('households-value'),
  groupAValueEl: document.getElementById('group-a-value'),
  scaleLabelEl: document.getElementById('scale-label'),
  predictedValueEl: document.getElementById('predicted-value'),
  predictedNoteEl: document.getElementById('predicted-note'),

  zoneNameEl: document.getElementById('zone-name'),
  sheetZoneEl: document.getElementById('sheet-zone'),
  sheetEl: document.getElementById('tech-sheet'),
  sheetBtn: document.getElementById('toggle-sheet'),
  sheetBtnTextEl: document.getElementById('toggle-sheet-text'),
  closeSheetBtn: document.getElementById('close-sheet'),
  sheetEmptyEl: document.getElementById('sheet-empty'),
  sheetBodyEl: document.getElementById('sheet-body'),
  distributionEl: document.getElementById('distribution-list'),
  driversEl: document.getElementById('drivers-list'),
  driversNoteEl: document.getElementById('drivers-note'),
  deprivationsEl: document.getElementById('deprivations-list'),

  chatEmptyEl: document.getElementById('chat-empty'),
  chatBodyEl: document.getElementById('chat-body'),
  messagesEl: document.getElementById('chat-messages'),
  suggestionsEl: document.getElementById('chat-suggestions'),
  chatForm: document.getElementById('chat-form'),
  chatInput: document.getElementById('chat-input')
};

const DEFAULT_LAYER = 'Hogares en grupo A (pobreza extrema)';

const state = {
  // Dimensiones abiertas, en el orden en que se abrieron. Se permiten varias a
  // la vez; la ultima abierta da nombre a la capa activa.
  openDimensions: [],
  selectedZone: null,
  deprivations: null,
  // Mapa ampliado y, si lo esta, si vive en el panel o crece en su sitio.
  mapLarge: false,
  mapInPanel: false,
  started: false
};

// Por debajo de este ancho la barra lateral y el asistente se apilan, y el panel
// del asistente queda fuera de la vista: el mapa crece en su sitio.
const compactLayout = window.matchMedia('(max-width: 1080px)');

const valueOf = (zone) => Number(zone.pct_grupo_a) * 100;

// ---------------------------------------------------------------
// Barra lateral: dimensiones como desplegables anidados
// ---------------------------------------------------------------
function refreshLayerName() {
  const last = state.openDimensions[state.openDimensions.length - 1];
  const name = last || DEFAULT_LAYER;
  refs.layerNameEl.textContent = name;
  refs.mapPanelLayerEl.textContent = name;
}

function refreshDimensions() {
  const catalog = getCatalog();
  const panels = renderDimensions(
    refs.dimensionsEl, catalog.dimensiones, state.openDimensions, selectDimension);

  panels.forEach(({ dimension, panel }) => {
    const indicators = catalog.indicadores.filter((item) => item.dimension === dimension);
    renderIndicators(panel, indicators, state.deprivations);
  });

  renderIndicatorsNote(refs.indicatorsNoteEl, state.deprivations);
  renderCollapseButton(refs.collapseBtn, state.openDimensions.length > 0);
  refreshLayerName();
}

// Pulsar una dimension abierta la cierra. Se conmuta en sitio, sin volver a
// pintar la lista, para no perder el foco del boton pulsado. No se llama a
// revealSection: saltaria la vista en cada clic.
function selectDimension(dimension, buttonEl, panelEl) {
  const open = !state.openDimensions.includes(dimension);

  state.openDimensions = open
    ? [...state.openDimensions, dimension]
    : state.openDimensions.filter((item) => item !== dimension);

  setDimensionExpanded(buttonEl, panelEl, open);
  renderCollapseButton(refs.collapseBtn, state.openDimensions.length > 0);
  refreshLayerName();

  if (open) buttonEl.closest('.dimension-item').scrollIntoView({ block: 'nearest' });
}

refs.collapseBtn.addEventListener('click', () => {
  state.openDimensions = [];
  refreshDimensions();
});

// ---------------------------------------------------------------
// Acordeones: un mismo boton abre y cierra su seccion
// ---------------------------------------------------------------
function toggleAccordion(button) {
  const bodyEl = document.getElementById(button.getAttribute('aria-controls'));
  if (!bodyEl) return;

  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  bodyEl.hidden = open;

  if (open) return;

  const section = button.closest('.accordion');
  // Sin requestAnimationFrame: leer getBoundingClientRect ya obliga a recalcular
  // la maqueta, y asi no depende de que se llegue a pintar un fotograma.
  if (section) revealSection(section);
}

// Primer ancestro que realmente puede desplazarse.
function scrollableParent(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
  }
  return null;
}

// Desplazamiento inmediato y no behavior smooth: hay navegadores que ignoran el
// desplazamiento suave dentro de un contenedor anidado y no hacen nada.
function revealSection(section) {
  const container = scrollableParent(section);

  if (container) {
    const delta = section.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTop += delta;
    return;
  }

  section.scrollIntoView({ block: 'nearest' });
}

// Las tarjetas de dimension tienen su propio manejador y no llevan la clase
// accordion-button; la exclusion explicita evita una doble conmutacion si en el
// futuro alguien se la añade.
document.addEventListener('click', (event) => {
  const button = event.target.closest('.accordion-button');
  if (button && !button.classList.contains('dimension-card')) toggleAccordion(button);
});

// ---------------------------------------------------------------
// Ficha tecnica: el mismo boton la abre y la cierra
// ---------------------------------------------------------------
function toggleSheet(show) {
  const open = show === undefined ? refs.sheetBtn.getAttribute('aria-expanded') !== 'true' : show;

  refs.sheetBtn.setAttribute('aria-expanded', String(open));
  refs.sheetBtn.classList.toggle('is-active', open);
  refs.sheetBtnTextEl.textContent = open ? 'Ocultar ficha técnica' : 'Ver ficha técnica';
  refs.sheetEl.hidden = !open;

  // Ficha y mapa ampliado comparten el area del asistente: solo uno a la vez.
  if (open && state.mapInPanel) setMapLarge(false);
  if (open) refs.closeSheetBtn.focus();
}

refs.sheetBtn.addEventListener('click', () => toggleSheet());

refs.closeSheetBtn.addEventListener('click', () => {
  toggleSheet(false);
  refs.sheetBtn.focus();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (!refs.sheetEl.hidden) {
    toggleSheet(false);
    refs.sheetBtn.focus();
  } else if (state.mapLarge) {
    setMapLarge(false);
    refs.mapBtn.focus();
  }
});

// ---------------------------------------------------------------
// Mapa ampliado: el mismo boton lo amplia y lo reduce
// ---------------------------------------------------------------
// En escritorio el nodo del mapa se mueve a un panel sobre el asistente, igual
// que la ficha tecnica. En pantallas compactas crece en su sitio, porque el
// asistente queda debajo de la barra y el panel no estaria a la vista. En los
// dos casos el estado de la aplicacion no se toca: la zona seleccionada, las
// dimensiones abiertas y la conversacion siguen como estaban.
function setMapLarge(on) {
  if (on === state.mapLarge) return;

  if (on) toggleSheet(false);

  state.mapLarge = on;
  state.mapInPanel = on && !compactLayout.matches;

  if (state.mapInPanel) {
    refs.mapPanelBodyEl.appendChild(refs.mapEl);
    refs.mapPanelEl.hidden = false;
    refs.mapPlaceholderEl.hidden = false;
    refs.mapBtn.setAttribute('aria-controls', 'map-panel');
  } else {
    if (refs.mapEl.parentElement !== refs.mapPlaceholderEl.parentElement) {
      refs.mapPlaceholderEl.before(refs.mapEl);
    }
    refs.mapPanelEl.hidden = true;
    refs.mapPlaceholderEl.hidden = true;
    refs.mapEl.classList.toggle('is-large', on);
    refs.mapBtn.setAttribute('aria-controls', 'map');
  }

  refs.mapBtn.setAttribute('aria-expanded', String(on));
  refs.mapBtn.classList.toggle('is-active', on);
  refs.mapBtnTextEl.textContent = on ? 'Reducir' : 'Ampliar';
  refs.mapBtn.setAttribute('aria-label', on ? 'Reducir el mapa' : 'Ampliar el mapa');

  // Tras mover o redimensionar el contenedor: invalidateSize, reencuadre,
  // rueda y rotulos.
  setLargeMode(on);
}

refs.mapBtn.addEventListener('click', () => setMapLarge(!state.mapLarge));

refs.closeMapBtn.addEventListener('click', () => {
  setMapLarge(false);
  refs.mapBtn.focus();
});

// Si la ventana cruza el punto de corte con el mapa ampliado, se reduce: el
// modo que se eligio al abrir ya no corresponde a la maqueta actual.
compactLayout.addEventListener('change', () => {
  if (state.mapLarge) setMapLarge(false);
});

// ---------------------------------------------------------------
// Mapa y navegacion
// ---------------------------------------------------------------
function refreshMap() {
  drawZones(
    getZones(), valueOf, selectZone,
    state.selectedZone ? state.selectedZone.zona_id : null,
    'Hogares en grupo A');
}

function refreshBreadcrumb() {
  const trail = [{ name: 'Área Metropolitana' }];
  if (state.selectedZone) trail.push({ name: state.selectedZone.zona_nombre });
  renderBreadcrumb(refs.breadcrumbEl, trail, showMetroArea);
}

function showMetroArea() {
  state.selectedZone = null;
  state.deprivations = null;

  refs.zoneNameEl.textContent = 'Área Metropolitana de Bucaramanga';
  refs.sheetZoneEl.textContent = 'Área Metropolitana de Bucaramanga';
  refs.chatEmptyEl.hidden = false;
  refs.chatBodyEl.hidden = true;
  refs.sheetEmptyEl.hidden = false;
  refs.sheetBodyEl.hidden = true;

  clearMetrics(refs);
  fitMetroArea();
  refreshBreadcrumb();
  refreshMap();
  refreshDimensions();
}

function selectZone(zone, zoomIn = true) {
  state.selectedZone = zone;
  state.deprivations = getDeprivations(zone.zona_id);

  refreshBreadcrumb();
  refreshMap();
  if (zoomIn) flyToZone(zone.cod_mpio);

  refs.zoneNameEl.textContent = zone.zona_nombre;
  refs.sheetZoneEl.textContent = zone.zona_nombre;
  refs.chatEmptyEl.hidden = true;
  refs.chatBodyEl.hidden = false;
  refs.sheetEmptyEl.hidden = true;
  refs.sheetBodyEl.hidden = false;

  greet(zone);
  renderMessages(refs.messagesEl, getMessages(zone.zona_id));
  renderSuggestions(refs.suggestionsEl, SUGGESTIONS, send);

  const prediction = getPrediction(zone.zona_id);
  const explanation = getExplanation(zone.zona_id);

  renderMetrics(refs, zone, prediction);
  renderDistribution(refs.distributionEl, zone, prediction);
  renderExplanation(refs.driversEl, refs.driversNoteEl, explanation);
  renderDeprivations(refs.deprivationsEl, state.deprivations);
  refreshDimensions();
}

// ---------------------------------------------------------------
// Asistente
// ---------------------------------------------------------------
function send(question) {
  const zone = state.selectedZone;
  if (!zone || !question.trim()) return;

  ask(zone, question.trim());
  renderMessages(refs.messagesEl, getMessages(zone.zona_id));
}

refs.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  send(refs.chatInput.value);
  refs.chatInput.value = '';
});

// ---------------------------------------------------------------
// Sesion
// ---------------------------------------------------------------

// Cierra la sesion de verdad: borra el token, el historial del asistente y
// recarga la pagina para descartar todo el estado en memoria (mapa, zona,
// cifras). replace y no assign, para no dejar la pagina autenticada en el
// historial del navegador.
function endSession(expired = false) {
  resetChat();
  logout({ expired });
  window.location.replace(window.location.pathname);
}

refs.logoutBtn.addEventListener('click', () => endSession(false));

// Un 401 de la API significa token vencido o revocado.
onUnauthorized(() => endSession(true));

// Los datos se sirven hoy desde el corte local, asi que ninguna peticion al
// backend detectaria la caducidad. El cliente la vigila por su cuenta con la
// fecha exp del token, tambien al volver a la pestaña tras suspender el equipo.
function watchExpiry(session) {
  const remaining = session.expiresAt - Date.now();
  if (remaining <= 0) {
    endSession(true);
    return;
  }

  setTimeout(() => endSession(true), Math.min(remaining, 2 ** 31 - 1));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !getSession()) endSession(true);
  });
}

function showLogin(expired) {
  refs.appEl.hidden = true;
  refs.loginScreenEl.hidden = false;
  renderLoginNotice(refs.loginNoticeEl, expired);
  refs.loginSubmit.disabled = false;
  refs.loginEmail.focus();
}

function enterApp(session) {
  refs.loginScreenEl.hidden = true;
  refs.appEl.hidden = false;
  renderSession(refs.sessionNameEl, refs.sessionRoleEl, session.user);
  watchExpiry(session);

  // La aplicacion se hace visible antes de arrancar: Leaflet necesita que el
  // contenedor del mapa tenga medidas reales al crearse.
  if (!state.started) {
    state.started = true;
    start();
  }
}

// La contraseña se lee del campo, se entrega a login() y el campo se vacia
// siempre, haya exito o error. No se guarda en ninguna variable persistente.
refs.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = refs.loginEmail.value.trim();
  if (!email || !refs.loginPassword.value) {
    renderLoginError(refs.loginErrorEl, 'empty');
    (email ? refs.loginPassword : refs.loginEmail).focus();
    return;
  }

  renderLoginError(refs.loginErrorEl, null);
  renderLoginNotice(refs.loginNoticeEl, false);
  setLoginBusy(refs.loginSubmit, true);

  try {
    const session = await login(email, refs.loginPassword.value);
    refs.loginPassword.value = '';
    enterApp(session);
  } catch (error) {
    refs.loginPassword.value = '';
    renderLoginError(refs.loginErrorEl, error.reason || 'server');
    refs.loginPassword.focus();
  } finally {
    setLoginBusy(refs.loginSubmit, false);
  }
});

// ---------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------
async function start() {
  try {
    await loadData();
  } catch (error) {
    refs.summaryEl.textContent = 'No se pudieron cargar los datos.';
    return;
  }

  initMap('map');
  renderSummary(refs.summaryEl, getSummary());
  refreshDimensions();
  refreshBreadcrumb();
  refreshMap();

  // Se abre sobre la zona con mayor pobreza extrema, sin acercar, para que la
  // vista inicial conserve toda el area metropolitana.
  selectZone(getZonesRanked()[0], false);
}

// Sin sesion vigente solo se muestra el login; start() espera a que haya token.
function boot() {
  const session = getSession();
  if (session) enterApp(session);
  else showLogin(takeExpiredNotice());
}

boot();
