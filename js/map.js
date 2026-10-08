//js/map.js
// Mapa de las ocho zonas (Leaflet).

let map = null;
let markerLayer = null;
let framed = false;

// Modo ampliado: rueda activa, los cuatro rótulos fijos y un nivel más de acercamiento.
let largeMode = false;
let lastDraw = null;

const METRO_BOUNDS = [[6.93, -73.26], [7.19, -72.99]];

// Cartografía base, en orden de preferencia.
const BASE_LAYERS = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    // La misma cartografía en gris oscuro, para el modo oscuro.
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
    },
    options: {
      maxZoom: 16,
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &middot; &copy; OSM'
    }
  },
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  }
];

// Casco urbano de cada municipio.
const TOWN_CENTERS = {
  '68001': { lat: 7.1193, lng: -73.1227, zoom: 12 },
  '68276': { lat: 7.0631, lng: -73.0854, zoom: 12 },
  '68307': { lat: 7.0680, lng: -73.1698, zoom: 12 },
  '68547': { lat: 6.9908, lng: -73.0508, zoom: 12 }
};

// Umbrales derivados del rango real observado entre las ocho zonas (de 12,9 % a 60,9 % de
// hogares en el grupo A).
const MEDIUM_THRESHOLD = 25;
const HIGH_THRESHOLD = 45;

const SCALE_COLORS = {
  low: '#3F8F63',
  medium: '#D9A441',
  high: '#B23A2E',
  'no-data': '#9AA6A2'
};

export function scaleOf(value) {
  if (value === null || value === undefined) return 'no-data';
  if (value < MEDIUM_THRESHOLD) return 'low';
  if (value < HIGH_THRESHOLD) return 'medium';
  return 'high';
}

export function colorOf(value) {
  return SCALE_COLORS[scaleOf(value)];
}

function centerOf(townCode) {
  return TOWN_CENTERS[String(townCode)] || { lat: 7.07, lng: -73.12, zoom: 12 };
}

function townName(zone) {
  return String(zone.zona_nombre || '').split(' - ')[0];
}

// Capas base en uso, para poder cambiarlas con el tema.
let baseLayers = [];
let baseGeneration = 0;
let mapContainerEl = null;

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

// Degradación en cascada: si pasados unos segundos el proveedor no ha pintado ninguna
// tesela, se prueba el siguiente; agotados todos, queda la retícula.
function addBaseLayer(containerEl, index = 0, generation = baseGeneration) {
  if (generation !== baseGeneration) return;
  if (index >= BASE_LAYERS.length) {
    containerEl.classList.add('no-basemap');
    return;
  }

  const base = BASE_LAYERS[index];
  const source = currentTheme() === 'dark' && base.dark ? { ...base, ...base.dark } : base;
  const layer = L.tileLayer(source.url, source.options).addTo(map);
  baseLayers.push(layer);

  // Los topónimos van en un panel propio por encima de las zonas, con pointer-events none
  // para no interceptar los clics dirigidos a ellas.
  let labelLayer = null;
  if (source.labels) {
    if (!map.getPane('labels')) {
      const pane = map.createPane('labels');
      pane.style.zIndex = 450;
      pane.style.pointerEvents = 'none';
    }
    labelLayer = L.tileLayer(source.labels, {
      ...source.options, attribution: '', pane: 'labels'
    }).addTo(map);
    baseLayers.push(labelLayer);
  }

  let loaded = false;
  layer.on('load', () => { loaded = true; });

  // No sirve descartar al proveedor al primer tileerror: Leaflet también lo emite cuando
  // el mapa cancela teselas a medio descargar al reencuadrar.
  setTimeout(() => {
    if (generation !== baseGeneration) return;
    const layerEl = layer.getContainer();
    if (loaded || (layerEl && layerEl.querySelector('.leaflet-tile-loaded'))) return;
    map.removeLayer(layer);
    if (labelLayer) map.removeLayer(labelLayer);
    addBaseLayer(containerEl, index + 1, generation);
  }, 5000);
}

// Cambia la cartografía al tema actual (clara u oscura).
export function refreshTheme() {
  if (!map || !mapContainerEl) return;
  baseGeneration += 1;
  baseLayers.forEach((layer) => map.removeLayer(layer));
  baseLayers = [];
  mapContainerEl.classList.remove('no-basemap');
  addBaseLayer(mapContainerEl);
  if (lastDraw) drawZones(...lastDraw);   // el borde de las zonas cambia con el tema
}

// fitBounds sobre un contenedor de 0 px hace que Leaflet caiga en maxZoom, que era la causa
// de que el mapa abriera pegado a un solo municipio.
function frameMetroArea() {
  if (!map) return false;
  map.invalidateSize({ animate: false });
  const size = map.getSize();
  if (size.x < 40 || size.y < 40) return false;
  map.fitBounds(METRO_BOUNDS, { padding: [14, 14] });
  framed = true;
  return true;
}

