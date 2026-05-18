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
import { FileText, Image, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SecurePDFViewer } from '@/components/security/SecurePDFViewer';
import { SecureImage } from '@/components/security/SecureImage';

interface VaultFilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewOnly?: boolean;
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
    patientId?: string;
  } | null;
}

export function VaultFilePreviewModal({ isOpen, onClose, file, viewOnly = false }: VaultFilePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && file) {
      loadFileAsBlob();
    } else {
      setBlobUrl(null);
      setError(null);
    }
  }, [isOpen, file?.id]);

  const loadFileAsBlob = async () => {
    if (!file) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Extract file path from the stored URL
      let filePath = file.fileUrl;
      if (filePath.includes('/vault-files/')) {
        const match = filePath.match(/vault-files\/([^?]+)/);
        if (match) filePath = match[1];
      }

      // Short-TTL signed URL: anti-piracy. SecurePDFViewer / SecureImage
      // fetch the file and render through canvas — original URL never reaches DOM.
      const { data, error: urlError } = await supabase.storage
        .from('vault-files')
        .createSignedUrl(filePath, 600); // 10 min

      const signedUrl = urlError ? file.fileUrl : data.signedUrl;
      setBlobUrl(signedUrl);

      // Audit: registrar acceso real al archivo
      if (file.patientId) {
        supabase.rpc('log_vault_action', {
          p_file_id: file.id,
          p_patient_id: file.patientId,
          p_action: 'accessed',
          p_metadata: {
            source: viewOnly ? 'otp_preview' : 'vault_preview',
            file_type: file.type,
          },
        }).then(({ error: logError }) => {
          if (logError) console.warn('[VaultAudit] log accessed failed', logError);
        });
      }
    } catch (err) {
      console.error('Error loading file:', err);
      setError('No se pudo cargar el archivo');

      // Audit: registrar denegación de acceso
      if (file.patientId) {
        supabase.rpc('log_vault_action', {
          p_file_id: file.id,
          p_patient_id: file.patientId,
          p_action: 'access_denied',
          p_metadata: {
            source: viewOnly ? 'otp_preview' : 'vault_preview',
            error: String((err as any)?.message || err).slice(0, 200),
          },
        }).then(({ error: logError }) => {
          if (logError) console.warn('[VaultAudit] log denied failed', logError);
        });
      }
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
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onContextMenu={(e) => e.preventDefault()}
      >
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

        {/* Preview Area — protected */}
        <div
          className="flex-1 overflow-auto min-h-[300px] bg-muted/30 rounded-lg"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Skeleton className="w-full h-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <p className="text-destructive text-center">{error}</p>
              <Button onClick={loadFileAsBlob}>Reintentar</Button>
            </div>
          ) : blobUrl ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              {file.type === 'image' ? (
                <SecureImage
                  signedUrl={blobUrl}
                  alt={file.name}
                  fileId={file.id}
                  bucket="vault-files"
                  maxHeight="500px"
                />
              ) : file.type === 'pdf' ? (
                <SecurePDFViewer
                  signedUrl={blobUrl}
                  fileName={file.name}
                  fileId={file.id}
                  bucket="vault-files"
                  className="w-full"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Vista previa no disponible para este tipo de archivo
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions — no download/open buttons */}
        <div className="flex justify-end gap-2 pt-4 flex-shrink-0">
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
