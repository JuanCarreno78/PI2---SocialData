# SocialData — Frontend

Interfaz de consulta de indicadores de vulnerabilidad socioeconómica del Área
Metropolitana de Bucaramanga: Bucaramanga, Floridablanca, Girón y Piedecuesta.

Sitio estático con módulos ES. No necesita build ni contenedor.

## Cómo verlo

Necesita un servidor local: los módulos ES y `fetch` no funcionan con `file://`,
así que **no basta con hacer doble clic en `index.html`**.

Con la extensión Live Server de VS Code: clic derecho sobre `index.html` → *Open
with Live Server*. O desde la raíz del proyecto:

```bash
python -m http.server 5173 --directory frontend
```

y abrir `http://localhost:5173`.

La aplicación exige iniciar sesión, por lo que el backend debe estar en
ejecución y accesible en la dirección configurada en `js/model.js` (por defecto
`http://localhost:8000/api/v1`). Los usuarios de demostración se definen en
`db/init/02_seed.sql`.

Tras modificar cualquier archivo conviene forzar la recarga con
**Ctrl+Shift+R**: el navegador tiende a conservar en caché la versión anterior
de los módulos y los cambios pueden parecer no aplicados.

## Estructura

```
frontend/
|--- index.html               pantalla de acceso + aplicación
|--- css/styles.css
|--- api/
     |--- data.json          corte real de los indicadores
|--- js/
     |--- model.js           datos y sesión, no toca el DOM
     |--- view.js            pinta el DOM, no conoce al modelo
     |--- map.js             mapa (Leaflet)
     |--- chat.js            asistente por reglas
     |--- app.js             controlador, punto de entrada
|--- vendor/leaflet/         Leaflet 1.9.4, incluido en el repositorio
```

Separación por rol, igual que en los laboratorios de Diseño Web: `model.js` no
usa `document`, `view.js` no consulta el modelo y `app.js` es el único que cablea
eventos y guarda estado.

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
  ficha técnica. Ficha y mapa ampliado son excluyentes: abrir uno cierra el
  otro.

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

La función `setLargeMode(on)` de `js/map.js` concentra lo que Leaflet necesita
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
de datos personales»** (Ley 1581 de 2012), sobre el servicio ya construido en el
backend (`POST /api/v1/auth/login`, JWT HS256 de 480 minutos, contraseñas con
`bcrypt`, bloqueo tras cinco intentos y bitácora de auditoría). Corresponde a la
historia de usuario **HU-07** y sigue los diagramas de actividades y de
secuencia de inicio de sesión entregados en los UML Parte 2 del Sprint 3.

### Flujo

1. `app.js` no arranca la aplicación directamente. Comprueba primero si existe
   una sesión guardada y vigente; si no la hay, muestra la pantalla de acceso y
   espera.
2. Con credenciales válidas, `model.login()` guarda la sesión, la pantalla de
   acceso se oculta, la cabecera muestra nombre y rol, y se ejecuta `start()`.
3. La sesión termina al pulsar **Cerrar sesión**, al caducar el token o al
   recibir un 401 de la API. En los tres casos se vuelve a la pantalla de
   acceso.

### Medidas de seguridad en el cliente

- **La contraseña no se conserva.** Solo existe como argumento de `login()`, se
  envía en el cuerpo del `POST` y el campo del formulario se vacía tras cada
  intento, con éxito o sin él. No se guarda en variables de módulo ni en ningún
  almacenamiento del navegador.
- **Token en `sessionStorage`.** La sesión desaparece al cerrar la pestaña. No
  se usa `localStorage`, que persiste indefinidamente y amplía la ventana de
  robo ante un posible XSS.
- **El token nunca viaja en la URL.** Todas las peticiones autenticadas pasan por
  `request()` en `model.js`, que lo añade en la cabecera
  `Authorization: Bearer`. Ni el token ni la contraseña se escriben en consola.
- **Formulario inerte sin JavaScript.** Los campos no tienen atributo `name`, el
  formulario usa `method="post"` y el botón arranca deshabilitado hasta que el
  controlador toma el control: si el script no llega a cargar, las credenciales
  no pueden enviarse a ninguna parte.
