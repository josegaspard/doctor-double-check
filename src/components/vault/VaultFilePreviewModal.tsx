import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Image, Download, ExternalLink, X, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VaultFilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewOnly?: boolean; // When true, hides download/open buttons (doctor OTP access)
  file: {
    id: string;
    name: string;
    type: 'pdf' | 'image' | 'study';
    category: string;
    size: number;
    fileUrl: string;
    description?: string;
    uploadedAt: Date;
    patientName?: string;
  } | null;
}

export function VaultFilePreviewModal({ isOpen, onClose, file, viewOnly = false }: VaultFilePreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && file) {
      generateSignedUrl();
    } else {
      setSignedUrl(null);
      setError(null);
    }
  }, [isOpen, file?.id]);

  const generateSignedUrl = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Extract file path from the stored URL or use directly if it's a path
      let filePath = file.fileUrl;
      
      // If it's a signed URL, extract the path
      if (filePath.includes('/vault-files/')) {
        const match = filePath.match(/vault-files\/([^?]+)/);
        if (match) {
          filePath = match[1];
        }
      }

      // Generate a fresh signed URL
      const { data, error: urlError } = await supabase.storage
        .from('vault-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiration

      if (urlError) {
        // If path extraction failed, try using the original URL directly
        setSignedUrl(file.fileUrl);
      } else {
        setSignedUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error generating signed URL:', err);
      // Fallback to original URL
      setSignedUrl(file.fileUrl);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (type: string) => {
    if (type === 'image') return <Image className="w-5 h-5 text-info" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon(file.type)}
              <div>
                <DialogTitle className="text-lg">{file.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Badge variant="outline">{file.category}</Badge>
                  <span>•</span>
                  <span>{formatSize(file.size)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* File Info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground py-2 border-b border-border">
          {file.patientName && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{file.patientName}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(file.uploadedAt).toLocaleDateString('es-MX')}</span>
          </div>
        </div>

        {file.description && (
          <p className="text-sm text-muted-foreground py-2">{file.description}</p>
        )}

        {/* Preview Area */}
        <div className="flex-1 overflow-auto min-h-[300px] bg-muted/30 rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Skeleton className="w-full h-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <p className="text-destructive text-center">{error}</p>
              <Button onClick={generateSignedUrl}>Reintentar</Button>
            </div>
          ) : signedUrl ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              {file.type === 'image' ? (
                <img
                  src={signedUrl}
                  alt={file.name}
                  className="max-w-full max-h-[500px] object-contain rounded-lg"
                />
              ) : file.type === 'pdf' ? (
                <iframe
                  src={signedUrl}
                  className="w-full h-[500px] rounded-lg border"
                  title={file.name}
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Vista previa no disponible para este tipo de archivo
                  </p>
                  <Button asChild>
                    <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir en nueva pestaña
                    </a>
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 flex-shrink-0">
          {signedUrl && !viewOnly && (
            <>
              <Button variant="outline" asChild>
                <a href={signedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={signedUrl} download={file.name}>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </a>
              </Button>
            </>
          )}
          {viewOnly && (
            <p className="text-xs text-muted-foreground mr-auto flex items-center gap-1">
              🔒 Solo lectura — acceso temporal por OTP
            </p>
          )}
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
