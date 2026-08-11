// ============================================
// SKYLAND ENERGY — SPA Router
// ============================================

const routes = {};
let currentRoute = null;
let beforeNavigate = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return currentRoute;
}

export function onBeforeNavigate(fn) {
  beforeNavigate = fn;
}

export function initRouter(defaultRoute = '/dashboard') {
  const handleRoute = async () => {
    const hash = window.location.hash.slice(1) || defaultRoute;
    const [path, ...paramParts] = hash.split('/').filter(Boolean);
    const fullPath = '/' + path;
    const params = paramParts.join('/');

    if (beforeNavigate) {
      const canNavigate = await beforeNavigate(fullPath);
      if (canNavigate === false) return;
    }

    const handler = routes[fullPath];
    if (handler) {
      currentRoute = fullPath;
      updateActiveLink(fullPath);
      await handler(params);
    } else {
      // Fallback to default
      navigate(defaultRoute);
    }
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function updateActiveLink(path) {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('data-route');
    if (href === path) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
