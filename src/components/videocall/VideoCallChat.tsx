import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="absolute top-0 right-0 bottom-0 w-80 bg-card/95 backdrop-blur-md border-l flex flex-col z-10"
    >
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Chat en llamada</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.isOwn
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {!msg.isOwn && (
                  <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.sender}</p>
                )}
                <p>{msg.text}</p>
                <p className="text-[10px] opacity-60 text-right mt-0.5">{msg.time}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="Mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="h-9 text-sm"
        />
        <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={handleSend} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
