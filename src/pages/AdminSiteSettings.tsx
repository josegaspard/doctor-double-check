import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { type SiteToggles, saveSiteToggles } from '@/hooks/useSiteToggles';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  Plus,
  Trash2,
  Link2,
  ToggleLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface FooterLink {
  label: string;
  href: string;
}

interface FooterLinksData {
  platform: FooterLink[];
  resources: FooterLink[];
  legal: FooterLink[];
  copyright: string;
  show_status_badge: boolean;
}

export default function AdminSiteSettings() {
  const navigate = useNavigate();
  const { role, supabaseUser } = useAuth();
  const { t } = useLanguage();
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
  const [securityContent, setSecurityContent] = useState('');
  const [complianceContent, setComplianceContent] = useState('');
  const [arcoContent, setArcoContent] = useState('');
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
      { gb: 5, label: '+5 GB', badge: t('adminSiteSettingsPage.storage.defaultPopular') },
      { gb: 10, label: '+10 GB', badge: t('adminSiteSettingsPage.storage.defaultBestValue') },
    ],
  });
  const [footerLinks, setFooterLinks] = useState<FooterLinksData>({
    platform: [
      { label: t('adminSiteSettingsPage.footer.defaults.platform.doctors'), href: '/for-doctors' },
      { label: t('adminSiteSettingsPage.footer.defaults.platform.residents'), href: '/for-residents' },
      { label: t('adminSiteSettingsPage.footer.defaults.platform.patients'), href: '/for-patients' },
      { label: t('adminSiteSettingsPage.footer.defaults.platform.enterprise'), href: '/enterprise' },
    ],
    resources: [
      { label: t('adminSiteSettingsPage.footer.defaults.resources.successStories'), href: '/success-stories' },
      { label: t('adminSiteSettingsPage.footer.defaults.resources.help'), href: '/help' },
      { label: t('adminSiteSettingsPage.footer.defaults.resources.contact'), href: '/contact' },
    ],
    legal: [
      { label: t('adminSiteSettingsPage.footer.defaults.legal.privacy'), href: '/privacy' },
      { label: t('adminSiteSettingsPage.footer.defaults.legal.terms'), href: '/terms' },
      { label: t('adminSiteSettingsPage.footer.defaults.legal.security'), href: '/security' },
      { label: t('adminSiteSettingsPage.footer.defaults.legal.compliance'), href: '/compliance' },
      { label: t('adminSiteSettingsPage.footer.defaults.legal.report'), href: '/report-issue' },
    ],
    copyright: t('adminSiteSettingsPage.footer.defaults.copyright'),
    show_status_badge: true,
  });

  const [featureToggles, setFeatureToggles] = useState<SiteToggles>({
    show_news_section: false,
    show_content_medical: false,
    show_prescriptions: false,
    live_chat_free: true,
    show_transaction_history: false,
    app_background: 'image',
  });

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(t('adminSiteSettingsPage.accessDenied'));
    }
  }, [role, navigate, t]);

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

        // Páginas legales adicionales (Seguridad / Cumplimiento / ARCO)
        const { data: legalPages } = await supabase
          .from('site_settings')
          .select('id, value')
          .in('id', ['security_policy', 'compliance_policy', 'arco_policy']);
        for (const row of legalPages || []) {
          const c = ((row.value as unknown as LegalContent)?.content) || '';
          if (row.id === 'security_policy') setSecurityContent(c);
          if (row.id === 'compliance_policy') setComplianceContent(c);
          if (row.id === 'arco_policy') setArcoContent(c);
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

        // Fetch footer links
        const { data: footerData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'footer_links')
          .single();

        if (footerData?.value) {
          setFooterLinks({ ...footerLinks, ...(footerData.value as unknown as FooterLinksData) });
        }

        // Fetch feature toggles
        const { data: togglesData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'feature_toggles')
          .single();

        if (togglesData?.value) {
          setFeatureToggles(prev => ({ ...prev, ...(togglesData.value as unknown as SiteToggles) }));
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
      toast.success(t('adminSiteSettingsPage.social.updated'));
    } catch (error) {
      console.error('Error saving social links:', error);
      toast.error(t('adminSiteSettingsPage.social.saveError'));
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
      toast.success(t('adminSiteSettingsPage.terms.updated'));
    } catch (error) {
      console.error('Error saving terms:', error);
      toast.error(t('adminSiteSettingsPage.terms.saveError'));
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
      toast.success(t('adminSiteSettingsPage.privacy.updated'));
    } catch (error) {
      console.error('Error saving privacy:', error);
      toast.error(t('adminSiteSettingsPage.privacy.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  // Guarda una página legal opcional (Seguridad / Cumplimiento / ARCO).
  // Si queda vacía, la página pública muestra su contenido por defecto.
  const handleSaveLegalPage = async (id: string, content: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id,
          value: { content, lastUpdated: new Date().toISOString() },
          updated_by: supabaseUser?.id,
        });
      if (error) throw error;
      toast.success('Página actualizada');
    } catch (error) {
      console.error('Error saving legal page:', error);
      toast.error('Error al guardar la página');
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
      toast.success(t('adminSiteSettingsPage.contact.updated'));
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error(t('adminSiteSettingsPage.contact.saveError'));
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
      toast.success(t('adminSiteSettingsPage.storage.updated'));
    } catch (error) {
      console.error('Error saving storage pricing:', error);
      toast.error(t('adminSiteSettingsPage.storage.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFooterLinks = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 'footer_links',
          value: footerLinks as unknown as Json,
          updated_by: supabaseUser?.id,
        });

      if (error) throw error;
      toast.success(t('adminSiteSettingsPage.footer.updated'));
    } catch (error) {
      console.error('Error saving footer links:', error);
      toast.error(t('adminSiteSettingsPage.footer.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const updateFooterSection = (section: 'platform' | 'resources' | 'legal', index: number, field: 'label' | 'href', value: string) => {
    const updated = [...footerLinks[section]];
    updated[index] = { ...updated[index], [field]: value };
    setFooterLinks({ ...footerLinks, [section]: updated });
  };

  const addFooterLink = (section: 'platform' | 'resources' | 'legal') => {
    setFooterLinks({
      ...footerLinks,
      [section]: [...footerLinks[section], { label: '', href: '/' }],
    });
  };

  const removeFooterLink = (section: 'platform' | 'resources' | 'legal', index: number) => {
    setFooterLinks({
      ...footerLinks,
      [section]: footerLinks[section].filter((_, i) => i !== index),
    });
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
              {t('adminSiteSettingsPage.header.title')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('adminSiteSettingsPage.header.description')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="social" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="social" className="gap-2 text-xs">
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.social')}</span>
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-2 text-xs">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.terms')}</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2 text-xs">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.privacy')}</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2 text-xs">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.contact')}</span>
              </TabsTrigger>
              <TabsTrigger value="storage" className="gap-2 text-xs">
                <HardDrive className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.storage')}</span>
              </TabsTrigger>
              <TabsTrigger value="footer" className="gap-2 text-xs">
                <Link2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.footer')}</span>
              </TabsTrigger>
              <TabsTrigger value="toggles" className="gap-2 text-xs">
                <ToggleLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{t('adminSiteSettingsPage.tabs.toggles')}</span>
              </TabsTrigger>
              <TabsTrigger value="pages" className="gap-2 text-xs">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Páginas</span>
              </TabsTrigger>
            </TabsList>

            {/* Social Links Tab */}
            <TabsContent value="social">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5" />
                    {t('adminSiteSettingsPage.social.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.social.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-primary" />
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
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Instagram className="w-5 h-5 text-accent" />
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
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Twitter className="w-5 h-5 text-primary" />
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
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Linkedin className="w-5 h-5 text-primary" />
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
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Youtube className="w-5 h-5 text-destructive" />
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
                    {t('adminSiteSettingsPage.social.save')}
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
                    {t('adminSiteSettingsPage.terms.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.terms.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RichTextLegalEditor
                    content={termsContent}
                    onChange={setTermsContent}
                    placeholder={t('adminSiteSettingsPage.terms.description')}
                  />
                  <Button onClick={handleSaveTerms} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('adminSiteSettingsPage.terms.save')}
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
                    {t('adminSiteSettingsPage.privacy.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.privacy.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RichTextLegalEditor
                    content={privacyContent}
                    onChange={setPrivacyContent}
                    placeholder={t('adminSiteSettingsPage.privacy.placeholder')}
                  />
                  <Button onClick={handleSavePrivacy} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('adminSiteSettingsPage.privacy.save')}
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
                    {t('adminSiteSettingsPage.contact.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.contact.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email" className="text-xs">{t('adminSiteSettingsPage.contact.email')}</Label>
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
                        {t('adminSiteSettingsPage.contact.phone')}
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
                        {t('adminSiteSettingsPage.contact.address')}
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
                        {t('adminSiteSettingsPage.contact.additionalContent')}
                      </Label>
                      <Textarea
                        id="contact-content"
                        placeholder={t('adminSiteSettingsPage.contact.additionalContentPlaceholder')}
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
                    {t('adminSiteSettingsPage.contact.save')}
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
                    {t('adminSiteSettingsPage.storage.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.storage.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="price-per-gb" className="text-xs">{t('adminSiteSettingsPage.storage.pricePerGb')}</Label>
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
                    <Label className="text-xs font-semibold">{t('adminSiteSettingsPage.storage.availablePlans')}</Label>
                    {storagePricing.plans.map((plan, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                        <div>
                          <Label className="text-xs">{t('adminSiteSettingsPage.storage.gb')}</Label>
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
                          <Label className="text-xs">{t('adminSiteSettingsPage.storage.label')}</Label>
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
                          <Label className="text-xs">{t('adminSiteSettingsPage.storage.badge')}</Label>
                          <Input
                            value={plan.badge || ''}
                            onChange={(e) => {
                              const plans = [...storagePricing.plans];
                              plans[idx] = { ...plans[idx], badge: e.target.value || undefined };
                              setStoragePricing({ ...storagePricing, plans });
                            }}
                            placeholder={t('adminSiteSettingsPage.storage.badgePlaceholder')}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs opacity-0">X</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive w-full h-10"
                            onClick={() => {
                              const plans = storagePricing.plans.filter((_, i) => i !== idx);
                              setStoragePricing({ ...storagePricing, plans });
                            }}
                            disabled={storagePricing.plans.length <= 1}
                          >
                            {t('adminSiteSettingsPage.storage.remove')}
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const plans = [...storagePricing.plans, { gb: 1, label: '+1 GB' }];
                        setStoragePricing({ ...storagePricing, plans });
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-1" /> {t('adminSiteSettingsPage.storage.addPlan')}
                    </Button>
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-foreground">{t('adminSiteSettingsPage.storage.pricePreview')}</p>
                      {storagePricing.plans.map((plan, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {plan.label || `+${plan.gb} GB`}: <span className="font-semibold text-foreground">${plan.gb * storagePricing.price_per_gb} MXN</span>
                          {plan.badge && <Badge variant="secondary" className="ml-2 text-[10px]">{plan.badge}</Badge>}
                        </p>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleSaveStoragePricing} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('adminSiteSettingsPage.storage.save')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Footer Tab */}
            <TabsContent value="footer">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Link2 className="w-5 h-5" />
                    {t('adminSiteSettingsPage.footer.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.footer.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Copyright */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('adminSiteSettingsPage.footer.copyrightLabel')}</Label>
                    <Input
                      value={footerLinks.copyright}
                      onChange={(e) => setFooterLinks({ ...footerLinks, copyright: e.target.value })}
                      className="text-sm"
                    />
                  </div>

                  {/* Status badge toggle */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label className="text-xs font-semibold">{t('adminSiteSettingsPage.footer.statusBadgeLabel')}</Label>
                      <p className="text-[11px] text-muted-foreground">{t('adminSiteSettingsPage.footer.statusBadgeDescription')}</p>
                    </div>
                    <Switch
                      checked={footerLinks.show_status_badge}
                      onCheckedChange={(v) => setFooterLinks({ ...footerLinks, show_status_badge: v })}
                    />
                  </div>

                  <Separator />

                  {/* Link sections */}
                  {(['platform', 'resources', 'legal'] as const).map((section) => (
                    <div key={section} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold capitalize">
                          {section === 'platform'
                            ? t('adminSiteSettingsPage.footer.sectionPlatform')
                            : section === 'resources'
                              ? t('adminSiteSettingsPage.footer.sectionResources')
                              : t('adminSiteSettingsPage.footer.sectionLegal')}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addFooterLink(section)}
                          className="h-7 gap-1 text-xs"
                        >
                          <Plus className="w-3 h-3" /> {t('adminSiteSettingsPage.footer.add')}
                        </Button>
                      </div>
                      {footerLinks[section].map((link, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('adminSiteSettingsPage.footer.linkLabel')}</Label>
                            <Input
                              value={link.label}
                              onChange={(e) => updateFooterSection(section, idx, 'label', e.target.value)}
                              className="text-sm h-9"
                              placeholder={t('adminSiteSettingsPage.footer.linkLabelPlaceholder')}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('adminSiteSettingsPage.footer.linkHref')}</Label>
                            <Input
                              value={link.href}
                              onChange={(e) => updateFooterSection(section, idx, 'href', e.target.value)}
                              className="text-sm h-9"
                              placeholder={t('adminSiteSettingsPage.footer.linkHrefPlaceholder')}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive"
                            onClick={() => removeFooterLink(section, idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}

                  <Button onClick={handleSaveFooterLinks} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('adminSiteSettingsPage.footer.save')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Feature Toggles Tab */}
            <TabsContent value="toggles">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ToggleLeft className="w-5 h-5" />
                    {t('adminSiteSettingsPage.toggles.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('adminSiteSettingsPage.toggles.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Background mode — special control */}
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                    <div>
                      <p className="font-medium text-sm">{t('adminSiteSettingsPage.toggles.backgroundTitle')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('adminSiteSettingsPage.toggles.backgroundDescription')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-card">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${featureToggles.app_background === 'white' ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {t('adminSiteSettingsPage.toggles.backgroundWhite')}
                        </span>
                        <Switch
                          checked={featureToggles.app_background === 'image'}
                          onCheckedChange={(checked) =>
                            setFeatureToggles(prev => ({ ...prev, app_background: checked ? 'image' : 'white' }))
                          }
                        />
                        <span className={`text-xs font-medium ${featureToggles.app_background === 'image' ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {t('adminSiteSettingsPage.toggles.backgroundImage')}
                        </span>
                      </div>
                      <Badge variant={featureToggles.app_background === 'image' ? 'default' : 'secondary'} className="text-[10px]">
                        {featureToggles.app_background === 'image' ? t('adminSiteSettingsPage.toggles.backgroundImageActive') : t('adminSiteSettingsPage.toggles.backgroundWhiteActive')}
                      </Badge>
                    </div>
                  </div>

                  {[
                    { key: 'show_news_section' as const, label: t('adminSiteSettingsPage.toggles.items.newsSection.label'), desc: t('adminSiteSettingsPage.toggles.items.newsSection.desc') },
                    { key: 'show_content_medical' as const, label: t('adminSiteSettingsPage.toggles.items.contentMedical.label'), desc: t('adminSiteSettingsPage.toggles.items.contentMedical.desc') },
                    { key: 'show_prescriptions' as const, label: t('adminSiteSettingsPage.toggles.items.prescriptions.label'), desc: t('adminSiteSettingsPage.toggles.items.prescriptions.desc') },
                    { key: 'live_chat_free' as const, label: t('adminSiteSettingsPage.toggles.items.liveChatFree.label'), desc: t('adminSiteSettingsPage.toggles.items.liveChatFree.desc') },
                    { key: 'show_transaction_history' as const, label: t('adminSiteSettingsPage.toggles.items.transactionHistory.label'), desc: t('adminSiteSettingsPage.toggles.items.transactionHistory.desc') },
                  ].map((toggle) => (
                    <div key={toggle.key} className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div>
                        <p className="font-medium text-sm">{toggle.label}</p>
                        <p className="text-xs text-muted-foreground">{toggle.desc}</p>
                      </div>
                      <Switch
                        checked={featureToggles[toggle.key] as boolean}
                        onCheckedChange={(checked) =>
                          setFeatureToggles(prev => ({ ...prev, [toggle.key]: checked }))
                        }
                      />
                    </div>
                  ))}

                  <Button
                    onClick={async () => {
                      setIsSaving(true);
                      const { error } = await saveSiteToggles(featureToggles, supabaseUser?.id);
                      setIsSaving(false);
                      if (error) {
                        toast.error(t('adminSiteSettingsPage.toggles.saveError'));
                      } else {
                        toast.success(t('adminSiteSettingsPage.toggles.updated'));
                      }
                    }}
                    disabled={isSaving}
                    className="w-full"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {t('adminSiteSettingsPage.toggles.save')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Legal pages: Seguridad / Cumplimiento / ARCO */}
            <TabsContent value="pages">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5" />
                    Páginas del footer
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Contenido de Seguridad, Cumplimiento y Derechos ARCO. Si dejas una sección
                    vacía, la página pública muestra su contenido por defecto.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Seguridad</h3>
                    <RichTextLegalEditor
                      content={securityContent}
                      onChange={setSecurityContent}
                      placeholder="Contenido de la página de Seguridad…"
                    />
                    <Button onClick={() => handleSaveLegalPage('security_policy', securityContent)} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar Seguridad
                    </Button>
                  </div>
                  <div className="space-y-3 border-t pt-6">
                    <h3 className="font-semibold text-sm">Cumplimiento</h3>
                    <RichTextLegalEditor
                      content={complianceContent}
                      onChange={setComplianceContent}
                      placeholder="Contenido de la página de Cumplimiento…"
                    />
                    <Button onClick={() => handleSaveLegalPage('compliance_policy', complianceContent)} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar Cumplimiento
                    </Button>
                  </div>
                  <div className="space-y-3 border-t pt-6">
                    <h3 className="font-semibold text-sm">Derechos ARCO</h3>
                    <RichTextLegalEditor
                      content={arcoContent}
                      onChange={setArcoContent}
                      placeholder="Contenido de la página de Derechos ARCO…"
                    />
                    <Button onClick={() => handleSaveLegalPage('arco_policy', arcoContent)} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar ARCO
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
