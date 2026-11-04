import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { initialsOf, dayLabel, fmtTime, norm } from '@/lib/proFormat';
import { Search, Plus, Send, Loader2, UsersRound, ArrowLeft, LogOut, UserPlus, Crown, Pencil } from 'lucide-react';

// Grupos de chat entre residentes (cliente 4-nov-2026): reemplazan en el chat del
// residente la sección «Proveedores». Viven en la misma rejilla del chat:
// lista de grupos (columna 2) · conversación (columna 3) · miembros (columna 4).
// La BD (RLS + funciones resident_group_*) garantiza que solo residentes miembros
// leen y escriben.

export interface ResidentGroup {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  last_message_at: string | null;
  is_admin: boolean;
  member_count: number;
  unread_count: number;
  last_message: string | null;
  last_sender_name: string | null;
}

interface GroupMsg {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Person { id: string; name: string | null; avatar_url: string | null }

const errText = (e: any) => {
  const m = String(e?.message || '');
  if (m.includes('MEMBERS_REQUIRED')) return 'Elige al menos un residente para el grupo.';
  if (m.includes('NAME_REQUIRED')) return 'Ponle un nombre al grupo.';
  if (m.includes('ONLY_RESIDENTS')) return 'Los grupos son solo entre residentes.';
  if (m.includes('ONLY_ADMINS')) return 'Solo quien administra el grupo puede cambiar el nombre.';
  if (m.includes('NOT_A_MEMBER')) return 'Ya no perteneces a este grupo.';
  return 'No se pudo completar. Inténtalo de nuevo.';
};

const GROUPS_READ_EVENT = 'mm:resident-groups-read';
const markGroupRead = async (groupId: string) => {
  await (supabase as any).rpc('resident_group_mark_read', { p_group: groupId });
  window.dispatchEvent(new Event(GROUPS_READ_EVENT));
};

/** Estado de los grupos del residente + tiempo real. */
export function useResidentGroups(enabled: boolean) {
  const [groups, setGroups] = useState<ResidentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastInsert, setLastInsert] = useState<GroupMsg | null>(null);
  // Nombre de canal único: la cabecera y la página de chat usan el hook a la vez.
  const channelName = useRef(`resident-groups-${Math.random().toString(36).slice(2)}`).current;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await (supabase as any).rpc('resident_groups_mine');
    if (!error) setGroups((data as ResidentGroup[]) || []);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'resident_chat_group_messages' }, (payload) => {
        setLastInsert(payload.new as GroupMsg);
        refresh();
      })
      .subscribe();
    // Otra instancia del hook marcó un grupo como leído (p. ej. la página de chat): refrescar el contador.
    const onRead = () => { refresh(); };
    window.addEventListener(GROUPS_READ_EVENT, onRead);
    return () => { supabase.removeChannel(channel); window.removeEventListener(GROUPS_READ_EVENT, onRead); };
  }, [enabled, refresh, channelName]);

  const unreadTotal = useMemo(() => groups.reduce((s, g) => s + (g.unread_count || 0), 0), [groups]);
  return { groups, loading, refresh, lastInsert, unreadTotal };
}

const timeOf = (iso: string | null, language: string, t: (k: string) => string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia ? fmtTime(d, language) : `${dayLabel(d, language, t)} ${fmtTime(d, language)}`;
};

