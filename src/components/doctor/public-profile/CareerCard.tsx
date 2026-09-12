// «Trayectoria profesional» del perfil público (diseño de Marta, 12-sep-2026).
//
// Lee SOLO `useDoctorPublicCredentials` (lo aprobado y publicado), igual que
// DoctorCredentialsCard: aquí no puede colarse nada pendiente, rechazado o
// privado. Chips Certificaciones · Experiencia · Educación (botones con
// aria-pressed, nunca role="tab") y un filtro de texto sobre lo ya cargado.
//
// El propio médico ve lo mismo que el público (así sabe qué se ve) más una
// línea con el enlace a Cuenta › Perfil y el panel de edición de siempre
// (DoctorCredentials, con todos sus diálogos) plegado bajo «Gestionar aquí».
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { GraduationCap, Award, Briefcase, Search, ShieldCheck, Landmark, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import DoctorCredentials from '@/components/doctor/DoctorCredentials';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDoctorPublicCredentials } from '@/hooks/useDoctorPublicCredentials';
import { doctorHref } from '@/lib/doctorSections';
import { fill, norm } from '@/lib/proFormat';

type CredTab = 'certifications' | 'experience' | 'education';

interface Row {
  id: string;
  year: string;
  org: string;
  place: string | null;
  title: string;
  sub: string | null;
  desc: string | null;
}

interface CareerCardProps {
  doctorId: string;
  isOwner: boolean;
}

const yearOf = (v?: string | number | null) => (v ? String(v).slice(0, 4) : '—');

