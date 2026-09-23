# SocialData — Frontend

Interfaz de consulta de indicadores de vulnerabilidad socioeconómica del Área
Metropolitana de Bucaramanga: Bucaramanga, Floridablanca, Girón y Piedecuesta.

Sitio estático autocontenido: toda la interfaz (estructura, estilos y lógica)
está en `index.html`. No necesita build ni contenedor, y no enlaza hojas de
estilo ni scripts de terceros por CDN.

## Cómo verlo

Necesita un servidor local: el navegador no permite leer `api/data.json` con
`fetch` desde `file://`, así que **no basta con hacer doble clic en
`index.html`**.

Con la extensión Live Server de VS Code: clic derecho sobre `index.html` → *Open
with Live Server*. O desde la raíz del proyecto:

```bash
python -m http.server 5173 --directory frontend
```

y abrir `http://localhost:5173`.

La aplicación exige iniciar sesión. Si el backend está en ejecución
(`http://localhost:8000/api/v1`) se valida contra él; si no, se usa el modo de
demostración, que funciona también desde GitHub Pages. Usuarios:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@socialdata.co` | `SocialData2026*` |
| Analista | `analista@socialdata.co` | `SocialData2026*` |

Ver [Autenticación y control de acceso](#autenticación-y-control-de-acceso) para
lo que protege y lo que no protege cada modo.

Tras publicar cambios conviene forzar la recarga con **Ctrl+Shift+R**. GitHub
Pages sirve los archivos con unos diez minutos de caché, y la publicación tarda
además uno o dos minutos en propagarse.

## Estructura

```
frontend/
|--- index.html               interfaz completa: HTML, <style> y <script>
|--- api/
     |--- data.json          corte real de los indicadores
