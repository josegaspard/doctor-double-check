// Contenido › Colecciones (ContentHub), 11-sep-2026.
// Colecciones de verdad del médico: content_collections + content_collection_items
// (migración 20260912, useContentCollections). Publicar y borrar pasan por el
// modal de revisión común — nunca al primer clic.
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import {
  useContentCollections, ContentCollection, CollectionItemType, CollectionResult,
} from '@/hooks/useContentCollections';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Library, Plus, Loader2, Globe, Lock, Trash2, AlertCircle, FileText,
  Video, BookOpen, Radio, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { money2, fmtDate } from '@/lib/proFormat';

type PickerItem = { id: string; title: string };

const TYPE_ICON: Record<CollectionItemType, React.ElementType> = {
  content: FileText, recording: Video, book: BookOpen, live: Radio,
};

export default function ContentCollectionsPanel() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const { collections, loading, pendingActivation, reload, create, update, remove, addItem, removeItem, reorder } =
    useContentCollections('mine');

  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: '' });

  const [openId, setOpenId] = useState<string | null>(null);
  const open = useMemo(() => collections.find(c => c.id === openId) || null, [collections, openId]);

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<CollectionItemType>('recording');
  const [addOptions, setAddOptions] = useState<PickerItem[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addPicked, setAddPicked] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const resetForm = () => setForm({ title: '', description: '', price: '' });

  const handleCreate = async () => {
    const title = form.title.trim();
    if (!title) { toast.error(t('mm2.content.hub.collections.titleRequired')); return; }
    setCreating(true);
    const res: CollectionResult<ContentCollection> = await create({ title, description: form.description, price: form.price ? Number(form.price) : 0 });
    setCreating(false);
    if (res.ok) {
      toast.success(t('mm2.content.hub.collections.createdOk'));
      setShowCreate(false);
      resetForm();
    } else if ((res as { ok: false; reason: string }).reason === 'pending_activation') {
      toast.error(t('mm2.content.hub.collections.pendingToast'));
    } else {
      toast.error(t('mm2.content.hub.collections.saveError'));
    }
  };

  const togglePublish = async (c: ContentCollection) => {
    const next = !c.is_public;
    if (next) {
      // Publicar tiene consecuencia real: la colección se vuelve visible/vendible.
      const ok = await confirm({
        title: t('mm2.content.hub.collections.publishTitle'),
        description: t('mm2.content.hub.collections.publishDesc'),
        details: [
          { label: t('mm2.content.hub.collections.fieldTitle'), value: c.title },
          { label: t('mm2.content.hub.collections.fieldPrice'), value: c.price > 0 ? money2(c.price, language) : t('mm2.content.hub.collections.free') },
        ],
        confirmLabel: t('mm2.content.hub.collections.publishConfirm'),
      });
      if (!ok) return;
    }
    setBusyId(c.id);
    const res = await update(c.id, { is_public: next });
    setBusyId(null);
    if (res.ok) toast.success(next ? t('mm2.content.hub.collections.publishedOk') : t('mm2.content.hub.collections.unpublishedOk'));
    else toast.error(t('mm2.content.hub.collections.saveError'));
  };

  const handleDelete = async (c: ContentCollection) => {
    const ok = await confirm({
      title: t('mm2.content.hub.collections.deleteTitle'),
      description: t('mm2.content.hub.collections.deleteDesc'),
      details: [
        { label: t('mm2.content.hub.collections.fieldTitle'), value: c.title },
        { label: t('mm2.content.hub.collections.itemCount'), value: c.items.length },
      ],
      confirmLabel: t('mm2.content.hub.collections.deleteConfirm'),
      tone: 'destructive',
    });
    if (!ok) return;
    setBusyId(c.id);
    const res = await remove(c.id);
    setBusyId(null);
    if (res.ok) { toast.success(t('mm2.content.hub.collections.deletedOk')); if (openId === c.id) setOpenId(null); }
    else toast.error(t('mm2.content.hub.collections.saveError'));
  };

  const loadAddOptions = async (type: CollectionItemType) => {
    if (!user?.id) return;
    setAddLoading(true);
    setAddPicked('');
    try {
      if (type === 'recording') {
        const { data } = await supabase.from('recordings').select('id, title').eq('doctor_id', user.id).order('created_at', { ascending: false });
        setAddOptions((data || []) as PickerItem[]);
      } else if (type === 'live') {
        const { data } = await supabase.from('lives').select('id, title').eq('doctor_id', user.id).order('created_at', { ascending: false });
        setAddOptions((data || []) as PickerItem[]);
      } else if (type === 'book') {
        const { data } = await (supabase as any).from('doctor_content').select('id, title').eq('creator_id', user.id).eq('is_book', true).order('created_at', { ascending: false });
        setAddOptions((data || []) as PickerItem[]);
      } else {
        const { data } = await (supabase as any).from('doctor_content').select('id, title').eq('creator_id', user.id).eq('is_book', false).order('created_at', { ascending: false });
        setAddOptions((data || []) as PickerItem[]);
      }
    } finally {
      setAddLoading(false);
    }
  };

  const openAdd = (c: ContentCollection) => {
    setOpenId(c.id);
    setAddOpen(true);
    setAddType('recording');
    loadAddOptions('recording');
  };

  const handleAddItem = async () => {
    if (!open || !addPicked) return;
    setSavingItem(true);
    const res = await addItem(open.id, addType, addPicked);
    setSavingItem(false);
    if (res.ok) { toast.success(t('mm2.content.hub.collections.itemAddedOk')); setAddOpen(false); }
    else toast.error(t('mm2.content.hub.collections.saveError'));
  };

  const move = async (c: ContentCollection, index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= c.items.length) return;
    const ids = c.items.map(i => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusyId(c.id);
    const res = await reorder(c.id, ids);
    setBusyId(null);
    if (!res.ok) toast.error(t('mm2.content.hub.collections.saveError'));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--pro-teal)' }} /></div>;
  }

  return (
    <div className="space-y-4">
      {pendingActivation && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
          <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('mm2.content.hub.collections.pendingTitle')}</p>
            <p className="text-xs mt-0.5">{t('mm2.content.hub.collections.pendingDesc')}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{t('mm2.content.hub.collections.hint')}</p>
        <button type="button" className="pro-btn pro-btn-teal pro-btn-sm flex-shrink-0" onClick={() => setShowCreate(true)}>
          <Plus /> {t('mm2.content.hub.collections.new')}
        </button>
      </div>

      {collections.length === 0 ? (
        <section className="pro-card pro-card-pad bg-card text-center py-10">
          <span className="pro-icon-box mx-auto mb-3"><Library /></span>
          <p className="pro-ink font-semibold">{t('mm2.content.hub.collections.empty')}</p>
          <p className="pro-muted text-sm mt-1">{t('mm2.content.hub.collections.emptyDesc')}</p>
          <button type="button" className="pro-btn pro-btn-teal mt-3" onClick={() => setShowCreate(true)}><Plus /> {t('mm2.content.hub.collections.new')}</button>
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map(c => (
            <article key={c.id} className="pro-card pro-card-pad bg-card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="pro-ink font-bold text-[15px] min-w-0 truncate">{c.title}</h3>
                <span className={`pro-tile-badge ${c.is_public ? 'pro-tile-badge-ok' : 'pro-tile-badge-muted'}`} style={{ position: 'static' }}>
                  {c.is_public ? t('mm2.content.hub.collections.badgePublished') : t('mm2.content.hub.collections.badgeDraft')}
                </span>
              </div>
              {c.description && <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>}
              <div className="flex items-center gap-2 text-xs pro-muted flex-wrap">
                <span>{fill_items(c.items.length, t)}</span>
                <span>·</span>
                <span>{c.price > 0 ? money2(c.price, language) : t('mm2.content.hub.collections.free')}</span>
                <span>·</span>
                <span>{fmtDate(new Date(c.created_at), language)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                  {openId === c.id ? t('mm2.content.hub.collections.hideItems') : t('mm2.content.hub.collections.manageItems')}
                </button>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" disabled={busyId === c.id} onClick={() => togglePublish(c)}>
                  {busyId === c.id ? <Loader2 className="animate-spin" /> : c.is_public ? <Lock /> : <Globe />}
                  {c.is_public ? t('mm2.content.hub.collections.unpublish') : t('mm2.content.hub.collections.publish')}
                </button>
                <button type="button" className="pro-btn pro-btn-outline pro-btn-xs text-destructive ml-auto" disabled={busyId === c.id} onClick={() => handleDelete(c)}>
                  <Trash2 /> {t('mm2.content.hub.collections.delete')}
                </button>
              </div>

              {openId === c.id && (
                <div className="mt-2 pt-3 border-t" style={{ borderColor: 'var(--pro-line)' }}>
                  {c.items.length === 0 ? (
                    <p className="text-xs pro-muted py-2">{t('mm2.content.hub.collections.itemsEmpty')}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {c.items.map((it, idx) => {
                        const Icon = TYPE_ICON[it.item_type];
                        return (
                          <li key={it.id} className="flex items-center gap-2 rounded-lg border border-[#e3ecf0] bg-white px-2 py-1.5">
                            <Icon className="w-3.5 h-3.5 pro-muted flex-shrink-0" />
                            <span className="text-xs pro-ink-2 flex-1 min-w-0 truncate">{it.item_type} · {it.item_id.slice(0, 8)}</span>
                            <button type="button" className="pro-kebab w-6 h-6" disabled={idx === 0} onClick={() => move(c, idx, -1)} aria-label={t('mm2.content.hub.collections.moveUp')}><ArrowUp className="w-3 h-3" /></button>
                            <button type="button" className="pro-kebab w-6 h-6" disabled={idx === c.items.length - 1} onClick={() => move(c, idx, 1)} aria-label={t('mm2.content.hub.collections.moveDown')}><ArrowDown className="w-3 h-3" /></button>
                            <button
                              type="button"
                              className="pro-kebab w-6 h-6"
                              aria-label={t('mm2.content.hub.collections.removeItem')}
                              onClick={async () => { const res = await removeItem(it.id); if (!res.ok) toast.error(t('mm2.content.hub.collections.saveError')); }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-xs mt-2" onClick={() => openAdd(c)}>
                    <Plus /> {t('mm2.content.hub.collections.addItem')}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Nueva colección */}
      <Dialog open={showCreate} onOpenChange={o => { setShowCreate(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Library className="w-5 h-5" /> {t('mm2.content.hub.collections.newTitle')}</DialogTitle>
            <DialogDescription>{t('mm2.content.hub.collections.newDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="col-title">{t('mm2.content.hub.collections.fieldTitle')}</Label>
              <Input id="col-title" value={form.title} maxLength={200} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="col-desc">{t('mm2.content.hub.collections.fieldDescription')}</Label>
              <Textarea id="col-desc" value={form.description} rows={3} maxLength={600} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="col-price">{t('mm2.content.hub.collections.fieldPrice')}</Label>
              <Input id="col-price" type="number" min="0" step="0.01" value={form.price} placeholder="0" onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              <p className="text-[11px] pro-muted">{t('mm2.content.hub.collections.priceHint')}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="pro-btn pro-btn-outline" onClick={() => setShowCreate(false)}>{t('pro.common.cancel')}</button>
            <button type="button" className="pro-btn pro-btn-teal" disabled={creating || !form.title.trim()} onClick={handleCreate}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus />} {t('mm2.content.hub.collections.create')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Añadir ítem */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mm2.content.hub.collections.addItemTitle')}</DialogTitle>
            <DialogDescription>{t('mm2.content.hub.collections.addItemDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="pro-seg">
              {([['recording', t('mm2.content.hub.collections.typeRecording')], ['content', t('mm2.content.hub.collections.typeContent')], ['book', t('mm2.content.hub.collections.typeBook')], ['live', t('mm2.content.hub.collections.typeLive')]] as [CollectionItemType, string][]).map(([k, l]) => (
                <button key={k} type="button" className={addType === k ? 'is-active' : ''} onClick={() => { setAddType(k); loadAddOptions(k); }}>{l}</button>
              ))}
            </div>
            {addLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin pro-muted" /></div>
            ) : addOptions.length === 0 ? (
              <p className="text-sm pro-muted py-4 text-center">{t('mm2.content.hub.collections.noOwnItems')}</p>
            ) : (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={addPicked}
                onChange={e => setAddPicked(e.target.value)}
              >
                <option value="">{t('mm2.content.hub.collections.pickOne')}</option>
                {addOptions.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="pro-btn pro-btn-outline" onClick={() => setAddOpen(false)}>{t('pro.common.cancel')}</button>
            <button type="button" className="pro-btn pro-btn-teal" disabled={!addPicked || savingItem} onClick={handleAddItem}>
              {savingItem ? <Loader2 className="animate-spin" /> : <Plus />} {t('mm2.content.hub.collections.addItemConfirm')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}

function fill_items(n: number, t: (k: string) => string) {
  return `${n} ${n === 1 ? t('mm2.content.hub.collections.itemSingular') : t('mm2.content.hub.collections.itemPlural')}`;
}
