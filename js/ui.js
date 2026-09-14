/**
 * SocialData — Módulo de interfaz (UI)
 * Funciones de renderizado puras: reciben datos y referencias al DOM y
 * actualizan los paneles. No contienen lógica de negocio ni llamadas a la API.
 */

const SocialDataUI = (() => {

  const ETIQUETA_ESCALA = {
    baja: 'Prevalencia baja',
    media: 'Prevalencia media',
    alta: 'Prevalencia alta',
    'sin-datos': 'Sin datos'
  };

  const GRUPOS = ['A', 'B', 'C', 'D'];
  const NOMBRE_GRUPO = {
    A: 'Pobreza extrema',
    B: 'Pobreza moderada',
    C: 'Vulnerable',
    D: 'No pobre ni vulnerable'
  };

  const pct = (v) => `${(Number(v) * 100).toFixed(1).replace('.', ',')}%`;
  const pctNum = (v) => `${Number(v).toFixed(1).replace('.', ',')}%`;

  function clasificarEscala(valor) {
    return SocialDataMap.clasificarEscala(valor);
  }

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  // ---------------------------------------------------------
  // Panel izquierdo: dimensiones del catálogo
  // ---------------------------------------------------------
  function renderDimensiones(contenedor, dimensiones, dimensionActiva, alSeleccionar) {
    contenedor.innerHTML = '';
    dimensiones.forEach((dimension, indice) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'tarjeta-dimension' + (dimension.dimension === dimensionActiva ? ' is-activa' : '');
      boton.setAttribute('role', 'listitem');
      boton.setAttribute('aria-pressed', dimension.dimension === dimensionActiva ? 'true' : 'false');
      boton.innerHTML = `
        <span class="tarjeta-dimension-indice">${indice + 1}</span>
        <span class="tarjeta-dimension-texto">
          <span class="tarjeta-dimension-nombre">${escaparHtml(dimension.dimension)}</span>
          <span class="tarjeta-dimension-peso">${dimension.n} indicadores</span>
        </span>`;
      boton.addEventListener('click', () => alSeleccionar(dimension.dimension));
      contenedor.appendChild(boton);
    });
  }

  function renderIndicadoresPlaceholder(contenedor, tituloEl, subtituloEl) {
    contenedor.innerHTML = '';
    tituloEl.textContent = 'Indicadores';
    subtituloEl.textContent = 'Selecciona una dimensión para ver sus indicadores';
  }

  /** Indicadores de la dimensión activa, con su prevalencia real si hay zona seleccionada. */
  function renderIndicadores(contenedor, tituloEl, subtituloEl, dimension, indicadores, privaciones) {
    tituloEl.textContent = dimension;
    subtituloEl.textContent = privaciones
      ? `${indicadores.length} indicadores · prevalencia en ${privaciones.zona_nombre}`
      : `${indicadores.length} indicadores · selecciona una zona para ver su prevalencia`;
    contenedor.innerHTML = '';

    const mapaPrev = new Map();
    if (privaciones) {
      privaciones.dimensiones.forEach((d) =>
        d.indicadores.forEach((i) => mapaPrev.set(i.codigo, i.prevalencia)));
    }

    indicadores.forEach((indicador) => {
      const valor = mapaPrev.has(indicador.codigo) ? mapaPrev.get(indicador.codigo) * 100 : null;
      const fila = document.createElement('div');
      fila.className = 'indicador-item';
      fila.setAttribute('role', 'listitem');
      fila.innerHTML = `
        <label title="${escaparHtml(indicador.descripcion || '')}">${escaparHtml(indicador.nombre)}</label>
        <span class="indicador-peso">${valor === null ? '—' : pctNum(valor)}</span>`;
      contenedor.appendChild(fila);
    });
  }

  // ---------------------------------------------------------
  // Breadcrumb
  // ---------------------------------------------------------
  function renderBreadcrumb(contenedor, ruta, alNavegar) {
    contenedor.innerHTML = '';
    ruta.forEach((paso, indice) => {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'crumb' + (indice === ruta.length - 1 ? ' is-active' : '');
      boton.textContent = paso.nombre;
      if (indice !== ruta.length - 1) boton.addEventListener('click', () => alNavegar(paso));
      li.appendChild(boton);
      contenedor.appendChild(li);
    });
  }

  // ---------------------------------------------------------
  // Panel derecho: ficha técnica
  // ---------------------------------------------------------
  function mostrarDetalleVacio(elementoVacio, elementoContenido) {
    elementoVacio.hidden = false;
    elementoContenido.hidden = true;
  }

  /**
   * @param {Object} zona        fila de /indicadores/zonas
   * @param {Object} prediccion  respuesta de /ia/prediccion/{id} (o null)
   * @param {Object} explicacion respuesta de /ia/explicacion/{id} (o null)
   * @param {Object} privaciones respuesta de /indicadores/zonas/{id}/privaciones
   */
  function renderDetalle(refs, zona, prediccion, explicacion, privaciones) {
    refs.elementoVacio.hidden = true;
    refs.elementoContenido.hidden = false;
    refs.ubicacion.textContent = zona.zona_nombre;

    const pctA = Number(zona.pct_grupo_a) * 100;
    refs.valorGrupoA.textContent = pctNum(pctA);
    refs.valorHogares.textContent = Number(zona.total_hogares).toLocaleString('es-CO');

    const escala = clasificarEscala(pctA);
    refs.valorEscala.textContent = ETIQUETA_ESCALA[escala];
    refs.valorEscala.className = `tarjeta-ipm-desc escala-${escala}`;

    if (prediccion) {
      const pred = prediccion.predicho;
      const mayor = GRUPOS.reduce((a, b) => (pred[a] >= pred[b] ? a : b));
      refs.valorPredicho.textContent = `${mayor} · ${pct(pred[mayor])}`;
      refs.valorPredichoDesc.textContent = `${NOMBRE_GRUPO[mayor]} (grupo mayoritario estimado)`;
    } else {
      refs.valorPredicho.textContent = '—';
      refs.valorPredichoDesc.textContent = 'Predicción no disponible';
    }

    // --- distribución observada frente a la predicha ---
    refs.distribucion.innerHTML = '';
    GRUPOS.forEach((g) => {
      const obs = Number(zona[`pct_grupo_${g.toLowerCase()}`]) * 100;
      const est = prediccion ? Number(prediccion.predicho[g]) * 100 : null;
      const item = document.createElement('div');
      item.className = 'barra-item';
      item.innerHTML = `
        <div class="barra-cabecera">
          <span class="barra-nombre">Grupo ${g} · ${NOMBRE_GRUPO[g]}</span>
          <span class="barra-valor">${pctNum(obs)}${est === null ? '' : ` <small>(modelo ${pctNum(est)})</small>`}</span>
        </div>
        <div class="barra-pista">
          <div class="barra-relleno grupo-${g}" style="width: ${Math.min(obs, 100)}%"></div>
        </div>`;
      refs.distribucion.appendChild(item);
    });

    // --- factores dominantes según SHAP ---
    refs.shapLista.innerHTML = '';
    if (explicacion && explicacion.contribuciones && explicacion.contribuciones.length) {
      explicacion.contribuciones.slice(0, 8).forEach((c) => {
        const magnitud = Math.abs(c.contribucion);
        const item = document.createElement('div');
        item.className = 'barra-item';
        item.innerHTML = `
          <div class="barra-cabecera">
            <span class="barra-nombre">${escaparHtml(c.etiqueta)} <small>· ${escaparHtml(c.dimension)}</small></span>
            <span class="barra-valor">${c.contribucion > 0 ? '+' : ''}${c.contribucion.toFixed(3).replace('.', ',')}</span>
          </div>
          <div class="barra-pista">
            <div class="barra-relleno ${c.contribucion > 0 ? 'escala-alta' : 'escala-baja'}"
                 style="width: ${Math.min(magnitud * 90, 100)}%"></div>
          </div>`;
        refs.shapLista.appendChild(item);
      });
      refs.shapNota.textContent =
        `Contribuciones SHAP del hogar representativo de la zona al grupo ${explicacion.grupo_predicho}. ` +
        'Explican en qué se apoya el modelo, no relaciones causales.';
    } else {
      refs.shapNota.textContent = 'Explicabilidad no disponible para esta zona.';
    }

    // --- desglose de privaciones observadas ---
    refs.desgloseLista.innerHTML = '';
    if (privaciones) {
      privaciones.dimensiones.forEach((dim) => {
        const encabezado = document.createElement('p');
        encabezado.className = 'panel-subtitle';
        encabezado.style.margin = '2px 0 -2px';
        encabezado.textContent = dim.dimension;
        refs.desgloseLista.appendChild(encabezado);

        dim.indicadores.forEach((ind) => {
          const valor = ind.prevalencia * 100;
          const item = document.createElement('div');
          item.className = 'barra-item';
          item.innerHTML = `
            <div class="barra-cabecera">
              <span class="barra-nombre">${escaparHtml(ind.nombre)}</span>
              <span class="barra-valor">${pctNum(valor)}</span>
            </div>
            <div class="barra-pista">
              <div class="barra-relleno escala-${clasificarEscala(valor)}" style="width: ${Math.min(valor, 100)}%"></div>
            </div>`;
          refs.desgloseLista.appendChild(item);
        });
      });
    }
  }

  return {
    renderDimensiones, renderIndicadoresPlaceholder, renderIndicadores,
    renderBreadcrumb, mostrarDetalleVacio, renderDetalle,
    clasificarEscala, escaparHtml, pct, pctNum, GRUPOS, NOMBRE_GRUPO
  };
})();