|--- vendor/leaflet/         Leaflet 1.9.4, descargado en el repositorio
```

`index.html` es el único archivo propio de la interfaz. Contiene un bloque
`<style>` con los estilos de la aplicación y los de Leaflet, y un único
`<script>` clásico con toda la lógica. Del exterior del documento solo carga dos
recursos locales: `vendor/leaflet/leaflet.js` y `api/data.json`. La cartografía
base (teselas de Esri u OpenStreetMap) es el único contenido que se descarga en
línea.

Esta disposición responde a un problema observado en la publicación: con los
estilos y los scripts en archivos separados, el navegador llegó a combinar un
`index.html` nuevo con hojas de estilo y scripts antiguos conservados en caché,
y la pantalla de acceso se mostraba sin estilos y sin respuesta. Con todo
dentro del mismo documento, cada carga es coherente consigo misma.

### Organización del script

El script mantiene la separación por rol de los laboratorios de Diseño Web. Cada
capa es un módulo en cierre (`const Nombre = (() => { … })()`) que solo expone
su interfaz pública:

| Módulo | Rol |
|---|---|
| `Model` | Datos y sesión. No usa `document`. |
| `MapView` | Mapa con Leaflet. |
| `View` | Pinta el DOM. No consulta el modelo. |
| `Chat` | Asistente por reglas. |
| Controlador (último bloque) | Cablea eventos, guarda el estado y reparte el trabajo. Es el único que conoce a todos los demás. |

El script también tolera la ausencia de recursos. Si `leaflet.js` no llega a
cargar, el mapa muestra un aviso y el resto de la aplicación funciona. Si
`api/data.json` no está disponible, la interfaz lo indica en lugar de quedar en
blanco. El formulario de acceso se habilita siempre, con independencia de esos
recursos.

## Qué se puede hacer

- **Iniciar y cerrar sesión** con correo y contraseña; la cabecera muestra el
  nombre del usuario y su rol.
- **Explorar las ocho zonas** en el mapa, coloreadas según el porcentaje de
  hogares en el grupo A del Sisbén, y **ampliarlo** a un tamaño de trabajo.
- **Consultar las cuatro dimensiones** y sus quince indicadores, desplegando cada
  dimensión en su sitio, con la prevalencia de cada indicador en la zona
  seleccionada.
- **Revisar la ficha técnica** de cada zona: distribución por grupo, estimación
  del modelo y factores que más pesan en esa estimación.
- **Preguntar al asistente** sobre la zona, con preguntas propias o con las
  sugerencias que aparecen bajo la conversación.
- **Exportar el reporte de la zona** en Excel (.xlsx) o PDF. Ambos roles.
- **Administrar usuarios**: crear, desactivar y reactivar. Solo el
  administrador.

## Organización de la interfaz

- **Pantalla de acceso.** Cubre toda la ventana mientras no hay sesión. El resto
  de la interfaz permanece oculto y sin montar: ni el mapa ni los datos se
  cargan hasta que el usuario se autentica.
- **Barra lateral.** Mapa compacto arriba, métricas debajo y, plegadas en
  acordeones, las dimensiones e indicadores. Cada sección se abre y se cierra
  con el mismo botón de su encabezado, y al abrirse sube al principio de la
  columna.
- **Área principal.** El asistente conversacional.
- **Ficha técnica.** Panel deslizante sobre la conversación, sin sustituirla.
  El mismo botón que la abre la cierra, igual que la ✕ o la tecla Escape.
- **Mapa ampliado.** Panel sobre la conversación, con el mismo patrón que la
  ficha técnica.
- **Administración.** Panel sobre la conversación, solo para el administrador.
  Ficha, mapa ampliado y administración son excluyentes: abrir uno cierra los
  otros.
- **Cabecera.** A la derecha, el usuario con su rol, el botón de administración
  si corresponde y **Cerrar sesión**. En escritorio la cabecera no se parte en
  dos filas: si no cabe, el lema y la ruta se recortan con puntos suspensivos y
  el texto completo queda en el `title`.

### Mapa ampliable

El botón **Ampliar** de la barra del mapa lleva el mapa a un tamaño de trabajo
y el mismo botón, rotulado entonces **Reducir**, lo devuelve a la barra lateral.
También lo reducen la ✕ del panel y la tecla Escape.

El comportamiento depende del ancho de la ventana:

| Ancho | Qué hace «Ampliar» |
|---|---|
| Más de 1080 px | Mueve el nodo del mapa a un panel que cubre el área del asistente, anclado a `.chat-area`. En la barra lateral queda un aviso en su lugar. |
| 1080 px o menos | Amplía el mapa en su sitio (`.map-canvas.is-large`, entre 380 y 620 px de alto), porque en esta maqueta el asistente queda debajo de la barra y el panel no estaría a la vista. |

Si la ventana cruza el punto de corte con el mapa ampliado, el mapa vuelve a su
tamaño normal para no quedar en un modo que ya no corresponde a la maqueta.

La función `setLargeMode(on)` del módulo `MapView` concentra lo que Leaflet necesita
en cada cambio de tamaño:

- **`invalidateSize()` y reencuadre.** Se invoca de forma explícita tras mover
  o redimensionar el contenedor, y se repite en el fotograma siguiente, porque
  el `ResizeObserver` de `initMap()` no detecta el traslado de un nodo entre
  contenedores cuando el tamaño final no cambia. Después se reencuadra el área
  metropolitana con `fitBounds`, sin franjas grises ni teselas a medio cargar.
- **Rueda del ratón.** El mapa se crea con `scrollWheelZoom: false` para no
  capturar la rueda dentro de una barra lateral desplazable. Al ampliarlo se
  activa y al reducirlo se vuelve a desactivar.
- **Rótulos.** En el recuadro compacto solo el rótulo de la zona seleccionada es
  fijo, porque los cuatro se solapan entre sí y con los topónimos de la
  cartografía. Con el mapa ampliado los cuatro quedan fijos, y el acercamiento a
  una zona sube un nivel de zoom.

El cambio de tamaño no altera el estado de la aplicación: la zona seleccionada,
las dimensiones abiertas y la conversación se conservan.

### Dimensiones e indicadores

Cada dimensión se comporta como un desplegable. Al pulsarla, sus indicadores se
abren justo debajo y empujan hacia abajo las dimensiones siguientes, como una
lista anidada; al pulsarla de nuevo se cierra.

```
.dimension-item
  └── button.dimension-card   (aria-expanded, aria-controls)
  └── div.dimension-panel     (hidden cuando está cerrada)
        └── .indicator-row × n
