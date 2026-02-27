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
  const { language } = useLanguage();
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch current signature on mount
  React.useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('doctor_profiles')
      .select('signature_url')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if ((data as any)?.signature_url) {
          setSignatureUrl((data as any).signature_url);
        }
      });
  }, [user?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'es' ? 'Solo se permiten imágenes (PNG, JPG)' : 'Only images allowed (PNG, JPG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'es' ? 'La imagen no debe superar 2MB' : 'Image must be under 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `signatures/${user.id}/signature.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      // Generate a public-like URL for the signature (documents bucket is private, use signed URL)
      const { data: signedData } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
      const signatureUrl2 = signedData?.signedUrl;

      const { error: updateError } = await supabase
        .from('doctor_profiles')
        .update({ signature_url: signatureUrl2 })
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      setSignatureUrl(signatureUrl2 || null);
      toast.success(language === 'es' ? 'Firma actualizada' : 'Signature updated');
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;
    setIsUploading(true);
    try {
      await supabase
        .from('doctor_profiles')
        .update({ signature_url: null })
        .eq('user_id', user.id);
      setSignatureUrl(null);
      toast.success(language === 'es' ? 'Firma eliminada' : 'Signature removed');
    } catch {
      toast.error('Error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="w-4 h-4 text-primary" />
          {language === 'es' ? 'Firma / Sello Digital' : 'Digital Signature / Stamp'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {language === 'es' 
            ? 'Sube una imagen PNG o JPG de tu firma o sello. Se incluirá en las recetas que generes.'
            : 'Upload a PNG or JPG image of your signature or stamp. It will be included in prescriptions you generate.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {signatureUrl ? (
          <div className="space-y-3">
            <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
              <img 
                src={signatureUrl} 
                alt="Firma" 
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
                {language === 'es' ? 'Cambiar' : 'Change'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={isUploading}
              >
                <Trash2 className="w-3 h-3" />
                {language === 'es' ? 'Eliminar' : 'Remove'}
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
              {language === 'es' ? 'Haz clic para subir tu firma o sello' : 'Click to upload your signature or stamp'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG — máx 2MB</p>
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
