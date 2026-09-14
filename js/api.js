/**
 * SocialData — Capa de acceso a datos
 * ------------------------------------------------------------------
 * Toda la interfaz pide sus datos a través de este módulo, nunca de forma
 * directa. En esta versión del prototipo las respuestas salen del corte
 * incluido en js/datos.js, de modo que la interfaz funcione de manera
 * autónoma.
 *
 * Para conectarla a la API del proyecto basta con cambiar el cuerpo de las
 * funciones de este archivo por llamadas fetch al backend, sin tocar ningún
 * otro módulo: las firmas y la forma de las respuestas son las mismas.
 *
 *   Ejemplo de la versión conectada:
 *     obtenerZonas() { return solicitar('/indicadores/zonas'); }
 */

const SocialDataAPI = (() => {

  // Simula la latencia de una petición para que la interfaz se comporte
  // igual que cuando consulte el servidor (estados de carga, encadenados).
  const responder = (valor, ms = 90) =>
    new Promise((resolve) => setTimeout(() => resolve(valor), ms));

  const detalleDe = (zonaId) => DATOS.detalle[String(zonaId)];

  return {
    obtenerResumen()  { return responder(DATOS.resumen); },
    obtenerCatalogo() { return responder(DATOS.catalogo); },
    obtenerZonas()    { return responder({ zonas: DATOS.zonas }); },

    obtenerZona(zonaId) {
      return responder(DATOS.zonas.find((z) => z.zona_id === Number(zonaId)));
    },

    obtenerPrivaciones(zonaId) { return responder(detalleDe(zonaId).privaciones); },
    obtenerPrediccion(zonaId)  { return responder(detalleDe(zonaId).prediccion); },
    obtenerExplicacion(zonaId) { return responder(detalleDe(zonaId).explicacion); },

    obtenerFichaModelo() { return responder(DATOS.modelo); }
  };
})();
