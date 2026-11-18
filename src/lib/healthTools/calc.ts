// Herramientas de salud (18-nov-2026): fórmulas puras, sin React ni textos.
//
// Cada función devuelve números o claves (no frases) para que los 8 idiomas
// salgan del diccionario de la herramienta y no de aquí. Todas las fuentes son
// públicas y se citan junto a cada función; los resultados son orientativos y
// la interfaz lo dice siempre al lado del resultado.

export type Sex = 'female' | 'male';

const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86_400_000;

/** Fecha local a medianoche (evita que el cambio de horario mueva un día). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function addDays(d: Date, days: number): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() + days);
  return r;
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

// ---------------------------------------------------------------------------
// IMC (OMS): peso (kg) / estatura (m)². Clasificación de la OMS para adultos.
// ---------------------------------------------------------------------------
export type BmiCategory = 'under' | 'normal' | 'over' | 'obese1' | 'obese2' | 'obese3';

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'under';
  if (value < 25) return 'normal';
  if (value < 30) return 'over';
  if (value < 35) return 'obese1';
  if (value < 40) return 'obese2';
  return 'obese3';
}

/** Posición 0–1 del IMC en la barra 15–40 (para pintar el marcador). */
export function bmiGaugePosition(value: number): number {
  return Math.min(1, Math.max(0, (value - 15) / 25));
}

// ---------------------------------------------------------------------------
// Peso saludable: el rango que da IMC 18,5–24,9 para esa estatura (OMS) y,
// como referencia, la fórmula de Devine (1974), que usan muchas calculadoras.
// ---------------------------------------------------------------------------
export function healthyWeightRange(heightCm: number): { min: number; max: number } | null {
  if (!(heightCm > 0)) return null;
  const m2 = (heightCm / 100) ** 2;
  return { min: round1(18.5 * m2), max: round1(24.9 * m2) };
}

export function devineIdealWeight(heightCm: number, sex: Sex): number | null {
  if (!(heightCm > 0)) return null;
  const inchesOver5ft = heightCm / 2.54 - 60;
  const base = sex === 'male' ? 50 : 45.5;
  return round1(Math.max(base + 2.3 * inchesOver5ft, 0));
}

// ---------------------------------------------------------------------------
// Calorías: metabolismo basal de Mifflin-St Jeor (1990) × factor de actividad.
// ---------------------------------------------------------------------------
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: Sex): number | null {
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  const v = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  return Math.round(v);
}

export function dailyCalories(
  weightKg: number, heightCm: number, age: number, sex: Sex, activity: ActivityLevel,
): { bmr: number; maintain: number; lose: number; gain: number } | null {
  const b = bmrMifflin(weightKg, heightCm, age, sex);
  if (b === null) return null;
  const maintain = Math.round(b * ACTIVITY_FACTORS[activity]);
  // Déficit/superávit moderado de 500 kcal; nunca por debajo del basal.
  return { bmr: b, maintain, lose: Math.max(b, maintain - 500), gain: maintain + 500 };
}

// ---------------------------------------------------------------------------
// Cintura: riesgo cardiometabólico por perímetro (OMS 2008) e índice
// cintura/estatura (≥ 0,5 = riesgo; Ashwell, 2012).
// ---------------------------------------------------------------------------
export type WaistRisk = 'low' | 'increased' | 'high';

export function waistRisk(waistCm: number, sex: Sex): WaistRisk | null {
  if (!(waistCm > 0)) return null;
  const [inc, high] = sex === 'male' ? [94, 102] : [80, 88];
  if (waistCm >= high) return 'high';
  if (waistCm >= inc) return 'increased';
  return 'low';
}

