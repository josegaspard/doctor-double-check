import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Award, BadgeCheck, Send, Loader2, ArrowLeft } from 'lucide-react';

interface BadgeMsg {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
}

/**
 * Chat exclusivo por distintivo (cliente 2026-06-29):
 *   - Doctores 🥇 medalla → sala solo de medallas.
 *   - Doctores ✔️ palomita → sala solo de palomitas.
 * La RLS de badge_chat_messages garantiza que cada quien solo ve/escribe en su sala;
 * un medalla NO ve el chat de palomita y viceversa.
 */
export default function BadgeChat() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [badge, setBadge] = useState<'gold' | 'verified' | null | undefined>(undefined);
  const [messages, setMessages] = useState<BadgeMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Distintivo del usuario actual
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('doctor_profiles')
      .select('manual_badge')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setBadge(((data as any)?.manual_badge as 'gold' | 'verified' | null) ?? null));
  }, [user?.id]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('badge_chat_messages' as any)
      .select('id, sender_id, content, created_at')
      .order('created_at', { ascending: true })
      .limit(200);
    const rows = (data as any as BadgeMsg[]) || [];
    const ids = [...new Set(rows.map(r => r.sender_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles_public').select('id, name').in('id', ids);
      const nameMap = new Map((profs || []).map((p: any) => [p.id, p.name]));
      rows.forEach(r => { r.sender_name = nameMap.get(r.sender_id) as string | undefined; });
    }
    setMessages(rows);
  };

  // Cargar + realtime (solo si tiene badge)
  useEffect(() => {
    if (badge !== 'gold' && badge !== 'verified') return;
    loadMessages();
    const channel = supabase
      .channel('badge-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'badge_chat_messages' }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!draft.trim() || !user?.id || (badge !== 'gold' && badge !== 'verified')) return;
    setSending(true);
    const { error } = await supabase
      .from('badge_chat_messages' as any)
      .insert({ badge, sender_id: user.id, content: draft.trim() } as any);
    if (!error) { setDraft(''); await loadMessages(); }
    setSending(false);
  };

  if (badge === undefined) {
    return (
      <MainLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Sin distintivo → no tiene acceso a ninguna sala exclusiva
  if (badge !== 'gold' && badge !== 'verified') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 max-w-lg text-center">
          <p className="text-muted-foreground">{t('badgeChat.noAccess')}</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate('/chat')}>
            <ArrowLeft className="w-4 h-4" /> {t('badgeChat.backToChat')}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isGold = badge === 'gold';
  const RoomIcon = isGold ? Award : BadgeCheck;
  const roomTitle = isGold ? t('badgeChat.goldRoom') : t('badgeChat.verifiedRoom');

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-2xl flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="back" size="sm" className="gap-1.5" onClick={() => navigate('/chat')}>
            <ArrowLeft className="w-4 h-4" /> {t('badgeChat.backToChat')}
          </Button>
          <div className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${isGold ? 'bg-premium/15 text-premium' : 'bg-primary/10 text-primary'}`}>
            <RoomIcon className="w-4 h-4" /> {roomTitle}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card/50 p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">{t('badgeChat.empty')}</p>
          )}
          {messages.map((m) => {
            const own = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${own ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {!own && <p className="text-[11px] font-semibold opacity-70 mb-0.5">{m.sender_name || 'Doctor'}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 mt-3">
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
    </MainLayout>
  );
}
