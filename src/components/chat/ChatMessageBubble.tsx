import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image, Reply, CornerDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatMessage } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { SecureImage } from '@/components/security/SecureImage';
import { SecurePDFViewer } from '@/components/security/SecurePDFViewer';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isSessionClosed: boolean;
  onReply?: (message: ChatMessage) => void;
}

export function ChatMessageBubble({ message, isOwn, isSessionClosed, onReply }: ChatMessageBubbleProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Stable per-bubble watermark sessionId — one per video preview, persists across re-renders
  const previewSessionId = useMemo(
    () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `bubble-${message.id}-${Math.random().toString(36).slice(2, 10)}`),
    [message.id]
  );

  // Render message content (with file support)
  const renderMessageContent = (content: string) => {
    // Check if it's a prescription message
    const prescriptionMatch = content.match(/📋.*\/prescriptions\/([a-f0-9-]+)/);
    if (prescriptionMatch) {
      const prescriptionId = prescriptionMatch[1];
      const textPart = content.split('/prescriptions/')[0].trim();
      return (
        <div 
          className="cursor-pointer"
          onClick={() => navigate(`/prescriptions/${prescriptionId}`)}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{textPart}</p>
          <div className={`mt-2 flex items-center gap-2 p-2 rounded-lg ${isOwn ? 'bg-white/10' : 'bg-primary/5'}`}>
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium underline">Ver receta médica</span>
          </div>
        </div>
      );
    }

    // Check if it's a file message
    const imageMatch = content.match(/📷 \[Imagen: (.+?)\]\n(https?:\/\/.+)/);
    const videoMatch = content.match(/🎥 \[Video: (.+?)\]\n(https?:\/\/.+)/);
    const fileMatch = content.match(/📎 \[Archivo: (.+?)\]\n(https?:\/\/.+)/);

    if (videoMatch) {
      const [, fileName, url] = videoMatch;
      return (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden" data-testid="chat-video-attachment">
            <video
              src={url}
              controls
              playsInline
              className="max-w-full rounded-lg w-full"
            />
            <DynamicWatermark
              email={user?.email}
              userId={user?.id}
              sessionId={previewSessionId}
            />
          </div>
          <p className="text-[11px] opacity-70 flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {fileName}
          </p>
        </div>
      );
    }


    if (imageMatch) {
      const [, fileName, url] = imageMatch;
      return (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-muted/30">
            <SecureImage
              signedUrl={url}
              alt={fileName}
              fileId={`chat-${message.id}`}
              bucket="documents"
              maxHeight="400px"
            />
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
      const isPdf = /\.pdf(\?|$)/i.test(fileName) || /\.pdf(\?|$)/i.test(url);
      if (isPdf) {
        return (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden bg-muted/30 p-2">
              <SecurePDFViewer
                signedUrl={url}
                fileName={fileName}
                fileId={`chat-${message.id}`}
                bucket="documents"
              />
            </div>
            <p className="text-[11px] opacity-70 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {fileName}
            </p>
          </div>
        );
      }
      // Non-PDF, non-image file: show metadata only, no download link (anti-piracy)
      return (
        <div
          className={`
            flex items-center gap-3 p-3 rounded-lg
            ${isOwn ? 'bg-white/10' : 'bg-primary/5'}
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
            <p className="text-[11px] opacity-70">Vista previa no disponible</p>
          </div>
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>;
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group items-end gap-1`}>
      {!isOwn && onReply && !isSessionClosed && (
        <button
          onClick={() => onReply(message)}
          aria-label="Responder a este mensaje"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
      )}
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
                ? 'bg-primary/80 dark:bg-muted/70 text-foreground' 
                : 'bg-white/90 dark:bg-card border border-primary/60 dark:border-border/50 text-foreground shadow-sm'
            }`
        }
      `}>
        {message.replyToId && message.replyToContent && (
          <div className={`mb-2 pl-2 border-l-2 ${isOwn ? 'border-white/40' : 'border-primary/40'} text-xs opacity-80`}>
            <div className="flex items-center gap-1 font-medium">
              <CornerDownRight className="w-3 h-3" />
              <span>{message.replyToSenderName || 'Mensaje'}</span>
            </div>
            <p className="line-clamp-2 mt-0.5 italic">{message.replyToContent.slice(0, 140)}</p>
          </div>
        )}
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
      {isOwn && onReply && !isSessionClosed && (
        <button
          onClick={() => onReply(message)}
          aria-label="Responder a este mensaje"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
