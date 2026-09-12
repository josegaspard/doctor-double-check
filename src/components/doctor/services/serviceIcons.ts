// Iconos de «Servicios y precios» (maqueta de Marta: 🎥 consulta · 👤 seguimiento · 📄 segunda opinión…).
// La base guarda solo el identificador; aquí se traduce al icono de lucide.
import { ClipboardList, FileText, Heart, Stethoscope, User, Video, type LucideIcon } from 'lucide-react';
import type { ServiceIconId } from './serviceModel';

export const SERVICE_ICONS: Record<ServiceIconId, LucideIcon> = {
  video: Video,
  user: User,
  file: FileText,
  stethoscope: Stethoscope,
  heart: Heart,
  clipboard: ClipboardList,
};

export const serviceIcon = (id?: string | null): LucideIcon =>
  (id && SERVICE_ICONS[id as ServiceIconId]) || Stethoscope;
