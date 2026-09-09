import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContentPreviewModal } from '@/components/content/ContentPreviewModal';
import {
  FileText, Image as ImageIcon, Video, Search, Plus, Trash2, Eye, Users, Stethoscope,
  Globe, Lock, Loader2, Settings2, LayoutGrid, FolderOpen, FilePlus2, Clock,
  BarChart3, ShoppingBag, ChevronDown, PlayCircle, BookOpen, Presentation, Check, X, MoreVertical,
  Info, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { fill, money, money2, fmtDate, norm, initialsOf } from '@/lib/proFormat';

interface DoctorContent {
  id: string;
  title: string;
  description: string | null;
  type: 'video' | 'pdf' | 'image' | 'presentation';
  file_url: string;
  thumbnail_url: string | null;
  is_public: boolean;
  price: number;
  audience_type: 'all' | 'patients' | 'professionals' | 'subscribers';
  category: string | null;
  created_at: string;
  is_book?: boolean;
  is_masterclass?: boolean | null;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  moderation_note?: string | null;
}

interface Sale { id: string; amount: number; created_at: string; content_id: string | null }

type Section = 'overview' | 'published' | 'drafts' | 'review' | 'collections' | 'sales' | 'stats';
type Sort = 'recent' | 'old' | 'title' | 'price';

/** Estado real de una pieza a partir de moderación + visibilidad */
type State = 'published' | 'draft' | 'review' | 'rejected';
const stateOf = (c: DoctorContent): State => {
  if (c.moderation_status === 'pending') return 'review';
  if (c.moderation_status === 'rejected') return 'rejected';
  return c.is_public ? 'published' : 'draft';
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'video': return <Video />;
    case 'pdf': return <FileText />;
    case 'image': return <ImageIcon />;
    default: return <Presentation />;
  }
};

