// Inicialización de Google Analytics extraída del inline de index.html para
// poder quitar 'unsafe-inline' de script-src en el CSP (endurecimiento anti-XSS).
// El script externo gtag.js se carga aparte desde googletagmanager.com.
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-NB9CJEJYPV', {
  anonymize_ip: true,
  cookie_flags: 'SameSite=None;Secure'
});
