// Aprendizaje del médico (reestructura 11-sep-2026).
//
// Cuatro pestañas fijas: Cursos · Casos clínicos · Masterclass · Materiales.
// El calendario, las reuniones y el «Contenido premium» que antes vivían aquí
// se reubicaron: calendario y reuniones → Agenda (tabs disponibilidad/
// reuniones), «Contenido premium» → Contenido > Explorar. Nada se pierde: solo
// cambia de sitio (ver `relocated` del paquete).
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { SectionTabs, useSectionParam } from '@/components/common/SectionTabs';
import { DOCTOR_SECTION_BY_ID } from '@/lib/doctorSections';
import { GraduationCap } from 'lucide-react';
import ClinicalCasesSection from '@/components/education/ClinicalCasesSection';
import CoursesSection from '@/components/education/CoursesSection';
import MasterclassSection from '@/components/education/MasterclassSection';
import MaterialsLibrary from '@/components/education/MaterialsLibrary';

const EDUCATION_TABS = ['cursos', 'casos', 'masterclass', 'materiales'] as const;
type EducationTab = typeof EDUCATION_TABS[number];

export default function MedicalEducation() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useSectionParam<EducationTab>('tab', EDUCATION_TABS, 'cursos');

  const isTeam = role === 'doctor' || role === 'resident' || role === 'admin';

  // Aprendizaje pasa a ser solo del equipo médico. Antes un paciente entraba
  // aquí a ver «Contenido premium»: esa pestaña se retiró (vive en Contenido),
  // así que el paciente va directo a /recordings, donde sigue exactamente lo
  // mismo que veía. Cualquier otro rol, como antes, a /lives.
  useEffect(() => {
    if (!role) return;
    if (role === 'patient') { navigate('/recordings', { replace: true }); return; }
    if (!isTeam) navigate('/lives', { replace: true });
  }, [role, isTeam, navigate]);

  const tabItems = (DOCTOR_SECTION_BY_ID.aprendizaje.tabs || []).map(tb => ({
    id: tb.id as EducationTab,
    label: t(tb.labelKey),
    icon: tb.icon,
  }));

  // Guard de rol al final: todos los hooks ya se ejecutaron.
  if (role && !isTeam) return null;

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><GraduationCap className="w-7 h-7" /> <span className="truncate">{t('mm2.learning.title')}</span></h1>
            <p className="pro-page-sub">{t('mm2.learning.subtitle')}</p>
          </div>
        </div>

        <SectionTabs value={tab} onChange={setTab} items={tabItems} ariaLabel={t('mm2.learning.tabsLabel')} className="mb-4" />

        {tab === 'cursos' && <CoursesSection category="curso" />}
        {tab === 'casos' && <ClinicalCasesSection />}
        {tab === 'masterclass' && (
          <div className="space-y-5">
            <MasterclassSection />
            <div>
              <h3 className="font-heading font-bold text-foreground mb-3">{t('mm2.learning.masterclassCoursesTitle')}</h3>
              <CoursesSection category="masterclass" />
            </div>
          </div>
        )}
        {tab === 'materiales' && <MaterialsLibrary />}
      </div>
    </MainLayout>
  );
}
