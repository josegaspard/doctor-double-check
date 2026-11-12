import re, pathlib, sys
R = pathlib.Path('/root/mm-fix/publico-seo')
def sub(f, old, new, count=1):
    p = R / f; s = p.read_text()
    if s.count(old) < 1: sys.exit(f'NO MATCH {f}: {old[:60]}')
    p.write_text(s.replace(old, new, count)); print('ok', f)

# SEO-06 NotFound: noindex y sin canonical
sub('src/pages/NotFound.tsx',
"""    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);""",
"""    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    // Página inexistente: que Google no la indexe ni la tome por la home.
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }, [location.pathname]);""")

# SEO-08 el logo del splash no es el H1 de la página
s = (R/'src/components/BrandLaunchAnimation.tsx').read_text()
i = s.index('        <h1\n          className="text-2xl sm:text-3xl font-heading')
j = s.index('        </h1>', i)
s = s[:i] + '        <div' + s[i+len('        <h1'):j] + '        </div>' + s[j+len('        </h1>'):]
(R/'src/components/BrandLaunchAnimation.tsx').write_text(s); print('ok splash')

# SEO-09 bots en español
sub('src/contexts/LanguageContext.tsx',
"""  if (typeof navigator !== 'undefined' && navigator.language) return normalizeLanguage(navigator.language);""",
"""  // Los buscadores (Googlebot va en en-US) ven el idioma por defecto, el mismo del
  // <title>, la descripción y og:locale que sirve el servidor.
  if (typeof navigator !== 'undefined' && /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent || '')) return DEFAULT_LANGUAGE;
  if (typeof navigator !== 'undefined' && navigator.language) return normalizeLanguage(navigator.language);""")

# SEO-11 H1 en legales
for f, key in [('src/pages/Terms.tsx', "{t('autoI18n.terms1')}"), ('src/pages/Privacy.tsx', "{t('autoI18n.privacy1')}"), ('src/pages/CodigoEtica.tsx', "{t('codeOfEthics.title')}")]:
    sub(f, f"""              <CardTitle className="text-lg sm:text-xl">
                {key}
              </CardTitle>""", f"""              <h1 className="text-lg sm:text-xl font-semibold leading-none tracking-tight">
                {key}
              </h1>""")
sub('src/pages/Dmca.tsx', '<CardTitle className="text-lg sm:text-xl">{title}</CardTitle>', '<h1 className="text-lg sm:text-xl font-semibold leading-none tracking-tight">{title}</h1>')
for f in ['src/pages/Terms.tsx', 'src/pages/Privacy.tsx', 'src/pages/CodigoEtica.tsx', 'src/pages/Dmca.tsx']:
    s = (R/f).read_text()
    if s.count('CardTitle') == 1:
        sub(f, 'CardHeader, CardTitle }', 'CardHeader }')

# SEO-13 /registro
sub('src/App.tsx', """                      <Route path="/doctores" element={<Navigate to="/doctors" replace />} />""",
"""                      <Route path="/doctores" element={<Navigate to="/doctors" replace />} />
                      <Route path="/registro" element={<Navigate to="/login" replace state={{ mode: 'signup' }} />} />
                      <Route path="/register" element={<Navigate to="/login" replace state={{ mode: 'signup' }} />} />""")

# SEO-16 ?search= del schema SearchAction
sub('src/pages/Doctors.tsx', "  const [searchQuery, setSearchQuery] = useState('');", "  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');")

# SEO-14 title de la home <= 60
OLD = 'Medical Masters | Plataforma de Médicos Especialistas Certificados'
NEW = 'Medical Masters | Médicos especialistas certificados'
p = R/'index.html'; s = p.read_text(); n = s.count(OLD); p.write_text(s.replace(OLD, NEW)); print('index title x', n)
sub('supabase/functions/_shared/seo-render.ts', f"const HOME_TITLE = '{OLD}';", f"const HOME_TITLE = '{NEW}';")

# SEO-12 llms.txt permitido en el robots del panel
sub('supabase/functions/_shared/seo-render.ts', "'/icon-512.png', '/manifest.json', '/sitemap.xml', '/robots.txt',\n];", "'/icon-512.png', '/manifest.json', '/sitemap.xml', '/robots.txt', '/llms.txt',\n];")

# SEO-02/12 robots estático de respaldo
sub('public/robots.txt', 'Allow: /$\n', 'Allow: /$\nAllow: /assets/\nAllow: /gtag-init.js\nAllow: /llms.txt\n')
