import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { type SiteToggles, saveSiteToggles } from '@/hooks/useSiteToggles';
import { type LandingStats, LANDING_STATS_DEFAULTS } from '@/hooks/useLandingStats';
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
  CreditCard,
  BarChart3,
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

interface SubscriptionPricing {
  basic_cents: number;
  premium_cents: number;
  resident_discount_pct: number;
  premium_recording_discount_pct: number;
}

interface AppConfigSettings {
  currency: string;
  wallet_min: number;
  wallet_max: number;
  ad_min: number;
  ad_max: number;
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
  const [subscriptionPricing, setSubscriptionPricing] = useState<SubscriptionPricing>({
    basic_cents: 9900,
    premium_cents: 19900,
    resident_discount_pct: 50,
    premium_recording_discount_pct: 20,
  });
  const [landingStats, setLandingStats] = useState<LandingStats>(LANDING_STATS_DEFAULTS);
  const [appConfig, setAppConfig] = useState<AppConfigSettings>({
    currency: 'mxn', wallet_min: 50, wallet_max: 999999, ad_min: 100, ad_max: 1000000,
  });
  const [extraSpecialties, setExtraSpecialties] = useState<string[]>([]);
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
    enable_patient_chat: false,
    enable_prescriptions: false,
    enable_video_calls: false,
    enable_marketplace: true,
    enable_lives: true,
    enable_events: true,
    enable_vault: true,
    enable_recordings: true,
    enable_ads: true,
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

        // Fetch subscription pricing
        const { data: subPricingData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'subscription_pricing')
          .maybeSingle();

        if (subPricingData?.value) {
          setSubscriptionPricing(prev => ({ ...prev, ...(subPricingData.value as unknown as SubscriptionPricing) }));
        }

        // Fetch landing stats
        const { data: landingStatsData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'landing_stats')
          .maybeSingle();

        if (landingStatsData?.value) {
          setLandingStats(prev => ({ ...prev, ...(landingStatsData.value as unknown as LandingStats) }));
        }

        // Fetch app config (limits + currency)
        const { data: appConfigData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'app_config')
          .maybeSingle();

        if (appConfigData?.value) {
          setAppConfig(prev => ({ ...prev, ...(appConfigData.value as unknown as AppConfigSettings) }));
        }

        // Fetch extra specialties
        const { data: extraSpecData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'extra_specialties')
          .maybeSingle();

