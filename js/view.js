// Renderizado del DOM. No consulta el modelo ni decide nada: recibe datos ya
// resueltos y los pinta.

import { scaleOf } from './map.js';

const SCALE_LABELS = {
  low: 'Prevalencia baja',
  medium: 'Prevalencia media',
  high: 'Prevalencia alta',
  'no-data': 'Sin datos'
};

const GROUPS = ['A', 'B', 'C', 'D'];

const GROUP_NAMES = {
  A: 'Pobreza extrema',
  B: 'Pobreza moderada',
  C: 'Vulnerable',
  D: 'No pobre ni vulnerable'
};

export function formatRatio(value) {
  return `${(Number(value) * 100).toFixed(1).replace('.', ',')}%`;
}

export function formatPercent(value) {
  return `${Number(value).toFixed(1).replace('.', ',')}%`;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderSummary(summaryEl, summary) {
  summaryEl.textContent =
    `${summary.total_hogares.toLocaleString('es-CO')} hogares · ` +
    `${summary.total_personas.toLocaleString('es-CO')} personas · ` +
    `${formatRatio(summary.pct_pobreza_extrema)} en grupo A`;
}

export function renderBreadcrumb(breadcrumbEl, trail, onNavigate) {
  breadcrumbEl.textContent = '';

  trail.forEach((step, index) => {
    const last = index === trail.length - 1;
    const item = document.createElement('li');
    const button = document.createElement('button');

    button.type = 'button';
    button.classList.add('crumb');
    if (last) button.classList.add('is-active');
    button.textContent = step.name;
    if (!last) button.addEventListener('click', () => onNavigate(step));

    item.appendChild(button);
    breadcrumbEl.appendChild(item);
  });
}

// Cada dimension es un desplegable: su boton y, justo debajo, el panel con sus
// indicadores. Abrir una empuja hacia abajo las siguientes.
//
// La tarjeta no lleva la clase accordion-button a proposito: el manejador
// delegado de los acordeones la conmutaria una segunda vez en el mismo clic.
//
// Devuelve el panel de cada dimension para que el controlador lo rellene.
export function renderDimensions(listEl, dimensions, openDimensions, onToggle) {
  listEl.textContent = '';

  return dimensions.map((dimension, index) => {
    const open = openDimensions.includes(dimension.dimension);
    const panelId = `dimension-panel-${index + 1}`;

    const item = document.createElement('div');
    item.classList.add('dimension-item');
    item.setAttribute('role', 'listitem');

    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('dimension-card');
    button.setAttribute('aria-controls', panelId);
    button.innerHTML = `
      <span class="dimension-index">${index + 1}</span>
      <span class="dimension-text">
        <span class="dimension-name">${escapeHtml(dimension.dimension)}</span>
        <span class="dimension-count">${dimension.n} indicadores</span>
      </span>
      <span class="dimension-chevron" aria-hidden="true"></span>`;

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.classList.add('dimension-panel');
    panel.setAttribute('role', 'list');
    panel.setAttribute('aria-label', `Indicadores de ${dimension.dimension}`);

    setDimensionExpanded(button, panel, open);
    button.addEventListener('click', () => onToggle(dimension.dimension, button, panel));

    item.append(button, panel);
    listEl.appendChild(item);

    return { dimension: dimension.dimension, panel };
  });
}

export function setDimensionExpanded(buttonEl, panelEl, open) {
  buttonEl.setAttribute('aria-expanded', String(open));
  buttonEl.classList.toggle('is-active', open);
  panelEl.hidden = !open;
}

// Aviso bajo el titulo del acordeon: la prevalencia depende de la zona.
export function renderIndicatorsNote(noteEl, deprivations) {
  noteEl.textContent = deprivations
    ? `Prevalencia en ${deprivations.zona_nombre}`
    : 'Selecciona una zona en el mapa para ver la prevalencia de cada indicador';
}

// Rellena el panel de una dimension. Sin zona seleccionada la prevalencia se
// muestra como raya.
export function renderIndicators(panelEl, indicators, deprivations) {
  panelEl.textContent = '';

  const rates = new Map();
  if (deprivations) {
    deprivations.dimensiones.forEach((group) => {
      group.indicadores.forEach((item) => rates.set(item.codigo, item.prevalencia));
    });
  }

  indicators.forEach((indicator) => {
    const value = rates.has(indicator.codigo) ? rates.get(indicator.codigo) * 100 : null;
    const row = document.createElement('div');

    row.classList.add('indicator-row');
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <span class="indicator-name" title="${escapeHtml(indicator.descripcion || '')}">${escapeHtml(indicator.nombre)}</span>
      <span class="indicator-value">${value === null ? '—' : formatPercent(value)}</span>`;

    panelEl.appendChild(row);
  });
}

export function renderCollapseButton(buttonEl, anyOpen) {
  buttonEl.disabled = !anyOpen;
}

export function renderMetrics(refs, zone, prediction) {
  const groupA = Number(zone.pct_grupo_a) * 100;

  refs.groupAValueEl.textContent = formatPercent(groupA);
  refs.householdsValueEl.textContent = Number(zone.total_hogares).toLocaleString('es-CO');

  const scale = scaleOf(groupA);
  refs.scaleLabelEl.textContent = SCALE_LABELS[scale];
  refs.scaleLabelEl.className = `metric-note scale-${scale}`;

  if (!prediction) {
    refs.predictedValueEl.textContent = '—';
    refs.predictedNoteEl.textContent = 'Predicción no disponible';
    return;
  }

  const predicted = prediction.predicho;
  const top = GROUPS.reduce((a, b) => (predicted[a] >= predicted[b] ? a : b));
  refs.predictedValueEl.textContent = `${top} · ${formatRatio(predicted[top])}`;
  refs.predictedNoteEl.textContent = `${GROUP_NAMES[top]} (grupo mayoritario estimado)`;
}

export function clearMetrics(refs) {
  refs.householdsValueEl.textContent = '—';
  refs.groupAValueEl.textContent = '—';
  refs.scaleLabelEl.textContent = 'Sin zona seleccionada';
  refs.scaleLabelEl.className = 'metric-note';
  refs.predictedValueEl.textContent = '—';
  refs.predictedNoteEl.textContent = '—';
}

function barRow(name, value, fillClass, note = '') {
  const item = document.createElement('div');

  item.classList.add('bar-row');
  item.innerHTML = `
    <div class="bar-head">
      <span class="bar-name">${name}</span>
      <span class="bar-value">${formatPercent(value)}${note}</span>
    </div>
    <div class="bar-track">
      <div class="bar-fill ${fillClass}" style="width: ${Math.min(value, 100)}%"></div>
    </div>`;

  return item;
}

export function renderDistribution(listEl, zone, prediction) {
  listEl.textContent = '';

  GROUPS.forEach((group) => {
    const observed = Number(zone[`pct_grupo_${group.toLowerCase()}`]) * 100;
    const estimated = prediction ? Number(prediction.predicho[group]) * 100 : null;
    const note = estimated === null ? '' : ` <small>(modelo ${formatPercent(estimated)})</small>`;

    listEl.appendChild(
      barRow(`Grupo ${group} · ${GROUP_NAMES[group]}`, observed, `group-${group}`, note));
  });
}

export function renderExplanation(listEl, noteEl, explanation) {
  listEl.textContent = '';

  if (!explanation || !explanation.contribuciones || !explanation.contribuciones.length) {
    noteEl.textContent = 'Explicabilidad no disponible para esta zona.';
    return;
  }

  explanation.contribuciones.slice(0, 8).forEach((item) => {
    const weight = Math.abs(item.contribucion);
    const sign = item.contribucion > 0 ? '+' : '';
    const row = document.createElement('div');

    row.classList.add('bar-row');
    row.innerHTML = `
      <div class="bar-head">
        <span class="bar-name">${escapeHtml(item.etiqueta)} <small>· ${escapeHtml(item.dimension)}</small></span>
        <span class="bar-value">${sign}${item.contribucion.toFixed(3).replace('.', ',')}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${item.contribucion > 0 ? 'scale-high' : 'scale-low'}"
             style="width: ${Math.min(weight * 90, 100)}%"></div>
      </div>`;

    listEl.appendChild(row);
  });

  noteEl.textContent =
    `Contribuciones SHAP del hogar representativo de la zona al grupo ${explanation.grupo_predicho}. ` +
    'Explican en qué se apoya el modelo, no relaciones causales.';
}

export function renderDeprivations(listEl, deprivations) {
  listEl.textContent = '';
  if (!deprivations) return;

  deprivations.dimensiones.forEach((group) => {
    const heading = document.createElement('p');
    heading.classList.add('panel-subtitle', 'group-heading');
    heading.textContent = group.dimension;
    listEl.appendChild(heading);

    group.indicadores.forEach((indicator) => {
      const value = indicator.prevalencia * 100;
      listEl.appendChild(
        barRow(escapeHtml(indicator.nombre), value, `scale-${scaleOf(value)}`));
    });
  });
}

export function renderMessages(listEl, messages) {
  listEl.textContent = '';

  messages.forEach((message) => {
    const row = document.createElement('div');
    const bubble = document.createElement('div');

    row.classList.add('chat-message', `chat-message--${message.author}`);
    bubble.classList.add('chat-bubble');
    bubble.textContent = message.text;

    row.appendChild(bubble);
    listEl.appendChild(row);
  });

  listEl.scrollTop = listEl.scrollHeight;
}

export function renderSuggestions(listEl, suggestions, onPick) {
  listEl.textContent = '';

  suggestions.forEach((text) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.classList.add('chat-suggestion');
    button.textContent = text;
    button.addEventListener('click', () => onPick(text));

    listEl.appendChild(button);
  });
}

// ---------------------------------------------------------------
// Inicio de sesion
// ---------------------------------------------------------------

// El mensaje de credenciales invalidas es deliberadamente generico: no dice si
// fallo el correo o la contraseña (RF-01, flujo alternativo 1).
const LOGIN_MESSAGES = {
  empty: 'Escribe tu correo y tu contraseña.',
  invalid: 'Correo o contraseña incorrectos.',
  disabled: 'Tu usuario está desactivado. Contacta al administrador.',
  locked: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.',
  network: 'No se pudo conectar con el servidor. Comprueba que el backend esté en ejecución.',
  server: 'No se pudo iniciar sesión por un error del servidor. Inténtalo de nuevo.'
};

export function renderLoginError(errorEl, reason) {
  errorEl.textContent = reason ? (LOGIN_MESSAGES[reason] || LOGIN_MESSAGES.server) : '';
}

export function renderLoginNotice(noticeEl, expired) {
  noticeEl.textContent = expired ? 'Tu sesión expiró. Inicia sesión de nuevo para continuar.' : '';
  noticeEl.hidden = !expired;
}

export function setLoginBusy(buttonEl, busy) {
  buttonEl.disabled = busy;
  buttonEl.setAttribute('aria-busy', String(busy));
  buttonEl.textContent = busy ? 'Verificando…' : 'Iniciar sesión';
}

const ROLE_NAMES = {
  administrador: 'Administrador',
  admin: 'Administrador',
  analista: 'Analista'
};

export function renderSession(nameEl, roleEl, user) {
  const role = String(user.role || '').trim();
  nameEl.textContent = user.name || 'Usuario';
  roleEl.textContent = ROLE_NAMES[role.toLowerCase()] ||
    (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Sin rol');
}
