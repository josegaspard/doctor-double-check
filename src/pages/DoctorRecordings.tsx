import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLives, Recording } from '@/contexts/LivesContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Slider } from '@/components/ui/slider';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Video,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  Play,
  BarChart3,
  Loader2,
  Search,
  Filter,
  X,
  CalendarIcon,
} from 'lucide-react';

interface RecordingStats {
  recordingId: string;
  purchaseCount: number;
  totalRevenue: number;
}

export default function DoctorRecordings() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { getRecordingsByDoctor, refreshRecordings } = useLives();

  const [recordingStats, setRecordingStats] = useState<Map<string, RecordingStats>>(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRecording, setDeletingRecording] = useState<Recording | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Stats Dialog
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);

  const allRecordings = getRecordingsByDoctor(user?.id || '');
  
  // Get unique specialties from recordings
  const specialties = [...new Set(allRecordings.map(r => r.specialty))];
  
  // Get max price for slider
  const maxPrice = Math.max(...allRecordings.map(r => r.price), 1000);

  // Apply filters
  const myRecordings = allRecordings.filter(recording => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = recording.title.toLowerCase().includes(query);
      const matchesTags = recording.tags.some(tag => tag.toLowerCase().includes(query));
      if (!matchesTitle && !matchesTags) return false;
    }
    
    // Specialty filter
    if (specialtyFilter !== 'all' && recording.specialty !== specialtyFilter) {
      return false;
    }
    
    // Date range filter
    if (dateFrom && recording.createdAt < dateFrom) {
      return false;
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (recording.createdAt > endOfDay) {
        return false;
      }
    }
    
    // Price range filter
    if (recording.price < priceRange[0] || recording.price > priceRange[1]) {
      return false;
    }
    
    return true;
  });

  const hasActiveFilters = searchQuery || specialtyFilter !== 'all' || dateFrom || dateTo || priceRange[0] > 0 || priceRange[1] < maxPrice;

  const clearFilters = () => {
    setSearchQuery('');
    setSpecialtyFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPriceRange([0, maxPrice]);
  };

  // Redirect if not doctor
  useEffect(() => {
    if (role !== 'doctor') {
      navigate('/lives');
    }
  }, [role, navigate]);

  // Fetch recording stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id || myRecordings.length === 0) {
        setIsLoadingStats(false);
        return;
      }

      try {
        const recordingIds = myRecordings.map(r => r.id);
        
        const { data: purchases } = await supabase
          .from('purchases')
          .select('recording_id, amount')
          .in('recording_id', recordingIds);

        const statsMap = new Map<string, RecordingStats>();
        
        // Initialize all recordings with 0 stats
        recordingIds.forEach(id => {
          statsMap.set(id, { recordingId: id, purchaseCount: 0, totalRevenue: 0 });
        });

        // Aggregate purchase data
        purchases?.forEach(purchase => {
          const existing = statsMap.get(purchase.recording_id);
          if (existing) {
            existing.purchaseCount += 1;
            existing.totalRevenue += Number(purchase.amount);
          }
        });

        setRecordingStats(statsMap);
      } catch (error) {
        console.error('Error fetching recording stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [user?.id, myRecordings.length]);

  const handleEditPrice = (recording: Recording) => {
    setEditingRecording(recording);
    setEditPrice(recording.price.toString());
    setEditDialogOpen(true);
  };

  const handleSavePrice = async () => {
    if (!editingRecording) return;
    
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error('El precio debe ser un número válido mayor o igual a 0');
      return;
    }

    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('recordings')
        .update({ price: newPrice })
        .eq('id', editingRecording.id)
        .eq('doctor_id', user?.id);

      if (error) throw error;

      toast.success('Precio actualizado correctamente');
      setEditDialogOpen(false);
      setEditingRecording(null);
      await refreshRecordings();
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar el precio');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (recording: Recording) => {
    setDeletingRecording(recording);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecording) return;

    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', deletingRecording.id)
        .eq('doctor_id', user?.id);

      if (error) throw error;

      toast.success('Grabación eliminada correctamente');
      setDeleteDialogOpen(false);
      setDeletingRecording(null);
      await refreshRecordings();
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar la grabación');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewStats = (recording: Recording) => {
    setSelectedRecording(recording);
    setStatsDialogOpen(true);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getStats = (recordingId: string) => {
    return recordingStats.get(recordingId) || { purchaseCount: 0, totalRevenue: 0 };
  };

  // Calculate totals (from filtered results)
  const totalRecordings = myRecordings.length;
  const totalPurchases = myRecordings.reduce((sum, r) => {
    const stats = recordingStats.get(r.id);
    return sum + (stats?.purchaseCount || 0);
  }, 0);
  const totalRevenue = myRecordings.reduce((sum, r) => {
    const stats = recordingStats.get(r.id);
    return sum + (stats?.totalRevenue || 0);
  }, 0);
  const totalDuration = myRecordings.reduce((sum, r) => sum + r.duration, 0);

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/doctor/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Mis Grabaciones
            </h1>
            <p className="text-muted-foreground">
              Gestiona tus grabaciones, precios y estadísticas
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalRecordings}</p>
                  <p className="text-xs text-muted-foreground">Grabaciones</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalPurchases}</p>
                  <p className="text-xs text-muted-foreground">Compras</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-premium/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-premium" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatDuration(totalDuration)}</p>
                  <p className="text-xs text-muted-foreground">Duración Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título o tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Specialty Filter */}
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Especialidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las especialidades</SelectItem>
                  {specialties.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Toggle Advanced Filters */}
              <Button 
                variant={showFilters ? "secondary" : "outline"} 
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Filtros
                {hasActiveFilters && (
                  <Badge variant="default" className="ml-1 h-5 w-5 p-0 justify-center">
                    !
                  </Badge>
                )}
              </Button>
              
              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t grid md:grid-cols-3 gap-4">
                {/* Date From */}
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, 'dd MMM yyyy', { locale: es }) : 'Seleccionar fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Date To */}
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, 'dd MMM yyyy', { locale: es }) : 'Seleccionar fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Price Range */}
                <div className="space-y-2">
                  <Label>Rango de precio: {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}</Label>
                  <Slider
                    value={priceRange}
                    onValueChange={(value) => setPriceRange(value as [number, number])}
                    max={maxPrice}
                    step={10}
                    className="mt-3"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recordings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Grabaciones
              </span>
              {hasActiveFilters && (
                <Badge variant="secondary">
                  {myRecordings.length} de {allRecordings.length} grabaciones
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myRecordings.length === 0 ? (
              <div className="text-center py-12">
                <Video className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No tienes grabaciones</h3>
                <p className="text-muted-foreground mb-4">
                  Las grabaciones se crean automáticamente al terminar un live
                </p>
                <Button onClick={() => navigate('/doctor/dashboard')}>
                  Ir al Dashboard
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grabación</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Compras</TableHead>
                      <TableHead>Ingresos</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRecordings.map((recording) => {
                      const stats = getStats(recording.id);
                      return (
                        <TableRow key={recording.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-8 rounded bg-muted flex items-center justify-center">
                                <Play className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium line-clamp-1">{recording.title}</p>
                                <div className="flex gap-1 mt-1">
                                  {recording.tags.slice(0, 2).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{recording.specialty}</Badge>
                          </TableCell>
                          <TableCell>{formatDuration(recording.duration)}</TableCell>
                          <TableCell>
                            {recording.price === 0 ? (
                              <Badge variant="success">Gratis</Badge>
                            ) : (
                              formatCurrency(recording.price)
                            )}
                          </TableCell>
                          <TableCell>
                            {isLoadingStats ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                {stats.purchaseCount}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isLoadingStats ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <span className="text-success font-medium">
                                {formatCurrency(stats.totalRevenue)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(recording.createdAt)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/recording/${recording.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver grabación
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewStats(recording)}>
                                  <BarChart3 className="w-4 h-4 mr-2" />
                                  Ver estadísticas
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditPrice(recording)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar precio
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeleteClick(recording)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Price Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Precio</DialogTitle>
            <DialogDescription>
              {editingRecording?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="price">Precio (MXN)</Label>
            <div className="relative mt-2">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Establece 0 para hacer la grabación gratuita
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSavePrice} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grabación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La grabación "{deletingRecording?.title}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
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

      {/* Stats Dialog */}
      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Estadísticas
            </DialogTitle>
            <DialogDescription>
              {selectedRecording?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedRecording && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 mx-auto text-primary mb-2" />
                    <p className="text-2xl font-bold">
                      {getStats(selectedRecording.id).purchaseCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Compras totales</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-success mb-2" />
                    <p className="text-2xl font-bold">
                      {formatCurrency(getStats(selectedRecording.id).totalRevenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ingresos totales</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precio actual:</span>
                  <span className="font-medium">
                    {selectedRecording.price === 0 ? 'Gratis' : formatCurrency(selectedRecording.price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duración:</span>
                  <span className="font-medium">{formatDuration(selectedRecording.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Especialidad:</span>
                  <span className="font-medium">{selectedRecording.specialty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha de creación:</span>
                  <span className="font-medium">{formatDate(selectedRecording.createdAt)}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => {
                  setStatsDialogOpen(false);
                  handleEditPrice(selectedRecording);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar precio
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