```

Decisiones de implementación:

- **Varias dimensiones abiertas a la vez.** Los desplegables son independientes
  y el botón superior pasa a ser **Contraer todas las dimensiones**, que queda
  deshabilitado cuando no hay ninguna abierta. La capa activa del mapa toma el
  nombre de la última dimensión abierta.
- **Un clic, una conmutación.** Las tarjetas usan la clase `.dimension-card` con
  su propio manejador y no `.accordion-button`; el manejador delegado de los
  acordeones, además, las excluye de forma explícita.
- **Conmutación en sitio.** Abrir o cerrar una dimensión no vuelve a pintar la
  lista, de modo que el foco del teclado permanece en la tarjeta pulsada. No se
  usa `revealSection()`: la vista solo se ajusta lo imprescindible con
  `scrollIntoView({ block: 'nearest' })`.
- **Prevalencia según la zona.** Con una zona seleccionada cada indicador
  muestra su porcentaje; sin zona muestra `—`. Un aviso bajo el título del
  acordeón indica en cada momento a qué zona corresponden las cifras.

La barra lateral conserva `overflow-y: auto` y la regla `.sidebar > * { flex: 0
0 auto }`, de modo que con varias dimensiones abiertas sigue habiendo
desplazamiento y ningún bloque aparece recortado.

## Autenticación y control de acceso

El frontend implementa **RF-01 «Iniciar sesión»**, caso de uso base incluido por
los demás, y el componente de autenticación de **RNF-02 «Seguridad y protección
de datos personales»** (Ley 1581 de 2012). Corresponde a la historia de usuario
**HU-07** y sigue los diagramas de actividades y de secuencia de inicio de
sesión entregados en los UML Parte 2 del Sprint 3.

### Usuarios de demostración

Los mismos de `db/init/02_seed.sql`:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@socialdata.co` | `SocialData2026*` |
| Analista | `analista@socialdata.co` | `SocialData2026*` |

La contraseña **no está escrita en el código**. `index.html` solo guarda su
derivación PBKDF2-SHA256 (150 000 iteraciones), con una sal aleatoria distinta
por usuario, y la comprobación se hace con la Web Crypto API del navegador.
Cambiar estas credenciales antes de cualquier uso real.

### Dos modos de sesión

| Modo | Cuándo | Contra qué se valida |
|---|---|---|
| **Backend** | La página se sirve desde `localhost` o `127.0.0.1` y el backend responde | `POST /api/v1/auth/login`: JWT HS256 de 480 min, `bcrypt`, bloqueo y bitácora de auditoría del servidor |
| **Demostración** | El backend no responde, o la página se sirve desde otro dominio (GitHub Pages) | Los usuarios de demostración, en el navegador |

Solo la **falta de respuesta** del backend hace pasar al modo de demostración.
Si el backend responde con un rechazo (401, 403, 429) o con un error propio, se
respeta tal cual: no se «reintenta en local» para esquivarlo.

Desde GitHub Pages el backend ni se intenta. No está publicado, y una página
pública que llama a `http://localhost` hace que el navegador pida al visitante
permiso para acceder a su red local, algo que no debe ver quien evalúa el
prototipo.

La interfaz no distingue los dos modos: es el mismo producto con o sin backend.
Para saber en cuál se está, `sessionStorage` guarda la sesión con `mode: 'api'` o
`mode: 'local'`.

### Qué protege cada modo, sin exagerar

**El modo de demostración no es un control de acceso.** Es una demostración de la
interfaz y del flujo de RF-01. Todo lo que ocurre en un navegador lo controla
quien lo usa: puede leer el código, modificar la sesión guardada o pedir
`api/data.json` directamente por URL. Sirve para que el prototipo publicado sea
navegable y para evaluar el comportamiento, no para proteger datos.