export function waistToHeight(waistCm: number, heightCm: number): number | null {
  if (!(waistCm > 0) || !(heightCm > 0)) return null;
  return Math.round((waistCm / heightCm) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Agua: 30–35 ml por kg de peso al día (referencia general en adultos sanos).
// ---------------------------------------------------------------------------
export function waterIntake(weightKg: number, activeMinutes = 0): { liters: number; glasses: number } | null {
  if (!(weightKg > 0)) return null;
  const ml = weightKg * 35 + Math.max(0, activeMinutes) * 12; // ~350 ml por cada 30 min de ejercicio
  const liters = Math.round(ml / 100) / 10;
  return { liters, glasses: Math.round(ml / 250) };
}

// ---------------------------------------------------------------------------
// Embarazo: regla de Naegele ajustada a la duración del ciclo.
// FPP = FUM + 280 días + (ciclo − 28).
// ---------------------------------------------------------------------------
export function dueDate(lmp: Date, cycleDays = 28): Date {
  return addDays(lmp, 280 + (cycleDays - 28));
}

export function gestationalAge(lmp: Date, today: Date, cycleDays = 28): { weeks: number; days: number; totalDays: number } {
  const total = daysBetween(lmp, today) - (cycleDays - 28);
  const t = Math.max(0, total);
  return { weeks: Math.floor(t / 7), days: t % 7, totalDays: total };
}

export function trimester(weeks: number): 1 | 2 | 3 {
  if (weeks < 14) return 1;
  if (weeks < 28) return 2;
  return 3;
}

/** Hitos habituales del control prenatal (semanas desde la FUM). */
export const PREGNANCY_MILESTONES = [
  { id: 'firstVisit', fromWeek: 6, toWeek: 10 },
  { id: 'nuchal', fromWeek: 11, toWeek: 14 },
  { id: 'anatomy', fromWeek: 18, toWeek: 22 },
  { id: 'glucose', fromWeek: 24, toWeek: 28 },
  { id: 'growth', fromWeek: 28, toWeek: 32 },
  { id: 'gbs', fromWeek: 35, toWeek: 37 },
  { id: 'term', fromWeek: 37, toWeek: 42 },
] as const;

// ---------------------------------------------------------------------------
// Fertilidad: la ovulación cae ~14 días antes de la regla siguiente; la
// ventana fértil va de 5 días antes a 1 día después de la ovulación.
// ---------------------------------------------------------------------------
export function fertileCycles(lmp: Date, cycleDays = 28, count = 3) {
  const out: { periodStart: Date; ovulation: Date; fertileStart: Date; fertileEnd: Date; nextPeriod: Date }[] = [];
  for (let i = 0; i < count; i++) {
    const periodStart = addDays(lmp, i * cycleDays);
    const nextPeriod = addDays(periodStart, cycleDays);
    const ovulation = addDays(nextPeriod, -14);
    out.push({ periodStart, ovulation, fertileStart: addDays(ovulation, -5), fertileEnd: addDays(ovulation, 1), nextPeriod });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aumento de peso recomendado en el embarazo según el IMC previo
// (Institute of Medicine, 2009; embarazo de un solo bebé y de gemelos).
// ---------------------------------------------------------------------------
export function pregnancyWeightGain(prePregnancyBmi: number, twins = false): { min: number; max: number } {
  const c = bmiCategory(prePregnancyBmi);
  if (twins) {
    if (c === 'under' || c === 'normal') return { min: 17, max: 25 };
    if (c === 'over') return { min: 14, max: 23 };
    return { min: 11, max: 19 };
  }
  if (c === 'under') return { min: 12.5, max: 18 };
  if (c === 'normal') return { min: 11.5, max: 16 };
  if (c === 'over') return { min: 7, max: 11.5 };
  return { min: 5, max: 9 };
}

/** Rango esperado a la semana dada (≈0,5–2 kg en el 1.er trimestre, lineal después). */
export function pregnancyGainAtWeek(prePregnancyBmi: number, week: number, twins = false): { min: number; max: number } {
  const total = pregnancyWeightGain(prePregnancyBmi, twins);
  const w = Math.min(40, Math.max(0, week));
  if (w <= 13) {
    const f = w / 13;
    return { min: round1(0.5 * f), max: round1(2 * f) };
  }
  const f = (w - 13) / 27;
  return { min: round1(0.5 + (total.min - 0.5) * f), max: round1(2 + (total.max - 2) * f) };
}

// ---------------------------------------------------------------------------
// Cuestionarios validados y de dominio público:
//   PHQ-9 (ánimo, Kroenke 2001) · GAD-7 (ansiedad, Spitzer 2006) ·
//   EPDS (depresión posparto, Cox 1987; 10 preguntas: la 1, 2 y 4 puntúan
//   0→3 en el orden de las respuestas y el resto 3→0; ver Questionnaires.tsx).
// ---------------------------------------------------------------------------
export type Severity = 'minimal' | 'mild' | 'moderate' | 'modSevere' | 'severe';

export function phq9Severity(score: number): Severity {
  if (score <= 4) return 'minimal';
  if (score <= 9) return 'mild';
  if (score <= 14) return 'moderate';
  if (score <= 19) return 'modSevere';
  return 'severe';
}

export function gad7Severity(score: number): Exclude<Severity, 'modSevere'> {
  if (score <= 4) return 'minimal';
  if (score <= 9) return 'mild';
  if (score <= 14) return 'moderate';
  return 'severe';
}

export type EpdsLevel = 'low' | 'possible' | 'probable';
export function epdsLevel(score: number): EpdsLevel {
  if (score >= 13) return 'probable';
  if (score >= 10) return 'possible';
  return 'low';
}

export const sum = (answers: (number | null)[]) => answers.reduce<number>((a, b) => a + (b ?? 0), 0);
export const allAnswered = (answers: (number | null)[]) => answers.every(a => a !== null);
