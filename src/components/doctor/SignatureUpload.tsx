import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Trash2, Loader2, PenLine, Image as ImageIcon } from 'lucide-react';

export function SignatureUpload() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch + re-sign current signature on mount (signed URLs caducan al año o si la firma rota)
  const refreshSignatureUrl = React.useCallback(async () => {
    if (!user?.id) return;
    const { data: prof } = await supabase
      .from('doctor_profiles')
      .select('signature_url')
      .eq('user_id', user.id)
      .single();
    const current = (prof as any)?.signature_url as string | null;
    if (!current) { setSignatureUrl(null); return; }
    // Si el URL guardado es signed y vence, re-firmarlo a partir del path
    const m = current.match(/\/documents\/(signatures\/[^?]+)/);
    if (m && m[1]) {
      const { data: signed, error: signErr } = await supabase.storage.from('documents').createSignedUrl(m[1], 60 * 60 * 24 * 365);
      if (signErr) {
        // El archivo puede no existir ya. Limpia el campo.
        await supabase.from('doctor_profiles').update({ signature_url: null }).eq('user_id', user.id);
        setSignatureUrl(null);
        return;
      }
      const fresh = signed?.signedUrl;
      if (fresh && fresh !== current) {
        await supabase.from('doctor_profiles').update({ signature_url: fresh }).eq('user_id', user.id);
      }
      setSignatureUrl(fresh || current);
    } else {
      setSignatureUrl(current);
    }
  }, [user?.id]);

  React.useEffect(() => { void refreshSignatureUrl(); }, [refreshSignatureUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('signatureUpload.errorOnlyImages'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('signatureUpload.errorMaxSize'));
      return;
    }

    setIsUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `signatures/${user.id}/signature.${ext}`;

      // Limpia variantes previas con otra extensión para que solo exista una firma
      try {
        await supabase.storage.from('documents').remove([
          `signatures/${user.id}/signature.png`,
          `signatures/${user.id}/signature.jpg`,
          `signatures/${user.id}/signature.jpeg`,
          `signatures/${user.id}/signature.webp`,
        ].filter(p => p !== path));
      } catch {/* ignore */}

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signedErr } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedErr) throw signedErr;
      const signatureUrl2 = signedData?.signedUrl;
      if (!signatureUrl2) throw new Error(t('signatureUpload.errorSignUrl'));

      const { error: updateError } = await supabase
        .from('doctor_profiles')
        .update({ signature_url: signatureUrl2 })
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      setSignatureUrl(signatureUrl2);
      toast.success(t('signatureUpload.successUpdated'));
    } catch (err: any) {
      console.error('signature upload error', err);
      toast.error(err.message || t('signatureUpload.errorUpload'));
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;
    setIsUploading(true);
    try {
      // Borra todos los archivos físicos posibles del usuario
      try {
        await supabase.storage.from('documents').remove([
          `signatures/${user.id}/signature.png`,
          `signatures/${user.id}/signature.jpg`,
          `signatures/${user.id}/signature.jpeg`,
          `signatures/${user.id}/signature.webp`,
        ]);
      } catch {/* ignore */}

      await supabase
        .from('doctor_profiles')
        .update({ signature_url: null })
        .eq('user_id', user.id);
      setSignatureUrl(null);
      toast.success(t('signatureUpload.successRemoved'));
    } catch (err: any) {
      toast.error(err.message || t('signatureUpload.errorGeneric'));
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="w-4 h-4 text-primary" />
          {t('signatureUpload.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t('signatureUpload.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {signatureUrl ? (
          <div className="space-y-3">
            <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
              <img
                src={signatureUrl}
                alt={t('signatureUpload.imageAlt')}
                className="max-h-24 w-auto object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {t('signatureUpload.change')}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={isUploading}
              >
                <Trash2 className="w-3 h-3" />
                {t('signatureUpload.remove')}
              </Button>
            </div>
          </div>
        ) : (
          <div 
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('signatureUpload.uploadPrompt')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t('signatureUpload.fileHint')}</p>
          </div>
        )}
        <input 
          ref={fileRef} 
          type="file" 
          accept=".png,.jpg,.jpeg" 
          className="hidden" 
          onChange={handleUpload}
        />
      </CardContent>
    </Card>
  );
}
