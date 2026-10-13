# SocialData

Plataforma web para consultar indicadores de vulnerabilidad socioeconómica del
Área Metropolitana de Bucaramanga (Bucaramanga, Floridablanca, Girón y
Piedecuesta), con datos del Sisbén IV y un modelo de inteligencia artificial.

Proyecto Integrador II - Equipo 2 - Universidad Pontificia Bolivariana,
seccional Bucaramanga.

**Página:** https://juancarreno78.github.io/PI2---SocialData/

## Qué se puede hacer

- Ver en un mapa las 8 zonas del área metropolitana, coloreadas según el
  porcentaje de hogares en pobreza extrema (grupo A del Sisbén).
- Consultar las 4 dimensiones y los 15 indicadores de privación de cada zona.
- Ver la predicción del modelo XGBoost para cada zona y los factores que más
  pesan en ella.
- Conversar con un asistente de IA que redacta conclusiones y recomendaciones.
- Exportar el reporte de una zona en PDF o Excel.
- Administrar usuarios (solo el administrador) y editar el propio perfil.
- Usar la página en modo claro u oscuro.

## Cómo entrar

Usuarios: `admin@socialdata.co` (administrador) y `analista@socialdata.co`
(analista). La contraseña la entrega el equipo.

Cuando el backend del equipo está conectado, los datos y la IA vienen del
servidor. Si no lo está, la página funciona en modo de demostración con los
datos publicados, y el asistente responde con plantillas.

## Verla en tu equipo

Necesita un servidor local: los módulos de JavaScript no funcionan abriendo el
archivo con doble clic. Con la extensión Live Server de VS Code, o con:

```bash
python -m http.server 5173
```

y abrir http://localhost:5173.

## Estructura

```
index.html          estructura de la página
config.js           dirección del backend
css/styles.css      estilos
js/model.js         datos y sesión
js/map.js           mapa
js/view.js          dibuja la página
js/chat.js          asistente
js/app.js           controlador: eventos y estado
js/theme.js         modo oscuro
api/data.json       datos para el modo de demostración
vendor/leaflet/     librería del mapa
```

Al publicar cambios, sube el número `?v=` en `index.html` para que el navegador
no use archivos viejos guardados en caché.

## Tecnologías

HTML, CSS y JavaScript con módulos ES, sin frameworks. Leaflet 1.9.4 para el
mapa. El backend (FastAPI, PostgreSQL, el modelo XGBoost y el asistente con
Ollama) no está en este repositorio.

## Datos

Muestra anonimizada del Sisbén IV, corte de marzo de 2022, publicada por el DNP
en datos.gov.co (licencia CC BY-SA 4.0). Es una herramienta de apoyo a la
decisión: no reemplaza la clasificación oficial del Sisbén.
