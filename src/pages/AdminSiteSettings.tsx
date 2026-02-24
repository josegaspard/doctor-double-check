import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextLegalEditor } from '@/components/admin/RichTextLegalEditor';
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
  Mail,
  HardDrive,
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

interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  content: string;
}

interface StoragePricing {
  price_per_gb: number;
  plans: { gb: number; label: string; badge?: string }[];
}

export default function AdminSiteSettings() {
  const navigate = useNavigate();
  const { role, supabaseUser } = useAuth();
  const { language, t } = useLanguage();
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
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    email: 'contacto@medicalmasters.com',
    phone: '+52 55 1234 5678',
    address: 'Ciudad de México, México',
    content: '',
  });
  const [storagePricing, setStoragePricing] = useState<StoragePricing>({
    price_per_gb: 49,
    plans: [
      { gb: 1, label: '+1 GB' },
      { gb: 5, label: '+5 GB', badge: 'Popular' },
      { gb: 10, label: '+10 GB', badge: 'Mejor valor' },
    ],
  });

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

        // Fetch contact info
        const { data: contactData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'contact_info')
          .single();

        if (contactData?.value) {
          setContactInfo(contactData.value as unknown as ContactInfo);
        }

        // Fetch storage pricing
        const { data: storageData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'storage_pricing')
          .single();

        if (storageData?.value) {
          setStoragePricing(storageData.value as unknown as StoragePricing);
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

  const handleSaveContact = async () => {
    setIsSaving(true);
    try {
      // First try to update, if it fails (not exists), insert
      const { error: updateError } = await supabase
        .from('site_settings')
        .upsert({
          id: 'contact_info',
          value: contactInfo as unknown as Json,
          updated_by: supabaseUser?.id,
        });

      if (updateError) throw updateError;
      toast.success(language === 'es' ? 'Información de contacto actualizada' : 'Contact info updated');
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error(language === 'es' ? 'Error al guardar' : 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStoragePricing = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 'storage_pricing',
          value: storagePricing as unknown as Json,
          updated_by: supabaseUser?.id,
        });

      if (error) throw error;
      toast.success('Precios de almacenamiento actualizados');
    } catch (error) {
      console.error('Error saving storage pricing:', error);
      toast.error('Error al guardar');
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
              {t('admin.siteSettings')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('admin.socialDescription')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="social" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="social" className="gap-2 text-xs">
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.socialLinks')}</span>
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-2 text-xs">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.terms')}</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2 text-xs">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.privacy')}</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2 text-xs">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.contact')}</span>
              </TabsTrigger>
              <TabsTrigger value="storage" className="gap-2 text-xs">
                <HardDrive className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.storage')}</span>
              </TabsTrigger>
            </TabsList>

            {/* Social Links Tab */}
            <TabsContent value="social">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5" />
                    {t('admin.socialLinks')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('admin.socialDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="facebook" className="text-xs">Facebook</Label>
                        <Input
                          id="facebook"
                          placeholder="https://facebook.com/medicalmasters"
                          value={socialLinks.facebook}
                          onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                        <Instagram className="w-5 h-5 text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="instagram" className="text-xs">Instagram</Label>
                        <Input
                          id="instagram"
                          placeholder="https://instagram.com/medicalmasters"
                          value={socialLinks.instagram}
                          onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <Twitter className="w-5 h-5 text-sky-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="twitter" className="text-xs">Twitter / X</Label>
                        <Input
                          id="twitter"
                          placeholder="https://twitter.com/medicalmasters"
                          value={socialLinks.twitter}
                          onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-700/10 flex items-center justify-center">
                        <Linkedin className="w-5 h-5 text-blue-700" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="linkedin" className="text-xs">LinkedIn</Label>
                        <Input
                          id="linkedin"
                          placeholder="https://linkedin.com/company/medicalmasters"
                          value={socialLinks.linkedin}
                          onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <Youtube className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="youtube" className="text-xs">YouTube</Label>
                        <Input
                          id="youtube"
                          placeholder="https://youtube.com/@medicalmasters"
                          value={socialLinks.youtube}
                          onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                          className="text-sm"
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
                    {t('admin.saveSocial')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Terms of Service Tab */}
            <TabsContent value="terms">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5" />
                    {t('admin.terms')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('admin.termsDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RichTextLegalEditor
                    content={termsContent}
                    onChange={setTermsContent}
                    placeholder={t('admin.termsDescription')}
                  />
                  <Button onClick={handleSaveTerms} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('admin.saveTerms')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Policy Tab */}
            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5" />
                    {language === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {language === 'es' 
                      ? 'Edita el contenido de la página de política de privacidad' 
                      : 'Edit the privacy policy page content'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RichTextLegalEditor
                    content={privacyContent}
                    onChange={setPrivacyContent}
                    placeholder={t('admin.privacyDescription')}
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

            {/* Contact Tab */}
            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Mail className="w-5 h-5" />
                    {language === 'es' ? 'Información de Contacto' : 'Contact Information'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {language === 'es' 
                      ? 'Configura la información que aparece en la página de contacto' 
                      : 'Configure information shown on the contact page'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email" className="text-xs">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="contacto@medicalmasters.com"
                        value={contactInfo.email}
                        onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-phone" className="text-xs">
                        {language === 'es' ? 'Teléfono' : 'Phone'}
                      </Label>
                      <Input
                        id="contact-phone"
                        placeholder="+52 55 1234 5678"
                        value={contactInfo.phone}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-address" className="text-xs">
                        {language === 'es' ? 'Dirección' : 'Address'}
                      </Label>
                      <Input
                        id="contact-address"
                        placeholder="Ciudad de México, México"
                        value={contactInfo.address}
                        onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-content" className="text-xs">
                        {language === 'es' ? 'Contenido adicional' : 'Additional content'}
                      </Label>
                      <Textarea
                        id="contact-content"
                        placeholder={language === 'es' 
                          ? 'Horario de atención, información adicional...' 
                          : 'Business hours, additional information...'}
                        value={contactInfo.content}
                        onChange={(e) => setContactInfo({ ...contactInfo, content: e.target.value })}
                        className="min-h-[100px] text-sm"
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveContact} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {language === 'es' ? 'Guardar Contacto' : 'Save Contact'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Pricing Tab */}
            <TabsContent value="storage">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HardDrive className="w-5 h-5" />
                    Precios de Almacenamiento
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configura el precio por GB y los planes disponibles para los usuarios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="price-per-gb" className="text-xs">Precio por GB (MXN)</Label>
                    <Input
                      id="price-per-gb"
                      type="number"
                      min="1"
                      value={storagePricing.price_per_gb}
                      onChange={(e) => setStoragePricing({ ...storagePricing, price_per_gb: Number(e.target.value) })}
                      className="text-sm"
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-xs font-semibold">Planes disponibles</Label>
                    {storagePricing.plans.map((plan, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <Label className="text-xs">GB</Label>
                          <Input
                            type="number"
                            min="1"
                            value={plan.gb}
                            onChange={(e) => {
                              const plans = [...storagePricing.plans];
                              plans[idx] = { ...plans[idx], gb: Number(e.target.value) };
                              setStoragePricing({ ...storagePricing, plans });
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Etiqueta</Label>
                          <Input
                            value={plan.label}
                            onChange={(e) => {
                              const plans = [...storagePricing.plans];
                              plans[idx] = { ...plans[idx], label: e.target.value };
                              setStoragePricing({ ...storagePricing, plans });
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Badge</Label>
                          <Input
                            value={plan.badge || ''}
                            onChange={(e) => {
                              const plans = [...storagePricing.plans];
                              plans[idx] = { ...plans[idx], badge: e.target.value || undefined };
                              setStoragePricing({ ...storagePricing, plans });
                            }}
                            placeholder="Opcional"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Precio total por plan = GB × ${storagePricing.price_per_gb} MXN
                    </p>
                  </div>

                  <Button onClick={handleSaveStoragePricing} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Guardar Precios
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