La protección real de RNF-02 la da el backend. Con una sesión del backend,
`loadData()` pide los indicadores a la API mediante `request()`, y el servidor
valida el token en cada consulta. `api/data.json` sigue publicado solo porque lo
necesita el modo de demostración.

Aun así, el modo de demostración reproduce las reglas del backend para que se
comporte igual:

- Mismo orden de comprobaciones que `autenticar()`: usuario inexistente,
  desactivado, bloqueado y, al final, contraseña.
- **Cinco intentos fallidos bloquean el usuario 15 minutos**, como
  `MAX_INTENTOS` y `BLOQUEO_MINUTOS` en `backend/app/core/config.py`.
- Sesión de 480 minutos, como `JWT_MINUTOS`.

### Medidas de seguridad en el cliente

- **La contraseña no se conserva.** Solo existe como argumento de `login()`. El
  campo del formulario se vacía en cada intento, con éxito o sin él, y vuelve a
  ocultarse si se había mostrado. No se guarda en ningún almacenamiento del
  navegador.
- **Mensaje genérico.** Ante credenciales inválidas la interfaz no distingue si
  falló el correo o la contraseña (flujo alternativo 1 de RF-01).
- **Mismo tiempo de respuesta exista o no el correo.** Con un correo no
  registrado también se deriva la clave. Sin esto, la respuesta llegaba en un
  tercio del tiempo y delataba qué correos existen, lo que anulaba el mensaje
  genérico. Medido: ~80 ms en ambos casos.
- **Sesión en `sessionStorage`.** Desaparece al cerrar la pestaña. No se usa
  `localStorage`, que persiste indefinidamente.
- **El token nunca viaja en la URL.** Las peticiones autenticadas pasan por
  `request()`, que lo añade en la cabecera `Authorization: Bearer`. Ni el token
  ni la contraseña se escriben en consola.
- **Formulario inerte sin JavaScript.** Los campos no tienen atributo `name` y el
  botón arranca deshabilitado: si el script no carga, no se envía nada.
- **Nada se monta sin sesión.** Hasta autenticarse no se inicializa el mapa ni se
  pide `api/data.json`.
- **Cierre de sesión completo.** Borra la sesión y recarga con
  `location.replace`, lo que descarta todo el estado en memoria (incluida la
  conversación, que lleva cifras de zonas) y no deja la vista autenticada en el
  historial. Recargar después no vuelve a entrar.
- **Caducidad vigilada.** El controlador programa el cierre con la fecha `exp`
  de la sesión y la revisa al volver a la pestaña, porque los temporizadores se
  duermen en segundo plano.

### Mensajes

| Situación | Backend | Mensaje en la interfaz |
|---|---|---|
| Credenciales incorrectas | 401 | «Correo o contraseña incorrectos.» |
| Usuario desactivado | 403 | «Tu usuario está desactivado. Contacta al administrador.» |
| Bloqueo por intentos | 429 | «Demasiados intentos fallidos. Espera N minutos antes de volver a intentarlo.» |
| Campos vacíos | — | «Escribe tu correo y tu contraseña.» |
| Sin Web Crypto (ni HTTPS ni localhost) | — | «El inicio de sesión requiere una conexión segura (HTTPS o localhost).» |

Tras cerrar sesión o caducar, la pantalla de acceso lo indica una vez.

### Configuración

Al principio del bloque de sesión del módulo `Model`:

| Constante | Valor | Uso |
|---|---|---|
| `API_URL` | `http://localhost:8000/api/v1` | Base de las peticiones a la API. |
| `BACKEND_ENABLED` | `true` en `localhost` / `127.0.0.1` | Si se intenta el backend. |
| `BACKEND_TIMEOUT_MS` | `5000` | Espera máxima del login contra el backend. |
| `SESSION_MINUTES` | `480` | Duración de la sesión de demostración, y respaldo si el JWT no trae `exp`. |
| `MAX_ATTEMPTS` / `LOCK_MINUTES` | `5` / `15` | Bloqueo por intentos fallidos. |

