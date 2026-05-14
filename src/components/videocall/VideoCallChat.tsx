import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isOwn: boolean;
}

interface VideoCallChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}

export function VideoCallChat({ messages, onSend, onClose }: VideoCallChatProps) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll al fondo SOLO dentro del scroll-area, no la página entera.
  // Antes usaba scrollIntoView({behavior:'smooth'}) que en iOS desplazaba toda
  // la página hacia arriba al hacer focus en el input (bug que el user reportó).
  useEffect(() => {
    const container = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      // Mobile: bottom-sheet full-width, ~70% altura.
      // Desktop: side-panel derecho 320px full-height.
      className="absolute z-30 bg-card/97 backdrop-blur-md flex flex-col shadow-2xl
                 inset-x-0 bottom-0 h-[70%] rounded-t-2xl border-t border-border
                 sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-auto sm:w-80 sm:rounded-none sm:border-t-0 sm:border-l"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Handle bar visible solo en mobile bottom-sheet */}
      <div className="sm:hidden flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
        <h3 className="font-semibold text-sm">Chat en llamada</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 min-h-0 px-3 py-2">
        <div className="space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8 px-4">
              Envía un mensaje para iniciar la conversación durante la llamada.
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${
                  msg.isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}
              >
                {!msg.isOwn && (
                  <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.sender}</p>
                )}
                <p className="leading-snug">{msg.text}</p>
                <p className="text-[10px] opacity-60 text-right mt-0.5">{msg.time}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-border flex gap-2 items-end flex-shrink-0">
        {/* font-size 16px = no auto-zoom en iOS Safari. textarea-like growing input. */}
        <textarea
          placeholder="Mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-base sm:text-sm min-h-[40px] max-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/40"
          style={{ fontSize: '16px' }}
          enterKeyHint="send"
        />
        <Button
          size="icon"
          className="h-10 w-10 flex-shrink-0 rounded-xl"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
