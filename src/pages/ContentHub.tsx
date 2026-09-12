// Contenido: centro de trabajo del médico con ocho pestañas (11-sep-2026).
//   explorar      · catálogo — grabaciones (RecordingsGrid) + lo publicado (ContentGallery)
//   lives         · LivesGrid incrustado (conserva ?vista=directo)
//   publicaciones · DoctorContentLibrary incrustado (antes /doctor/content)
//   grabaciones   · DoctorRecordings incrustado (antes /doctor/recordings)
//   crear         · subir | live | libros (?crear=)
//   colecciones   · content_collections (nuevo)
//   ventas        · ventas reales de contenido y Lives (nuevo)
//   estadisticas  · métricas reales que existen (nuevo)
import React, { Suspense } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { SectionTabs, useSectionParam } from '@/components/common/SectionTabs';
import { DOCTOR_SECTION_BY_ID } from '@/lib/doctorSections';
import { PlaySquare, Loader2, Radio, ArrowRight } from 'lucide-react';
import ContentCollectionsPanel from '@/components/content/hub/ContentCollectionsPanel';
import ContentSalesPanel from '@/components/content/hub/ContentSalesPanel';
import ContentStatsPanel from '@/components/content/hub/ContentStatsPanel';

const RecordingsGrid = React.lazy(() => import('@/pages/RecordingsGrid'));
const ContentGallery = React.lazy(() => import('@/pages/ContentGallery'));
const LivesGrid = React.lazy(() => import('@/pages/LivesGrid'));
const DoctorContentLibrary = React.lazy(() => import('@/pages/DoctorContentLibrary'));
const DoctorRecordings = React.lazy(() => import('@/pages/DoctorRecordings'));
const DoctorUpload = React.lazy(() => import('@/pages/DoctorUpload'));
const DoctorBooksManager = React.lazy(() => import('@/pages/DoctorBooksManager'));

const CONTENT_TABS = ['explorar', 'lives', 'publicaciones', 'grabaciones', 'crear', 'colecciones', 'ventas', 'estadisticas'] as const;
type ContentTab = typeof CONTENT_TABS[number];
const CREAR_OPTIONS = ['subir', 'live', 'libros'] as const;
type CrearOption = typeof CREAR_OPTIONS[number];

const tabLoader = (
  <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>
);

export default function ContentHub() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useSectionParam<ContentTab>('tab', CONTENT_TABS, 'explorar');
  const [crear, setCrear] = useSectionParam<CrearOption>('crear', CREAR_OPTIONS, 'subir');
  // ?sub=lives-pasados: sub-pestaña de Grabaciones que traía el enlace antiguo /doctor/recordings?tab=lives-pasados
  const [params] = useSearchParams();
  const recordingsSub = params.get('sub') === 'lives-pasados' ? 'lives-pasados' as const : undefined;

  const contentSection = DOCTOR_SECTION_BY_ID.contenido;
  const tabItems = (contentSection.tabs || []).map(tb => ({ id: tb.id as ContentTab, label: t(tb.labelKey), icon: tb.icon }));
  const crearOptions = (contentSection.tabs || []).find(tb => tb.id === 'crear')?.options || [];

  // Guard de rol AL FINAL: todos los hooks ya se ejecutaron (regla del encargo).
  if (role && role !== 'doctor' && role !== 'resident' && role !== 'admin') {
    return <Navigate to="/lives" replace />;
  }

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><PlaySquare className="w-7 h-7" /> <span className="truncate">{t('mm2.content.hub.title')}</span></h1>
            <p className="pro-page-sub">{t('mm2.content.hub.subtitle')}</p>
          </div>
        </div>

        <SectionTabs value={tab} onChange={setTab} items={tabItems} ariaLabel={t('mm2.content.hub.tabsLabel')} className="mb-4" />

        {tab === 'explorar' && (
          <div className="space-y-5">
            <Suspense fallback={tabLoader}><RecordingsGrid embedded /></Suspense>
            <Suspense fallback={tabLoader}><ContentGallery embedded /></Suspense>
          </div>
        )}

        {tab === 'lives' && (
          <Suspense fallback={tabLoader}><LivesGrid embedded /></Suspense>
        )}

        {tab === 'publicaciones' && (
          <Suspense fallback={tabLoader}><DoctorContentLibrary embedded /></Suspense>
        )}

        {tab === 'grabaciones' && (
          <Suspense fallback={tabLoader}><DoctorRecordings embedded initialTab={recordingsSub} /></Suspense>
        )}

        {tab === 'crear' && (
          <div className="space-y-4">
            <SectionTabs
              value={crear}
              onChange={setCrear}
              variant="onLight"
              ariaLabel={t('mm2.content.hub.crearLabel')}
              items={crearOptions.map(o => ({ id: o.id as CrearOption, label: t(o.labelKey), icon: o.icon }))}
            />
            {crear === 'subir' && <Suspense fallback={tabLoader}><DoctorUpload embedded /></Suspense>}
            {crear === 'libros' && <Suspense fallback={tabLoader}><DoctorBooksManager embedded /></Suspense>}
            {crear === 'live' && (
              <section className="pro-card pro-card-pad bg-card text-center py-10">
                <span className="pro-icon-box mx-auto mb-3" style={{ background: '#fde8e8' }}><Radio style={{ color: 'var(--pro-live)' }} /></span>
                <p className="pro-ink font-semibold">{t('mm2.content.hub.crear.liveTitle')}</p>
                <p className="pro-muted text-sm mt-1 max-w-md mx-auto">{t('mm2.content.hub.crear.liveDesc')}</p>
                <Link to="/doctor/go-live" className="pro-btn pro-btn-live mt-4">
                  <Radio /> {t('mm2.content.hub.crear.liveGo')} <ArrowRight />
                </Link>
              </section>
            )}
          </div>
        )}

        {tab === 'colecciones' && <ContentCollectionsPanel />}
        {tab === 'ventas' && <ContentSalesPanel />}
        {tab === 'estadisticas' && <ContentStatsPanel />}
      </div>
    </MainLayout>
  );
}
