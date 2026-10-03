import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProfileCategoryMark } from '@/components/profile/ProfileCategoryMark';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import '@/styles/diseno-comunidad.css';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { SectionTabs, useSectionParam } from '@/components/common/SectionTabs';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import Doctors from '@/pages/Doctors';
import HospitalLocator from '@/pages/HospitalLocator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIntlLocale, getDateLocale } from '@/lib/dateLocale';
import { formatDistanceToNow } from 'date-fns';
import {
  MessagesSquare, Plus, Loader2, Stethoscope, AlertTriangle, Lightbulb, Gem, Trophy,
  MessageCircle, Send, Trash2, EyeOff, GraduationCap, ImagePlus, X, ChevronDown,
  CalendarDays, Paperclip, FileText, Film, Eye, ShieldCheck, Settings2, CornerDownRight,
  Rss, Compass, Hospital,
} from 'lucide-react';

// COMUNIDAD — módulo diario (cliente 22-ago-2026, brief del doctor vía Marta), construido
// SOBRE el foro del 15/16-jul (forum_posts/forum_comments, vista forum_posts_feed que anula
// el autor de las publicaciones anónimas). Novedades (migración 20260822_forum_daily.sql):
//   · portada «Hoy»: 4 propuestas del día (forum_daily_prompts) con botón Responder;
//     la app dispara forum_publish_daily() de forma perezosa (idempotente) al abrir;
//   · especialidad y adjuntos (imágenes/video/PDF) en el depósito PRIVADO forum-files,
//     rutas sin id de autor y URLs firmadas (no se filtra quién subió qué);
//   · «Revelar autor» SOLO súper admin (RPC forum_admin_reveal, con bitácora);
//   · enlace profundo ?post=<id> (avisos de comentarios/publicaciones).
//
// 11-sep-2026 (encargo de la clienta): la Comunidad pasa a tener dos pestañas,
// Feed y Descubrir (Médicos | Hospitales), con el estado en la URL
// (/foro?tab=descubrir&ver=hospitales). Descubrir INCRUSTA el directorio y el
// localizador: /doctors y /hospital-locator siguen siendo páginas públicas para
// pacientes, visitantes y buscadores.
// Las tablas forum_* no están en los tipos generados → (supabase as any).
const sb = supabase as any;

type ForumCategory = 'caso_clinico' | 'complicacion' | 'innovacion' | 'perla_quirurgica' | 'caso_exito';

// Las 5 son «daily»: la migración 20260912 amplía forum_publish_daily con
// 'caso_exito' (+ banco sembrado), así que ya genera propuesta diaria como
// las otras 4 (BD.md). Antes de aplicarla, forum_daily_prompts simplemente no
// trae ninguna fila de esa categoría y la tarjeta cae sola al estado
// "sin propuesta hoy — publica la tuya", sin romper nada.
const CATEGORIES: { id: ForumCategory; labelKey: string; icon: React.ElementType; anonymous?: boolean; daily?: boolean }[] = [
  { id: 'caso_clinico', labelKey: 'forum.catCasoClinico', icon: Stethoscope, daily: true },
  { id: 'complicacion', labelKey: 'forum.catComplicacion', icon: AlertTriangle, anonymous: true, daily: true },
  { id: 'perla_quirurgica', labelKey: 'forum.catPerla', icon: Gem, daily: true },
  { id: 'innovacion', labelKey: 'forum.catInnovacion', icon: Lightbulb, daily: true },
  { id: 'caso_exito', labelKey: 'forum.catExito', icon: Trophy, daily: true },
];

// Validación de imágenes de COMENTARIOS (bucket público forum-images, como antes).
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Adjuntos de PUBLICACIONES (bucket privado forum-files): imágenes, video y PDF.
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'];
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 8;
const FORUM_FILES_BUCKET = 'forum-files';
const CDMX_TZ = 'America/Mexico_City';

const TABS = ['feed', 'descubrir'] as const;
const DISCOVER_VIEWS = ['medicos', 'hospitales'] as const;
type CommunityTab = typeof TABS[number];
type DiscoverView = typeof DISCOVER_VIEWS[number];

type AttachmentKind = 'image' | 'video' | 'pdf';
interface Attachment { path: string; type: AttachmentKind; name: string; size: number; mime?: string }

interface DailyPrompt {
  id: string;
  prompt_date: string;   // YYYY-MM-DD
  category: ForumCategory;
  title: string;
  body: string | null;
  image_url: string | null;
  source: 'admin' | 'bank';
}

interface ForumPost {
  id: string;
  author_id: string | null;   // null en posts anónimos (la vista lo anula)
  is_mine: boolean;           // dueño → puede borrar (server-side)
  category: ForumCategory;
  title: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  image_url?: string | null;
  specialty?: string | null;
  attachments?: Attachment[];
  prompt_id?: string | null;
  comment_count?: number;
  authorName?: string;
}

interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  image_url?: string | null;
  parent_comment_id?: string | null;
  created_at: string;
  authorName?: string;
  authorAvatar?: string | null;
  authorRole?: string;
  replies?: ForumComment[];
}

interface RevealRow {
  author_id: string | null; name: string | null; email: string | null;
  doctor_code: string | null; doctor_number: number | null; specialty: string | null; role: string | null;
}

const fmtYmd = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CDMX_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const todayCdmx = () => fmtYmd(new Date());

