import re, sys, os
ROOT = '/root/mm-fix/medico/src/'

def sub(path, old, new, count=1):
    p = ROOT + path
    s = open(p, encoding='utf-8').read()
    pat = re.escape(old).replace('\\\n', '\n').replace('\n', '\n(?:[ \t]*\n)*')
    found = re.findall(pat, s)
    n = len(found)
    if n != count:
        sys.exit(f'FAIL {path}: expected {count} got {n} for: {old[:80]!r}')
    s = re.sub(pat, lambda m: new, s)
    open(p, 'w', encoding='utf-8').write(s)

# ---------- MED-01 ----------
sub('pages/ComoFunciona.tsx',
    "{ id: 'd4', icon: Pill, other: 'patient', href: () => '/prescriptions/new', doctorOnly: true }",
    "{ id: 'd4', icon: Pill, other: 'patient', href: () => '/prescriptions', doctorOnly: true }")
sub('pages/CreatePrescription.tsx',
    "import { useSearchParams, useNavigate } from 'react-router-dom';",
    "import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';")
sub('pages/CreatePrescription.tsx',
    "  const patientId = params.get('patientId') || '';\n",
    "  const patientId = params.get('patientId') || '';\n"
    "  // Sin paciente no se puede emitir: el selector de paciente vive en /prescriptions.\n"
    "  if (!patientId) return <Navigate to=\"/prescriptions\" replace />;\n")
sub('components/prescriptions/PrescriptionForm.tsx',
    "    if (!user?.id || !user.doctorProfile) return;\n",
    "    if (!user?.id || !user.doctorProfile) return;\n"
    "    if (!patientId) {\n"
    "      toast.error(t('rxExtra.patientRequired'));\n"
    "      return;\n"
    "    }\n")

# ---------- MED-08 ----------
sub('components/prescriptions/PrescriptionForm.tsx',
    "      if (!user?.id || !cedula) return;\n",
    "      if (!user?.id || !cedula) return;\n"
    "      // SEP solo acepta 7-8 dígitos: con otro formato la llamada falla siempre.\n"
    "      if (!/^\\d{7,8}$/.test(String(cedula).trim())) return;\n")

# ---------- MED-06 (el aviso se traduce al pintarlo, en el idioma de quien lo lee) ----------
sub('components/chat/ChatMessageBubble.tsx',
    "      const textPart = stripEmoji(content.split('/prescriptions/')[0]);\n",
    "      const rawText = stripEmoji(content.split('/prescriptions/')[0]);\n"
    "      // Aviso automático de receta (se guarda en español): se muestra en el idioma del lector.\n"
    "      const textPart = /^\\s*Se te ha generado tu receta médica/i.test(rawText)\n"
    "        ? t('chatMessageBubble.prescriptionReady')\n"
    "        : rawText;\n")

# ---------- MED-02 ----------
sub('pages/IdentityVerification.tsx',
    """      if (data && !error) {
        setVerification(data as unknown as VerificationRecord);
      }
""",
    """      let current = data && !error ? (data as unknown as VerificationRecord) : null;
      // Un médico ya aprobado está verificado aunque su último intento de Veriff fallara.
      if (role === 'doctor' && current?.status !== 'verified') {
        const { data: dp } = await supabase
          .from('doctor_profiles')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();
        if ((dp as any)?.status === 'approved') {
          current = { id: 'doctor-approved', status: 'verified', provider: 'manual', created_at: '', verified_at: null, metadata: null };
        }
      }
      if (current) {
        setVerification(current);
      }
""")
sub('pages/IdentityVerification.tsx',
    "  }, [user?.id]);\n  useEffect(() => {\n    fetchVerification();",
    "  }, [user?.id, role]);\n  useEffect(() => {\n    fetchVerification();")

# ---------- MED-03 ----------
mr = 'pages/MedicalRecord.tsx'
sub(mr,
    "  const [hasRecord, setHasRecord] = useState(false);\n",
    "  const [hasRecord, setHasRecord] = useState(false);\n"
    "  const [loadError, setLoadError] = useState(false);\n")
sub(mr,
    "  const dataRef = useRef<ClinicalData>(DEFAULT_DATA);\n",
    "  const dataRef = useRef<ClinicalData>(DEFAULT_DATA);\n"
    "  // Solo se guarda si el usuario cambió algo (abrir la página no escribe en la BD).\n"
    "  const isDirtyRef = useRef(false);\n"
    "  const prevDataRef = useRef<ClinicalData | null>(null);\n")
