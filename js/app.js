//js/app.js
import {
  loadData, getSummary, getCatalog, getZones, getZonesRanked, getDeprivations,
  getPrediction, getExplanation, getArea, login, getSession, logout, takeNotice, listUsers,
  createUser, setUserActive, deleteUser, profileAvailable, getProfile, requestNameChange,
  cancelNameChange, changePassword, listNameRequests, resolveNameRequest,
  assistantAvailable, askAssistant, interpretZone, summarizeConversation, buildZoneReport
} from './model.js';
import { initMap, drawZones, flyToZone, fitMetroArea, setLargeMode, refreshTheme } from './map.js';
import {
  greet, ask, reply, historyFor, startAnswer, finishAnswer, getMessages, suggestionsFor,
  conversationFor
} from './chat.js';
import {
  renderSummary, renderBreadcrumb, renderDimensions, renderIndicators, setDimensionExpanded,
  renderIndicatorsNote, renderCollapseButton, renderMetrics, clearMetrics,
  renderDistribution, renderZoneOptions, renderExplanation, renderDeprivations,
  renderMessages, renderLastMessage, renderSuggestions, roleLabel, renderSession,
  renderLoginError, renderLoginNotice, renderUsers, renderAdminSummary, renderAdminMessage,
  renderProfileFacts, renderNameStatus, renderNameRequests, renderPendingBadge,
  reportToXlsx, reportFileName, renderPrintReport, downloadFile
} from './view.js';

// Controlador.

const refs = {
  appEl: document.getElementById('app'),
  loginScreenEl: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginSubmit: document.getElementById('login-submit'),
  loginErrorEl: document.getElementById('login-error'),
  loginNoticeEl: document.getElementById('login-notice'),
  togglePasswordBtn: document.getElementById('toggle-password'),

  sessionNameEl: document.getElementById('session-name'),
  sessionRoleEl: document.getElementById('session-role'),
  adminBtn: document.getElementById('toggle-admin'),
  logoutBtn: document.getElementById('logout'),

  adminPanelEl: document.getElementById('admin-panel'),
  closeAdminBtn: document.getElementById('close-admin'),
  adminSummaryEl: document.getElementById('admin-summary'),
  adminMessageEl: document.getElementById('admin-message'),
  userListEl: document.getElementById('user-list'),
  userForm: document.getElementById('user-form'),
  newNameInput: document.getElementById('new-name'),
  newEmailInput: document.getElementById('new-email'),
  newPasswordInput: document.getElementById('new-password'),
  newRoleInput: document.getElementById('new-role'),
  createUserBtn: document.getElementById('create-user'),

  exportBtn: document.getElementById('toggle-export'),
  exportMenuEl: document.getElementById('export-menu'),
  printReportEl: document.getElementById('print-report'),

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
  chatInput: document.getElementById('chat-input'),
  chatSubmitBtn: document.getElementById('chat-submit'),
  zoneSelectEl: document.getElementById('zone-select'),
  metricsTitleEl: document.getElementById('metrics-title'),
  exportBtnTextEl: document.getElementById('toggle-export-text'),
  themeBtn: document.getElementById('toggle-theme'),
  loginThemeBtn: document.getElementById('login-theme'),

  adminPendingEl: document.getElementById('admin-pending'),
  requestsSectionEl: document.getElementById('requests-section'),
  requestListEl: document.getElementById('request-list'),

  profileBtn: document.getElementById('toggle-profile'),
  profilePanelEl: document.getElementById('profile-panel'),
  closeProfileBtn: document.getElementById('close-profile'),
  profileSummaryEl: document.getElementById('profile-summary'),
  profileMessageEl: document.getElementById('profile-message'),
  profileLocalEl: document.getElementById('profile-local'),
  profileFactsEl: document.getElementById('profile-facts'),
  nameHelpEl: document.getElementById('name-help'),
  nameStatusEl: document.getElementById('name-status'),
  nameForm: document.getElementById('name-form'),
  profileNameInput: document.getElementById('profile-name'),
  saveNameBtn: document.getElementById('save-name'),
  passwordForm: document.getElementById('password-form'),
  currentPasswordInput: document.getElementById('current-password'),
  newPassword1Input: document.getElementById('new-password-1'),
  newPassword2Input: document.getElementById('new-password-2'),
  savePasswordBtn: document.getElementById('save-password'),
  profileThemeBtn: document.getElementById('profile-theme')
};