El cuerpo de `POST /auth/login` usa los campos `email` y `password`, que son los
del esquema `Credenciales` del backend. Una versión anterior enviaba `correo` y
`contrasena`, que el backend rechaza con 422.

Nota para desarrollo: con la página en `localhost` y el backend apagado, cada
inicio de sesión espera a que el navegador reciba la conexión rechazada antes de
pasar al modo de demostración. En Windows eso tarda unos segundos, y la consola
muestra `ERR_CONNECTION_REFUSED`. Es el comportamiento esperado.

## Administración de usuarios (solo administrador)

Implementa **RF-09 «Gestionar usuarios y roles»** e **HU-08**. El botón
**Administración** de la cabecera solo existe para el rol administrador; el
analista no lo ve, y las funciones del modelo comprueban el rol de nuevo antes
de actuar.

Abre un panel sobre el área del asistente, con el mismo patrón que la ficha
técnica y el mapa ampliado. Los tres son excluyentes: abrir uno cierra los otros.
Se cierra con el mismo botón, con su ✕ o con Escape.

Permite:

- **Ver los usuarios** con su rol y su estado.
- **Desactivar o reactivar** un usuario. Un usuario desactivado no puede iniciar
  sesión y recibe su propio mensaje. El administrador no puede desactivarse a sí
  mismo, igual que en `cambiar_estado()` del backend.
- **Crear usuarios** con nombre, correo, contraseña inicial y rol, con las mismas
  reglas que el esquema `NuevoUsuario`: nombre de 3 a 120 caracteres, correo
  válido y único (sin distinguir mayúsculas), contraseña de al menos 8
  caracteres. La contraseña se guarda derivada con PBKDF2 y sal propia, nunca en
  claro.

| Modo | Dónde se guardan los cambios |
|---|---|
| Backend | `GET` y `POST /auth/usuarios`, `PATCH /auth/usuarios/{id}/estado`, protegidos por `solo_administrador` |
| Demostración | `localStorage` de este navegador. No afectan a otros equipos. Para volver a los dos usuarios iniciales, borra los datos del sitio en el navegador. |

Los nombres y correos los escribe una persona, así que se tratan como datos no
confiables: en pantalla siempre pasan por `escapeHtml` o `textContent`. En el
Excel van como celdas de texto (`inlineStr`), que Excel nunca evalúa, así que un
nombre como `=HYPERLINK(...)` se ve tal cual y no se ejecuta como fórmula.

La ruta del modo backend se probó en el navegador contra
`pruebas/backend_de_prueba.py` (listar, crear, duplicado con el 409 del backend,
desactivar y reactivar). Esa prueba destapó un fallo: `GET /auth/usuarios`
devuelve `{"usuarios": [...]}` y la interfaz lo trataba como una lista. Falta
repetirla contra PostgreSQL.

## Exportar reporte de la zona (ambos roles)

Implementa **HU-12 «Exportación de reportes»**, que pide un reporte con periodo,
zona e índices de privación, descargable en PDF y en Excel. El botón **Exportar
reporte** de la cabecera del asistente está disponible para los dos roles y se
deshabilita cuando no hay zona seleccionada.

| Formato | Cómo se genera |
|---|---|
| **Excel (.xlsx)** | Se descarga directamente. Es un libro de Excel real, generado en el navegador sin librerías (un ZIP con las hojas en XML). Las cifras van como números con formato (`60,9 %`, `1.807`, `+0,364`), no como texto, así que se pueden ordenar y operar. Se eligió en lugar de CSV porque un CSV depende de la configuración regional: en un equipo con coma como separador de listas salía todo en una columna y parecía corrupto. |
| **PDF** | Abre el diálogo de impresión con un reporte maquetado para A4; se elige «Guardar como PDF». No usa librerías externas. |

