# SocialData

**Analítica e inteligencia artificial para entender la vulnerabilidad
socioeconómica del Área Metropolitana de Bucaramanga.**

![HTML](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white)
![XGBoost](https://img.shields.io/badge/IA-XGBoost%20%2B%20SHAP-0f5c52)

**Página:** https://juancarreno78.github.io/PI2---SocialData/

## El proyecto

En el Área Metropolitana de Bucaramanga, 4 de cada 10 hogares registrados en el
Sisbén están en pobreza extrema. Decidir dónde intervenir primero exige cruzar
muchos indicadores, y esa información suele estar dispersa en bases de datos
difíciles de consultar.

SocialData reúne esos datos en una sola plataforma web. Muestra cómo se
distribuye la pobreza en Bucaramanga, Floridablanca, Girón y Piedecuesta, qué
privaciones pesan más en cada zona y qué estima un modelo de inteligencia
artificial. Un asistente conversacional traduce las cifras a conclusiones y
recomendaciones en lenguaje claro.

Está pensada para funcionarios públicos y analistas sin conocimientos técnicos
avanzados, y se alinea con los Objetivos de Desarrollo Sostenible 10 (reducción
de las desigualdades) y 11 (ciudades y comunidades sostenibles).

## Funcionalidades

### Análisis territorial

- Mapa interactivo de las 8 zonas del área metropolitana (cabecera urbana y
  zona rural de cada municipio), coloreadas según el porcentaje de hogares en
  pobreza extrema.
- Vista del área metropolitana completa o de una zona en particular, con sus
  métricas principales.
- Las 15 privaciones del Índice de Pobreza Multidimensional, agrupadas en 4
  dimensiones: educación, salud, trabajo, y vivienda y servicios.

### Analítica predictiva

- Estimación del modelo XGBoost para cada zona, comparada con la distribución
  observada en el Sisbén.
- Explicación de cada estimación con valores SHAP: qué factores empujan a la
  zona hacia un grupo u otro.
- Ficha técnica del modelo con sus métricas de validación.

### Asistente de inteligencia artificial

- Conversación en lenguaje natural sobre cualquier zona.
- Conclusiones y recomendaciones de política pública, con la entidad que
  habitualmente lidera cada línea de intervención.
- Todas las cifras que cita salen de los datos y del modelo: el asistente
  redacta, pero no calcula.

### Reportes

- Exportación del reporte de una zona en PDF o en Excel.
- El PDF incluye un resumen de la conversación con el asistente.

### Gestión y seguridad

- Dos roles: analista y administrador.
- Administración de usuarios y perfil propio, con cambio de contraseña y
  cambio de nombre sujeto a aprobación del administrador.
- Bloqueo de la cuenta tras 5 intentos fallidos, contraseñas cifradas con
  bcrypt y sesiones con vencimiento.
- Solo se muestran cifras agregadas por zona: ningún dato permite identificar a
  un hogar o a una persona (Ley 1581 de 2012).
- Modo claro y modo oscuro.

## Modelo de inteligencia artificial

| Característica | Valor |
|---|---|
| Algoritmo | XGBoost, clasificación multiclase |
| Variable objetivo | Grupo del Sisbén IV (A, B, C o D) |
| Datos de entrenamiento | 10.288 hogares y 28.656 personas |
| Variables | 82 (vivienda, educación, salud, trabajo y composición del hogar) |
| Validación | Validación cruzada estratificada de 5 particiones |
| Exactitud | 79,6 % |
| F1 macro | 0,78 |
| ROC-AUC | 0,95 |
| Acierto con tolerancia de un grupo | 99,6 % |

Las cifras que muestra la página se verificaron recalculándolas directamente
con el modelo, sin pasar por la plataforma.

## Arquitectura

La plataforma está formada por microservicios que se comunican por REST y JSON,
cada uno en su propio contenedor de Docker:

| Componente | Función | Tecnología |
|---|---|---|
| Frontend (este repositorio) | Interfaz web | HTML, CSS y JavaScript |
| Backend | API, autenticación y control de acceso | FastAPI (Python) |
| Base de datos | Hogares, indicadores, usuarios y bitácora | PostgreSQL |
| IA predictiva | Clasificación y explicación | XGBoost y SHAP |
| IA generativa | Asistente conversacional | Ollama con Qwen3 8B |

Si alguno de los servicios de IA no está disponible, el resto de la plataforma
sigue funcionando.

## Acceso

La plataforma tiene acceso restringido. Las credenciales de demostración las
proporciona el equipo del proyecto.

Cuando el servidor del proyecto está en línea, los datos y la inteligencia
artificial se consultan en vivo. Si no lo está, la página funciona en modo de
demostración con los datos publicados, y el asistente responde con plantillas.

## Ejecución local

La página necesita un servidor local, porque los módulos de JavaScript no
funcionan al abrir el archivo directamente. Basta con la extensión Live Server
de VS Code o con:

```bash
python -m http.server 5173
```

y abrir http://localhost:5173 en el navegador.

## Estructura del repositorio

```
index.html          estructura de la página
config.js           dirección del servidor
css/styles.css      estilos
js/model.js         datos y sesión
js/map.js           mapa
js/view.js          presentación de la información
js/chat.js          asistente
js/app.js           controlador
js/theme.js         modo claro y oscuro
api/data.json       datos del modo de demostración
vendor/leaflet/     librería del mapa
```

## Datos

Muestra anonimizada del Sisbén IV, corte de marzo de 2022, publicada por el
Departamento Nacional de Planeación en datos.gov.co bajo licencia CC BY-SA 4.0.

SocialData es una herramienta de apoyo a la decisión: no reemplaza la
clasificación oficial del Sisbén.

## Autores

Equipo 2, Proyecto Integrador II, Universidad Pontificia Bolivariana, seccional
Bucaramanga, 2026.
