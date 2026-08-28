import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIntlLocale } from '@/lib/dateLocale';
import {
  CalendarDays, Stethoscope, AlertTriangle, Gem, Lightbulb, Trophy, Plus, Pencil, Trash2, Loader2,
  Sparkles, ArrowLeft, ShieldCheck, MessagesSquare,
} from 'lucide-react';

// PANEL «DÍA A DÍA» DE LA COMUNIDAD (solo súper admin) — módulo diario 22-ago-2026.
// Propuestas del día (forum_daily_prompts) para los próximos 14 días, banco de preguntas
// (forum_prompt_bank), actividad (forum_posts_feed + forum_comments) y bitácora de
// «Revelar» (forum_reveal_audit). Tablas sin tipos generados → (supabase as any).
const sb = supabase as any;

type Cat = 'caso_clinico' | 'complicacion' | 'perla_quirurgica' | 'innovacion' | 'caso_exito';
const DAILY: { id: Cat; labelKey: string; icon: React.ElementType }[] = [
  { id: 'caso_clinico', labelKey: 'forum.catCasoClinico', icon: Stethoscope },
  { id: 'complicacion', labelKey: 'forum.catComplicacion', icon: AlertTriangle },
  { id: 'perla_quirurgica', labelKey: 'forum.catPerla', icon: Gem },
  { id: 'innovacion', labelKey: 'forum.catInnovacion', icon: Lightbulb },
];
const ALL_CATS: { id: Cat; labelKey: string; icon: React.ElementType }[] = [
  ...DAILY, { id: 'caso_exito', labelKey: 'forum.catExito', icon: Trophy },
];
const CDMX_TZ = 'America/Mexico_City';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: CDMX_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

interface Prompt { id: string; prompt_date: string; category: Cat; title: string; body: string | null; image_url: string | null; source: 'admin' | 'bank'; }
interface BankRow { id: string; category: Cat; title: string; body: string | null; is_active: boolean; last_used_on: string | null; use_count: number; }
interface AuditRow { id: string; post_id: string; admin_id: string; reason: string | null; revealed_at: string; adminName?: string; postTitle?: string; }

