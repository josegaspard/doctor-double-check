import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Clock, Share2, MessageCircle, Send, Loader2,
  Trash2, Stethoscope, User, GraduationCap, Facebook, Twitter, Link as LinkIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
}

export default function NewsArticle() {
  const { slug } = useParams();
  const { user, role, isAuthenticated } = useAuth();
  const [article, setArticle] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      const { data } = await supabase
        .from('medical_news')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle();
      setArticle(data);
      if (data) fetchComments(data.id);
      setIsLoading(false);
    };
    if (slug) fetchArticle();
  }, [slug]);

  const fetchComments = async (newsId: string) => {
    const { data: commentsData } = await supabase
      .from('news_comments')
      .select('*')
      .eq('news_id', newsId)
      .order('created_at', { ascending: true });

    if (!commentsData || commentsData.length === 0) { setComments([]); return; }

    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', userIds);

    // Get roles
    const { data: roles } = await supabase
      .from('user_roles' as any)
      .select('user_id, role')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const roleMap = new Map((roles as any[])?.map((r: any) => [r.user_id, r.role]) || []);

    setComments(commentsData.map(c => ({
      ...c,
      user_name: profileMap.get(c.user_id)?.name || 'Usuario',
      user_avatar: profileMap.get(c.user_id)?.avatar_url || null,
      user_role: roleMap.get(c.user_id) || 'patient',
    })));
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !article) return;
    setIsSending(true);
    const { error } = await supabase
      .from('news_comments')
      .insert({ news_id: article.id, user_id: user.id, content: newComment.trim() });
    if (error) { toast.error('Error al comentar'); setIsSending(false); return; }
    setNewComment('');
    fetchComments(article.id);
    setIsSending(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('news_comments').delete().eq('id', commentId);
    if (error) { toast.error('Error'); return; }
    if (article) fetchComments(article.id);
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'doctor': return <Badge variant="default" className="text-[10px] gap-1"><Stethoscope className="w-2.5 h-2.5" />Doctor</Badge>;
      case 'resident': return <Badge variant="secondary" className="text-[10px] gap-1"><GraduationCap className="w-2.5 h-2.5" />Residente</Badge>;
      default: return <Badge variant="outline" className="text-[10px] gap-1"><User className="w-2.5 h-2.5" />Paciente</Badge>;
    }
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = article?.title || '';

  if (isLoading) {
    return <MainLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  }

  if (!article) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-semibold mb-4">Artículo no encontrado</h2>
          <Link to="/news"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Volver a noticias</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <article className="container mx-auto px-4 py-6 max-w-3xl">
        <Link to="/news" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a noticias
        </Link>

        {/* Cover Image */}
        {article.image_url && (
          <div className="aspect-video rounded-xl overflow-hidden mb-6">
            <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Badge variant="secondary">{article.category}</Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(article.published_at || article.created_at), "d 'de' MMMM, yyyy", { locale: es })}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-3">{article.title}</h1>
        {article.summary && <p className="text-lg text-muted-foreground mb-6">{article.summary}</p>}

        {/* Share Buttons */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-muted-foreground mr-1"><Share2 className="w-4 h-4 inline mr-1" />Compartir:</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}>
            <Facebook className="w-3.5 h-3.5" /> Facebook
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank')}>
            <Twitter className="w-3.5 h-3.5" /> X
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Enlace copiado'); }}>
            <LinkIcon className="w-3.5 h-3.5" /> Copiar
          </Button>
        </div>

        <Separator className="mb-6" />

        {/* Content */}
        <div
          className="prose prose-sm sm:prose max-w-none dark:prose-invert prose-img:rounded-lg prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
        />

        <Separator className="my-8" />

        {/* Comments */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Comentarios ({comments.length})
          </h2>

          {/* New comment */}
          {isAuthenticated ? (
            <div className="flex gap-3 mb-6">
              <Avatar className="w-8 h-8 mt-1">
                <AvatarImage src={user?.avatarUrl || ''} />
                <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Escribe un comentario..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  maxLength={2000}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSubmitComment} disabled={isSending || !newComment.trim()}>
                    {isSending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                    Comentar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Card className="p-4 mb-6 text-center">
              <p className="text-muted-foreground text-sm">
                <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link> para comentar
              </p>
            </Card>
          )}

          {/* Comments list */}
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarImage src={comment.user_avatar || ''} />
                  <AvatarFallback>{comment.user_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{comment.user_name}</span>
                    {getRoleBadge(comment.user_role || 'patient')}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                    {user?.id === comment.user_id && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(comment.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sé el primero en comentar</p>
            )}
          </div>
        </section>
      </article>
    </MainLayout>
  );
}
