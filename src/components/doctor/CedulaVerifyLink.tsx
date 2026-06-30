import { ExternalLink, ShieldCheck, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCedulaRegistry, CEDULA_REGISTRIES } from '@/lib/cedulaVerification';

/**
 * Enlace(s) de verificación de cédula / colegiación / licencia profesional por país.
 * - Si conocemos el país del doctor → enlace directo a su registro oficial.
 * - Si no → lista colapsable de los registros oficiales de +50 países.
 */
export function CedulaVerifyLink({
  country,
  className = '',
}: {
  country?: string | null;
  className?: string;
}) {
  const { t } = useLanguage();
  const registry = getCedulaRegistry(country);

  if (registry) {
    return (
      <a
        href={registry.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>{t('cedulaVerify.verify')} · {registry.authority}</span>
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }

  // País desconocido → lista colapsable de los registros oficiales de todos los países.
  const entries = Object.entries(CEDULA_REGISTRIES);
  return (
    <details className={`text-xs group ${className}`}>
      <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-primary hover:underline font-medium">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        {t('cedulaVerify.selectCountry')}
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 max-h-48 overflow-y-auto pr-1">
        {entries.map(([iso, r]) => (
          <a
            key={iso}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title={r.authority}
          >
            {r.country}
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        ))}
      </div>
    </details>
  );
}
