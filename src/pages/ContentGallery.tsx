import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContentPreviewModal } from '@/components/content/ContentPreviewModal';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Search,
  Filter,
  Clock,
  Users,
  Stethoscope,
  Globe,
  Loader2,
  Library,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface DoctorContent {
  id: string;
  title: string;
  description: string | null;
  type: 'video' | 'pdf' | 'image';
  file_url: string;
  thumbnail_url: string | null;
  is_public: boolean;
  price: number;
  audience_type: 'all' | 'patients' | 'professionals';
  category: string | null;
  created_at: string;
  creator_id: string;
  creator_name?: string;
  creator_avatar?: string;
  creator_specialty?: string;
}

const getAudienceIcon = (audience: string) => {
  switch (audience) {
    case 'professionals':
      return <Stethoscope className="w-3 h-3" />;
    case 'patients':
      return <Users className="w-3 h-3" />;
    default:
      return <Globe className="w-3 h-3" />;
  }
};

const getAudienceLabel = (audience: string, t: any) => {
  switch (audience) {
    case 'professionals':
      return t('content.professionals');
    case 'patients':
      return t('content.patients');
    default:
      return t('content.all');
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'video':
      return <Video className="w-5 h-5" />;
    case 'pdf':
      return <FileText className="w-5 h-5" />;
    case 'image':
      return <ImageIcon className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
};

export default function ContentGallery() {
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  const [contents, setContents] = useState<DoctorContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [previewContent, setPreviewContent] = useState<DoctorContent | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const fetchContents = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch public content based on RLS policies
      const { data, error } = await supabase
        .from('doctor_content')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique creator IDs
      const creatorIds = [...new Set((data || []).map(c => c.creator_id))];
      
      // Use public views to avoid exposing sensitive data
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name, avatar_url')
        .in('id', creatorIds);
      
      // Use public view for doctor specialties
      const { data: doctorProfiles } = await supabase
        .from('doctor_profiles_public')
        .select('user_id, specialty')
        .in('user_id', creatorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const specialtyMap = new Map(doctorProfiles?.map(d => [d.user_id, d.specialty]) || []);
      
      // Get unique categories
      const uniqueCategories = [...new Set((data || []).map(c => c.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);

      setContents((data || []).map(c => ({
        ...c,
        type: c.type as 'video' | 'pdf' | 'image',
        audience_type: c.audience_type as 'all' | 'patients' | 'professionals',
        creator_name: profileMap.get(c.creator_id)?.name,
        creator_avatar: profileMap.get(c.creator_id)?.avatar_url,
        creator_specialty: specialtyMap.get(c.creator_id),
      })));
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const filteredContents = contents.filter(content => {
    const matchesSearch = content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.creator_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || content.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || content.category === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" />
            {t('content.library')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('content.explore')}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('content.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('content.all')}</SelectItem>
              <SelectItem value="video">{t('content.videos')}</SelectItem>
              <SelectItem value="pdf">{t('content.pdfs')}</SelectItem>
              <SelectItem value="image">{t('content.images')}</SelectItem>
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t('content.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('content.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

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
                className="group overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setPreviewContent(content)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                  {content.thumbnail_url ? (
                    <img 
                      src={content.thumbnail_url} 
                      alt={content.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-primary/40">
                      {getTypeIcon(content.type)}
                    </div>
                  )}
                  
                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="gap-1 capitalize">
                      {getTypeIcon(content.type)}
                      {content.type}
                    </Badge>
                  </div>
                  
                  {/* Audience Badge */}
                  {content.audience_type !== 'all' && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="bg-background/80">
                        {getAudienceIcon(content.audience_type)}
                        <span className="ml-1">{getAudienceLabel(content.audience_type, t)}</span>
                      </Badge>
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
                    {content.title}
                  </h3>
                  
                  {content.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {content.description}
                    </p>
                  )}
                  
                  {/* Doctor Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={content.creator_avatar || undefined} />
                      <AvatarFallback><User className="w-3 h-3" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{content.creator_name}</p>
                      {content.creator_specialty && (
                        <p className="text-xs text-muted-foreground truncate">{content.creator_specialty}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(content.created_at), "d MMM yyyy", { locale })}
                    </span>
                    {content.category && (
                      <Badge variant="outline" className="text-xs">
                        {content.category}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Library className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('content.noContent')}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
                ? t('content.noContentFilters')
                : t('content.noContentUploaded')}
            </p>
          </Card>
        )}
      </div>

      {/* Content Preview Modal */}
      <ContentPreviewModal
        isOpen={!!previewContent}
        onClose={() => setPreviewContent(null)}
        content={previewContent}
      />
    </MainLayout>
  );
}