const DEFAULT_LAYER = 'Hogares en grupo A (pobreza extrema)';

const state = {
  // Dimensiones abiertas, en el orden en que se abrieron.
  openDimensions: [],
  selectedZone: null,
  deprivations: null,
  // Mapa ampliado y, si lo está, si vive en el panel o crece en su sitio.
  mapLarge: false,
  mapInPanel: false,
  session: null,
  // Hay una respuesta de la IA en camino.
  waiting: false,
  started: false,
  adminOpen: false,
  profileOpen: false
};

// Por debajo de este ancho la barra lateral y el asistente se apilan, y el panel del
// asistente queda fuera de la vista: el mapa crece en su sitio.
const compactLayout = window.matchMedia('(max-width: 1080px)');

const valueOf = (zone) => Number(zone.pct_grupo_a) * 100;

// Barra lateral: dimensiones como desplegables anidados
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

// Pulsar una dimensión abierta la cierra.
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

// Acordeones: un mismo botón abre y cierra su sección
function toggleAccordion(button) {
  const bodyEl = document.getElementById(button.getAttribute('aria-controls'));
  if (!bodyEl) return;

  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  bodyEl.hidden = open;

  if (open) return;

  const section = button.closest('.accordion');
  // Sin requestAnimationFrame: leer getBoundingClientRect ya obliga a recalcular la
  // maqueta, y así no depende de que se llegue a pintar un fotograma.
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

// Las tarjetas de dimensión tienen su propio manejador y no llevan la clase
// accordion-button; la exclusión explícita evita una doble conmutación si en el futuro
// alguien se la añade.
document.addEventListener('click', (event) => {
  const button = event.target.closest('.accordion-button');
  if (button && !button.classList.contains('dimension-card')) toggleAccordion(button);
});

// Ficha técnica: el mismo botón la abre y la cierra
function toggleSheet(show) {
  const open = show === undefined ? refs.sheetBtn.getAttribute('aria-expanded') !== 'true' : show;

  refs.sheetBtn.setAttribute('aria-expanded', String(open));
  refs.sheetBtn.classList.toggle('is-active', open);
  refs.sheetBtnTextEl.textContent = open ? 'Ocultar ficha técnica' : 'Ver ficha técnica';
  refs.sheetEl.hidden = !open;

  // Ficha, mapa ampliado y administración comparten el área del asistente: solo uno a la
  // vez.
  if (open && state.mapInPanel) setMapLarge(false);
  if (open) toggleAdmin(false);
  if (open) toggleProfile(false);
  if (open) refs.closeSheetBtn.focus();
}

refs.sheetBtn.addEventListener('click', () => toggleSheet());

refs.closeSheetBtn.addEventListener('click', () => {
  toggleSheet(false);
  refs.sheetBtn.focus();
});

// Escape cierra lo que esté encima, de uno en uno.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (!refs.exportMenuEl.hidden) {
    toggleExportMenu(false);
    refs.exportBtn.focus();
  } else if (!refs.sheetEl.hidden) {
    toggleSheet(false);
    refs.sheetBtn.focus();
  } else if (state.adminOpen) {
    toggleAdmin(false);
    refs.adminBtn.focus();
  } else if (state.profileOpen) {
    toggleProfile(false);
    refs.profileBtn.focus();
  } else if (state.mapLarge) {
    setMapLarge(false);
    refs.mapBtn.focus();
  }
});

// Mapa ampliado: el mismo botón lo amplía y lo reduce
// En escritorio el nodo del mapa se mueve a un panel sobre el asistente, igual que la ficha
// técnica.
function setMapLarge(on) {
  if (on === state.mapLarge) return;

  if (on) toggleSheet(false);

  state.mapLarge = on;
  state.mapInPanel = on && !compactLayout.matches;

  if (state.mapInPanel) toggleAdmin(false);
  if (state.mapInPanel) toggleProfile(false);

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

  // Tras mover o redimensionar el contenedor: invalidateSize, reencuadre, rueda y
  // rótulos.
  setLargeMode(on);
}

