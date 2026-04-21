import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Circle, ClipboardList, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Role = 'visitor' | 'patient' | 'doctor' | 'resident';

interface TestStep {
  id: string;
  title: string;
  expected: string;
  guard?: string;
}

const SCENARIOS: Record<Role, TestStep[]> = {
  visitor: [
    { id: 'v1', title: 'Ver lista de Lives públicos', expected: 'La cuadrícula carga sin bloqueo', guard: 'Acceso público' },
    { id: 'v2', title: 'Intentar entrar a /chat', expected: 'AccessGuard muestra panel "¿Por qué no puedo entrar?"', guard: 'Sin sesión' },
    { id: 'v3', title: 'Ver perfil público de doctor', expected: 'Datos visibles vía RPC', guard: 'Acceso público' },
    { id: 'v4', title: 'Click en grabación premium', expected: 'PaywallModal se abre con CTA login', guard: 'Sin sesión' },
  ],
  patient: [
    { id: 'p1', title: 'Recargar wallet $100 MXN', expected: 'Stripe checkout → toast +$100 → balance actualizado', guard: 'wallet' },
    { id: 'p2', title: 'Comprar grabación con saldo', expected: 'Toast "✅ Confirmado" + redirect al player', guard: 'Saldo suficiente' },
    { id: 'p3', title: 'Comprar sin saldo', expected: 'PaywallModal sugiere recargar wallet', guard: 'Saldo insuficiente' },
    { id: 'p4', title: 'Iniciar orientación con doctor', expected: 'Chat session creada, entitlement chat 30 días', guard: 'Pago confirmado' },
    { id: 'p5', title: 'Descargar resumen clínico', expected: 'Ventana print con marca de agua + watermark', guard: 'Expediente guardado' },
    { id: 'p6', title: 'Solicitar reembolso', expected: 'Toast confirmado + badge "Reembolso solicitado"', guard: 'Tx ≤ 30 días' },
  ],
  doctor: [
    { id: 'd1', title: 'Ver "Mis Pacientes" (Vault)', expected: 'Cards con contacto, totales, último pago', guard: 'Rol doctor' },
    { id: 'd2', title: 'Solicitar OTP a paciente', expected: 'Banner OTP, expira 2 min', guard: 'Doctor con acceso' },
    { id: 'd3', title: 'Ir a "Soy Médico" (panel)', expected: 'Dashboard carga con stats', guard: 'Rol doctor' },
    { id: 'd4', title: 'Ir a Education (mobile)', expected: 'Tab Education accesible desde bottom-nav', guard: 'Rol doctor/residente' },
    { id: 'd5', title: 'Crear Live', expected: 'Setup form con cédula/COFEPRIS visibles', guard: 'Doctor aprobado' },
    { id: 'd6', title: 'Ver ganancias pendientes', expected: 'Card pending_earnings con desglose', guard: 'Rol doctor' },
  ],
  resident: [
    { id: 'r1', title: 'Recargar wallet con descuento 50%', expected: 'Tarifas calculadas con get_price_for_user', guard: 'Rol residente' },
    { id: 'r2', title: 'Acceder a Education', expected: 'Tabs activos, mini-chat funcional', guard: 'Rol residente' },
    { id: 'r3', title: 'Solicitar conexión a doctor', expected: 'Solicitud enviada, estado pending', guard: 'Networking' },
    { id: 'r4', title: 'Intentar emitir receta', expected: 'AccessGuard bloquea con razón "Solo doctores"', guard: 'Restricción de rol' },
    { id: 'r5', title: 'Comprar contenido premium', expected: 'Precio con descuento, debit wallet', guard: 'Saldo suficiente' },
  ],
};

const ROLE_LABELS: Record<Role, string> = {
  visitor: 'Visitante',
  patient: 'Paciente',
  doctor: 'Médico',
  resident: 'Residente',
};

export default function AdminQAChecklist() {
  const { role } = useAuth();
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('qa-checklist') || '{}');
    } catch {
      return {};
    }
  });

  if (role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-6 text-center text-muted-foreground">Solo administradores.</div>
      </MainLayout>
    );
  }

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('qa-checklist', JSON.stringify(next));
      return next;
    });
  };

  const reset = () => {
    setCompleted({});
    localStorage.removeItem('qa-checklist');
  };

  const renderScenario = (r: Role) => {
    const steps = SCENARIOS[r];
    const done = steps.filter(s => completed[s.id]).length;
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              {ROLE_LABELS[r]}
            </CardTitle>
            <Badge variant={done === steps.length ? 'success' : 'outline'}>
              {done}/{steps.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map(step => {
            const isDone = !!completed[step.id];
            return (
              <button
                key={step.id}
                onClick={() => toggle(step.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all min-h-[48px] ${
                  isDone
                    ? 'bg-success/5 border-success/30'
                    : 'bg-muted/30 border-border hover:border-primary/40 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">Esperado:</span> {step.expected}
                    </p>
                    {step.guard && (
                      <Badge variant="outline" className="mt-1.5 text-[10px] px-1.5 py-0">
                        {step.guard}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const totalSteps = Object.values(SCENARIOS).flat().length;
  const totalDone = Object.values(completed).filter(Boolean).length;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Checklist QA E2E
            </h1>
            <p className="text-sm text-muted-foreground">
              Pruebas por rol — {totalDone}/{totalSteps} completadas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset} className="gap-2 min-h-[40px]">
            <RefreshCw className="w-4 h-4" />
            Reiniciar
          </Button>
        </div>

        <Tabs defaultValue="visitor" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 h-auto">
            {(Object.keys(SCENARIOS) as Role[]).map(r => (
              <TabsTrigger key={r} value={r} className="text-xs sm:text-sm py-2">
                {ROLE_LABELS[r]}
              </TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(SCENARIOS) as Role[]).map(r => (
            <TabsContent key={r} value={r}>
              {renderScenario(r)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}
