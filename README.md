# SocialData — Prototipo web

Interfaz de consulta de indicadores de vulnerabilidad socioeconómica del Área
Metropolitana de Bucaramanga: Bucaramanga, Floridablanca, Girón y Piedecuesta.

Primer prototipo funcional del Sprint 3.

## Cómo verlo

No requiere instalación ni servidor. Basta con abrir `index.html` en el navegador,
o publicarlo con GitHub Pages.

Para servirlo en local:

```
python -m http.server 8080
```

y abrir `http://localhost:8080`.

## Qué se puede hacer

- **Explorar las ocho zonas** del área metropolitana en el mapa o en la lista,
  coloreadas según el porcentaje de hogares en el grupo A del Sisbén.
- **Consultar las cuatro dimensiones** y sus quince indicadores, con la prevalencia
  de cada uno en la zona seleccionada.
- **Revisar la ficha técnica** de cada zona: distribución por grupo, estimación del
  modelo y factores que más pesan en esa estimación.
- **Preguntar al asistente** sobre la zona, con preguntas propias o con las
  sugerencias que aparecen bajo la conversación.

## Estructura

```
index.html          Estructura de la página
css/styles.css      Estilos
js/datos.js         Corte de los indicadores del área metropolitana
js/api.js           Capa de acceso a datos
js/map.js           Mapa (Leaflet)
vendor/leaflet/     Librería Leaflet 1.9.4 incluida en el propio repositorio
js/ui.js            Renderizado de los paneles
js/chat.js          Asistente analítico
js/app.js           Orquestación y estado
```

Sin dependencias externas. Leaflet viaja dentro del repositorio (`vendor/`) y el
mapa no carga cartografía base de ningún proveedor: se dibuja sobre un lienzo
neutro con las geometrías del propio proyecto. El motivo es que los servidores de
teselas de OpenStreetMap rechazan las aplicaciones no registradas en su política
de uso y los CDN comerciales equivalentes exigen una clave de API; el prototipo
debe poder abrirse y calificarse sin depender de servicios de terceros.

## Sobre los datos

Las cifras provienen de la muestra anonimizada del **Sisbén IV** del Departamento
Nacional de Planeación (corte de marzo de 2022, licencia CC BY-SA 4.0), filtrada a
los cuatro municipios: **10.288 hogares y 28.656 personas**. Conjuntos `hq2v-5umk`
(personas), `ab8a-uwf7` (hogares) y `np8m-kdhq` (vivienda).

Tres precisiones:

- **La unidad mínima es la zona, no la comuna.** El Sisbén publica hasta municipio y
  zona (cabecera urbana / centro poblado y rural disperso), de donde salen las ocho
  zonas de análisis.
- **El Sisbén no es el IPM.** El IPM mide acumulación de privaciones; el Sisbén IV
  clasifica hogares por su capacidad de generar ingresos. Los quince indicadores que
  muestra la interfaz son privaciones publicadas por el DNP dentro del Sisbén.
- **La zona rural es esquemática en el mapa.** El círculo marca la cabecera urbana en
  sus coordenadas reales y el anillo punteado representa el territorio circundante,
  porque el Sisbén no publica geometrías por zona.

## Estado de esta versión

Esta entrega cubre la interfaz. Los datos están incluidos en `js/datos.js` para que
el prototipo funcione de forma autónoma, y las respuestas del asistente se componen
con plantillas sobre esas mismas cifras.

Pendiente para las siguientes iteraciones:

- Conectar `js/api.js` a la API del proyecto. Las funciones ya tienen la firma y la
  forma de respuesta definitivas, de modo que solo cambia el cuerpo de cada una.
- Inicio de sesión con control de acceso por rol.
- Sustituir las respuestas del asistente por el microservicio de IA generativa.

---

Equipo 2 · Proyecto Integrador II · Facultad de Ingeniería de Sistemas e Informática
Universidad Pontificia Bolivariana — Seccional Bucaramanga · 2026