refs.mapBtn.addEventListener('click', () => setMapLarge(!state.mapLarge));

refs.closeMapBtn.addEventListener('click', () => {
  setMapLarge(false);
  refs.mapBtn.focus();
});

// Si la ventana cruza el punto de corte con el mapa ampliado, se reduce: el modo que se
// eligió al abrir ya no corresponde a la maqueta actual.
compactLayout.addEventListener('change', () => {
  if (state.mapLarge) setMapLarge(false);
});

// Mapa y navegación
function isArea(zone) {
  return Boolean(zone && zone.isArea);
}

function refreshMap() {
  const zone = state.selectedZone;
  drawZones(getZones(), valueOf, selectZone, zone && !isArea(zone) ? zone.zona_id : null,
    'Hogares en grupo A');
}

function refreshBreadcrumb() {
  const trail = [{ name: 'Área Metropolitana' }];
  if (state.selectedZone && !isArea(state.selectedZone)) trail.push({ name: state.selectedZone.zona_nombre });
  renderBreadcrumb(refs.breadcrumbEl, trail, showMetroArea);
}

// Sin zona seleccionada se analiza el área metropolitana completa: para el chat, las
// métricas, la ficha y el reporte es una zona más.
function showMetroArea() {
  selectZone(getArea());
}

refs.zoneSelectEl.addEventListener('change', () => {
  const id = Number(refs.zoneSelectEl.value);
  const zone = id === getArea().zona_id ? getArea() : getZones().find((item) => item.zona_id === id);
  if (zone) selectZone(zone);
});

function selectZone(zone, zoomIn = true) {
  state.selectedZone = zone;
  state.deprivations = getDeprivations(zone.zona_id);

  // Elegir una zona en el mapa ampliado lo cierra: se elige para analizarla.
  const closedLarge = state.mapLarge;
  if (closedLarge) setMapLarge(false);

  refreshBreadcrumb();
  refreshMap();
  const move = () => (isArea(zone) ? fitMetroArea() : flyToZone(zone.cod_mpio));
  if (zoomIn && closedLarge) setTimeout(move, 350);
  else if (zoomIn) move();

  refs.zoneSelectEl.value = String(zone.zona_id);
  refs.metricsTitleEl.textContent = isArea(zone) ? 'Métricas del área' : 'Métricas de la zona';
  refs.chatInput.placeholder = isArea(zone)
    ? '¿Qué quiere saber sobre el área metropolitana?' : '¿Qué quiere saber sobre esta zona?';

  refs.zoneNameEl.textContent = zone.zona_nombre;
  refs.sheetZoneEl.textContent = zone.zona_nombre;
  refs.chatEmptyEl.hidden = true;
  refs.chatBodyEl.hidden = false;
  refs.sheetEmptyEl.hidden = true;
  refs.sheetBodyEl.hidden = false;
  refs.exportBtn.disabled = false;

  greet(zone, assistantAvailable());
  renderMessages(refs.messagesEl, getMessages(zone.zona_id));
  renderSuggestions(refs.suggestionsEl, suggestionsFor(zone, assistantAvailable()), send);
  setChatBusy(state.waiting);

  const prediction = getPrediction(zone.zona_id);
  const explanation = getExplanation(zone.zona_id);

  renderMetrics(refs, zone, prediction);
  renderDistribution(refs.distributionEl, zone, prediction);
  renderExplanation(refs.driversEl, refs.driversNoteEl, explanation, isArea(zone));
  renderDeprivations(refs.deprivationsEl, state.deprivations);
  refreshDimensions();
}

// Asistente
const AI_UNAVAILABLE =
  'La IA generativa no respondió, así que esta respuesta se armó con las cifras de la zona.';

// Una sola respuesta a la vez: Ollama atiende las peticiones en fila.
function setChatBusy(busy) {
  refs.chatInput.disabled = busy;
  refs.chatSubmitBtn.disabled = busy;
  refs.suggestionsEl.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
}

function isShowing(zoneId) {
  return Boolean(state.selectedZone && state.selectedZone.zona_id === zoneId);
}

