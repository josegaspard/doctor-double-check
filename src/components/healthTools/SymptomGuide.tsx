// Orientador de salud: síntoma o zona → especialidad sugerida → directorio.
// Las especialidades son las de la base (lib/specialties.ts); el enlace usa la
// búsqueda del directorio (?search=), que encuentra todas sus variantes.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Siren } from 'lucide-react';
import type { HT } from '@/lib/healthTools/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { SPECIALTIES_FILTER } from '@/lib/specialties';
import { Note, Segmented, ToolFooter, ToolHead } from './parts';

type Who = 'adult' | 'child' | 'pregnant';
interface Route { main: string; also?: string[]; href?: string }

const SYMPTOMS: Record<string, Record<Who, Route>> = {
  chest:    { adult: { main: 'Cardiología Clínica', also: ['Medicina Interna'] }, child: { main: 'Cardiología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Cardiología Clínica'] } },
  breath:   { adult: { main: 'Neumología', also: ['Medicina Interna'] }, child: { main: 'Neumología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Neumología'] } },
  stomach:  { adult: { main: 'Gastroenterología', also: ['Medicina General'] }, child: { main: 'Gastroenterología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Gastroenterología'] } },
  skin:     { adult: { main: 'Dermatología' }, child: { main: 'Dermatología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Dermatología', also: ['Ginecología y Obstetricia'] } },
  bones:    { adult: { main: 'Ortopedia y Traumatología', also: ['Reumatología'] }, child: { main: 'Ortopedia y Traumatología', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Ortopedia y Traumatología'] } },
  head:     { adult: { main: 'Neurología', also: ['Medicina Interna'] }, child: { main: 'Neurología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Neurología'] } },
  mood:     { adult: { main: 'Psicología', also: ['Psiquiatría Adultos'], href: '/psicologia' }, child: { main: 'Psiquiatría Infantil y de la Adolescencia', also: ['Psicología'] }, pregnant: { main: 'Psicología', also: ['Ginecología y Obstetricia'], href: '/psicologia' } },
  weight:   { adult: { main: 'Nutrición', also: ['Endocrinología'], href: '/nutricion' }, child: { main: 'Pediatría', also: ['Endocrinología Pediátrica'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Nutrición'] } },
  women:    { adult: { main: 'Ginecología y Obstetricia', href: '/salud-mujer' }, child: { main: 'Pediatría', also: ['Ginecología y Obstetricia'] }, pregnant: { main: 'Ginecología y Obstetricia', href: '/salud-mujer' } },
  urinary:  { adult: { main: 'Urología', also: ['Nefrología'] }, child: { main: 'Nefrología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Urología'] } },
  eyes:     { adult: { main: 'Oftalmología' }, child: { main: 'Oftalmología', also: ['Pediatría'] }, pregnant: { main: 'Oftalmología' } },
  ent:      { adult: { main: 'Otorrinolaringología y Cirugía de Cabeza y Cuello' }, child: { main: 'Otorrinolaringología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Otorrinolaringología y Cirugía de Cabeza y Cuello' } },
  hormones: { adult: { main: 'Endocrinología', also: ['Medicina Interna'] }, child: { main: 'Endocrinología Pediátrica', also: ['Pediatría'] }, pregnant: { main: 'Ginecología y Obstetricia', also: ['Endocrinología'] } },
  general:  { adult: { main: 'Medicina General', also: ['Medicina Interna'] }, child: { main: 'Pediatría' }, pregnant: { main: 'Ginecología y Obstetricia' } },
};

// El directorio busca con ILIKE sobre nombre o especialidad: con la primera
// palabra («Cardiología») salen también «Cardiología Clínica» e «Intervencionista».
// Las pediátricas y «Medicina …» van completas para no mezclar familias.
const stem = (v: string) => (/Pediátrica|Infantil|^Medicina /.test(v) ? v : v.split(' ')[0]);
const search = (s: string) => `/doctors?search=${encodeURIComponent(stem(s))}`;
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Nombre de la especialidad en el idioma activo (la búsqueda sigue en castellano, como está en la base). */
function useSpecialtyLabel() {
  const { t } = useLanguage();
  return (value: string) => {
    const n = norm(value);
    const hit = SPECIALTIES_FILTER.find(s => norm(s.value) === n);
    if (!hit) return value;
    const label = t(hit.labelKey);
    return label && label !== hit.labelKey ? label : value;
  };
}

export function SymptomGuideTool({ ht }: { ht: HT }) {
  const [who, setWho] = useState<Who>('adult');
  const [symptom, setSymptom] = useState<string | null>(null);
  const route = symptom ? SYMPTOMS[symptom][who] : null;
  const label = useSpecialtyLabel();
  return (
    <div className="ht-tool">
      <ToolHead title={ht('guide.title')} intro={ht('guide.intro')} />
      <div className="ht-grid">
        <Segmented<Who>
          label={ht('guide.who')}
          value={who}
          onChange={setWho}
          options={[{ value: 'adult', label: ht('guide.adult') }, { value: 'child', label: ht('guide.child') }, { value: 'pregnant', label: ht('guide.pregnant') }]}
        />
      </div>
      <p className="ht-label ht-label-block">{ht('guide.area')}</p>
      <div className="ht-symptoms" role="radiogroup" aria-label={ht('guide.area')}>
        {Object.keys(SYMPTOMS).map(k => (
          <button key={k} type="button" role="radio" aria-checked={symptom === k} className={symptom === k ? 'is-active' : ''} onClick={() => setSymptom(k)}>
            {ht(`guide.s_${k}`)}
          </button>
        ))}
      </div>
      {route && (
        <div className="ht-result ht-tone-ok" role="status" aria-live="polite">
          <div className="ht-result-kicker">{ht('guide.suggestion')}</div>
          <div className="ht-result-main"><span className="ht-result-value ht-result-value-sm">{label(route.main)}</span></div>
          <div className="ht-result-body">
            <Link to={route.href ?? search(route.main)} className="pro-btn pro-btn-teal ht-cta">
              {ht('common.seeSpecialists')}<ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            {route.also && route.also.length > 0 && (
              <p className="ht-also">
                {ht('guide.alsoConsider')}:{' '}
                {route.also.map((s, i) => (
                  <span key={s}>{i > 0 && ' · '}<Link to={search(s)} className="pro-link">{label(s)}</Link></span>
                ))}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="ht-emergency">
        <Siren className="w-5 h-5" aria-hidden="true" />
        <p><strong>{ht('guide.emergencyTitle')}</strong> {ht('guide.emergencyList')} <Link to="/emergency" className="pro-link">{ht('guide.emergencyCta')}</Link></p>
      </div>
      <Note>{ht('guide.note')}</Note>
      <ToolFooter ht={ht} />
    </div>
  );
}
