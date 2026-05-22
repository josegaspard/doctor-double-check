import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calculator, Heart, Brain, Activity, Baby, Droplets,
  Ruler, Scale, TrendingUp, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// ═══════════════════════════════════════════════════
// BMI Calculator with OMS Visual Table
// ═══════════════════════════════════════════════════
const BMI_RANGES = [
  { min: 0, max: 16, labelKey: 'underweightSevere', color: 'bg-primary', textColor: 'text-primary', riskKey: 'high' },
  { min: 16, max: 17, labelKey: 'underweightModerate', color: 'bg-primary', textColor: 'text-primary', riskKey: 'moderate' },
  { min: 17, max: 18.5, labelKey: 'underweightMild', color: 'bg-primary', textColor: 'text-primary', riskKey: 'low' },
  { min: 18.5, max: 25, labelKey: 'normal', color: 'bg-success', textColor: 'text-success', riskKey: 'normal' },
  { min: 25, max: 30, labelKey: 'overweight', color: 'bg-warning', textColor: 'text-warning', riskKey: 'increased' },
  { min: 30, max: 35, labelKey: 'obesityI', color: 'bg-warning', textColor: 'text-warning', riskKey: 'high' },
  { min: 35, max: 40, labelKey: 'obesityII', color: 'bg-destructive', textColor: 'text-destructive', riskKey: 'veryHigh' },
  { min: 40, max: 100, labelKey: 'obesityIII', color: 'bg-destructive', textColor: 'text-destructive', riskKey: 'extreme' },
];

