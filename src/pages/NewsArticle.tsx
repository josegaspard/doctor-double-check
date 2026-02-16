import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  Trash2, Stethoscope, User, GraduationCap, Facebook, Twitter, Link as LinkIcon,
  Globe, Instagram, Linkedin, Pencil, Reply, ChevronDown, ChevronUp,
  Star, MapPin, Users, Edit
} from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_comment_id: string | null;
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  replies?: Comment[];
}

export default function NewsArticle() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const [article, setArticle] = useState<any>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [authorDoctorProfile, setAuthorDoctorProfile] = useState<any>(null);
  const [editorProfile, setEditorProfile] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
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
      if (data) {
        fetchComments(data.id);
        // Fetch author profile
        const { data: authorP } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .eq('id', data.created_by)
          .maybeSingle();
        setAuthorProfile(authorP);

        // Fetch author doctor profile for extra info
        const { data: doctorP } = await supabase
          .from('doctor_profiles_public')
          .select('*')
          .eq('user_id', data.created_by)
          .maybeSingle();
        setAuthorDoctorProfile(doctorP);

        // Fetch editor profile if edited
        if (data.last_edited_by && data.last_edited_by !== data.created_by) {
          const { data: editorP } = await supabase
            .from('profiles_public')
            .select('id, name, avatar_url')
            .eq('id', data.last_edited_by)
            .maybeSingle();
          setEditorProfile(editorP);
        } else if (data.last_edited_by) {
          setEditorProfile(authorP);
        }
      }
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
      .from('profiles_public')
      .select('id, name, avatar_url')
      .in('id', userIds);

    const { data: roles } = await supabase
      .from('user_roles' as any)
      .select('user_id, role')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const roleMap = new Map((roles as any[])?.map((r: any) => [r.user_id, r.role]) || []);

    const enriched = commentsData.map(c => ({
      ...c,
      parent_comment_id: (c as any).parent_comment_id || null,
      user_name: profileMap.get(c.user_id)?.name || 'Usuario',
      user_avatar: profileMap.get(c.user_id)?.avatar_url || null,
      user_role: roleMap.get(c.user_id) || 'patient',
      replies: [] as Comment[],
    }));

    // Build thread tree
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];
    enriched.forEach(c => commentMap.set(c.id, c));
    enriched.forEach(c => {
      if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
        commentMap.get(c.parent_comment_id)!.replies!.push(c);
      } else {
        rootComments.push(c);
      }
    });

    setComments(rootComments);
  };

  const handleSubmitComment = async (parentId: string | null = null) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !user || !article) return;
    setIsSending(true);
    const insertData: any = { news_id: article.id, user_id: user.id, content: content.trim() };
    if (parentId) insertData.parent_comment_id = parentId;
    const { error } = await supabase.from('news_comments').insert(insertData);
    if (error) { toast.error('Error al comentar'); setIsSending(false); return; }
    if (parentId) { setReplyContent(''); setReplyTo(null); } else { setNewComment(''); }
    fetchComments(article.id);
    setIsSending(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('news_comments').delete().eq('id', commentId);
    if (error) { toast.error('Error'); return; }
    if (article) fetchComments(article.id);
  };

  const toggleThread = (commentId: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'doctor': return <Badge variant="default" className="text-[10px] gap-1"><Stethoscope className="w-2.5 h-2.5" />Doctor</Badge>;
      case 'resident': return <Badge variant="secondary" className="text-[10px] gap-1"><GraduationCap className="w-2.5 h-2.5" />Residente</Badge>;
      default: return <Badge variant="outline" className="text-[10px] gap-1"><User className="w-2.5 h-2.5" />Paciente</Badge>;
    }
  };

  const getTotalCommentCount = useCallback((comments: Comment[]): number => {
    return comments.reduce((acc, c) => acc + 1 + getTotalCommentCount(c.replies || []), 0);
  }, []);

  const canEdit = article && user && (user.id === article.created_by || role === 'admin');
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = article?.title || '';
  const authorSocial = article?.author_social || {};

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isCollapsed = collapsedThreads.has(comment.id);
    const hasReplies = (comment.replies?.length || 0) > 0;
    const maxDepth = 4;

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-4 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-muted' : ''}>
        <div className="flex gap-2 sm:gap-3 py-2">
          <Avatar className="w-7 h-7 mt-0.5 shrink-0">
            <AvatarImage src={comment.user_avatar || ''} />
            <AvatarFallback className="text-xs">{comment.user_name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-foreground">{comment.user_name}</span>
              {getRoleBadge(comment.user_role || 'patient')}
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.created_at), "d MMM yyyy, HH:mm", { locale: es })}
              </span>
            </div>
            <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{comment.content}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {isAuthenticated && depth < maxDepth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                >
                  <Reply className="w-3 h-3" /> Responder
                </Button>
              )}
              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => toggleThread(comment.id)}
                >
                  {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                  {comment.replies!.length} {comment.replies!.length === 1 ? 'respuesta' : 'respuestas'}
                </Button>
              )}
              {user?.id === comment.user_id && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(comment.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Reply input */}
            {replyTo === comment.id && (
              <div className="flex gap-2 mt-2">
                <Textarea
                  placeholder={`Responder a ${comment.user_name}...`}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className="text-sm min-h-[60px]"
                />
                <div className="flex flex-col gap-1">
                  <Button size="sm" className="h-7 px-2" onClick={() => handleSubmitComment(comment.id)} disabled={isSending || !replyContent.trim()}>
                    <Send className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setReplyTo(null); setReplyContent(''); }}>
                    ✕
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Replies */}
        {hasReplies && !isCollapsed && (
          <div>
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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
        <div className="flex items-center justify-between mb-4">
          <Link to="/news" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Volver a noticias
          </Link>
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/news', { state: { editId: article.id } })}>
              <Edit className="w-3.5 h-3.5" /> Editar artículo
            </Button>
          )}
        </div>

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

        {/* Edit History Badge */}
        {article.last_edited_at && (
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
            <Pencil className="w-3 h-3" />
            <span>
              Editado el {format(new Date(article.last_edited_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              {editorProfile && <> por <strong className="text-foreground">{editorProfile.name}</strong></>}
            </span>
          </div>
        )}

        {/* Author Card - Enhanced */}
        {authorProfile && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {authorDoctorProfile ? (
                  <Link to={`/doctor/${authorProfile.id}`}>
                    <Avatar className="w-14 h-14 border-2 border-primary/20">
                      <AvatarImage src={authorProfile.avatar_url || ''} />
                      <AvatarFallback className="text-lg">{authorProfile.name?.charAt(0) || 'A'}</AvatarFallback>
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar className="w-14 h-14 border-2 border-primary/20">
                    <AvatarImage src={authorProfile.avatar_url || ''} />
                    <AvatarFallback className="text-lg">{authorProfile.name?.charAt(0) || 'A'}</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {authorDoctorProfile ? (
                      <Link to={`/doctor/${authorProfile.id}`} className="font-semibold text-foreground hover:underline text-base">
                        {authorProfile.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground text-base">{authorProfile.name}</span>
                    )}
                    <Badge variant="outline" className="text-[10px]">Autor</Badge>
                  </div>

                  {/* Doctor-specific info */}
                  {authorDoctorProfile && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-xs text-muted-foreground">
                      {authorDoctorProfile.specialty && (
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-primary" />
                          {authorDoctorProfile.specialty}
                        </span>
                      )}
                      {authorDoctorProfile.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {authorDoctorProfile.location}
                        </span>
                      )}
                      {authorDoctorProfile.rating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-primary fill-primary" />
                          {Number(authorDoctorProfile.rating).toFixed(1)}
                        </span>
                      )}
                      {authorDoctorProfile.total_consultations > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {authorDoctorProfile.total_consultations} consultas
                        </span>
                      )}
                      {authorDoctorProfile.followers_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {authorDoctorProfile.followers_count} seguidores
                        </span>
                      )}
                      {authorDoctorProfile.consultation_fee > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          Consulta: ${Number(authorDoctorProfile.consultation_fee).toFixed(0)} MXN
                        </Badge>
                      )}
                      {authorDoctorProfile.consultation_fee === 0 && (
                        <Badge variant="default" className="text-[10px]">
                          Consulta gratuita
                        </Badge>
                      )}
                    </div>
                  )}

                  {article.author_bio && (
                    <p className="text-sm text-muted-foreground mb-2">{article.author_bio}</p>
                  )}
                  {authorDoctorProfile?.bio && !article.author_bio && (
                    <p className="text-sm text-muted-foreground mb-2">{authorDoctorProfile.bio}</p>
                  )}

                  {/* Social links */}
                  {(authorSocial.website || authorSocial.twitter || authorSocial.linkedin || authorSocial.instagram) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {authorSocial.website && (
                        <a href={authorSocial.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Globe className="w-3 h-3" /> Web
                        </a>
                      )}
                      {authorSocial.twitter && (
                        <a href={authorSocial.twitter.startsWith('http') ? authorSocial.twitter : `https://twitter.com/${authorSocial.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Twitter className="w-3 h-3" /> Twitter
                        </a>
                      )}
                      {authorSocial.linkedin && (
                        <a href={authorSocial.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Linkedin className="w-3 h-3" /> LinkedIn
                        </a>
                      )}
                      {authorSocial.instagram && (
                        <a href={authorSocial.instagram.startsWith('http') ? authorSocial.instagram : `https://instagram.com/${authorSocial.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Instagram className="w-3 h-3" /> Instagram
                        </a>
                      )}
                    </div>
                  )}

                  {/* View profile button - only for approved doctors */}
                  {authorDoctorProfile && (
                    <div className="mt-2">
                      <Link to={`/doctor/${authorProfile.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <User className="w-3 h-3" /> Ver perfil
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            Comentarios ({getTotalCommentCount(comments)})
          </h2>

          {/* New comment */}
          {isAuthenticated ? (
            <div className="flex gap-3 mb-6">
              <Avatar className="w-8 h-8 mt-1 shrink-0">
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
                  <Button size="sm" onClick={() => handleSubmitComment(null)} disabled={isSending || !newComment.trim()}>
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

          {/* Comments list - threaded */}
          <div className="space-y-1">
            {comments.map((comment) => renderComment(comment))}
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sé el primero en comentar</p>
            )}
          </div>
        </section>
      </article>
    </MainLayout>
  );
}
