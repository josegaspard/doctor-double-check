import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Gauge, Subtitles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Barra de control propia (reemplaza los controles nativos del <video>) con
 * MINIATURAS AL PASAR LA BARRA (scrubbing preview). Los sprites son 10×10 (100
 * celdas, 160×90) subidos a thumbnails/sprites/{recordingId}.jpg — la celda se
 * deriva de floor(progress*100), sin metadata. Si el sprite no existe, la barra
 * funciona igual pero sin la miniatura.
 */
const SPRITE_COLS = 10, SPRITE_ROWS = 10, CELL_W = 160, CELL_H = 90;
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLElement>;
  recordingId: string;
  hasCaptions?: boolean;
}

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

export default function RecordingControls({ videoRef, containerRef, recordingId, hasCaptions }: Props) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [ccOn, setCcOn] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const hideTimer = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const spriteUrl = supabase.storage.from('thumbnails').getPublicUrl(`sprites/${recordingId}.jpg`).data.publicUrl;

  // Sincronizar estado con el <video>
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(v.currentTime);
    const onDur = () => setDuration(v.duration || 0);
    const onVol = () => { setMuted(v.muted); setVolume(v.volume); };
    const onRate = () => setRate(v.playbackRate);
    const onProg = () => { try { if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1)); } catch { /* */ } };
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime); v.addEventListener('durationchange', onDur);
    v.addEventListener('loadedmetadata', onDur); v.addEventListener('volumechange', onVol);
    v.addEventListener('ratechange', onRate); v.addEventListener('progress', onProg);
    setPlaying(!v.paused); setMuted(v.muted); setVolume(v.volume); setDuration(v.duration || 0);
    return () => {
      v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime); v.removeEventListener('durationchange', onDur);
      v.removeEventListener('loadedmetadata', onDur); v.removeEventListener('volumechange', onVol);
      v.removeEventListener('ratechange', onRate); v.removeEventListener('progress', onProg);
    };
  }, [videoRef]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Auto-ocultar la barra tras inactividad (solo si reproduce)
  const wake = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { if (videoRef.current && !videoRef.current.paused) setVisible(false); }, 2800);
  }, [videoRef]);
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    c.addEventListener('mousemove', wake);
    c.addEventListener('mouseleave', () => { if (videoRef.current && !videoRef.current.paused) setVisible(false); });
    return () => { c.removeEventListener('mousemove', wake); };
  }, [containerRef, wake, videoRef]);

  const togglePlay = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; };
  const setVol = (val: number) => { const v = videoRef.current; if (!v) return; v.volume = val; v.muted = val === 0; };
  const setSpeed = (r: number) => { const v = videoRef.current; if (v) v.playbackRate = r; setSpeedOpen(false); };
  const toggleFs = () => {
    const c = containerRef.current; if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else c.requestFullscreen?.();
  };
  const toggleCc = () => {
    const v = videoRef.current; if (!v) return;
    const tracks = v.textTracks; const next = !ccOn;
    for (let i = 0; i < tracks.length; i++) tracks[i].mode = next && i === 0 ? 'showing' : 'disabled';
    setCcOn(next);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const seekFromEvent = (clientX: number) => {
    const bar = barRef.current, v = videoRef.current;
    if (!bar || !v || !duration) return;
    const r = bar.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    v.currentTime = p * duration;
  };
  const onBarMove = (e: React.MouseEvent) => {
    const bar = barRef.current;
    if (!bar || !duration) return;
    const r = bar.getBoundingClientRect();
    const x = Math.min(r.width, Math.max(0, e.clientX - r.left));
    setHover({ x, time: (x / r.width) * duration });
  };

  // Celda del sprite para el tiempo bajo el cursor
  const cell = hover && duration ? Math.min(SPRITE_COLS * SPRITE_ROWS - 1, Math.floor((hover.time / duration) * SPRITE_COLS * SPRITE_ROWS)) : 0;
  const col = cell % SPRITE_COLS, row = Math.floor(cell / SPRITE_COLS);

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 px-3 pb-2 pt-8 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Miniatura de scrubbing */}
      {hover && (
        <div
          className="absolute bottom-14 -translate-x-1/2 rounded-md overflow-hidden border border-white/30 shadow-lg bg-black"
          style={{ left: `${(hover.x / (barRef.current?.getBoundingClientRect().width || 1)) * 100}%`, width: CELL_W, height: CELL_H }}
        >
          <div
            style={{
              width: CELL_W, height: CELL_H,
              backgroundImage: `url(${spriteUrl})`,
              backgroundPosition: `-${col * CELL_W}px -${row * CELL_H}px`,
              backgroundSize: `${SPRITE_COLS * CELL_W}px ${SPRITE_ROWS * CELL_H}px`,
              backgroundRepeat: 'no-repeat',
            }}
          />
          <span className="absolute bottom-0 right-1 text-[10px] text-white font-medium drop-shadow">{fmt(hover.time)}</span>
        </div>
      )}

      {/* Barra de progreso */}
      <div
        ref={barRef}
        className="relative h-3 flex items-center cursor-pointer group"
        onClick={(e) => seekFromEvent(e.clientX)}
        onMouseMove={onBarMove}
        onMouseLeave={() => setHover(null)}
      >
        <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/25 rounded-full transition-all">
          <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full" style={{ width: `${bufPct}%` }} />
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
        </div>
      </div>

      {/* Fila de botones */}
      <div className="flex items-center gap-3 text-white mt-1.5">
        <button onClick={togglePlay} aria-label="play" className="hover:text-primary transition-colors">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-1.5 group/vol">
          <button onClick={toggleMute} aria-label="mute" className="hover:text-primary transition-colors">
            {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <input
            type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
            onChange={(e) => setVol(parseFloat(e.target.value))}
            className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-primary cursor-pointer"
            aria-label="volumen"
          />
        </div>

        <span className="text-xs tabular-nums">{fmt(current)} / {fmt(duration)}</span>

        <div className="ml-auto flex items-center gap-3">
          {hasCaptions && (
            <button onClick={toggleCc} aria-label="subtítulos" className={`transition-colors ${ccOn ? 'text-primary' : 'hover:text-primary'}`}>
              <Subtitles className="w-5 h-5" />
            </button>
          )}
          <div className="relative">
            <button onClick={() => setSpeedOpen(o => !o)} aria-label="velocidad" className="flex items-center gap-1 hover:text-primary transition-colors">
              <Gauge className="w-5 h-5" /><span className="text-xs">{rate}×</span>
            </button>
            {speedOpen && (
              <div className="absolute bottom-8 right-0 bg-black/90 rounded-md py-1 min-w-[64px]">
                {SPEEDS.map(sp => (
                  <button key={sp} onClick={() => setSpeed(sp)}
                    className={`block w-full text-left px-3 py-1 text-xs hover:bg-white/10 ${rate === sp ? 'text-primary' : 'text-white'}`}>
                    {sp}×
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={toggleFs} aria-label="pantalla completa" className="hover:text-primary transition-colors">
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