        if (Array.isArray(extraSpecData?.value)) {
          setExtraSpecialties((extraSpecData!.value as unknown[]).filter((x): x is string => typeof x === 'string'));
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

  const handleSaveSubscriptionPricing = async () => {
    setIsSaving(true);
    try {
      const clean: SubscriptionPricing = {
        basic_cents: Math.max(0, Math.round(Number(subscriptionPricing.basic_cents) || 0)),
        premium_cents: Math.max(0, Math.round(Number(subscriptionPricing.premium_cents) || 0)),
        resident_discount_pct: Math.min(100, Math.max(0, Number(subscriptionPricing.resident_discount_pct) || 0)),
        premium_recording_discount_pct: Math.min(100, Math.max(0, Number(subscriptionPricing.premium_recording_discount_pct) || 0)),
      };
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 'subscription_pricing',
          value: clean as unknown as Json,
          updated_by: supabaseUser?.id,
        });

      if (error) throw error;
      setSubscriptionPricing(clean);
      toast.success('Precios de suscripción actualizados');
    } catch (error) {
      console.error('Error saving subscription pricing:', error);
      toast.error('No se pudieron guardar los precios de suscripción');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLandingStats = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 'landing_stats',
          value: landingStats as unknown as Json,
          updated_by: supabaseUser?.id,
        });

      if (error) throw error;
      toast.success('Estadísticas del sitio actualizadas');
    } catch (error) {
      console.error('Error saving landing stats:', error);
      toast.error('No se pudieron guardar las estadísticas');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAppConfig = async () => {
    setIsSaving(true);
    try {
      const clean: AppConfigSettings = {
        currency: (appConfig.currency || 'mxn').toLowerCase().slice(0, 3),
        wallet_min: Math.max(0, Number(appConfig.wallet_min) || 0),
        wallet_max: Math.max(0, Number(appConfig.wallet_max) || 0),
        ad_min: Math.max(0, Number(appConfig.ad_min) || 0),
        ad_max: Math.max(0, Number(appConfig.ad_max) || 0),
      };
      const { error } = await supabase
        .from('site_settings')
        .upsert({ id: 'app_config', value: clean as unknown as Json, updated_by: supabaseUser?.id });
      if (error) throw error;
      setAppConfig(clean);
      toast.success('Configuración general actualizada');
    } catch (error) {
      console.error('Error saving app config:', error);
      toast.error('No se pudo guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExtraSpecialties = async () => {
    setIsSaving(true);
    try {
      const clean = extraSpecialties.map(s => s.trim()).filter(Boolean);
      const { error } = await supabase
        .from('site_settings')
        .upsert({ id: 'extra_specialties', value: clean as unknown as Json, updated_by: supabaseUser?.id });
      if (error) throw error;
      setExtraSpecialties(clean);
      toast.success('Especialidades actualizadas');
    } catch (error) {
      console.error('Error saving extra specialties:', error);
      toast.error('No se pudieron guardar las especialidades');
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
          <Button variant="back" size="icon" onClick={() => navigate('/admin')}>
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
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="w-5 h-5" />
                    Precios de suscripción y descuentos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Controla el precio mensual de las suscripciones a creadores y los descuentos. Aplica de inmediato a nuevos cobros (con respaldo a $99/$199 si se deja vacío).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Suscripción Básica (MXN/mes)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={subscriptionPricing.basic_cents / 100}
                        onChange={(e) => setSubscriptionPricing({ ...subscriptionPricing, basic_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Suscripción Premium (MXN/mes)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={subscriptionPricing.premium_cents / 100}
                        onChange={(e) => setSubscriptionPricing({ ...subscriptionPricing, premium_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descuento residente (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={subscriptionPricing.resident_discount_pct}
                        onChange={(e) => setSubscriptionPricing({ ...subscriptionPricing, resident_discount_pct: Number(e.target.value) || 0 })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descuento Premium en grabaciones (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={subscriptionPricing.premium_recording_discount_pct}
                        onChange={(e) => setSubscriptionPricing({ ...subscriptionPricing, premium_recording_discount_pct: Number(e.target.value) || 0 })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveSubscriptionPricing} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Guardar precios de suscripción
                  </Button>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-5 h-5" />
                    Estadísticas del sitio (Casos de éxito / Empresas)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cifras mostradas en las páginas de Casos de Éxito y Empresas. Edítalas para que reflejen datos reales y verificables.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { k: 'active_doctors' as const, label: 'Doctores activos' },
                      { k: 'patients_served' as const, label: 'Pacientes atendidos' },
                      { k: 'satisfaction' as const, label: 'Satisfacción' },
                      { k: 'availability' as const, label: 'Disponibilidad' },
                      { k: 'enterprise_absenteeism' as const, label: 'Empresas: ↓ ausentismo' },
                      { k: 'enterprise_roi' as const, label: 'Empresas: ROI' },
                      { k: 'enterprise_satisfaction' as const, label: 'Empresas: satisfacción' },
                      { k: 'enterprise_support' as const, label: 'Empresas: soporte' },
                    ].map((f) => (
                      <div key={f.k} className="space-y-1.5">
                        <Label className="text-xs">{f.label}</Label>
                        <Input
                          value={landingStats[f.k]}
                          onChange={(e) => setLandingStats({ ...landingStats, [f.k]: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleSaveLandingStats} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Guardar estadísticas
                  </Button>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5" />
                    Configuración general (moneda y límites)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Moneda y montos mínimos/máximos. Por defecto MXN y los límites actuales.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Moneda (código ISO, ej. mxn, usd)</Label>
                    <Input
                      value={appConfig.currency}
                      onChange={(e) => setAppConfig({ ...appConfig, currency: e.target.value })}
                      className="text-sm uppercase"
                      maxLength={3}
                    />
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      ⚠️ Solo cambia el código de moneda en los cobros. NO convierte los montos:
                      si cambias a otra divisa sin ajustar los precios, se cobrará el mismo número en esa moneda.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Recarga wallet — mínimo</Label>
                      <Input type="number" min="0" value={appConfig.wallet_min}
                        onChange={(e) => setAppConfig({ ...appConfig, wallet_min: Number(e.target.value) || 0 })} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Recarga wallet — máximo</Label>
                      <Input type="number" min="0" value={appConfig.wallet_max}
                        onChange={(e) => setAppConfig({ ...appConfig, wallet_max: Number(e.target.value) || 0 })} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Campaña de anuncios — mínimo</Label>
                      <Input type="number" min="0" value={appConfig.ad_min}
                        onChange={(e) => setAppConfig({ ...appConfig, ad_min: Number(e.target.value) || 0 })} className="text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Campaña de anuncios — máximo</Label>
                      <Input type="number" min="0" value={appConfig.ad_max}
                        onChange={(e) => setAppConfig({ ...appConfig, ad_max: Number(e.target.value) || 0 })} className="text-sm" />
                    </div>
                  </div>
                  <Button onClick={handleSaveAppConfig} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Guardar configuración general
                  </Button>
                </CardContent>
              </Card>
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5" />
                    Especialidades médicas adicionales
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Las especialidades base ya están incluidas. Aquí puedes AGREGAR especialidades extra que aparecerán en los menús de selección y filtros, sin necesidad de un despliegue.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {extraSpecialties.length === 0 && (
                    <p className="text-xs text-muted-foreground">No hay especialidades adicionales. Agrega una abajo.</p>
                  )}
                  {extraSpecialties.map((spec, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={spec}
                        onChange={(e) => {
                          const arr = [...extraSpecialties];
                          arr[idx] = e.target.value;
                          setExtraSpecialties(arr);
                        }}
                        placeholder="Ej. Medicina del Deporte"
                        className="text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setExtraSpecialties(extraSpecialties.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setExtraSpecialties([...extraSpecialties, ''])} className="w-full">
                    <Plus className="w-4 h-4 mr-1" /> Agregar especialidad
                  </Button>
                  <Button onClick={handleSaveExtraSpecialties} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Guardar especialidades
                  </Button>
                </CardContent>
              </Card>
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
                    { key: 'enable_patient_chat' as const, label: 'Chat doctor ↔ paciente', desc: 'Activa el chat directo entre médico y paciente. Si está apagado, la función queda temporalmente no disponible en toda la web.' },
                    { key: 'enable_prescriptions' as const, label: 'Recetas médicas', desc: 'Activa la generación y gestión de recetas. Si está apagado, queda temporalmente no disponible en toda la web.' },
                    { key: 'enable_video_calls' as const, label: 'Videollamadas con pacientes', desc: 'Activa las videollamadas directas con pacientes. Si está apagado, queda temporalmente no disponible en toda la web.' },
                    { key: 'enable_marketplace' as const, label: 'Sección: Tienda / Insumos médicos', desc: 'Muestra u oculta toda la tienda de insumos médicos (Marketplace). Apagado = oculta el menú y la sección queda no disponible.' },
                    { key: 'enable_lives' as const, label: 'Sección: Transmisiones en vivo', desc: 'Muestra u oculta las transmisiones en vivo. Apagado = oculta el menú y la sección queda no disponible.' },
                    { key: 'enable_recordings' as const, label: 'Sección: Grabaciones', desc: 'Muestra u oculta la sección de grabaciones. Apagado = oculta el menú y la sección queda no disponible.' },
                    { key: 'enable_events' as const, label: 'Sección: Eventos', desc: 'Muestra u oculta la sección de eventos. Apagado = la sección queda no disponible.' },
                    { key: 'enable_vault' as const, label: 'Sección: Expediente / Vault', desc: 'Muestra u oculta el expediente clínico (Vault). Apagado = oculta el menú y la sección queda no disponible.' },
                    { key: 'enable_ads' as const, label: 'Publicidad (anuncios)', desc: 'Muestra u oculta todos los anuncios (banners, intersticiales, pre-roll) en la web. Apagado = no se muestra ninguna publicidad.' },
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