export default function DoctorContentLibrary() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();

  const [contents, setContents] = useState<DoctorContent[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState<'all' | State>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [section, setSection] = useState<Section>('overview');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewContent, setPreviewContent] = useState<DoctorContent | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Gestión múltiple (se conserva de la versión anterior)
  const [isManaging, setIsManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchContents = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('doctor_content')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any as DoctorContent[];
      setContents(rows);

      // Ventas reales de ese contenido
      const ids = rows.map(r => r.id);
      if (ids.length) {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('id, amount, created_at, content_id')
          .in('content_id', ids)
          .order('created_at', { ascending: false });
        setSales(((purchases as any[]) || []) as Sale[]);
      } else {
        setSales([]);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error(t('doctorLibrary.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => { fetchContents(); }, [fetchContents]);

  // ------------------------------------------------------------------ conteos
  const counts = useMemo(() => {
    const c = { published: 0, draft: 0, review: 0, rejected: 0, collections: 0, paid: 0, publicItems: 0 };
    contents.forEach(x => {
      const s = stateOf(x);
      c[s] += 1;
      if (x.is_book || x.is_masterclass) c.collections += 1;
      if ((x.price || 0) > 0) c.paid += 1;
      if (x.is_public) c.publicItems += 1;
    });
    return c;
  }, [contents]);

  const salesTotal = useMemo(() => sales.reduce((s, x) => s + Number(x.amount || 0), 0), [sales]);
  const titleById = useMemo(() => {
    const m = new Map<string, string>();
    contents.forEach(c => m.set(c.id, c.title));
    return m;
  }, [contents]);

  // ------------------------------------------------------------------- lista
  const filtered = useMemo(() => {
    const q = norm(searchQuery.trim());
    let arr = contents.filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (stateFilter !== 'all' && stateOf(c) !== stateFilter) return false;
      if (q && !norm(c.title).includes(q) && !norm(c.description).includes(q) && !norm(c.category).includes(q)) return false;
      const s = stateOf(c);
      if (section === 'published') return s === 'published';
      if (section === 'drafts') return s === 'draft' || s === 'rejected';
      if (section === 'review') return s === 'review';
      if (section === 'collections') return !!(c.is_book || c.is_masterclass);
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (sort === 'old') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'price') return (b.price || 0) - (a.price || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return arr;
  }, [contents, searchQuery, typeFilter, stateFilter, section, sort]);

  const featured = useMemo(
    () => contents.find(c => stateOf(c) === 'published') || contents[0] || null,
    [contents],
  );
  // Salen de `filtered` (no de `contents`): si no, el buscador, el filtro de tipo
  // y el orden no cambiaban nada en la sección que se abre por defecto.
  const recentPublished = useMemo(() => filtered.filter(c => stateOf(c) === 'published').slice(0, 8), [filtered]);
  const draftsAndReview = useMemo(() => filtered.filter(c => ['draft', 'review', 'rejected'].includes(stateOf(c))).slice(0, 8), [filtered]);

  /** Lo que de verdad está pintado en pantalla ahora mismo. La selección múltiple
   *  se hace SOBRE ESTO: antes «Seleccionar todo» marcaba `filtered` entero y en
   *  «Vista general» eso son TODAS las piezas, con solo 16 tarjetas a la vista —
   *  un borrado en lote podía llevarse contenido que el médico nunca vio marcado. */
  const visible = useMemo(() => {
    // «Ventas» y «Estadísticas» no pintan ni una tarjeta: ahí no hay nada que
    // seleccionar y el botón de gestión no debe aparecer.
    if (section === 'sales' || section === 'stats') return [];
    if (section === 'overview') return [...recentPublished, ...draftsAndReview];
    return filtered;
  }, [section, recentPublished, draftsAndReview, filtered]);

  // Al cambiar de sección o de filtros la selección se suelta: si no, se podía
  // pulsar «Eliminar (20)» en una sección donde no hay ni una tarjeta pintada.
  useEffect(() => { setSelectedIds(new Set()); }, [section, searchQuery, typeFilter, stateFilter]);

  // ---------------------------------------------------------------- acciones
  const extractStoragePath = (url: string): string => {
    if (!url) return '';
    const decoded = decodeURIComponent(url.trim());
    const patterns = [
      /\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/,
      /\/object\/(?:public|sign)\/([^?]+)/,
    ];
    for (const pattern of patterns) {
      const match = decoded.match(pattern);
      if (match) {
        const fullPath = match[1];
        const slashIndex = fullPath.indexOf('/');
        return slashIndex >= 0 ? fullPath.substring(slashIndex + 1) : fullPath;
      }
    }
    return decoded;
  };

  const deleteContent = async (id: string) => {
    const contentToDelete = contents.find(c => c.id === id);
    const { error } = await supabase.from('doctor_content').delete().eq('id', id);
    if (error) throw error;
    if (contentToDelete?.file_url) {
      const filePath = extractStoragePath(contentToDelete.file_url);
      if (filePath) await supabase.storage.from('doctor-content').remove([filePath]).catch(() => {});
    }
    if (contentToDelete?.thumbnail_url) {
      const thumbPath = extractStoragePath(contentToDelete.thumbnail_url);
      if (thumbPath) await supabase.storage.from('thumbnails').remove([thumbPath]).catch(() => {});
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteContent(deleteId);
      setContents(prev => prev.filter(c => c.id !== deleteId));
      toast.success(t('doctorLibrary.deleted'));
    } catch (error: any) {
      console.error('Error deleting content:', error);
      toast.error(`${t('doctorLibrary.errorDeleting')}: ${error.message || ''}`);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) await deleteContent(id);
      setContents(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setIsManaging(false);
      toast.success(t('manage.deleted'));
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      toast.error(`${t('doctorLibrary.errorDeleting')}: ${error.message || ''}`);
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === visible.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map(c => c.id)));
  };

  /** Publicar / retirar: es un solo campo de la base, el que decide si la pieza
      se ve en el canal. Sin esto la sección «Borradores» no tendría salida. */
  const togglePublic = async (c: DoctorContent) => {
    setTogglingId(c.id);
    const { error } = await supabase.from('doctor_content').update({ is_public: !c.is_public } as any).eq('id', c.id);
    setTogglingId(null);
    if (error) { toast.error(error.message); return; }
    setContents(prev => prev.map(x => (x.id === c.id ? { ...x, is_public: !c.is_public } : x)));
    toast.success(!c.is_public ? t('pro.contentPanel.publishedOk') : t('pro.contentPanel.unpublishedOk'));
  };

  // ------------------------------------------------------------------- vista
  const stateBadge = (s: State) => ({
    published: { label: t('pro.contentPanel.badgePublished'), cls: 'pro-tile-badge-ok' },
    draft: { label: t('pro.contentPanel.badgeDraft'), cls: 'pro-tile-badge-muted' },
    review: { label: t('pro.contentPanel.badgeReview'), cls: 'pro-tile-badge-info' },
    rejected: { label: t('pro.contentPanel.badgeRejected'), cls: 'pro-tile-badge-warn' },
  }[s]);

  const audienceLabel = (a: string) => ({
    all: t('pro.contentPanel.audienceAll'),
    patients: t('pro.contentPanel.audiencePatients'),
    professionals: t('pro.contentPanel.audienceProfessionals'),
    subscribers: t('pro.contentPanel.audienceSubscribers'),
  }[a] || t('pro.contentPanel.audienceAll'));

  const tile = (c: DoctorContent) => {
    const s = stateOf(c);
    const badge = stateBadge(s);
    const checked = selectedIds.has(c.id);
    return (
      <article key={c.id} className={`pro-tile ${isManaging && checked ? 'ring-2' : ''}`} style={isManaging && checked ? { boxShadow: '0 0 0 2px var(--pro-teal)' } : undefined}>
        <div className="pro-tile-media" onClick={isManaging ? () => toggleSelect(c.id) : undefined}>
          {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" loading="lazy" /> : getTypeIcon(c.type)}
          {isManaging && (
            <span className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
              <Checkbox checked={checked} onCheckedChange={() => toggleSelect(c.id)} className="bg-white" />
            </span>
          )}
          <span className={`pro-tile-badge ${badge.cls}`}>{badge.label}</span>
        </div>
        <div className="pro-tile-body">
          <h3 className="pro-tile-title">{c.title}</h3>
          <div className="pro-tile-meta">
            {c.category && <span className="cat">{c.category}</span>}
            {c.category && <span>·</span>}
            <span>{(c.price || 0) > 0 ? money2(Number(c.price), language) : t('pro.contentPanel.free')}</span>
          </div>
          <div className="pro-tile-meta">
            <span>{fmtDate(new Date(c.created_at), language)}</span>
            <span>·</span>
            <span>{audienceLabel(c.audience_type)}</span>
          </div>
          {s === 'rejected' && c.moderation_note && (
            <p className="text-[11px]" style={{ color: 'var(--pro-warn)' }}>{t('pro.contentPanel.moderationNoteLabel')}: {c.moderation_note}</p>
          )}
          {!isManaging && (
            <div className="pro-tile-foot">
              <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => setPreviewContent(c)}>
                <Eye /> {t('pro.contentPanel.preview')}
              </button>
              {c.moderation_status !== 'pending' && (
                <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" disabled={togglingId === c.id} onClick={() => togglePublic(c)}>
                  {togglingId === c.id ? <Loader2 className="animate-spin" /> : c.is_public ? <Lock /> : <Globe />}
                  {c.is_public ? t('pro.contentPanel.unpublish') : t('pro.contentPanel.publish')}
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="pro-kebab ml-auto" aria-label={t('pro.contentPanel.manage')}>
                    <MoreVertical />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPreviewContent(c)}>{t('pro.contentPanel.preview')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/content')}>{t('pro.contentPanel.view')}</DropdownMenuItem>
                  {c.moderation_status !== 'pending' && (
                    <DropdownMenuItem onClick={() => togglePublic(c)}>
                      {c.is_public ? t('pro.contentPanel.unpublish') : t('pro.contentPanel.publish')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}>
                    {t('pro.contentPanel.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </article>
    );
  };

  const navItems: { key: Section; label: string; Icon: React.ElementType; count?: number }[] = [
    { key: 'overview', label: t('pro.contentPanel.navOverview'), Icon: LayoutGrid },
    { key: 'published', label: t('pro.contentPanel.navPublished'), Icon: PlayCircle, count: counts.published },
    { key: 'drafts', label: t('pro.contentPanel.navDrafts'), Icon: FilePlus2, count: counts.draft + counts.rejected },
    { key: 'review', label: t('pro.contentPanel.navReview'), Icon: Clock, count: counts.review },
    { key: 'collections', label: t('pro.contentPanel.navCollections'), Icon: FolderOpen, count: counts.collections },
    { key: 'sales', label: t('pro.contentPanel.navSales'), Icon: ShoppingBag, count: sales.length },
    { key: 'stats', label: t('pro.contentPanel.navStats'), Icon: BarChart3 },
  ];

  const rail = navItems.map(n => (
    <button
      key={n.key}
      type="button"
      className={`pro-lane-item ${section === n.key ? 'is-active' : ''}`}
      aria-pressed={section === n.key}
      onClick={() => setSection(n.key)}
    >
      <n.Icon />
      <span className="label">{n.label}</span>
      {n.count ? <span className="count">{n.count}</span> : null}
    </button>
  ));

  const sortLabel = sort === 'old' ? t('pro.contentPanel.sortOld')
    : sort === 'title' ? t('pro.contentPanel.sortTitle')
    : sort === 'price' ? t('pro.contentPanel.sortPrice')
    : t('pro.contentPanel.sortRecent');

  // 🚨 El guard de rol va AQUÍ, después de TODOS los hooks. Si va antes, el
  // primer render (rol aún sin cargar) ejecuta menos hooks que el siguiente y
  // React revienta con «Rendered more hooks than during the previous render».
  if (role !== 'doctor' && role !== 'resident' && role !== 'admin') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-heading text-xl font-bold mb-2">{t('doctorLibrary.restrictedAccess')}</h2>
            <p className="text-muted-foreground mb-4">{t('doctorLibrary.onlyDoctors')}</p>
            <Button onClick={() => navigate('/')}>{t('doctorLibrary.goHome')}</Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><LayoutGrid className="w-7 h-7" /> <span className="truncate">{t('pro.contentPanel.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.contentPanel.subtitle')}</p>
          </div>
          <Link to="/doctor/upload" className="pro-btn pro-btn-live w-full sm:w-auto">
            <Plus /> {t('pro.contentPanel.create')}
          </Link>
        </div>

        <div className="pro-work pro-work-side">
          {/* Carril de secciones */}
          <nav className="pro-card pro-lane hidden lg:flex self-start" aria-label={t('pro.contentPanel.title')}>
            {rail}
          </nav>
          <div className="pro-card pro-lane pro-lane-row flex lg:hidden">{rail}</div>

          <div className="min-w-0 space-y-4">
            {/* Barra de números + buscador */}
            <section className="pro-card pro-card-pad min-w-0">
              <div className="pro-statbar mb-3">
                <div className="pro-stat">
                  <span className="pro-icon-box"><PlayCircle /></span>
                  <span className="min-w-0"><span className="k block">{t('pro.contentPanel.statPublished')}</span><span className="v block">{counts.published}</span></span>
                </div>
                <div className="pro-stat">
                  <span className="pro-icon-box"><Clock /></span>
                  <span className="min-w-0"><span className="k block">{t('pro.contentPanel.statReview')}</span><span className="v block">{counts.review}</span></span>
                </div>
                <div className="pro-stat">
                  <span className="pro-icon-box"><ShoppingBag /></span>
                  <span className="min-w-0"><span className="k block">{t('pro.contentPanel.statSales')}</span><span className="v block">{money2(salesTotal, language)}</span></span>
                </div>
                <div className="pro-stat">
                  <span className="pro-icon-box"><Users /></span>
                  <span className="min-w-0"><span className="k block">{t('pro.contentPanel.statPurchases')}</span><span className="v block">{sales.length}</span></span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <label className="pro-search flex-1">
                  <Search />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('pro.contentPanel.searchPlaceholder')}
                    aria-label={t('pro.contentPanel.searchPlaceholder')}
                  />
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="pro-btn pro-btn-outline pro-btn-sm">
                        {typeFilter === 'all' ? t('pro.contentPanel.filterType') : typeFilter} <ChevronDown />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTypeFilter('all')}>{t('pro.contentPanel.allTypes')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTypeFilter('video')}>{t('doctorLibrary.videos')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTypeFilter('pdf')}>{t('doctorLibrary.pdfs')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTypeFilter('image')}>{t('doctorLibrary.images')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="pro-btn pro-btn-outline pro-btn-sm">
                        {stateFilter === 'all' ? t('pro.contentPanel.filterStatus') : stateBadge(stateFilter).label} <ChevronDown />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStateFilter('all')}>{t('pro.contentPanel.allStatus')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStateFilter('published')}>{t('pro.contentPanel.badgePublished')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStateFilter('draft')}>{t('pro.contentPanel.badgeDraft')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStateFilter('review')}>{t('pro.contentPanel.badgeReview')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStateFilter('rejected')}>{t('pro.contentPanel.badgeRejected')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="pro-btn pro-btn-outline pro-btn-sm">{sortLabel} <ChevronDown /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSort('recent')}>{t('pro.contentPanel.sortRecent')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSort('old')}>{t('pro.contentPanel.sortOld')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSort('title')}>{t('pro.contentPanel.sortTitle')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSort('price')}>{t('pro.contentPanel.sortPrice')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {visible.length > 0 && (
                    <button
                      type="button"
                      className={`pro-btn pro-btn-sm ${isManaging ? 'pro-btn-teal' : 'pro-btn-outline'}`}
                      onClick={() => { setIsManaging(!isManaging); setSelectedIds(new Set()); }}
                    >
                      <Settings2 /> {isManaging ? t('pro.contentPanel.done') : t('pro.contentPanel.manage')}
                    </button>
                  )}
                </div>
              </div>

              {isManaging && (
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 p-2.5 rounded-xl" style={{ background: '#f5fafb', border: '1px solid #e3ecf0' }}>
                  <p className="text-[12.5px] pro-ink-2">{t('manage.selectHint')}</p>
                  <div className="flex items-center gap-2">
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={toggleSelectAll}>
                      {selectedIds.size === visible.length && visible.length > 0 ? t('manage.deselectAll') : t('manage.selectAll')}
                    </button>
                    <button type="button" className="pro-btn pro-btn-live pro-btn-xs" disabled={selectedIds.size === 0} onClick={() => setShowBulkDeleteDialog(true)}>
                      <Trash2 /> {t('manage.deleteSelected')} ({selectedIds.size})
                    </button>
                  </div>
                </div>
              )}
            </section>

            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>
            ) : section === 'overview' ? (
              <>
                {featured && (
                  <section className="pro-feature">
                    <div className="pro-feature-body">
                      <div className="flex items-center gap-2 flex-wrap">
                        {featured.category && <span className="pro-feature-cat">{featured.category}</span>}
                        {/* Sin esto el destacado podía ser un borrador y no avisaba */}
                        <span className={`pro-tile-badge ${stateBadge(stateOf(featured)).cls}`} style={{ position: 'static' }}>
                          {stateBadge(stateOf(featured)).label}
                        </span>
                      </div>
                      <h2 className="pro-feature-title">{featured.title}</h2>
                      {featured.description && <p className="pro-feature-desc">{featured.description}</p>}
                      <div className="pro-feature-meta">
                        {/* El autor es el propio médico: nombre y especialidad reales */}
                        <span className="inline-flex items-center gap-2">
                          <span className="pro-initials" style={{ width: 26, height: 26, fontSize: 10, background: 'rgba(255,255,255,.18)', color: '#fff' }}>
                            {initialsOf(user?.name)}
                          </span>
                          <b style={{ color: '#fff' }}>{user?.name || ''}</b>
                        </span>
                        <span>·</span>
                        <span>{fmtDate(new Date(featured.created_at), language)}</span>
                        <span>·</span>
                        <span>{(featured.price || 0) > 0 ? money2(Number(featured.price), language) : t('pro.contentPanel.free')}</span>
                        <span>·</span>
                        <span>{audienceLabel(featured.audience_type)}</span>
                      </div>
                      <div className="pro-feature-acts">
                        <button type="button" className="pro-btn pro-btn-white pro-btn-sm" onClick={() => setPreviewContent(featured)}>
                          <Eye /> {t('pro.contentPanel.preview')}
                        </button>
                        <Link to="/content" className="pro-btn pro-btn-ghost pro-btn-sm"><ArrowRight /> {t('pro.contentPanel.view')}</Link>
                      </div>
                    </div>
                    <div className="pro-feature-media">
                      {featured.thumbnail_url
                        ? <img src={featured.thumbnail_url} alt="" />
                        : <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(255,255,255,.35)' }}>{getTypeIcon(featured.type)}</div>}
                    </div>
                  </section>
                )}

                {recentPublished.length > 0 && (
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h2 className="pro-card-title"><PlayCircle /> {t('pro.contentPanel.recent')}</h2>
                      <button type="button" className="pro-link" onClick={() => setSection('published')}>{t('pro.contentPanel.seeAll')} <ArrowRight /></button>
                    </div>
                    <div className="pro-shelf">{recentPublished.map(tile)}</div>
                  </section>
                )}

                {draftsAndReview.length > 0 && (
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h2 className="pro-card-title"><FilePlus2 /> {t('pro.contentPanel.draftsAndReview')}</h2>
                      <button type="button" className="pro-link" onClick={() => setSection('drafts')}>{t('pro.contentPanel.seeAll')} <ArrowRight /></button>
                    </div>
                    <div className="pro-shelf">{draftsAndReview.map(tile)}</div>
                    <div className="pro-note mt-3"><Info /><span>{t('pro.contentPanel.moderationNote')}</span></div>
                  </section>
                )}

                {contents.length === 0 && (
                  <section className="pro-card pro-card-pad text-center py-12">
                    <span className="pro-icon-box mx-auto mb-3"><FileText /></span>
                    <p className="pro-ink font-semibold">{t('doctorLibrary.noContentYet')}</p>
                    <Link to="/doctor/upload" className="pro-btn pro-btn-teal mt-3"><Plus /> {t('pro.contentPanel.uploadFirst')}</Link>
                  </section>
                )}
              </>
            ) : section === 'sales' ? (
              <section className="pro-card pro-card-pad">
                <div className="pro-card-head">
                  <h2 className="pro-card-title"><ShoppingBag /> {t('pro.contentPanel.navSales')}</h2>
                  <Link to="/doctor/earnings" className="pro-link">{t('pro.earnings.title')} <ArrowRight /></Link>
                </div>
                <p className="pro-muted text-[12.5px] mb-2">{t('pro.contentPanel.salesHint')}</p>
                {sales.length === 0 ? (
                  <p className="pro-muted text-sm py-8 text-center">{t('pro.contentPanel.noSales')}</p>
                ) : (
                  <div>
                    {sales.map(s => (
                      <div key={s.id} className="pro-row">
                        <span className="pro-icon-box" style={{ width: 34, height: 34 }}><ShoppingBag /></span>
                        <span className="min-w-0 flex-1">
                          <span className="pro-row-name block truncate">{titleById.get(s.content_id || '') || t('pro.contentPanel.navPublished')}</span>
                          <span className="pro-row-sub block">{fmtDate(new Date(s.created_at), language)}</span>
                        </span>
                        <span className="pro-row-name">{money2(Number(s.amount), language)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : section === 'stats' ? (
              <section className="pro-card pro-card-pad">
                <h2 className="pro-card-title mb-1"><BarChart3 /> {t('pro.contentPanel.navStats')}</h2>
                <p className="pro-muted text-[12.5px] mb-3">{t('pro.contentPanel.statsHint')}</p>
                <div className="pro-statbar">
                  <div className="pro-stat"><span className="pro-icon-box"><FileText /></span><span className="min-w-0"><span className="k block">{t('pro.contentPanel.totalItems')}</span><span className="v block">{contents.length}</span></span></div>
                  <div className="pro-stat"><span className="pro-icon-box"><Globe /></span><span className="min-w-0"><span className="k block">{t('pro.contentPanel.publicItems')}</span><span className="v block">{counts.publicItems}</span></span></div>
                  <div className="pro-stat"><span className="pro-icon-box"><ShoppingBag /></span><span className="min-w-0"><span className="k block">{t('pro.contentPanel.paidItems')}</span><span className="v block">{counts.paid}</span></span></div>
                  <div className="pro-stat"><span className="pro-icon-box"><FolderOpen /></span><span className="min-w-0"><span className="k block">{t('pro.contentPanel.navCollections')}</span><span className="v block">{counts.collections}</span></span></div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Link to="/doctor/recordings" className="pro-btn pro-btn-outline pro-btn-sm"><PlayCircle /> {t('pro.contentPanel.recordings')}</Link>
                  <Link to="/doctor/earnings" className="pro-btn pro-btn-outline pro-btn-sm"><ShoppingBag /> {t('pro.earnings.title')}</Link>
                </div>
              </section>
            ) : (
              <section className="pro-card pro-card-pad">
                <div className="pro-card-head">
                  <h2 className="pro-card-title">
                    {section === 'published' ? <><PlayCircle /> {t('pro.contentPanel.navPublished')}</>
                      : section === 'drafts' ? <><FilePlus2 /> {t('pro.contentPanel.navDrafts')}</>
                      : section === 'review' ? <><Clock /> {t('pro.contentPanel.navReview')}</>
                      : <><FolderOpen /> {t('pro.contentPanel.navCollections')}</>}
                  </h2>
                  {section === 'collections' && (
                    <div className="flex gap-2">
                      <Link to="/doctor/books" className="pro-link"><BookOpen /> {t('pro.contentPanel.books')}</Link>
                      <Link to="/doctor/recordings" className="pro-link"><PlayCircle /> {t('pro.contentPanel.recordings')}</Link>
                    </div>
                  )}
                </div>
                {section === 'collections' && <p className="pro-muted text-[12.5px] mb-2">{t('pro.contentPanel.collectionsHint')}</p>}
                {filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="pro-icon-box mx-auto mb-3"><FileText /></span>
                    <p className="pro-ink font-semibold">{searchQuery || typeFilter !== 'all' ? t('pro.contentPanel.emptyFilters') : t('pro.contentPanel.empty')}</p>
                    <Link to="/doctor/upload" className="pro-btn pro-btn-teal mt-3"><Plus /> {t('pro.contentPanel.create')}</Link>
                  </div>
                ) : (
                  <div className="pro-shelf">{filtered.map(tile)}</div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Borrado individual */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('doctorLibrary.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('doctorLibrary.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('doctorLibrary.deleting')}</> : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Borrado múltiple */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('manage.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('manage.confirmDeleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isBulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isBulkDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('manage.deleting')}</> : <><Trash2 className="w-4 h-4 mr-2" />{t('common.delete')} ({selectedIds.size})</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContentPreviewModal
        isOpen={!!previewContent}
        onClose={() => setPreviewContent(null)}
        content={previewContent}
      />
    </MainLayout>
  );
}
