import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exportToCSV } from '@/lib/exportAdData';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLives, Recording } from '@/contexts/LivesContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useIsMobile } from '@/hooks/use-mobile';
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
  CheckSquare,
  Square,
  Heart,
  MessageSquare,
  Sparkles,
  Radio,
  Download,
  Upload,
  ImageIcon,
} from 'lucide-react';

interface RecordingStats {
  recordingId: string;
  purchaseCount: number;
  totalRevenue: number;
  // Live data (if recording came from a live)
  peakViewers: number;
  likesCount: number;
  totalComments: number;
  paidComments: number;
  chatPrice: number;
  paidChatRevenue: number;
}

interface PastLive {
  id: string;
  title: string;
  specialty: string;
  startedAt: Date;
  endedAt: Date | null;
  peakViewers: number;
  likesCount: number;
  totalComments: number;
  paidComments: number;
  chatPrice: number;
  paidRevenue: number;
}

export default function DoctorRecordings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { refreshRecordings } = useLives();
  const isMobile = useIsMobile();

  // Tab from URL param
  const initialTab = searchParams.get('tab') === 'lives-pasados' ? 'lives-pasados' : 'grabaciones';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  const [recordingStats, setRecordingStats] = useState<Map<string, RecordingStats>>(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Past Lives
  const [pastLives, setPastLives] = useState<PastLive[]>([]);
  const [isLoadingPastLives, setIsLoadingPastLives] = useState(true);
  
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

  // Thumbnail Edit Dialog
  const [thumbnailDialogOpen, setThumbnailDialogOpen] = useState(false);
  const [thumbnailRecording, setThumbnailRecording] = useState<Recording | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Bulk Selection (Recordings)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk Selection (Past Lives)
  const [plSelectionMode, setPlSelectionMode] = useState(false);
  const [selectedPastLiveIds, setSelectedPastLiveIds] = useState<Set<string>>(new Set());
  const [plBulkDeleteDialogOpen, setPlBulkDeleteDialogOpen] = useState(false);
  const [isPlBulkDeleting, setIsPlBulkDeleting] = useState(false);
  const [plDeleteSingleId, setPlDeleteSingleId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showFilters, setShowFilters] = useState(false);

  const priceRangeInitializedRef = useRef(false);
  const [isPriceRangeReady, setIsPriceRangeReady] = useState(false);

  // Fetch recordings directly from Supabase for doctor's own recordings
  const fetchMyRecordings = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingRecordings(true);
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching recordings:', error);
        return;
      }

      if (data) {
        setRecordings(data.map(r => ({
          id: r.id,
          liveId: r.live_id || undefined,
          title: r.title,
          description: r.description || undefined,
          doctorId: r.doctor_id,
          doctorName: user.name || 'Doctor',
          specialty: r.specialty,
          duration: r.duration,
          price: Number(r.price),
          thumbnailUrl: r.thumbnail_url || undefined,
          videoUrl: r.video_url || undefined,
          createdAt: new Date(r.created_at),
          tags: r.tags || [],
        })));
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setIsLoadingRecordings(false);
    }
  }, [user?.id, user?.name]);

  // Fetch past lives (ended, without recording)
  const fetchPastLives = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingPastLives(true);
    try {
      // Get all ended lives for this doctor
      const { data: lives, error } = await supabase
        .from('lives')
        .select('id, title, specialty, started_at, ended_at, peak_viewers, likes_count, chat_price, paid_chats_count')
        .eq('doctor_id', user.id)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false });

      if (error) {
        console.error('Error fetching past lives:', error);
        return;
      }

      if (!lives || lives.length === 0) {
        setPastLives([]);
        return;
      }

      // Get recordings to filter out lives that have recordings
      const { data: recs } = await supabase
        .from('recordings')
        .select('live_id')
        .eq('doctor_id', user.id);

      const recordedLiveIds = new Set((recs || []).map(r => r.live_id).filter(Boolean));

      // Only show lives WITHOUT recordings
      const unrecordedLives = lives.filter(l => !recordedLiveIds.has(l.id));

      // Get comment counts for these lives
      const liveIds = unrecordedLives.map(l => l.id);
      
      let commentCounts: Record<string, number> = {};
      let paidCommentCounts: Record<string, number> = {};

      if (liveIds.length > 0) {
        const { count: _totalCount, data: commentData } = await supabase
          .from('live_chat_messages')
          .select('live_id', { count: 'exact' })
          .in('live_id', liveIds);

        // Count per live_id
        if (commentData) {
          commentData.forEach(msg => {
            commentCounts[msg.live_id] = (commentCounts[msg.live_id] || 0) + 1;
          });
        }

        const { data: paidData } = await supabase
          .from('live_chat_messages')
          .select('live_id')
          .in('live_id', liveIds)
          .eq('is_paid', true);

        if (paidData) {
          paidData.forEach(msg => {
            paidCommentCounts[msg.live_id] = (paidCommentCounts[msg.live_id] || 0) + 1;
          });
        }
      }

      setPastLives(unrecordedLives.map(l => {
        const paidCount = paidCommentCounts[l.id] || 0;
        const chatPrice = Number(l.chat_price) || 0;
        return {
          id: l.id,
          title: l.title,
          specialty: l.specialty,
          startedAt: new Date(l.started_at),
          endedAt: l.ended_at ? new Date(l.ended_at) : null,
          peakViewers: l.peak_viewers || 0,
          likesCount: l.likes_count || 0,
          totalComments: commentCounts[l.id] || 0,
          paidComments: paidCount,
          chatPrice,
          paidRevenue: paidCount * chatPrice,
        };
      }));
    } catch (error) {
      console.error('Error fetching past lives:', error);
    } finally {
      setIsLoadingPastLives(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMyRecordings();
    fetchPastLives();
  }, [fetchMyRecordings, fetchPastLives]);

  // Auto-recover orphan recording files. If a previous live's MediaRecorder
  // upload succeeded but the DB row never got created (RLS / JWT mid-live),
  // this scans the doctor's storage folder and creates the missing rows.
  useEffect(() => {
    if (!user?.id || role !== 'doctor') return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('scan-orphan-recordings');
        if (cancelled || error) return;
        if (data?.recovered > 0) {
          toast.success(`${data.recovered} grabación(es) recuperada(s) automáticamente`);
          await fetchMyRecordings();
          await refreshRecordings();
        }
      } catch {
        // best-effort, no UI noise on failure
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, role, fetchMyRecordings, refreshRecordings]);

  const allRecordings = recordings;
  
  const specialties = [...new Set(allRecordings.map(r => r.specialty))];
  
  const numericPrices = allRecordings
    .map(r => Number(r.price))
    .filter((p) => Number.isFinite(p));
  const maxPrice = numericPrices.length > 0 ? Math.max(...numericPrices) : 1000;

  useEffect(() => {
    if (priceRangeInitializedRef.current) return;
    if (allRecordings.length === 0) return;
    setPriceRange([0, maxPrice]);
    priceRangeInitializedRef.current = true;
    setIsPriceRangeReady(true);
  }, [allRecordings.length, maxPrice]);

  const myRecordings = allRecordings.filter(recording => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = recording.title.toLowerCase().includes(query);
      const matchesTags = recording.tags.some((tag: string) => tag.toLowerCase().includes(query));
      if (!matchesTitle && !matchesTags) return false;
    }
    if (specialtyFilter !== 'all' && recording.specialty !== specialtyFilter) return false;
    if (dateFrom && recording.createdAt < dateFrom) return false;
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (recording.createdAt > endOfDay) return false;
    }
    if (isPriceRangeReady) {
      if (recording.price < priceRange[0] || recording.price > priceRange[1]) return false;
    }
    return true;
  });

  const hasActiveFilters =
    searchQuery ||
    specialtyFilter !== 'all' ||
    dateFrom ||
    dateTo ||
    (isPriceRangeReady ? (priceRange[0] > 0 || priceRange[1] < maxPrice) : false);

  const clearFilters = () => {
    setSearchQuery('');
    setSpecialtyFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setPriceRange([0, maxPrice]);
  };

  useEffect(() => {
    if (role !== 'doctor') {
      navigate('/lives');
    }
  }, [role, navigate]);

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
        recordingIds.forEach(id => {
          statsMap.set(id, { recordingId: id, purchaseCount: 0, totalRevenue: 0, peakViewers: 0, likesCount: 0, totalComments: 0, paidComments: 0, chatPrice: 0, paidChatRevenue: 0 });
        });
        purchases?.forEach(purchase => {
          const existing = statsMap.get(purchase.recording_id!);
          if (existing) {
            existing.purchaseCount += 1;
            existing.totalRevenue += Number(purchase.amount);
          }
        });

        // Fetch live data for recordings that have a liveId
        const liveIds = myRecordings.filter(r => r.liveId).map(r => r.liveId!);
        if (liveIds.length > 0) {
          const { data: liveData } = await supabase
            .from('lives')
            .select('id, peak_viewers, likes_count, chat_price, paid_chats_count')
            .in('id', liveIds);

          // Fetch comment counts
          const { data: allComments } = await supabase
            .from('live_chat_messages')
            .select('live_id')
            .in('live_id', liveIds);

          const { data: paidMsgs } = await supabase
            .from('live_chat_messages')
            .select('live_id')
            .in('live_id', liveIds)
            .eq('is_paid', true);

          const commentsByLive: Record<string, number> = {};
          allComments?.forEach(m => { commentsByLive[m.live_id] = (commentsByLive[m.live_id] || 0) + 1; });
          const paidByLive: Record<string, number> = {};
          paidMsgs?.forEach(m => { paidByLive[m.live_id] = (paidByLive[m.live_id] || 0) + 1; });

          // Map live data to recording stats
          const liveMap = new Map(liveData?.map(l => [l.id, l]) || []);
          myRecordings.forEach(rec => {
            if (rec.liveId && liveMap.has(rec.liveId)) {
              const live = liveMap.get(rec.liveId)!;
              const stat = statsMap.get(rec.id);
              if (stat) {
                stat.peakViewers = live.peak_viewers || 0;
                stat.likesCount = live.likes_count || 0;
                stat.chatPrice = Number(live.chat_price) || 0;
                stat.paidComments = paidByLive[rec.liveId] || live.paid_chats_count || 0;
                stat.totalComments = commentsByLive[rec.liveId] || 0;
                stat.paidChatRevenue = stat.paidComments * stat.chatPrice;
              }
            }
          });
        }

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

  const deleteRecordingFully = async (recording: Recording) => {
    // 1. Delete video file from storage. Supports two video_url shapes:
    //    a) "storage:<path>" — internal ref produced by daily-webhook / end-daily-room
    //    b) full https URL pointing at /storage/v1/object/public/recordings/<path>
    if (recording.videoUrl) {
      try {
        let filePath: string | null = null;
        if (recording.videoUrl.startsWith('storage:')) {
          filePath = recording.videoUrl.replace(/^storage:/, '');
        } else {
          const url = new URL(recording.videoUrl);
          const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/recordings\/(.+)/);
          if (pathMatch?.[1]) filePath = decodeURIComponent(pathMatch[1]);
        }
        if (filePath) {
          await supabase.storage.from('recordings').remove([filePath]);
        }
      } catch (storageErr) {
        console.warn('Could not delete video file from storage:', storageErr);
      }
    }

    // 2. Delete associated doctor_content entries
    if (recording.videoUrl) {
      await supabase
        .from('doctor_content')
        .delete()
        .eq('creator_id', user?.id)
        .eq('file_url', recording.videoUrl);
    }

    // 3. Delete the recording from DB. Use count to detect RLS / ownership mismatch
    //    (silent 0-row deletes were previously masking failures).
    const { error, count } = await supabase
      .from('recordings')
      .delete({ count: 'exact' })
      .eq('id', recording.id)
      .eq('doctor_id', user?.id);

    if (error) throw error;
    if (!count || count === 0) {
      throw new Error('No se pudo eliminar: la grabación no te pertenece o ya fue eliminada');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecording) return;
    setIsDeleting(true);
    try {
      await deleteRecordingFully(deletingRecording);
      setRecordings(prev => prev.filter(r => r.id !== deletingRecording.id));
      toast.success('Grabación eliminada correctamente');
      setDeleteDialogOpen(false);
      setDeletingRecording(null);
      await refreshRecordings();
    } catch (error: any) {
      console.error('Error deleting recording:', error);
      toast.error(error.message || 'Error al eliminar la grabación');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk selection handlers
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(myRecordings.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const toDelete = recordings.filter(r => selectedIds.has(r.id));
      await Promise.all(toDelete.map(r => deleteRecordingFully(r)));
      setRecordings(prev => prev.filter(r => !selectedIds.has(r.id)));
      toast.success(`${toDelete.length} grabación(es) eliminada(s) por completo`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      setBulkDeleteDialogOpen(false);
      await refreshRecordings();
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      toast.error('Error al eliminar algunas grabaciones');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleViewStats = (recording: Recording) => {
    setSelectedRecording(recording);
    setStatsDialogOpen(true);
  };

  // Thumbnail edit handlers
  const handleEditThumbnail = (recording: Recording) => {
    setThumbnailRecording(recording);
    setThumbnailPreview(recording.thumbnailUrl || null);
    setThumbnailFile(null);
    setThumbnailDialogOpen(true);
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveThumbnail = async () => {
    if (!thumbnailRecording || !thumbnailFile || !user?.id) return;
    setIsSavingThumbnail(true);
    try {
      const ext = thumbnailFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${thumbnailRecording.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('thumbnails').upload(path, thumbnailFile, { contentType: thumbnailFile.type, upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      const { error: dbErr } = await supabase.from('recordings').update({ thumbnail_url: publicUrl }).eq('id', thumbnailRecording.id);
      if (dbErr) throw dbErr;
      setRecordings(prev => prev.map(r => r.id === thumbnailRecording.id ? { ...r, thumbnailUrl: publicUrl } : r));
      toast.success(t('recordings.coverUpdated'));
      setThumbnailDialogOpen(false);
    } catch (err: any) {
      toast.error(t('recordings.coverError') + ': ' + (err.message || 'Error'));
    } finally {
      setIsSavingThumbnail(false);
    }
  };

  // ========== Past Lives Handlers ==========
  const togglePlSelectionMode = () => {
    if (plSelectionMode) setSelectedPastLiveIds(new Set());
    setPlSelectionMode(!plSelectionMode);
  };
  const togglePlSelect = (id: string) => {
    setSelectedPastLiveIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllPl = () => setSelectedPastLiveIds(new Set(pastLives.map(l => l.id)));
  const deselectAllPl = () => setSelectedPastLiveIds(new Set());

  const deletePastLive = async (id: string) => {
    // Delete related chat messages first, then the live
    await supabase.from('live_chat_messages').delete().eq('live_id', id);
    await supabase.from('live_likes').delete().eq('live_id', id);
    const { error } = await supabase.from('lives').delete().eq('id', id).eq('doctor_id', user?.id);
    if (error) throw error;
  };

  const handleDeleteSinglePastLive = async () => {
    if (!plDeleteSingleId) return;
    setIsPlBulkDeleting(true);
    try {
      await deletePastLive(plDeleteSingleId);
      setPastLives(prev => prev.filter(l => l.id !== plDeleteSingleId));
      toast.success('Live eliminado');
      setPlDeleteSingleId(null);
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar');
    } finally {
      setIsPlBulkDeleting(false);
    }
  };

  const handleBulkDeletePastLives = async () => {
    if (selectedPastLiveIds.size === 0) return;
    setIsPlBulkDeleting(true);
    try {
      await Promise.all([...selectedPastLiveIds].map(id => deletePastLive(id)));
      setPastLives(prev => prev.filter(l => !selectedPastLiveIds.has(l.id)));
      toast.success(`${selectedPastLiveIds.size} live(s) eliminado(s)`);
      setSelectedPastLiveIds(new Set());
      setPlSelectionMode(false);
      setPlBulkDeleteDialogOpen(false);
    } catch (e: any) {
      toast.error('Error al eliminar algunos lives');
    } finally {
      setIsPlBulkDeleting(false);
    }
  };

  const pastLiveToCSVRow = (l: PastLive) => ({
    Título: l.title,
    Especialidad: l.specialty,
    'Fecha inicio': l.startedAt.toISOString(),
    'Fecha fin': l.endedAt?.toISOString() || '',
    'Pico espectadores': l.peakViewers,
    Likes: l.likesCount,
    'Comentarios totales': l.totalComments,
    'Comentarios de pago': l.paidComments,
    'Precio chat': l.chatPrice,
    'Ingresos chats': l.paidRevenue,
  });

  const downloadPastLives = (lives: PastLive[]) => {
    exportToCSV(lives.map(pastLiveToCSVRow), `lives-pasados-${new Date().toISOString().slice(0, 10)}`);
  };

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return 'Procesando...';
    const totalMinutes = Math.floor(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN',
    }).format(amount);
  };

  const getStats = (recordingId: string): RecordingStats => {
    return recordingStats.get(recordingId) || { recordingId, purchaseCount: 0, totalRevenue: 0, peakViewers: 0, likesCount: 0, totalComments: 0, paidComments: 0, chatPrice: 0, paidChatRevenue: 0 };
  };

  const getCombinedRevenue = (recordingId: string) => {
    const s = getStats(recordingId);
    return s.totalRevenue + s.paidChatRevenue;
  };

  const totalRecordings = myRecordings.length;
  const totalPurchases = myRecordings.reduce((sum, r) => {
    const stats = recordingStats.get(r.id);
    return sum + (stats?.purchaseCount || 0);
  }, 0);
  const totalVideoRevenue = myRecordings.reduce((sum, r) => {
    const stats = recordingStats.get(r.id);
    return sum + (stats?.totalRevenue || 0);
  }, 0);
  const totalChatRevenue = myRecordings.reduce((sum, r) => {
    const stats = recordingStats.get(r.id);
    return sum + (stats?.paidChatRevenue || 0);
  }, 0);
  const totalRevenue = totalVideoRevenue + totalChatRevenue;
  const totalDuration = myRecordings.reduce((sum, r) => sum + r.duration, 0);

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/doctor/dashboard')} className="hidden sm:flex">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Mis Grabaciones
            </h1>
            <p className="text-muted-foreground">
              Gestiona tus grabaciones y revisa el historial de lives
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="grabaciones" className="gap-2">
              <Video className="w-4 h-4" />
              Grabaciones
            </TabsTrigger>
            <TabsTrigger value="lives-pasados" className="gap-2">
              <Radio className="w-4 h-4" />
              Lives pasados
            </TabsTrigger>
          </TabsList>

          {/* ==================== GRABACIONES TAB ==================== */}
          <TabsContent value="grabaciones" className="space-y-6">
            {/* Selection mode banner */}
            {selectionMode && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} grabación(es) seleccionada(s)`
                    : 'Toca las grabaciones que deseas eliminar'}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectedIds.size === myRecordings.length ? deselectAll : selectAll}>
                    {selectedIds.size === myRecordings.length ? 'Deseleccionar' : 'Todas'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleSelectionMode}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Video className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg sm:text-2xl font-bold text-foreground">{totalRecordings}</p>
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
                      <p className="text-lg sm:text-2xl font-bold text-foreground">{totalPurchases}</p>
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
                      <p className="text-lg sm:text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">Ingresos totales</p>
                      {(totalVideoRevenue > 0 || totalChatRevenue > 0) && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Video: {formatCurrency(totalVideoRevenue)} · Chats: {formatCurrency(totalChatRevenue)}
                        </p>
                      )}
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
                      <p className="text-lg sm:text-2xl font-bold text-foreground">{formatDuration(totalDuration)}</p>
                      <p className="text-xs text-muted-foreground">Duración Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={t('inputs.searchByTitleTags')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
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
                  <Button 
                    variant={showFilters ? "secondary" : "outline"} 
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Filtros
                    {hasActiveFilters && (
                      <Badge variant="default" className="ml-1 h-5 w-5 p-0 justify-center">!</Badge>
                    )}
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="icon" onClick={clearFilters}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                {showFilters && (
                  <div className="mt-4 pt-4 border-t grid md:grid-cols-3 gap-4">
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
                          <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
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
                          <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
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
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Badge variant="secondary">
                        {myRecordings.length} de {allRecordings.length}
                      </Badge>
                    )}
                    {myRecordings.length > 0 && (
                      <Button
                        variant={selectionMode ? "default" : "outline"}
                        size="sm"
                        onClick={toggleSelectionMode}
                        className="gap-1.5"
                      >
                        {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {selectionMode ? 'Cancelar' : 'Seleccionar'}
                      </Button>
                    )}
                  </div>
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
                ) : isMobile ? (
                  /* Mobile: Card layout */
                  <div className="space-y-3">
                    {myRecordings.map((recording) => {
                      const stats = getStats(recording.id);
                      const isSelected = selectedIds.has(recording.id);
                      return (
                        <div
                          key={recording.id}
                          className={`p-3 border rounded-lg transition-colors ${
                            selectionMode
                              ? isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-card'
                              : 'border-border bg-card'
                          }`}
                          onClick={selectionMode ? () => toggleSelect(recording.id) : undefined}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {selectionMode && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(recording.id)}
                                  className="mt-0.5"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground line-clamp-1">{recording.title}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <Badge variant="secondary" className="text-[10px] h-5">{recording.specialty}</Badge>
                                  {recording.tags.slice(0, 2).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-[10px] h-5">#{tag}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {!selectionMode && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/recording/${recording.id}`)}>
                                    <Eye className="w-4 h-4 mr-2" />Ver grabación
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewStats(recording)}>
                                    <BarChart3 className="w-4 h-4 mr-2" />Estadísticas
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleEditPrice(recording)}>
                                    <Pencil className="w-4 h-4 mr-2" />Editar precio
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => handleEditThumbnail(recording)}>
                                     <ImageIcon className="w-4 h-4 mr-2" />{t('recordings.editCover')}
                                   </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(recording)}>
                                    <Trash2 className="w-4 h-4 mr-2" />Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {recording.videoUrl?.startsWith('pending:') ? 'Procesando…' : !recording.videoUrl ? 'Sin video' : formatDuration(recording.duration)}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {recording.price === 0 ? 'Gratis' : formatCurrency(recording.price)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {isLoadingStats ? '…' : stats.purchaseCount}
                            </span>
                            {!isLoadingStats && getCombinedRevenue(recording.id) > 0 && (
                              <span className="text-success font-medium ml-auto">
                                {formatCurrency(getCombinedRevenue(recording.id))}
                              </span>
                            )}
                          </div>
                          {!isLoadingStats && (stats.likesCount > 0 || stats.paidComments > 0) && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              {stats.likesCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3 h-3" /> {stats.likesCount}
                                </span>
                              )}
                              {stats.paidComments > 0 && (
                                <span className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> {stats.paidComments} de pago
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5">{formatDate(recording.createdAt)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Desktop: Table layout */
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          {selectionMode && <TableHead className="w-10"></TableHead>}
                          <TableHead>Grabación</TableHead>
                          <TableHead>Especialidad</TableHead>
                          <TableHead>Duración</TableHead>
                          <TableHead>Precio</TableHead>
                          <TableHead>Compras</TableHead>
                          <TableHead>Chats pago</TableHead>
                          <TableHead>Ingresos</TableHead>
                          <TableHead>Fecha</TableHead>
                          {!selectionMode && <TableHead className="w-12"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myRecordings.map((recording) => {
                          const stats = getStats(recording.id);
                          const isSelected = selectedIds.has(recording.id);
                          return (
                            <TableRow
                              key={recording.id}
                              className={`${selectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                              onClick={selectionMode ? () => toggleSelect(recording.id) : undefined}
                            >
                              {selectionMode && (
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleSelect(recording.id)}
                                  />
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {recording.thumbnailUrl ? (
                                    <img src={recording.thumbnailUrl} alt="" className="w-12 h-8 rounded object-cover" />
                                  ) : (
                                    <div className="w-12 h-8 rounded bg-muted flex items-center justify-center">
                                      <Play className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium line-clamp-1">{recording.title}</p>
                                    <div className="flex gap-1 mt-1">
                                      {recording.tags.slice(0, 2).map(tag => (
                                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="secondary">{recording.specialty}</Badge></TableCell>
                              <TableCell>
                                {recording.videoUrl?.startsWith('pending:') ? (
                                  <Badge variant="pending">Procesando…</Badge>
                                ) : !recording.videoUrl ? (
                                  <Badge variant="outline">Sin video</Badge>
                                ) : (
                                  formatDuration(recording.duration)
                                )}
                              </TableCell>
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
                                ) : stats.paidComments > 0 ? (
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-muted-foreground" />
                                    {stats.paidComments}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isLoadingStats ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <span className="text-success font-medium">
                                    {formatCurrency(getCombinedRevenue(recording.id))}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDate(recording.createdAt)}
                              </TableCell>
                              {!selectionMode && (
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => navigate(`/recording/${recording.id}`)}>
                                        <Eye className="w-4 h-4 mr-2" />Ver grabación
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleViewStats(recording)}>
                                        <BarChart3 className="w-4 h-4 mr-2" />Ver estadísticas
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleEditPrice(recording)}>
                                        <Pencil className="w-4 h-4 mr-2" />Editar precio
                                       </DropdownMenuItem>
                                       <DropdownMenuItem onClick={() => handleEditThumbnail(recording)}>
                                         <ImageIcon className="w-4 h-4 mr-2" />{t('recordings.editCover')}
                                       </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(recording)}>
                                        <Trash2 className="w-4 h-4 mr-2" />Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Floating bulk delete bar */}
            {selectionMode && selectedIds.size > 0 && (
              <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm mx-auto bg-destructive text-destructive-foreground px-4 py-2.5 rounded-xl shadow-2xl flex items-center justify-between animate-slide-in-bottom">
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{selectedIds.size} seleccionada(s)</span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-lg gap-1.5 text-xs h-8 px-3 shrink-0"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ==================== LIVES PASADOS TAB ==================== */}
          <TabsContent value="lives-pasados" className="space-y-6">
            {/* Past Lives Summary */}
            {pastLives.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-bold text-foreground">{pastLives.length}</p>
                        <p className="text-xs text-muted-foreground">Lives</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-bold text-foreground">
                          {Math.max(...pastLives.map(l => l.peakViewers), 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Pico espectadores</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-live/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-live" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-bold text-foreground">
                          {pastLives.reduce((s, l) => s + l.totalComments, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Comentarios</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-bold text-foreground">
                          {formatCurrency(pastLives.reduce((s, l) => s + l.paidRevenue, 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">Ingresos chats</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Selection mode banner */}
            {plSelectionMode && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {selectedPastLiveIds.size > 0
                    ? `${selectedPastLiveIds.size} live(s) seleccionado(s)`
                    : 'Toca los lives que deseas gestionar'}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectedPastLiveIds.size === pastLives.length ? deselectAllPl : selectAllPl}>
                    {selectedPastLiveIds.size === pastLives.length ? 'Deseleccionar' : 'Todos'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={togglePlSelectionMode}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Radio className="w-5 h-5" />
                    Lives pasados
                    {pastLives.length > 0 && (
                      <Badge variant="secondary">{pastLives.length}</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {pastLives.length > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPastLives(pastLives)}
                          className="gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          {!isMobile && 'Descargar todo'}
                        </Button>
                        <Button
                          variant={plSelectionMode ? "default" : "outline"}
                          size="sm"
                          onClick={togglePlSelectionMode}
                          className="gap-1.5"
                        >
                          {plSelectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          {plSelectionMode ? 'Cancelar' : 'Seleccionar'}
                        </Button>
                      </>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPastLives ? (
                  <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Cargando...
                  </div>
                ) : pastLives.length === 0 ? (
                  <div className="text-center py-12">
                    <Radio className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No hay lives pasados</h3>
                    <p className="text-muted-foreground">
                      Aquí aparecerán los lives que no fueron guardados como grabación
                    </p>
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {pastLives.map(live => {
                      const isSelected = selectedPastLiveIds.has(live.id);
                      return (
                      <div
                        key={live.id}
                        className={`p-4 border rounded-lg space-y-3 transition-colors ${
                          plSelectionMode
                            ? isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                            : 'border-border bg-card'
                        }`}
                        onClick={plSelectionMode ? () => togglePlSelect(live.id) : undefined}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {plSelectionMode && (
                              <Checkbox checked={isSelected} onCheckedChange={() => togglePlSelect(live.id)} className="mt-0.5" />
                            )}
                            <div>
                              <p className="font-semibold text-foreground">{live.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px] h-5">{live.specialty}</Badge>
                                <span className="text-xs text-muted-foreground">{formatDate(live.startedAt)}</span>
                              </div>
                            </div>
                          </div>
                          {!plSelectionMode && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => downloadPastLives([live])}>
                                  <Download className="w-4 h-4 mr-2" />Descargar CSV
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setPlDeleteSingleId(live.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" />Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold text-foreground">{live.peakViewers}</p>
                              <p className="text-[10px] text-muted-foreground">Pico</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <Heart className="w-3.5 h-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold text-foreground">{live.likesCount}</p>
                              <p className="text-[10px] text-muted-foreground">Likes</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold text-foreground">{live.totalComments}</p>
                              <p className="text-[10px] text-muted-foreground">Comentarios</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-bold text-foreground">{live.paidComments}</p>
                              <p className="text-[10px] text-muted-foreground">De pago</p>
                            </div>
                          </div>
                        </div>
                        {live.paidRevenue > 0 && (
                          <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-success/10 border border-success/20">
                            <DollarSign className="w-4 h-4 text-success" />
                            <span className="text-sm font-semibold text-success">
                              +{formatCurrency(live.paidRevenue)} en chats de pago
                            </span>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          {plSelectionMode && <TableHead className="w-10" />}
                          <TableHead>Live</TableHead>
                          <TableHead>Especialidad</TableHead>
                          <TableHead>Pico</TableHead>
                          <TableHead>Likes</TableHead>
                          <TableHead>Comentarios</TableHead>
                          <TableHead>De pago</TableHead>
                          <TableHead>Ingresos chats</TableHead>
                          <TableHead>Fecha</TableHead>
                          {!plSelectionMode && <TableHead className="w-10" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pastLives.map(live => {
                          const isSelected = selectedPastLiveIds.has(live.id);
                          return (
                          <TableRow
                            key={live.id}
                            className={`${plSelectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                            onClick={plSelectionMode ? () => togglePlSelect(live.id) : undefined}
                          >
                            {plSelectionMode && (
                              <TableCell>
                                <Checkbox checked={isSelected} onCheckedChange={() => togglePlSelect(live.id)} />
                              </TableCell>
                            )}
                            <TableCell>
                              <p className="font-medium line-clamp-1">{live.title}</p>
                            </TableCell>
                            <TableCell><Badge variant="secondary">{live.specialty}</Badge></TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3 text-muted-foreground" />
                                {live.peakViewers}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-muted-foreground" />
                                {live.likesCount}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-muted-foreground" />
                                {live.totalComments}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-muted-foreground" />
                                {live.paidComments}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`font-medium ${live.paidRevenue > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                                {formatCurrency(live.paidRevenue)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(live.startedAt)}
                            </TableCell>
                            {!plSelectionMode && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => downloadPastLives([live])}>
                                      <Download className="w-4 h-4 mr-2" />Descargar CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => setPlDeleteSingleId(live.id)}>
                                      <Trash2 className="w-4 h-4 mr-2" />Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Floating bulk action bar for past lives */}
            {plSelectionMode && selectedPastLiveIds.size > 0 && (
              <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md mx-auto bg-foreground text-background px-4 py-2.5 rounded-xl shadow-2xl flex items-center justify-between animate-slide-in-bottom">
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{selectedPastLiveIds.size} seleccionado(s)</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-lg gap-1.5 text-xs h-8 px-3 shrink-0"
                    onClick={() => {
                      const selected = pastLives.filter(l => selectedPastLiveIds.has(l.id));
                      downloadPastLives(selected);
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-lg gap-1.5 text-xs h-8 px-3 shrink-0"
                    onClick={() => setPlBulkDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>


      {/* Edit Price Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Precio</DialogTitle>
            <DialogDescription>{editingRecording?.title}</DialogDescription>
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
              {isSaving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>) : 'Guardar'}
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
              Esta acción no se puede deshacer. La grabación "{deletingRecording?.title}" será eliminada permanentemente junto con sus archivos y contenido asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</>) : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.size} grabación(es)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se eliminarán permanentemente las grabaciones seleccionadas, sus archivos de video y todo el contenido asociado de la plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</>) : `Eliminar ${selectedIds.size}`}
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
            <DialogDescription>{selectedRecording?.title}</DialogDescription>
          </DialogHeader>
          {selectedRecording && (() => {
            const recStats = getStats(selectedRecording.id);
            const combined = getCombinedRevenue(selectedRecording.id);
            const hasLiveData = recStats.peakViewers > 0 || recStats.totalComments > 0 || recStats.likesCount > 0;
            return (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Users className="w-6 h-6 mx-auto text-primary mb-1" />
                    <p className="text-xl font-bold">{recStats.purchaseCount}</p>
                    <p className="text-[10px] text-muted-foreground">Compras video</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="w-6 h-6 mx-auto text-success mb-1" />
                    <p className="text-xl font-bold">{formatCurrency(combined)}</p>
                    <p className="text-[10px] text-muted-foreground">Ingresos totales</p>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue breakdown */}
              {(recStats.totalRevenue > 0 || recStats.paidChatRevenue > 0) && (
                <div className="p-3 bg-success/5 border border-success/20 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-foreground">Desglose de ingresos</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ventas de video:</span>
                    <span className="font-medium">{formatCurrency(recStats.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Chats de pago:</span>
                    <span className="font-medium">{formatCurrency(recStats.paidChatRevenue)}</span>
                  </div>
                </div>
              )}

              {/* Live metrics */}
              {hasLiveData && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-foreground">Métricas del live</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> Pico:</span>
                      <span className="font-medium">{recStats.peakViewers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3" /> Likes:</span>
                      <span className="font-medium">{recStats.likesCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Comentarios:</span>
                      <span className="font-medium">{recStats.totalComments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><Sparkles className="w-3 h-3" /> De pago:</span>
                      <span className="font-medium">{recStats.paidComments}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Precio actual:</span>
                  <span className="font-medium">{selectedRecording.price === 0 ? 'Gratis' : formatCurrency(selectedRecording.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duración:</span>
                  <span className="font-medium">{formatDuration(selectedRecording.duration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Especialidad:</span>
                  <span className="font-medium">{selectedRecording.specialty}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha:</span>
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
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Single Past Live Delete Dialog */}
      <AlertDialog open={!!plDeleteSingleId} onOpenChange={(open) => { if (!open) setPlDeleteSingleId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este live?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente el registro del live, sus mensajes de chat y likes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPlBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSinglePastLive}
              disabled={isPlBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPlBulkDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</>) : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Past Lives Delete Dialog */}
      <AlertDialog open={plBulkDeleteDialogOpen} onOpenChange={setPlBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedPastLiveIds.size} live(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente los registros seleccionados, incluyendo mensajes de chat y likes. Esta acción es irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPlBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeletePastLives}
              disabled={isPlBulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPlBulkDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</>) : `Eliminar ${selectedPastLiveIds.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Thumbnail Edit Dialog */}
      <Dialog open={thumbnailDialogOpen} onOpenChange={setThumbnailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('recordings.editCover')}</DialogTitle>
            <DialogDescription>
              {t('recordings.editCoverDesc')} "{thumbnailRecording?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {thumbnailPreview ? (
              <div className="relative group">
                <img src={thumbnailPreview} alt="Preview" className="w-full aspect-video object-cover rounded-lg border" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => thumbnailInputRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    {t('recordings.changeImage')}
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => { setThumbnailPreview(null); setThumbnailFile(null); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('recordings.removeImage')}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className={`w-full aspect-video rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all ${
                  isDraggingThumbnail
                    ? 'border-primary bg-primary/10 scale-[1.02]'
                    : 'border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-primary/5'
                }`}
                onClick={() => thumbnailInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingThumbnail(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingThumbnail(false); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation(); setIsDraggingThumbnail(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    setThumbnailFile(file);
                    setThumbnailPreview(URL.createObjectURL(file));
                  }
                }}
              >
                <div className="text-center text-muted-foreground p-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">
                    {isDraggingThumbnail ? t('recordings.dragActive') : t('recordings.dragOrClick')}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{t('recordings.maxSize')}</p>
                </div>
              </div>
            )}
          </div>
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleThumbnailFileChange}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setThumbnailDialogOpen(false)} className="w-full sm:w-auto">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveThumbnail}
              disabled={!thumbnailFile || isSavingThumbnail}
              className="w-full sm:w-auto"
            >
              {isSavingThumbnail ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('recordings.savingCover')}</>) : t('recordings.saveCover')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