sub(mr,
    """      const { data: record } = await supabase
        .from('patient_clinical_history')
        .select('*')
        .eq('patient_id', user.id)
        .maybeSingle();
""",
    """      const { data: record, error: loadErr } = await supabase
        .from('patient_clinical_history')
        .select('*')
        .eq('patient_id', user.id)
        .maybeSingle();
      if (loadErr) {
        console.error('[MedicalRecord] load failed:', loadErr);
        setLoadError(true);
        setIsLoading(false);
        return;
      }
""")
sub(mr,
    """    if (isLoading) return;
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutoSaveStatus('saving');
    autosaveTimerRef.current = setTimeout(() => {
      persistData({ silent: true });
    }, 1500);
""",
    """    if (isLoading || loadError) return;
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevDataRef.current = data;
      return;
    }
    if (prevDataRef.current === data) return;
    prevDataRef.current = data;
    isDirtyRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutoSaveStatus('saving');
    autosaveTimerRef.current = setTimeout(() => {
      isDirtyRef.current = false;
      persistData({ silent: true }).then((r) => { if (!r?.ok) isDirtyRef.current = true; });
    }, 1500);
""")
sub(mr,
    "  }, [data, isLoading, persistData]);",
    "  }, [data, isLoading, loadError, persistData]);")
sub(mr,
    """      if (document.visibilityState === 'hidden' && initialLoadDoneRef.current) {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        persistData({ silent: true });
      }
""",
    """      if (document.visibilityState === 'hidden' && initialLoadDoneRef.current && isDirtyRef.current) {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        isDirtyRef.current = false;
        persistData({ silent: true }).then((r) => { if (!r?.ok) isDirtyRef.current = true; });
      }
""")
sub(mr,
    """          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }
""",
    """          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }
  if (loadError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20 px-4 text-center text-sm text-destructive" role="alert">
          {t('medicalRecordPage.loadError')}
        </div>
      </MainLayout>
    );
  }
""")

# ---------- MED-04 ----------
eh = 'pages/DoctorEmailHistory.tsx'
sub(eh,
    "type EmailTypeFilter = 'all' | 'new_content' | 'live_started' | 'availability_reminder';",
    "type EmailTypeFilter = 'all' | 'new_content' | 'live_started' | 'availability_reminder' | 'appointment_reminder';")
sub(eh,
    "    case 'availability_reminder': return <CalendarIcon className=\"w-4 h-4\" />;\n",
    "    case 'availability_reminder':\n    case 'appointment_reminder': return <CalendarIcon className=\"w-4 h-4\" />;\n")
sub(eh,
    "    { value: 'availability_reminder', label: t('doctorEmailHistoryPage.filters.types.reminders') },\n",
    "    { value: 'availability_reminder', label: t('doctorEmailHistoryPage.filters.types.reminders') },\n"
    "    { value: 'appointment_reminder', label: t('doctorEmailHistoryPage.filters.types.appointmentReminders') },\n")
sub(eh,
    """      case 'availability_reminder': return t('doctorEmailHistoryPage.emailTypeLabels.reminder');
      default: return type;
""",
    """      case 'availability_reminder': return t('doctorEmailHistoryPage.emailTypeLabels.reminder');
      case 'appointment_reminder': return t('doctorEmailHistoryPage.emailTypeLabels.appointmentReminder');
      default: return t('doctorEmailHistoryPage.emailTypeLabels.other');
""")
sub(eh,
    "        <MobileBackHeader />\n",
    "        <MobileBackHeader />\n"
    "        <h1 className=\"pro-page-title\"><Mail className=\"w-7 h-7\" /> <span>{t('emailHistoryCard.title')}</span></h1>\n")

# ---------- MED-05 ----------
sub('index.css',
    "@media (min-width: 1280px) { .pro-work-chat { grid-template-columns: 180px 268px minmax(0, 1fr) 250px; } }",
    "@media (min-width: 1280px) { .pro-work-chat { grid-template-columns: 180px 320px minmax(0, 1fr) 230px; } }")
sub('index.css',
    ".pro-conv .foot { display: flex; align-items: center; gap: 8px; margin-top: 5px; min-width: 0; }",
    ".pro-conv .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 5px; min-width: 0; }")

# ---------- MED-10 ----------
dp = 'hooks/useDoctorPatients.ts'
sub(dp,
    "          .select('patient_id, started_at')\n",
    "          .select('patient_id, status, started_at, ended_at, completed_at')\n")
sub(dp,
    """        e.lastConsultationAt = later(e.lastConsultationAt, c.started_at || null);
""",
    """        // Mismo criterio que la ficha del paciente: fecha de cierre y sin las reembolsadas.
        if (c.status !== 'refunded') {
          e.lastConsultationAt = later(e.lastConsultationAt, c.completed_at || c.ended_at || c.started_at || null);
        }
""")
sub('pages/DoctorPatientDetail.tsx',
    """  const lastConsultationAt =
    overview?.last_consultation_at ||
    data.consultations[0]?.completed_at || data.consultations[0]?.ended_at || data.consultations[0]?.started_at || null;
""",
    """  // Mismo criterio que la lista de pacientes (useDoctorPatients): consultas no
  // reembolsadas por su fecha de cierre y citas pasadas no canceladas.
  const lastConsultationAt = (() => {
    const nowIso = new Date().toISOString();
    let last: string | null = null;
    for (const c of data.consultations as any[]) {
      if (c.status === 'refunded') continue;
      const d = c.completed_at || c.ended_at || c.started_at;
      if (d && (!last || d > last)) last = d;
    }
    for (const a of data.appointments as any[]) {
      if (a.scheduled_at < nowIso && a.status !== 'cancelled' && (!last || a.scheduled_at > last)) last = a.scheduled_at;
    }
    return last;
  })();
""")

