import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Send, Lock, Reply, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface SideMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_specialty: string | null;
  content: string;
  reply_to_id: string | null;
  created_at: string;
}

interface LiveDoctorSideChatProps {
  liveId: string;
}

/**
 * Side-chat exclusive to approved doctors and residents during a live.
 * Patients cannot read or write here (RLS enforced server-side).
 */
export function LiveDoctorSideChat({ liveId }: LiveDoctorSideChatProps) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<SideMessage[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<SideMessage | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const isProfessional = role === 'doctor' || role === 'resident';

  // Verify approval status
  useEffect(() => {
    if (!user?.id || !isProfessional) {
      setAllowed(false);
      return;
    }
    (async () => {
      const table = role === 'doctor' ? 'doctor_profiles' : 'resident_profiles';
      const { data } = await supabase
        .from(table as any)
        .select('status, specialty')
        .eq('user_id', user.id)
        .maybeSingle();
      const ok = (data as any)?.status === 'approved';
      setAllowed(ok);
      setSpecialty((data as any)?.specialty ?? null);
    })();
  }, [user?.id, role, isProfessional]);

  const loadMessages = useCallback(async () => {
    if (!allowed) return;
    const { data, error } = await supabase
      .from('live_doctor_chat' as any)
      .select('*')
      .eq('live_id', liveId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) {
      console.error('side-chat load error', error);
      return;
    }
    setMessages((data || []) as SideMessage[]);
  }, [liveId, allowed]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime
  useEffect(() => {
    if (!allowed) return;
    const channel = supabase
      .channel(`live-side-chat-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_doctor_chat',
          filter: `live_id=eq.${liveId}`,
        },
        (payload) => {
          const m = payload.new as SideMessage;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId, allowed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || !user || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from('live_doctor_chat' as any).insert({
        live_id: liveId,
        user_id: user.id,
        user_name: user.name || 'Profesional',
        user_specialty: specialty,
        content: trimmed,
        reply_to_id: replyTo?.id || null,
      });
      if (error) throw error;
      setContent('');
      setReplyTo(null);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  if (allowed === null) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">Cargando…</div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center gap-2 text-muted-foreground">
        <Lock className="w-6 h-6" />
        <p className="text-sm font-medium">Canal exclusivo para doctores y residentes verificados</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-card rounded-lg border overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Chat profesional</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">Privado</Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0 px-3 py-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sin mensajes aún. Comparte observaciones con tus colegas.
          </p>
        ) : (
          <div className="space-y-2.5">
            {messages.map((m) => {
              const isOwn = m.user_id === user?.id;
              const reply = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
              return (
                <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    {!isOwn && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-semibold">{m.user_name}</span>
                        {m.user_specialty && (
                          <span className="text-[10px] opacity-70">· {m.user_specialty}</span>
                        )}
                      </div>
                    )}
                    {reply && (
                      <div className={`mb-1.5 pl-2 border-l-2 ${isOwn ? 'border-white/40' : 'border-primary/40'} text-xs opacity-80`}>
                        <p className="font-medium">{reply.user_name}</p>
                        <p className="line-clamp-2 italic">{reply.content.slice(0, 120)}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className={`text-[10px] ${isOwn ? 'opacity-70' : 'text-muted-foreground'}`}>
                        {format(new Date(m.created_at), 'HH:mm', { locale: es })}
                      </span>
                      <button
                        onClick={() => setReplyTo(m)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-0.5 ${
                          isOwn ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Reply className="w-3 h-3" /> Responder
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      {replyTo && (
        <div className="px-3 py-2 border-t bg-muted/40 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-primary">Respondiendo a {replyTo.user_name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{replyTo.content}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancelar respuesta"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-2 border-t bg-card flex gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Mensaje a colegas…"
          className="h-11 text-base"
          disabled={sending}
        />
        <Button
          onClick={handleSend}
          size="icon"
          disabled={!content.trim() || sending}
          className="h-11 w-11"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
