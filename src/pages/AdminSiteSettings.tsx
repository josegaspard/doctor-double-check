import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Settings,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  FileText,
  Shield,
  Loader2,
  Save,
} from 'lucide-react';

interface SocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
}

interface LegalContent {
  content: string;
  lastUpdated: string | null;
}

export default function AdminSiteSettings() {
  const navigate = useNavigate();
  const { role, supabaseUser } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    facebook: '',
    instagram: '',
    twitter: '',
    linkedin: '',
    youtube: '',
  });

  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (role !== 'admin') return;

      try {
        // Fetch social links
        const { data: socialData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'social_links')
          .single();

        if (socialData?.value) {
          setSocialLinks(socialData.value as unknown as SocialLinks);
        }

        // Fetch terms of service
        const { data: termsData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'terms_of_service')
          .single();

        if (termsData?.value) {
          const terms = termsData.value as unknown as LegalContent;
          setTermsContent(terms.content || '');
        }

        // Fetch privacy policy
        const { data: privacyData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'privacy_policy')
          .single();

        if (privacyData?.value) {
          const privacy = privacyData.value as unknown as LegalContent;
          setPrivacyContent(privacy.content || '');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [role]);

  const handleSaveSocialLinks = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          value: socialLinks as unknown as Json,
          updated_by: supabaseUser?.id,
        })
        .eq('id', 'social_links');

      if (error) throw error;
      toast.success(language === 'es' ? 'Redes sociales actualizadas' : 'Social links updated');
    } catch (error) {
      console.error('Error saving social links:', error);
      toast.error(language === 'es' ? 'Error al guardar' : 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTerms = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          value: {
            content: termsContent,
            lastUpdated: new Date().toISOString(),
          },
          updated_by: supabaseUser?.id,
        })
        .eq('id', 'terms_of_service');

      if (error) throw error;
      toast.success(language === 'es' ? 'Términos de servicio actualizados' : 'Terms of service updated');
    } catch (error) {
      console.error('Error saving terms:', error);
      toast.error(language === 'es' ? 'Error al guardar' : 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .update({
          value: {
            content: privacyContent,
            lastUpdated: new Date().toISOString(),
          },
          updated_by: supabaseUser?.id,
        })
        .eq('id', 'privacy_policy');

      if (error) throw error;
      toast.success(language === 'es' ? 'Política de privacidad actualizada' : 'Privacy policy updated');
    } catch (error) {
      console.error('Error saving privacy:', error);
      toast.error(language === 'es' ? 'Error al guardar' : 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings className="w-6 h-6 text-primary" />
              {language === 'es' ? 'Configuración del Sitio' : 'Site Settings'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' 
                ? 'Administra redes sociales, términos y privacidad' 
                : 'Manage social links, terms and privacy'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="social" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="social" className="gap-2">
                <Globe className="w-4 h-4" />
                {language === 'es' ? 'Redes Sociales' : 'Social'}
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-2">
                <FileText className="w-4 h-4" />
                {language === 'es' ? 'Términos' : 'Terms'}
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2">
                <Shield className="w-4 h-4" />
                {language === 'es' ? 'Privacidad' : 'Privacy'}
              </TabsTrigger>
            </TabsList>

            {/* Social Links Tab */}
            <TabsContent value="social">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    {language === 'es' ? 'Redes Sociales' : 'Social Media Links'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'es' 
                      ? 'Configura los enlaces de redes sociales que aparecen en el footer' 
                      : 'Configure social media links shown in the footer'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="facebook">Facebook</Label>
                        <Input
                          id="facebook"
                          placeholder="https://facebook.com/medicalmasters"
                          value={socialLinks.facebook}
                          onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                        <Instagram className="w-5 h-5 text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="instagram">Instagram</Label>
                        <Input
                          id="instagram"
                          placeholder="https://instagram.com/medicalmasters"
                          value={socialLinks.instagram}
                          onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <Twitter className="w-5 h-5 text-sky-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="twitter">Twitter / X</Label>
                        <Input
                          id="twitter"
                          placeholder="https://twitter.com/medicalmasters"
                          value={socialLinks.twitter}
                          onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-700/10 flex items-center justify-center">
                        <Linkedin className="w-5 h-5 text-blue-700" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="linkedin">LinkedIn</Label>
                        <Input
                          id="linkedin"
                          placeholder="https://linkedin.com/company/medicalmasters"
                          value={socialLinks.linkedin}
                          onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Youtube className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="youtube">YouTube</Label>
                        <Input
                          id="youtube"
                          placeholder="https://youtube.com/@medicalmasters"
                          value={socialLinks.youtube}
                          onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveSocialLinks} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {language === 'es' ? 'Guardar Redes Sociales' : 'Save Social Links'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Terms of Service Tab */}
            <TabsContent value="terms">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {language === 'es' ? 'Términos de Servicio' : 'Terms of Service'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'es' 
                      ? 'Edita el contenido de la página de términos de servicio (soporta Markdown)' 
                      : 'Edit the terms of service page content (supports Markdown)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder={language === 'es' 
                      ? 'Escribe los términos de servicio aquí...' 
                      : 'Write terms of service here...'}
                    value={termsContent}
                    onChange={(e) => setTermsContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                  <Button onClick={handleSaveTerms} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {language === 'es' ? 'Guardar Términos' : 'Save Terms'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Policy Tab */}
            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'es' 
                      ? 'Edita el contenido de la página de política de privacidad (soporta Markdown)' 
                      : 'Edit the privacy policy page content (supports Markdown)'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder={language === 'es' 
                      ? 'Escribe la política de privacidad aquí...' 
                      : 'Write privacy policy here...'}
                    value={privacyContent}
                    onChange={(e) => setPrivacyContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                  <Button onClick={handleSavePrivacy} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {language === 'es' ? 'Guardar Privacidad' : 'Save Privacy'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
