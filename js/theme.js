//js/theme.js
// Aplica el modo oscuro antes de pintar la página, para que no parpadee en claro.
try {
  if (localStorage.getItem('sd.theme') === 'dark') document.documentElement.dataset.theme = 'dark';
} catch (error) {
  // Sin almacenamiento disponible: queda en claro.
}
