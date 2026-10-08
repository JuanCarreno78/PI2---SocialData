# SocialData — Frontend

Interfaz de consulta de indicadores de vulnerabilidad socioeconómica del Área
Metropolitana de Bucaramanga: Bucaramanga, Floridablanca, Girón y Piedecuesta.

Sitio estático organizado como los laboratorios de Diseño Web: `index.html`,
`css/styles.css` y módulos ES en `js/`. No necesita build ni contenedor, y no
enlaza hojas de estilo ni scripts de terceros por CDN.

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
demostración, que funciona también desde GitHub Pages.

- **Con backend:** `admin@socialdata.co` y `analista@socialdata.co`, con las
  contraseñas que se asignaron en esa instalación (ver «Usuarios» en el README
  principal). Ninguna está en el repositorio.
- **Modo de demostración** (sin backend): los mismos correos con la contraseña
  `SocialData2026*`. Solo abre la interfaz con los datos públicos dentro del
  navegador; el backend no la acepta.

Ver [Autenticación y control de acceso](#autenticación-y-control-de-acceso) para
lo que protege y lo que no protege cada modo.

Tras publicar cambios conviene forzar la recarga con **Ctrl+Shift+R**. GitHub
Pages sirve los archivos con unos diez minutos de caché, y la publicación tarda
además uno o dos minutos en propagarse.

## Estructura

```
frontend/
|--- index.html               estructura de la página
|--- css/styles.css           estilos de la aplicación
|--- js/
|    |--- theme.js            aplica el modo oscuro antes de pintar
|    |--- model.js            datos y sesión (no usa document)
|    |--- map.js              mapa con Leaflet
|    |--- view.js             pinta el DOM (no consulta el modelo)
|    |--- chat.js             conversación por zona
|    |--- app.js              controlador: eventos y estado
|--- api/data.json            corte real de los indicadores
|--- vendor/leaflet/          Leaflet 1.9.4, descargado en el repositorio
```

Como en los labs, `index.html` carga `js/app.js` con `<script type="module">` y
cada archivo importa lo que usa (`import { ... } from './model.js'`). El
controlador (`app.js`) es el único que conoce a todos los demás. Los módulos ES
no funcionan desde `file://`: hace falta Live Server o el servidor de arriba.

| Módulo | Rol |
|---|---|
| `model.js` | Datos y sesión. No usa `document`. |
| `map.js` | Mapa con Leaflet. |
| `view.js` | Pinta el DOM. No consulta el modelo. |
| `chat.js` | Conversación por zona. Con backend la redacta la IA generativa; sin él, plantillas sobre las cifras. |
| `app.js` | Cablea eventos, guarda el estado y reparte el trabajo. |

**Versión de los archivos.** Los enlaces a CSS y JS llevan `?v=AAAAMMDD` y un
`<script type="importmap">` en `index.html` aplica la misma versión a los
`import`. Así el navegador nunca combina un `index.html` nuevo con archivos
viejos guardados en caché (GitHub Pages guarda diez minutos). Al publicar
cambios, sube ese número en `index.html`.

La aplicación también tolera la ausencia de recursos. Si `leaflet.js` no llega a
cargar, el mapa muestra un aviso y el resto de la aplicación funciona. Si
`api/data.json` no está disponible, la interfaz lo indica en lugar de quedar en
blanco. El formulario de acceso se habilita siempre, con independencia de esos
recursos.

## Qué se puede hacer

- **Iniciar y cerrar sesión** con correo y contraseña; la cabecera muestra el
  nombre del usuario y su rol.
- **Analizar el área metropolitana completa** sin elegir ninguna zona: es la
  vista al entrar. Ver [Área metropolitana](#área-metropolitana).
- **Elegir una zona** en el selector **Analizar** o con un clic en el mapa,
  coloreado según el porcentaje de hogares en el grupo A del Sisbén, y
  **ampliarlo** a un tamaño de trabajo.
- **Cambiar a modo oscuro** con el botón de la luna. Por defecto la página es clara.
- **Consultar las cuatro dimensiones** y sus quince indicadores, desplegando cada
  dimensión en su sitio, con la prevalencia de cada indicador en la zona
  seleccionada.
- **Revisar la ficha técnica** de cada zona: distribución por grupo, estimación
  del modelo y factores que más pesan en esa estimación.
- **Conversar con el asistente de IA** sobre la zona: pedirle sus conclusiones o
  recomendaciones, o hacerle preguntas propias. Ver [Asistente](#asistente).
- **Exportar el reporte de la zona o del área** en Excel (.xlsx) o PDF. El PDF
  incluye un resumen del chat redactado por la IA. Ambos roles.
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

### Elegir qué analizar

Tres formas, que se mantienen sincronizadas:

- **Selector «Analizar»**, sobre el mapa: «Toda el área metropolitana» y las
  ocho zonas agrupadas por municipio. Es la forma más directa.
- **Clic en el mapa.** Al pasar el puntero, un globo dice qué zona es, su cifra
  y «Clic para analizar»; el clic la analiza de inmediato. Ya no se abren
  globos con datos que haya que cerrar a mano.
- **Ruta de la cabecera.** «Área Metropolitana» vuelve al área completa.

### Mapa ampliable

El botón **Ampliar** de la barra del mapa lleva el mapa a un tamaño de trabajo
y el mismo botón, rotulado entonces **Reducir**, lo devuelve a la barra lateral.
También lo reducen la ✕ del panel y la tecla Escape, y **se cierra solo al
elegir una zona**: el mapa pequeño acerca entonces la zona elegida.

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

### Área metropolitana

Sin zona seleccionada se analiza el área completa, y es la vista al entrar. Para
el chat, las métricas, la ficha técnica y el reporte es una zona más, con
`zona_id` 0 (`Model.getArea()`):

- **Cifras.** El porcentaje por grupo sale de los conteos del resumen; los
  indicadores, las privaciones y la estimación del modelo son el promedio de las
  ocho zonas ponderado por hogares, que es exactamente el promedio sobre todos
  los hogares. Como el resto de la plataforma, es la muestra del Sisbén sin
  ponderar por población (ver `docs/revision-backend-2026-09.md`, decisión A).
- **Factores del modelo.** No hay: SHAP explica hogares de una zona. La ficha y
  el asistente lo dicen y remiten a elegir una zona.
- **Asistente.** El chat envía `zona_id: null` y las conclusiones van a
  `POST /ia/interpretar/area/flujo`. El backend arma el perfil de las ocho zonas
  juntas, y el asistente recibe hechos ya calculados: qué zona tiene más y menos
  pobreza extrema y cómo se compara lo rural con lo urbano en cada municipio.

### Logotipo y modo oscuro

- **Logotipo.** Un marcador de ubicación con tres barras crecientes: el
  territorio y sus datos. Está en la cabecera, el acceso, el avatar del
  asistente y el icono de la pestaña.
- **Modo oscuro.** El botón de la luna, en la cabecera y en el acceso, cambia
  el tema; el del sol vuelve al claro. **Por defecto es claro**, aunque el
  sistema operativo esté en oscuro. La elección se guarda en el navegador
  (`localStorage`, clave `sd.theme`) y se aplica en el `<head>` antes de pintar,
  para que no parpadee. El mapa cambia a la cartografía gris oscuro de Esri, y
  el reporte se imprime siempre en claro.

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

Solo para el modo de demostración (sin backend):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@socialdata.co` | `SocialData2026*` |
| Analista | `analista@socialdata.co` | `SocialData2026*` |

La contraseña **no está escrita en el código**. `index.html` solo guarda su
derivación PBKDF2-SHA256 (150 000 iteraciones), con una sal aleatoria distinta
por usuario, y la comprobación se hace con la Web Crypto API del navegador.

El backend **ya no la acepta**: desde la revisión de seguridad de octubre de
2026, `db/init/02_seed.sql` crea los usuarios sin contraseña válida y cada
instalación asigna las suyas (`python -m app.gestion_usuarios`). Antes eran la
misma, publicada aquí, y cualquiera podía entrar como administrador a un backend
expuesto.

### Dos modos de sesión

| Modo | Cuándo | Contra qué se valida |
|---|---|---|
| **Backend** | El backend responde en la dirección de `config.js` | `POST /api/v1/auth/login`: JWT HS256, `bcrypt`, bloqueo y bitácora de auditoría del servidor |
| **Demostración** | El backend no responde (por ejemplo, con el túnel cerrado) | Los usuarios de demostración, en el navegador |

Solo la **falta de respuesta** del backend hace pasar al modo de demostración.
Si el backend responde con un rechazo (401, 403, 429) o con un error propio, se
respeta tal cual: no se «reintenta en local» para esquivarlo.

**Con el túnel de ngrok.** La dirección del backend la fija `config.js`: en el
proxy de `socialdata-ngrok` es `/api/v1` (mismo origen), y en GitHub Pages es
el túnel (`https://reviver-dangling-refinery.ngrok-free.dev/api/v1`). Con el
túnel abierto, GitHub Pages usa el backend real del portátil; con el túnel
cerrado, el navegador no recibe respuesta y la página pasa al modo de
demostración. Cada petición lleva la cabecera `ngrok-skip-browser-warning`, para
que el plan gratuito de ngrok no responda su página de aviso en lugar del JSON.

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
| `API_URL` | de `config.js` (`/api/v1` o el túnel) | Base de las peticiones a la API. |
| `BACKEND_ENABLED` | `true` | Siempre se intenta el backend; sin respuesta, modo de demostración. |
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

## Mi perfil (todos los roles)

Se abre pulsando el nombre del usuario en la cabecera. Es un panel sobre el área
del asistente, con el mismo patrón que la ficha técnica y la administración (son
excluyentes y se cierran con su ✕ o con Escape).

| Sección | Qué permite |
|---|---|
| **Cuenta** | Ver nombre, correo, rol, fecha de alta y cuándo se cambió la contraseña. |
| **Nombre** | El **administrador** lo cambia directamente. El **analista** envía una **solicitud** que un administrador aprueba o rechaza (con motivo opcional); mientras está pendiente la puede cancelar, y se muestra el resultado de la última durante 14 días. |
| **Contraseña** | Pide la actual; la nueva debe tener al menos 12 caracteres y no puede ser una conocida ni contener el correo. **Al cambiarla se cierran las demás sesiones abiertas**; la actual sigue. |
| **Preferencias** | Modo claro u oscuro (se guarda en el navegador). |

El correo no se cambia desde el perfil: es el identificador para entrar.

El administrador ve las **solicitudes de cambio de nombre** al principio de su
panel, y un contador sobre el botón **Administración** cuando hay pendientes.

En el modo de demostración (sin backend) el perfil es de solo lectura: no hay
dónde guardar una solicitud que apruebe otra persona ni una contraseña nueva.

Cómo se cierran las demás sesiones: cada token lleva la «versión de sesión» del
usuario (claim `ver`). Cambiar la contraseña sube esa versión en la base de datos,
y el backend rechaza los tokens anteriores con «La sesión fue cerrada». La sesión
actual recibe un token nuevo.

La contraseña nueva se guarda **solo en la base de datos** (como hash bcrypt): el
`.env` no interviene en el inicio de sesión.

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
- **Eliminar** un usuario. Solo se ofrece cuando ya está desactivado, así que
  borrar es siempre un segundo paso, y pide confirmación porque no se puede
  deshacer. Nadie puede eliminarse a sí mismo. En el backend se borran también
  sus escenarios y conversaciones (solo los veía él); la bitácora de auditoría se
  conserva, con el id del usuario en `detalle.usuario_eliminado`. Después, su
  correo queda libre para crear otro usuario.

| Modo | Dónde se guardan los cambios |
|---|---|
| Backend | `GET` y `POST /auth/usuarios`, `PATCH /auth/usuarios/{id}/estado` y `DELETE /auth/usuarios/{id}`, protegidos por `solo_administrador` |
| Demostración | `localStorage` de este navegador. No afectan a otros equipos. Para volver a los dos usuarios iniciales, borra los datos del sitio en el navegador. |

Los nombres y correos los escribe una persona, así que se tratan como datos no
confiables: en pantalla siempre pasan por `escapeHtml` o `textContent`. En el
Excel van como celdas de texto (`inlineStr`), que Excel nunca evalúa, así que un
nombre como `=HYPERLINK(...)` se ve tal cual y no se ejecuta como fórmula.

La ruta del modo backend se probó en el navegador contra
`pruebas/backend_de_prueba.py` (listar, crear, duplicado con el 409 del backend,
desactivar, reactivar y eliminar, con los rechazos 400, 404 y 409 de
eliminar). Esa prueba destapó un fallo: `GET /auth/usuarios`
devuelve `{"usuarios": [...]}` y la interfaz lo trataba como una lista. Falta
repetirla contra PostgreSQL.

## Exportar reporte de la zona (ambos roles)

Implementa **HU-12 «Exportación de reportes»**, que pide un reporte con periodo,
zona e índices de privación, descargable en PDF y en Excel. El botón **Exportar
reporte** de la cabecera del asistente está disponible para los dos roles, para
una zona o para el área metropolitana completa.

| Formato | Cómo se genera |
|---|---|
| **Excel (.xlsx)** | Se descarga directamente. Es un libro de Excel real, generado en el navegador sin librerías (un ZIP con las hojas en XML). Las cifras van como números con formato (`60,9 %`, `1.807`, `+0,364`), no como texto, así que se pueden ordenar y operar. Se eligió en lugar de CSV porque un CSV depende de la configuración regional: en un equipo con coma como separador de listas salía todo en una columna y parecía corrupto. |
| **PDF** | Abre el diálogo de impresión con un reporte maquetado para A4; se elige «Guardar como PDF». No usa librerías externas. Si hubo conversación, primero pide a la IA el resumen (el botón dice «Preparando resumen…», unos 20 s). |

Contenido: zona, municipio, hogares y personas; fuente y periodo del corte;
quién lo exporta (nombre y rol) y cuándo; distribución por grupo del Sisbén,
observada y estimada por el modelo; prevalencia de las quince privaciones; y los
factores del modelo con su contribución SHAP.

El PDF añade **«Resumen de la conversación con el asistente»**: un texto corrido
de uno o dos párrafos (100 a 200 palabras) que cuenta, en orden, qué se consultó,
qué analizó el asistente y a qué conclusiones o recomendaciones llegó. Lo redacta
la misma IA del chat (`POST /ia/resumir`). Una primera versión en viñetas se
cambió porque se leía como notas sueltas y no como parte de un informe. El asistente solo
recibe la conversación, sin las cifras de la zona, así que no puede agregar
datos que no se hayan dicho. Sin conversación no hay sección; sin IA (Ollama
apagado, o la versión de GitHub Pages), la sección lista las preguntas que se
hicieron.

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

Probado en el navegador contra el backend completo en Docker (PostgreSQL,
`ia-predictor`, `ia-asistente` y Ollama con qwen3:8b), y antes contra
`pruebas/backend_de_prueba.py`, que no tiene las rutas del asistente: con él, el
chat responde con plantillas.

## Asistente

Con sesión del backend, el chat de cada zona lo redacta la IA generativa
(`ia-asistente` con qwen3:8b en Ollama). Sin backend, como en GitHub Pages,
responde al instante con plantillas sobre las mismas cifras.

| Acción | Ruta del backend |
|---|---|
| «Dame tus conclusiones sobre esta zona» | `POST /ia/interpretar/{id}/flujo?tipo=interpretar` (para el área: `/ia/interpretar/area/flujo`) |
| «¿Qué intervenciones recomiendas?» | `POST /ia/interpretar/{id}/flujo?tipo=recomendar` (ídem) |
| Cualquier otra pregunta, escrita o sugerida | `POST /ia/chat/flujo` con `pregunta`, `zona_id` (`null` para el área) e `historial` |
| Resumen para el PDF | `POST /ia/resumir` con `zona_id` e `historial` |

Las dos primeras sugerencias, con fondo verde claro, piden un análisis completo;
las demás son preguntas libres.

**En flujo.** El modelo escribe a unos 8 tokens/s en el equipo del proyecto, así
que la respuesta llega a medida que se escribe: NDJSON con un evento `meta`
(motor, fuentes y advertencia), varios `texto` y un `fin` o `error`.
`requestStream()` del modelo lo lee con `fetch` y un lector del cuerpo, y la
vista actualiza solo el último mensaje. Mientras no llega texto, el globo muestra
«Analizando la zona…» con los segundos; mientras se escribe, un cursor.

**Una respuesta a la vez.** El campo, el botón y las sugerencias se deshabilitan
hasta que termina, porque Ollama atiende las peticiones en fila. Si se cambia de
zona, la respuesta sigue llegando a la conversación de su zona.

**Memoria.** Con cada pregunta se envían los últimos mensajes como
`{rol, contenido}`, que es lo que lee `ia-asistente`; usa los cuatro últimos
para entender a qué se refiere la pregunta.

**Texto del modelo.** Escribe negritas y viñetas de markdown. `formatAnswer()`
escapa el HTML primero y luego convierte solo `**…**`, `### ` y las viñetas: el
texto del modelo nunca entra como HTML crudo. Debajo de cada respuesta,
«Generado con IA · qwen3:8b · N fuentes» despliega las fuentes y la advertencia
de que es apoyo a la decisión.

**Si la IA no responde** (Ollama apagado, `ia-asistente` caído o modo
plantilla), la pregunta se contesta con las plantillas y un aviso: «La IA
generativa no respondió, así que esta respuesta se armó con las cifras de la
zona». Si la respuesta se corta a medias, se conserva lo escrito y se avisa.

---

Equipo 2 · Proyecto Integrador II · Facultad de Ingeniería de Sistemas e Informática
Universidad Pontificia Bolivariana — Seccional Bucaramanga · 2026