// suggestion: texto escrito, o { text, kind } de una sugerencia.
async function send(suggestion) {
  const zone = state.selectedZone;
  const { text, kind } = typeof suggestion === 'string' ? { text: suggestion } : suggestion;
  const question = String(text).trim();
  if (!zone || !question || state.waiting) return;

  if (!assistantAvailable()) {
    ask(zone, question);
    renderMessages(refs.messagesEl, getMessages(zone.zona_id));
    return;
  }

  const zoneId = zone.zona_id;
  const history = historyFor(zoneId);
  const message = startAnswer(zone, question);
  const refresh = () => { if (isShowing(zoneId)) renderLastMessage(refs.messagesEl, message); };

  state.waiting = true;
  setChatBusy(true);
  renderMessages(refs.messagesEl, getMessages(zoneId));
  // Mientras no llega texto, el contador de segundos dice que sigue trabajando.
  const timer = window.setInterval(() => { if (!message.text) refresh(); }, 1000);

  let fallback = false;
  const onEvent = (event) => {
    if (event.tipo === 'meta') {
      // En modo plantilla el asistente devuelve las cifras en crudo; las plantillas
      // del navegador las presentan mejor.
      fallback = !String(event.generado_con).startsWith('ollama:');
      Object.assign(message, { engine: event.generado_con, sources: event.fuentes, warning: event.advertencia });
    } else if (event.tipo === 'texto' && !fallback) {
      message.text += event.delta;
      refresh();
    } else if (event.tipo === 'error') {
      throw Object.assign(new Error(event.detalle), event.codigo === 'ocupado' ? { code: 'limit' } : {});
    }
  };

  try {
    await (kind ? interpretZone(zoneId, kind, onEvent) : askAssistant(zoneId, question, history, onEvent));
    if (fallback || !message.text.trim()) throw new Error('Sin respuesta del modelo de lenguaje');
    finishAnswer(message, {});
  } catch (error) {
    if (error.code === 'expired') {
      endSession('expired');
      return;
    }
    // Límite de uso o asistente ocupado: la respuesta de plantilla, con el aviso de
    // esperar en vez del de "la IA no respondio".
    if (error.code === 'limit') {
      finishAnswer(message, { text: reply(zone, question), engine: null, note: error.message });
      return;
    }
    // Si ya se había escrito parte, se conserva y se avisa del corte.
    finishAnswer(message, message.text.trim() && !fallback
      ? { note: 'La respuesta se interrumpió antes de terminar.' }
      : { text: reply(zone, question), engine: null, note: AI_UNAVAILABLE });
  } finally {
    window.clearInterval(timer);
    state.waiting = false;
    setChatBusy(false);
    refresh();
    if (isShowing(zoneId)) refs.chatInput.focus();
  }
}

refs.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.waiting) return;
  send(refs.chatInput.value);
  refs.chatInput.value = '';
});

// Exportar reporte de la zona (HU-12): ambos roles
function toggleExportMenu(show) {
  const open = show === undefined ? refs.exportMenuEl.hidden : show;

  refs.exportMenuEl.hidden = !open;
  refs.exportBtn.setAttribute('aria-expanded', String(open));
  refs.exportBtn.classList.toggle('is-active', open);

  if (open) refs.exportMenuEl.querySelector('.menu-item').focus();
}

// Resumen de la conversación para el PDF.
async function conversationSummary(zone) {
  const conversation = conversationFor(zone.zona_id);
  if (!conversation.length) return null;

  const questions = conversation.filter((message) => message.rol === 'usuario')
    .map((message) => message.contenido);
  if (assistantAvailable()) {
    try {
      const answer = await summarizeConversation(zone.zona_id, conversation);
      if (String(answer.generado_con).startsWith('ollama:') && answer.texto.trim()) {
        return { text: answer.texto, engine: answer.generado_con, questions };
      }
    } catch (error) {
      if (error.code === 'expired') throw error;
    }
  }
  return { text: null, engine: null, questions };
}

function setExportBusy(busy) {
  refs.exportBtn.disabled = busy;
  refs.exportBtnTextEl.textContent = busy ? 'Preparando resumen…' : 'Exportar reporte';
}

