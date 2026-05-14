import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted fonts (bundled by Vite, hashed assets → SRI-safe by same-origin)
// Replaces the Google Fonts CDN dependency flagged by OWASP ZAP for missing SRI.
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./index.css";
import { enforceBrowserSessionGuard } from "./lib/sessionGuard";

// Register Service Worker for PWA + Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}

// PRE-WARM del edge function b2-presigned-url: cold start de Supabase Edge
// Functions puede ser 700ms-3s. Disparamos un fire-and-forget al cargar la
// app (después del primer paint) para que cuando el usuario abra un recording,
// la function ya esté caliente. Falla silenciosamente.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const warm = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        supabase.functions
          .invoke('b2-presigned-url', { body: { operation: 'warmup', path: '__warmup__' } })
          .catch(() => { /* silent */ });
      } catch { /* silent */ }
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(warm, { timeout: 2000 });
    } else {
      setTimeout(warm, 1000);
    }
  });
}

// Force re-login when all browser windows are closed (sessionStorage flag).
// Must run BEFORE the React tree mounts so AuthProvider hydrates against a clean state.
enforceBrowserSessionGuard().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
