import sys
R='/root/mm-fix/admin-residente/'
def rep(path, old, new):
    p=R+path; s=open(p,encoding='utf-8').read()
    assert s.count(old)==1, (path, old[:60], s.count(old))
    open(p,'w',encoding='utf-8').write(s.replace(old,new))
# AR-01 edge
f='supabase/functions/admin-api-usage/index.ts'
rep(f,"  revenueMxn: number; available: boolean; note: string;\n};","  revenueMxn: number; available: boolean; note: string; testMode?: boolean;\n};")
rep(f,"      card.note = `${count} cobros · volumen ${grossTotal.toFixed(0)} · comisión ${feeTotal.toFixed(2)}`;\n",
"""      card.note = `${count} cobros · volumen ${grossTotal.toFixed(0)} · comisión ${feeTotal.toFixed(2)}`;
      // Clave de prueba o saldo no-live: los importes de Stripe son ficticios.
      if (sk.startsWith("sk_test_") || balance.livemode === false) {
        card.testMode = true;
        card.consumedUsd = null;      // comisiones de prueba: no cuentan como coste
        card.balanceUsd = null;       // saldo ficticio: no se muestra
        card.revenueMxn = rev.gross;  // ventas reales en BD, no el volumen de prueba
        card.remaining = "Modo prueba: saldo ficticio, no es dinero real";
        card.note = `Modo prueba · ${card.note}`;
      }
""")
# AR-01 + AR-04 front
f='src/pages/AdminApiUsage.tsx'
rep(f,"  currency?: string; available: boolean; note: string;\n}","  currency?: string; available: boolean; note: string; testMode?: boolean;\n}")
rep(f,"? <Badge variant=\"outline\" className=\"text-[10px]\">{roiFmt(p.roi)} ROI</Badge>",
"? (p.testMode ? <Badge variant=\"secondary\" className=\"text-[10px] gap-1\"><AlertTriangle className=\"w-3 h-3\" />Modo prueba</Badge> : <Badge variant=\"outline\" className=\"text-[10px]\">{roiFmt(p.roi)} ROI</Badge>)")
rep(f,"{p.currency === 'MXN' ? 'Volumen procesado' : 'Ingreso atribuido'}","{p.currency === 'MXN' && !p.testMode ? 'Volumen procesado' : 'Ingreso atribuido'}")
rep(f,'<div className="flex items-center gap-2 justify-between sm:justify-end">','<div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">')
# AR-02
rep('src/index.css',"""  color: hsl(220, 10%, 55%) !important;
}

/* ---------- 12. Tabs sueltas ---------- */""","""  color: hsl(220, 10%, 55%) !important;
}
/* Lupa/icono absoluto junto a un input con fondo blanco forzado: si no, hereda blanco y no se ve. */
.app-bg-image > main .relative:has(> input) > svg.absolute {
  color: hsl(220 10% 46%) !important;
  z-index: 1;
  pointer-events: none;
}

/* ---------- 12. Tabs sueltas ---------- */""")
# AR-03
f='src/pages/AdminForum.tsx'
rep(f,"const postIds = [...new Set(aRows.map((r) => r.post_id))];","const postIds = [...new Set(aRows.map((r) => r.post_id).filter(Boolean))];")
rep(f,"sb.from('forum_posts_feed').select('id, title').in('id', postIds),","postIds.length > 0 ? sb.from('forum_posts_feed').select('id, title').in('id', postIds) : Promise.resolve({ data: [] }),")
rep(f,"postTitle: tt[r.post_id] || '—' })));","postTitle: r.post_id ? (tt[r.post_id] || '—') : 'Publicación eliminada' })));")
rep(f,"<td className=\"p-2 max-w-[280px] truncate\"><Link to={`/foro?post=${a.post_id}`} className=\"text-primary underline\">{a.postTitle}</Link></td>",
"<td className=\"p-2 max-w-[280px] truncate\">{a.post_id ? <Link to={`/foro?post=${a.post_id}`} className=\"text-primary underline\">{a.postTitle}</Link> : <span className=\"text-muted-foreground\">{a.postTitle}</span>}</td>")
rep(f,"interface AuditRow { id: string; post_id: string;","interface AuditRow { id: string; post_id: string | null;")
# AR-08
f='src/pages/AdminDashboard.tsx'
rep(f,"title: t('autoI18n.clAdminDash6'), desc: t('autoI18n.clAdminDash7'), badge: stats.pendingInvoices },\n",
"title: t('autoI18n.clAdminDash6'), desc: t('autoI18n.clAdminDash7'), badge: stats.pendingInvoices },\n        { id: 'accounting', icon: BarChart3, href: '/admin/accounting', color: 'text-primary', borderColor: 'border-l-primary', title: t('autoI18n.clAdminAccount2'), desc: t('autoI18n.clAdminAccount3') },\n")
rep(f,"title: t('autoI18n.clAdminDash35'), desc: t('autoI18n.clAdminDash36'), badge: stats.pendingReports },\n",
"title: t('autoI18n.clAdminDash35'), desc: t('autoI18n.clAdminDash36'), badge: stats.pendingReports },\n        { id: 'content-moderation', icon: ShieldCheck, href: '/admin/content-moderation', color: 'text-warning', borderColor: 'border-l-warning', title: t('adminContentModeration.heading'), desc: t('adminContentModeration.subheading') },\n")
print("ok")
