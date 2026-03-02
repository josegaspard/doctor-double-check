import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { ArrowLeft, ShieldAlert, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const reportSchema = z.object({
  type: z.enum(['bug', 'abuse', 'other']),
  subject: z.string().trim().min(5, 'Mínimo 5 caracteres').max(150, 'Máximo 150 caracteres'),
  description: z.string().trim().min(20, 'Describe el problema con al menos 20 caracteres').max(2000, 'Máximo 2000 caracteres'),
  contactEmail: z.string().trim().email('Email inválido').max(255).or(z.literal('')),
});

export default function ReportIssue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = reportSchema.safeParse({ type, subject, description, contactEmail });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user?.id || '00000000-0000-0000-0000-000000000000',
        content_type: 'platform_report',
        content_id: 'platform',
        reason: result.data.type,
        description: `[${result.data.type.toUpperCase()}] ${result.data.subject}\n\n${result.data.description}\n\nContacto: ${result.data.contactEmail || 'No proporcionado'}`,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting report:', err);
      toast.error('Error al enviar el reporte. Intenta de nuevo.');
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
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">Reporte enviado</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Gracias por reportar. Nuestro equipo revisará tu reporte a la brevedad posible.
              </p>
              <Button onClick={() => navigate(-1)}>Volver</Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-lg">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Reportar falla o abuso</CardTitle>
                <CardDescription className="text-xs">Tu reporte será revisado por nuestro equipo</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de reporte *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">🐛 Falla técnica / Bug</SelectItem>
                    <SelectItem value="abuse">⚠️ Abuso / Conducta inapropiada</SelectItem>
                    <SelectItem value="other">📝 Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Asunto *</Label>
                <Input
                  placeholder="Describe brevemente el problema"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción detallada *</Label>
                <Textarea
                  placeholder="Explica el problema con el mayor detalle posible. Incluye pasos para reproducir si es una falla técnica."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-right">{description.length}/2000</p>
              </div>

              <div className="space-y-2">
                <Label>Email de contacto</Label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  maxLength={255}
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isSubmitting || !type || !subject || !description}
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
