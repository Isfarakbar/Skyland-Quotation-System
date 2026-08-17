const forceLegacy = new URLSearchParams(window.location.search).get('ui') === 'legacy'
  || import.meta.env.VITE_UI_VERSION === 'legacy';

if (forceLegacy) {
  import('./main.js');
} else {
  import('./react/bootstrap');
}
