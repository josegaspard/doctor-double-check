import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FileText, Video, Image as ImageIcon, Loader2, ExternalLink, RefreshCw, User, DollarSign, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ContentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    title: string;
    description?: string | null;
    type: 'video' | 'pdf' | 'image' | 'presentation';
    file_url: string;
    thumbnail_url?: string | null;
    price?: number;
    audience_type?: string;
    created_at?: string;
    creator_name?: string;
    creator_avatar?: string;
    creator_specialty?: string;
  } | null;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  video: { icon: Video, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Video' },
  pdf: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'PDF' },
  image: { icon: ImageIcon, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Imagen' },
  presentation: { icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Presentación' },
};

function PreviewLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-48 sm:h-56 bg-muted/50 rounded-xl border border-border/50">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
      <p className="text-sm text-muted-foreground">Cargando vista previa…</p>
    </div>
  );
}

function PreviewError({
  config,
  error,
  signedUrl,
  onRetry,
}: {
  config: typeof typeConfig.pdf;
  error: string | null;
  signedUrl: string | null;
  onRetry: () => void;
}) {
  const TypeIcon = config.icon;
  return (
    <div className="flex flex-col items-center justify-center h-48 sm:h-56 bg-muted/50 rounded-xl border border-border/50 gap-3">
      <div className={`w-14 h-14 rounded-full ${config.bg} flex items-center justify-center`}>
        <TypeIcon className={`w-7 h-7 ${config.color}`} />
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
        {error || 'No se pudo cargar el archivo'}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Reintentar
        </Button>
        {signedUrl && (
          <Button variant="default" size="sm" onClick={() => window.open(signedUrl, '_blank', 'noopener')} className="gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir en pestaña
          </Button>
        )}
      </div>
    </div>
  );
}

function PreviewContent({
  content,
  signedUrl,
  blobUrl,
}: {
  content: ContentPreviewModalProps['content'];
  signedUrl: string;
  blobUrl: string | null;
}) {
  if (!content) return null;

  switch (content.type) {
    case 'image':
      return (
        <div
          className="relative w-full max-h-[50vh] sm:max-h-[60vh] overflow-hidden rounded-xl bg-muted/30 border border-border/50 select-none"
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={signedUrl}
            alt={content.title}
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
            onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
          />
        </div>
      );
    case 'video':
      return (
        <div
          className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border/50"
          onContextMenu={(e) => e.preventDefault()}
        >
          <video
            src={signedUrl}
            controls
            playsInline
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            className="w-full h-full object-contain"
            poster={content.thumbnail_url || undefined}
            onContextMenu={(e) => e.preventDefault()}
          >
            Tu navegador no soporta videos HTML5.
          </video>
        </div>
      );
    case 'pdf': {
      return (
        <div className="space-y-2">
          <div className="relative w-full h-[50vh] sm:h-[60vh] rounded-xl overflow-hidden border border-border/50 bg-muted/20">
            {blobUrl ? (
              <iframe
                src={`${blobUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full"
                title={content.title}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <FileText className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cargando PDF…</p>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => window.open(signedUrl, '_blank', 'noopener')}
            >
              <ExternalLink className="w-3 h-3" />
              ¿No se ve? Abrir en pestaña
            </Button>
          </div>
        </div>
      );
    }
    default:
      return (
        <div className="flex flex-col items-center justify-center h-48 bg-muted/50 rounded-xl border border-border/50 gap-3">
          <FileText className="w-12 h-12 text-muted-foreground" />
          <Button variant="default" size="sm" onClick={() => window.open(signedUrl, '_blank', 'noopener')} className="gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir archivo
          </Button>
        </div>
      );
  }
}

export function ContentPreviewModal({ isOpen, onClose, content }: ContentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const fetchSignedUrl = useCallback(async () => {
    if (!content?.file_url || !isOpen) return;
    setIsLoading(true);
    setError(null);
    try {
      let url = content.file_url;
      if (!content.file_url.startsWith('http')) {
        const { data, error: urlError } = await supabase.storage
          .from('doctor-content')
          .createSignedUrl(content.file_url, 60 * 60);
        if (urlError) throw urlError;
        url = data?.signedUrl || '';
      }
      if (!url) throw new Error('No URL');
      setSignedUrl(url);
      if (content.type === 'pdf') {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch file');
        const rawBlob = await response.blob();
        const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(objectUrl);
      }
    } catch (err) {
      console.error('Error loading content:', err);
      setError('No se pudo cargar el archivo. Verifica que tengas acceso.');
      setSignedUrl(null);
      setBlobUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [content?.file_url, content?.type, isOpen]);

  useEffect(() => {
    if (isOpen && content?.file_url) {
      fetchSignedUrl();
    }
    if (!isOpen) {
      setSignedUrl(null);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setError(null);
    }
  }, [content?.file_url, isOpen]);

  if (!content) return null;

  const config = typeConfig[content.type] || typeConfig.pdf;
  const TypeIcon = config.icon;

  const renderPreview = () => {
    if (isLoading) return <PreviewLoading />;
    if (error || !signedUrl) return <PreviewError config={config} error={error} signedUrl={signedUrl} onRetry={fetchSignedUrl} />;
    return <PreviewContent content={content} signedUrl={signedUrl} blobUrl={blobUrl} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="max-w-[100vw] sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] h-full sm:h-auto overflow-y-auto p-0 rounded-none sm:rounded-lg border-0 sm:border gap-0"
      >
        {/* Sticky header with close button */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-3 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3 border-b border-border/40">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
              <TypeIcon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <DialogTitle className="text-sm sm:text-base font-semibold line-clamp-2 leading-snug">
                {content.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Vista previa de {config.label}: {content.title}
              </DialogDescription>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="capitalize text-[10px] sm:text-xs px-1.5 py-0">
                  {config.label}
                </Badge>
                {content.price != null && content.price > 0 && (
                  <Badge variant="outline" className="gap-0.5 text-[10px] sm:text-xs px-1.5 py-0">
                    <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    ${content.price} MXN
                  </Badge>
                )}
                {content.created_at && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {format(new Date(content.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                )}
              </div>
            </div>
            {/* Close button — visible, tappable */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 space-y-3 sm:space-y-4">
          {renderPreview()}

          {content.description && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{content.description}</p>
          )}

          {/* Doctor info */}
          {content.creator_name && (
            <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-muted/40 border border-border/30">
              <Avatar className="w-8 h-8 sm:w-9 sm:h-9">
                <AvatarImage src={content.creator_avatar || undefined} />
                <AvatarFallback><User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium truncate">{content.creator_name}</p>
                {content.creator_specialty && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{content.creator_specialty}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
