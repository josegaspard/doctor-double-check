import type { ElementType } from 'react';
import {
  Bell,
  Banknote,
  CalendarDays,
  FileText,
  MessageCircle,
  PhoneMissed,
  RotateCcw,
  ShoppingBag,
  Radio,
  Star,
  UserPlus,
  Video,
  Wallet,
} from 'lucide-react';

/** Icono lucide por tipo de notificación (sustituye a los emojis de antes). */
const ICONS: Record<string, ElementType> = {
  doctor_live: Radio,
  doctor_availability: CalendarDays,
  new_content: FileText,
  chat_message: MessageCircle,
  subscription_update: Star,
  rating_request: Star,
  recording_purchase: Wallet,
  new_subscriber: UserPlus,
  payment_received: Banknote,
  video_call: Video,
  missed_call: PhoneMissed,
  live_started: Radio,
  availability_reminder: CalendarDays,
  content_purchase: Wallet,
  wallet_transaction: Wallet,
  purchase: ShoppingBag,
  refund: RotateCcw,
};

export function NotificationTypeIcon({ type, className = 'w-4 h-4' }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Bell;
  return <Icon className={className} aria-hidden="true" />;
}
