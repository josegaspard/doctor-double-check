import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getIntlLocale } from '@/lib/dateLocale';
import {
  MessagesSquare, Plus, Loader2, Stethoscope, AlertTriangle, Lightbulb, Gem, Trophy,
  MessageCircle, Send, Trash2, EyeOff,
} from 'lucide-react';

// FORO (cliente 15-jul-2026): discusión del gremio — solo doctores/residentes
// publican y comentan (admin modera). La ruta /foro está gateada por AccessGuard
// y las políticas RLS lo refuerzan en BD (20260715_forum.sql). Reemplaza al
// antiguo hub de cards (meetings/eventos siguen accesibles por sus rutas).
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

interface ForumPost {
  id: string;
  author_id: string | null;   // null en posts anónimos (la vista lo anula)
  is_mine: boolean;           // dueño → puede borrar (server-side)
  category: ForumCategory;
  title: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  authorName?: string;
}

interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  authorName?: string;
}

export default function Foro() {
  const { t, language } = useLanguage();
  const { user, role } = useAuth();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, ForumComment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory | 'all'>('all');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // Crear publicación
  const [createOpen, setCreateOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ForumCategory>('caso_clinico');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(getIntlLocale(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [language],
  );

  const resolveAuthorNames = useCallback(async (rows: { author_id: string | null; is_anonymous?: boolean }[]) => {
    // Nombres SOLO de autores no anónimos (los anónimos llegan con author_id null).
    const ids = [...new Set(rows.filter((r) => !r.is_anonymous && r.author_id).map((r) => r.author_id as string))];
    if (ids.length === 0) return {} as Record<string, string>;
    const { data } = await supabase.from('profiles_public').select('id, name').in('id', ids);
    return Object.fromEntries(((data || []) as any[]).map((p) => [p.id, p.name || 'Dr.']));
  }, []);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await sb
        .from('forum_posts_feed')   // vista: anula author_id de anónimos + is_mine
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows: ForumPost[] = data || [];
      const names = await resolveAuthorNames(rows);
      setPosts(rows.map((p) => ({ ...p, authorName: p.is_anonymous || !p.author_id ? undefined : names[p.author_id] })));

      // Comentarios de los posts listados (una sola query, agrupado client-side).
      if (rows.length > 0) {
        const { data: cData } = await sb
          .from('forum_comments')
          .select('*')
          .in('post_id', rows.map((p: ForumPost) => p.id))
          .order('created_at', { ascending: true });
        const cRows: ForumComment[] = cData || [];
        const cNames = await resolveAuthorNames(cRows);
        const grouped: Record<string, ForumComment[]> = {};
        for (const c of cRows) {
          (grouped[c.post_id] ??= []).push({ ...c, authorName: cNames[c.author_id] });
        }
        setCommentsByPost(grouped);
      } else {
        setCommentsByPost({});
      }
    } catch (e) {
      console.error('forum fetch error', e);
    } finally {
      setIsLoading(false);
    }
  }, [resolveAuthorNames]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const isAnonymousCategory = CATEGORIES.find((c) => c.id === newCategory)?.anonymous === true;

  const handlePublish = async () => {
    if (!user?.id) return;
    if (newTitle.trim().length < 3 || !newBody.trim()) {
      toast.error(t('forum.validation'));
      return;
    }
    setIsPublishing(true);
    try {
      const { error } = await sb.from('forum_posts').insert({
        author_id: user.id,
        category: newCategory,
        title: newTitle.trim(),
        body: newBody.trim(),
        is_anonymous: isAnonymousCategory,
      });
      if (error) throw error;
      toast.success(t('forum.published'));
      setCreateOpen(false);
      setNewTitle('');
      setNewBody('');
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
    if (!user?.id || !commentDraft.trim() || isSendingComment) return;
    setIsSendingComment(true);
    try {
      const { error } = await sb.from('forum_comments').insert({
        post_id: postId,
        author_id: user.id,
        body: commentDraft.trim(),
      });
      if (error) throw error;
      setCommentDraft('');
      fetchPosts();
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setIsSendingComment(false);
    }
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

  const visiblePosts = selectedCategory === 'all' ? posts : posts.filter((p) => p.category === selectedCategory);
  const categoryMeta = (id: ForumCategory) => CATEGORIES.find((c) => c.id === id)!;

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
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          <Button
            size="sm"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            className="rounded-full flex-shrink-0"
            onClick={() => setSelectedCategory('all')}
          >
            {t('forum.allCategories')}
          </Button>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Button
                key={c.id}
                size="sm"
                variant={selectedCategory === c.id ? 'default' : 'outline'}
                className="rounded-full flex-shrink-0 gap-1.5"
                onClick={() => setSelectedCategory(c.id)}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(c.labelKey)}
              </Button>
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
                    <h3 className="font-semibold text-foreground leading-snug">{post.title}</h3>
                    <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{post.body}</p>
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {post.is_anonymous ? (
                          <><EyeOff className="w-3.5 h-3.5" />{t('forum.anonymous')}</>
                        ) : (
                          <>{post.authorName || 'Dr.'}</>
                        )}
                        <span aria-hidden>·</span>
                        {dateFmt.format(new Date(post.created_at))}
                      </span>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => { setExpandedPost(isExpanded ? null : post.id); setCommentDraft(''); }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {comments.length} {t('forum.comments')}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2.5">
                        {comments.map((c) => (
                          <div key={c.id} className="text-sm">
                            <span className="font-medium text-foreground">{c.authorName || 'Dr.'}</span>
                            <span className="text-muted-foreground text-xs ml-2">{dateFmt.format(new Date(c.created_at))}</span>
                            <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <Input
                            placeholder={t('forum.commentPlaceholder')}
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            maxLength={4000}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                          />
                          <Button
                            size="icon"
                            disabled={isSendingComment || !commentDraft.trim()}
                            aria-label={t('forum.send')}
                            onClick={() => handleComment(post.id)}
                          >
                            {isSendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </Button>
                        </div>
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
