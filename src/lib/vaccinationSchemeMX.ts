// Esquema oficial de vacunación en México (Secretaría de Salud / SSA)
// Referencia: cartillas nacionales 2024-2025

export type AgeUnit = 'days' | 'months' | 'years';

export interface VaccineDose {
  doseNumber: number;
  label: string;
  ageMonths: number; // edad mínima sugerida en meses para esta dosis
}

export interface VaccineDef {
  key: string;
  name: string;
  description?: string;
  ageGroup: '0-9' | '10-19' | '20+' | 'all';
  doses: VaccineDose[];
}

// Helpers
const m = (n: number) => n;
const y = (n: number) => n * 12;

export const VACCINATION_SCHEME_MX: VaccineDef[] = [
  // ---------- 0–9 años ----------
  {
    key: 'bcg',
    name: 'BCG',
    description: 'Tuberculosis (forma grave)',
    ageGroup: '0-9',
    doses: [{ doseNumber: 1, label: 'Dosis única', ageMonths: m(0) }],
  },
  {
    key: 'hepatitis-b',
    name: 'Hepatitis B',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: 'Recién nacido', ageMonths: m(0) },
      { doseNumber: 2, label: '2 meses', ageMonths: m(2) },
      { doseNumber: 3, label: '6 meses', ageMonths: m(6) },
    ],
  },
  {
    key: 'hexavalente',
    name: 'Hexavalente acelular',
    description: 'DPaT + VPI + Hib + Hep B',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: '2 meses', ageMonths: m(2) },
      { doseNumber: 2, label: '4 meses', ageMonths: m(4) },
      { doseNumber: 3, label: '6 meses', ageMonths: m(6) },
      { doseNumber: 4, label: '18 meses', ageMonths: m(18) },
    ],
  },
  {
    key: 'rotavirus',
    name: 'Rotavirus',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: '2 meses', ageMonths: m(2) },
      { doseNumber: 2, label: '4 meses', ageMonths: m(4) },
      { doseNumber: 3, label: '6 meses', ageMonths: m(6) },
    ],
  },
  {
    key: 'antineumococica-conjugada',
    name: 'Antineumocócica conjugada',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: '2 meses', ageMonths: m(2) },
      { doseNumber: 2, label: '4 meses', ageMonths: m(4) },
      { doseNumber: 3, label: '12 meses', ageMonths: m(12) },
    ],
  },
  {
    key: 'influenza-pediatrica',
    name: 'Influenza estacional',
    description: 'Anual',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: '6 meses', ageMonths: m(6) },
      { doseNumber: 2, label: 'Refuerzo anual', ageMonths: m(7) },
    ],
  },
  {
    key: 'srp',
    name: 'SRP (Triple viral)',
    description: 'Sarampión, Rubéola, Parotiditis',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: '12 meses', ageMonths: m(12) },
      { doseNumber: 2, label: '6 años', ageMonths: y(6) },
    ],
  },
  {
    key: 'varicela',
    name: 'Anti-varicela',
    ageGroup: '0-9',
    doses: [{ doseNumber: 1, label: '12 meses', ageMonths: m(12) }],
  },
  {
    key: 'covid-pediatrico',
    name: 'COVID-19 pediátrico',
    ageGroup: '0-9',
    doses: [
      { doseNumber: 1, label: 'Primera', ageMonths: m(6) },
      { doseNumber: 2, label: 'Segunda', ageMonths: m(7) },
    ],
  },
  // ---------- 10–19 años ----------
  {
    key: 'vph',
    name: 'VPH (Virus del Papiloma Humano)',
    ageGroup: '10-19',
    doses: [
      { doseNumber: 1, label: '11 años', ageMonths: y(11) },
      { doseNumber: 2, label: '6 meses después', ageMonths: y(11) + 6 },
    ],
  },
  {
    key: 'tdpa',
    name: 'Tdpa',
    description: 'Tétanos, difteria, tos ferina acelular',
    ageGroup: '10-19',
    doses: [{ doseNumber: 1, label: 'Adolescentes / embarazadas', ageMonths: y(12) }],
  },
  {
    key: 'sr-adolescente',
    name: 'SR (Sarampión-Rubéola)',
    ageGroup: '10-19',
    doses: [{ doseNumber: 1, label: 'Refuerzo adolescente', ageMonths: y(12) }],
  },
  // ---------- 20+ años ----------
  {
    key: 'td',
    name: 'Td',
    description: 'Tétanos y difteria — refuerzo cada 10 años',
    ageGroup: '20+',
    doses: [{ doseNumber: 1, label: 'Cada 10 años', ageMonths: y(20) }],
  },
  {
    key: 'hep-b-adulto',
    name: 'Hepatitis B (adulto)',
    ageGroup: '20+',
    doses: [
      { doseNumber: 1, label: '0 meses', ageMonths: y(20) },
      { doseNumber: 2, label: '1 mes', ageMonths: y(20) + 1 },
      { doseNumber: 3, label: '6 meses', ageMonths: y(20) + 6 },
    ],
  },
  {
    key: 'influenza-adulto',
    name: 'Influenza estacional (adulto)',
    description: 'Anual',
    ageGroup: '20+',
    doses: [{ doseNumber: 1, label: 'Anual', ageMonths: y(20) }],
  },
  {
    key: 'covid-adulto',
    name: 'COVID-19 (adulto)',
    ageGroup: '20+',
    doses: [
      { doseNumber: 1, label: 'Primera', ageMonths: y(18) },
      { doseNumber: 2, label: 'Segunda', ageMonths: y(18) },
      { doseNumber: 3, label: 'Refuerzos', ageMonths: y(18) },
    ],
  },
  {
    key: 'antineumococica-13v',
    name: 'Antineumocócica 13v',
    description: 'Adultos mayores y grupos de riesgo',
    ageGroup: '20+',
    doses: [{ doseNumber: 1, label: '60+ años', ageMonths: y(60) }],
  },
];

export function getAgeMonths(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

export function getApplicableVaccines(ageMonths: number | null): VaccineDef[] {
  if (ageMonths === null) return VACCINATION_SCHEME_MX;
  if (ageMonths < y(10)) return VACCINATION_SCHEME_MX.filter(v => v.ageGroup === '0-9' || v.ageGroup === 'all');
  if (ageMonths < y(20)) return VACCINATION_SCHEME_MX.filter(v => v.ageGroup === '10-19' || v.ageGroup === 'all');
  return VACCINATION_SCHEME_MX.filter(v => v.ageGroup === '20+' || v.ageGroup === 'all');
}