# ---------- i18n (8 idiomas) ----------
T = {
 'es': dict(ready='Se te ha generado tu receta médica. Toca para verla.', pat='Selecciona un paciente antes de emitir la receta.',
            appt='Recordatorio de cita', appts='Recordatorios de cita', other='Otro aviso', load='No se pudo cargar tu historial clínico. Revisa tu conexión y vuelve a intentarlo.'),
 'en': dict(ready='Your medical prescription is ready. Tap to view it.', pat='Select a patient before issuing the prescription.',
            appt='Appointment reminder', appts='Appointment reminders', other='Other notice', load="We couldn't load your medical history. Check your connection and try again."),
 'ca': dict(ready="S'ha generat la teva recepta mèdica. Toca per veure-la.", pat='Selecciona un pacient abans d’emetre la recepta.',
            appt='Recordatori de cita', appts='Recordatoris de cita', other='Altre avís', load="No s'ha pogut carregar el teu historial clínic. Revisa la connexió i torna-ho a provar."),
 'de': dict(ready='Dein ärztliches Rezept ist bereit. Tippe, um es anzusehen.', pat='Wähle einen Patienten aus, bevor du das Rezept ausstellst.',
            appt='Terminerinnerung', appts='Terminerinnerungen', other='Sonstige Benachrichtigung', load='Deine Krankengeschichte konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.'),
 'fr': dict(ready='Votre ordonnance est prête. Touchez pour la voir.', pat='Sélectionnez un patient avant d’émettre l’ordonnance.',
            appt='Rappel de rendez-vous', appts='Rappels de rendez-vous', other='Autre avis', load='Impossible de charger votre dossier médical. Vérifiez votre connexion et réessayez.'),
 'it': dict(ready='La tua ricetta medica è pronta. Tocca per vederla.', pat='Seleziona un paziente prima di emettere la ricetta.',
            appt='Promemoria appuntamento', appts='Promemoria appuntamenti', other='Altro avviso', load='Impossibile caricare la tua cartella clinica. Controlla la connessione e riprova.'),
 'pt': dict(ready='Sua receita médica foi gerada. Toque para vê-la.', pat='Selecione um paciente antes de emitir a receita.',
            appt='Lembrete de consulta', appts='Lembretes de consulta', other='Outro aviso', load='Não foi possível carregar seu histórico clínico. Verifique sua conexão e tente novamente.'),
 'zh': dict(ready='您的处方已生成，点击查看。', pat='开具处方前请先选择患者。',
            appt='预约提醒', appts='预约提醒', other='其他通知', load='无法加载您的病历，请检查网络连接后重试。'),
}

def q(v):
    return '"' + v.replace('\\', '\\\\').replace('"', '\\"') + '"'

def insert_before_line(lines, idx, text):
    indent = re.match(r'\s*', lines[idx]).group(0)
    lines.insert(idx, indent + text + '\n')

for lang, v in T.items():
    p = ROOT + f'lib/i18n/{lang}.ts'
    lines = open(p, encoding='utf-8').read().splitlines(keepends=True)
    quoted = lang in ('ca', 'zh') and lines[2].lstrip().startswith('"')
    def key(k):
        return f'"{k}"' if quoted else k
    def find(pred, start=0, end=None):
        end = len(lines) if end is None else end
        for i in range(start, end):
            if pred(lines[i]):
                return i
        sys.exit(f'FAIL i18n {lang}: anchor not found')
    def kmatch(k):
        return lambda l: re.match(r'\s*"?' + re.escape(k) + r'"?\s*:', l) is not None
    # chatMessageBubble.prescriptionReady (antes de viewPrescription)
    i = find(kmatch('viewPrescription'))
    insert_before_line(lines, i, f"{key('prescriptionReady')}: {q(v['ready'])},")
    # rxExtra.patientRequired (antes de genericRequired)
    i = find(kmatch('genericRequired'))
    insert_before_line(lines, i, f"{key('patientRequired')}: {q(v['pat'])},")
    # doctorEmailHistoryPage
    b = find(kmatch('doctorEmailHistoryPage'))
    e = find(lambda l: re.match(r'  \},?\s*$', l) is not None, b + 1)
    i = find(kmatch('emailTypeLabels'), b, e)
    j = find(kmatch('newContent'), i, e)
    insert_before_line(lines, j, f"{key('other')}: {q(v['other'])},")
    insert_before_line(lines, j, f"{key('appointmentReminder')}: {q(v['appt'])},")
    e += 2
    i = find(kmatch('types'), j, e)
    j = find(kmatch('newContent'), i, e)
    insert_before_line(lines, j, f"{key('appointmentReminders')}: {q(v['appts'])},")
    # medicalRecordPage.loadError (primera línea del bloque)
    b = find(kmatch('medicalRecordPage'))
    insert_before_line(lines, b + 1, f"{key('loadError')}: {q(v['load'])},")
    open(p, 'w', encoding='utf-8').write(''.join(lines))
print('OK')