async function exportReport(format) {
  const zone = state.selectedZone;
  if (!zone) return;

  const report = buildZoneReport(zone.zona_id);

  if (format === 'xlsx') {
    downloadFile(reportFileName(report, 'xlsx'), reportToXlsx(report), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return;
  }

  setExportBusy(true);
  try {
    report.conversation = await conversationSummary(zone);
  } catch (error) {
    if (error.code === 'expired') {
      endSession('expired');
      return;
    }
  } finally {
    setExportBusy(false);
  }

  // El navegador ofrece «Guardar como PDF» en el diálogo de impresión; así no hace falta
  // ninguna librería externa.
  renderPrintReport(refs.printReportEl, report);
  window.print();
}

refs.exportBtn.addEventListener('click', () => toggleExportMenu());

refs.exportMenuEl.addEventListener('click', (event) => {
  const item = event.target.closest('.menu-item');
  if (!item) return;

  toggleExportMenu(false);
  refs.exportBtn.focus();
  exportReport(item.dataset.format);
});

// Flechas entre las opciones del menú.
refs.exportMenuEl.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

  event.preventDefault();
  const items = [...refs.exportMenuEl.querySelectorAll('.menu-item')];
  const step = event.key === 'ArrowDown' ? 1 : -1;
  const next = (items.indexOf(document.activeElement) + step + items.length) % items.length;
  items[next].focus();
});

// Un clic fuera del menú lo cierra.
document.addEventListener('click', (event) => {
  if (!refs.exportMenuEl.hidden && !event.target.closest('.menu-wrap')) toggleExportMenu(false);
});

// Administración de usuarios (RF-09, HU-08): solo administrador
function toggleAdmin(show) {
  const open = show === undefined ? !state.adminOpen : show;
  if (open === state.adminOpen) return;
  if (open && (!state.session || state.session.role !== 'administrador')) return;

  if (open) {
    toggleSheet(false);
    toggleProfile(false);
    if (state.mapInPanel) setMapLarge(false);
  }

  state.adminOpen = open;
  refs.adminPanelEl.hidden = !open;
  refs.adminBtn.setAttribute('aria-expanded', String(open));
  refs.adminBtn.classList.toggle('is-active', open);

  if (!open) return;

  renderAdminMessage(refs.adminMessageEl, '');
  // En pantallas compactas el área del asistente queda debajo de la barra.
  if (compactLayout.matches) refs.adminPanelEl.scrollIntoView({ block: 'start' });
  refs.closeAdminBtn.focus();
  refreshUsers();
  refreshNameRequests();
}

// Solicitudes de cambio de nombre: la sección solo existe con backend.
async function refreshNameRequests() {
  const api = profileAvailable();
  refs.requestsSectionEl.hidden = !api;
  if (!api) return;

  try {
    const requests = await listNameRequests();
    renderNameRequests(refs.requestListEl, requests, resolveRequest);
    renderPendingBadge(refs.adminPendingEl, requests.length);
  } catch (error) {
    handleAdminError(error);
  }
}

async function resolveRequest(item, approve, reason, buttons) {
  buttons.forEach((button) => { button.disabled = true; });

  try {
    await resolveNameRequest(item.id, approve, reason);
    await Promise.all([refreshNameRequests(), refreshUsers()]);
    renderAdminMessage(refs.adminMessageEl, approve
      ? `${item.usuario.email} ahora se llama «${item.valor_nuevo}».`
      : `Se rechazó la solicitud de ${item.usuario.email}.`, 'ok');
  } catch (error) {
    buttons.forEach((button) => { button.disabled = false; });
    handleAdminError(error);
  }
}

function handleAdminError(error) {
  if (error.code === 'expired') {
    endSession('expired');
    return;
  }
  renderAdminMessage(refs.adminMessageEl, error.message || 'No se pudo completar la acción.', 'error');
}

async function refreshUsers() {
  try {
    const users = await listUsers();
    renderUsers(refs.userListEl, users, state.session.email, changeUserState, removeUser);
    renderAdminSummary(refs.adminSummaryEl, users);
    return users;
  } catch (error) {
    handleAdminError(error);
    return [];
  }
}

