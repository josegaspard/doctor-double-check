import re, sys
R = '/root/mm-fix/paciente/'
def edit(path, old, new, count=1):
    p = R + path
    s = open(p, encoding='utf-8').read()
    n = s.count(old)
    if n != count:
        sys.exit(f'FALLO {path}: {n} coincidencias de {old[:60]!r}')
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    print('ok', path)

# PAC-04
edit('src/lib/sessionGuard.ts', 'await supabase.auth.signOut();', "await supabase.auth.signOut({ scope: 'local' });")

# PAC-08
edit('src/pages/BookAppointment.tsx',
     "{t('bookAppointment.header.titlePrefix')} Dr. {doctor.name}",
     "{t('bookAppointment.header.titlePrefix')} {/^dra?\\.?\\s/i.test(doctor.name || '') ? doctor.name : `Dr. ${doctor.name}`}")

# PAC-09: el botón «Volver al Foro» solo para quien puede entrar al foro
p = R + 'src/pages/Eventos.tsx'
s = open(p, encoding='utf-8').read()
m = re.search(r"\n(\s*)(<Button variant=\"back\" size=\"sm\" onClick=\{\(\) => navigate\('/foro'\)\}.*?</Button>)", s, re.S)
if not m or s.count("navigate('/foro')") != 1: sys.exit('FALLO Eventos')
ind, block = m.group(1), m.group(2)
new = f"\n{ind}{{(role === 'doctor' || role === 'resident' || role === 'admin') && (\n{ind}  " + block.replace('\n', '\n  ') + f"\n{ind})}}"
s = s[:m.start()] + new + s[m.end():]
open(p, 'w', encoding='utf-8').write(s); print('ok Eventos')

# PAC-06: sin «Chat» duplicado en la píldora del paciente y etiquetas cortas
edit('src/components/layout/MainLayout.tsx',
     "  // Residente: el Chat ya está en el icono de la cabecera; en el menú salía repetido (cliente 4-nov-2026).\n  { labelKey: 'nav.chat', href: '/chat', icon: MessageSquare, roles: ['patient'] },\n",
     "  // Residente y paciente: el Chat ya está en el botón de la cabecera; en la píldora salía repetido\n  // (cliente 4-nov-2026; paciente 11-nov-2026: a 1440 px la píldora se cortaba).\n")
edit('src/components/layout/MainLayout.tsx',
     "<span className={role === 'resident' ? 'hidden' : 'hidden xl:inline'}>{label}</span>\n                      <span className={role === 'resident' ? '' : 'xl:hidden'}>",
     "<span className={role === 'resident' || role === 'patient' ? 'hidden' : 'hidden xl:inline'}>{label}</span>\n                      <span className={role === 'resident' || role === 'patient' ? '' : 'xl:hidden'}>")

# PAC-07: consulta ya terminada en VideoCall
V = 'src/pages/VideoCall.tsx'
edit(V, "        .select('doctor_id, patient_id, chat_session_id')\n        .eq('id', consultationId)\n        .maybeSingle();\n      if (!data) return;\n",
        "        .select('doctor_id, patient_id, chat_session_id, status')\n        .eq('id', consultationId)\n        .maybeSingle();\n      if (!data) return;\n      setConsultationEnded(['completed', 'cancelled', 'canceled'].includes((data as any).status));\n")
edit(V, "  const consultationId = searchParams.get('consultation');\n",
        "  const consultationId = searchParams.get('consultation');\n  // La orientación ya terminó (completed/cancelled): no dejar al paciente «esperando al médico».\n  const [consultationEnded, setConsultationEnded] = useState(false);\n")
edit(V, "  const isInCall = callState === 'connecting' || callState === 'connected';\n",
        "  if (consultationEnded && callState === 'idle') {\n    return (\n      <MainLayout>\n        <div className=\"container mx-auto px-4 py-12 text-center\">\n          <h2 className=\"text-xl font-bold mb-4\">{t('videoCall.consultationEnded')}</h2>\n          <Button onClick={() => navigate('/chat')}>{t('videoCall.backToChat')}</Button>\n        </div>\n      </MainLayout>\n    );\n  }\n\n  const isInCall = callState === 'connecting' || callState === 'connected';\n")

tx = {
 'es': ("    noConsultation: 'No se especificó una orientación',\n", "    consultationEnded: 'Esta orientación ya terminó',\n"),
 'en': ('    noConsultation: "No guidance session specified",\n', '    consultationEnded: "This guidance session has already ended",\n'),
 'de': ('    noConsultation: "Es wurde keine Beratung angegeben",\n', '    consultationEnded: "Diese Beratung ist bereits beendet",\n'),
 'fr': ('    noConsultation: "Aucune consultation spécifiée",\n', '    consultationEnded: "Cette consultation est déjà terminée",\n'),
 'it': ('    noConsultation: "Nessun consulto specificato",\n', '    consultationEnded: "Questo consulto è già terminato",\n'),
 'pt': ('    noConsultation: "Nenhuma orientação foi especificada",\n', '    consultationEnded: "Esta orientação já terminou",\n'),
 'ca': ('    "noConsultation": "No s\'ha especificat cap orientació",\n', '    "consultationEnded": "Aquesta orientació ja ha acabat",\n'),
 'zh': ('    "noConsultation": "未指定咨询",\n', '    "consultationEnded": "本次咨询已结束",\n'),
}
for lang, (old, add) in tx.items():
    edit(f'src/lib/i18n/{lang}.ts', old, old + add)