export function initMap(containerId) {
  const containerEl = document.getElementById(containerId);
  if (!containerEl) throw new Error(`No existe el contenedor #${containerId}`);

  // Leaflet se carga como recurso local (vendor/leaflet).
  if (!window.L) throw new Error('Leaflet no está disponible');

  // scrollWheelZoom desactivado: el mapa vive dentro de una barra lateral con
  // desplazamiento propio y capturaría la rueda al intentar bajar por ella.
  map = L.map(containerEl, {
    zoomControl: true, scrollWheelZoom: false, minZoom: 10, maxZoom: 16
  });
  mapContainerEl = containerEl;
  addBaseLayer(containerEl);
  L.control.scale({ imperial: false, metric: true }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  // El panel se dimensiona con flexbox, así que su alto puede no estar resuelto todavía.
  if (!frameMetroArea()) {
    requestAnimationFrame(() => frameMetroArea());
    window.addEventListener('load', () => { if (!framed) frameMetroArea(); }, { once: true });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (framed) map.invalidateSize({ animate: false });
      else frameMetroArea();
    }).observe(containerEl);
  }

  return map;
}

function radiusOf(value) {
  if (value === null || value === undefined) return 10;
  const ratio = Math.min(Math.max(value, 0), 100) / 100;
  return 12 + ratio * 18;
}

// Al pasar el puntero: qué zona es y su cifra.
function zoneTip(zone, value, valueLabel) {
  const tip = document.createElement('div');
  const title = document.createElement('strong');
  const figure = document.createElement('span');
  const action = document.createElement('span');
  const kind = Number(zone.zona) === 2 ? 'zona rural (área esquemática)' : 'cabecera urbana';

  title.textContent = `${townName(zone)} · ${kind}`;
  figure.textContent = value === null || value === undefined
    ? 'Sin datos' : `${valueLabel}: ${value.toFixed(1).replace('.', ',')} %`;
  action.textContent = 'Clic para analizar';
  action.className = 'zone-tip-action';
  tip.append(title, figure, action);
  return tip;
}

// Un clic analiza la zona directamente.
function bindZone(layer, zone, value, onSelect, valueLabel) {
  layer.bindTooltip(zoneTip(zone, value, valueLabel), {
    sticky: true, direction: 'top', offset: [0, -10], className: 'zone-tip'
  });
  layer.on('click', () => {
    layer.closeTooltip();
    onSelect(zone);
  });
  layer.addTo(markerLayer);
}

export function drawZones(zones, valueOf, onSelect, highlightedId = null, valueLabel = 'Hogares en grupo A') {
  lastDraw = [zones, valueOf, onSelect, highlightedId, valueLabel];
  if (!map) return;
  markerLayer.clearLayers();

  const highlighted = zones.find((zone) => zone.zona_id === highlightedId);

  // Primero los anillos rurales, para que las cabeceras queden encima.
  const rural = zones.filter((zone) => Number(zone.zona) === 2);
  const urban = zones.filter((zone) => Number(zone.zona) !== 2);

  rural.forEach((zone) => {
    const value = valueOf(zone);
    const center = centerOf(zone.cod_mpio);
    const selected = zone === highlighted;

    bindZone(L.circle([center.lat, center.lng], {
      radius: 4200,
      fillColor: colorOf(value),
      fillOpacity: selected ? 0.34 : 0.2,
      color: colorOf(value),
      weight: selected ? 3 : 1.5,
      dashArray: '6 5',
      className: 'rural-ring'
    }), zone, value, onSelect, valueLabel);
  });

  urban.forEach((zone) => {
    const value = valueOf(zone);
    const center = centerOf(zone.cod_mpio);
    const selected = zone === highlighted;

    // El borde marca la selección: oscuro sobre el mapa claro y al revés.
    const dark = currentTheme() === 'dark';
    bindZone(L.circleMarker([center.lat, center.lng], {
      radius: radiusOf(value),
      fillColor: colorOf(value),
      fillOpacity: 0.85,
      color: selected !== dark ? '#17241F' : '#ffffff',
      weight: selected ? 3 : 1.5,
      className: 'zone-marker'
    }), zone, value, onSelect, valueLabel);

    // Rótulo del municipio, aparte del globo de la zona.
    const sameTown = highlighted && String(highlighted.cod_mpio) === String(zone.cod_mpio);
    if (largeMode || sameTown) {
      const label = document.createElement('span');
      label.className = 'town-label';
      label.textContent = townName(zone);
      L.marker([center.lat, center.lng], {
        icon: L.divIcon({ className: 'town-label-icon', html: label, iconSize: null, iconAnchor: [-16, 10] }),
        interactive: false, keyboard: false
      }).addTo(markerLayer);
    }
  });
}

function framePadding() {
  return largeMode ? [36, 36] : [14, 14];
}

export function flyToZone(townCode) {
  const center = centerOf(townCode);
  const zoom = center.zoom + (largeMode ? 1 : 0);
  if (map) map.flyTo([center.lat, center.lng], zoom, { duration: 0.8 });
}

export function fitMetroArea() {
  if (map) map.flyToBounds(METRO_BOUNDS, { padding: framePadding(), duration: 0.8 });
}

// Cambia entre el recuadro compacto y el tamaño de trabajo.
export function setLargeMode(on) {
  if (!map) return;
  largeMode = Boolean(on);

  // La rueda solo hace zoom con el mapa ampliado; en la barra lateral debe seguir
  // desplazando la columna.
  if (largeMode) map.scrollWheelZoom.enable();
  else map.scrollWheelZoom.disable();

  if (lastDraw) drawZones(...lastDraw);

  const reframe = () => {
    map.invalidateSize({ animate: false });
    const size = map.getSize();
    if (size.x < 40 || size.y < 40) return;
    map.fitBounds(METRO_BOUNDS, { padding: framePadding(), animate: false });
    framed = true;
  };

  reframe();
  requestAnimationFrame(reframe);
}

export function isLargeMode() {
  return largeMode;
}