async function changeUserState(user, button) {
  button.disabled = true;

  try {
    await setUserActive(user, !user.activo);
    await refreshUsers();
    renderAdminMessage(refs.adminMessageEl,
      `${user.nombre} quedó ${user.activo ? 'desactivado' : 'activo'}.`, 'ok');
  } catch (error) {
    button.disabled = false;
    handleAdminError(error);
  }
}

async function removeUser(user, button) {
  const ok = window.confirm(
    `¿Eliminar a ${user.nombre} (${user.email})? No se puede deshacer: ` +
    'se borran su cuenta y sus escenarios guardados. La bitácora de auditoría se conserva.');
  if (!ok) return;

  button.disabled = true;

  try {
    await deleteUser(user);
    await refreshUsers();
    renderAdminMessage(refs.adminMessageEl, `${user.nombre} fue eliminado.`, 'ok');
  } catch (error) {
    button.disabled = false;
    handleAdminError(error);
  }
}

refs.adminBtn.addEventListener('click', () => toggleAdmin());

refs.closeAdminBtn.addEventListener('click', () => {
  toggleAdmin(false);
  refs.adminBtn.focus();
});

refs.userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  refs.createUserBtn.disabled = true;

  try {
    const user = await createUser({
      nombre: refs.newNameInput.value,
      email: refs.newEmailInput.value,
      password: refs.newPasswordInput.value,
      rol: refs.newRoleInput.value
    });

    refs.userForm.reset();
    await refreshUsers();
    renderAdminMessage(refs.adminMessageEl,
      `Usuario ${user.email} creado con el rol ${roleLabel(user.rol).toLowerCase()}.`, 'ok');
    refs.newNameInput.focus();
  } catch (error) {
    handleAdminError(error);
  } finally {
    refs.createUserBtn.disabled = false;
  }
});

// Mi perfil: todos los roles
function toggleProfile(show) {
  const open = show === undefined ? !state.profileOpen : show;
  if (open === state.profileOpen) return;
  if (open && !state.session) return;

  if (open) {
    toggleSheet(false);
    toggleAdmin(false);
    if (state.mapInPanel) setMapLarge(false);
  }

  state.profileOpen = open;
  refs.profilePanelEl.hidden = !open;
  refs.profileBtn.setAttribute('aria-expanded', String(open));
  refs.profileBtn.classList.toggle('is-active', open);

  if (!open) {
    refs.passwordForm.reset();
    return;
  }

  renderAdminMessage(refs.profileMessageEl, '');
  if (compactLayout.matches) refs.profilePanelEl.scrollIntoView({ block: 'start' });
  refs.closeProfileBtn.focus();
  refreshProfile();
}

function handleProfileError(error) {
  if (error.code === 'expired') {
    endSession('expired');
    return;
  }
  renderAdminMessage(refs.profileMessageEl, error.message || 'No se pudo completar la acción.', 'error');
}

// El nombre de la cabecera sigue al del perfil (puede haber cambiado por una solicitud
// aprobada mientras la sesión seguía abierta).
function showProfile(profile) {
  const admin = profile.rol === 'administrador';
  const api = !profile.local;

  renderProfileFacts(refs.profileFactsEl, profile);
  renderNameStatus(refs.nameStatusEl, profile, cancelRequest);
  refs.profileSummaryEl.textContent = `${profile.email} · ${admin ? 'Administrador' : 'Analista'}`;
  refs.profileLocalEl.hidden = api;
  refs.profilePanelEl.querySelectorAll('[data-needs-api]').forEach((section) => { section.hidden = !api; });

  refs.nameHelpEl.textContent = admin
    ? 'Como administrador, tu cambio de nombre se aplica de inmediato.'
    : 'Tu cambio de nombre lo revisa un administrador antes de aplicarse. Mientras tanto se sigue mostrando el actual.';
  refs.saveNameBtn.textContent = admin ? 'Guardar nombre' : 'Solicitar cambio';
  if (document.activeElement !== refs.profileNameInput) refs.profileNameInput.value = profile.nombre;

  if (state.session && profile.nombre !== state.session.name) {
    state.session = { ...state.session, name: profile.nombre };
    renderSession(refs, state.session);
  }
}

async function refreshProfile() {
  try {
    showProfile(await getProfile());
  } catch (error) {
    handleProfileError(error);
  }
}

