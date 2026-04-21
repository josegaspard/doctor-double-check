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