- **Mensaje genérico.** Ante credenciales inválidas la interfaz no distingue si
  falló el correo o la contraseña (flujo alternativo 1 de RF-01).
- **Cierre de sesión completo.** Borra el token, vacía el historial del
  asistente (que contiene cifras de las zonas consultadas) y recarga la página
  con `location.replace`, lo que descarta todo el estado en memoria y no deja la
  vista autenticada en el historial del navegador. Recargar después no vuelve a
  entrar.
- **Caducidad vigilada en el cliente.** Como los datos se leen hoy del corte
  local, ninguna petición al backend detectaría el vencimiento del token. El
  controlador programa el cierre de sesión con la fecha `exp` del JWT y la
  vuelve a comprobar al regresar a la pestaña. Al volver al login por este
  motivo se muestra el aviso «Tu sesión expiró».

### Respuestas del servicio de autenticación

| Código | Significado | Mensaje en la interfaz |
|---|---|---|
| 401 | Credenciales incorrectas | «Correo o contraseña incorrectos.» |
| 403 | Usuario desactivado | «Tu usuario está desactivado. Contacta al administrador.» |
| 429 | Bloqueo por intentos fallidos | «Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.» |
| Sin respuesta | Backend inaccesible | «No se pudo conectar con el servidor…» |

Fuera del login, un 401 en cualquier petición autenticada se interpreta como
sesión vencida o revocada y devuelve a la pantalla de acceso.

### Configuración

Los parámetros de conexión están concentrados al principio de `js/model.js`:

| Constante | Valor | Uso |
|---|---|---|
| `API_URL` | `http://localhost:8000/api/v1` | Base de todas las peticiones a la API. |
| `LOGIN_FIELDS` | `{ email: 'correo', password: 'contrasena' }` | Nombres de los campos del cuerpo de `POST /auth/login`. |
| `SESSION_MINUTES` | `480` | Caducidad de respaldo si el token no trae el claim `exp`. |

La respuesta del login se interpreta de forma tolerante: el token se toma de
`access_token` (o `token`) y el nombre y el rol del objeto `usuario`, o en su
defecto de los claims del JWT.

### Alcance del control de acceso

El control de acceso de esta versión se aplica **a la interfaz**: sin sesión no
se monta la aplicación ni se cargan los datos. Sin embargo, el corte de
indicadores sigue publicado como archivo estático en `api/data.json`, y ese
archivo es accesible por URL directa para cualquiera que conozca la ruta. La
protección completa de los datos exigida por RNF-02 se alcanza cuando
`loadData()` pase a obtenerlos del backend mediante `request()`, momento en que
el propio servidor validará el token en cada consulta.

No existe un modo de demostración sin credenciales: si el backend no responde,
la pantalla de acceso informa del error de conexión y la aplicación no se abre.

### Despliegue en GitHub Pages

La versión publicada se sirve por HTTPS y el backend se ejecuta en
`http://localhost:8000`. Para que el inicio de sesión funcione desde la URL
pública, el equipo del usuario debe tener el backend en ejecución y este debe
admitir por CORS el origen de GitHub Pages. Algunos navegadores aplican además
restricciones al acceso desde páginas públicas a direcciones de la red local,
por lo que el funcionamiento debe comprobarse en el navegador de destino antes
de presentarlo.

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

Los datos viajan en `api/data.json` para que la interfaz funcione sin depender
de los endpoints de datos, y las respuestas del asistente se componen con
plantillas sobre esas mismas cifras. El inicio de sesión ya se realiza contra el
backend.

Pendiente para las siguientes iteraciones:

- Conectar las funciones de datos de `js/model.js` a la API del proyecto. Las
  firmas ya son las definitivas y el helper `request()` ya añade el token, así
  que solo cambia el cuerpo de cada función: en vez de leer el JSON local, hará
  `request()` contra `/api/v1`. Con ese cambio el control de acceso cubre
  también los datos.
- Mostrar u ocultar funciones según el rol (por ejemplo, la gestión de usuarios
  para el administrador).
- Sustituir el asistente por reglas por el microservicio `ia-asistente`.

---

Equipo 2 · Proyecto Integrador II · Facultad de Ingeniería de Sistemas e Informática
Universidad Pontificia Bolivariana — Seccional Bucaramanga · 2026