async function cancelRequest(button) {
  button.disabled = true;
  try {
    showProfile(await cancelNameChange());
    renderAdminMessage(refs.profileMessageEl, 'Cancelaste tu solicitud de cambio de nombre.', 'ok');
  } catch (error) {
    button.disabled = false;
    handleProfileError(error);
  }
}

refs.profileBtn.addEventListener('click', () => toggleProfile());

refs.closeProfileBtn.addEventListener('click', () => {
  toggleProfile(false);
  refs.profileBtn.focus();
});

refs.nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  refs.saveNameBtn.disabled = true;

  try {
    const profile = await requestNameChange(refs.profileNameInput.value);
    showProfile(profile);
    renderAdminMessage(refs.profileMessageEl, profile.solicitud_pendiente
      ? 'Solicitud enviada. Un administrador la revisará.'
      : 'Tu nombre se actualizó.', 'ok');
  } catch (error) {
    handleProfileError(error);
  } finally {
    refs.saveNameBtn.disabled = false;
  }
});

refs.passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  refs.savePasswordBtn.disabled = true;

  try {
    const session = await changePassword(refs.currentPasswordInput.value,
      refs.newPassword1Input.value, refs.newPassword2Input.value);
    state.session = session;
    watchExpiry();
    refs.passwordForm.reset();
    renderAdminMessage(refs.profileMessageEl,
      'Contraseña cambiada. Se cerraron tus sesiones en otros equipos; esta sigue abierta.', 'ok');
    refreshProfile();
  } catch (error) {
    handleProfileError(error);
  } finally {
    // Las contraseñas no se quedan en el formulario, salga bien o mal.
    refs.currentPasswordInput.value = '';
    refs.savePasswordBtn.disabled = false;
  }
});

// Sesión (RF-01)
const LOGIN_MESSAGES = {
  // Genérico a propósito: no revela si falló el correo o la contraseña (flujo alternativo
  // 1 de RF-01).
  invalid: 'Correo o contraseña incorrectos.',
  inactive: 'Tu usuario está desactivado. Contacta al administrador.',
  throttled: 'Demasiados intentos de inicio de sesión desde esta red. Espera un minuto.',
  insecure: 'El inicio de sesión requiere una conexión segura (HTTPS o localhost).'
};

const NOTICES = {
  expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  logout: 'Cerraste la sesión correctamente.'
};

function loginMessage(error) {
  if (error.code === 'locked') {
    const minutes = error.minutes || 15;
    return `Demasiados intentos fallidos. Espera ${minutes} minuto${minutes === 1 ? '' : 's'} ` +
      'antes de volver a intentarlo.';
  }
  return LOGIN_MESSAGES[error.code] || 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

function hidePassword() {
  refs.loginPassword.type = 'password';
  refs.togglePasswordBtn.textContent = 'Mostrar';
  refs.togglePasswordBtn.setAttribute('aria-pressed', 'false');
}

function showLogin(notice) {
  refs.appEl.hidden = true;
  refs.loginScreenEl.hidden = false;
  renderLoginNotice(refs.loginNoticeEl, NOTICES[notice]);
  refs.loginSubmit.disabled = false;
  refs.loginEmail.focus();
}

let expiryTimer = null;

function watchExpiry() {
  clearTimeout(expiryTimer);
  const left = state.session.exp - Date.now();

  if (left <= 0) {
    endSession('expired');
    return;
  }
  expiryTimer = setTimeout(() => endSession('expired'), Math.min(left, 2147483647));
}

function enterApp(session) {
  state.session = session;
  refs.loginScreenEl.hidden = true;
  refs.appEl.hidden = false;

  renderSession(refs, session);
  watchExpiry();

  // El administrador ve en su botón cuántas solicitudes de nombre esperan.
  if (session.role === 'administrador') refreshNameRequests();

  // El mapa y los datos se montan solo con sesión, y una sola vez.
  if (!state.started) {
    state.started = true;
    start();
  }
}

// location.replace descarta todo el estado en memoria, incluida la conversación con cifras
// de las zonas, y no deja la vista autenticada en el historial del navegador.
function endSession(reason) {
  clearTimeout(expiryTimer);
  logout(reason);
  window.location.replace(window.location.pathname + window.location.search);
}

refs.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = refs.loginEmail.value.trim();
  const password = refs.loginPassword.value;

  // La contraseña solo vive en esta función: el campo se vacía en cada intento.
  refs.loginPassword.value = '';
  hidePassword();
  renderLoginNotice(refs.loginNoticeEl, '');

  if (!email || !password) {
    renderLoginError(refs.loginErrorEl, 'Escribe tu correo y tu contraseña.');
    (email ? refs.loginPassword : refs.loginEmail).focus();
    return;
  }

  refs.loginSubmit.disabled = true;
  refs.loginSubmit.textContent = 'Verificando…';
  renderLoginError(refs.loginErrorEl, '');

  try {
    enterApp(await login(email, password));
  } catch (error) {
    renderLoginError(refs.loginErrorEl, loginMessage(error));
    refs.loginPassword.focus();
  } finally {
    refs.loginSubmit.disabled = false;
    refs.loginSubmit.textContent = 'Iniciar sesión';
  }
});