Contenido: zona, municipio, hogares y personas; fuente y periodo del corte;
quién lo exporta (nombre y rol) y cuándo; distribución por grupo del Sisbén,
observada y estimada por el modelo; prevalencia de las quince privaciones; y los
factores del modelo con su contribución SHAP.

Dos precisiones que el reporte deja escritas:

- Solo lleva **cifras agregadas por zona**, sin identificadores de hogar, como
  exige RNF-02.
- Los factores SHAP son los del **hogar representativo** de la zona, cuyo grupo
  puede no coincidir con el mayoritario. El título lo dice para que el reporte no
  parezca contradecirse.

El nombre del archivo lleva la zona y la fecha local:
`SocialData_Giron-Centro-poblado-y-rural-disperso_2026-09-22.xlsx`.

## Cartografía base

Se descarga en línea, con degradación en cascada y sin clave de API: primero el
lienzo gris claro de **Esri** (*World Light Gray Canvas*, desaturado a propósito
para que los círculos de color sigan siendo legibles) y, si su servidor no
responde, **OpenStreetMap**. Si ninguno contesta, el mapa vuelve a dibujarse
sobre una retícula neutra con las geometrías del proyecto, así que la página
nunca queda en blanco.

## Sobre los datos

Las cifras provienen de la muestra anonimizada del **Sisbén IV** del
Departamento Nacional de Planeación (corte de marzo de 2022, licencia
CC BY-SA 4.0), filtrada a los cuatro municipios: **10.288 hogares y 28.656
personas**. Conjuntos `hq2v-5umk` (personas), `ab8a-uwf7` (hogares) y
`np8m-kdhq` (vivienda).

Tres precisiones:

- **La unidad mínima es la zona, no la comuna.** El Sisbén publica hasta
  municipio y zona (cabecera urbana / centro poblado y rural disperso), de donde
  salen las ocho zonas de análisis.
- **El Sisbén no es el IPM.** El IPM mide acumulación de privaciones; el Sisbén
  IV clasifica hogares por su capacidad de generar ingresos. Los quince
  indicadores que muestra la interfaz son privaciones publicadas por el DNP
  dentro del Sisbén.
- **La zona rural es esquemática en el mapa.** El círculo marca la cabecera
  urbana en sus coordenadas reales y el anillo punteado representa el territorio
  circundante, porque el Sisbén no publica geometrías por zona.

## Estado

### De dónde salen los datos

| Sesión | Origen |
|---|---|
| Backend | La API: `/indicadores/resumen`, `/zonas`, `/catalogo`, `/zonas/{id}/privaciones`, y `/ia/modelo`, `/ia/prediccion/{id}`, `/ia/explicacion/{id}`. Las ocho zonas se piden en paralelo. |
| Demostración | `api/data.json`, que tiene exactamente la misma forma. |

La predicción, la explicación y la ficha del modelo dependen de `ia-predictor`.
Si no responde, la aplicación se abre igual con las cifras observadas: la ficha
muestra «Predicción no disponible», el asistente lo dice en vez de fallar y el
reporte se exporta sin esas piezas (RNF-04). Un 401 al cargar devuelve al login
con el aviso «Tu sesión expiró».

Todo esto se probó en el navegador contra `pruebas/backend_de_prueba.py`, que
usa la autenticación real del backend y el `ia-predictor` real, pero sirve los
indicadores desde `api/data.json`. Falta probarlo contra PostgreSQL.

Las respuestas del asistente se componen con plantillas sobre esas mismas cifras.

Pendiente para las siguientes iteraciones:

- Probar la carga por API y la administración contra el backend con PostgreSQL.
- Sustituir el asistente por reglas por el microservicio `ia-asistente`. Su
  `historial` espera mensajes `{"rol", "contenido"}`; el del frontend usa
  `{author, text}`, así que hay que traducirlo al enviarlo.

---

Equipo 2 · Proyecto Integrador II · Facultad de Ingeniería de Sistemas e Informática
Universidad Pontificia Bolivariana — Seccional Bucaramanga · 2026
