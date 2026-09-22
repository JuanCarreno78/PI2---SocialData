// Mapa de las ocho zonas (Leaflet). Cada municipio aporta su cabecera urbana,
// dibujada como circulo en sus coordenadas reales, y su centro poblado y rural
// disperso, dibujado como anillo. El anillo es esquematico: el Sisben no
// publica geometrias por zona, asi que no hay poligono real que trazar.

let map = null;
let markerLayer = null;
let framed = false;

// Modo ampliado: rueda activa, los cuatro rotulos fijos y un nivel mas de
// acercamiento. Se guardan los argumentos del ultimo dibujo para poder
// redibujar las zonas al cambiar de modo sin pasar por el controlador.
let largeMode = false;
let lastDraw = null;

const METRO_BOUNDS = [[6.93, -73.26], [7.19, -72.99]];

// Cartografia base, en orden de preferencia. Ninguna exige clave de API.
// Se descarto CARTO: desde 2024 marca sus teselas con "API KEY REQUIRED" si la
// aplicacion no esta registrada.
const BASE_LAYERS = [
  {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
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

// Casco urbano de cada municipio. El zoom de acercamiento es 12 y no 13 porque
// el mapa ocupa un recuadro compacto en la barra lateral; ampliado sube a 13.
const TOWN_CENTERS = {
  '68001': { lat: 7.1193, lng: -73.1227, zoom: 12 },
  '68276': { lat: 7.0631, lng: -73.0854, zoom: 12 },
  '68307': { lat: 7.0680, lng: -73.1698, zoom: 12 },
  '68547': { lat: 6.9908, lng: -73.0508, zoom: 12 }
};

// Umbrales derivados del rango real observado entre las ocho zonas
// (de 12,9 % a 60,9 % de hogares en el grupo A).
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

// Degradacion en cascada: si pasados unos segundos el proveedor no ha pintado
// ninguna tesela, se prueba el siguiente; agotados todos, queda la reticula.
function addBaseLayer(containerEl, index = 0) {
  if (index >= BASE_LAYERS.length) {
    containerEl.classList.add('no-basemap');
    return;
  }

  const source = BASE_LAYERS[index];
  const layer = L.tileLayer(source.url, source.options).addTo(map);

  // Los toponimos van en un panel propio por encima de las zonas, con
  // pointer-events none para no interceptar los clics dirigidos a ellas.
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
  }

  let loaded = false;
  layer.on('load', () => { loaded = true; });

  // No sirve descartar al proveedor al primer tileerror: Leaflet tambien lo
  // emite cuando el mapa cancela teselas a medio descargar al reencuadrar.
  setTimeout(() => {
    const layerEl = layer.getContainer();
    if (loaded || (layerEl && layerEl.querySelector('.leaflet-tile-loaded'))) return;
    map.removeLayer(layer);
    if (labelLayer) map.removeLayer(labelLayer);
    addBaseLayer(containerEl, index + 1);
  }, 5000);
}

// fitBounds sobre un contenedor de 0 px hace que Leaflet caiga en maxZoom, que
// era la causa de que el mapa abriera pegado a un solo municipio.
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

  // scrollWheelZoom desactivado: el mapa vive dentro de una barra lateral con
  // desplazamiento propio y capturaria la rueda al intentar bajar por ella.
  map = L.map(containerEl, {
    zoomControl: true, scrollWheelZoom: false, minZoom: 10, maxZoom: 16
  });
  addBaseLayer(containerEl);
  L.control.scale({ imperial: false, metric: true }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  // El panel se dimensiona con flexbox, asi que su alto puede no estar resuelto
  // todavia. Se reintenta cuando el navegador termine el primer reflow.
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

function popupHtml(zone, value, valueLabel) {
  const text = value === null || value === undefined ? 'Sin datos' : `${value.toFixed(1)}%`;
  return `<p class="popup-title">${zone.zona_nombre}</p>` +
         `<p class="popup-value">${valueLabel}: <strong>${text}</strong></p>` +
         `<p class="popup-value">${Number(zone.total_hogares).toLocaleString('es-CO')} hogares</p>` +
         `<p class="popup-action">Clic para ver el detalle ›</p>`;
}

export function drawZones(zones, valueOf, onSelect, highlightedId = null, valueLabel = 'Hogares en grupo A') {
  lastDraw = [zones, valueOf, onSelect, highlightedId, valueLabel];
  if (markerLayer) markerLayer.clearLayers();

  // Primero los anillos rurales, para que las cabeceras queden encima.
  const rural = zones.filter((zone) => Number(zone.zona) === 2);
  const urban = zones.filter((zone) => Number(zone.zona) !== 2);

  rural.forEach((zone) => {
    const value = valueOf(zone);
    const center = centerOf(zone.cod_mpio);
    const highlighted = highlightedId && zone.zona_id === highlightedId;

    const ring = L.circle([center.lat, center.lng], {
      radius: 4200,
      fillColor: colorOf(value),
      fillOpacity: highlighted ? 0.34 : 0.2,
      color: colorOf(value),
      weight: highlighted ? 3 : 1.5,
      dashArray: '6 5',
      className: 'rural-ring'
    });

    ring.bindPopup(popupHtml(zone, value, valueLabel) +
      '<p class="popup-action">Área esquemática: el Sisbén no publica geometrías por zona.</p>');
    ring.on('click', () => onSelect(zone));
    ring.addTo(markerLayer);
  });

  urban.forEach((zone) => {
    const value = valueOf(zone);
    const center = centerOf(zone.cod_mpio);
    const highlighted = highlightedId && zone.zona_id === highlightedId;

    const marker = L.circleMarker([center.lat, center.lng], {
      radius: radiusOf(value),
      fillColor: colorOf(value),
      fillOpacity: 0.85,
      color: highlighted ? '#17241F' : '#ffffff',
      weight: highlighted ? 3 : 1.5,
      className: 'zone-marker'
    });

    marker.bindPopup(popupHtml(zone, value, valueLabel));
    // En el recuadro compacto cuatro rotulos fijos se solapan entre si y con
    // los toponimos de la cartografia base. Solo queda fijo el de la zona
    // seleccionada; los demas aparecen al pasar el puntero. Con el mapa
    // ampliado caben los cuatro y quedan todos fijos.
    marker.bindTooltip(townName(zone), {
      permanent: largeMode || Boolean(highlighted),
      direction: 'right', offset: [8, 0], className: 'town-label'
    });
    marker.on('click', () => onSelect(zone));
    marker.addTo(markerLayer);
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

// Cambia entre el recuadro compacto y el tamaño de trabajo. Se llama despues de
// que el controlador haya movido o redimensionado el contenedor.
//
// invalidateSize a mano porque el ResizeObserver de initMap no siempre se
// entera: si el nodo se mueve a otro contenedor con el mismo alto final, no hay
// cambio de tamaño que observar pero Leaflet conserva medidas antiguas y deja
// franjas grises. Se repite en el siguiente fotograma por si el navegador aun
// no habia resuelto la maqueta del panel.
export function setLargeMode(on) {
  if (!map) return;
  largeMode = Boolean(on);

  // La rueda solo hace zoom con el mapa ampliado; en la barra lateral debe
  // seguir desplazando la columna.
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
