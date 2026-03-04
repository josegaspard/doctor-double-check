import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Video, Image as ImageIcon, Download, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ContentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    title: string;
    description?: string | null;
    type: 'video' | 'pdf' | 'image';
    file_url: string;
    thumbnail_url?: string | null;
    price?: number;
    audience_type?: string;
    created_at?: string;
  } | null;
}

export function ContentPreviewModal({ isOpen, onClose, content }: ContentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getSignedUrl = async () => {
      if (!content?.file_url || !isOpen) return;

      // Check if it's already a full URL (starts with http)
      if (content.file_url.startsWith('http')) {
        setSignedUrl(content.file_url);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: urlError } = await supabase.storage
          .from('doctor-content')
          .createSignedUrl(content.file_url, 60 * 60); // 1 hour

        if (urlError) throw urlError;
        setSignedUrl(data?.signedUrl || null);
      } catch (err) {
        console.error('Error getting signed URL:', err);
        setError('Error al cargar el archivo');
        setSignedUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    getSignedUrl();
  }, [content?.file_url, isOpen]);

  if (!content) return null;

  const getTypeIcon = () => {
    switch (content.type) {
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'pdf':
        return <FileText className="w-5 h-5" />;
      case 'image':
        return <ImageIcon className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (error || !signedUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-48 bg-muted rounded-lg">
          <FileText className="w-12 h-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{error || 'No se pudo cargar el archivo'}</p>
        </div>
      );
    }

    switch (content.type) {
      case 'image':
        return (
          <div className="relative w-full max-h-[60vh] overflow-hidden rounded-lg bg-muted select-none" onContextMenu={(e) => e.preventDefault()}>
            <img 
              src={signedUrl} 
              alt={content.title}
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
            <div className="absolute inset-0" />
          </div>
        );
      case 'video':
        return (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black max-w-full" onContextMenu={(e) => e.preventDefault()}>
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
      case 'pdf':
        return (
          <div className="relative w-full h-[60vh] rounded-lg overflow-hidden border" onContextMenu={(e) => e.preventDefault()}>
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full"
              title={content.title}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-48 bg-muted rounded-lg">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getTypeIcon()}
              <DialogTitle className="line-clamp-1">{content.title}</DialogTitle>
            </div>
            <Badge variant="secondary" className="capitalize">
              {content.type}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {renderPreview()}

          {content.description && (
            <p className="text-sm text-muted-foreground">{content.description}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => signedUrl && window.open(signedUrl, '_blank')}
              disabled={!signedUrl}
              className="flex-1 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en nueva pestaña
            </Button>
            <Button 
              variant="outline"
              disabled={!signedUrl}
              onClick={() => {
                if (!signedUrl) return;
                const a = document.createElement('a');
                a.href = signedUrl;
                a.download = content.title;
                a.click();
              }}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}