export default function AdminForum() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const locale = getIntlLocale(language);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: CDMX_TZ }), [locale]);
  const dtFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale]);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const labelDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return cap(dayFmt.format(new Date(Date.UTC(y, m - 1, d, 12)))); };

  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [bank, setBank] = useState<BankRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [bankCat, setBankCat] = useState<Cat | 'all'>('all');
  const [showPast, setShowPast] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Diálogo de propuesta del día
  const [pOpen, setPOpen] = useState(false);
  const [pDate, setPDate] = useState('');
  const [pCat, setPCat] = useState<Cat>('caso_clinico');
  const [pTitle, setPTitle] = useState('');
  const [pBody, setPBody] = useState('');
  const [pImage, setPImage] = useState('');
  const [pSaving, setPSaving] = useState(false);

  // Diálogo de banco
  const [bOpen, setBOpen] = useState(false);
  const [bId, setBId] = useState<string | null>(null);
  const [bCat, setBCat] = useState<Cat>('caso_clinico');
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bSaving, setBSaving] = useState(false);

  const today = ymd(new Date());
  const nextDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(i)), []);
  const pastDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(-(i + 1))), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since30 = addDays(-30);
      const [p, b, a, po, co] = await Promise.all([
        sb.from('forum_daily_prompts').select('*').gte('prompt_date', addDays(-14)).lte('prompt_date', addDays(14)).order('prompt_date'),
        sb.from('forum_prompt_bank').select('*').order('category').order('use_count').order('title'),
        sb.from('forum_reveal_audit').select('*').order('revealed_at', { ascending: false }).limit(200),
        sb.from('forum_posts_feed').select('id, author_id, is_anonymous, category, title, created_at').gte('created_at', since30 + 'T00:00:00Z').order('created_at', { ascending: false }),
        sb.from('forum_comments').select('id, post_id, author_id, created_at').gte('created_at', since30 + 'T00:00:00Z'),
      ]);
      setPrompts(p.data || []);
      setBank(b.data || []);
      setPosts(po.data || []);
      setComments(co.data || []);
      // Bitácora: nombres de admins y títulos de publicaciones
      const aRows: AuditRow[] = a.data || [];
      if (aRows.length > 0) {
        const adminIds = [...new Set(aRows.map((r) => r.admin_id))];
        const postIds = [...new Set(aRows.map((r) => r.post_id))];
        const [names, titles] = await Promise.all([
          supabase.from('profiles_public').select('id, name').in('id', adminIds),
          sb.from('forum_posts_feed').select('id, title').in('id', postIds),
        ]);
        const nm = Object.fromEntries(((names.data || []) as any[]).map((r) => [r.id, r.name]));
        const tt = Object.fromEntries(((titles.data || []) as any[]).map((r) => [r.id, r.title]));
        setAudit(aRows.map((r) => ({ ...r, adminName: nm[r.admin_id] || r.admin_id.slice(0, 8), postTitle: tt[r.post_id] || '—' })));
      } else {
        setAudit([]);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const promptAt = (date: string, cat: Cat) => prompts.find((p) => p.prompt_date === date && p.category === cat);

  const openPrompt = (date: string, cat: Cat) => {
    const ex = promptAt(date, cat);
    setPDate(date); setPCat(cat);
    setPTitle(ex?.title || ''); setPBody(ex?.body || ''); setPImage(ex?.image_url || '');
    setPOpen(true);
  };
  const savePrompt = async () => {
    if (pTitle.trim().length < 3) { toast.error(t('forumAdmin.validation')); return; }
    setPSaving(true);
    try {
      const { error } = await sb.from('forum_daily_prompts').upsert({
        prompt_date: pDate, category: pCat, title: pTitle.trim(), body: pBody.trim() || null,
        image_url: pImage.trim() || null, source: 'admin', bank_id: null, created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'prompt_date,category' });
      if (error) throw error;
      toast.success(t('forumAdmin.saved'));
      setPOpen(false);
      load();
    } catch (e: any) { toast.error(e?.message || 'Error'); } finally { setPSaving(false); }
  };
  const deletePrompt = async (id: string) => {
    try {
      const { error } = await sb.from('forum_daily_prompts').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('forumAdmin.deleted'));
      load();
    } catch (e: any) { toast.error(e?.message || 'Error'); }
  };
  const publishNow = async () => {
    setPublishing(true);
    try {
      const { error } = await sb.rpc('forum_publish_daily', { p_notify: true });
      if (error) throw error;
      toast.success(t('forumAdmin.published'));
      load();
    } catch (e: any) { toast.error(e?.message || 'Error'); } finally { setPublishing(false); }
  };

  const openBank = (row?: BankRow) => {
    setBId(row?.id || null); setBCat(row?.category || (bankCat === 'all' ? 'caso_clinico' : bankCat));
    setBTitle(row?.title || ''); setBBody(row?.body || '');
    setBOpen(true);
  };
  const saveBank = async () => {
    if (bTitle.trim().length < 3) { toast.error(t('forumAdmin.validation')); return; }
    setBSaving(true);
    try {
      const payload = { category: bCat, title: bTitle.trim(), body: bBody.trim() || null };
      const { error } = bId
        ? await sb.from('forum_prompt_bank').update(payload).eq('id', bId)
        : await sb.from('forum_prompt_bank').insert({ ...payload, created_by: user?.id || null });
      if (error) throw error;
      toast.success(t('forumAdmin.saved'));
      setBOpen(false);
      load();
    } catch (e: any) { toast.error(e?.message || 'Error'); } finally { setBSaving(false); }
  };
  const toggleBank = async (row: BankRow) => {
    try {
      const { error } = await sb.from('forum_prompt_bank').update({ is_active: !row.is_active }).eq('id', row.id);
      if (error) throw error;
      setBank((prev) => prev.map((b) => (b.id === row.id ? { ...b, is_active: !row.is_active } : b)));
    } catch (e: any) { toast.error(e?.message || 'Error'); }
  };
  const deleteBank = async (id: string) => {
    try {
      const { error } = await sb.from('forum_prompt_bank').delete().eq('id', id);
      if (error) throw error;
      toast.success(t('forumAdmin.deleted'));
      load();
    } catch (e: any) { toast.error(e?.message || 'Error'); }
  };

  // Actividad (30 días)
  const stats = useMemo(() => {
    const authors = new Set(posts.filter((p) => p.author_id).map((p) => p.author_id));
    const anon = posts.filter((p) => p.is_anonymous).length;
    const byCat: Record<string, number> = {};
    posts.forEach((p) => { byCat[p.category] = (byCat[p.category] || 0) + 1; });
    const days = Array.from({ length: 14 }, (_, i) => addDays(-(13 - i)));
    const byDay = days.map((d) => ({
      d,
      posts: posts.filter((p) => ymd(new Date(p.created_at)) === d).length,
      comments: comments.filter((c) => ymd(new Date(c.created_at)) === d).length,
    }));
    const max = Math.max(1, ...byDay.map((x) => x.posts + x.comments));
    return { total: posts.length, comments: comments.length, authors: authors.size, anon, byCat, byDay, max };
  }, [posts, comments]);

  const catLabel = (c: Cat) => t(ALL_CATS.find((x) => x.id === c)?.labelKey || '');
  const visibleBank = bankCat === 'all' ? bank : bank.filter((b) => b.category === bankCat);

  const PromptGrid = ({ days, readOnly }: { days: string[]; readOnly?: boolean }) => (
    <div className="space-y-2">
      {days.map((d) => (
        <div key={d} className={`rounded-lg border p-3 ${d === today ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary" />{labelDay(d)}
              {d === today && <Badge className="text-[10px] h-4 px-1.5">{t('forum.today')}</Badge>}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {DAILY.map((c) => {
              const Icon = c.icon;
              const p = promptAt(d, c.id);
              return (
                <div key={c.id} className="rounded-md border border-border bg-background p-2.5 flex flex-col gap-1.5 min-h-[92px]">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                    <Icon className="w-3 h-3" /><span className="truncate">{t(c.labelKey)}</span>
                  </div>
                  <p className={`text-[12.5px] leading-snug flex-1 break-words ${p ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                    {p ? p.title : t('forumAdmin.noPrompt')}
                  </p>
                  <div className="flex items-center justify-between gap-1">
                    {p ? (
                      <span className="text-[10px] text-muted-foreground">{p.source === 'bank' ? t('forumAdmin.fromBank') : t('forumAdmin.fromAdmin')}</span>
                    ) : <span />}
                    {!readOnly && (
                      <span className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1" onClick={() => openPrompt(d, c.id)}>
                          {p ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {p ? t('forumAdmin.edit') : t('forumAdmin.writeForDay')}
                        </Button>
                        {p && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label={t('forumAdmin.delete')} onClick={() => deletePrompt(p.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            <Link to="/admin" className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-1"><ArrowLeft className="w-3 h-3" />Admin</Link>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <MessagesSquare className="w-6 h-6 text-primary" />{t('forumAdmin.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('forumAdmin.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/foro">{t('forum.title')}</Link></Button>
            <Button size="sm" className="gap-1.5" onClick={publishNow} disabled={publishing}>
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('forumAdmin.publishNow')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : (
          <Tabs defaultValue="prompts">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="prompts">{t('forumAdmin.tabPrompts')}</TabsTrigger>
              <TabsTrigger value="bank">{t('forumAdmin.tabBank')} ({bank.length})</TabsTrigger>
              <TabsTrigger value="stats">{t('forumAdmin.tabStats')}</TabsTrigger>
              <TabsTrigger value="audit">{t('forumAdmin.tabAudit')} ({audit.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="prompts" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">{t('forumAdmin.promptsHint')}</p>
              <h2 className="text-sm font-semibold">{t('forumAdmin.nextDays')}</h2>
              <PromptGrid days={nextDays} />
              <button type="button" className="text-sm text-primary underline" onClick={() => setShowPast((v) => !v)}>
                {t('forumAdmin.pastDays')} {showPast ? '▲' : '▼'}
              </button>
              {showPast && <PromptGrid days={pastDays} readOnly />}
            </TabsContent>

            <TabsContent value="bank" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">{t('forumAdmin.bankHint')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className={`h-8 px-3 rounded-full text-sm border ${bankCat === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`} onClick={() => setBankCat('all')}>{t('forum.allCategories')}</button>
                {ALL_CATS.map((c) => (
                  <button key={c.id} type="button" className={`h-8 px-3 rounded-full text-sm border ${bankCat === c.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`} onClick={() => setBankCat(c.id)}>
                    {t(c.labelKey)} ({bank.filter((b) => b.category === c.id).length})
                  </button>
                ))}
                <Button size="sm" className="gap-1.5 ml-auto" onClick={() => openBank()}><Plus className="w-4 h-4" />{t('forumAdmin.add')}</Button>
              </div>
              <div className="space-y-1.5">
                {visibleBank.map((b) => (
                  <div key={b.id} className={`flex items-start gap-3 rounded-md border border-border p-2.5 ${b.is_active ? '' : 'opacity-60'}`}>
                    <Switch checked={b.is_active} onCheckedChange={() => toggleBank(b)} aria-label={b.is_active ? t('forumAdmin.active') : t('forumAdmin.inactive')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground break-words">{b.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {catLabel(b.category)} · {b.use_count} {t('forumAdmin.uses')} · {t('forumAdmin.lastUsed')}: {b.last_used_on ? labelDay(b.last_used_on) : t('forumAdmin.never')}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('forumAdmin.edit')} onClick={() => openBank(b)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t('forumAdmin.delete')} onClick={() => deleteBank(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  [t('forumAdmin.statsPosts'), stats.total],
                  [t('forumAdmin.statsComments'), stats.comments],
                  [t('forumAdmin.statsAuthors'), stats.authors],
                  [t('forum.anonymous'), stats.anon],
                ].map(([label, val]) => (
                  <Card key={String(label)}><CardContent className="p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className="text-2xl font-bold text-foreground">{val as number}</div>
                    <div className="text-[11px] text-muted-foreground">{t('forumAdmin.statsLast30')}</div>
                  </CardContent></Card>
                ))}
              </div>
              <Card><CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2">{t('forumAdmin.statsByDay')}</h3>
                <div className="flex items-end gap-1 h-32">
                  {stats.byDay.map((x) => (
                    <div key={x.d} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full" title={`${labelDay(x.d)}: ${x.posts} / ${x.comments}`}>
                      <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(x.posts / stats.max) * 100}%` }} />
                      <div className="w-full bg-accent rounded-b" style={{ height: `${(x.comments / stats.max) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{labelDay(stats.byDay[0].d)}</span><span>{labelDay(stats.byDay[stats.byDay.length - 1].d)}</span></div>
                <div className="text-[11px] text-muted-foreground mt-1"><span className="inline-block w-2 h-2 bg-primary/80 rounded-sm mr-1" />{t('forumAdmin.statsPosts')} <span className="inline-block w-2 h-2 bg-accent rounded-sm ml-3 mr-1" />{t('forumAdmin.statsComments')}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2">{t('forumAdmin.statsByCategory')}</h3>
                <div className="space-y-1.5">
                  {ALL_CATS.map((c) => {
                    const n = stats.byCat[c.id] || 0; const Icon = c.icon;
                    return (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="w-48 truncate">{t(c.labelKey)}</span>
                        <div className="flex-1 h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${stats.total ? (n / stats.total) * 100 : 0}%` }} /></div>
                        <span className="w-8 text-right tabular-nums">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground flex items-start gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-primary shrink-0" />{t('forumAdmin.auditHint')}</p>
              {audit.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t('forumAdmin.auditEmpty')}</CardContent></Card>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="text-left p-2">{t('forumAdmin.auditWhen')}</th><th className="text-left p-2">{t('forumAdmin.auditWho')}</th><th className="text-left p-2">{t('forumAdmin.auditPost')}</th><th className="text-left p-2">{t('forumAdmin.auditReason')}</th></tr>
                    </thead>
                    <tbody>
                      {audit.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="p-2 whitespace-nowrap">{dtFmt.format(new Date(a.revealed_at))}</td>
                          <td className="p-2">{a.adminName}</td>
                          <td className="p-2 max-w-[280px] truncate"><Link to={`/foro?post=${a.post_id}`} className="text-primary underline">{a.postTitle}</Link></td>
                          <td className="p-2 text-muted-foreground">{a.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Diálogo propuesta del día */}
        <Dialog open={pOpen} onOpenChange={setPOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('forumAdmin.writeForDay')} · {pDate && labelDay(pDate)}</DialogTitle>
              <DialogDescription>{catLabel(pCat)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder={t('forumAdmin.question')} value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={300} />
              <Textarea placeholder={t('forumAdmin.body')} value={pBody} onChange={(e) => setPBody(e.target.value)} rows={4} maxLength={4000} />
              <Input placeholder={t('forumAdmin.imageUrl')} value={pImage} onChange={(e) => setPImage(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPOpen(false)}>{t('forumAdmin.cancel')}</Button>
              <Button onClick={savePrompt} disabled={pSaving} className="gap-2">{pSaving && <Loader2 className="w-4 h-4 animate-spin" />}{t('forumAdmin.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo banco */}
        <Dialog open={bOpen} onOpenChange={setBOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{bId ? t('forumAdmin.edit') : t('forumAdmin.add')} · {t('forumAdmin.tabBank')}</DialogTitle>
              <DialogDescription>{t('forumAdmin.bankHint')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={bCat} onChange={(e) => setBCat(e.target.value as Cat)} aria-label={t('forumAdmin.category')}>
                {ALL_CATS.map((c) => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
              </select>
              <Input placeholder={t('forumAdmin.question')} value={bTitle} onChange={(e) => setBTitle(e.target.value)} maxLength={300} />
              <Textarea placeholder={t('forumAdmin.body')} value={bBody} onChange={(e) => setBBody(e.target.value)} rows={3} maxLength={4000} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBOpen(false)}>{t('forumAdmin.cancel')}</Button>
              <Button onClick={saveBank} disabled={bSaving} className="gap-2">{bSaving && <Loader2 className="w-4 h-4 animate-spin" />}{t('forumAdmin.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
