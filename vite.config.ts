import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Paquetes aislados en su propio chunk. Los pesados (pdf, hls, daily, tiptap,
// charts) solo los descargan las rutas que los importan.
const MANUAL_CHUNKS: Array<[string, string[]]> = [
  // Core React (loads on every page)
  ["vendor", ["react", "react-dom", "react-router", "react-router-dom", "@remix-run/router", "scheduler", "clsx", "use-sync-external-store"]],
  ["supabase", ["@supabase"]],
  ["pdf", ["pdfjs-dist"]],
  ["hls", ["hls.js"]],
  ["daily", ["@daily-co/daily-js"]],
  ["tiptap", ["@tiptap"]],
  ["charts", ["recharts"]],
  ["motion", ["framer-motion"]],
  ["icons", ["lucide-react"]],
  ["forms", ["react-hook-form", "@hookform/resolvers", "zod"]],
  ["query", ["@tanstack/react-query", "@tanstack/react-virtual", "@tanstack/query-core", "@tanstack/virtual-core"]],
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  esbuild: mode === "production"
    ? { drop: ["console", "debugger"], legalComments: "none" }
    : undefined,
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Forma de función (3-oct-2026): con la forma de objeto Rollup metía
        // dependencias compartidas (helper de precarga de Vite, react/jsx-runtime,
        // clsx...) dentro de pdf/tiptap/charts y la portada descargaba esos
        // chunks enteros. Ahora solo va a cada chunk el código de SU paquete.
        manualChunks(id: string) {
          // Ayudantes compartidos: si no se asignan, Rollup los mete en el primer
          // chunk manual que los usa (pdf/charts/tiptap) y la portada lo descarga.
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "vendor";
          if (!id.includes("node_modules")) return undefined;
          for (const [chunk, pkgs] of MANUAL_CHUNKS) {
            if (pkgs.some((p) => id.includes(`/node_modules/${p}/`))) return chunk;
          }
          return undefined;
        },
      },
    },
  },
}));
