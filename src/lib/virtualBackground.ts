import { SelfieSegmentation, type Results } from '@mediapipe/selfie_segmentation';

// Motor de FONDO VIRTUAL propio (segmentación en canvas), independiente del
// procesador de Daily. Daily solo soporta fondos en navegadores de ESCRITORIO
// y ante fallos apaga el video (pantalla NEGRA en móvil). Este motor corre
// MediaPipe Selfie Segmentation (WASM auto-hospedado en /mediapipe/) sobre la
// cámara, compone persona + fondo (difuminado o imagen) en un <canvas>, y
// entrega el track resultante con canvas.captureStream(). Funciona en escritorio
// e iOS Safari 15+/Android. Si algo falla, NUNCA deja la cámara en negro: se
// revierte a la cámara normal.

export type BgMode = { type: 'blur' } | { type: 'image'; url: string };

const MP_FILE_BASE = '/mediapipe';
const TARGET_FPS = 24;

export class VirtualBackgroundEngine {
  private segmenter: SelfieSegmentation | null = null;
  private rawStream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private outStream: MediaStream | null = null;
  private bgImage: HTMLImageElement | null = null;
  private mode: BgMode = { type: 'blur' };
  private running = false;
  private rafTimer: number | null = null;
  private lastSend = 0;

  /**
   * Arranca el pipeline y devuelve el TRACK de video ya procesado.
   * @param mode difuminado o imagen de fondo.
   * @param facingMode 'user' (frontal) por defecto.
   */
  async start(mode: BgMode, facingMode: 'user' | 'environment' = 'user'): Promise<MediaStreamTrack> {
    this.mode = mode;

    // 1) Cámara cruda (nuestra, para poder segmentar los frames).
    this.rawStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });

    // 2) <video> oculto que consume la cámara.
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    (video as any).srcObject = this.rawStream;
    await video.play().catch(() => {});
    this.videoEl = video;

    const track = this.rawStream.getVideoTracks()[0];
    const settings = track.getSettings();
    const w = settings.width || 1280;
    const h = settings.height || 720;

    // 3) Canvas de salida.
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // alpha:true OBLIGATORIO: la composición source-in recorta la persona usando
    // el canal alpha de la máscara; con alpha:false el recorte no funciona.
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;

    // 4) Precarga de la imagen de fondo (si aplica) — con CORS para poder pintarla.
    if (mode.type === 'image') {
      this.bgImage = await this.loadImage(mode.url);
    }

    // 5) MediaPipe (WASM auto-hospedado; CSP solo permite 'self').
    const segmenter = new SelfieSegmentation({ locateFile: (f) => `${MP_FILE_BASE}/${f}` });
    segmenter.setOptions({ modelSelection: 1, selfieMode: false });
    segmenter.onResults((results) => this.draw(results));
    await segmenter.initialize();
    this.segmenter = segmenter;

    // 6) Loop de segmentación.
    this.running = true;
    this.loop();

    // 7) Espera al PRIMER frame pintado (si no llega en 6s → error → revertir).
    await this.waitForFirstFrame(6000);

    this.outStream = canvas.captureStream(TARGET_FPS);
    return this.outStream.getVideoTracks()[0];
  }

  /** Cambia el fondo sin reiniciar la cámara (mismo pipeline). */
  async setMode(mode: BgMode) {
    this.mode = mode;
    this.bgImage = mode.type === 'image' ? await this.loadImage(mode.url) : null;
  }

  stop() {
    this.running = false;
    if (this.rafTimer) { cancelAnimationFrame(this.rafTimer); this.rafTimer = null; }
    try { this.segmenter?.close(); } catch { /* noop */ }
    this.segmenter = null;
    this.outStream?.getTracks().forEach((t) => t.stop());
    this.rawStream?.getTracks().forEach((t) => t.stop());
    if (this.videoEl) { (this.videoEl as any).srcObject = null; this.videoEl = null; }
    this.outStream = null;
    this.rawStream = null;
    this.canvas = null;
    this.ctx = null;
    this.bgImage = null;
  }

  private firstFrameDrawn = false;
  private async waitForFirstFrame(timeoutMs: number) {
    const start = performance.now();
    while (!this.firstFrameDrawn) {
      if (performance.now() - start > timeoutMs) throw new Error('virtual background: no frame');
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private loop = () => {
    if (!this.running || !this.videoEl || !this.segmenter) return;
    const now = performance.now();
    if (now - this.lastSend >= 1000 / TARGET_FPS && this.videoEl.readyState >= 2) {
      this.lastSend = now;
      // send es async; ignoramos errores de frame sueltos.
      this.segmenter.send({ image: this.videoEl }).catch(() => {});
    }
    this.rafTimer = requestAnimationFrame(this.loop);
  };

  private draw(results: Results) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const { width: w, height: h } = canvas;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Persona: máscara → recorte de la imagen de la cámara.
    ctx.drawImage(results.segmentationMask, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(results.image, 0, 0, w, h);

    // Fondo detrás de la persona.
    ctx.globalCompositeOperation = 'destination-over';
    if (this.mode.type === 'image' && this.bgImage) {
      this.drawCover(ctx, this.bgImage, w, h);
    } else {
      // Difuminado estilo Google Meet.
      ctx.filter = 'blur(12px)';
      ctx.drawImage(results.image, 0, 0, w, h);
      ctx.filter = 'none';
    }
    ctx.restore();
    this.firstFrameDrawn = true;
  }

  // Dibuja la imagen cubriendo el canvas (object-fit: cover).
  private drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
    const ir = img.width / img.height;
    const cr = w / h;
    let dw = w, dh = h, dx = 0, dy = 0;
    if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; }
    else { dw = w; dh = w / ir; dy = (h - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('bg image load failed'));
      img.src = url;
    });
  }
}
