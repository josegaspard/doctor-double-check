import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Contador con semáforo: verde dentro del rango que Google suele enseñar entero. */
export function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const n = (value || '').length;
  const ok = n >= min && n <= max;
  return (
    <span className={cn('text-[11px] tabular-nums font-medium', n === 0 ? 'text-secondary/50' : ok ? 'text-success' : 'text-warning')}>
      {n} / {max}
    </span>
  );
}

function displayUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return [u.host, ...parts].join(' › ');
  } catch {
    return url;
  }
}

/** Cómo se vería el resultado en Google (aproximado: Google puede reescribirlo). */
export function GooglePreview({
  title, description, url, siteName, faviconSrc,
}: { title: string; description: string; url: string; siteName: string; faviconSrc: string }) {
  return (
    <div className="rounded-xl border border-secondary/15 bg-white p-4 text-left">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-full bg-[#f1f3f4] flex items-center justify-center overflow-hidden flex-shrink-0">
          {faviconSrc ? <img src={faviconSrc} alt="" className="w-[18px] h-[18px] object-contain" /> : <Globe className="w-4 h-4 text-[#5f6368]" />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] leading-tight text-[#202124] truncate">{siteName}</p>
          <p className="text-[12px] leading-tight text-[#4d5156] truncate">{displayUrl(url)}</p>
        </div>
      </div>
      <p className="mt-2 text-[18px] sm:text-[20px] leading-snug text-[#1a0dab] line-clamp-1 break-words">{title}</p>
      <p className="mt-1 text-[13px] sm:text-[14px] leading-snug text-[#4d5156] line-clamp-2 break-words">{description}</p>
    </div>
  );
}

/** Tarjeta al compartir el enlace en WhatsApp, Facebook, LinkedIn o X. */
export function SocialPreview({ title, description, image, url }: { title: string; description: string; image: string; url: string }) {
  let host = url;
  try { host = new URL(url).host; } catch { /* se deja tal cual */ }
  // El icono de la marca es cuadrado: recortarlo a 1.91:1 lo desfigura.
  const square = /\/icon-512\.png/.test(image);
  return (
    <div className="rounded-xl border border-[#d5dde8] bg-[#f0f2f5] overflow-hidden text-left">
      <div className="aspect-[1.91/1] max-w-full bg-[#e9eef5] overflow-hidden">
        {image ? <img src={image} alt="" className={square ? 'w-full h-full object-contain bg-white p-6' : 'w-full h-full object-cover'} /> : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wide text-[#65676b] truncate">{host}</p>
        <p className="text-[15px] font-semibold leading-snug text-[#050505] line-clamp-2 break-words">{title}</p>
        <p className="text-[13px] leading-snug text-[#65676b] line-clamp-1 break-words">{description}</p>
      </div>
    </div>
  );
}
