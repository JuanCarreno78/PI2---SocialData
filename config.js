// Dirección de la API del backend.
//
// - Servido por el proxy de socialdata-ngrok (localhost:8080 o el túnel), la
//   página y la API comparten origen: basta la ruta relativa '/api/v1'.
// - Publicado en GitHub Pages, la API está en el túnel de ngrok. El backend debe
//   tener https://juancarreno78.github.io en CORS_ORIGINS (.env de socialdata-ngrok).
//   Si el túnel está cerrado, el login pasa solo al modo de demostración.
//
// La dirección va en este archivo, que solo cambia quien edita el repositorio, y
// no en un parámetro de la URL: con un parámetro, un enlace malicioso podía hacer
// que el login enviara las contraseñas a otro servidor.
(function () {
  const TUNEL = 'https://reviver-dangling-refinery.ngrok-free.dev';
  const enGitHubPages = location.hostname.endsWith('github.io');

  window.SD_CONFIG = Object.freeze({
    apiUrl: enGitHubPages ? TUNEL + '/api/v1' : '/api/v1'
  });
})();