export function CareerCard({ doctorId, isOwner }: CareerCardProps) {
  const { t, language } = useLanguage();
  const { credentials, loading } = useDoctorPublicCredentials(doctorId);
  const [tab, setTab] = useState<CredTab>('certifications');
  const [query, setQuery] = useState('');
  const [manage, setManage] = useState(false);

  const present = t('mm2.publicProfile.present');
  const rows = useMemo<Record<CredTab, Row[]>>(() => ({
    certifications: credentials.certifications.map(c => ({
      id: c.id,
      year: yearOf(c.issue_date),
      org: c.issuing_organization || '',
      place: null,
      title: c.name,
      sub: c.expiry_date ? `${t('mm2.publicProfile.expiresLabel')}: ${c.expiry_date}` : null,
      desc: null,
    })),
    experience: credentials.experience.map(e => ({
      id: e.id,
      year: yearOf(e.start_date),
      org: e.organization || '',
      place: e.location,
      title: e.title,
      sub: (e.start_date || e.end_date || e.is_current) ? `${e.start_date || '?'} — ${e.is_current ? present : (e.end_date || '?')}` : null,
      desc: e.description,
    })),
    education: credentials.education.map(e => ({
      id: e.id,
      year: e.end_year ? String(e.end_year) : (e.start_year ? String(e.start_year) : '—'),
      org: e.institution || '',
      place: e.field_of_study,
      title: e.degree,
      sub: (e.start_year || e.end_year) ? `${e.start_year || '?'} — ${e.end_year || present}` : null,
      desc: e.description,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [credentials, language]);

  const tabs: { id: CredTab; label: string; icon: LucideIcon; count: number }[] = [
    { id: 'certifications', label: t('mm2.publicProfile.tabCertifications'), icon: Award, count: rows.certifications.length },
    { id: 'experience', label: t('mm2.publicProfile.tabExperience'), icon: Briefcase, count: rows.experience.length },
    { id: 'education', label: t('mm2.publicProfile.tabEducation'), icon: GraduationCap, count: rows.education.length },
  ];
  const available = tabs.filter(s => s.count > 0);
  const total = available.reduce((n, s) => n + s.count, 0);

  // Si la pestaña activa se quedó sin contenido, aterriza en la primera con algo.
  useEffect(() => {
    if (available.length > 0 && !available.some(s => s.id === tab)) setTab(available[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available.map(s => s.id).join(',')]);

  const active = available.find(s => s.id === tab) || available[0] || tabs[0];
  const q = norm(query.trim());
  const list = rows[active.id].filter(r => !q || norm(`${r.org} ${r.place || ''} ${r.title} ${r.sub || ''} ${r.desc || ''}`).includes(q));
  const verifiedLabel = active.id === 'certifications' ? t('mm2.publicProfile.careerVerifiedCert') : t('mm2.publicProfile.careerVerified');
  const RowIcon = active.id === 'education' ? GraduationCap : active.id === 'experience' ? Briefcase : Landmark;

  // Nada aprobado y publicado: el visitante no ve tarjeta vacía; el dueño sí
  // (una línea y el enlace para completarla).
  if (!loading && total === 0 && !isOwner) return null;

  return (
    <section className="pro-card pro-card-pad bg-card min-w-0" id="pp-trayectoria" aria-labelledby="pp-trayectoria-title">
      <div className="pro-card-head">
        <h2 className="pro-card-title" id="pp-trayectoria-title"><GraduationCap /> {t('mm2.publicProfile.cardTitle')}</h2>
      </div>

      {loading ? (
        <p className="pp-empty"><Loader2 className="animate-spin" /> {t('pro.common.loading')}</p>
      ) : total === 0 ? (
        <p className="pp-empty">{t('mm2.publicProfile.careerEmptyOwner')}</p>
      ) : (
        <>
          <div className="pp-career-tools">
            <div className="pro-seg" role="group" aria-label={t('mm2.publicProfile.cardTitle')}>
              {available.map(s => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === active.id}
                  className={s.id === active.id ? 'is-active' : ''}
                  onClick={() => setTab(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="pro-search">
              <Search />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={fill(t('mm2.publicProfile.careerSearch'), { tab: active.label.toLowerCase() })}
                aria-label={fill(t('mm2.publicProfile.careerSearch'), { tab: active.label.toLowerCase() })}
              />
              {query && (
                <button type="button" className="pro-kebab w-7 h-7" onClick={() => setQuery('')} aria-label={t('pro.common.close')}><X /></button>
              )}
            </div>
          </div>

          {list.length === 0 ? (
            <p className="pp-empty">{fill(t('mm2.publicProfile.careerNoMatch'), { q: query.trim() })}</p>
          ) : list.map(r => (
            <div key={r.id} className="pp-cred">
              <div className="pp-cred-year">{r.year}</div>
              <div className="pp-cred-org">
                <span className="pro-icon-box"><RowIcon /></span>
                <div className="min-w-0">
                  <b>{r.org || '—'}</b>
                  {r.place && <small>{r.place}</small>}
                </div>
              </div>
              <div className="pp-cred-title">
                <b>{r.title}</b>
                <span className="pp-cred-ok"><ShieldCheck /> {verifiedLabel}</span>
                {r.sub && <small>{r.sub}</small>}
              </div>
              {r.desc && <p className="pp-cred-desc">{r.desc}</p>}
            </div>
          ))}
        </>
      )}

      {isOwner && (
        <>
          <div className="pp-owner-line">
            <span>{t('mm2.publicProfile.careerOwnerHint')}</span>
            <span className="acts">
              <Link className="pro-link" to={doctorHref('cuenta', { tab: 'perfil' })}>{t('mm2.publicProfile.careerEditLink')}</Link>
              <button type="button" className="pro-link" aria-expanded={manage} aria-controls="pp-trayectoria-gestion" onClick={() => setManage(v => !v)}>
                {manage ? t('mm2.publicProfile.careerManageHide') : t('mm2.publicProfile.careerManageHere')}
                {manage ? <ChevronUp /> : <ChevronDown />}
              </button>
            </span>
          </div>
          {manage && (
            <div id="pp-trayectoria-gestion" className="pp-embed pp-owner-panel">
              <DoctorCredentials doctorId={doctorId} isOwner />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default CareerCard;
