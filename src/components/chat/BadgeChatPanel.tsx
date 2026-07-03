import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { es as esLocale, enUS } from 'date-fns/locale';

// Chat grupal exclusivo por insignia (cliente 2026-07-02): sala única de
// "Doctores verificados". Estilo panel.yakupark → mensajes agrupados POR DÍA
// (separador de fecha) y etiquetados POR DOCTOR (nombre del emisor). La RLS de
// badge_chat_messages garantiza que cada quien solo ve/escribe en su sala
// (palomita con palomita, medalla con medalla).

interface BadgeMsg {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

interface DayGroup {
  key: string;
  label: string;
  messages: BadgeMsg[];
}

interface Props {
  /** Distintivo del usuario: define la sala. */
  badge: 'gold' | 'verified';
  className?: string;
}

export function BadgeChatPanel({ badge, className = '' }: Props) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'es' ? esLocale : enUS;
  const [messages, setMessages] = useState<BadgeMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // Scroll SOLO dentro del contenedor de mensajes (nunca scrollIntoView: ese
  // método baja toda la ventana para "traer a la vista" el ancla — provocaba
  // que al abrir la sala la web entera hiciera scroll hacia abajo).
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('badge_chat_messages' as any)
      .select('id, sender_id, content, created_at')
      .order('created_at', { ascending: true })
      .limit(300);
    const rows = (data as any as BadgeMsg[]) || [];
    const ids = [...new Set(rows.map(r => r.sender_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles_public').select('id, name').in('id', ids);
      const nameMap = new Map((profs || []).map((p: any) => [p.id, p.name]));
      rows.forEach(r => { r.sender_name = nameMap.get(r.sender_id) as string | undefined; });
    }
    setMessages(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel('badge-chat-panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'badge_chat_messages' }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight; // baja el contenedor, no la ventana
  }, [messages]);

  const send = async () => {
    if (!draft.trim() || !user?.id) return;
    setSending(true);
    const { error } = await supabase
      .from('badge_chat_messages' as any)
      .insert({ badge, sender_id: user.id, content: draft.trim() } as any);
    if (!error) { setDraft(''); await loadMessages(); }
    setSending(false);
  };

  // Agrupar POR DÍA (separador de fecha, estilo yakupark).
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return t('badgeChat.today');
    if (isYesterday(d)) return t('badgeChat.yesterday');
    return format(d, 'd MMMM yyyy', { locale });
  };
  const groups: DayGroup[] = [];
  for (const m of messages) {
    const key = m.created_at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.messages.push(m);
    else groups.push({ key, label: dayLabel(m.created_at), messages: [m] });
  }

  const isGold = badge === 'gold';
  const badgeImg = isGold ? '/badge-gold.png' : '/badge-verified.png';

  return (
    <div className={`flex flex-col min-h-0 h-full rounded-xl border-0 shadow-lg bg-card overflow-hidden ${className}`}>
      {/* Encabezado de la sala grupal */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isGold ? 'bg-premium/15' : 'bg-primary/15'}`}>
          <img src={badgeImg} alt="" aria-hidden="true" className="w-6 h-6 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{t('badgeChat.roomRowTitle')}</p>
          <p className="text-[11px] text-muted-foreground truncate">{t('badgeChat.roomRowSubtitle')}</p>
        </div>
      </div>

      {/* Mensajes agrupados por día */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">{t('badgeChat.empty')}</p>
        ) : (
          groups.map(g => (
            <div key={g.key} className="space-y-2">
              {/* Separador POR DÍA */}
              <div className="flex justify-center">
                <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-3 py-0.5">
                  {g.label}
                </span>
              </div>
              {g.messages.map(m => {
                const own = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${own ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                      {/* Etiqueta POR DOCTOR (nombre del emisor) */}
                      {!own && <p className="text-[11px] font-semibold opacity-70 mb-0.5">{m.sender_name || t('congresses.speakerFallback')}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={`text-[10px] mt-0.5 text-right ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(m.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Enviar */}
      <div className="flex items-center gap-2 p-3 border-t border-border flex-shrink-0">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t('badgeChat.placeholder')}
          disabled={sending}
        />
        <Button onClick={send} disabled={sending || !draft.trim()} className="gap-1.5">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
