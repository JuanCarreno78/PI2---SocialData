//js/view.js
import { scaleOf } from './map.js';

// Renderizado del DOM.

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

// También las comillas: el truco anterior (textContent -> innerHTML) no las escapaba, y
// dentro de un atributo (title="...") una comilla en el dato cerraba el atributo y permitía
// inyectar otros (XSS).
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
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
    // En escritorio la ruta puede recortarse: el texto completo queda en el title.
    button.title = step.name;
    if (!last) button.addEventListener('click', () => onNavigate(step));

    item.appendChild(button);
    breadcrumbEl.appendChild(item);
  });
}

// Cada dimensión es un desplegable: su botón y, justo debajo, el panel con sus indicadores.
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

// Aviso bajo el título del acordeón: la prevalencia depende de la zona.
export function renderIndicatorsNote(noteEl, deprivations) {
  noteEl.textContent = deprivations
    ? `Prevalencia en ${deprivations.zona_nombre}`
    : 'Selecciona una zona en el mapa para ver la prevalencia de cada indicador';
}

// Rellena el panel de una dimensión.
export function renderIndicators(panelEl, indicators, deprivations) {
  panelEl.textContent = '';

  const rates = new Map();
  if (deprivations) {
    deprivations.dimensiones.forEach((group) => {
      group.indicadores.forEach((item) => rates.set(item.codigo, item.prevalencia));
    });
  }

  indicators.forEach((indicator) => {
    // null (sin dato en la zona) se muestra como '—' y no como 0 %.
    const rate = rates.get(indicator.codigo);
    const value = rate === undefined || rate === null ? null : rate * 100;
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

// Opciones del selector de zona: el área completa y las zonas agrupadas por municipio, en
// el orden en que llegan (municipio y luego urbana/rural).
export function renderZoneOptions(selectEl, area, zones) {
  selectEl.textContent = '';
  selectEl.appendChild(new Option('Toda el área metropolitana', String(area.zona_id)));

  const groups = new Map();
  zones.forEach((zone) => {
    const town = String(zone.zona_nombre).split(' - ')[0];
    const label = Number(zone.zona) === 2 ? 'Rural' : 'Cabecera urbana';
    if (!groups.has(town)) groups.set(town, []);
    groups.get(town).push(new Option(`${town} · ${label}`, String(zone.zona_id)));
  });
  groups.forEach((options, town) => {
    const group = document.createElement('optgroup');
    group.label = town;
    options.forEach((option) => group.appendChild(option));
    selectEl.appendChild(group);
  });
}

export function renderExplanation(listEl, noteEl, explanation, isArea = false) {
  listEl.textContent = '';

  if (isArea) {
    noteEl.textContent = 'Los factores del modelo se calculan por zona: selecciona una en el mapa para verlos.';
    return;
  }
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

    // Sin dato en la zona no se dibuja la barra: una barra vacía se leería como 0 %.
    group.indicadores
      .filter((indicator) => indicator.prevalencia !== null && indicator.prevalencia !== undefined)
      .forEach((indicator) => {
        const value = indicator.prevalencia * 100;
        listEl.appendChild(
          barRow(escapeHtml(indicator.nombre), value, `scale-${scaleOf(value)}`));
      });
  });
}

// El modelo de lenguaje escribe negritas (**texto**), títulos (### ) y viñetas de markdown.
function formatAnswer(text) {
  return escapeHtml(text)
    .replace(/^#{1,4}\s*(.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^(\s*)[*-]\s+/gm, '$1• ');
}

function engineLabel(engine) {
  return String(engine).replace(/^ollama:/, '');
}

function waitingNode(message) {
  const seconds = Math.floor((Date.now() - message.startedAt) / 1000);
  const wrap = document.createElement('span');
  wrap.className = 'chat-waiting';
  wrap.innerHTML = '<span class="typing" aria-hidden="true"><span></span><span></span><span></span></span>';

  const label = document.createElement('span');
  label.textContent = seconds >= 3 ? `Analizando la zona… ${seconds} s` : 'Analizando la zona…';
  wrap.appendChild(label);
  return wrap;
}

// Debajo de la respuesta: con qué se generó, sus fuentes y la advertencia.
function metaNode(message) {
  if (message.note) {
    const note = document.createElement('p');
    note.className = 'chat-note';
    note.textContent = message.note;
    return note;
  }
  if (!message.engine || message.pending) return null;

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const list = document.createElement('ul');
  const warning = document.createElement('p');
  const sources = message.sources || [];

  details.className = 'chat-sources';
  summary.textContent = `Generado con IA · ${engineLabel(message.engine)} · ${sources.length} fuentes`;
  sources.forEach((source) => {
    const item = document.createElement('li');
    item.textContent = source.referencia;
    list.appendChild(item);
  });
  warning.textContent = message.warning || '';

  details.append(summary, list, warning);
  return details;
}

function messageNode(message) {
  const row = document.createElement('div');
  const bubble = document.createElement('div');

  row.classList.add('chat-message', `chat-message--${message.author}`);
  bubble.classList.add('chat-bubble');

  if (message.pending && !message.text) {
    bubble.appendChild(waitingNode(message));
  } else if (message.engine) {
    bubble.innerHTML = formatAnswer(message.text);
    bubble.classList.toggle('is-writing', Boolean(message.pending));
  } else {
    bubble.textContent = message.text;
  }

  row.appendChild(bubble);
  const meta = metaNode(message);
  if (meta) row.appendChild(meta);
  return row;
}

export function renderMessages(listEl, messages) {
  listEl.textContent = '';
  messages.forEach((message) => listEl.appendChild(messageNode(message)));
  listEl.scrollTop = listEl.scrollHeight;
}

// Mientras la respuesta se escribe solo cambia el último mensaje.
export function renderLastMessage(listEl, message) {
  const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
  const last = listEl.lastElementChild;
  const node = messageNode(message);

  if (last) listEl.replaceChild(node, last);
  else listEl.appendChild(node);
  if (atBottom) listEl.scrollTop = listEl.scrollHeight;
}

export function renderSuggestions(listEl, suggestions, onPick) {
  listEl.textContent = '';

  suggestions.forEach((suggestion) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.classList.add('chat-suggestion');
    if (suggestion.kind) button.classList.add('is-ai');
    button.textContent = suggestion.text;
    button.addEventListener('click', () => onPick(suggestion));

    listEl.appendChild(button);
  });
}

// Sesión
const ROLE_LABELS = { administrador: 'Administrador', analista: 'Analista' };

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export function renderSession(els, session) {
  const admin = session.role === 'administrador';

  els.sessionNameEl.textContent = session.name;
  els.sessionRoleEl.textContent = roleLabel(session.role);
  els.sessionRoleEl.classList.toggle('is-admin', admin);
  els.adminBtn.hidden = !admin;
}

export function renderLoginError(errorEl, message) {
  errorEl.textContent = message || '';
}

export function renderLoginNotice(noticeEl, message) {
  noticeEl.textContent = message || '';
  noticeEl.hidden = !message;
}

// Administración
// Los nombres y correos los escribe un administrador: todo pasa por escapeHtml o por
// textContent.
export function renderUsers(listEl, users, currentEmail, onToggle, onDelete) {
  listEl.textContent = '';

  users.forEach((user) => {
    const self = user.email === currentEmail;
    const row = document.createElement('div');
    const actions = document.createElement('span');
    const button = document.createElement('button');

    row.classList.add('user-row');
    if (!user.activo) row.classList.add('is-inactive');
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <span class="user-id">
        <span class="user-name">${escapeHtml(user.nombre)}${self ? ' <small>(tú)</small>' : ''}</span>
        <span class="user-email">${escapeHtml(user.email)}</span>
      </span>
      <span class="user-tags">
        <span class="role-badge${user.rol === 'administrador' ? ' is-admin' : ''}">${escapeHtml(roleLabel(user.rol))}</span>
        <span class="state-badge${user.activo ? '' : ' is-off'}">${user.activo ? 'Activo' : 'Desactivado'}</span>
      </span>`;

    button.type = 'button';
    button.className = 'btn-secondary user-action';
    button.textContent = user.activo ? 'Desactivar' : 'Activar';
    button.setAttribute('aria-label', `${button.textContent} a ${user.nombre}`);

    if (self) {
      button.disabled = true;
      button.title = 'No puedes desactivar tu propio usuario';
    } else {
      button.addEventListener('click', () => onToggle(user, button));
    }

    actions.className = 'user-actions';
    actions.appendChild(button);

    // Eliminar solo se ofrece después de desactivar.
    if (!user.activo && !self) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-secondary user-action is-danger';
      remove.textContent = 'Eliminar';
      remove.setAttribute('aria-label', `Eliminar a ${user.nombre}`);
      remove.addEventListener('click', () => onDelete(user, remove));
      actions.appendChild(remove);
    }

    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

export function renderAdminSummary(summaryEl, users) {
  const active = users.filter((user) => user.activo).length;
  summaryEl.textContent = `${users.length} usuarios · ${active} activos · gestión de usuarios y roles (RF-09)`;
}

export function renderAdminMessage(messageEl, text, kind) {
  messageEl.textContent = text || '';
  messageEl.className = 'admin-message' + (kind ? ` is-${kind}` : '');
}

// Mi perfil
// Todo dato del usuario entra por textContent: nombres, motivos e IP los escriben personas.
function formatWhen(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDateTime(date);
}

export function renderProfileFacts(listEl, profile) {
  const facts = [
    ['Nombre', profile.nombre],
    ['Correo', profile.email],
    ['Rol', roleLabel(profile.rol)]
  ];
  if (!profile.local) {
    facts.push(
      ['Miembro desde', formatWhen(profile.creado_en) || '—'],
      ['Contraseña cambiada', formatWhen(profile.clave_cambiada_en) || 'Nunca desde que se creó la cuenta']
    );
  }

  listEl.textContent = '';
  facts.forEach(([label, value]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    listEl.append(dt, dd);
  });
}

// Estado del nombre: solicitud pendiente (con opción de cancelarla) o el resultado de la
// última, para que el analista se entere si la rechazaron.
export function renderNameStatus(statusEl, profile, onCancel) {
  statusEl.textContent = '';
  const note = document.createElement('p');
  const pending = profile.solicitud_pendiente;
  // El resultado de la última solicitud es una noticia: se muestra 14 días.
  const recent = profile.ultima_resuelta && profile.ultima_resuelta.resuelta_en &&
    Date.now() - new Date(profile.ultima_resuelta.resuelta_en).getTime() < 14 * 86400000;
  const last = recent ? profile.ultima_resuelta : null;

  if (pending) {
    note.className = 'profile-note is-warning';
    note.textContent = `Solicitaste cambiar tu nombre a «${pending.valor_nuevo}». ` +
      'Está pendiente de aprobación por un administrador.';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-quiet';
    cancel.textContent = 'Cancelar solicitud';
    cancel.addEventListener('click', () => onCancel(cancel));
    note.appendChild(cancel);
  } else if (last && last.estado === 'rechazada') {
    note.className = 'profile-note is-error';
    note.textContent = `Rechazaron tu solicitud de llamarte «${last.valor_nuevo}»` +
      (last.motivo ? `. Motivo: ${last.motivo}` : '.');
  } else if (last && last.estado === 'aprobada') {
    note.className = 'profile-note';
    note.textContent = `Se aprobó tu cambio de nombre a «${last.valor_nuevo}».`;
  } else {
    return;
  }
  statusEl.appendChild(note);
}

// Solicitudes pendientes en el panel del administrador.
export function renderNameRequests(listEl, requests, onResolve) {
  listEl.textContent = '';
  if (!requests.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-subtitle';
    empty.textContent = 'No hay solicitudes pendientes.';
    listEl.appendChild(empty);
    return;
  }

  requests.forEach((item) => {
    const row = document.createElement('div');
    const text = document.createElement('span');
    const actions = document.createElement('span');
    const reason = document.createElement('input');
    const approve = document.createElement('button');
    const reject = document.createElement('button');

    row.className = 'request-row';
    row.setAttribute('role', 'listitem');
    text.className = 'user-id';
    text.innerHTML = `
      <span class="user-name">${escapeHtml(item.usuario.nombre)} quiere llamarse «${escapeHtml(item.valor_nuevo)}»</span>
      <span class="user-email">${escapeHtml(item.usuario.email)} · solicitado el ${escapeHtml(formatWhen(item.creada_en) || '')}</span>`;

    approve.type = 'button';
    approve.className = 'btn-secondary user-action';
    approve.textContent = 'Aprobar';
    approve.setAttribute('aria-label', `Aprobar el nombre ${item.valor_nuevo}`);
    reject.type = 'button';
    reject.className = 'btn-secondary user-action is-danger';
    reject.textContent = 'Rechazar';
    reject.setAttribute('aria-label', `Rechazar el nombre ${item.valor_nuevo}`);

    reason.type = 'text';
    reason.className = 'login-input request-reason';
    reason.maxLength = 200;
    reason.placeholder = 'Motivo del rechazo (opcional, lo verá el analista)';
    reason.setAttribute('aria-label', `Motivo para rechazar a ${item.usuario.nombre}`);

    approve.addEventListener('click', () => onResolve(item, true, '', [approve, reject]));
    reject.addEventListener('click', () => onResolve(item, false, reason.value, [approve, reject]));

    actions.className = 'user-actions';
    actions.append(approve, reject);
    row.append(text, actions, reason);
    listEl.appendChild(row);
  });
}

export function renderPendingBadge(badgeEl, count) {
  badgeEl.textContent = count > 0 ? String(count) : '';
  badgeEl.hidden = !(count > 0);
  badgeEl.setAttribute('aria-label', `${count} solicitudes pendientes`);
}

// Reporte de zona (HU-12)
function formatDateTime(date) {
  return date.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
}

function exportedByText(report) {
  if (!report.exportedBy) return '—';
  return `${report.exportedBy.name} (${roleLabel(report.exportedBy.role)})`;
}

// Excel (.xlsx)
// Antes se exportaba CSV, pero un CSV depende de la configuración regional: con ';' se abre
// bien en un Excel en español y en una sola columna en uno en inglés, en Google Sheets o en
// LibreOffice, y con ',' al revés.

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Estilos definidos en styles.xml, por posición.
const CELL = { normal: 0, title: 1, bold: 2, header: 3, percent: 4, shap: 5, integer: 6 };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ZIP sin compresión (método "store"): válido para Excel y mucho más simple.
function zip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const directory = [];
  let offset = 0;

  files.forEach(({ name, text }) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);    // firma de cabecera local
    local.setUint16(4, 20, true);            // version necesaria
    local.setUint16(6, 0x0800, true);        // nombres en UTF-8
    local.setUint16(12, 0x21, true);         // fecha 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);    // firma del directorio central
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    directory.push(new Uint8Array(entry.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  });

  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);        // fin del directorio central
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);

  return [...chunks, ...directory, new Uint8Array(end.buffer)];
}

// Texto seguro para XML.
function xmlText(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function columnName(index) {
  return String.fromCharCode(65 + index);
}

const text = (value, style = CELL.normal) => ({ type: 'text', value, style });
const number = (value, style) =>
  (value === null || value === undefined || Number.isNaN(Number(value))
    ? null : { type: 'number', value: Number(value), style });

function sheetXml(rows) {
  const body = rows.map((cells, r) => {
    const xml = cells.map((cell, c) => {
      if (!cell) return '';
      const ref = `${columnName(c)}${r + 1}`;
      if (cell.type === 'number') return `<c r="${ref}" s="${cell.style}"><v>${cell.value}</v></c>`;
      return `<c r="${ref}" s="${cell.style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(cell.value)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${xml}</row>`;
  }).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="2" width="42" customWidth="1"/>' +
    '<col min="3" max="3" width="40" customWidth="1"/><col min="4" max="4" width="26" customWidth="1"/></cols>' +
    `<sheetData>${body}</sheetData></worksheet>`;
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="+0.000;-0.000;0.000"/></numFmts>' +
  '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><color rgb="FF0A3F38"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE3EEEB"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// Mismo contenido que el reporte en PDF.
function reportRows(report) {
  const rows = [];
  const label = (name) => text(name, CELL.bold);

  rows.push([text('SocialData - Reporte de zona', CELL.title)]);
  rows.push([label('Zona'), text(report.zone)]);
  rows.push([label('Municipio'), text(report.municipality)]);
  rows.push([label('Hogares registrados'), number(report.households, CELL.integer)]);
  rows.push([label('Personas'), number(report.people, CELL.integer)]);
  rows.push([label('Fuente y periodo'), text(report.source)]);
  rows.push([label('Fecha del corte publicado'), text(report.dataDate)]);
  rows.push([label('Exportado por'), text(exportedByText(report))]);
  rows.push([label('Fecha de exportación'), text(formatDateTime(report.exportedAt))]);
  rows.push([]);

  rows.push([text('Distribución por grupo del Sisbén', CELL.bold)]);
  rows.push([text('Grupo', CELL.header), text('Descripción', CELL.header),
    text('Observado', CELL.header), text('Estimado por el modelo', CELL.header)]);
  GROUPS.forEach((group) => {
    rows.push([text(group), text(GROUP_NAMES[group]),
      number(report.observed[group], CELL.percent),
      report.predicted ? number(report.predicted[group], CELL.percent) : text('No disponible')]);
  });
  rows.push([]);

  rows.push([text('Prevalencia de privaciones observadas', CELL.bold)]);
  rows.push([text('Dimensión', CELL.header), text('Código', CELL.header),
    text('Indicador', CELL.header), text('Prevalencia', CELL.header)]);
  report.indicators.forEach((item) => {
    rows.push([text(item.dimension), text(item.code), text(item.name),
      number(item.rate, CELL.percent) || text('Sin dato')]);
  });
  rows.push([]);

  if (report.drivers.length) {
    rows.push([text(driversTitle(report), CELL.bold)]);
    rows.push([text('Factor', CELL.header), text('Dimensión', CELL.header),
      text('Contribución SHAP', CELL.header)]);
    report.drivers.forEach((item) => {
      rows.push([text(item.name), text(item.dimension), number(item.weight, CELL.shap)]);
    });
    rows.push([]);
  }

  rows.push([label('Nota'), text(REPORT_NOTE)]);
  return rows;
}

export function reportToXlsx(report) {
  const files = [
    {
      name: '[Content_Types].xml',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>'
    },
    {
      name: '_rels/.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'
    },
    {
      name: 'xl/workbook.xml',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets></workbook>'
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'
    },
    { name: 'xl/worksheets/sheet1.xml', text: sheetXml(reportRows(report)) },
    { name: 'xl/styles.xml', text: STYLES_XML }
  ];

  return new Blob(zip(files), { type: XLSX_TYPE });
}

// Las contribuciones SHAP son del hogar representativo de la zona, no de la zona entera: su
// grupo puede no coincidir con el mayoritario.
function driversTitle(report) {
  return 'Factores dominantes según el modelo · hogar representativo de la zona ' +
    `(clasificado en el grupo ${report.predictedGroup})`;
}

const REPORT_NOTE =
  'Cifras agregadas por zona, sin datos que identifiquen hogares o personas. ' +
  'Herramienta de apoyo a la decisión: no reemplaza la clasificación oficial del DNP.';

export function reportFileName(report, extension) {
  const slug = report.zone
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Fecha local y no toISOString(): esa es UTC y en Colombia, desde las 7 p. m., ya daría el día siguiente.
  const date = report.exportedAt;
  const pad = (value) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `SocialData_${slug}_${day}.${extension}`;
}

export function renderPrintReport(reportEl, report) {
  const groupRows = GROUPS.map((group) => `
    <tr>
      <td>${group} · ${GROUP_NAMES[group]}</td>
      <td class="num">${formatPercent(report.observed[group] * 100)}</td>
      <td class="num">${report.predicted ? formatPercent(report.predicted[group] * 100) : '—'}</td>
    </tr>`).join('');

  const indicatorRows = report.indicators.map((item) => `
    <tr>
      <td>${escapeHtml(item.dimension)}</td>
      <td>${escapeHtml(item.name)}</td>
      <td class="num">${item.rate === null || item.rate === undefined ? '—' : formatPercent(item.rate * 100)}</td>
    </tr>`).join('');

  const driverRows = report.drivers.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.dimension)}</td>
      <td class="num">${item.weight > 0 ? '+' : ''}${item.weight.toFixed(3).replace('.', ',')}</td>
    </tr>`).join('');

  reportEl.innerHTML = `
    <header class="report-head">
      <div>
        <h1>Reporte de zona</h1>
        <p>SocialData · Vulnerabilidad socioeconómica · Área Metropolitana de Bucaramanga</p>
      </div>
      <p>${escapeHtml(formatDateTime(report.exportedAt))}</p>
    </header>

    <table class="report-table report-meta">
      <tbody>
        <tr><th>${report.isArea ? 'Ámbito' : 'Zona'}</th><td>${escapeHtml(report.zone)}</td></tr>
        <tr><th>${report.isArea ? 'Municipios' : 'Municipio'}</th><td>${escapeHtml(report.municipality)}</td></tr>
        <tr><th>Hogares registrados</th><td>${report.households.toLocaleString('es-CO')}</td></tr>
        <tr><th>Personas</th><td>${report.people.toLocaleString('es-CO')}</td></tr>
        <tr><th>Fuente y periodo</th><td>${escapeHtml(report.source)}</td></tr>
        <tr><th>Fecha del corte publicado</th><td>${escapeHtml(report.dataDate)}</td></tr>
        <tr><th>Exportado por</th><td>${escapeHtml(exportedByText(report))}</td></tr>
      </tbody>
    </table>

    <section class="report-section">
      <h2>Distribución por grupo del Sisbén</h2>
      <table class="report-table">
        <thead><tr><th>Grupo</th><th class="num">Observado</th><th class="num">Estimado por el modelo</th></tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
    </section>

    <section class="report-section">
      <h2>Prevalencia de privaciones observadas</h2>
      <table class="report-table">
        <thead><tr><th>Dimensión</th><th>Indicador</th><th class="num">Prevalencia</th></tr></thead>
        <tbody>${indicatorRows}</tbody>
      </table>
    </section>

    ${report.drivers.length ? `
    <section class="report-section">
      <h2>${escapeHtml(driversTitle(report))}</h2>
      <table class="report-table">
        <thead><tr><th>Factor</th><th>Dimensión</th><th class="num">Contribución SHAP</th></tr></thead>
        <tbody>${driverRows}</tbody>
      </table>
    </section>` : ''}

    ${conversationSection(report.conversation)}

    <p class="report-note">${escapeHtml(REPORT_NOTE)}
      Las contribuciones SHAP explican en qué se apoya el modelo, no relaciones causales.</p>`;
}

// Lo que se habló con el asistente.
function conversationSection(conversation) {
  if (!conversation) return '';

  if (conversation.text) {
    return `
    <section class="report-section">
      <h2>Resumen de la conversación con el asistente</h2>
      <div class="report-summary">${formatAnswer(conversation.text)}</div>
      <p class="report-note">Resumen redactado por la IA (${escapeHtml(engineLabel(conversation.engine))})
        a partir del chat. Es apoyo a la decisión, no una recomendación oficial.</p>
    </section>`;
  }

  return `
    <section class="report-section">
      <h2>Consultas realizadas al asistente</h2>
      <ul class="report-list">
        ${conversation.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}
      </ul>
      <p class="report-note">El resumen de la IA no estaba disponible al exportar.</p>
    </section>`;
}

export function downloadFile(fileName, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
