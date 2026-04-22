import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
 * Reemplaza marcadores feos como `[Imagen: archivo.jpg]` por iconos amigables tipo
 * "📷 Foto" o "📎 Archivo" como hacen WhatsApp/Instagram.
 */
export function formatMessagePreview(content: string | null | undefined, maxLength: number = 100): string {
  if (!content) return "";
  const raw = String(content).trim();
  if (!raw) return "";

  // 1) Imagen: variantes con o sin emoji y con o sin texto
  //    Ejemplos: "📷 [Imagen: 1 post sev marzo.jpg]", "[Imagen: scan.png]", "[Image: x.jpg]"
  if (/^(?:📷\s*)?\[(?:Imagen|Image|Photo|Foto):/i.test(raw)) {
    return "📷 Foto";
  }

  // 2) Receta médica: enlaces a /prescriptions o marcadores
  if (/^(?:📋\s*)?\[(?:Receta|Prescription)/i.test(raw) || /\/prescriptions\//i.test(raw)) {
    return "📋 Receta médica";
  }

  // 3) Audio
  if (/^(?:🎤\s*)?\[(?:Audio|Voice|Voz)/i.test(raw)) {
    return "🎤 Mensaje de voz";
  }

  // 4) Video
  if (/^(?:🎥\s*)?\[(?:Video|Vídeo)/i.test(raw)) {
    return "🎥 Video";
  }

  // 5) Archivo genérico
  const fileMatch = raw.match(/^(?:📎\s*)?\[(?:Archivo|File|Document|Documento):\s*([^\]]+)\]/i);
  if (fileMatch) {
    const name = fileMatch[1].trim();
    if (name && name.length <= 28) return `📎 ${name}`;
    return "📎 Archivo";
  }

  // 6) Texto normal: truncar
  if (raw.length > maxLength) return raw.substring(0, maxLength) + "...";
  return raw;
}
