import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContentPreviewModal } from '@/components/content/ContentPreviewModal';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Search,
  Filter,
  Plus,
  Trash2,
  Eye,
  Clock,
  Users,
  Stethoscope,
  Globe,
  Lock,
  Loader2,
  Settings2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

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
}

const getAudienceIcon = (audience: string) => {
  switch (audience) {
    case 'professionals': return <Stethoscope className="w-3 h-3" />;
    case 'patients': return <Users className="w-3 h-3" />;
    default: return <Globe className="w-3 h-3" />;
  }
};

const getAudienceLabel = (audience: string, t: (key: string) => string) => {
  switch (audience) {
    case 'professionals': return t('content.professionals');
    case 'patients': return t('content.patients');
    default: return t('content.all');
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'video': return <Video className="w-5 h-5" />;
    case 'pdf': return <FileText className="w-5 h-5" />;
    case 'image': return <ImageIcon className="w-5 h-5" />;
    default: return <FileText className="w-5 h-5" />;
  }
};

export default function DoctorContentLibrary() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  const [contents, setContents] = useState<DoctorContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewContent, setPreviewContent] = useState<DoctorContent | null>(null);

  // Bulk management
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
      setContents(data || []);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error(t('doctorLibrary.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => { fetchContents(); }, [fetchContents]);

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

  const filteredContents = contents.filter(content => {
    const matchesSearch = content.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || content.type === typeFilter;
    return matchesSearch && matchesType;
  });

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

    // Best-effort storage cleanup
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
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await deleteContent(id);
      }
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
    if (selectedIds.size === filteredContents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredContents.map(c => c.id)));
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Button variant="back" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {t('doctorLibrary.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {contents.length} {t('doctorLibrary.filesUploaded')}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {contents.length > 0 && (
              <Button
                variant={isManaging ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setIsManaging(!isManaging); setSelectedIds(new Set()); }}
                className="gap-1.5"
              >
                <Settings2 className="w-4 h-4" />
                {isManaging ? t('manage.done') : t('manage.manage')}
              </Button>
            )}
            <Link to="/doctor/upload">
              <Button className="gap-2" size="sm">
                <Plus className="w-4 h-4" />
                {t('doctorLibrary.uploadContent')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('inputs.searchByTitle')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('doctorLibrary.fileType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('doctorLibrary.allTypes')}</SelectItem>
              <SelectItem value="video">{t('doctorLibrary.videos')}</SelectItem>
              <SelectItem value="pdf">{t('doctorLibrary.pdfs')}</SelectItem>
              <SelectItem value="image">{t('doctorLibrary.images')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Manage bar */}
        {isManaging && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 sm:p-4 rounded-xl bg-card border border-primary/30 shadow-md ring-1 ring-primary/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-card-foreground">{t('manage.selectHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === filteredContents.length ? t('manage.deselectAll') : t('manage.selectAll')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setShowBulkDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('manage.deleteSelected')} ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}

        {/* Content Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredContents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredContents.map((content) => (
              <Card
                key={content.id}
                className={`group overflow-hidden hover:shadow-lg transition-all ${isManaging && selectedIds.has(content.id) ? 'ring-2 ring-primary' : ''}`}
                onClick={isManaging ? () => toggleSelect(content.id) : undefined}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                  {content.thumbnail_url ? (
                    <img src={content.thumbnail_url} alt={content.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-primary/40">{getTypeIcon(content.type)}</div>
                  )}
                  
                  {/* Selection checkbox overlay */}
                  {isManaging && (
                    <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(content.id)}
                        onCheckedChange={() => toggleSelect(content.id)}
                        className="bg-background/80 backdrop-blur-sm"
                      />
                    </div>
                  )}
                  
                  {/* Type Badge */}
                  <div className={`absolute ${isManaging ? 'top-2 left-8' : 'top-2 left-2'}`}>
                    <Badge variant="secondary" className="gap-1 capitalize">
                      {getTypeIcon(content.type)}
                      {content.type}
                    </Badge>
                  </div>
                  
                  {/* Visibility Badge */}
                  <div className="absolute top-2 right-2">
                    {content.is_public ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        {t('doctorLibrary.public')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted">
                        <Lock className="w-3 h-3 mr-1" />
                        {t('doctorLibrary.private')}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground line-clamp-2 mb-2">{content.title}</h3>
                  
                  {content.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{content.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(new Date(content.created_at), "d MMM yyyy", { locale })}
                    <span className="mx-1">•</span>
                    <span className="flex items-center gap-1">
                      {getAudienceIcon(content.audience_type)}
                      {getAudienceLabel(content.audience_type, t)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {content.price > 0 ? (
                      <Badge variant="secondary" className="text-premium">${content.price}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-success">{t('doctorLibrary.free')}</Badge>
                    )}
                    
                    {!isManaging && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setPreviewContent(content)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(content.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('doctorLibrary.noContent')}</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || typeFilter !== 'all' ? t('doctorLibrary.noContentFilters') : t('doctorLibrary.noContentYet')}
            </p>
            <Link to="/doctor/upload">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t('doctorLibrary.uploadFirst')}
              </Button>
            </Link>
          </Card>
        )}

        {/* Sticky mobile bottom bar */}
        {isManaging && selectedIds.size > 0 && (
          <div className="fixed bottom-16 sm:bottom-4 left-0 right-0 z-50 px-3 pb-safe">
            <div className="max-w-4xl mx-auto bg-destructive text-destructive-foreground rounded-lg p-3 flex items-center justify-between shadow-lg">
              <span className="text-sm font-medium">
                {selectedIds.size} {t('manage.selected')}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('manage.deleteSelected')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('doctorLibrary.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('doctorLibrary.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('doctorLibrary.deleting')}</>
              ) : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('manage.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('manage.confirmDeleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('manage.deleting')}</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />{t('common.delete')} ({selectedIds.size})</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Content Preview Modal */}
      <ContentPreviewModal
        isOpen={!!previewContent}
        onClose={() => setPreviewContent(null)}
        content={previewContent}
      />
    </MainLayout>
  );
}
