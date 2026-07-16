import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIntlLocale, getDateLocale } from '@/lib/dateLocale';
import { formatDistanceToNow } from 'date-fns';
import {
  MessagesSquare, Plus, Loader2, Stethoscope, AlertTriangle, Lightbulb, Gem, Trophy,
  MessageCircle, Send, Trash2, EyeOff, GraduationCap, ImagePlus, X, ChevronDown,
} from 'lucide-react';

// FORO (cliente 15/16-jul-2026): discusión del gremio — solo doctores/residentes
// publican y comentan (admin modera). La ruta /foro está gateada por AccessGuard
// y las políticas RLS lo refuerzan en BD (20260715_forum.sql +
// 20260716_forum_enhancements.sql). Comentarios anidados (1 nivel, estilo
// NewsArticle), imágenes en posts y comentarios, y notificación a todos los
// doctores aprobados al publicar.
// Las tablas forum_* aún no están en los tipos generados → (supabase as any).
const sb = supabase as any;

type ForumCategory = 'caso_clinico' | 'complicacion' | 'innovacion' | 'perla_quirurgica' | 'caso_exito';

const CATEGORIES: { id: ForumCategory; labelKey: string; icon: React.ElementType; anonymous?: boolean }[] = [
  { id: 'caso_clinico', labelKey: 'forum.catCasoClinico', icon: Stethoscope },
  { id: 'complicacion', labelKey: 'forum.catComplicacion', icon: AlertTriangle, anonymous: true },
  { id: 'innovacion', labelKey: 'forum.catInnovacion', icon: Lightbulb },
  { id: 'perla_quirurgica', labelKey: 'forum.catPerla', icon: Gem },
  { id: 'caso_exito', labelKey: 'forum.catExito', icon: Trophy },
];

// Validación de imágenes (posts y comentarios): solo JPG/PNG/WebP, máx 8 MB.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

