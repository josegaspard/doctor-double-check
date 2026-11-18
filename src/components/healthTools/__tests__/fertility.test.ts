import { describe, expect, it } from 'vitest';
import { fertilityVerdict } from '../FertilityCheck';

const base = { age: 'lt35', time: 'lt6', cycles: 'no', conditions: 'no', losses: 'no', partner: 'no', cancer: 'no' };
describe('Test de fertilidad (NICE/ASRM)', () => {
  it('menor de 35 sin motivos: seguir 12 meses', () => {
    expect(fertilityVerdict(base)).toEqual({ level: 'wait', months: 12, reasons: [] });
  });
  it('35–39 con menos de 6 meses: seguir 6 meses', () => {
    expect(fertilityVerdict({ ...base, age: '35to39' }).months).toBe(6);
  });
  it('35–39 con 6–12 meses: consultar ya', () => {
    expect(fertilityVerdict({ ...base, age: '35to39', time: '6to12' })).toMatchObject({ level: 'now', reasons: ['age35time'] });
  });
  it('40 o más, más de un año o un factor: consultar ya', () => {
    expect(fertilityVerdict({ ...base, age: 'ge40' }).level).toBe('now');
    expect(fertilityVerdict({ ...base, time: 'gt12' }).reasons).toEqual(['time12']);
    expect(fertilityVerdict({ ...base, cycles: 'yes', partner: 'yes' }).reasons).toEqual(['cycles', 'partner']);
  });
  it('datos desconocidos: revisión', () => {
    expect(fertilityVerdict({ ...base, partner: 'unknown', time: '6to12' })).toEqual({ level: 'soon', months: 6, reasons: [] });
  });
});
