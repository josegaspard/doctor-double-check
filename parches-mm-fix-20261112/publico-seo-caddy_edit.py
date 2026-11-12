import pathlib, sys
p = pathlib.Path('/etc/caddy/extra/medical-masters.caddy'); s = p.read_text()
def rep(old, new):
    global s
    if s.count(old) != 1: sys.exit('NO MATCH: ' + old[:50])
    s = s.replace(old, new)
rep('medical-masters.com, www.medical-masters.com {\n', '''# SEO-05: www -> sin www (301)
www.medical-masters.com {
\timport comunes
\tredir https://medical-masters.com{uri} permanent
}
medical-masters.com {
''')
lines = s.split('\n')
i = next(k for k, l in enumerate(lines) if l.startswith('\theader Content-Security-Policy'))
lines.insert(i + 1, '\t# SEO-17: HSTS como en Vercel (solo este sitio, no en (comunes))\n\theader Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"')
s = '\n'.join(lines)
rep('\ttry_files {path} /index.html\n\tfile_server\n}', '''\t# SEO-03: QR impresos -> funcion qr-scan (302 con UTM y registro del escaneo)
\thandle /qr {
\t\trewrite * /functions/v1/qr-scan?{query}
\t\treverse_proxy 127.0.0.1:8000
\t}
\t# SEO-01/02/04/06/07: paginas HTML, robots.txt y sitemap.xml -> servicio mm-seo
\t# (/srv/mm-seo, sustituye a middleware.ts de Vercel: <head> por URL, X-Robots-Tag, 404)
\t@seo {
\t\tmethod GET HEAD
\t\tnot path /assets/* /api/* /.well-known/* /qr
\t\tnot {
\t\t\tpath_regexp \\.[A-Za-z0-9]{1,8}$
\t\t\tnot path /robots.txt /sitemap.xml
\t\t}
\t}
\thandle @seo {
\t\treverse_proxy 127.0.0.1:8871
\t}
\thandle {
\t\ttry_files {path} /index.html
\t\tfile_server
\t}
\t# Si mm-seo no contesta: index.html estatico con 200, como antes
\thandle_errors 502 503 504 {
\t\trewrite * /index.html
\t\tfile_server {
\t\t\tstatus 200
\t\t}
\t}
}''')
p.write_text(s); print('ok')
