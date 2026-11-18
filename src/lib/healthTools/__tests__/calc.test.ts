import { describe, expect, it } from 'vitest';
import {
  bmi, bmiCategory, healthyWeightRange, devineIdealWeight, bmrMifflin, dailyCalories,
  waistRisk, waistToHeight, waterIntake, dueDate, gestationalAge, trimester, fertileCycles,
  pregnancyWeightGain, pregnancyGainAtWeek, phq9Severity, gad7Severity, epdsLevel,
} from '../calc';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('IMC y peso', () => {
  it('calcula el IMC y su categoría OMS', () => {
    expect(bmi(70, 170)).toBe(24.2);
    expect(bmiCategory(24.2)).toBe('normal');
    expect(bmiCategory(18.4)).toBe('under');
    expect(bmiCategory(25)).toBe('over');
    expect(bmiCategory(30)).toBe('obese1');
    expect(bmiCategory(35)).toBe('obese2');
    expect(bmiCategory(40)).toBe('obese3');
    expect(bmi(0, 170)).toBeNull();
  });
  it('rango saludable y Devine', () => {
    expect(healthyWeightRange(170)).toEqual({ min: 53.5, max: 72 });
    expect(devineIdealWeight(170, 'male')).toBe(65.9);
    expect(devineIdealWeight(160, 'female')).toBe(52.4);
  });
});

describe('Calorías', () => {
  it('Mifflin-St Jeor', () => {
    // 10·70 + 6,25·170 − 5·30 + 5 = 1617,5 → 1618
    expect(bmrMifflin(70, 170, 30, 'male')).toBe(1618);
    expect(bmrMifflin(60, 160, 30, 'female')).toBe(1289);
    const c = dailyCalories(70, 170, 30, 'male', 'moderate')!;
    expect(c.maintain).toBe(Math.round(1618 * 1.55));
    expect(c.lose).toBe(c.maintain - 500);
    expect(c.gain).toBe(c.maintain + 500);
  });
});

describe('Cintura y agua', () => {
  it('riesgo por cintura', () => {
    expect(waistRisk(79, 'female')).toBe('low');
    expect(waistRisk(85, 'female')).toBe('increased');
    expect(waistRisk(90, 'female')).toBe('high');
    expect(waistRisk(100, 'male')).toBe('increased');
    expect(waistToHeight(85, 170)).toBe(0.5);
  });
  it('agua diaria', () => {
    expect(waterIntake(70)).toEqual({ liters: 2.5, glasses: 10 });
  });
});

describe('Embarazo y fertilidad', () => {
  it('Naegele', () => {
    expect(ymd(dueDate(new Date(2026, 0, 1)))).toBe('2026-10-08');
    expect(ymd(dueDate(new Date(2026, 0, 1), 30))).toBe('2026-10-10');
  });
  it('edad gestacional y trimestre', () => {
    const g = gestationalAge(new Date(2026, 0, 1), new Date(2026, 2, 5));
    expect(g).toEqual({ weeks: 9, days: 0, totalDays: 63 });
    expect(trimester(9)).toBe(1);
    expect(trimester(20)).toBe(2);
    expect(trimester(30)).toBe(3);
  });
  it('días fértiles', () => {
    const [c] = fertileCycles(new Date(2026, 0, 1), 28, 1);
    expect(ymd(c.ovulation)).toBe('2026-01-15');
    expect(ymd(c.fertileStart)).toBe('2026-01-10');
    expect(ymd(c.fertileEnd)).toBe('2026-01-16');
    expect(ymd(c.nextPeriod)).toBe('2026-01-29');
  });
  it('aumento de peso IOM 2009', () => {
    expect(pregnancyWeightGain(17)).toEqual({ min: 12.5, max: 18 });
    expect(pregnancyWeightGain(22)).toEqual({ min: 11.5, max: 16 });
    expect(pregnancyWeightGain(27)).toEqual({ min: 7, max: 11.5 });
    expect(pregnancyWeightGain(32)).toEqual({ min: 5, max: 9 });
    expect(pregnancyGainAtWeek(22, 40)).toEqual({ min: 11.5, max: 16 });
    expect(pregnancyGainAtWeek(22, 0)).toEqual({ min: 0, max: 0 });
  });
});

describe('Cuestionarios', () => {
  it('cortes PHQ-9, GAD-7 y EPDS', () => {
    expect(phq9Severity(4)).toBe('minimal');
    expect(phq9Severity(10)).toBe('moderate');
    expect(phq9Severity(19)).toBe('modSevere');
    expect(phq9Severity(20)).toBe('severe');
    expect(gad7Severity(9)).toBe('mild');
    expect(gad7Severity(15)).toBe('severe');
    expect(epdsLevel(9)).toBe('low');
    expect(epdsLevel(10)).toBe('possible');
    expect(epdsLevel(13)).toBe('probable');
  });
});
