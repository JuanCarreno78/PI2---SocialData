/**
 * SocialData — Orquestador de la interfaz
 * ------------------------------------------------------------------
 * Coordina el estado y el renderizado de los tres paneles. La unidad de
 * análisis son las ocho zonas del proyecto: los cuatro municipios del área
 * metropolitana, cada uno con su cabecera urbana y su centro poblado y
 * rural disperso.
 */

document.addEventListener('DOMContentLoaded', () => {

  const refs = {
    breadcrumb: document.getElementById('breadcrumb-list'),
    resumenGlobal: document.getElementById('resumen-global'),

    listaDimensiones: document.getElementById('lista-dimensiones'),
    tituloIndicadores: document.getElementById('titulo-indicadores'),
    subtituloIndicadores: document.getElementById('subtitulo-indicadores'),
    listaIndicadores: document.getElementById('lista-indicadores'),
    btnVistaGeneral: document.getElementById('btn-vista-general'),

    modoTexto: document.getElementById('mapa-modo-texto'),

    tabChat: document.getElementById('tab-chat'),
    tabTecnica: document.getElementById('tab-tecnica'),
    vistaChat: document.getElementById('vista-chat'),
    vistaTecnica: document.getElementById('vista-tecnica'),

    detalleTitulo: document.getElementById('detalle-titulo'),
    ubicacion: document.getElementById('detalle-ubicacion'),
    chatVacio: document.getElementById('chat-vacio'),
    chatContenido: document.getElementById('chat-contenido'),
    chatMensajes: document.getElementById('chat-mensajes'),
    chatSugerencias: document.getElementById('chat-sugerencias'),
    chatFormulario: document.getElementById('chat-formulario'),
    chatInput: document.getElementById('chat-input'),

    elementoVacio: document.getElementById('detalle-vacio'),
    elementoContenido: document.getElementById('detalle-contenido'),
    valorGrupoA: document.getElementById('valor-grupo-a'),
    valorHogares: document.getElementById('valor-hogares'),
    valorPredicho: document.getElementById('valor-predicho'),
    valorPredichoDesc: document.getElementById('valor-predicho-desc'),
    valorEscala: document.getElementById('valor-escala'),
    distribucion: document.getElementById('distribucion-grupos'),
    shapLista: document.getElementById('shap-lista'),
    shapNota: document.getElementById('shap-nota'),
    desgloseLista: document.getElementById('desglose-lista')
  };

  const estado = {
    mapaDisponible: true,
    zonas: [],
    catalogo: null,
    dimensionActiva: null,
    zonaSeleccionada: null,
    privaciones: null
  };

  const valorZona = (zona) => Number(zona.pct_grupo_a) * 100;

  // ---------------------------------------------------------
  // Panel izquierdo
  // ---------------------------------------------------------
  function redibujarDimensiones() {
    if (!estado.catalogo) return;
    SocialDataUI.renderDimensiones(
      refs.listaDimensiones, estado.catalogo.dimensiones, estado.dimensionActiva, seleccionarDimension);

    if (!estado.dimensionActiva) {
      SocialDataUI.renderIndicadoresPlaceholder(
        refs.listaIndicadores, refs.tituloIndicadores, refs.subtituloIndicadores);
      return;
    }
    const indicadores = estado.catalogo.indicadores.filter((i) => i.dimension === estado.dimensionActiva);
    SocialDataUI.renderIndicadores(
      refs.listaIndicadores, refs.tituloIndicadores, refs.subtituloIndicadores,
      estado.dimensionActiva, indicadores, estado.privaciones);
  }

  function seleccionarDimension(dimension) {
    estado.dimensionActiva = estado.dimensionActiva === dimension ? null : dimension;
    refs.modoTexto.textContent = estado.dimensionActiva || 'Hogares en grupo A (pobreza extrema)';
    redibujarDimensiones();
  }

  refs.btnVistaGeneral.addEventListener('click', () => {
    estado.dimensionActiva = null;
    refs.modoTexto.textContent = 'Hogares en grupo A (pobreza extrema)';
    redibujarDimensiones();
  });

  // ---------------------------------------------------------
  // Mapa y navegación
  // ---------------------------------------------------------
  function redibujarListaZonas() {
    const contenedor = document.getElementById('mapa');
    contenedor.classList.add('mapa-lista');
    contenedor.innerHTML = '';
    const lista = document.createElement('div');
    lista.className = 'zona-lista';
    [...estado.zonas]
      .sort((a, b) => Number(b.pct_grupo_a) - Number(a.pct_grupo_a))
      .forEach((zona) => {
        const valor = valorZona(zona);
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'zona-item' +
          (estado.zonaSeleccionada && estado.zonaSeleccionada.zona_id === zona.zona_id ? ' is-activa' : '');
        boton.innerHTML =
          `<span class="zona-punto escala-${SocialDataUI.clasificarEscala(valor)}"></span>` +
          `<span class="zona-nombre">${SocialDataUI.escaparHtml(zona.zona_nombre)}</span>` +
          `<span class="zona-valor">${SocialDataUI.pctNum(valor)}</span>`;
        boton.addEventListener('click', () => seleccionarZona(zona));
        lista.appendChild(boton);
      });
    contenedor.appendChild(lista);
  }

  function redibujarMapa() {
    if (!estado.mapaDisponible) { redibujarListaZonas(); return; }
    SocialDataMap.dibujarZonas(
      estado.zonas, valorZona, seleccionarZona,
      estado.zonaSeleccionada ? estado.zonaSeleccionada.zona_id : null,
      'Hogares en grupo A');
  }

  function redibujarBreadcrumb() {
    const ruta = [{ nombre: 'Área Metropolitana' }];
    if (estado.zonaSeleccionada) ruta.push({ nombre: estado.zonaSeleccionada.zona_nombre });
    SocialDataUI.renderBreadcrumb(refs.breadcrumb, ruta, () => verVistaGeneral());
  }

  function verVistaGeneral() {
    estado.zonaSeleccionada = null;
    estado.privaciones = null;
    refs.detalleTitulo.textContent = 'Asistente SocialData';
    refs.ubicacion.textContent = 'Área Metropolitana de Bucaramanga';
    refs.chatVacio.hidden = false;
    refs.chatContenido.hidden = true;
    SocialDataUI.mostrarDetalleVacio(refs.elementoVacio, refs.elementoContenido);
    if (estado.mapaDisponible) SocialDataMap.ajustarAMetropolitana();
    redibujarBreadcrumb();
    redibujarMapa();
    redibujarDimensiones();
  }

  async function seleccionarZona(zona, acercar = true) {
    estado.zonaSeleccionada = zona;
    redibujarBreadcrumb();
    redibujarMapa();
    if (estado.mapaDisponible && acercar) SocialDataMap.volarAZona(zona.cod_mpio);

    refs.detalleTitulo.textContent = 'Asistente SocialData';
    refs.ubicacion.textContent = zona.zona_nombre;
    refs.chatVacio.hidden = true;
    refs.chatContenido.hidden = false;

    SocialDataChat.saludar(zona);
    SocialDataChat.render(refs.chatMensajes, zona.zona_id);
    pintarSugerencias();

    const [privaciones, prediccion, explicacion] = await Promise.all([
      SocialDataAPI.obtenerPrivaciones(zona.zona_id),
      SocialDataAPI.obtenerPrediccion(zona.zona_id),
      SocialDataAPI.obtenerExplicacion(zona.zona_id)
    ]);
    estado.privaciones = privaciones;

    SocialDataUI.renderDetalle(refs, zona, prediccion, explicacion, privaciones);
    redibujarDimensiones();
  }

  // ---------------------------------------------------------
  // Pestañas
  // ---------------------------------------------------------
  function activarPestana(esChat) {
    refs.tabChat.classList.toggle('is-activa', esChat);
    refs.tabTecnica.classList.toggle('is-activa', !esChat);
    refs.tabChat.setAttribute('aria-selected', String(esChat));
    refs.tabTecnica.setAttribute('aria-selected', String(!esChat));
    refs.vistaChat.hidden = !esChat;
    refs.vistaTecnica.hidden = esChat;
  }
  refs.tabChat.addEventListener('click', () => activarPestana(true));
  refs.tabTecnica.addEventListener('click', () => activarPestana(false));

  // ---------------------------------------------------------
  // Asistente
  // ---------------------------------------------------------
  function pintarSugerencias() {
    refs.chatSugerencias.innerHTML = '';
    SocialDataChat.SUGERENCIAS.forEach((texto) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'chat-sugerencia';
      boton.textContent = texto;
      boton.addEventListener('click', () => enviar(texto));
      refs.chatSugerencias.appendChild(boton);
    });
  }

  function enviar(pregunta) {
    const zona = estado.zonaSeleccionada;
    if (!zona || !pregunta.trim()) return;
    SocialDataChat.preguntar(zona, pregunta.trim());
    SocialDataChat.render(refs.chatMensajes, zona.zona_id);
  }

  refs.chatFormulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviar(refs.chatInput.value);
    refs.chatInput.value = '';
  });

  // ---------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------
  async function iniciar() {
    try {
      SocialDataMap.inicializar('mapa');
    } catch (error) {
      estado.mapaDisponible = false;
    }

    const [resumen, zonas, catalogo] = await Promise.all([
      SocialDataAPI.obtenerResumen(),
      SocialDataAPI.obtenerZonas(),
      SocialDataAPI.obtenerCatalogo()
    ]);
    estado.zonas = zonas.zonas;
    estado.catalogo = catalogo;

    refs.resumenGlobal.textContent =
      `${resumen.total_hogares.toLocaleString('es-CO')} hogares · ` +
      `${resumen.total_personas.toLocaleString('es-CO')} personas · ` +
      `${SocialDataUI.pct(resumen.pct_pobreza_extrema)} en grupo A`;

    redibujarDimensiones();
    redibujarBreadcrumb();
    redibujarMapa();

    // Se abre sobre la zona con mayor pobreza extrema, para que la interfaz
    // muestre desde el inicio lo que sabe hacer.
    const inicial = [...estado.zonas].sort((a, b) => Number(b.pct_grupo_a) - Number(a.pct_grupo_a))[0];
    // Sin acercar: la vista inicial conserva toda el área metropolitana.
    seleccionarZona(inicial, false);
  }

  iniciar();
});
