import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  ArrowLeft,
  Mail,
  Paperclip,
  Send,
  MessageSquare,
  Image,
  Video,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Report {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string | null;
  reason: string;
  description: string | null;
  subject: string | null;
  contact_email: string | null;
  attachment_urls: string[] | null;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter?: { name: string; email: string } | null;
}

const STATUS_CONFIG = {
  pending: { labelKey: 'adminReports.status.pending', variant: 'warning' as const, icon: Clock },
  reviewed: { labelKey: 'adminReports.status.reviewed', variant: 'info' as const, icon: Eye },
  resolved: { labelKey: 'adminReports.status.resolved', variant: 'success' as const, icon: CheckCircle },
  dismissed: { labelKey: 'adminReports.status.dismissed', variant: 'secondary' as const, icon: XCircle },
};

const CONTENT_TYPE_KEYS: Record<string, string> = {
  live: 'adminReports.contentType.live',
  recording: 'adminReports.contentType.recording',
  doctor: 'adminReports.contentType.doctor',
  chat_message: 'adminReports.contentType.chatMessage',
  platform_report: 'adminReports.contentType.platformReport',
};

const REASON_KEYS: Record<string, string> = {
  bug: 'adminReports.reason.bug',
  abuse: 'adminReports.reason.abuse',
  other: 'adminReports.reason.other',
};

export default function AdminReports() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(t('adminReports.toast.accessDenied'));
    }
  }, [role, navigate]);

  useEffect(() => {
    if (role === 'admin') fetchReports();
  }, [role, filterStatus]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      const reporterIds = [...new Set(data?.map(r => r.reporter_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', reporterIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      const reportsWithReporter = data?.map(r => ({
        ...r,
        reporter: profileMap.get(r.reporter_id) || null,
      })) || [];

      setReports(reportsWithReporter as Report[]);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error(t('adminReports.toast.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateReport = async () => {
    if (!selectedReport || !newStatus) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status: newStatus,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', selectedReport.id);
      if (error) throw error;

      // Send notification to reporter if there's a response
      if (adminResponse.trim() && selectedReport.reporter_id) {
        await supabase.from('notifications').insert({
          user_id: selectedReport.reporter_id,
          type: 'system' as any,
          title: t('adminReports.notification.responseTitle'),
          message: adminResponse.trim(),
          data: { report_id: selectedReport.id },
        });
      }

      toast.success(t('adminReports.toast.updated'));
      setSelectedReport(null);
      setAdminResponse('');
      fetchReports();
    } catch (error) {
      toast.error(t('adminReports.toast.updateError'));
    } finally {
      setIsUpdating(false);
    }
  };

  const isMediaFile = (url: string) => {
    const lower = url.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg)/.test(lower);
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-3 hidden sm:inline-flex">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('adminReports.backToAdmin')}
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold text-foreground truncate">
                {t('adminReports.title')}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t('adminReports.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('adminReports.filter.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminReports.filter.all')}</SelectItem>
              <SelectItem value="pending">{t('adminReports.filter.pending')}</SelectItem>
              <SelectItem value="reviewed">{t('adminReports.filter.reviewed')}</SelectItem>
              <SelectItem value="resolved">{t('adminReports.filter.resolved')}</SelectItem>
              <SelectItem value="dismissed">{t('adminReports.filter.dismissed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reports List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Flag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">{t('adminReports.empty.title')}</h3>
              <p className="text-muted-foreground">
                {t('adminReports.empty.description')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(report => {
              const statusConfig = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG];
              const StatusIcon = statusConfig?.icon || Clock;
              
              return (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Subject line */}
                        {report.subject && (
                          <p className="font-semibold text-sm mb-1 line-clamp-1">{report.subject}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant={statusConfig?.variant || 'secondary'} className="text-[10px]">
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig?.labelKey ? t(statusConfig.labelKey) : report.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {CONTENT_TYPE_KEYS[report.content_type] ? t(CONTENT_TYPE_KEYS[report.content_type]) : report.content_type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {REASON_KEYS[report.reason] ? t(REASON_KEYS[report.reason]) : report.reason}
                          </span>
                        </div>

                        {report.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {report.description}
                          </p>
                        )}

                        {/* Attachment indicators */}
                        {report.attachment_urls && report.attachment_urls.length > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {report.attachment_urls.length} {t('adminReports.attachments.suffix')}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{report.reporter?.name || t('adminReports.defaultUser')}</span>
                          {report.contact_email && (
                            <span className="flex items-center gap-0.5">
                              <Mail className="w-3 h-3" />
                              {report.contact_email}
                            </span>
                          )}
                          <span>
                            {format(new Date(report.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminNotes(report.admin_notes || '');
                          setNewStatus(report.status);
                          setAdminResponse('');
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {t('adminReports.review')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('adminReports.dialog.title')}</DialogTitle>
              <DialogDescription>
                {t('adminReports.dialog.subtitle')}
              </DialogDescription>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4">
                {/* Report details */}
                {selectedReport.subject && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('adminReports.dialog.subject')}</Label>
                    <p className="font-medium">{selectedReport.subject}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('adminReports.dialog.type')}</Label>
                    <p className="text-sm">{REASON_KEYS[selectedReport.reason] ? t(REASON_KEYS[selectedReport.reason]) : selectedReport.reason}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('adminReports.dialog.reportedBy')}</Label>
                    <p className="text-sm">{selectedReport.reporter?.name || t('adminReports.defaultUser')}</p>
                    <p className="text-xs text-muted-foreground">{selectedReport.reporter?.email}</p>
                  </div>
                </div>

                {selectedReport.contact_email && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('adminReports.dialog.contactEmail')}</Label>
                    <p className="text-sm flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {selectedReport.contact_email}
                    </p>
                  </div>
                )}

                {selectedReport.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('adminReports.dialog.descriptionLabel')}</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                      {selectedReport.description}
                    </p>
                  </div>
                )}

                {/* Attachments preview */}
                {selectedReport.attachment_urls && selectedReport.attachment_urls.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      {t('adminReports.dialog.attachments')} ({selectedReport.attachment_urls.length})
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedReport.attachment_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors group"
                        >
                          {isMediaFile(url) ? (
                            <img src={url} alt={`${t('adminReports.dialog.attachmentAlt')} ${i + 1}`} className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 bg-muted flex items-center justify-center">
                              <Video className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{t('adminReports.dialog.newStatus')}</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t('adminReports.status.pending')}</SelectItem>
                      <SelectItem value="reviewed">{t('adminReports.status.reviewed')}</SelectItem>
                      <SelectItem value="resolved">{t('adminReports.status.resolved')}</SelectItem>
                      <SelectItem value="dismissed">{t('adminReports.status.dismissed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Admin notes (internal) */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">{t('adminReports.dialog.internalNotes')}</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={t('adminReports.dialog.internalNotesPlaceholder')}
                    rows={2}
                  />
                </div>

                {/* Admin response to user */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {t('adminReports.dialog.respondLabel')}
                  </Label>
                  <Textarea
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder={t('adminReports.dialog.respondPlaceholder')}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setSelectedReport(null)} className="w-full sm:w-auto">
                {t('adminReports.dialog.cancel')}
              </Button>
              <Button onClick={handleUpdateReport} disabled={isUpdating} className="w-full sm:w-auto gap-1.5">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('adminReports.dialog.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