function BMICalculator() {
  const { t } = useLanguage();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Cálculo derivado en cada render — sin botón. Apenas el usuario completa
  // altura y peso aparece el resultado, como espera cualquier app de salud
  // moderna. El botón se queda como "Recalcular" puramente cosmético para
  // accesibilidad / teclado.
  const result = React.useMemo(() => {
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const bmi = w / (h * h);
    if (!isFinite(bmi)) return null;
    const range = BMI_RANGES.find(r => bmi >= r.min && bmi < r.max) || BMI_RANGES[7];
    const idealMin = Math.round(18.5 * h * h * 10) / 10;
    const idealMax = Math.round(24.9 * h * h * 10) / 10;
    return { bmi: Math.round(bmi * 10) / 10, range, idealMin, idealMax };
  }, [height, weight]);

  const calculate = () => { /* no-op: cálculo es reactivo */ };

  const bmiPosition = result ? Math.min(Math.max(((result.bmi - 12) / 38) * 100, 0), 100) : 0;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scale className="w-4 h-4 text-primary" />
          </div>
          {t('healthCalculators.bmi.title')}
          <Badge variant="outline" className="text-[10px] ml-auto">{t('healthCalculators.bmi.badge')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.height')}</Label>
            <Input type="number" placeholder="170" value={height} onChange={e => setHeight(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.weight')}</Label>
            <Input type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" />
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-end">
            <Button onClick={calculate} size="sm" className="w-full gap-2">
              <Calculator className="w-3.5 h-3.5" /> {t('healthCalculators.common.calculate')}
            </Button>
          </div>
        </div>

        {result && (
          <div className="space-y-4">
            {/* Result display */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{result.bmi}</p>
                <p className="text-[10px] text-muted-foreground">{t('healthCalculators.bmi.unit')}</p>
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${result.range.textColor}`}>{t(`healthCalculators.bmi.ranges.${result.range.labelKey}`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('healthCalculators.bmi.risk')}: <span className="font-medium">{t(`healthCalculators.bmi.riskLevels.${result.range.riskKey}`)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('healthCalculators.bmi.idealWeight')}: {result.idealMin}–{result.idealMax} kg
                </p>
              </div>
            </div>

            {/* Visual bar */}
            <div className="relative">
              <div className="flex rounded-full overflow-hidden h-3">
                {BMI_RANGES.map((r, i) => {
                  const widths = [8, 2.5, 3.75, 16.25, 12.5, 12.5, 12.5, 32];
                  return (
                    <div key={i} className={`${r.color} transition-all`} style={{ width: `${widths[i]}%` }} />
                  );
                })}
              </div>
              {/* Indicator */}
              <div
                className="absolute top-[-4px] transition-all duration-500"
                style={{ left: `calc(${bmiPosition}% - 4px)` }}
              >
                <div className="w-2 h-2 bg-foreground rounded-full ring-2 ring-background" />
                <div className="w-0.5 h-3 bg-foreground mx-auto" />
              </div>
              <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground">
                <span>16</span><span>18.5</span><span>25</span><span>30</span><span>35</span><span>40</span><span>50</span>
              </div>
            </div>
          </div>
        )}

        {/* OMS Classification Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-foreground">{t('healthCalculators.bmi.classificationTitle')}</p>
          </div>
          <div className="divide-y divide-border">
            {BMI_RANGES.map((r, i) => (
              <div
                key={i}
                className={`flex items-center px-3 py-1.5 text-xs transition-colors ${
                  result?.range === r ? 'bg-primary/5 font-medium' : ''
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${r.color} mr-2.5 shrink-0`} />
                <span className="flex-1">{t(`healthCalculators.bmi.ranges.${r.labelKey}`)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.min === 0 ? '<' : r.min}–{r.max === 100 ? '50+' : r.max}
                </span>
                <Badge
                  variant={r.riskKey === 'normal' ? 'verified' : r.riskKey === 'low' ? 'secondary' : 'outline'}
                  className="ml-2 text-[9px] px-1.5"
                >
                  {t(`healthCalculators.bmi.riskLevels.${r.riskKey}`)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Cardiovascular Risk (SCORE2 / Framingham simplified)
// ═══════════════════════════════════════════════════
function CardiovascularRisk() {
  const { t } = useLanguage();
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [systolic, setSystolic] = useState('');
  const [cholesterol, setCholesterol] = useState('');
  const [hdl, setHdl] = useState('');
  const [smoker, setSmoker] = useState('no');
  const [diabetic, setDiabetic] = useState('no');
  const [hypertensive, setHypertensive] = useState('no');
  const [result, setResult] = useState<{ risk: number; levelKey: string; color: string; recommendationKeys: string[] } | null>(null);

  const calculate = () => {
    const a = parseInt(age);
    const s = parseInt(systolic);
    if (!a || !s) return;

    let score = 0;
    // Age
    if (a >= 65) score += 4;
    else if (a >= 55) score += 3;
    else if (a >= 45) score += 2;
    else if (a >= 35) score += 1;
    // Sex
    if (sex === 'male') score += 1;
    // Blood pressure
    if (s >= 180) score += 4;
    else if (s >= 160) score += 3;
    else if (s >= 140) score += 2;
    else if (s >= 120) score += 1;
    // Cholesterol
    const c = parseFloat(cholesterol);
    if (c > 300) score += 3;
    else if (c > 260) score += 2;
    else if (c > 240) score += 1;
    // HDL (protective)
    const h = parseFloat(hdl);
    if (h && h >= 60) score -= 1;
    else if (h && h < 40) score += 2;
    // Risk factors
    if (smoker === 'yes') score += 3;
    if (diabetic === 'yes') score += 3;
    if (hypertensive === 'yes') score += 2;

    const risk = Math.max(0, Math.min(score * 2.5, 40));
    let levelKey = '', color = '';
    const recommendationKeys: string[] = [];

    if (risk < 5) {
      levelKey = 'low'; color = 'text-success';
      recommendationKeys.push('lowHealthyLifestyle', 'lowAnnualControl');
    } else if (risk < 10) {
      levelKey = 'moderate'; color = 'text-warning';
      recommendationKeys.push('moderateModifyRisk', 'moderateExercise', 'moderateMediterranean');
    } else if (risk < 20) {
      levelKey = 'high'; color = 'text-warning';
      recommendationKeys.push('highCardioConsult', 'highStatins', 'highQuarterlyControl');
    } else {
      levelKey = 'veryHigh'; color = 'text-destructive';
      recommendationKeys.push('veryHighUrgentPharm', 'veryHighHighIntensityStatins', 'veryHighMonthlyControl');
    }

    setResult({ risk: Math.round(risk * 10) / 10, levelKey, color, recommendationKeys });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Heart className="w-4 h-4 text-destructive" />
          </div>
          {t('healthCalculators.cardio.title')}
          <Badge variant="outline" className="text-[10px] ml-auto">{t('healthCalculators.cardio.badge')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.age')}</Label>
            <Input type="number" placeholder="45" value={age} onChange={e => setAge(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.sex')}</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t('healthCalculators.common.male')}</SelectItem>
                <SelectItem value="female">{t('healthCalculators.common.female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.cardio.systolic')}</Label>
            <Input type="number" placeholder="120" value={systolic} onChange={e => setSystolic(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.cardio.totalCholesterol')}</Label>
            <Input type="number" placeholder="200" value={cholesterol} onChange={e => setCholesterol(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.cardio.hdl')}</Label>
            <Input type="number" placeholder="50" value={hdl} onChange={e => setHdl(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'smoker', labelKey: 'smoker', value: smoker, set: setSmoker },
            { key: 'diabetic', labelKey: 'diabetic', value: diabetic, set: setDiabetic },
            { key: 'hypertensive', labelKey: 'hypertensive', value: hypertensive, set: setHypertensive },
          ].map(f => (
            <div key={f.key}>
              <Label className="text-[10px] text-muted-foreground">{t(`healthCalculators.cardio.factors.${f.labelKey}`)}</Label>
              <Select value={f.value} onValueChange={f.set}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">{t('healthCalculators.common.no')}</SelectItem>
                  <SelectItem value="yes">{t('healthCalculators.common.yes')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <Button onClick={calculate} size="sm" className="w-full gap-2">
          <TrendingUp className="w-3.5 h-3.5" /> {t('healthCalculators.cardio.calculateButton')}
        </Button>

        {result && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <path
                      d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                      fill="none"
                      stroke="hsl(var(--border))"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                      fill="none"
                      stroke={result.risk < 5 ? 'hsl(var(--success))' : result.risk < 10 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(result.risk * 2.5, 100)}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold">{result.risk}%</span>
                  </div>
                </div>
                <div>
                  <p className={`font-semibold ${result.color}`}>{t('healthCalculators.cardio.riskLabel').replace('{{level}}', t(`healthCalculators.cardio.levels.${result.levelKey}`))}</p>
                  <p className="text-[10px] text-muted-foreground">{t('healthCalculators.cardio.riskCaption')}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">{t('healthCalculators.cardio.recommendationsTitle')}</p>
              {result.recommendationKeys.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <span>{t(`healthCalculators.cardio.recommendations.${r}`)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Glasgow Coma Scale — enhanced visual
// ═══════════════════════════════════════════════════
function GlasgowScale() {
  const { t } = useLanguage();
  const [eye, setEye] = useState(4);
  const [verbal, setVerbal] = useState(5);
  const [motor, setMotor] = useState(6);
  const total = eye + verbal + motor;

  let severity = '', color = '', bgColor = '';
  if (total <= 8) { severity = t('healthCalculators.glasgow.severity.severe'); color = 'text-destructive'; bgColor = 'bg-destructive/10'; }
  else if (total <= 12) { severity = t('healthCalculators.glasgow.severity.moderate'); color = 'text-warning'; bgColor = 'bg-warning dark:bg-warning/20'; }
  else { severity = t('healthCalculators.glasgow.severity.mild'); color = 'text-success'; bgColor = 'bg-success dark:bg-success/20'; }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-info" />
          </div>
          {t('healthCalculators.glasgow.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          {
            key: 'eye', label: t('healthCalculators.glasgow.sections.eye'), val: eye, set: setEye, max: 4,
            opts: [4, 3, 2, 1].map(v => ({ v, l: t(`healthCalculators.glasgow.eyeOpts.${v}`) })),
          },
          {
            key: 'verbal', label: t('healthCalculators.glasgow.sections.verbal'), val: verbal, set: setVerbal, max: 5,
            opts: [5, 4, 3, 2, 1].map(v => ({ v, l: t(`healthCalculators.glasgow.verbalOpts.${v}`) })),
          },
          {
            key: 'motor', label: t('healthCalculators.glasgow.sections.motor'), val: motor, set: setMotor, max: 6,
            opts: [6, 5, 4, 3, 2, 1].map(v => ({ v, l: t(`healthCalculators.glasgow.motorOpts.${v}`) })),
          },
        ].map(section => (
          <div key={section.key}>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">{section.label}</Label>
              <Badge variant="secondary" className="text-[10px]">{section.val}/{section.max}</Badge>
            </div>
            <Select value={String(section.val)} onValueChange={v => section.set(Number(v))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {section.opts.map(o => (
                  <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.v} — {o.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className={`p-4 rounded-xl ${bgColor} border border-border text-center`}>
          <p className="text-3xl font-bold text-foreground">{total}<span className="text-sm font-normal text-muted-foreground">/15</span></p>
          <p className={`text-sm font-semibold mt-1 ${color}`}>{severity}</p>
          <div className="mt-2">
            <Progress value={(total / 15) * 100} className="h-2" />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
            <span>{t('healthCalculators.glasgow.scaleLabels.severe')}</span><span>8</span><span>12</span><span>{t('healthCalculators.glasgow.scaleLabels.normal')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Body Surface Area (Mosteller)
// ═══════════════════════════════════════════════════
function BodySurfaceArea() {
  const { t } = useLanguage();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w) return;
    // Mosteller formula
    const bsa = Math.sqrt((h * w) / 3600);
    setResult(Math.round(bsa * 100) / 100);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Ruler className="w-4 h-4 text-secondary" />
          </div>
          {t('healthCalculators.bsa.title')}
          <Badge variant="outline" className="text-[10px] ml-auto">{t('healthCalculators.bsa.badge')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.height')}</Label>
            <Input type="number" placeholder="170" value={height} onChange={e => setHeight(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.weight')}</Label>
            <Input type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Button onClick={calculate} size="sm" className="w-full">{t('healthCalculators.common.calculate')}</Button>
        {result !== null && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border text-center">
            <p className="text-3xl font-bold text-foreground">{result} <span className="text-sm font-normal text-muted-foreground">{t('healthCalculators.bsa.unit')}</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('healthCalculators.bsa.normalAdult')} · {result < 1.7 ? t('healthCalculators.bsa.below') : result > 2.0 ? t('healthCalculators.bsa.above') : t('healthCalculators.bsa.within')} {t('healthCalculators.bsa.ofRange')}
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {t('healthCalculators.bsa.formula')}
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Creatinine Clearance (Cockcroft-Gault)
// ═══════════════════════════════════════════════════
function CreatinineClearance() {
  const { t } = useLanguage();
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [creatinine, setCreatinine] = useState('');
  const [sex, setSex] = useState('male');
  const [result, setResult] = useState<{ clcr: number; stageKey: string; color: string } | null>(null);

  const calculate = () => {
    const a = parseInt(age);
    const w = parseFloat(weight);
    const cr = parseFloat(creatinine);
    if (!a || !w || !cr || cr <= 0) return;

    let clcr = ((140 - a) * w) / (72 * cr);
    if (sex === 'female') clcr *= 0.85;

    let stageKey = '', color = '';
    if (clcr >= 90) { stageKey = 'g1'; color = 'text-success'; }
    else if (clcr >= 60) { stageKey = 'g2'; color = 'text-warning'; }
    else if (clcr >= 30) { stageKey = 'g3'; color = 'text-warning'; }
    else if (clcr >= 15) { stageKey = 'g4'; color = 'text-destructive'; }
    else { stageKey = 'g5'; color = 'text-destructive'; }

    setResult({ clcr: Math.round(clcr * 10) / 10, stageKey, color });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-warning" />
          </div>
          {t('healthCalculators.renal.title')}
          <Badge variant="outline" className="text-[10px] ml-auto">{t('healthCalculators.renal.badge')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.age')}</Label>
            <Input type="number" placeholder="45" value={age} onChange={e => setAge(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.weight')}</Label>
            <Input type="number" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.renal.creatinine')}</Label>
            <Input type="number" placeholder="1.0" step="0.1" value={creatinine} onChange={e => setCreatinine(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.sex')}</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t('healthCalculators.common.male')}</SelectItem>
                <SelectItem value="female">{t('healthCalculators.common.female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={calculate} size="sm" className="w-full">{t('healthCalculators.common.calculate')}</Button>
        {result && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border text-center">
            <p className="text-3xl font-bold text-foreground">{result.clcr} <span className="text-sm font-normal text-muted-foreground">{t('healthCalculators.renal.unit')}</span></p>
            <p className={`text-sm font-semibold mt-1 ${result.color}`}>{t(`healthCalculators.renal.stages.${result.stageKey}`)}</p>
            <div className="mt-2">
              <Progress value={Math.min((result.clcr / 120) * 100, 100)} className="h-2" />
            </div>
          </div>
        )}

        {/* KDIGO stages table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
            <p className="text-[10px] font-semibold text-foreground">{t('healthCalculators.renal.stagesTitle')}</p>
          </div>
          <div className="divide-y divide-border text-[10px]">
            {[
              { stage: 'G1', range: '≥90', labelKey: 'g1', c: 'bg-success' },
              { stage: 'G2', range: '60–89', labelKey: 'g2', c: 'bg-warning' },
              { stage: 'G3a', range: '45–59', labelKey: 'g3a', c: 'bg-warning' },
              { stage: 'G3b', range: '30–44', labelKey: 'g3b', c: 'bg-warning' },
              { stage: 'G4', range: '15–29', labelKey: 'g4', c: 'bg-destructive' },
              { stage: 'G5', range: '<15', labelKey: 'g5', c: 'bg-destructive' },
            ].map(s => (
              <div key={s.stage} className="flex items-center px-3 py-1.5">
                <div className={`w-2 h-2 rounded-full ${s.c} mr-2`} />
                <span className="font-mono font-medium w-8">{s.stage}</span>
                <span className="flex-1">{t(`healthCalculators.renal.kdigo.${s.labelKey}`)}</span>
                <span className="text-muted-foreground tabular-nums">{s.range} {t('healthCalculators.renal.unit')}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Pediatric Dosing Calculator
// ═══════════════════════════════════════════════════
function PediatricDosing() {
  const { t } = useLanguage();
  const [weight, setWeight] = useState('');
  const [dosePerKg, setDosePerKg] = useState('');
  const [frequency, setFrequency] = useState('8');
  const [concentration, setConcentration] = useState('');

  const result = React.useMemo(() => {
    const w = parseFloat(weight);
    const d = parseFloat(dosePerKg);
    if (!w || !d || w <= 0 || d <= 0) return null;
    const dose = Math.round(w * d * 10) / 10;
    const freq = 24 / parseInt(frequency || '8');
    const dailyDose = Math.round(dose * freq * 10) / 10;
    const conc = parseFloat(concentration);
    const volume = conc && conc > 0 ? Math.round((dose / conc) * 10) / 10 : undefined;
    return { dose, dailyDose, volume };
  }, [weight, dosePerKg, frequency, concentration]);

  const calculate = () => { /* no-op: reactivo */ };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Baby className="w-4 h-4 text-accent" />
          </div>
          {t('healthCalculators.pediatric.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.weight')}</Label>
            <Input type="number" placeholder="15" value={weight} onChange={e => setWeight(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.pediatric.dosePerKg')}</Label>
            <Input type="number" placeholder="10" step="0.5" value={dosePerKg} onChange={e => setDosePerKg(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.pediatric.everyHours')}</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4">{t('healthCalculators.pediatric.frequencies.4')}</SelectItem>
                <SelectItem value="6">{t('healthCalculators.pediatric.frequencies.6')}</SelectItem>
                <SelectItem value="8">{t('healthCalculators.pediatric.frequencies.8')}</SelectItem>
                <SelectItem value="12">{t('healthCalculators.pediatric.frequencies.12')}</SelectItem>
                <SelectItem value="24">{t('healthCalculators.pediatric.frequencies.24')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.pediatric.concentration')}</Label>
            <Input type="number" placeholder={t('healthCalculators.pediatric.concentrationPlaceholder')} step="0.1" value={concentration} onChange={e => setConcentration(e.target.value)} className="mt-1" />
          </div>
        </div>
        <Button onClick={calculate} size="sm" className="w-full">{t('healthCalculators.pediatric.calculateButton')}</Button>
        {result && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{result.dose}</p>
                <p className="text-[10px] text-muted-foreground">{t('healthCalculators.pediatric.mgPerDose')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{result.dailyDose}</p>
                <p className="text-[10px] text-muted-foreground">{t('healthCalculators.pediatric.mgPerDay')}</p>
              </div>
            </div>
            {result.volume !== undefined && (
              <div className="text-center mt-3 pt-3 border-t border-border">
                <p className="text-lg font-bold text-primary">{result.volume} mL</p>
                <p className="text-[10px] text-muted-foreground">{t('healthCalculators.pediatric.volumePerDose')}</p>
              </div>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-warning" />
          {t('healthCalculators.pediatric.warning')}
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Ideal Body Weight (Devine)
// ═══════════════════════════════════════════════════
function IdealBodyWeight() {
  const { t } = useLanguage();
  const [height, setHeight] = useState('');
  const [sex, setSex] = useState('male');

  const h = parseFloat(height);
  let ibw: number | null = null;
  let abw: string = '';

  if (h && h > 100) {
    const inches = (h - 152.4) / 2.54;
    ibw = sex === 'male'
      ? Math.round((50 + 2.3 * Math.max(inches, 0)) * 10) / 10
      : Math.round((45.5 + 2.3 * Math.max(inches, 0)) * 10) / 10;
    const min = Math.round(ibw * 0.9 * 10) / 10;
    const max = Math.round(ibw * 1.1 * 10) / 10;
    abw = `${min}–${max}`;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <Scale className="w-4 h-4 text-success" />
          </div>
          {t('healthCalculators.ibw.title')}
          <Badge variant="outline" className="text-[10px] ml-auto">{t('healthCalculators.ibw.badge')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.height')}</Label>
            <Input type="number" placeholder="170" value={height} onChange={e => setHeight(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('healthCalculators.common.sex')}</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t('healthCalculators.common.male')}</SelectItem>
                <SelectItem value="female">{t('healthCalculators.common.female')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {ibw !== null && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border text-center">
            <p className="text-3xl font-bold text-foreground">{ibw} <span className="text-sm font-normal text-muted-foreground">{t('healthCalculators.ibw.unit')}</span></p>
            <p className="text-xs text-muted-foreground mt-1">{t('healthCalculators.ibw.acceptableRange').replace('{{range}}', abw)}</p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {t('healthCalculators.ibw.formulaNote')}
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// Main Export — Tabbed layout like QuirónSalud
// ═══════════════════════════════════════════════════
export function HealthCalculators() {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-heading font-semibold text-base">{t('healthCalculators.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('healthCalculators.subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="imc" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-5 gap-1 h-auto p-1">
          <TabsTrigger value="imc" className="text-[10px] sm:text-xs gap-1 py-1.5">
            <Scale className="w-3 h-3" /> {t('healthCalculators.tabs.imc')}
          </TabsTrigger>
          <TabsTrigger value="cardio" className="text-[10px] sm:text-xs gap-1 py-1.5">
            <Heart className="w-3 h-3" /> {t('healthCalculators.tabs.cardio')}
          </TabsTrigger>
          <TabsTrigger value="renal" className="text-[10px] sm:text-xs gap-1 py-1.5">
            <Droplets className="w-3 h-3" /> {t('healthCalculators.tabs.renal')}
          </TabsTrigger>
          <TabsTrigger value="pediatric" className="text-[10px] sm:text-xs gap-1 py-1.5">
            <Baby className="w-3 h-3" /> {t('healthCalculators.tabs.pediatric')}
          </TabsTrigger>
          <TabsTrigger value="weight" className="text-[10px] sm:text-xs gap-1 py-1.5">
            <Ruler className="w-3 h-3" /> {t('healthCalculators.tabs.weight')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="imc">
          <BMICalculator />
        </TabsContent>
        <TabsContent value="cardio">
          <CardiovascularRisk />
        </TabsContent>
        <TabsContent value="renal">
          <CreatinineClearance />
        </TabsContent>
        <TabsContent value="pediatric">
          <PediatricDosing />
        </TabsContent>
        <TabsContent value="weight" className="grid gap-4 md:grid-cols-2">
          <IdealBodyWeight />
          <BodySurfaceArea />
        </TabsContent>
      </Tabs>
    </div>
  );
}
