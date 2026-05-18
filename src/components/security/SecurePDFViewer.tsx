import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';
import { useAuth } from '@/contexts/AuthContext';
import { logFileAccess } from '@/lib/fileAccessLog';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface SecurePDFViewerProps {
  signedUrl: string;
  fileName?: string;
  fileId?: string;
  bucket?: string;
  className?: string;
}

export function SecurePDFViewer({ signedUrl, fileName, fileId, bucket, className }: SecurePDFViewerProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buf = await response.arrayBuffer();
        if (cancelled) return;
        const loadingTask = pdfjsLib.getDocument({ data: buf });
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        logFileAccess({
          fileId: fileId || fileName || 'pdf',
          bucket: bucket || 'unknown',
          fileType: 'pdf',
          action: 'viewed',
        });
      } catch (err) {
        if (cancelled) return;
        console.error('[SecurePDFViewer] load failed', err);
        setError('No se pudo cargar el documento');
        logFileAccess({
          fileId: fileId || fileName || 'pdf',
          bucket: bucket || 'unknown',
          fileType: 'pdf',
          action: 'access_denied',
          error: String((err as any)?.message || err).slice(0, 200),
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedUrl, fileId, bucket, fileName]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const page = await pdfDoc.getPage(pageNum);
      if (cancelled) return;
      const containerWidth = containerRef.current?.clientWidth || 800;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.max(0.5, containerWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({ canvasContext: ctx, viewport }).promise;
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum]);

  useEffect(() => {
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy().catch(() => {});
      }
    };
  }, [pdfDoc]);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[300px] gap-2 ${className || ''}`}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Cargando documento…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[300px] gap-2 ${className || ''}`}>
        <AlertCircle className="w-6 h-6 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none ${className || ''}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      data-testid="secure-pdf-viewer"
    >
      <div className="relative w-full flex justify-center bg-muted/20 rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
        <canvas
          ref={canvasRef}
          className="block pointer-events-none"
          style={{ touchAction: 'none' }}
        />
        <DynamicWatermark email={user?.email} userId={user?.id} />
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3 text-sm">
          <button
            type="button"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted hover:bg-muted-foreground/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          <span className="font-mono text-muted-foreground" data-testid="pdf-page-indicator">
            {pageNum} / {numPages}
          </span>
          <button
            type="button"
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted hover:bg-muted-foreground/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Página siguiente"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
