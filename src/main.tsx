import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
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

// Force re-login when all browser windows are closed (sessionStorage flag).
// Must run BEFORE the React tree mounts so AuthProvider hydrates against a clean state.
enforceBrowserSessionGuard().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
