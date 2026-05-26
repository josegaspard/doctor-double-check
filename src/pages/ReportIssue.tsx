import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ShieldAlert, Send, CheckCircle, Paperclip, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

export default function ReportIssue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const reportSchema = z.object({
    type: z.enum(['bug', 'abuse', 'other']),
    subject: z.string().trim().min(5, t('report.validationMin5')).max(150, t('report.validationMax150')),
    description: z.string().trim().min(20, t('report.validationMin20')).max(2000, t('report.validationMax2000')),
    contactEmail: z.string().trim().email(t('report.validationEmail')).max(255).or(z.literal('')),
  });

  const [type, setType] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) {
      toast.error(t('report.filesTooLarge'));
    }
    setAttachments(prev => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (!user?.id || attachments.length === 0) return [];
    const urls: string[] = [];
    for (const file of attachments) {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('report-attachments').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('report-attachments').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = reportSchema.safeParse({ type, subject, description, contactEmail });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      const attachmentUrls = await uploadAttachments();
      const { data, error } = await supabase.functions.invoke('submit-report', {
        body: {
          type: result.data.type,
          subject: result.data.subject,
          description: result.data.description,
          contactEmail: result.data.contactEmail || null,
          reporterId: user?.id || null,
          attachmentUrls,
        },
      });

      if (error || (data && (data as any).error)) {
        throw new Error(error?.message || (data as any)?.error || 'submit-report failed');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting report:', err);
      toast.error(t('report.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card className="text-center">
            <CardContent className="py-12 px-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t('report.successTitle')}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t('report.successMessage')}</p>
              <Button onClick={() => navigate(-1)}>{t('report.back')}</Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-lg">
        <Button variant="back" size="sm" className="hidden sm:inline-flex mb-4 gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
          {t('report.back')}
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('report.title')}</CardTitle>
                <CardDescription className="text-xs">{t('report.subtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('report.typeLabel')}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('report.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">{t('report.bugOption')}</SelectItem>
                    <SelectItem value="abuse">{t('report.abuseOption')}</SelectItem>
                    <SelectItem value="other">{t('report.otherOption')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('report.subjectLabel')}</Label>
                <Input
                  placeholder={t('report.subjectPlaceholder')}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('report.descriptionLabel')}</Label>
                <Textarea
                  placeholder={t('report.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">{description.length}/2000</p>
              </div>

              <div className="space-y-2">
                <Label>{t('report.emailLabel')}</Label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={255}
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label>{t('report.attachments')}</Label>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t('report.removeAttachment')}
                        title={t('report.removeAttachment')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {attachments.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                    {t('report.attachFile')}
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label={t('report.attachFile')}
                  title={t('report.attachFile')}
                />
                <p className="text-[11px] text-muted-foreground">{t('report.maxFiles')}</p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isSubmitting || !type || !subject || !description}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSubmitting ? t('report.submitting') : t('report.submitButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
