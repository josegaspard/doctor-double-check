// Handoff de la foto de la cédula profesional REGISTRO → ONBOARDING (cliente 2026-07-08).
//
// Por qué existe: al completarse el signUp, el listener de Auth hace un redirect
// DURO (window.location) a /onboarding, que mata cualquier subida en vuelo desde
// el formulario de registro. Además, antes del signUp no hay sesión y el bucket
// privado 'doctor-credentials' exige carpeta = auth.uid(). Así que el registro
// GUARDA el archivo en IndexedDB y el onboarding lo recoge, lo sube con la
// sesión ya viva y lo liga a doctor_profiles. Sobrevive incluso al flujo de
// confirmación por correo (IndexedDB persiste en el mismo navegador).

const DB_NAME = 'mm-cedula-handoff';
const STORE = 'files';
const KEY = 'cedula-foto';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function stashCedulaFoto(file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ blob: file, name: file.name, type: file.type }, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Recupera la foto pendiente y la BORRA del stash (o null si no hay). */
export async function takeCedulaFoto(): Promise<File | null> {
  try {
    const db = await openDb();
    const entry = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const get = store.get(KEY);
      get.onsuccess = () => {
        store.delete(KEY);
        resolve(get.result);
      };
      get.onerror = () => reject(get.error);
    });
    db.close();
    if (!entry?.blob) return null;
    return new File([entry.blob], entry.name || 'cedula.jpg', { type: entry.type || 'image/jpeg' });
  } catch {
    return null;
  }
}
