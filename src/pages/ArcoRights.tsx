import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const arcoSchema = z.object({
  full_name: z.string().trim().min(2, 'Nombre demasiado corto').max(200),
  email: z.string().trim().email('Correo inválido').max(255),
  request_type: z.enum(['access', 'rectification', 'cancellation', 'opposition']),
  description: z.string().trim().min(10, 'Mínimo 10 caracteres').max(5000, 'Máximo 5000 caracteres'),
});

const REQUEST_LABELS: Record<string, string> = {
  access: 'Acceso — quiero saber qué datos tienen sobre mí',
  rectification: 'Rectificación — corregir datos incorrectos',
  cancellation: 'Cancelación — eliminar mis datos',
  opposition: 'Oposición — limitar el uso de mis datos',
};

export default function ArcoRights() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    request_type: 'access' as 'access' | 'rectification' | 'cancellation' | 'opposition',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = arcoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Datos inválidos');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('arco_requests').insert(parsed.data as any);
    setSubmitting(false);
    if (error) {
      toast.error('No se pudo enviar la solicitud. Intenta de nuevo.');
      return;
    }
    setSubmitted(true);
    toast.success('Solicitud recibida. Te contactaremos en un máximo de 20 días hábiles.');
  };

  return (
    <MainLayout>
      <main className="container mx-auto px-4 pt-10 sm:pt-14 pb-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Derechos ARCO</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Conforme a la <strong>LFPDPPP</strong> (México), puedes ejercer tus derechos de
          <strong> Acceso, Rectificación, Cancelación y Oposición</strong> sobre tus datos personales.
          Te responderemos en un máximo de <strong>20 días hábiles</strong>.
        </p>

        {submitted ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">Solicitud enviada</h2>
              <p className="text-sm text-muted-foreground">
                Hemos recibido tu solicitud. Nuestro equipo de privacidad la revisará y te
                contactará al correo proporcionado.
              </p>
              <Button onClick={() => navigate('/')}>Volver al inicio</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formulario de solicitud</CardTitle>
              <CardDescription>
                Todos los campos son obligatorios. Recibirás confirmación por correo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Nombre completo</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    maxLength={200}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">Correo electrónico</Label>
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
                  <Label htmlFor="request_type">Tipo de derecho a ejercer</Label>
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
                  <Label htmlFor="description">Descripción de la solicitud</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    maxLength={5000}
                    placeholder="Describe con detalle tu solicitud. Si aplica, indica qué datos específicos quieres acceder, rectificar, cancelar u objetar."
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.description.length} / 5000
                  </p>
                </div>

                <p className="text-xs text-muted-foreground border-l-2 border-primary pl-3">
                  Para verificar tu identidad podríamos solicitarte adjuntar una identificación
                  oficial por correo. Nunca compartas datos sensibles en este formulario.
                </p>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</>
                  ) : (
                    'Enviar solicitud'
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