const kindOf = (mime: string): AttachmentKind | null => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return null;
};
const safeFileName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'archivo';
const randomId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function Foro() {
  const { t, language } = useLanguage();
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const focusPostId = searchParams.get('post');
  const { confirm, dialog } = useConfirmAction();

  // Pestañas en la URL: /foro?tab=descubrir&ver=hospitales
  const [tab, setTab] = useSectionParam<CommunityTab>('tab', TABS, 'feed');
  const [view, setView] = useSectionParam<DiscoverView>('ver', DISCOVER_VIEWS, 'medicos');

  const [posts, setPosts] = useState<ForumPost[]>([]);
  // commentsByPost guarda el ÁRBOL (comentarios raíz con .replies anidadas, 1 nivel).
  const [commentsByPost, setCommentsByPost] = useState<Record<string, ForumComment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | 'all'>('all');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLInputElement>(null);
  const focusedOnce = useRef(false);

  // Propuestas del día (hoy) + mapa id→propuesta (últimos 90 días) para «Responde a…».
  const [todayPrompts, setTodayPrompts] = useState<DailyPrompt[]>([]);
  const [promptById, setPromptById] = useState<Record<string, DailyPrompt>>({});
  const [promptsLoading, setPromptsLoading] = useState(true);

  // URLs firmadas de adjuntos (ruta → url), 1 h.
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Especialidades (catálogo + la mía).
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [mySpecialty, setMySpecialty] = useState<string>('');

  // Imagen del comentario (una por comentario).
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);

  // Crear publicación
  const [createOpen, setCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ForumCategory>('caso_clinico');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newPrompt, setNewPrompt] = useState<DailyPrompt | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [newFiles, setNewFiles] = useState<{ file: File; preview: string | null; kind: AttachmentKind }[]>([]);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Revelar autor (solo admin)
  const [revealPost, setRevealPost] = useState<ForumPost | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealData, setRevealData] = useState<RevealRow | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(getIntlLocale(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [language],
  );
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(getIntlLocale(language), { weekday: 'long', day: 'numeric', month: 'long', timeZone: CDMX_TZ }),
    [language],
  );
  const dateLocale = useMemo(() => getDateLocale(language), [language]);
  const getRelativeTime = useCallback(
    (dateStr: string) => formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: dateLocale }),
    [dateLocale],
  );

  const today = todayCdmx();
  const yesterday = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return fmtYmd(d); }, []);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const dayLabel = useCallback((ymd: string) => {
    if (ymd === today) return t('forum.today');
    if (ymd === yesterday) return t('forum.yesterday');
    const [y, m, d] = ymd.split('-').map(Number);
    return cap(dayFmt.format(new Date(Date.UTC(y, m - 1, d, 12))));
  }, [today, yesterday, dayFmt, t]);

  const resolveAuthorNames = useCallback(async (rows: { author_id: string | null; is_anonymous?: boolean }[]) => {
    // Nombres + avatar SOLO de autores no anónimos (los anónimos llegan con author_id null).
    const ids = [...new Set(rows.filter((r) => !r.is_anonymous && r.author_id).map((r) => r.author_id as string))];
    if (ids.length === 0) return {} as Record<string, { name: string; avatar_url: string | null }>;
    const { data } = await supabase.from('profiles_public').select('id, name, avatar_url').in('id', ids);
    return Object.fromEntries(
      ((data || []) as any[]).map((p) => [p.id, { name: p.name || 'Dr.', avatar_url: p.avatar_url || null }]),
    );
  }, []);

  const resolveRoles = useCallback(async (authorIds: string[]) => {
    const ids = [...new Set(authorIds)];
    if (ids.length === 0) return {} as Record<string, string>;
    const { data } = await supabase.from('user_roles' as any).select('user_id, role').in('user_id', ids);
    return Object.fromEntries(((data || []) as any[]).map((r) => [r.user_id, r.role]));
  }, []);

  // URLs firmadas para los adjuntos del depósito privado (se piden en lote).
  const signAttachments = useCallback(async (rows: ForumPost[]) => {
    const paths = [...new Set(rows.flatMap((p) => (p.attachments || []).map((a) => a.path)).filter(Boolean))];
    if (paths.length === 0) { setSignedUrls({}); return; }
    try {
      const { data, error } = await sb.storage.from(FORUM_FILES_BUCKET).createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((d: any) => { if (d?.path && d?.signedUrl) map[d.path] = d.signedUrl; });
      setSignedUrls(map);
    } catch (e) {
      console.error('forum sign error', e);
    }
  }, []);

  const fetchPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      // Motor del día, perezoso e idempotente: crea las propuestas que falten (del banco) y
      // manda el aviso diario si toca. Nunca bloquea la pantalla.
      try { await sb.rpc('forum_publish_daily'); } catch { /* best-effort */ }
      const since = new Date(); since.setDate(since.getDate() - 90);
      const { data, error } = await sb
        .from('forum_daily_prompts')
        .select('id, prompt_date, category, title, body, image_url, source')
        .gte('prompt_date', fmtYmd(since))
        .order('prompt_date', { ascending: false });
      if (error) throw error;
      const rows: DailyPrompt[] = data || [];
      setPromptById(Object.fromEntries(rows.map((p) => [p.id, p])));
      setTodayPrompts(rows.filter((p) => p.prompt_date === todayCdmx()));
    } catch (e) {
      console.error('forum prompts error', e);
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await sb
        .from('forum_posts_feed')   // vista: anula author_id de anónimos + is_mine + adjuntos + nº comentarios
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      const rows: ForumPost[] = (data || []).map((p: any) => ({ ...p, attachments: Array.isArray(p.attachments) ? p.attachments : [] }));
      const names = await resolveAuthorNames(rows);
      setPosts(rows.map((p) => ({ ...p, authorName: p.is_anonymous || !p.author_id ? undefined : names[p.author_id]?.name })));
      signAttachments(rows);

      // Comentarios de los posts listados (una query, se arma el árbol client-side).
      if (rows.length > 0) {
        const { data: cData } = await sb
          .from('forum_comments')
          .select('*')
          .in('post_id', rows.map((p: ForumPost) => p.id))
          .order('created_at', { ascending: true });
        const cRows: ForumComment[] = cData || [];
        const cAuthors = await resolveAuthorNames(cRows);  // los comentarios nunca son anónimos
        const cRoles = await resolveRoles(cRows.map((c) => c.author_id));
        const enriched: ForumComment[] = cRows.map((c) => ({
          ...c,
          authorName: cAuthors[c.author_id]?.name || 'Dr.',
          authorAvatar: cAuthors[c.author_id]?.avatar_url || null,
          authorRole: cRoles[c.author_id],
          replies: [],
        }));

        // Árbol de 1 nivel: la respuesta cuelga de su padre; el resto son raíces.
        const byId = new Map<string, ForumComment>();
        enriched.forEach((c) => byId.set(c.id, c));
        const treeByPost: Record<string, ForumComment[]> = {};
        const collapsed = new Set<string>();
        for (const c of enriched) {
          const parentId = c.parent_comment_id;
          if (parentId && byId.has(parentId)) {
            byId.get(parentId)!.replies!.push(c);
          } else {
            (treeByPost[c.post_id] ??= []).push(c);
          }
        }
        // Hilos con respuestas arrancan colapsados (como NewsArticle).
        Object.values(treeByPost).forEach((list) =>
          list.forEach((c) => { if ((c.replies?.length || 0) > 0) collapsed.add(c.id); }),
        );
        setCommentsByPost(treeByPost);
        setCollapsedThreads(collapsed);
      } else {
        setCommentsByPost({});
        setCollapsedThreads(new Set());
      }
    } catch (e) {
      console.error('forum fetch error', e);
    } finally {
      setIsLoading(false);
    }
  }, [resolveAuthorNames, resolveRoles, signAttachments]);

  useEffect(() => { fetchPrompts(); fetchPosts(); }, [fetchPrompts, fetchPosts]);

  // Catálogo de especialidades + la del usuario (best-effort; si no hay catálogo, texto libre).
  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb.from('specialty_codes').select('specialty').order('specialty');
        setSpecialties(((data || []) as any[]).map((r) => r.specialty).filter(Boolean));
      } catch { /* sin catálogo */ }
      if (!user?.id) return;
      try {
        const { data } = await sb.from('doctor_profiles').select('specialty').eq('user_id', user.id).maybeSingle();
        if (data?.specialty) { setMySpecialty(data.specialty); return; }
      } catch { /* no es doctor */ }
      try {
        const { data } = await sb.from('resident_profiles').select('specialty').eq('user_id', user.id).maybeSingle();
        if (data?.specialty) setMySpecialty(data.specialty);
      } catch { /* no es residente */ }
    })();
  }, [user?.id]);

  // Enlace profundo desde los avisos: /foro?post=<id> → Feed, expandir y llevar a la publicación.
  useEffect(() => {
    if (!focusPostId || isLoading || focusedOnce.current) return;
    if (!posts.some((p) => p.id === focusPostId)) return;
    focusedOnce.current = true;
    if (tab !== 'feed') setTab('feed');
    setExpandedPost(focusPostId);
    setTimeout(() => document.getElementById(`post-${focusPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [focusPostId, isLoading, posts, tab, setTab]);

  const isAnonymousCategory = CATEGORIES.find((c) => c.id === newCategory)?.anonymous === true;

  // Cuenta total (raíces + respuestas) para el toggle "N comentarios".
  const countComments = useCallback((list: ForumComment[]): number =>
    list.reduce((acc, c) => acc + 1 + countComments(c.replies || []), 0), []);

  // ---- Imágenes de comentarios ------------------------------------------------
  const validateImage = (file: File): boolean => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error(t('forum.imageType')); return false; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error(t('forum.imageTooBig')); return false; }
    return true;
  };

  const uploadForumImage = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('forum-images').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('forum-images').getPublicUrl(path);
      return data.publicUrl;
    } catch {
      toast.error(t('forum.imageUploadError'));
      return null;
    }
  };

  const onCommentImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !validateImage(file)) return;
    if (commentImagePreview) URL.revokeObjectURL(commentImagePreview);
    setCommentImageFile(file);
    setCommentImagePreview(URL.createObjectURL(file));
  };
  const clearCommentImage = () => {
    if (commentImagePreview) URL.revokeObjectURL(commentImagePreview);
    setCommentImageFile(null);
    setCommentImagePreview(null);
  };

  const resetComposer = () => {
    setCommentDraft('');
    setReplyTo(null);
    clearCommentImage();
  };

  // ---- Adjuntos de publicaciones (privados) -------------------------------------
  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const next = [...newFiles];
    for (const file of files) {
      const kind = ALLOWED_FILE_TYPES.includes(file.type) ? kindOf(file.type) : null;
      if (!kind) { toast.error(t('forum.fileType')); continue; }
      if (file.size > MAX_FILE_BYTES) { toast.error(t('forum.fileTooBig')); continue; }
      if (next.length >= MAX_FILES) { toast.error(t('forum.tooManyFiles')); break; }
      next.push({ file, kind, preview: kind === 'image' ? URL.createObjectURL(file) : null });
    }
    setNewFiles(next);
  };
  const removeNewFile = (idx: number) => {
    setNewFiles((prev) => {
      const copy = [...prev];
      const [gone] = copy.splice(idx, 1);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return copy;
    });
  };
  const clearNewFiles = () => {
    newFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setNewFiles([]);
  };

  const uploadAttachments = async (): Promise<Attachment[] | null> => {
    const out: Attachment[] = [];
    for (const { file, kind } of newFiles) {
      // Carpeta aleatoria: la ruta NO debe delatar al autor (anonimato de «Complicación»).
      const path = `p/${randomId()}/${safeFileName(file.name)}`;
      const { error } = await supabase.storage.from(FORUM_FILES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) { toast.error(t('forum.fileUploadError')); return null; }
      out.push({ path, type: kind, name: file.name, size: file.size, mime: file.type });
    }
    return out;
  };

  const openComposer = (category?: ForumCategory, prompt?: DailyPrompt | null) => {
    if (tab !== 'feed') setTab('feed');
    if (category) setNewCategory(category);
    setNewPrompt(prompt || null);
    if (!newSpecialty && mySpecialty) setNewSpecialty(mySpecialty);
    setCreateOpen(true);
  };

  // ---- Publicar / comentar / borrar ------------------------------------------
  const handlePublish = async () => {
    if (!user?.id) return;
    if (newTitle.trim().length < 3 || !newBody.trim()) {
      toast.error(t('forum.validation'));
      return;
    }
    // Paso de revisión: publicar avisa a toda la comunidad, así que el primer
    // clic nunca escribe.
    const ok = await confirm({
      title: t('mm2.community.confirmPublishTitle'),
      description: t('mm2.community.confirmPublishDesc'),
      details: [
        { label: t('mm2.community.confirmCategory'), value: t(CATEGORIES.find((c) => c.id === newCategory)!.labelKey) },
        { label: t('mm2.community.confirmTitleField'), value: newTitle.trim() },
        { label: t('mm2.community.confirmSpecialty'), value: newSpecialty.trim() || t('mm2.community.confirmNone') },
        { label: t('mm2.community.confirmAttachments'), value: String(newFiles.length) },
        {
          label: t('mm2.community.confirmVisibility'),
          value: isAnonymousCategory ? t('mm2.community.confirmAnonymous') : t('mm2.community.confirmSigned'),
        },
      ],
      confirmLabel: t('forum.publish'),
    });
    if (!ok) return;

    setIsPublishing(true);
    try {
      const attachments = await uploadAttachments();
      if (!attachments) return;   // el toast ya lo mostró uploadAttachments
      const { data, error } = await sb.from('forum_posts').insert({
        author_id: user.id,
        category: newCategory,
        title: newTitle.trim(),
        body: newBody.trim(),
        is_anonymous: isAnonymousCategory,
        specialty: newSpecialty.trim() || null,
        attachments,
        prompt_id: newPrompt && newPrompt.category === newCategory ? newPrompt.id : null,
      }).select('id').single();
      if (error) throw error;

      // Best-effort: notificar a médicos y residentes aprobados (nunca bloquea el post).
      try {
        await sb.rpc('forum_notify_doctors', {
          p_post_id: data.id,
          p_title: newTitle.trim(),
          p_category: newCategory,
        });
      } catch { /* notificación best-effort */ }

      toast.success(t('forum.published'));
      setCreateOpen(false);
      setNewTitle('');
      setNewBody('');
      setNewPrompt(null);
      clearNewFiles();
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleComment = async (postId: string) => {
    // Guard de reentrada: Enter puede disparar varias veces antes de que
    // termine el insert → comentarios duplicados.
    if (!user?.id || isSendingComment) return;
    if (!commentDraft.trim() && !commentImageFile) return;
    setIsSendingComment(true);
    try {
      let imageUrl: string | null = null;
      if (commentImageFile) {
        imageUrl = await uploadForumImage(commentImageFile);
        if (!imageUrl) return;   // el toast ya lo mostró uploadForumImage
      }
      const { error } = await sb.from('forum_comments').insert({
        post_id: postId,
        author_id: user.id,
        body: commentDraft.trim(),
        image_url: imageUrl,
        parent_comment_id: replyTo?.id ?? null,
      });
      if (error) throw error;
      resetComposer();
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleReply = (comment: ForumComment) => {
    // 1 solo nivel: la respuesta a una respuesta cuelga de la raíz.
    const rootId = comment.parent_comment_id || comment.id;
    setReplyTo({ id: rootId, name: comment.authorName || 'Dr.' });
    setCommentDraft(`@${comment.authorName || 'Dr.'} `);
    setTimeout(() => commentInputRef.current?.focus(), 50);
  };

  const toggleThread = (id: string) => {
    setCollapsedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeletePost = async (post: ForumPost) => {
    const comments = countComments(commentsByPost[post.id] || []);
    const ok = await confirm({
      title: t('mm2.community.confirmDeletePostTitle'),
      description: t('mm2.community.confirmDeletePostDesc'),
      details: [
        { label: t('mm2.community.confirmTitleField'), value: post.title },
        { label: t('mm2.community.confirmComments'), value: String(comments) },
        { label: t('mm2.community.confirmAttachments'), value: String((post.attachments || []).length) },
      ],
      tone: 'destructive',
      confirmLabel: t('forum.delete'),
    });
    if (!ok) return;
    try {
      const { error } = await sb.from('forum_posts').delete().eq('id', post.id);
      if (error) throw error;
      // Borrar también sus adjuntos del depósito privado. Si la política del
      // depósito no lo permite, la publicación ya está borrada: solo se registra.
      const attachmentPaths = [...new Set((post.attachments || []).map((a) => a.path).filter(Boolean))];
      if (attachmentPaths.length > 0) {
        try {
          const { error: rmError } = await supabase.storage.from(FORUM_FILES_BUCKET).remove(attachmentPaths);
          if (rmError) console.warn('[Foro] no se pudieron borrar los adjuntos:', rmError.message);
        } catch (rmErr) {
          console.warn('[Foro] no se pudieron borrar los adjuntos:', rmErr);
        }
      }
      toast.success(t('forum.deleted'));
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  const handleDeleteComment = async (comment: ForumComment) => {
    const replies = comment.replies?.length || 0;
    const ok = await confirm({
      title: t('mm2.community.confirmDeleteCommentTitle'),
      description: t('mm2.community.confirmDeleteCommentDesc'),
      details: [
        { label: t('mm2.community.confirmAuthor'), value: comment.authorName || 'Dr.' },
        { label: t('mm2.community.confirmReplies'), value: String(replies) },
      ],
      tone: 'destructive',
      confirmLabel: t('forum.delete'),
    });
    if (!ok) return;
    try {
      const { error } = await sb.from('forum_comments').delete().eq('id', comment.id);
      if (error) throw error;
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  // ---- Revelar autor (solo súper admin, queda en bitácora) --------------------------
  const openReveal = (post: ForumPost) => { setRevealPost(post); setRevealReason(''); setRevealData(null); };
  const handleReveal = async () => {
    if (!revealPost) return;
    setRevealLoading(true);
    try {
      const { data, error } = await sb.rpc('forum_admin_reveal', { p_post_id: revealPost.id, p_reason: revealReason.trim() || null });
      if (error) throw error;
      const row: RevealRow | undefined = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('not found');
      setRevealData(row);
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setRevealLoading(false);
    }
  };

  const getRoleBadge = (r?: string) => {
    switch (r) {
      case 'doctor':
        return <Badge variant="default" className="text-[10px] gap-0.5 h-4 px-1.5"><Stethoscope className="w-2.5 h-2.5" />{t('common.doctor')}</Badge>;
      case 'resident':
        return <Badge variant="secondary" className="text-[10px] gap-0.5 h-4 px-1.5"><GraduationCap className="w-2.5 h-2.5" />{t('common.resident')}</Badge>;
      default:
        return null;
    }
  };

  // Comentario estilo NewsArticle: avatar + nombre + badge + tiempo relativo,
  // 1 nivel de anidación (ml-5 sm:ml-8), conector de hilo y colapso de respuestas.
  const renderComment = (comment: ForumComment, depth = 0): React.ReactNode => {
    const isCollapsed = collapsedThreads.has(comment.id);
    const hasReplies = (comment.replies?.length || 0) > 0;
    const maxDepth = 1;
    const canDelete = comment.author_id === user?.id || role === 'admin';

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-5 sm:ml-8' : ''}>
        <div className="flex gap-2.5 py-2.5 group">
          <div className="relative flex flex-col items-center">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={comment.authorAvatar || ''} />
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">{comment.authorName?.charAt(0) || 'D'}</AvatarFallback>
            </Avatar>
            {hasReplies && !isCollapsed && (
              <div className="w-[2px] bg-border flex-1 mt-1 min-h-[8px]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[13px] text-foreground">{comment.authorName || 'Dr.'}</span>
              {getRoleBadge(comment.authorRole)}
              {/* Distintivo de categoría del autor (cliente 2026-08-28) */}
              <ProfileCategoryMark userId={comment.author_id} size="sm" />
              <span className="text-[11px] text-muted-foreground">· {getRelativeTime(comment.created_at)}</span>
            </div>

            {comment.body && (
              <p className="text-[13px] text-foreground/90 mt-0.5 whitespace-pre-wrap leading-snug break-words">{comment.body}</p>
            )}
            {comment.image_url && (
              <img src={comment.image_url} alt="" className="rounded-lg max-h-72 sm:max-h-96 w-auto max-w-full mt-2 border border-border" />
            )}

            <div className="flex items-center gap-3 mt-1">
              {depth < maxDepth && (
                <button
                  type="button"
                  className="text-[11px] font-medium text-muted-foreground"
                  onClick={() => handleReply(comment)}
                >
                  {t('forum.reply')}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground"
                  aria-label={t('forum.delete')}
                  onClick={() => handleDeleteComment(comment)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {hasReplies && isCollapsed && (
              <button
                type="button"
                className="flex items-center gap-1.5 mt-2 text-[12px] font-medium text-primary"
                onClick={() => toggleThread(comment.id)}
              >
                <div className="w-6 h-[1px] bg-border" />
                {t('forum.viewReplies')} ({comment.replies!.length})
              </button>
            )}
          </div>
        </div>

        {hasReplies && !isCollapsed && (
          <div>
            {comment.replies!.map((reply) => renderComment(reply, depth + 1))}
            <button
              type="button"
              className="ml-10 sm:ml-[3.25rem] text-[12px] font-medium text-muted-foreground mb-1"
              onClick={() => toggleThread(comment.id)}
            >
              <ChevronDown className="w-3 h-3 inline mr-1 rotate-180" />
              {t('forum.hideReplies')}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Adjuntos de una publicación: imágenes en rejilla, video con controles, PDF como enlace.
  const renderAttachments = (atts: Attachment[] | undefined) => {
    if (!atts || atts.length === 0) return null;
    const images = atts.filter((a) => a.type === 'image');
    const others = atts.filter((a) => a.type !== 'image');
    return (
      <div className="dc-post-att">
        {images.length > 0 && (
          <div className={`dc-post-att-grid${images.length === 1 ? ' is-single' : ''}`}>
            {images.map((a) => (
              signedUrls[a.path]
                ? <a key={a.path} href={signedUrls[a.path]} target="_blank" rel="noopener noreferrer">
                    <img src={signedUrls[a.path]} alt={a.name} />
                  </a>
                : <div key={a.path} className="dc-skel-in" aria-hidden="true" />
            ))}
          </div>
        )}
        {others.map((a) => (
          a.type === 'video'
            ? (signedUrls[a.path]
                ? <video key={a.path} controls preload="metadata" playsInline src={signedUrls[a.path]} />
                : <div key={a.path} className="dc-skel-in" aria-hidden="true" />)
            : <a key={a.path} href={signedUrls[a.path] || '#'} target="_blank" rel="noopener noreferrer" className="dc-post-file">
                <FileText />
                <span className="nm">{a.name}</span>
                <span className="sz">PDF · {(a.size / 1024 / 1024).toFixed(1)} MB</span>
              </a>
        ))}
      </div>
    );
  };

  const visiblePosts = selectedCategory === 'all' ? posts : posts.filter((p) => p.category === selectedCategory);
  const categoryMeta = (id: ForumCategory) => CATEGORIES.find((c) => c.id === id)!;
  const dailyCats = CATEGORIES.filter((c) => c.daily);
  const promptFor = (cat: ForumCategory) => todayPrompts.find((p) => p.category === cat);

  // ---- Pestaña FEED -----------------------------------------------------------
  // Diseño 12-sep-2026 (lenguaje de los mockups de Marta): columna principal
  // (feed) + carril «Propuestas de hoy». El carril es UN solo nodo del DOM: a
  // ≥1280 px va pegado a la derecha (sticky) y por debajo se coloca ENCIMA del
  // feed en rejilla de 2 (1 en móvil) con grid-template-areas
  // (src/styles/diseno-comunidad.css). Mismos datos y handlers que antes.
  // `bg-card` como en DoctorPatients: exime a todo lo de dentro de las reglas
  // globales de index.css que pintan de blanco iconos, bordes e inputs sueltos.
  const promptsRail = (
    <aside className="dc-feed-rail pro-card pro-card-pad bg-card" aria-label={t('mm2.community.todayPrompts')}>
      <div className="dc-rail-head">
        <span className="pro-icon-box"><CalendarDays /></span>
        <div className="min-w-0">
          <h2 className="dc-rail-title">{t('mm2.community.todayPrompts')}</h2>
          <div className="dc-rail-date">{t('forum.today')} · {cap(dayFmt.format(new Date()))}</div>
          <div className="dc-rail-intro">{t('forum.todayIntro')}</div>
        </div>
      </div>
      {promptsLoading ? (
        <div className="dc-prompts" aria-busy="true">
          {dailyCats.map((c) => <div key={c.id} className="dc-skel-in" aria-hidden="true" />)}
        </div>
      ) : (
        <div className="dc-prompts">
          {dailyCats.map((c) => {
            const Icon = c.icon;
            const p = promptFor(c.id);
            // «Casos de éxito» ya es daily (migración 20260912 amplía
            // forum_publish_daily + siembra el banco), pero antes de aplicarla
            // — o si el banco se agota ese día— no hay propuesta: en ese caso
            // se usa la invitación propia de esta categoría, no el texto genérico.
            const isExito = c.id === 'caso_exito';
            return (
              <article key={c.id} className={`dc-prompt${c.anonymous ? ' is-anon' : ''}`}>
                <div className="dc-prompt-cat">
                  <Icon />
                  <span>{t(c.labelKey)}</span>
                </div>
                <p className={`dc-prompt-text${p ? '' : ' is-empty'}`}>
                  {p ? p.title : (isExito ? t('mm2.community.successCardText') : t('forum.noPromptToday'))}
                </p>
                {p?.body && <p className="dc-prompt-body">{p.body}</p>}
                {p?.image_url && <img src={p.image_url} alt="" className="dc-prompt-img" />}
                <button type="button" className="pro-btn pro-btn-teal pro-btn-xs" onClick={() => openComposer(c.id, p || null)}>
                  <Send />
                  {p ? t('forum.respond') : isExito ? t('mm2.community.successCardCta') : t('forum.publishFree')}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );

  const feedMain = (
    <div className="dc-feed-main">
      {/* Chips de categoría: aria-pressed (nunca role=tab), en varias líneas, nunca cortados */}
      <div className="dc-chips" role="group" aria-label={t('forum.categoryLabel')}>
        <button
          type="button"
          className={`pro-chip${selectedCategory === 'all' ? ' is-active' : ''}`}
          aria-pressed={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
        >
          {t('forum.allCategories')}
        </button>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = selectedCategory === c.id;
          return (
            <button key={c.id} type="button" className={`pro-chip${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => setSelectedCategory(c.id)}>
              <Icon className="w-3.5 h-3.5" />
              {t(c.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Publicaciones */}
      {isLoading ? (
        <div className="dc-posts" aria-busy="true">
          <div className="dc-skel" aria-hidden="true" />
          <div className="dc-skel" aria-hidden="true" />
          <div className="dc-skel" aria-hidden="true" />
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="pro-card bg-card dc-empty">
          <MessagesSquare />
          <p>{t('forum.empty')}</p>
        </div>
      ) : (
        <div className="dc-posts">
          {visiblePosts.map((post, idx) => {
            const meta = categoryMeta(post.category);
            const Icon = meta.icon;
            const comments = commentsByPost[post.id] || [];
            const commentCount = countComments(comments);
            const isExpanded = expandedPost === post.id;
            const canDelete = post.is_mine || role === 'admin';
            const postDay = fmtYmd(new Date(post.created_at));
            const prevDay = idx > 0 ? fmtYmd(new Date(visiblePosts[idx - 1].created_at)) : null;
            const prompt = post.prompt_id ? promptById[post.prompt_id] : undefined;
            const highlighted = focusPostId === post.id;
            return (
              <React.Fragment key={post.id}>
                {postDay !== prevDay && (
                  <div className="dc-day"><span>{dayLabel(postDay)}</span></div>
                )}
                <article id={`post-${post.id}`} className={`pro-card bg-card dc-post${highlighted ? ' is-focus' : ''}`}>
                    <div className="dc-post-top">
                      <div className="dc-post-tags">
                        <span className="pro-pill pro-pill-info pro-pill-plain">
                          <Icon />
                          {t(meta.labelKey)}
                        </span>
                        {post.specialty && (
                          <span className="pro-pill pro-pill-muted pro-pill-plain">{post.specialty}</span>
                        )}
                      </div>
                      <div className="dc-post-actions">
                        {role === 'admin' && post.is_anonymous && (
                          <button
                            type="button"
                            className="pro-kebab"
                            title={t('forum.reveal')}
                            aria-label={t('forum.reveal')}
                            onClick={() => openReveal(post)}
                          >
                            <Eye />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="pro-kebab is-danger"
                            aria-label={t('forum.delete')}
                            onClick={() => handleDeletePost(post)}
                          >
                            <Trash2 />
                          </button>
                        )}
                      </div>
                    </div>
                    {prompt && (
                      <p className="dc-post-prompt">
                        <CornerDownRight />
                        <span><span className="lbl">{t('forum.respondsTo')}: </span>{prompt.title}</span>
                      </p>
                    )}
                    <h3 className="dc-post-title">{post.title}</h3>
                    <p className="dc-post-body">{post.body}</p>
                    {post.image_url && (
                      <img src={post.image_url} alt="" className="dc-post-img" />
                    )}
                    {renderAttachments(post.attachments)}
                    <div className="dc-post-meta">
                      <span className="who">
                        {post.is_anonymous ? (
                          <><EyeOff />{t('forum.anonymous')}</>
                        ) : (
                          <>
                            <span className="nm">{post.authorName || 'Dr.'}</span>
                            {/* Distintivo de categoría del autor (cliente 2026-08-28) */}
                            <ProfileCategoryMark userId={post.author_id} size="sm" className="flex-shrink-0" />
                          </>
                        )}
                        <span aria-hidden>·</span>
                        <span className="whitespace-nowrap">{dateFmt.format(new Date(post.created_at))}</span>
                      </span>
                      <button
                        type="button"
                        className="cmt"
                        aria-expanded={isExpanded}
                        onClick={() => {
                          setExpandedPost(isExpanded ? null : post.id);
                          resetComposer();
                        }}
                      >
                        <MessageCircle />
                        {commentCount} {t('forum.comments')}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="dc-post-comments">
                        {comments.length > 0 && (
                          <div className="divide-y divide-border/40 mb-2">
                            {comments.map((c) => renderComment(c))}
                          </div>
                        )}
                        {/* Composer: avatar + input + imagen + enviar (cabe en 375px) */}
                        {replyTo && (
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground truncate">
                              {t('forum.replyingTo')} <span className="font-medium text-foreground">@{replyTo.name}</span>
                            </span>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground flex-shrink-0 ml-2 h-6 w-6 inline-flex items-center justify-center"
                              aria-label={t('forum.removeImage')}
                              onClick={() => { setReplyTo(null); setCommentDraft(''); }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {commentImagePreview && (
                          <div className="relative inline-block mb-2">
                            <img src={commentImagePreview} alt="" className="rounded-lg max-h-40 w-auto max-w-full border border-border" />
                            <button
                              type="button"
                              onClick={clearCommentImage}
                              aria-label={t('forum.removeImage')}
                              className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1"
                            >
                              <X className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={user?.avatarUrl || ''} />
                            <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'D'}</AvatarFallback>
                          </Avatar>
                          <Input
                            ref={commentInputRef}
                            className="flex-1 min-w-0"
                            placeholder={t('forum.commentPlaceholder')}
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            maxLength={4000}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); }
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 shrink-0"
                            aria-label={t('forum.addImage')}
                            onClick={() => commentImageInputRef.current?.click()}
                          >
                            <ImagePlus className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            aria-label={t('forum.send')}
                            disabled={isSendingComment || (!commentDraft.trim() && !commentImageFile)}
                            onClick={() => handleComment(post.id)}
                          >
                            {isSendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </Button>
                        </div>
                        <input
                          ref={commentImageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={onCommentImageSelected}
                        />
                      </div>
                    )}
                </article>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        {/* Cabecera PRO de la sección */}
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <MessagesSquare className="w-7 h-7" />
              <span className="truncate">{t('mm2.community.title')}</span>
            </h1>
            <p className="pro-page-sub">{t('mm2.community.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {role === 'admin' && (
              <Link to="/admin/forum" className="pro-btn pro-btn-ghost dc-admin-link hidden sm:inline-flex">
                <Settings2 />{t('forum.adminPanel')}
              </Link>
            )}
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { clearNewFiles(); setNewPrompt(null); } }}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="pro-btn pro-btn-white w-full sm:w-auto"
                  onClick={() => { if (tab !== 'feed') setTab('feed'); if (!newSpecialty && mySpecialty) setNewSpecialty(mySpecialty); }}
                >
                  <Plus />
                  {t('forum.newPost')}
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('forum.newPost')}</DialogTitle>
                  <DialogDescription>{t('forum.newPostHint')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <select
                    aria-label={t('forum.categoryLabel')}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ForumCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{t(c.labelKey)}</option>
                    ))}
                  </select>
                  {newPrompt && newPrompt.category === newCategory && (
                    <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                      <CornerDownRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-muted-foreground">{t('forum.respondingToPrompt')} </span>
                        <span className="font-medium text-foreground">{newPrompt.title}</span>
                      </div>
                      <button type="button" className="text-muted-foreground underline whitespace-nowrap" onClick={() => setNewPrompt(null)}>
                        {t('forum.unlinkPrompt')}
                      </button>
                    </div>
                  )}
                  {isAnonymousCategory && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5" />
                      {t('forum.anonymousNote')}
                    </p>
                  )}
                  {/* Especialidad: catálogo si existe; si no, texto libre */}
                  {specialties.length > 0 ? (
                    <select
                      aria-label={t('forum.specialty')}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={newSpecialty}
                      onChange={(e) => setNewSpecialty(e.target.value)}
                    >
                      <option value="">{t('forum.specialtyPlaceholder')}</option>
                      {mySpecialty && !specialties.includes(mySpecialty) && <option value={mySpecialty}>{mySpecialty}</option>}
                      {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Input
                      placeholder={t('forum.specialtyPlaceholder')}
                      value={newSpecialty}
                      onChange={(e) => setNewSpecialty(e.target.value)}
                      maxLength={80}
                    />
                  )}
                  <Input
                    placeholder={t('forum.titlePlaceholder')}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={200}
                  />
                  <Textarea
                    placeholder={t('forum.bodyPlaceholder')}
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    rows={6}
                    maxLength={10000}
                  />
                  {/* Adjuntos (imágenes, video, PDF) — depósito privado */}
                  {newFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newFiles.map((f, i) => (
                        <div key={`${f.file.name}-${i}`} className="relative">
                          {f.preview ? (
                            <img src={f.preview} alt="" className="h-20 w-20 object-cover rounded-lg border border-border" />
                          ) : (
                            <div className="h-20 w-28 rounded-lg border border-border bg-muted/40 flex flex-col items-center justify-center text-[11px] text-muted-foreground px-1 text-center">
                              {f.kind === 'video' ? <Film className="w-4 h-4 mb-1" /> : <FileText className="w-4 h-4 mb-1" />}
                              <span className="truncate w-full">{f.file.name}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeNewFile(i)}
                            aria-label={t('forum.removeImage')}
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5"
                          >
                            <X className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={newFiles.length >= MAX_FILES}
                    onClick={() => filesInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                    {t('forum.addFiles')} ({newFiles.length}/{MAX_FILES})
                  </Button>
                  <input
                    ref={filesInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
                    className="hidden"
                    onChange={onFilesSelected}
                  />
                  {/* El botón abre la revisión: nada se guarda en este paso. */}
                  <p className="text-[11px] text-muted-foreground">{t('mm2.community.publishReviewHint')}</p>
                </div>
                <DialogFooter>
                  <Button onClick={handlePublish} disabled={isPublishing} className="gap-2 w-full sm:w-auto">
                    {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('mm2.community.reviewAndPublish')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Feed | Descubrir */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SectionTabs<CommunityTab>
            value={tab}
            onChange={setTab}
            ariaLabel={t('mm2.community.title')}
            items={[
              { id: 'feed', label: t('mm2.community.tabFeed'), icon: Rss },
              { id: 'descubrir', label: t('mm2.community.tabDiscover'), icon: Compass },
            ]}
          />
          {tab === 'descubrir' && (
            <SectionTabs<DiscoverView>
              value={view}
              onChange={setView}
              ariaLabel={t('mm2.community.tabDiscover')}
              items={[
                { id: 'medicos', label: t('mm2.community.tabDoctors'), icon: Stethoscope },
                { id: 'hospitales', label: t('mm2.community.tabHospitals'), icon: Hospital },
              ]}
            />
          )}
        </div>

        {tab === 'feed' ? (
          <div className="dc-feed">{feedMain}{promptsRail}</div>
        ) : view === 'medicos' ? (
          <Doctors embedded />
        ) : (
          <HospitalLocator embedded />
        )}

        {/* Revelar autor — solo súper admin, queda en bitácora */}
        <Dialog open={!!revealPost} onOpenChange={(o) => { if (!o) { setRevealPost(null); setRevealData(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />{t('forum.revealTitle')}</DialogTitle>
              <DialogDescription>{t('forum.revealNote')}</DialogDescription>
            </DialogHeader>
            {revealPost && (
              <p className="text-sm font-medium text-foreground break-words">«{revealPost.title}»</p>
            )}
            {!revealData ? (
              <>
                <Input
                  placeholder={t('forum.revealReason')}
                  value={revealReason}
                  onChange={(e) => setRevealReason(e.target.value)}
                  maxLength={200}
                />
                <DialogFooter>
                  <Button onClick={handleReveal} disabled={revealLoading} className="gap-2 w-full sm:w-auto">
                    {revealLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {t('forum.revealConfirm')}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('forum.revealCode')}</span><span className="font-mono font-semibold">{revealData.doctor_code || t('forum.revealNoCode')}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('forum.revealName')}</span><span className="font-medium text-right">{revealData.name || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('forum.revealEmail')}</span><span className="text-right break-all">{revealData.email || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('forum.specialty')}</span><span className="text-right">{revealData.specialty || '—'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('forum.revealRole')}</span><span>{revealData.role || '—'}</span></div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {dialog}
      </div>
    </MainLayout>
  );
}
