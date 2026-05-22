import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ArcoRights() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [customContent, setCustomContent] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    request_type: 'access' as 'access' | 'rectification' | 'cancellation' | 'opposition',
    description: '',
  });

  // Contenido informativo editable desde /admin/site-settings (pestaña Páginas).
  // El formulario de solicitud ARCO se mantiene siempre.
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('id', 'arco_policy').maybeSingle()
      .then(({ data }) => {
        const c = (data?.value as { content?: string } | null)?.content;
        if (c && c.trim()) setCustomContent(c);
      });
  }, []);

  const arcoSchema = z.object({
    full_name: z.string().trim().min(2, t('arcoRightsPage.validation.nameTooShort')).max(200),
    email: z.string().trim().email(t('arcoRightsPage.validation.invalidEmail')).max(255),
    request_type: z.enum(['access', 'rectification', 'cancellation', 'opposition']),
    description: z
      .string()
      .trim()
      .min(10, t('arcoRightsPage.validation.minDescription'))
      .max(5000, t('arcoRightsPage.validation.maxDescription')),
  });

  const REQUEST_LABELS: Record<string, string> = {
    access: t('arcoRightsPage.requestTypes.access'),
    rectification: t('arcoRightsPage.requestTypes.rectification'),
    cancellation: t('arcoRightsPage.requestTypes.cancellation'),
    opposition: t('arcoRightsPage.requestTypes.opposition'),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = arcoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || t('arcoRightsPage.validation.invalidData'));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('arco_requests').insert(parsed.data as any);
    setSubmitting(false);
    if (error) {
      toast.error(t('arcoRightsPage.toasts.submitError'));
      return;
    }
    setSubmitted(true);
    toast.success(t('arcoRightsPage.toasts.submitSuccess'));
  };

  return (
    <MainLayout>
      <main className="container mx-auto px-4 pt-10 sm:pt-14 pb-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('arcoRightsPage.title')}</h1>
        </div>
        <p
          className="text-sm text-muted-foreground mb-6"
          dangerouslySetInnerHTML={{ __html: t('arcoRightsPage.intro') }}
        />

        {customContent && (
          <Card className="mb-6">
            <CardContent className="pt-6 prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customContent) }} />
            </CardContent>
          </Card>
        )}

        {submitted ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">{t('arcoRightsPage.submitted.title')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('arcoRightsPage.submitted.body')}
              </p>
              <Button onClick={() => navigate('/')}>{t('arcoRightsPage.submitted.back')}</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('arcoRightsPage.form.title')}</CardTitle>
              <CardDescription>
                {t('arcoRightsPage.form.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="full_name">{t('arcoRightsPage.form.fullName')}</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    maxLength={200}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">{t('arcoRightsPage.form.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    maxLength={255}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="request_type">{t('arcoRightsPage.form.requestType')}</Label>
                  <Select
                    value={form.request_type}
                    onValueChange={(v: any) => setForm({ ...form, request_type: v })}
                  >
                    <SelectTrigger id="request_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REQUEST_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">{t('arcoRightsPage.form.descriptionLabel')}</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={5000}
                    placeholder={t('arcoRightsPage.form.descriptionPlaceholder')}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.description.length} / 5000
                  </p>
                </div>

                <p className="text-xs text-muted-foreground border-l-2 border-primary pl-3">
                  {t('arcoRightsPage.form.identityNotice')}
                </p>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('arcoRightsPage.form.submitting')}</>
                  ) : (
                    t('arcoRightsPage.form.submit')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </MainLayout>
  );
}
