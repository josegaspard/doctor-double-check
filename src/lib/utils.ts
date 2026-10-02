import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { stripEmoji } from "./stripEmoji";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitiza un valor de credencial profesional (cédula, COFEPRIS, etc.).
 * Devuelve `null` si el valor está vacío, es basura o no aporta información,
 * para evitar renderizar badges vacíos o con placeholders.
 */
export function sanitizeCredential(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (["null", "undefined", "n/a", "na", "-", "—", "none", "sin dato", "sin datos"].includes(lower)) {
    return null;
  }
  return trimmed;
}

/**
 * Genera un preview limpio del último mensaje de un chat para listas/notificaciones.
 * Reemplaza marcadores feos como `[Imagen: archivo.jpg]` por etiquetas limpias tipo
 * "Foto" o "Archivo" (sin emojis: cliente 2026-10-01). Los mensajes antiguos llevan
 * un emoji delante del marcador; por eso el prefijo pictográfico es opcional.
 */
export function formatMessagePreview(content: string | null | undefined, maxLength: number = 100): string {
  if (!content) return "";
  const raw = String(content).trim();
  if (!raw) return "";

  // 1) Imagen: variantes con o sin emoji y con o sin texto
  //    Ejemplos: "[Imagen: 1 post sev marzo.jpg]" (con o sin emoji delante), "[Image: x.jpg]"
  if (/^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\[(?:Imagen|Image|Photo|Foto):/iu.test(raw)) {
    return "Foto";
  }

  // 2) Receta médica: enlaces a /prescriptions o marcadores
  if (/^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\[(?:Receta|Prescription)/iu.test(raw) || /\/prescriptions\//i.test(raw)) {
    return "Receta médica";
  }

  // 3) Audio
  if (/^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\[(?:Audio|Voice|Voz)/iu.test(raw)) {
    return "Mensaje de voz";
  }

  // 4) Video
  if (/^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\[(?:Video|Vídeo)/iu.test(raw)) {
    return "Video";
  }

  // 5) Archivo genérico
  const fileMatch = raw.match(/^(?:\p{Extended_Pictographic}\uFE0F?\s*)?\[(?:Archivo|File|Document|Documento):\s*([^\]]+)\]/iu);
  if (fileMatch) {
    const name = fileMatch[1].trim();
    if (name && name.length <= 28) return name;
    return "Archivo";
  }

  // 6) Texto normal: sin emojis (cliente 2026-10-01) y truncado
  const text = stripEmoji(raw);
  if (text.length > maxLength) return text.substring(0, maxLength) + "...";
  return text;
}
