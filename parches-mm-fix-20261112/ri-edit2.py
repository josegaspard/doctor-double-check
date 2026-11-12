def rep(p, pairs):
    s=open(p,encoding="utf8").read()
    for a,b in pairs:
        n=s.count(a)
        assert n==1, (p, n, a[:60])
        s=s.replace(a,b)
    open(p,"w",encoding="utf8").write(s)
rep("vite.config.ts", [
('''import { defineConfig } from "vite";''', '''import { defineConfig, type Plugin } from "vite";'''),
('''// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({''', '''// Precargas cuyos nombres llevan hash y solo se conocen tras el build:
//  - el diccionario castellano (ya no va dentro de index.js; idioma por defecto);
//  - el fondo del hero de la portada (su LCP), móvil o escritorio según media.
// El bloque hero-preload lo quita mm-seo en las rutas que no son "/".
// Sin CSP 'unsafe-inline' no se puede elegir el diccionario con un script inline.
function buildPreloads(): Plugin {
  return {
    name: "mm-build-preloads",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const out = Object.values(ctx.bundle ?? {});
        const chunk = (suffix: string) =>
          out.find((f) => f.type === "chunk" && (f.facadeModuleId ?? "").endsWith(suffix))?.fileName;
        const asset = (re: RegExp) => out.find((f) => f.type === "asset" && re.test(f.fileName))?.fileName;
        const tags: string[] = [];
        const es = chunk("/src/lib/i18n/es.ts");
        if (es) tags.push(`<link rel="modulepreload" href="/${es}" />`);
        const heroMobile = asset(/^assets\\/hero-bg-mobile-[\\w-]+\\.avif$/);
        const heroDesktop = asset(/^assets\\/hero-bg-desktop-[\\w-]+\\.avif$/);
        if (heroMobile && heroDesktop) {
          tags.push(
            "<!-- hero-preload:start -->",
            `<link rel="preload" as="image" type="image/avif" href="/${heroMobile}" media="(max-width: 767px)" fetchpriority="high" />`,
            `<link rel="preload" as="image" type="image/avif" href="/${heroDesktop}" media="(min-width: 768px)" fetchpriority="high" />`,
            "<!-- hero-preload:end -->",
          );
        }
        if (!tags.length) return html;
        return html.replace("</head>", `    ${tags.join("\\n    ")}\\n  </head>`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({'''),
('''  plugins: [react()],''', '''  plugins: [react(), buildPreloads()],'''),
])
print("ok")
