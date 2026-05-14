/**
 * Cola persistente de uploads pendientes en IndexedDB.
 *
 * Permite que un upload de grabación premium SOBREVIVA al cierre del tab:
 * el blob + metadata se guardan en IndexedDB ANTES de iniciar TUS upload.
 * Si el usuario cierra el navegador, al volver a entrar a la app la cola
 * detecta uploads pendientes y los reanuda automáticamente con tus-js-client
 * (que ya sabe el fingerprint de la subida y continúa donde la dejó).
 *
 * No usa Service Worker / Background Fetch (Chrome-only) — esto funciona
 * en todos los browsers modernos (Chrome/FF/Safari/Edge).
 */

const DB_NAME = 'mm-uploads';
const DB_VERSION = 1;
const STORE = 'pending';

export interface PendingUpload {
  id: string;
  blob: Blob;
  meta: {
    liveId: string;
    doctorId: string;
    title: string;
    description?: string;
    specialty: string;
    tags?: string[];
    price: number;
    thumbnailUrl?: string;
    recordingId?: string;
    bunnyVideoId?: string;
    libraryId?: string;
    authSignature?: string;
    authExpire?: number;
  };
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function saveUpload(upload: PendingUpload): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(upload);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeUpload(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function updateUpload(id: string, patch: Partial<PendingUpload>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) { tx.abort(); reject(new Error('not found')); return; }
      const merged = { ...existing, ...patch, meta: { ...existing.meta, ...(patch.meta || {}) } };
      store.put(merged);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
