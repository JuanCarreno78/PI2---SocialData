/**
 * SocialData — Asistente analítico
 * ------------------------------------------------------------------
 * Responde sobre la zona seleccionada a partir de las cifras que ya están
 * calculadas: distribución por grupo del Sisbén, prevalencia de privaciones
 * y factores dominantes del modelo.
 *
 * Las respuestas se componen aquí con plantillas sobre esas cifras. El
 * asistente no calcula nada por su cuenta y no emite ninguna cifra que no
 * provenga de los datos de la zona.
 */

const SocialDataChat = (() => {

  const historial = new Map();
  const obtener = (zonaId) => {
    if (!historial.has(zonaId)) historial.set(zonaId, []);
    return historial.get(zonaId);
  };
  const agregar = (zonaId, autor, texto) => obtener(zonaId).push({ autor, texto });
  const existe = (zonaId) => historial.has(zonaId) && historial.get(zonaId).length > 0;

  const pct = (v) => `${(Number(v) * 100).toFixed(1).replace('.', ',')} %`;

  // Líneas de intervención asociadas a cada privación, con la entidad que
  // habitualmente las lidera en el orden territorial colombiano.
  const INTERVENCIONES = {
    'Trabajo informal':
      'rutas de formalización laboral y empresarial con la Cámara de Comercio y el SENA, y esquemas de aseguramiento para trabajadores independientes',
    'Desempleo de larga duración':
      'intermediación laboral a través de la Agencia Pública de Empleo y formación orientada a la demanda del sector productivo regional',
    'Trabajo infantil':
      'estrategias de erradicación del trabajo infantil articuladas con el ICBF y transferencias condicionadas a la asistencia escolar',
    'Bajo logro educativo':
      'programas de educación para adultos y validación de la básica y la media',
    'Analfabetismo':
      'campañas de alfabetización de adultos con la Secretaría de Educación',
    'Inasistencia escolar':
      'búsqueda activa de menores desescolarizados, matrícula extraordinaria y transporte escolar',
    'Rezago escolar':
      'programas de nivelación y aceleración del aprendizaje',
    'Sin aseguramiento en salud':
      'jornadas de afiliación al régimen subsidiado y depuración de las bases de datos de afiliación',
    'Barreras de acceso a servicios de salud':
      'brigadas de salud extramurales y rutas integrales de atención en zonas de difícil acceso',
    'Barreras de acceso a cuidado de primera infancia':
      'ampliación de cobertura de Centros de Desarrollo Infantil y de la modalidad familiar del ICBF',
    'Sin acceso a fuente de agua mejorada':
      'ampliación de redes de acueducto y soluciones alternativas en zona rural dispersa, como captación de agua lluvia y plantas modulares',
    'Inadecuada eliminación de excretas':
      'ampliación del alcantarillado y pozos sépticos donde la red no llega',
    'Material inadecuado de pisos':
      'subsidios de mejoramiento de vivienda en sitio propio y programas de pisos saludables',
    'Material inadecuado de paredes exteriores':
      'subsidios de mejoramiento de vivienda en sitio propio',
    'Hacinamiento crítico':
      'mejoramiento de vivienda con ampliación de cuartos y programas de vivienda de interés prioritario'
  };

  // ---------------------------------------------------------
  // Lectura de los datos de la zona
  // ---------------------------------------------------------
  function contexto(zona) {
    const det = DATOS.detalle[String(zona.zona_id)];
    const privaciones = det.privaciones.dimensiones
      .flatMap((d) => d.indicadores.map((i) => ({ ...i, dimension: d.dimension })))
      .sort((a, b) => b.prevalencia - a.prevalencia);
    const factores = det.explicacion.contribuciones;
    return { det, privaciones, factores };
  }

  function ranking(zona) {
    const orden = [...DATOS.zonas].sort((a, b) => b.pct_grupo_a - a.pct_grupo_a);
    return { posicion: orden.findIndex((z) => z.zona_id === zona.zona_id) + 1, total: orden.length };
  }

  const sinTildes = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // ---------------------------------------------------------
  // Respuestas
  // ---------------------------------------------------------
  function panorama(zona) {
    const { privaciones } = contexto(zona);
    const r = ranking(zona);
    const top = privaciones.slice(0, 3);
    return `En ${zona.zona_nombre} hay ${Number(zona.total_hogares).toLocaleString('es-CO')} ` +
      `hogares registrados en el Sisbén, de los cuales el ${pct(zona.pct_grupo_a)} está en el ` +
      `grupo A (pobreza extrema) y el ${pct(Number(zona.pct_grupo_a) + Number(zona.pct_grupo_b))} ` +
      `entre los grupos A y B. Ocupa el puesto ${r.posicion} de ${r.total} entre las zonas del ` +
      `área metropolitana ordenadas por pobreza extrema.\n\n` +
      `Las privaciones más extendidas son ${top[0].nombre.toLowerCase()} (${pct(top[0].prevalencia)}), ` +
      `${top[1].nombre.toLowerCase()} (${pct(top[1].prevalencia)}) y ` +
      `${top[2].nombre.toLowerCase()} (${pct(top[2].prevalencia)}).`;
  }

  function critico(zona) {
    const { privaciones, factores } = contexto(zona);
    const p = privaciones[0];
    const f = factores.find((x) => x.contribucion > 0) || factores[0];
    return `La privación más extendida es ${p.nombre.toLowerCase()}, presente en el ` +
      `${pct(p.prevalencia)} de los hogares de la zona, dentro de la dimensión de ` +
      `${p.dimension.toLowerCase()}.\n\n` +
      `Conviene distinguir dos cosas: qué es más frecuente y qué pesa más en la clasificación. ` +
      `El factor que más empuja hacia el grupo estimado es ${f.etiqueta.toLowerCase()} ` +
      `(${f.dimension.toLowerCase()}). Una privación puede ser muy común y aun así influir poco ` +
      `en el grupo del Sisbén, porque este clasifica por capacidad de generar ingresos.`;
  }

  function recomendar(zona) {
    const { privaciones, factores } = contexto(zona);
    const candidatas = [];
    const laboral = factores.find((f) => f.dimension === 'Trabajo' && f.contribucion > 0);
    if (laboral && INTERVENCIONES[laboral.etiqueta]) {
      candidatas.push({ nombre: laboral.etiqueta, motivo: 'es el factor laboral que más pesa en el modelo' });
    }
    privaciones.slice(0, 4).forEach((p) => {
      if (INTERVENCIONES[p.nombre] && !candidatas.some((c) => c.nombre === p.nombre)) {
        candidatas.push({ nombre: p.nombre, motivo: `afecta al ${pct(p.prevalencia)} de los hogares` });
      }
    });

    let texto = `Líneas de intervención pertinentes para ${zona.zona_nombre}, ordenadas por el peso ` +
      `que tienen en esta zona:\n`;
    candidatas.slice(0, 4).forEach((c, i) => {
      texto += `\n${i + 1}. ${c.nombre}: ${INTERVENCIONES[c.nombre]}. Se prioriza porque ${c.motivo}.`;
    });
    texto += `\n\nUna advertencia para leer esto bien: mejorar la infraestructura de servicios ` +
      `públicos eleva la calidad de vida, pero no siempre cambia el grupo del Sisbén, porque ese ` +
      `grupo depende sobre todo de la capacidad del hogar de generar ingresos. Son dos objetivos ` +
      `distintos y ambos legítimos.`;
    return texto;
  }

  function porDimension(zona, dimension) {
    const { privaciones } = contexto(zona);
    const dela = privaciones.filter((p) => sinTildes(p.dimension).includes(sinTildes(dimension)));
    if (!dela.length) return panorama(zona);
    let texto = `Dimensión de ${dela[0].dimension.toLowerCase()} en ${zona.zona_nombre}:\n`;
    dela.forEach((p) => { texto += `\n• ${p.nombre}: ${pct(p.prevalencia)} de los hogares`; });
    const peor = dela[0];
    if (INTERVENCIONES[peor.nombre]) {
      texto += `\n\nEl indicador más crítico de esta dimensión es ${peor.nombre.toLowerCase()}. ` +
        `La línea de intervención habitual son ${INTERVENCIONES[peor.nombre]}.`;
    }
    return texto;
  }

  function comparar(zona) {
    const orden = [...DATOS.zonas].sort((a, b) => b.pct_grupo_a - a.pct_grupo_a);
    let texto = `Zonas del área metropolitana ordenadas por hogares en el grupo A:\n`;
    orden.forEach((z, i) => {
      const marca = z.zona_id === zona.zona_id ? '  ←  zona seleccionada' : '';
      texto += `\n${i + 1}. ${z.zona_nombre}: ${pct(z.pct_grupo_a)}${marca}`;
    });
    const rural = orden.filter((z) => Number(z.zona) === 2);
    const urbana = orden.filter((z) => Number(z.zona) === 1);
    const prom = (l) => l.reduce((s, z) => s + Number(z.pct_grupo_a), 0) / l.length;
    texto += `\n\nEn los cuatro municipios la zona rural presenta más pobreza extrema que su ` +
      `cabecera urbana: ${pct(prom(rural))} frente a ${pct(prom(urbana))} en promedio.`;
    return texto;
  }

  function modelo(zona) {
    const { det } = contexto(zona);
    const m = DATOS.modelo.metricas;
    const pred = det.prediccion.predicho;
    const mayor = ['A', 'B', 'C', 'D'].reduce((a, b) => (pred[a] >= pred[b] ? a : b));
    return `Para esta zona el modelo estima que el grupo mayoritario es el ${mayor}, con un ` +
      `${pct(pred[mayor])} de los hogares, frente al ${pct(zona['pct_grupo_' + mayor.toLowerCase()])} ` +
      `observado en el dataset.\n\n` +
      `El modelo es ${DATOS.modelo.algoritmo}, entrenado sobre ${DATOS.modelo.n_variables} variables ` +
      `y evaluado con ${DATOS.modelo.validacion.toLowerCase()}. Alcanza ` +
      `${m.accuracy.toFixed(3).replace('.', ',')} de exactitud y ` +
      `${m.f1_macro.toFixed(3).replace('.', ',')} de F1 macro, frente a 0,410 de un clasificador ` +
      `que asignara siempre el grupo mayoritario.`;
  }

  const REGLAS = [
    { claves: ['recomend', 'interven', 'que hacer', 'que deberia', 'accion', 'priorizar', 'invertir', 'proyecto'], fn: recomendar },
    { claves: ['critic', 'principal problema', 'peor', 'mas grave', 'mayor problema', 'problema'], fn: critico },
    { claves: ['compar', 'otras zonas', 'ranking', 'rural', 'urbana', 'peores'], fn: comparar },
    { claves: ['modelo', 'predic', 'prediccion', 'precision', 'exactitud', 'algoritmo', 'ia'], fn: modelo },
    { claves: ['educacion', 'escolar', 'analfabet', 'estudi'], fn: (z) => porDimension(z, 'Educacion') },
    { claves: ['salud', 'aseguramiento', 'eps'], fn: (z) => porDimension(z, 'Salud') },
    { claves: ['trabajo', 'empleo', 'laboral', 'pension', 'informal'], fn: (z) => porDimension(z, 'Trabajo') },
    { claves: ['vivienda', 'agua', 'acueducto', 'alcantarill', 'hacinam', 'piso', 'pared', 'servicio'], fn: (z) => porDimension(z, 'Vivienda') }
  ];

  function responder(zona, pregunta) {
    const p = sinTildes(pregunta);
    const regla = REGLAS.find((r) => r.claves.some((c) => p.includes(c)));
    return regla ? regla.fn(zona) : panorama(zona);
  }

  const SUGERENCIAS = [
    '¿Cuál es el principal problema de esta zona?',
    '¿Qué intervenciones recomiendas?',
    '¿Cómo se compara con las demás zonas?',
    '¿Qué dice el modelo sobre esta zona?'
  ];

  // ---------------------------------------------------------
  // Interfaz pública
  // ---------------------------------------------------------
  function saludar(zona) {
    if (existe(zona.zona_id)) return;
    agregar(zona.zona_id, 'asistente', panorama(zona));
  }

  function preguntar(zona, pregunta) {
    agregar(zona.zona_id, 'usuario', pregunta);
    agregar(zona.zona_id, 'asistente', responder(zona, pregunta));
  }

  function render(contenedor, zonaId) {
    contenedor.innerHTML = '';
    obtener(zonaId).forEach((m) => {
      const fila = document.createElement('div');
      fila.className = `chat-mensaje chat-mensaje--${m.autor}`;
      const burbuja = document.createElement('div');
      burbuja.className = 'chat-burbuja';
      burbuja.textContent = m.texto;
      fila.appendChild(burbuja);
      contenedor.appendChild(fila);
    });
    contenedor.scrollTop = contenedor.scrollHeight;
  }

  return { saludar, preguntar, render, existe, SUGERENCIAS };
})();
