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
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

const getAudienceLabel = (audience: string) => {
  switch (audience) {
    case 'professionals':
      return 'Profesionales';
    case 'patients':
      return 'Pacientes';
    default:
      return 'Todos';
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

export default function DoctorContentLibrary() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [contents, setContents] = useState<DoctorContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewContent, setPreviewContent] = useState<DoctorContent | null>(null);

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
      toast.error('Error al cargar contenido');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  // Block non-doctors
  if (role !== 'doctor' && role !== 'admin') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-heading text-xl font-bold mb-2">Acceso restringido</h2>
            <p className="text-muted-foreground mb-4">Solo los médicos pueden ver su biblioteca de contenido.</p>
            <Button onClick={() => navigate('/')}>Volver al inicio</Button>
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

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('doctor_content')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setContents(prev => prev.filter(c => c.id !== deleteId));
      toast.success('Contenido eliminado');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Error al eliminar contenido');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleView = (content: DoctorContent) => {
    setPreviewContent(content);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Mi Biblioteca de Contenido
            </h1>
            <p className="text-muted-foreground mt-1">
              {contents.length} expedientes subidos
            </p>
          </div>
          
          <Link to="/doctor/upload">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Subir Contenido
            </Button>
          </Link>
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
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tipo de archivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="pdf">PDFs</SelectItem>
              <SelectItem value="image">Imágenes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredContents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredContents.map((content) => (
              <Card key={content.id} className="group overflow-hidden hover:shadow-lg transition-all">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                  {content.thumbnail_url ? (
                    <img 
                      src={content.thumbnail_url} 
                      alt={content.title}
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
                  
                  {/* Visibility Badge */}
                  <div className="absolute top-2 right-2">
                    {content.is_public ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        Público
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted">
                        <Lock className="w-3 h-3 mr-1" />
                        Privado
                      </Badge>
                    )}
                  </div>
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
                  
                  <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(new Date(content.created_at), "d MMM yyyy", { locale: es })}
                    
                    <span className="mx-1">•</span>
                    
                    <span className="flex items-center gap-1">
                      {getAudienceIcon(content.audience_type)}
                      {getAudienceLabel(content.audience_type)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {content.price > 0 ? (
                      <Badge variant="secondary" className="text-premium">
                        ${content.price}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-success">
                        Gratis
                      </Badge>
                    )}
                    
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleView(content)}
                      >
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay contenido
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || typeFilter !== 'all' 
                ? 'No se encontró contenido con esos filtros'
                : 'Aún no has subido ningún contenido'}
            </p>
            <Link to="/doctor/upload">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Subir mi primer contenido
              </Button>
            </Link>
          </Card>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contenido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El contenido será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
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