refs.togglePasswordBtn.addEventListener('click', () => {
  const show = refs.loginPassword.type === 'password';

  refs.loginPassword.type = show ? 'text' : 'password';
  refs.togglePasswordBtn.textContent = show ? 'Ocultar' : 'Mostrar';
  refs.togglePasswordBtn.setAttribute('aria-pressed', String(show));
  refs.loginPassword.focus();
});

refs.logoutBtn.addEventListener('click', () => endSession('logout'));

// Al volver a la pestaña se revisa la caducidad: los temporizadores pueden dormirse con la
// pestaña en segundo plano.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.session && !getSession()) {
    endSession('expired');
  }
});

// Tema claro / oscuro
// El tema guardado ya se aplicó en <head>, antes de pintar.
const THEME_KEY = 'sd.theme';

function syncThemeButtons() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const label = dark ? 'Activar modo claro' : 'Activar modo oscuro';
  [refs.themeBtn, refs.loginThemeBtn].forEach((button) => {
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', label);
    button.title = label;
  });
  refs.profileThemeBtn.textContent = dark ? 'Usar modo claro' : 'Usar modo oscuro';
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;

  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch (error) {
    // Sin almacenamiento: el tema dura hasta recargar.
  }
  syncThemeButtons();
  refreshTheme();
}

refs.themeBtn.addEventListener('click', toggleTheme);
refs.loginThemeBtn.addEventListener('click', toggleTheme);
refs.profileThemeBtn.addEventListener('click', toggleTheme);
syncThemeButtons();

// Arranque
async function start() {
  refs.summaryEl.textContent = 'Cargando datos…';

  try {
    await loadData();
  } catch (error) {
    // Un 401 del backend al cargar: el token venció o se revocó.
    if (error.code === 'expired') {
      endSession('expired');
      return;
    }
    refs.summaryEl.textContent = 'No se pudieron cargar los datos.';
    refs.chatEmptyEl.textContent = state.session && state.session.mode === 'api'
      ? `No se pudieron cargar los indicadores desde el backend (${error.message}).`
      : 'No se pudieron cargar los indicadores (api/data.json). Comprueba que la carpeta api esté publicada.';
    return;
  }

  // Sin mapa la aplicación sigue siendo útil: métricas, indicadores, ficha y asistente no
  // dependen de él.
  try {
    initMap('map');
  } catch (error) {
    refs.mapEl.classList.add('map-unavailable');
    refs.mapEl.textContent = 'No se pudo cargar el mapa. Comprueba que la carpeta vendor/leaflet esté publicada.';
    refs.mapBtn.disabled = true;
  }

  renderSummary(refs.summaryEl, getSummary());
  refreshDimensions();
  refreshBreadcrumb();
  refreshMap();

  renderZoneOptions(refs.zoneSelectEl, getArea(), getZones());

  // Se abre sobre el área metropolitana completa: se puede analizar sin elegir ninguna
  // zona.
  selectZone(getArea(), false);
}

// No se arranca directamente: primero se comprueba si hay una sesión vigente.
function boot() {
  const session = getSession();
  if (session) enterApp(session);
  else showLogin(takeNotice());
}

boot();
