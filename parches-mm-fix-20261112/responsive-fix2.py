def sub(path, old, new):
    s=open(path).read(); assert s.count(old)==1,(path,old)
    open(path,"w").write(s.replace(old,new,1)); print("ok",path)
sub("index.html",'    <!-- maximum-scale=1.0 + user-scalable=no previene el "stuck zoom" en iOS Safari cuando el usuario toca controles. La accesibilidad de pinch-zoom queda preservada por iOS Accessibility Settings. -->',
    '    <!-- Sin maximum-scale ni user-scalable=no: el zoom con los dedos tiene que funcionar (WCAG 1.4.4). El zoom automático de iOS al enfocar un campo se evita con font-size 16px en los campos (index.css, bloque «zoom iOS»). -->')
sub("src/components/doctor/schedule/ScheduleEditor.tsx","<Switch checked={on} onCheckedChange={v => toggleWeekday(w, v)} aria-label={dayName} />",
    "<Switch checked={on} onCheckedChange={v => toggleWeekday(w, v)} aria-label={dayName} className=\"relative after:absolute after:-inset-2 after:content-['']\" />")
sub("src/components/doctor/schedule/ScheduleEditor.tsx","<Switch checked={dateClosed} onCheckedChange={setDateClosed} />",
    "<Switch checked={dateClosed} onCheckedChange={setDateClosed} className=\"relative after:absolute after:-inset-2 after:content-['']\" />")
css = '''

/* ── Responsive móvil (revisión 11-nov-2026) ─────────────────────────────── */
/* Zoom iOS: al quitar user-scalable=no, iOS amplía la página al enfocar un campo
   con letra < 16 px. Solo en iOS (Android no hace ese zoom). */
@supports (-webkit-touch-callout: none) {
  @media (max-width: 640px) {
    input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
    textarea,
    select { font-size: 16px !important; }
  }
}
/* Filas con desplazamiento lateral: desvanecido en el borde derecho para que se
   note que hay más opciones. */
@media (max-width: 639px) {
  .mm-scroll-fade,
  .pro-lane-row {
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
  }
  /* Zonas de toque de 40 px como mínimo */
  .pro-link:not(.inline),
  .auth-link-inline { min-height: 40px; }
  .pro-prof-avatar .cam { width: 36px; height: 36px; }
  .pro-prof-avatar .cam::after { content: ''; position: absolute; inset: -4px; }
  .di-kpi-eye { position: relative; }
  .di-kpi-eye::after { content: ''; position: absolute; inset: -8px; }
}
'''
open("src/index.css","a").write(css); print("ok css")
