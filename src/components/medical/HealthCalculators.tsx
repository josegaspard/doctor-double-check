import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Heart, Brain, Activity } from 'lucide-react';

// ── BMI Calculator ──
function BMICalculator() {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState<{ bmi: number; category: string; color: string } | null>(null);

  const calculate = () => {
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    if (!h || !w || h <= 0) return;
    const bmi = w / (h * h);
    let category = '';
    let color = '';
    if (bmi < 18.5) { category = 'Bajo peso'; color = 'text-info'; }
    else if (bmi < 25) { category = 'Normal'; color = 'text-success'; }
    else if (bmi < 30) { category = 'Sobrepeso'; color = 'text-warning'; }
    else if (bmi < 35) { category = 'Obesidad grado I'; color = 'text-destructive'; }
    else if (bmi < 40) { category = 'Obesidad grado II'; color = 'text-destructive'; }
    else { category = 'Obesidad grado III'; color = 'text-destructive'; }
    setResult({ bmi: Math.round(bmi * 10) / 10, category, color });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          Índice de Masa Corporal (IMC)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Altura (cm)</Label>
            <Input type="number" placeholder="170" value={height} onChange={e => setHeight(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Peso (kg)</Label>
            <Input type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
        </div>
        <Button onClick={calculate} size="sm" className="w-full">Calcular</Button>
        {result && (
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{result.bmi}</p>
            <p className={`text-sm font-medium ${result.color}`}>{result.category}</p>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div className="grid grid-cols-2 gap-1">
            <span>{'<'} 18.5 — Bajo peso</span>
            <span>18.5–24.9 — Normal</span>
            <span>25–29.9 — Sobrepeso</span>
            <span>30–34.9 — Obesidad I</span>
            <span>35–39.9 — Obesidad II</span>
            <span>≥ 40 — Obesidad III</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cardiovascular Risk ──
function CardiovascularRisk() {
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [systolic, setSystolic] = useState('');
  const [cholesterol, setCholesterol] = useState('');
  const [smoker, setSmoker] = useState('no');
  const [diabetic, setDiabetic] = useState('no');
  const [result, setResult] = useState<{ risk: number; level: string; color: string } | null>(null);

  const calculate = () => {
    const a = parseInt(age);
    const s = parseInt(systolic);
    const c = parseFloat(cholesterol);
    if (!a || !s) return;

    // Simplified Framingham-like score
    let score = 0;
    if (a > 55) score += 3;
    else if (a > 45) score += 2;
    else if (a > 35) score += 1;
    if (sex === 'male') score += 1;
    if (s > 160) score += 3;
    else if (s > 140) score += 2;
    else if (s > 120) score += 1;
    if (c > 280) score += 2;
    else if (c > 240) score += 1;
    if (smoker === 'yes') score += 2;
    if (diabetic === 'yes') score += 2;

    let risk = Math.min(score * 3, 30);
    let level = '';
    let color = '';
    if (risk < 5) { level = 'Bajo'; color = 'text-success'; }
    else if (risk < 10) { level = 'Moderado'; color = 'text-warning'; }
    else if (risk < 20) { level = 'Alto'; color = 'text-destructive'; }
    else { level = 'Muy alto'; color = 'text-destructive'; }

    setResult({ risk, level, color });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="w-4 h-4 text-destructive" />
          Riesgo Cardiovascular
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Edad</Label>
            <Input type="number" placeholder="45" value={age} onChange={e => setAge(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sexo</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Femenino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Presión sistólica (mmHg)</Label>
            <Input type="number" placeholder="120" value={systolic} onChange={e => setSystolic(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Colesterol total (mg/dL)</Label>
            <Input type="number" placeholder="200" value={cholesterol} onChange={e => setCholesterol(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">¿Fuma?</Label>
            <Select value={smoker} onValueChange={setSmoker}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Sí</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">¿Diabético?</Label>
            <Select value={diabetic} onValueChange={setDiabetic}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Sí</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={calculate} size="sm" className="w-full">Calcular riesgo</Button>
        {result && (
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{result.risk}%</p>
            <p className={`text-sm font-medium ${result.color}`}>Riesgo {result.level} a 10 años</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Glasgow Coma Scale ──
function GlasgowScale() {
  const [eye, setEye] = useState(4);
  const [verbal, setVerbal] = useState(5);
  const [motor, setMotor] = useState(6);

  const total = eye + verbal + motor;
  let severity = '';
  let color = '';
  if (total <= 8) { severity = 'Grave'; color = 'text-destructive'; }
  else if (total <= 12) { severity = 'Moderado'; color = 'text-warning'; }
  else { severity = 'Leve'; color = 'text-success'; }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-info" />
          Escala de Glasgow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Apertura ocular ({eye})</Label>
          <Select value={String(eye)} onValueChange={v => setEye(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 — Espontánea</SelectItem>
              <SelectItem value="3">3 — A la voz</SelectItem>
              <SelectItem value="2">2 — Al dolor</SelectItem>
              <SelectItem value="1">1 — Ninguna</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Respuesta verbal ({verbal})</Label>
          <Select value={String(verbal)} onValueChange={v => setVerbal(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 — Orientada</SelectItem>
              <SelectItem value="4">4 — Confusa</SelectItem>
              <SelectItem value="3">3 — Palabras inapropiadas</SelectItem>
              <SelectItem value="2">2 — Sonidos incomprensibles</SelectItem>
              <SelectItem value="1">1 — Ninguna</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Respuesta motora ({motor})</Label>
          <Select value={String(motor)} onValueChange={v => setMotor(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 — Obedece órdenes</SelectItem>
              <SelectItem value="5">5 — Localiza dolor</SelectItem>
              <SelectItem value="4">4 — Retira</SelectItem>
              <SelectItem value="3">3 — Flexión anormal</SelectItem>
              <SelectItem value="2">2 — Extensión</SelectItem>
              <SelectItem value="1">1 — Ninguna</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-2xl font-bold">{total}/15</p>
          <p className={`text-sm font-medium ${color}`}>{severity}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthCalculators() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Calculadoras de Salud</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BMICalculator />
        <CardiovascularRisk />
        <GlasgowScale />
      </div>
    </div>
  );
}