// ---------------------------------------------------------------- lista
export function ResidentGroupList({
  groups, loading, selectedId, onSelect, onCreate,
}: {
  groups: ResidentGroup[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = norm(query.trim());
    return q ? groups.filter(g => norm(g.name).includes(q) || norm(g.last_message || '').includes(q)) : groups;
  }, [groups, query]);

  return (
    <>
      <div className="flex items-center gap-2 p-2.5 pb-2">
        <label className="pro-search flex-1">
          <Search />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar grupo" aria-label="Buscar grupo" />
        </label>
        <button type="button" className="pro-btn pro-btn-live pro-btn-icon" onClick={onCreate} aria-label="Nuevo grupo" title="Nuevo grupo">
          <Plus />
        </button>
      </div>
      <div className="pro-scroll flex-1 px-1.5 pb-2">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-10 px-3">
            <span className="pro-icon-box mx-auto mb-2"><UsersRound /></span>
            <p className="text-[13px] pro-muted mb-3">
              {query.trim() ? 'Ningún grupo coincide con la búsqueda.' : 'Todavía no estás en ningún grupo. Crea uno con otros residentes para conversar.'}
            </p>
            {!query.trim() && (
              <button type="button" className="pro-btn pro-btn-live pro-btn-sm" onClick={onCreate}><Plus /> Nuevo grupo</button>
            )}
          </div>
        ) : visible.map(g => (
          <div key={g.id} className={`pro-conv ${selectedId === g.id ? 'is-active' : ''}`}>
            <button type="button" className="flex gap-2.5 flex-1 min-w-0 text-left" onClick={() => onSelect(g.id)}>
              <span className="pro-initials relative" style={{ width: 44, height: 44, fontSize: 14 }}>
                {initialsOf(g.name)}
              </span>
              <span className="body">
                <span className="top">
                  <span className="name">{g.name}</span>
                  <span className="pro-tag">Grupo</span>
                  <span className="time">{timeOf(g.last_message_at || g.created_at, language, t)}</span>
                </span>
                <span className="sub block">{g.member_count} {g.member_count === 1 ? 'miembro' : 'miembros'}</span>
                <span className="prev block">
                  {g.last_message
                    ? `${g.last_sender_name ? g.last_sender_name.split(' ')[0] + ': ' : ''}${g.last_message.slice(0, 80)}`
                    : 'Sin mensajes todavía'}
                </span>
                {g.unread_count > 0 && (
                  <span className="foot"><span className="unread ml-auto">{g.unread_count}</span></span>
                )}
              </span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- conversación
export function ResidentGroupThread({
  group, userId, lastInsert, isMobile, onBack, onOpenMembers,
}: {
  group: ResidentGroup | null;
  userId?: string;
  lastInsert: GroupMsg | null;
  isMobile: boolean;
  onBack: () => void;
  onOpenMembers: () => void;
}) {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const groupId = group?.id;

  const loadNames = useCallback(async (ids: string[]) => {
    const missing = ids.filter(id => !names.has(id));
    if (!missing.length) return;
    const { data } = await supabase.from('profiles_public').select('id, name').in('id', missing);
    setNames(prev => {
      const next = new Map(prev);
      (data || []).forEach((p: any) => next.set(p.id, p.name || 'Residente'));
      return next;
    });
  }, [names]);

  useEffect(() => {
    if (!groupId) { setMessages([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('resident_chat_group_messages')
        .select('id, group_id, sender_id, content, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (cancelled) return;
      const rows = (data as GroupMsg[]) || [];
      setMessages(rows);
      setLoading(false);
      loadNames([...new Set(rows.map(r => r.sender_id))]);
      await markGroupRead(groupId);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Mensaje nuevo en tiempo real del grupo abierto.
  useEffect(() => {
    if (!lastInsert || lastInsert.group_id !== groupId) return;
    setMessages(prev => (prev.some(m => m.id === lastInsert.id) ? prev : [...prev, lastInsert]));
    loadNames([lastInsert.sender_id]);
    if (lastInsert.sender_id !== userId) {
      void markGroupRead(groupId!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastInsert]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight; // solo el contenedor, nunca la ventana
  }, [messages]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !groupId || !userId) return;
    setSending(true);
    const { data, error } = await (supabase as any)
      .from('resident_chat_group_messages')
      .insert({ group_id: groupId, sender_id: userId, content })
      .select('id, group_id, sender_id, content, created_at')
      .single();
    setSending(false);
    if (error) { toast.error(errText(error)); return; }
    setDraft('');
    if (data) setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data as GroupMsg]));
  };

  if (!group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <span className="pro-icon-box mx-auto mb-2"><UsersRound /></span>
        <p className="text-[13px] pro-muted max-w-xs">Elige un grupo para ver la conversación o crea uno nuevo con otros residentes.</p>
      </div>
    );
  }

  // Agrupar por día.
  const days: { key: string; label: string; items: GroupMsg[] }[] = [];
  for (const m of messages) {
    const key = m.created_at.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(m);
    else days.push({ key, label: dayLabel(new Date(m.created_at), language, t), items: [m] });
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        {isMobile && (
          <button type="button" className="pro-btn pro-btn-outline pro-btn-icon" onClick={onBack} aria-label={t('common.back')}>
            <ArrowLeft />
          </button>
        )}
        <span className="pro-initials" style={{ width: 38, height: 38, fontSize: 13 }}>{initialsOf(group.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{group.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{group.member_count} {group.member_count === 1 ? 'miembro' : 'miembros'} · grupo de residentes</p>
        </div>
        <button type="button" className="pro-btn pro-btn-outline pro-btn-xs xl:hidden" onClick={onOpenMembers}>
          <UsersRound /> Miembros
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Aún no hay mensajes. Escribe el primero.</p>
        ) : days.map(d => (
          <div key={d.key} className="space-y-2">
            <div className="flex justify-center">
              <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-3 py-0.5">{d.label}</span>
            </div>
            {d.items.map(m => {
              const own = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${own ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    {!own && <p className="text-[11px] font-semibold opacity-75 mb-0.5 truncate">{names.get(m.sender_id) || 'Residente'}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-0.5 text-right ${own ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                      {fmtTime(new Date(m.created_at), language)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 p-3 border-t border-border flex-shrink-0">
        <textarea
          value={draft}
          rows={1}
          maxLength={4000}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escribe un mensaje al grupo"
          aria-label="Escribe un mensaje al grupo"
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-primary/30"
          disabled={sending}
        />
        <button type="button" className="pro-btn pro-btn-live pro-btn-icon" onClick={send} disabled={sending || !draft.trim()} aria-label="Enviar">
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- elegir residentes
function ResidentPicker({
  excludeIds, selected, onToggle,
}: { excludeIds: Set<string>; selected: Set<string>; onToggle: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const h = setTimeout(async () => {
      setLoading(true);
      const { data } = await (supabase as any).rpc('resident_directory', { p_query: q });
      if (!cancelled) { setPeople((data as Person[]) || []); setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q]);

  const list = people.filter(p => !excludeIds.has(p.id));
  return (
    <div className="space-y-2">
      <label className="pro-search">
        <Search />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar residente por nombre" aria-label="Buscar residente por nombre" />
      </label>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : list.length === 0 ? (
          <p className="text-[13px] pro-muted text-center py-6 px-3">No hay residentes para agregar.</p>
        ) : list.map(p => (
          <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/60">
            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => onToggle(p.id)} className="h-4 w-4" />
            <span className="pro-initials" style={{ width: 32, height: 32, fontSize: 12 }}>
              {p.avatar_url ? <img src={p.avatar_url} alt="" /> : initialsOf(p.name || 'R')}
            </span>
            <span className="text-sm font-medium truncate">{p.name || 'Residente'}</span>
          </label>
        ))}
      </div>
      <p className="text-[12px] pro-muted">{selected.size} {selected.size === 1 ? 'seleccionado' : 'seleccionados'}</p>
    </div>
  );
}

export function CreateResidentGroupDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(''); setSelected(new Set()); } }, [open]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const create = async () => {
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('resident_group_create', { p_name: name, p_member_ids: [...selected] });
    setSaving(false);
    if (error) { toast.error(errText(error)); return; }
    toast.success('Grupo creado');
    onOpenChange(false);
    onCreated(data as string);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Nuevo grupo de residentes</DialogTitle>
          <DialogDescription>Ponle nombre y elige con qué residentes quieres conversar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
            placeholder="Nombre del grupo (ej. Guardia R1 Medicina Interna)"
            aria-label="Nombre del grupo"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <ResidentPicker excludeIds={new Set()} selected={selected} onToggle={toggle} />
        </div>
        <DialogFooter className="gap-2">
          <button type="button" className="pro-btn pro-btn-outline" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className="pro-btn pro-btn-live" onClick={create} disabled={saving || !name.trim() || selected.size === 0}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />} Crear grupo
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- miembros
export function ResidentGroupMembers({
  group, userId, onChanged, onLeft,
}: { group: ResidentGroup | null; userId?: string; onChanged: () => void; onLeft: () => void }) {
  const [members, setMembers] = useState<(Person & { is_admin: boolean })[]>([]);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const { confirm, dialog } = useConfirmAction();
  const groupId = group?.id;

  const load = useCallback(async () => {
    if (!groupId) { setMembers([]); return; }
    const { data: rows } = await (supabase as any)
      .from('resident_chat_group_members')
      .select('user_id, is_admin, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });
    const ids = ((rows as any[]) || []).map(r => r.user_id);
    const { data: profs } = ids.length
      ? await supabase.from('profiles_public').select('id, name, avatar_url').in('id', ids)
      : { data: [] as any[] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setMembers(((rows as any[]) || []).map(r => ({
      id: r.user_id,
      name: (map.get(r.user_id) as any)?.name ?? 'Residente',
      avatar_url: (map.get(r.user_id) as any)?.avatar_url ?? null,
      is_admin: r.is_admin,
    })));
  }, [groupId]);

  useEffect(() => { load(); setAdding(false); setRenaming(false); }, [load, group?.member_count]);

  if (!group) return <p className="text-[12.5px] pro-muted">Elige un grupo para ver sus miembros.</p>;

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addMembers = async () => {
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('resident_group_add_members', { p_group: group.id, p_member_ids: [...selected] });
    setSaving(false);
    if (error) { toast.error(errText(error)); return; }
    toast.success(Number(data) === 1 ? 'Residente agregado' : `${data} residentes agregados`);
    setAdding(false);
    setSelected(new Set());
    await load();
    onChanged();
  };

  const rename = async () => {
    setSaving(true);
    const { error } = await (supabase as any).rpc('resident_group_rename', { p_group: group.id, p_name: newName });
    setSaving(false);
    if (error) { toast.error(errText(error)); return; }
    toast.success('Nombre actualizado');
    setRenaming(false);
    onChanged();
  };

  const leave = async () => {
    const ok = await confirm({
      title: 'Salir del grupo',
      description: 'Dejarás de ver los mensajes de este grupo. Alguien del grupo puede volver a agregarte.',
      tone: 'destructive',
      details: [{ label: 'Grupo', value: group.name }],
      confirmLabel: 'Salir del grupo',
    });
    if (!ok) return;
    const { error } = await (supabase as any).rpc('resident_group_leave', { p_group: group.id });
    if (error) { toast.error(errText(error)); return; }
    toast.success('Saliste del grupo');
    onLeft();
  };

  return (
    <div className="space-y-3">
      <div>
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={80}
              aria-label="Nuevo nombre del grupo"
              className="flex-1 min-w-0 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            />
            <button type="button" className="pro-btn pro-btn-live pro-btn-xs" onClick={rename} disabled={saving || !newName.trim()}>Guardar</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm truncate flex-1">{group.name}</p>
            {group.is_admin && (
              <button type="button" className="pro-kebab" aria-label="Cambiar nombre" onClick={() => { setNewName(group.name); setRenaming(true); }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <p className="text-[12px] pro-muted">{members.length} {members.length === 1 ? 'miembro' : 'miembros'}</p>
      </div>

      <ul className="space-y-1.5">
        {members.map(m => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="pro-initials" style={{ width: 30, height: 30, fontSize: 11 }}>
              {m.avatar_url ? <img src={m.avatar_url} alt="" /> : initialsOf(m.name || 'R')}
            </span>
            <span className="text-[13px] truncate flex-1">{m.id === userId ? 'Tú' : m.name}</span>
            {m.is_admin && <span className="pro-tag inline-flex items-center gap-1"><Crown className="w-3 h-3" /> Admin</span>}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="space-y-2">
          <ResidentPicker excludeIds={new Set(members.map(m => m.id))} selected={selected} onToggle={toggle} />
          <div className="flex gap-1.5">
            <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => { setAdding(false); setSelected(new Set()); }}>Cancelar</button>
            <button type="button" className="pro-btn pro-btn-live pro-btn-xs" onClick={addMembers} disabled={saving || selected.size === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />} Agregar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm w-full" onClick={() => setAdding(true)}>
          <UserPlus /> Agregar residentes
        </button>
      )}

      <button type="button" className="pro-btn pro-btn-outline pro-btn-sm w-full text-destructive" onClick={leave}>
        <LogOut /> Salir del grupo
      </button>
      {dialog}
    </div>
  );
}