export default function Foro() {
  const { t, language } = useLanguage();
  const { user, role } = useAuth();
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

  // Imagen del comentario (una por comentario).
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);

  // Crear publicación
  const [createOpen, setCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ForumCategory>('caso_clinico');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const postImageInputRef = useRef<HTMLInputElement>(null);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(getIntlLocale(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [language],
  );
  const dateLocale = useMemo(() => getDateLocale(language), [language]);
  const getRelativeTime = useCallback(
    (dateStr: string) => formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: dateLocale }),
    [dateLocale],
  );

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

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await sb
        .from('forum_posts_feed')   // vista: anula author_id de anónimos + is_mine + image_url
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows: ForumPost[] = data || [];
      const names = await resolveAuthorNames(rows);
      setPosts(rows.map((p) => ({ ...p, authorName: p.is_anonymous || !p.author_id ? undefined : names[p.author_id]?.name })));

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
  }, [resolveAuthorNames, resolveRoles]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const isAnonymousCategory = CATEGORIES.find((c) => c.id === newCategory)?.anonymous === true;

  // Cuenta total (raíces + respuestas) para el toggle "N comentarios".
  const countComments = useCallback((list: ForumComment[]): number =>
    list.reduce((acc, c) => acc + 1 + countComments(c.replies || []), 0), []);

  // ---- Imágenes ---------------------------------------------------------------
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

  const onPostImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !validateImage(file)) return;
    if (postImagePreview) URL.revokeObjectURL(postImagePreview);
    setPostImageFile(file);
    setPostImagePreview(URL.createObjectURL(file));
  };
  const clearPostImage = () => {
    if (postImagePreview) URL.revokeObjectURL(postImagePreview);
    setPostImageFile(null);
    setPostImagePreview(null);
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

  // ---- Publicar / comentar / borrar ------------------------------------------
  const handlePublish = async () => {
    if (!user?.id) return;
    if (newTitle.trim().length < 3 || !newBody.trim()) {
      toast.error(t('forum.validation'));
      return;
    }
    setIsPublishing(true);
    try {
      let imageUrl: string | null = null;
      if (postImageFile) {
        imageUrl = await uploadForumImage(postImageFile);
        if (!imageUrl) return;   // el toast ya lo mostró uploadForumImage
      }
      const { data, error } = await sb.from('forum_posts').insert({
        author_id: user.id,
        category: newCategory,
        title: newTitle.trim(),
        body: newBody.trim(),
        is_anonymous: isAnonymousCategory,
        image_url: imageUrl,
      }).select('id').single();
      if (error) throw error;

      // Best-effort: notificar a todos los doctores aprobados (nunca bloquea el post).
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
      clearPostImage();
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

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await sb.from('forum_posts').delete().eq('id', postId);
      if (error) throw error;
      toast.success(t('forum.deleted'));
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await sb.from('forum_comments').delete().eq('id', commentId);
      if (error) throw error;
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
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
                  onClick={() => handleDeleteComment(comment.id)}
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

  const visiblePosts = selectedCategory === 'all' ? posts : posts.filter((p) => p.category === selectedCategory);
  const categoryMeta = (id: ForumCategory) => CATEGORIES.find((c) => c.id === id)!;
  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 border ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'
    }`;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <MessagesSquare className="w-6 h-6 text-primary" />
              {t('forum.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('forum.subtitle')}</p>
          </div>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) clearPostImage(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 flex-shrink-0">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('forum.newPost')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
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
                {isAnonymousCategory && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <EyeOff className="w-3.5 h-3.5" />
                    {t('forum.anonymousNote')}
                  </p>
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
                {/* Imagen del post (opcional) */}
                {postImagePreview ? (
                  <div className="relative inline-block">
                    <img src={postImagePreview} alt="" className="rounded-lg max-h-48 w-auto max-w-full border border-border" />
                    <button
                      type="button"
                      onClick={clearPostImage}
                      aria-label={t('forum.removeImage')}
                      className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => postImageInputRef.current?.click()}
                  >
                    <ImagePlus className="w-4 h-4" />
                    {t('forum.addImage')}
                  </Button>
                )}
                <input
                  ref={postImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onPostImageSelected}
                />
              </div>
              <DialogFooter>
                <Button onClick={handlePublish} disabled={isPublishing} className="gap-2 w-full sm:w-auto">
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('forum.publish')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Category chips — seleccionables (sólido/outline) sin hover que parpadee */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          <button type="button" className={chipClass(selectedCategory === 'all')} onClick={() => setSelectedCategory('all')}>
            {t('forum.allCategories')}
          </button>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" className={chipClass(selectedCategory === c.id)} onClick={() => setSelectedCategory(c.id)}>
                <Icon className="w-3.5 h-3.5" />
                {t(c.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Posts */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : visiblePosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessagesSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('forum.empty')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visiblePosts.map((post) => {
              const meta = categoryMeta(post.category);
              const Icon = meta.icon;
              const comments = commentsByPost[post.id] || [];
              const commentCount = countComments(comments);
              const isExpanded = expandedPost === post.id;
              const canDelete = post.is_mine || role === 'admin';
              return (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="secondary" className="gap-1 text-[11px] mb-2">
                        <Icon className="w-3 h-3" />
                        {t(meta.labelKey)}
                      </Badge>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          aria-label={t('forum.delete')}
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground leading-snug break-words">{post.title}</h3>
                    <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap break-words">{post.body}</p>
                    {post.image_url && (
                      <img src={post.image_url} alt="" className="rounded-lg max-h-72 sm:max-h-96 w-auto max-w-full mt-2 border border-border" />
                    )}
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {post.is_anonymous ? (
                          <><EyeOff className="w-3.5 h-3.5" />{t('forum.anonymous')}</>
                        ) : (
                          <span className="truncate">{post.authorName || 'Dr.'}</span>
                        )}
                        <span aria-hidden>·</span>
                        <span className="whitespace-nowrap">{dateFmt.format(new Date(post.created_at))}</span>
                      </span>
                      <button
                        type="button"
                        className="flex items-center gap-1 flex-shrink-0"
                        onClick={() => {
                          setExpandedPost(isExpanded ? null : post.id);
                          resetComposer();
                        }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {commentCount} {t('forum.comments')}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
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
                            className="h-10 w-10 shrink-0"
                            aria-label={t('forum.addImage')}
                            onClick={() => commentImageInputRef.current?.click()}
                          >
                            <ImagePlus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            disabled={isSendingComment || (!commentDraft.trim() && !commentImageFile)}
                            aria-label={t('forum.send')}
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
