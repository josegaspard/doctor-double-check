// IMC calculado solo a partir de la estatura y el peso del expediente
// (18-nov-2026). Lo ven el médico en la ficha del paciente y el paciente en su
// expediente mientras escribe. Si falta un dato no pinta nada.
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { bmi, bmiCategory } from '@/lib/healthTools/calc';
import { fmt, useHealthToolsText } from '@/lib/healthTools/i18n';
import { bmiTone } from './NutritionTools';
import '@/styles/herramientas.css';

export default function BmiChip({ heightCm, weightKg, showToolsLink = false }: {
  heightCm: number | string | null | undefined; weightKg: number | string | null | undefined; showToolsLink?: boolean;
}) {
  const { ht, locale } = useHealthToolsText();
  const v = bmi(Number(String(weightKg ?? '').replace(',', '.')), Number(String(heightCm ?? '').replace(',', '.')));
  if (v === null || v < 8 || v > 90) return null;
  const cat = bmiCategory(v);
  return (
    <span className="ht-bmi-wrap">
      <span className={`ht-bmi-chip ht-tone-${bmiTone(cat)}`}>
        {ht('doctor.bmiLabel', { b: fmt(v, locale), cat: ht(`bmi.cat_${cat}`) })}
      </span>
      {showToolsLink && (
        <Link to="/herramientas" className="pro-link ht-bmi-link">
          <Calculator className="w-3.5 h-3.5" aria-hidden="true" />{ht('doctor.tools')}
        </Link>
      )}
    </span>
  );
}
