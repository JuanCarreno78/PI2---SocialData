/**
 * SocialData — Módulo del mapa interactivo (Leaflet.js)
 * ------------------------------------------------------------------
 * Representa las ocho zonas de análisis del proyecto: los cuatro
 * municipios del área metropolitana, cada uno con su cabecera urbana y
 * su centro poblado y rural disperso.
 *
 * Representación adoptada y por qué:
 *   - La cabecera urbana se dibuja como un círculo en las coordenadas
 *     reales del casco urbano del municipio.
 *   - La zona rural se dibuja como un anillo alrededor de esa cabecera.
 *     Es una representación ESQUEMÁTICA del territorio circundante: el
 *     Sisbén no publica geometrías ni coordenadas por zona, de modo que
 *     no existe un punto real que ubicar y no se inventa ninguno.
 *
 * La escala de color corresponde al porcentaje de hogares clasificados
 * en el grupo A del Sisbén (pobreza extrema).
 */

const SocialDataMap = (() => {
  let mapa = null;
  let capaMarcadores = null;
  let encuadreHecho = false;

  const LIMITES_METROPOLITANOS = [[6.93, -73.26], [7.19, -72.99]];

  // Cartografía base, en orden de preferencia. Ninguna de las dos exige
  // clave de API (se descartó CARTO: desde 2024 marca sus teselas con
  // «API KEY REQUIRED» si la aplicación no está registrada).
  //
  //   1. Esri «World Light Gray Canvas»: gris muy desaturado, pensado
  //      justamente para superponer datos temáticos; deja legibles los
  //      círculos de color de las zonas. Los topónimos viajan en una
  //      segunda capa (`etiquetas`) que se pinta por encima de las zonas.
  //   2. OpenStreetMap estándar, como respaldo.
  //
  // Si ningún proveedor responde —por ejemplo al revisar el prototipo sin
  // conexión— el contenedor recibe la clase `sin-cartografia` y las zonas
  // se dibujan sobre la retícula neutra.
  const CAPAS_BASE = [
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      etiquetas: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      opciones: {
        maxZoom: 16,
        attribution: 'Cartografía base &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; colaboradores de OpenStreetMap'
      }
    },
    {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      opciones: {
        maxZoom: 19,
        attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    }
  ];

  // Coordenadas del casco urbano de cada municipio.
  const COORDENADAS = {
    '68001': { lat: 7.1193, lng: -73.1227, zoom: 13 },
    '68276': { lat: 7.0631, lng: -73.0854, zoom: 13 },
    '68307': { lat: 7.0680, lng: -73.1698, zoom: 13 },
    '68547': { lat: 6.9908, lng: -73.0508, zoom: 13 }
  };

  // Umbrales de la escala, derivados del rango real observado entre las
  // ocho zonas (de 12,9 % a 60,9 % de hogares en el grupo A).
  const UMBRAL_MEDIA = 25;
  const UMBRAL_ALTA = 45;

  const COLORES_ESCALA = {
    baja: '#3F8F63',
    media: '#D9A441',
    alta: '#B23A2E',
    'sin-datos': '#9AA6A2'
  };

  function clasificarEscala(valor) {
    if (valor === null || valor === undefined) return 'sin-datos';
    if (valor < UMBRAL_MEDIA) return 'baja';
    if (valor < UMBRAL_ALTA) return 'media';
    return 'alta';
  }

  function colorPorValor(valor) { return COLORES_ESCALA[clasificarEscala(valor)]; }

  // Nombre corto del municipio, para rotular el mapa sin cartografía base.
  function nombreMunicipio(zona) {
    return String(zona.zona_nombre || '').split(' - ')[0];
  }

  function coordenadasDe(codMpio) {
    return COORDENADAS[String(codMpio)] || { lat: 7.07, lng: -73.12, zoom: 12 };
  }

  /**
   * Añade la cartografía base con degradación en cascada: si pasados unos
   * segundos el proveedor no ha pintado ninguna tesela, se prueba el
   * siguiente; agotados todos, se deja la retícula neutra.
   */
  function anadirCartografiaBase(contenedor, indice = 0) {
    if (indice >= CAPAS_BASE.length) {
      contenedor.classList.add('sin-cartografia');
      return;
    }

    const definicion = CAPAS_BASE[indice];
    const capa = L.tileLayer(definicion.url, definicion.opciones).addTo(mapa);

    // Los topónimos van en un panel propio por encima de las zonas, para
    // que los círculos de color no los tapen. `pointer-events: none` evita
    // que ese panel intercepte los clics dirigidos a las zonas.
    let capaEtiquetas = null;
    if (definicion.etiquetas) {
      if (!mapa.getPane('etiquetas')) {
        const panel = mapa.createPane('etiquetas');
        panel.style.zIndex = 450;
        panel.style.pointerEvents = 'none';
      }
      capaEtiquetas = L.tileLayer(definicion.etiquetas, {
        ...definicion.opciones, attribution: '', pane: 'etiquetas'
      }).addTo(mapa);
    }

    let cargoAlgo = false;
    capa.on('load', () => { cargoAlgo = true; });

    // No sirve descartar al proveedor al primer `tileerror`: Leaflet
    // también lo emite cuando el propio mapa cancela teselas a medio
    // descargar al reencuadrar. Se comprueba el resultado real pasados
    // unos segundos, mirando si quedó alguna tesela efectivamente pintada.
    setTimeout(() => {
      const contenedorCapa = capa.getContainer();
      if (cargoAlgo || (contenedorCapa && contenedorCapa.querySelector('.leaflet-tile-loaded'))) return;
      mapa.removeLayer(capa);
      if (capaEtiquetas) mapa.removeLayer(capaEtiquetas);
      anadirCartografiaBase(contenedor, indice + 1);
    }, 5000);
  }

  /**
   * Encuadra el mapa sobre el área metropolitana.
   *
   * Debe llamarse cuando el contenedor ya tiene alto real: `fitBounds`
   * sobre un contenedor de 0 px hace que Leaflet caiga en `maxZoom`, que
   * era la causa de que el mapa abriera pegado a un solo municipio.
   *
   * @returns {boolean} true si el encuadre pudo aplicarse.
   */
  function encuadrar() {
    if (!mapa) return false;
    mapa.invalidateSize({ animate: false });
    const tam = mapa.getSize();
    if (tam.x < 40 || tam.y < 40) return false;
    mapa.fitBounds(LIMITES_METROPOLITANOS, { padding: [28, 28] });
    encuadreHecho = true;
    return true;
  }

  function inicializar(contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) throw new Error(`No existe el contenedor #${contenedorId}`);

    mapa = L.map(contenedor, { zoomControl: true, minZoom: 10, maxZoom: 16 });
    anadirCartografiaBase(contenedor);
    L.control.scale({ imperial: false, metric: true }).addTo(mapa);
    capaMarcadores = L.layerGroup().addTo(mapa);

    // El panel del mapa se dimensiona con flexbox, de modo que su alto
    // puede no estar resuelto todavía en este punto. Se reintenta hasta
    // que el navegador termine el primer reflow.
    if (!encuadrar()) {
      requestAnimationFrame(() => encuadrar());
      window.addEventListener('load', () => { if (!encuadreHecho) encuadrar(); }, { once: true });
    }

    // Cualquier cambio posterior de tamaño (redimensionar la ventana,
    // mostrar un panel) obliga a Leaflet a recalcular su viewport.
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (encuadreHecho) mapa.invalidateSize({ animate: false });
        else encuadrar();
      }).observe(contenedor);
    }

    return mapa;
  }

  function limpiarMarcadores() {
    if (capaMarcadores) capaMarcadores.clearLayers();
  }

  function radioPorValor(valor) {
    if (valor === null || valor === undefined) return 10;
    const proporcion = Math.min(Math.max(valor, 0), 100) / 100;
    return 12 + proporcion * 18;
  }

  function contenidoPopup(zona, valor, etiquetaValor) {
    const texto = valor === null || valor === undefined ? 'Sin datos' : `${valor.toFixed(1)}%`;
    return `<p class="popup-titulo">${zona.zona_nombre}</p>` +
           `<p class="popup-ipm">${etiquetaValor}: <strong>${texto}</strong></p>` +
           `<p class="popup-ipm">${Number(zona.total_hogares).toLocaleString('es-CO')} hogares</p>` +
           `<p class="popup-accion">Clic para ver el detalle ›</p>`;
  }

  /**
   * Dibuja las zonas sobre el mapa.
   * @param {Array}    zonas          filas de /indicadores/zonas
   * @param {Function} obtenerValor   fn(zona) => número 0-100 o null
   * @param {Function} alHacerClic    fn(zona) al pulsar la zona
   * @param {number|null} idResaltado zona_id a resaltar
   * @param {string}   etiquetaValor  nombre del valor mostrado en el popup
   */
  function dibujarZonas(zonas, obtenerValor, alHacerClic, idResaltado = null, etiquetaValor = 'Hogares en grupo A') {
    limpiarMarcadores();

    // Primero los anillos rurales, para que las cabeceras queden encima.
    const rurales = zonas.filter((z) => Number(z.zona) === 2);
    const urbanas = zonas.filter((z) => Number(z.zona) !== 2);

    rurales.forEach((zona) => {
      const valor = obtenerValor(zona);
      const coord = coordenadasDe(zona.cod_mpio);
      const resaltado = idResaltado && zona.zona_id === idResaltado;

      const anillo = L.circle([coord.lat, coord.lng], {
        radius: 4200,
        fillColor: colorPorValor(valor),
        fillOpacity: resaltado ? 0.34 : 0.2,
        color: colorPorValor(valor),
        weight: resaltado ? 3 : 1.5,
        dashArray: '6 5',
        className: 'zona-rural'
      });
      anillo.bindPopup(contenidoPopup(zona, valor, etiquetaValor) +
        `<p class="popup-accion">Área esquemática: el Sisbén no publica geometrías por zona.</p>`);
      anillo.on('click', () => alHacerClic(zona));
      anillo.addTo(capaMarcadores);
    });

    urbanas.forEach((zona) => {
      const valor = obtenerValor(zona);
      const coord = coordenadasDe(zona.cod_mpio);
      const resaltado = idResaltado && zona.zona_id === idResaltado;

      const marcador = L.circleMarker([coord.lat, coord.lng], {
        radius: radioPorValor(valor),
        fillColor: colorPorValor(valor),
        fillOpacity: 0.85,
        color: resaltado ? '#17241F' : '#ffffff',
        weight: resaltado ? 3 : 1.5,
        className: 'marcador-zona'
      });
      marcador.bindPopup(contenidoPopup(zona, valor, etiquetaValor));
      marcador.bindTooltip(nombreMunicipio(zona), {
        permanent: true, direction: 'right', offset: [8, 0], className: 'etiqueta-municipio'
      });
      marcador.on('click', () => alHacerClic(zona));
      marcador.addTo(capaMarcadores);
    });
  }

  function volarAZona(codMpio) {
    const coord = coordenadasDe(codMpio);
    if (mapa) mapa.flyTo([coord.lat, coord.lng], coord.zoom, { duration: 0.8 });
  }

  function ajustarAMetropolitana() {
    if (mapa) mapa.flyToBounds(LIMITES_METROPOLITANOS, { padding: [20, 20], duration: 0.8 });
  }

  return {
    inicializar, dibujarZonas, volarAZona, ajustarAMetropolitana,
    clasificarEscala, colorPorValor, UMBRAL_MEDIA, UMBRAL_ALTA
  };
})();
