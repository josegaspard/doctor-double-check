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
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    email: 'contacto@medicalmasters.com',
    phone: '+52 55 1234 5678',
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
      toast.error(language === 'es' ? 'Por favor completa todos los campos requeridos' : 'Please fill in all required fields');
      return;
    }

    setIsSending(true);
    try {
      // Simulate sending - in a real app this would call an edge function
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(language === 'es' ? 'Mensaje enviado correctamente' : 'Message sent successfully');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error(language === 'es' ? 'Error al enviar el mensaje' : 'Error sending message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <MainLayout>
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">
            {language === 'es' ? 'Contacto' : 'Contact'}
          </h1>
          <p className="text-sm text-muted-foreground px-4">
            {language === 'es' 
              ? 'Estamos aquí para ayudarte. Envíanos un mensaje y te responderemos lo antes posible.' 
              : "We're here to help. Send us a message and we'll respond as soon as possible."}
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

            <Card>
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {language === 'es' ? 'Teléfono' : 'Phone'}
                  </p>
                  <p className="text-xs sm:text-sm font-medium">{contactInfo.phone}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {language === 'es' ? 'Ubicación' : 'Location'}
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
                {language === 'es' ? 'Envíanos un mensaje' : 'Send us a message'}
              </CardTitle>
              <CardDescription className="text-xs">
                {language === 'es' 
                  ? 'Completa el formulario y nos pondremos en contacto contigo.' 
                  : "Fill out the form and we'll get back to you."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs">
                      {language === 'es' ? 'Nombre' : 'Name'} *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={language === 'es' ? 'Tu nombre' : 'Your name'}
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
                      placeholder={language === 'es' ? 'tu@email.com' : 'your@email.com'}
                      className="text-sm h-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs">
                    {language === 'es' ? 'Asunto' : 'Subject'}
                  </Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={language === 'es' ? '¿En qué podemos ayudarte?' : 'How can we help you?'}
                    className="text-sm h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs">
                    {language === 'es' ? 'Mensaje' : 'Message'} *
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={language === 'es' ? 'Escribe tu mensaje aquí...' : 'Write your message here...'}
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
                    ? (language === 'es' ? 'Enviando...' : 'Sending...') 
                    : (language === 'es' ? 'Enviar Mensaje' : 'Send Message')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </MainLayout>
  );
}