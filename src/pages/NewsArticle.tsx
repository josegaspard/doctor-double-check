import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import DOMPurify from 'dompurify';
import { format, formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  ArrowLeft, Clock, Share2, MessageCircle, Send, Loader2,
  Trash2, Stethoscope, User, GraduationCap, Facebook, Twitter, Link as LinkIcon,
  Globe, Instagram, Linkedin, Pencil, ChevronDown,
  Star, MapPin, Users, Edit, LogIn, Eye, Heart, Languages
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
  is_approved_doctor?: boolean;
  replies?: Comment[];
  likes_count?: number;
  liked_by_me?: boolean;
}

export default function NewsArticle() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, role, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === 'es' ? es : enUS;
  const [article, setArticle] = useState<any>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [authorDoctorProfile, setAuthorDoctorProfile] = useState<any>(null);
  const [authorRole, setAuthorRole] = useState<string | null>(null);
  const [editorProfile, setEditorProfile] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [likingComments, setLikingComments] = useState<Set<string>>(new Set());
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Translation state
  const [translatedContent, setTranslatedContent] = useState<{ title: string; content: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);

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
        supabase.rpc('increment_news_view', { news_id: data.id }).then(() => {});
        fetchComments(data.id);
        const { data: authorP } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .eq('id', data.created_by)
          .maybeSingle();
        setAuthorProfile(authorP);

        const { data: doctorP } = await supabase
          .from('doctor_profiles_public')
          .select('*')
          .eq('user_id', data.created_by)
          .maybeSingle();
        setAuthorDoctorProfile(doctorP);

        const { data: roleData } = await supabase
          .from('user_roles' as any)
          .select('role')
          .eq('user_id', data.created_by)
          .maybeSingle();
        setAuthorRole((roleData as any)?.role || 'patient');
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
    const commentIds = commentsData.map(c => c.id);

    const [{ data: profiles }, { data: roles }, { data: doctorProfiles }, { data: likesData }, myLikesResult] = await Promise.all([
      supabase.from('profiles_public').select('id, name, avatar_url').in('id', userIds),
      supabase.from('user_roles' as any).select('user_id, role').in('user_id', userIds),
      supabase.from('doctor_profiles_public').select('user_id, status').in('user_id', userIds),
      supabase.from('news_comment_likes' as any).select('comment_id').in('comment_id', commentIds),
      user ? supabase.from('news_comment_likes' as any).select('comment_id').eq('user_id', user.id).in('comment_id', commentIds) : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const roleMap = new Map((roles as any[])?.map((r: any) => [r.user_id, r.role]) || []);
    const approvedDoctorSet = new Set(
      (doctorProfiles as any[])?.filter((d: any) => d.status === 'approved').map((d: any) => d.user_id) || []
    );

    const likesCountMap = new Map<string, number>();
    (likesData as any[])?.forEach((l: any) => {
      likesCountMap.set(l.comment_id, (likesCountMap.get(l.comment_id) || 0) + 1);
    });
    const myLikedSet = new Set((myLikesResult?.data as any[])?.map((l: any) => l.comment_id) || []);

    const enriched = commentsData.map(c => ({
      ...c,
      parent_comment_id: (c as any).parent_comment_id || null,
      user_name: profileMap.get(c.user_id)?.name || 'Usuario',
      user_avatar: profileMap.get(c.user_id)?.avatar_url || null,
      user_role: roleMap.get(c.user_id) || 'patient',
      is_approved_doctor: approvedDoctorSet.has(c.user_id),
      likes_count: likesCountMap.get(c.id) || 0,
      liked_by_me: myLikedSet.has(c.id),
      replies: [] as Comment[],
    }));

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
    const threadsWithReplies = rootComments.filter(c => (c.replies?.length || 0) > 0).map(c => c.id);
    setCollapsedThreads(new Set(threadsWithReplies));
  };

  const handleSubmitComment = async () => {
    const content = newComment;
    if (!content.trim() || !user || !article) return;
    setIsSending(true);
    const insertData: any = { news_id: article.id, user_id: user.id, content: content.trim() };
    if (replyTo) insertData.parent_comment_id = replyTo.id;
    const { error } = await supabase.from('news_comments').insert(insertData);
    if (error) { toast.error(t('ads.commentError')); setIsSending(false); return; }
    setNewComment('');
    setReplyTo(null);
    fetchComments(article.id);
    setIsSending(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('news_comments').delete().eq('id', commentId);
    if (error) { toast.error(t('common.error')); return; }
    if (article) fetchComments(article.id);
  };

  const handleToggleLike = async (commentId: string, isLiked: boolean) => {
    if (!user || !article) return;
    setLikingComments(prev => new Set(prev).add(commentId));
    try {
      if (isLiked) {
        await supabase.from('news_comment_likes' as any).delete().eq('user_id', user.id).eq('comment_id', commentId);
      } else {
        await supabase.from('news_comment_likes' as any).insert({ user_id: user.id, comment_id: commentId });
      }
      await fetchComments(article.id);
    } catch { /* ignore */ }
    setLikingComments(prev => { const n = new Set(prev); n.delete(commentId); return n; });
  };

  const handleReply = (comment: Comment) => {
    const rootId = comment.parent_comment_id || comment.id;
    setReplyTo({ id: rootId, name: comment.user_name || 'Usuario' });
    setNewComment(`@${comment.user_name} `);
    setTimeout(() => commentInputRef.current?.focus(), 50);
  };

  const toggleThread = (commentId: string) => {
    setCollapsedThreads(prev => {
      const next = new Set(prev);
      next.has(commentId) ? next.delete(commentId) : next.add(commentId);
      return next;
    });
  };

  const handleTranslate = async () => {
    if (!article) return;
    
    if (showTranslated && translatedContent) {
      setShowTranslated(false);
      return;
    }

    if (translatedContent) {
      setShowTranslated(true);
      return;
    }

    setIsTranslating(true);
    try {
      const targetLang = language === 'es' ? 'en' : 'es';
      const { data, error } = await supabase.functions.invoke('translate-news', {
        body: { title: article.title, content: article.content, targetLang },
      });

      if (error) throw error;
      if (data?.title && data?.content) {
        setTranslatedContent({ title: data.title, content: data.content });
        setShowTranslated(true);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('Translation error:', err);
      toast.error(t('ads.translateError'));
    } finally {
      setIsTranslating(false);
    }
  };

  const getRoleBadge = (userRole: string) => {
    switch (userRole) {
      case 'doctor': return <Badge variant="default" className="text-[10px] gap-0.5 h-4 px-1.5"><Stethoscope className="w-2.5 h-2.5" />{t('common.doctor')}</Badge>;
      case 'resident': return <Badge variant="secondary" className="text-[10px] gap-0.5 h-4 px-1.5"><GraduationCap className="w-2.5 h-2.5" />{t('common.resident')}</Badge>;
      default: return null;
    }
  };

  const getRelativeTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: dateLocale });
  };

  const getTotalCommentCount = useCallback((comments: Comment[]): number => {
    return comments.reduce((acc, c) => acc + 1 + getTotalCommentCount(c.replies || []), 0);
  }, []);

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isCollapsed = collapsedThreads.has(comment.id);
    const hasReplies = (comment.replies?.length || 0) > 0;
    const maxDepth = 1;
    const isLiking = likingComments.has(comment.id);

    return (
      <div key={comment.id} className={depth > 0 ? 'ml-5 sm:ml-8' : ''}>
        <div className="flex gap-2.5 py-2.5 group">
          <div className="relative flex flex-col items-center">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={comment.user_avatar || ''} />
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">{comment.user_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            {hasReplies && !isCollapsed && (
              <div className="w-[2px] bg-border flex-1 mt-1 min-h-[8px]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {comment.is_approved_doctor ? (
                <Link to={`/doctor/${comment.user_id}`} className="font-semibold text-[13px] text-foreground hover:text-primary transition-colors">
                  {comment.user_name}
                </Link>
              ) : (
                <span className="font-semibold text-[13px] text-foreground">{comment.user_name}</span>
              )}
              {getRoleBadge(comment.user_role || 'patient')}
              <span className="text-[11px] text-muted-foreground">· {getRelativeTime(comment.created_at)}</span>
            </div>

            <p className="text-[13px] text-foreground/90 mt-0.5 whitespace-pre-wrap leading-snug">{comment.content}</p>

            <div className="flex items-center gap-3 mt-1">
              <button
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                onClick={() => isAuthenticated && handleToggleLike(comment.id, !!comment.liked_by_me)}
                disabled={!isAuthenticated || isLiking}
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-all ${comment.liked_by_me ? 'fill-destructive text-destructive scale-110' : ''}`}
                />
                {(comment.likes_count || 0) > 0 && (
                  <span className={comment.liked_by_me ? 'text-destructive font-medium' : ''}>{comment.likes_count}</span>
                )}
              </button>

              {isAuthenticated && depth < maxDepth && (
                <button
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleReply(comment)}
                >
                  {t('ads.reply')}
                </button>
              )}

              {user?.id === comment.user_id && (
                <button
                  className="text-[11px] text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => handleDeleteComment(comment.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {hasReplies && isCollapsed && (
              <button
                className="flex items-center gap-1.5 mt-2 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
                onClick={() => toggleThread(comment.id)}
              >
                <div className="w-6 h-[1px] bg-border" />
                {t('ads.viewReplies')} {comment.replies!.length} {comment.replies!.length === 1 ? t('ads.replySingular') : t('ads.repliesPlural')}
              </button>
            )}
          </div>
        </div>

        {hasReplies && !isCollapsed && (
          <div>
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
            <button
              className="ml-10 sm:ml-[3.25rem] text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-1"
              onClick={() => toggleThread(comment.id)}
            >
              <ChevronDown className="w-3 h-3 inline mr-1 rotate-180" />
              {t('ads.hideReplies')}
            </button>
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
          <h2 className="text-xl font-semibold mb-4">{t('ads.newsArticleNotFound')}</h2>
          <Link to="/news"><Button variant="outline" className="hidden sm:inline-flex"><ArrowLeft className="w-4 h-4 mr-2" /> {t('ads.backToNews')}</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const canEdit = article && user && (user.id === article.created_by || role === 'admin');
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = article?.title || '';
  const authorSocial = article?.author_social || {};

  const displayTitle = showTranslated && translatedContent ? translatedContent.title : article.title;
  const displayContent = showTranslated && translatedContent ? translatedContent.content : article.content;

  return (
    <MainLayout>
      <article className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <Link to="/news" className="hidden sm:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {t('ads.backToNews')}
          </Link>
          <div className="flex items-center gap-2">
            {/* Translate button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleTranslate}
              disabled={isTranslating}
            >
              {isTranslating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              {isTranslating ? t('ads.translating') : showTranslated ? t('ads.showOriginal') : t('ads.translateArticle')}
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/news', { state: { editId: article.id } })}>
                <Edit className="w-3.5 h-3.5" /> {t('ads.editArticle')}
              </Button>
            )}
          </div>
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
            {format(new Date(article.published_at || article.created_at), "d 'de' MMMM, yyyy", { locale: dateLocale })}
          </span>
          {article.view_count > 0 && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {article.view_count} {t('ads.readings')}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-3">{displayTitle}</h1>
        {article.summary && <p className="text-lg text-muted-foreground mb-6">{article.summary}</p>}

        {/* Translation indicator */}
        {showTranslated && (
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-primary/5 rounded-md px-3 py-2 border border-primary/20">
            <Languages className="w-3 h-3 text-primary" />
            <span>{language === 'es' ? 'Translated to English' : 'Traducido al español'}</span>
            <button className="ml-auto text-primary hover:underline" onClick={() => setShowTranslated(false)}>
              {t('ads.showOriginal')}
            </button>
          </div>
        )}

        {/* Edit History Badge */}
        {article.last_edited_at && (
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
            <Pencil className="w-3 h-3" />
            <span>
              {t('ads.editedOn')} {format(new Date(article.last_edited_at), "d 'de' MMMM yyyy, HH:mm", { locale: dateLocale })}
              {editorProfile && <> {t('ads.by')} <strong className="text-foreground">{editorProfile.name}</strong></>}
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
                    <Badge variant="outline" className="text-[10px]">{t('ads.author')}</Badge>
                    {authorRole && getRoleBadge(authorRole)}
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
                          {authorDoctorProfile.total_consultations} {t('ads.consultationsLabel')}
                        </span>
                      )}
                      {authorDoctorProfile.followers_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {authorDoctorProfile.followers_count} {t('ads.followersLabel')}
                        </span>
                      )}
                      {authorDoctorProfile.consultation_fee > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t('ads.consultationFee')} ${Number(authorDoctorProfile.consultation_fee).toFixed(0)} MXN
                        </Badge>
                      )}
                      {authorDoctorProfile.consultation_fee === 0 && (
                        <Badge variant="default" className="text-[10px]">
                          {t('ads.freeConsultation')}
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

                  {/* View profile button */}
                  {authorDoctorProfile && (
                    <div className="mt-2">
                      <Link to={`/doctor/${authorProfile.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <User className="w-3 h-3" /> {t('ads.viewProfileBtn')}
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
        <div className="flex items-center gap-2.5 mb-6 flex-wrap">
          <span className="text-sm text-muted-foreground mr-1 flex items-center gap-1.5"><Share2 className="w-4 h-4" />{t('ads.shareLabel')}</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors duration-200"
            onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'width=600,height=400,noopener,noreferrer')}
          >
            <Facebook className="w-3.5 h-3.5" /> Facebook
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-black hover:text-white hover:border-black transition-colors duration-200"
            onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank', 'width=600,height=400,noopener,noreferrer')}
          >
            <Twitter className="w-3.5 h-3.5" /> X
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-green-600 border-green-300 hover:bg-green-500 hover:text-white hover:border-green-500 transition-colors duration-200"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`, '_blank', 'noopener,noreferrer')}
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors duration-200"
            onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success(t('ads.linkCopied')); }}
          >
            <LinkIcon className="w-3.5 h-3.5" /> {t('ads.copy')}
          </Button>
        </div>

        <Separator className="mb-6" />

        {/* Content */}
        <div
          className="news-article-content"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayContent) }}
        />

        <Separator className="my-8" />

        {/* Comments */}
        <section>
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            {t('ads.commentsTitle')}
          </h2>
          <p className="text-[13px] text-muted-foreground mb-4">
            {getTotalCommentCount(comments)} {getTotalCommentCount(comments) === 1 ? t('ads.comment') : t('ads.commentsPlural')}
          </p>

          <div className="divide-y divide-border/50">
            {comments.map((comment) => renderComment(comment))}
          </div>

          {comments.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageCircle className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground text-sm">{t('ads.noComments')}</p>
              <p className="text-muted-foreground text-xs mt-1">{t('ads.beFirstComment')}</p>
            </div>
          )}

          {isAuthenticated ? (
            <div className="sticky bottom-0 bg-background pt-3 pb-2 border-t border-border mt-4">
              {replyTo && (
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs text-muted-foreground">
                    {t('ads.replyingTo')} <span className="font-medium text-foreground">@{replyTo.name}</span>
                  </span>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setReplyTo(null); setNewComment(''); }}
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={user?.avatarUrl || ''} />
                  <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 relative">
                  <input
                    ref={commentInputRef}
                    type="text"
                    placeholder={t('ads.addComment')}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) { e.preventDefault(); handleSubmitComment(); } }}
                    maxLength={2000}
                    className="w-full bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground py-2"
                  />
                </div>
                {newComment.trim() && (
                  <button
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 shrink-0"
                    onClick={() => handleSubmitComment()}
                    disabled={isSending}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('ads.publish')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-border mt-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('ads.loginToComment')}</span>
                <Link to="/login">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8">
                    <LogIn className="w-3.5 h-3.5" />
                    {t('nav.login')}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </section>
      </article>
    </MainLayout>
  );
}
