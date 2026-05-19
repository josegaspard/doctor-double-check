import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Paperclip, X, FileText, Loader2 } from 'lucide-react';
import { compressImageIfNeeded, withTimeout } from '@/lib/imageUpload';

interface ChatFileUploadProps {
  sessionId: string;
  onFileUploaded: (fileUrl: string, fileName: string, fileType: string) => void;
}

export interface ChatFileUploadRef {
  triggerUpload: () => void;
}

export const ChatFileUpload = forwardRef<ChatFileUploadRef, ChatFileUploadProps>(
  function ChatFileUpload({ sessionId, onFileUploaded }, ref) {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      triggerUpload: () => fileInputRef.current?.click(),
    }));

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo no puede superar 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Solo se permiten imágenes y PDFs');
        return;
      }

      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    };

    const uploadFile = async () => {
      if (!selectedFile || !user) return;

      setIsUploading(true);
      setUploadProgress(10);

      try {
        // Downscale large camera shots so the upload doesn't hang.
        const fileToUpload = await compressImageIfNeeded(selectedFile);

        const timestamp = Date.now();
        const ext = fileToUpload.name.split('.').pop();
        const path = `chat/${sessionId}/${user.id}/${timestamp}.${ext}`;

        setUploadProgress(30);

        const { error: uploadError } = await withTimeout(
          supabase.storage.from('documents').upload(path, fileToUpload, {
            cacheControl: '3600',
            upsert: false,
          }),
          60_000,
          'subida de archivo',
        );

        if (uploadError) throw uploadError;

        setUploadProgress(70);

        // Get signed URL
        // Short TTL: anti-piracy. URL embedded in message will expire — recipient
        // re-fetches a fresh signed URL on display (see ChatMessageBubble).
        const { data: signedUrlData } = await supabase.storage
          .from('documents')
          .createSignedUrl(path, 15 * 60); // 15 min

        setUploadProgress(100);

        if (signedUrlData?.signedUrl) {
          onFileUploaded(signedUrlData.signedUrl, selectedFile.name, selectedFile.type);
          toast.success('Archivo adjuntado');
        }

        // Reset
        setSelectedFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error(error.message || 'Error al subir archivo');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    };

    const clearSelection = () => {
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            {preview ? (
              <img src={preview} alt="Preview" className="w-10 h-10 rounded object-cover" />
            ) : (
              <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {isUploading ? (
              <div className="w-20">
                <Progress value={uploadProgress} className="h-1" />
              </div>
            ) : (
              <>
                <Button size="sm" onClick={uploadFile} disabled={isUploading}>
                  Enviar
                </Button>
                <Button size="icon" variant="ghost" onClick={clearSelection}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    );
  }
);
