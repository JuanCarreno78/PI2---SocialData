// Asistente analitico. Compone las respuestas con plantillas sobre cifras que
// ya estan calculadas: no calcula nada por su cuenta y no emite ningun numero
// que no venga de los datos de la zona.

import {
  getDeprivations, getExplanation, getPrediction, getZonesRanked, getModelCard
} from './model.js';

const history = new Map();

function messagesOf(zoneId) {
  if (!history.has(zoneId)) history.set(zoneId, []);
  return history.get(zoneId);
}

function push(zoneId, author, text) {
  messagesOf(zoneId).push({ author, text });
}

function ratio(value) {
  return `${(Number(value) * 100).toFixed(1).replace('.', ',')} %`;
}

function withoutAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Lineas de intervencion asociadas a cada privacion, con la entidad que
// habitualmente las lidera en el orden territorial colombiano.
const ACTIONS = {
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

// Privaciones de la zona, de mayor a menor prevalencia.
function deprivationsOf(zone) {
  return getDeprivations(zone.zona_id).dimensiones
    .flatMap((group) => group.indicadores.map((item) => ({ ...item, dimension: group.dimension })))
    .sort((a, b) => b.prevalencia - a.prevalencia);
}

function rankOf(zone) {
  const ranked = getZonesRanked();
  return { position: ranked.findIndex((z) => z.zona_id === zone.zona_id) + 1, total: ranked.length };
}

function overview(zone) {
  const worst = deprivationsOf(zone).slice(0, 3);
  const rank = rankOf(zone);

  return `En ${zone.zona_nombre} hay ${Number(zone.total_hogares).toLocaleString('es-CO')} ` +
    `hogares registrados en el Sisbén, de los cuales el ${ratio(zone.pct_grupo_a)} está en el ` +
    `grupo A (pobreza extrema) y el ${ratio(Number(zone.pct_grupo_a) + Number(zone.pct_grupo_b))} ` +
    `entre los grupos A y B. Ocupa el puesto ${rank.position} de ${rank.total} entre las zonas del ` +
    `área metropolitana ordenadas por pobreza extrema.\n\n` +
    `Las privaciones más extendidas son ${worst[0].nombre.toLowerCase()} (${ratio(worst[0].prevalencia)}), ` +
    `${worst[1].nombre.toLowerCase()} (${ratio(worst[1].prevalencia)}) y ` +
    `${worst[2].nombre.toLowerCase()} (${ratio(worst[2].prevalencia)}).`;
}

function critical(zone) {
  const worst = deprivationsOf(zone)[0];
  const drivers = getExplanation(zone.zona_id).contribuciones;
  const driver = drivers.find((item) => item.contribucion > 0) || drivers[0];

  return `La privación más extendida es ${worst.nombre.toLowerCase()}, presente en el ` +
    `${ratio(worst.prevalencia)} de los hogares de la zona, dentro de la dimensión de ` +
    `${worst.dimension.toLowerCase()}.\n\n` +
    `Conviene distinguir dos cosas: qué es más frecuente y qué pesa más en la clasificación. ` +
    `El factor que más empuja hacia el grupo estimado es ${driver.etiqueta.toLowerCase()} ` +
    `(${driver.dimension.toLowerCase()}). Una privación puede ser muy común y aun así influir poco ` +
    `en el grupo del Sisbén, porque este clasifica por capacidad de generar ingresos.`;
}

function recommend(zone) {
  const deprivations = deprivationsOf(zone);
  const drivers = getExplanation(zone.zona_id).contribuciones;
  const picks = [];

  const labour = drivers.find((item) => item.dimension === 'Trabajo' && item.contribucion > 0);
  if (labour && ACTIONS[labour.etiqueta]) {
    picks.push({ name: labour.etiqueta, reason: 'es el factor laboral que más pesa en el modelo' });
  }

  deprivations.slice(0, 4).forEach((item) => {
    if (ACTIONS[item.nombre] && !picks.some((pick) => pick.name === item.nombre)) {
      picks.push({ name: item.nombre, reason: `afecta al ${ratio(item.prevalencia)} de los hogares` });
    }
  });

  let text = `Líneas de intervención pertinentes para ${zone.zona_nombre}, ordenadas por el peso ` +
    `que tienen en esta zona:\n`;

  picks.slice(0, 4).forEach((pick, index) => {
    text += `\n${index + 1}. ${pick.name}: ${ACTIONS[pick.name]}. Se prioriza porque ${pick.reason}.`;
  });

  text += `\n\nUna advertencia para leer esto bien: mejorar la infraestructura de servicios ` +
    `públicos eleva la calidad de vida, pero no siempre cambia el grupo del Sisbén, porque ese ` +
    `grupo depende sobre todo de la capacidad del hogar de generar ingresos. Son dos objetivos ` +
    `distintos y ambos legítimos.`;

  return text;
}

function byDimension(zone, dimension) {
  const rows = deprivationsOf(zone)
    .filter((item) => withoutAccents(item.dimension).includes(withoutAccents(dimension)));

  if (!rows.length) return overview(zone);

  let text = `Dimensión de ${rows[0].dimension.toLowerCase()} en ${zone.zona_nombre}:\n`;
  rows.forEach((item) => { text += `\n• ${item.nombre}: ${ratio(item.prevalencia)} de los hogares`; });

  const worst = rows[0];
  if (ACTIONS[worst.nombre]) {
    text += `\n\nEl indicador más crítico de esta dimensión es ${worst.nombre.toLowerCase()}. ` +
      `La línea de intervención habitual son ${ACTIONS[worst.nombre]}.`;
  }

  return text;
}

function compare(zone) {
  const ranked = getZonesRanked();
  let text = 'Zonas del área metropolitana ordenadas por hogares en el grupo A:\n';

  ranked.forEach((item, index) => {
    const mark = item.zona_id === zone.zona_id ? '  ←  zona seleccionada' : '';
    text += `\n${index + 1}. ${item.zona_nombre}: ${ratio(item.pct_grupo_a)}${mark}`;
  });

  const rural = ranked.filter((item) => Number(item.zona) === 2);
  const urban = ranked.filter((item) => Number(item.zona) === 1);
  const average = (list) => list.reduce((sum, item) => sum + Number(item.pct_grupo_a), 0) / list.length;

  text += `\n\nEn los cuatro municipios la zona rural presenta más pobreza extrema que su ` +
    `cabecera urbana: ${ratio(average(rural))} frente a ${ratio(average(urban))} en promedio.`;

  return text;
}

function modelAnswer(zone) {
  const card = getModelCard();
  const metrics = card.metricas;
  const predicted = getPrediction(zone.zona_id).predicho;
  const top = ['A', 'B', 'C', 'D'].reduce((a, b) => (predicted[a] >= predicted[b] ? a : b));

  return `Para esta zona el modelo estima que el grupo mayoritario es el ${top}, con un ` +
    `${ratio(predicted[top])} de los hogares, frente al ${ratio(zone['pct_grupo_' + top.toLowerCase()])} ` +
    `observado en el dataset.\n\n` +
    `El modelo es ${card.algoritmo}, entrenado sobre ${card.n_variables} variables ` +
    `y evaluado con ${card.validacion.toLowerCase()}. Alcanza ` +
    `${metrics.accuracy.toFixed(3).replace('.', ',')} de exactitud y ` +
    `${metrics.f1_macro.toFixed(3).replace('.', ',')} de F1 macro, frente a 0,410 de un clasificador ` +
    `que asignara siempre el grupo mayoritario.`;
}

const RULES = [
  { keys: ['recomend', 'interven', 'que hacer', 'que deberia', 'accion', 'priorizar', 'invertir', 'proyecto'], answer: recommend },
  { keys: ['critic', 'principal problema', 'peor', 'mas grave', 'mayor problema', 'problema'], answer: critical },
  { keys: ['compar', 'otras zonas', 'ranking', 'rural', 'urbana', 'peores'], answer: compare },
  { keys: ['modelo', 'predic', 'prediccion', 'precision', 'exactitud', 'algoritmo', 'ia'], answer: modelAnswer },
  { keys: ['educacion', 'escolar', 'analfabet', 'estudi'], answer: (zone) => byDimension(zone, 'Educacion') },
  { keys: ['salud', 'aseguramiento', 'eps'], answer: (zone) => byDimension(zone, 'Salud') },
  { keys: ['trabajo', 'empleo', 'laboral', 'pension', 'informal'], answer: (zone) => byDimension(zone, 'Trabajo') },
  { keys: ['vivienda', 'agua', 'acueducto', 'alcantarill', 'hacinam', 'piso', 'pared', 'servicio'], answer: (zone) => byDimension(zone, 'Vivienda') }
];

function reply(zone, question) {
  const text = withoutAccents(question);
  const rule = RULES.find((item) => item.keys.some((key) => text.includes(key)));
  return rule ? rule.answer(zone) : overview(zone);
}

export const SUGGESTIONS = [
  '¿Cuál es el principal problema de esta zona?',
  '¿Qué intervenciones recomiendas?',
  '¿Cómo se compara con las demás zonas?',
  '¿Qué dice el modelo sobre esta zona?'
];

export function greet(zone) {
  if (messagesOf(zone.zona_id).length) return;
  push(zone.zona_id, 'assistant', overview(zone));
}

export function ask(zone, question) {
  push(zone.zona_id, 'user', question);
  push(zone.zona_id, 'assistant', reply(zone, question));
}

export function getMessages(zoneId) {
  return messagesOf(zoneId);
}

// Borra toda la conversacion en memoria. Se usa al cerrar sesion: el historial
// contiene cifras de las zonas consultadas.
export function resetChat() {
  history.clear();
}
