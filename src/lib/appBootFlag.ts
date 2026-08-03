// Variable de módulo (NO sessionStorage): vive solo mientras dure esta carga
// de la SPA y se resetea sola en cada recarga dura — justo lo que necesitamos
// para distinguir "esta pestaña ya terminó el splash de arranque" de "acabamos
// de cargar la página desde cero". La usa RoleSelector.tsx para no mostrar SU
// propia animación de marca encima del splash de arranque (App.tsx) cuando se
// entra directo a /app por URL/deep-link — evitaría dos overlays apilados.
let booted = false;

export function markAppBooted() {
  booted = true;
}

export function hasAppBooted() {
  return booted;
}
