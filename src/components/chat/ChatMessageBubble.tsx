import React from 'react';
import { FileText, Image, Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatMessage } from '@/contexts/ChatContext';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isSessionClosed: boolean;
}

export function ChatMessageBubble({ message, isOwn, isSessionClosed }: ChatMessageBubbleProps) {
  // Render message content (with file support)
  const renderMessageContent = (content: string) => {
    // Check if it's a file message
    const imageMatch = content.match(/📷 \[Imagen: (.+?)\]\n(https?:\/\/.+)/);
    const fileMatch = content.match(/📎 \[Archivo: (.+?)\]\n(https?:\/\/.+)/);

    if (imageMatch) {
      const [, fileName, url] = imageMatch;
      return (
        <div className="space-y-2">
          <div className="relative group/img rounded-lg overflow-hidden">
            <img 
              src={url} 
              alt={fileName} 
              className="max-w-full rounded-lg cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => window.open(url, '_blank')}
            />
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
              <ExternalLink className="w-6 h-6 text-white drop-shadow-lg" />
            </div>
          </div>
          <p className="text-[11px] opacity-70 flex items-center gap-1">
            <Image className="w-3 h-3" />
            {fileName}
          </p>
        </div>
      );
    }

    if (fileMatch) {
      const [, fileName, url] = fileMatch;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`
            flex items-center gap-3 p-3 rounded-lg transition-all
            ${isOwn 
              ? 'bg-white/10 hover:bg-white/20' 
              : 'bg-primary/5 hover:bg-primary/10'
            }
          `}
        >
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            ${isOwn ? 'bg-white/20' : 'bg-primary/10'}
          `}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className="text-[11px] opacity-70">Clic para descargar</p>
          </div>
          <Download className="w-4 h-4 opacity-50" />
        </a>
      );
    }

    return <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>;
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
      <div className={`
        relative max-w-[85%] sm:max-w-[75%] px-4 py-2.5 
        ${isOwn 
          ? `rounded-2xl rounded-br-md ${
              isSessionClosed 
                ? 'bg-primary/70 text-primary-foreground' 
                : 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md'
            }`
          : `rounded-2xl rounded-bl-md ${
              isSessionClosed 
                ? 'bg-blue-50/80 dark:bg-muted/70 text-foreground' 
                : 'bg-white/90 dark:bg-card border border-blue-100/60 dark:border-border/50 text-foreground shadow-sm'
            }`
        }
      `}>
        {renderMessageContent(message.content)}
        <p className={`
          text-[10px] mt-1.5 flex items-center justify-end gap-1
          ${isOwn 
            ? 'text-primary-foreground/60' 
            : 'text-muted-foreground'
          }
        `}>
          {format(message.createdAt, 'dd MMM, HH:mm', { locale: es })}
        </p>
      </div>
    </div>
  );
}
