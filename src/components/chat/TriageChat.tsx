import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, Lock, Stethoscope, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Free AI triage chat shown to patients before they purchase a chat session
 * with a real doctor. Caps interactions at FREE_LIMIT messages and then
 * blocks the input with a subscription/consultation paywall.
 *
 * The assistant response is intentionally generic + safety-oriented —
 * the real model wiring is expected to be plugged into the `ai-triage`
 * Supabase edge function. Until then we serve a deterministic stub so
 * the UX is fully functional.
 */

const FREE_LIMIT = 5;
const STORAGE_KEY = 'mm.triage.free_used';

interface Msg { role: 'user' | 'assistant'; text: string; }

function loadUsed(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function saveUsed(n: number) {
  try { localStorage.setItem(STORAGE_KEY, String(n)); } catch {}
}

async function fetchTriageReply(userText: string): Promise<string> {
  // Placeholder: deterministic safety-first reply. Swap for edge function:
  //   await supabase.functions.invoke('ai-triage', { body: { text: userText } })
  const lower = userText.toLowerCase();
  const red = ['dolor pecho', 'pecho', 'sangrado', 'desmay', 'no respiro', 'no puedo respirar', 'suicid', 'chest pain'];
  if (red.some(k => lower.includes(k))) {
    return 'Lo que describes puede ser una urgencia. Por favor acude al servicio de emergencias más cercano o llama al 911 ahora mismo. ' +
           'Aquí no puedo sustituir una valoración presencial inmediata.';
  }
  return 'Gracias por compartir. Tomando en cuenta lo que mencionas, una orientación general es observar la duración de los síntomas, ' +
         'identificar factores que los empeoran o alivian, y registrar si hay fiebre. ' +
         'Para un diagnóstico y plan de tratamiento personalizados, te recomiendo iniciar una consulta con un médico verificado.';
}

export function TriageChat() {
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Hola, soy el asistente de orientación de Medical Masters. Cuéntame qué te está pasando y te oriento; cuando quieras una respuesta clínica real, te conecto con un médico verificado.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [used, setUsed] = useState<number>(() => loadUsed());
  const scrollerRef = useRef<HTMLDivElement>(null);

  const blocked = used >= FREE_LIMIT;
  const remaining = Math.max(0, FREE_LIMIT - used);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || blocked) return;
    setMsgs(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const reply = await fetchTriageReply(text);
      setMsgs(prev => [...prev, { role: 'assistant', text: reply }]);
      const next = used + 1;
      setUsed(next);
      saveUsed(next);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">Orientación gratuita</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {blocked
              ? 'Has usado todas tus consultas gratuitas.'
              : `${remaining} ${remaining === 1 ? 'consulta gratuita restante' : 'consultas gratuitas restantes'}`}
          </p>
        </div>
      </div>

      <div ref={scrollerRef} className="h-[420px] overflow-y-auto px-3 py-3 space-y-2 bg-muted/30">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border border-border rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Escribiendo…
            </div>
          </div>
        )}
      </div>

      {blocked ? (
        <div className="p-4 border-t border-border bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-start gap-2 mb-3">
            <Lock className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Continúa con un médico verificado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activa una suscripción para chat ilimitado, o inicia una consulta puntual con un médico.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="flex-1" onClick={() => navigate('/wallet?tab=subscription')}>
              Activar suscripción
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate('/doctors')}>
              <Stethoscope className="w-4 h-4 mr-1.5" /> Ver médicos
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-border bg-background">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Describe brevemente lo que sientes…"
              rows={2}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !input.trim()} className="self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            No sustituye una consulta médica. Para emergencias llama al 911.
          </p>
        </div>
      )}
    </Card>
  );
}
