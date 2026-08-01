const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.NAIJACART_CONFIG = {
  API_BASE: isLocal ? 'http://localhost:8080' : '',
};
