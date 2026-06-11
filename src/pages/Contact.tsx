import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, MapPin, Phone, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { toast } from 'sonner';

interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  content: string;
}

export default function Contact() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    email: 'contacto@medical-masters.com',
    phone: '',
    address: 'Ciudad de México, México',
    content: '',
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    const fetchContactInfo = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'contact_info')
          .single();

        if (data?.value) {
          setContactInfo(data.value as unknown as ContactInfo);
        }
      } catch (error) {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };

    fetchContactInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error(t('autoI18n.contact1'));
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-contact', {
        body: {
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        },
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw new Error((data as { error?: string })?.error || error?.message || 'send failed');
      }
      toast.success(t('autoI18n.contact2'));
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error(t('autoI18n.contact3'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <MainLayout>
      <main className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-14 pb-8 sm:pb-12 max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">
            {t('autoI18n.contact4')}
          </h1>
          <p className="text-sm text-muted-foreground px-4">
            {t('autoI18n.contact5')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {/* Contact Info Cards */}
          <div className="md:col-span-1 space-y-3 sm:space-y-4">
            <Card>
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="text-xs sm:text-sm font-medium truncate">{contactInfo.email}</p>
                </div>
              </CardContent>
            </Card>

            {contactInfo.phone && (
              <Card>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('autoI18n.contact6')}
                    </p>
                    <p className="text-xs sm:text-sm font-medium">{contactInfo.phone}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('autoI18n.contact7')}
                  </p>
                  <p className="text-xs sm:text-sm font-medium">{contactInfo.address}</p>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic content from admin */}
            {contactInfo.content && (
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{contactInfo.content}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Contact Form */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">
                {t('autoI18n.contact8')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('autoI18n.contact9')}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs">
                      {t('autoI18n.contact10')} *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('autoI18n.contact11')}
                      className="text-sm h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={t('autoI18n.contact12')}
                      className="text-sm h-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs">
                    {t('autoI18n.contact13')}
                  </Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={t('autoI18n.contact14')}
                    className="text-sm h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs">
                    {t('autoI18n.contact15')} *
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t('autoI18n.contact16')}
                    className="min-h-[100px] sm:min-h-[120px] text-sm"
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-10 sm:h-11" disabled={isSending}>
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {isSending
                    ? t('autoI18n.contact17')
                    : t('autoI18n.contact18')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </MainLayout>
  );
}