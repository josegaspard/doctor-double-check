import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Video, Image as ImageIcon, Download, ExternalLink, X } from 'lucide-react';

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
    switch (content.type) {
      case 'image':
        return (
          <div className="relative w-full max-h-[60vh] overflow-hidden rounded-lg bg-muted">
            <img 
              src={content.file_url} 
              alt={content.title}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
          </div>
        );
      case 'video':
        return (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
            <video 
              src={content.file_url}
              controls
              className="w-full h-full"
              poster={content.thumbnail_url || undefined}
            >
              Tu navegador no soporta videos HTML5.
            </video>
          </div>
        );
      case 'pdf':
        return (
          <div className="relative w-full h-[60vh] rounded-lg overflow-hidden border">
            <iframe
              src={`${content.file_url}#toolbar=0`}
              className="w-full h-full"
              title={content.title}
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
              onClick={() => window.open(content.file_url, '_blank')}
              className="flex-1 gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en nueva pestaña
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const a = document.createElement('a');
                a.href = content.file_url;
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
