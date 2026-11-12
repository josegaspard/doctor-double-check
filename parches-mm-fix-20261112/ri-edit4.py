def rep(p, pairs):
    s=open(p,encoding="utf8").read()
    for a,b,*cnt in pairs:
        n=s.count(a)
        want = cnt[0] if cnt else 1
        assert n==want, (p, n, a[:70])
        s=s.replace(a,b)
    open(p,"w",encoding="utf8").write(s)

K = "residentGroupChat"
def T(k): return "t('%s.%s')" % (K, k)

rep("src/components/chat/ResidentGroups.tsx", [
("""const errText = (e: any) => {
  const m = String(e?.message || '');
  if (m.includes('MEMBERS_REQUIRED')) return 'Elige al menos un residente para el grupo.';
  if (m.includes('NAME_REQUIRED')) return 'Ponle un nombre al grupo.';
  if (m.includes('ONLY_RESIDENTS')) return 'Los grupos son solo entre residentes.';
  if (m.includes('ONLY_ADMINS')) return 'Solo quien administra el grupo puede cambiar el nombre.';
  if (m.includes('NOT_A_MEMBER')) return 'Ya no perteneces a este grupo.';
  return 'No se pudo completar. Inténtalo de nuevo.';
};""",
"""const errText = (e: any, t: (k: string) => string) => {
  const m = String(e?.message || '');
  if (m.includes('MEMBERS_REQUIRED')) return t('residentGroupChat.errMembersRequired');
  if (m.includes('NAME_REQUIRED')) return t('residentGroupChat.errNameRequired');
  if (m.includes('ONLY_RESIDENTS')) return t('residentGroupChat.errOnlyResidents');
  if (m.includes('ONLY_ADMINS')) return t('residentGroupChat.errOnlyAdmins');
  if (m.includes('NOT_A_MEMBER')) return t('residentGroupChat.errNotMember');
  return t('residentGroupChat.errGeneric');
};"""),
("toast.error(errText(error));", "toast.error(errText(error, t));", 5),
('''placeholder="Buscar grupo" aria-label="Buscar grupo"''', '''placeholder={%s} aria-label={%s}''' % (T("search"), T("search"))),
('''aria-label="Nuevo grupo" title="Nuevo grupo"''', '''aria-label={%s} title={%s}''' % (T("newGroup"), T("newGroup"))),
("""{query.trim() ? 'Ningún grupo coincide con la búsqueda.' : 'Todavía no estás en ningún grupo. Crea uno con otros residentes para conversar.'}""",
 """{query.trim() ? %s : %s}""" % (T("noMatch"), T("empty"))),
("""<Plus /> Nuevo grupo</button>""", """<Plus /> {%s}</button>""" % T("newGroup")),
("""<span className="pro-tag">Grupo</span>""", """<span className="pro-tag">{%s}</span>""" % T("tag")),
("""{g.member_count} {g.member_count === 1 ? 'miembro' : 'miembros'}</span>""",
 """{g.member_count} {g.member_count === 1 ? %s : %s}</span>""" % (T("member"), T("members"))),
(""": 'Sin mensajes todavía'}""", """: %s}""" % T("noMessagesYet")),
("""next.set(p.user_id, p.name || 'Residente')""", """next.set(p.user_id, p.name || %s)""" % T("resident")),
("""<p className="text-[13px] pro-muted max-w-xs">Elige un grupo para ver la conversación o crea uno nuevo con otros residentes.</p>""",
 """<p className="text-[13px] pro-muted max-w-xs">{%s}</p>""" % T("pickGroup")),
("""{group.member_count} {group.member_count === 1 ? 'miembro' : 'miembros'} · grupo de residentes</p>""",
 """{group.member_count} {group.member_count === 1 ? %s : %s} · {%s}</p>""" % (T("member"), T("members"), T("residentGroup"))),
("""<UsersRound /> Miembros
        </button>""", """<UsersRound /> {%s}
        </button>""" % T("membersButton")),
(""">Aún no hay mensajes. Escribe el primero.</p>""", """>{%s}</p>""" % T("emptyThread")),
('''placeholder="Escribe un mensaje al grupo"
          aria-label="Escribe un mensaje al grupo"''', '''placeholder={%s}
          aria-label={%s}''' % (T("messagePlaceholder"), T("messagePlaceholder"))),
('''aria-label="Enviar">''', '''aria-label={%s}>''' % T("send")),
("""{names.get(m.sender_id) || 'Residente'}""", """{names.get(m.sender_id) || %s}""" % T("resident")),
# ResidentPicker
("""}: { excludeIds: Set<string>; selected: Set<string>; onToggle: (id: string) => void }) {
  const [q, setQ] = useState('');""", """}: { excludeIds: Set<string>; selected: Set<string>; onToggle: (id: string) => void }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');"""),
('''placeholder="Buscar residente por nombre" aria-label="Buscar residente por nombre"''', '''placeholder={%s} aria-label={%s}''' % (T("searchResident"), T("searchResident"))),
(""">No hay residentes para agregar.</p>""", """>{%s}</p>""" % T("noResidents")),
("""{p.name || 'Residente'}</span>""", """{p.name || %s}</span>""" % T("resident")),
("""{selected.size === 1 ? 'seleccionado' : 'seleccionados'}""", """{selected.size === 1 ? %s : %s}""" % (T("selectedOne"), T("selectedMany"))),
# CreateResidentGroupDialog
("""}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');""", """}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');"""),
("""toast.success('Grupo creado');""", """toast.success(%s);""" % T("created")),
("""<DialogTitle>Nuevo grupo de residentes</DialogTitle>""", """<DialogTitle>{%s}</DialogTitle>""" % T("createTitle")),
("""<DialogDescription>Ponle nombre y elige con qué residentes quieres conversar.</DialogDescription>""", """<DialogDescription>{%s}</DialogDescription>""" % T("createDescription")),
('''placeholder="Nombre del grupo (ej. Guardia R1 Medicina Interna)"
            aria-label="Nombre del grupo"''', '''placeholder={%s}
            aria-label={%s}''' % (T("namePlaceholder"), T("nameLabel"))),
("""onClick={() => onOpenChange(false)}>Cancelar</button>""", """onClick={() => onOpenChange(false)}>{%s}</button>""" % T("cancel")),
("""<Plus />} Crear grupo""", """<Plus />} {%s}""" % T("create")),
# ResidentGroupMembers
("""}: { group: ResidentGroup | null; userId?: string; onChanged: () => void; onLeft: () => void }) {
  const [members""", """}: { group: ResidentGroup | null; userId?: string; onChanged: () => void; onLeft: () => void }) {
  const { t } = useLanguage();
  const [members"""),
("""      name: r.name || 'Residente',""", """      name: r.name || %s,""" % T("resident")),
("""<p className="text-[12.5px] pro-muted">Elige un grupo para ver sus miembros.</p>""", """<p className="text-[12.5px] pro-muted">{%s}</p>""" % T("pickGroupMembers")),
("""toast.success(Number(data) === 1 ? 'Residente agregado' : `${data} residentes agregados`);""",
 """toast.success(Number(data) === 1 ? %s : t('residentGroupChat.addedMany').replace('{n}', String(data)));""" % T("addedOne")),
("""toast.success('Nombre actualizado');""", """toast.success(%s);""" % T("renamed")),
("""      title: 'Salir del grupo',
      description: 'Dejarás de ver los mensajes de este grupo. Alguien del grupo puede volver a agregarte.',
      tone: 'destructive',
      details: [{ label: 'Grupo', value: group.name }],
      confirmLabel: 'Salir del grupo',""", """      title: %s,
      description: %s,
      tone: 'destructive',
      details: [{ label: %s, value: group.name }],
      confirmLabel: %s,""" % (T("leave"), T("leaveDescription"), T("tag"), T("leave"))),
("""toast.success('Saliste del grupo');""", """toast.success(%s);""" % T("left")),
('''aria-label="Nuevo nombre del grupo"''', '''aria-label={%s}''' % T("newNameLabel")),
("""disabled={saving || !newName.trim()}>Guardar</button>""", """disabled={saving || !newName.trim()}>{%s}</button>""" % T("save")),
('''aria-label="Cambiar nombre"''', '''aria-label={%s}''' % T("rename")),
("""{members.length === 1 ? 'miembro' : 'miembros'}""", """{members.length === 1 ? %s : %s}""" % (T("member"), T("members"))),
("""{m.id === userId ? 'Tú' : m.name}""", """{m.id === userId ? %s : m.name}""" % T("you")),
("""<Crown className="w-3 h-3" /> Admin</span>""", """<Crown className="w-3 h-3" /> {%s}</span>""" % T("admin")),
("""setSelected(new Set()); }}>Cancelar</button>""", """setSelected(new Set()); }}>{%s}</button>""" % T("cancel")),
("""<UserPlus />} Agregar
""", """<UserPlus />} {%s}
""" % T("add")),
("""<UserPlus /> Agregar residentes""", """<UserPlus /> {%s}""" % T("addResidents")),
("""<LogOut /> Salir del grupo""", """<LogOut /> {%s}""" % T("leave")),
])

rep("src/pages/Chat.tsx", [
('''aria-label="Miembros del grupo">
                  <h2 className="pro-card-title text-[15px] mb-2"><UsersRound /> Miembros</h2>''',
 '''aria-label={t('residentGroupChat.membersAria')}>
                  <h2 className="pro-card-title text-[15px] mb-2"><UsersRound /> {t('residentGroupChat.membersButton')}</h2>'''),
])
rep("src/components/recordings/RecordingControls.tsx", [
('''aria-label="pantalla completa"''', '''aria-label={t('uiLabels.fullscreen')}'''),
])
rep("src/pages/DoctorRecordings.tsx", [
('''title="Espectadores · % visto medio"''', '''title={t('uiLabels.viewersAvgWatched')}'''),
])
rep("src/components/content/InlineFileViewer.tsx", [
('''          title="Documento"''', '''          title={t('uiLabels.document')}'''),
])
print("ok")
