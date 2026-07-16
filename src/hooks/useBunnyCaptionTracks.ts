import { useEffect, useState } from 'react';

export interface CaptionTrack { lang: string; label: string; src: string }

const CAPTION_LABELS: Record<string, string> = {
  es: 'Español', en: 'English', pt: 'Português', fr: 'Français',
  it: 'Italiano', de: 'Deutsch', ca: 'Català', zh: '中文',
};

/**
 * Trae los subtítulos generados en Bunny (batch92/93) y los devuelve como pistas
 * <track> listas para inyectar en un <video>. El manifest HLS de Bunny NO expone
 * las pistas SUBTITLES, así que las montamos a mano. Los .vtt viven bajo el mismo
 * token de directorio del playback ({vid}/captions/{lang}-auto.vtt?token=…). Se
 * traen por fetch→blob (same-origin) para NO poner crossOrigin en el <video>
 * (riesgo de romper el HLS nativo de iOS). Funciona igual en la ruta HLS y en la
 * ruta MP4 /original.
 *
 * @param videoId   GUID del video en Bunny.
 * @param tokenUrl  Cualquier URL firmada del mismo video (de ella se saca host +
 *                  ?token=&expires=). Típicamente la hlsUrl.
 * @param languages recordings.captions_languages.
 */
export function useBunnyCaptionTracks(
  videoId: string | null | undefined,
  tokenUrl: string | null | undefined,
  languages: string[] | undefined,
): CaptionTrack[] {
  const [tracks, setTracks] = useState<CaptionTrack[]>([]);

  useEffect(() => {
    if (!videoId || !tokenUrl || !languages || languages.length === 0) {
      setTracks([]);
      return;
    }
    let active = true;
    const blobUrls: string[] = [];
    (async () => {
      try {
        const u = new URL(tokenUrl);
        const query = u.search; // ?token=…&expires=…
        const results = await Promise.all(languages.map(async (lang) => {
          try {
            const res = await fetch(`https://${u.host}/${videoId}/captions/${lang}-auto.vtt${query}`);
            if (!res.ok) return null;
            const blob = await res.blob();
            const src = URL.createObjectURL(blob);
            blobUrls.push(src);
            return { lang, label: CAPTION_LABELS[lang] || lang.toUpperCase(), src };
          } catch { return null; }
        }));
        if (active) setTracks(results.filter(Boolean) as CaptionTrack[]);
      } catch { /* sin subtítulos: el player sigue normal */ }
    })();
    return () => {
      active = false;
      blobUrls.forEach((b) => URL.revokeObjectURL(b));
      setTracks([]);
    };
  }, [videoId, tokenUrl, languages]);

  return tracks;
}
