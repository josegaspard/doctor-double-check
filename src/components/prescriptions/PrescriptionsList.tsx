import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { exportPrescriptionToPDF } from '@/lib/generatePrescriptionPDF';
import { fetchDoctorCredentials } from '@/lib/doctorCredentials';
import { FileText, Download, Loader2, Pill, ChevronRight, Image, Trash2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientAge?: string;
  diagnosis?: string;
  medications: any[];
  instructions?: string;
  notes?: string;
  doctorId?: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicense: string;
  doctorCedula?: string;
  signedAt: Date;
  createdAt: Date;
  fileUrl?: string;
}

export function PrescriptionsList() {
  const navigate = useNavigate();
  const { supabaseUser, role } = useAuth();
  const { language, t } = useLanguage();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!supabaseUser?.id) return;

      const query = supabase
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'doctor') {
        query.eq('doctor_id', supabaseUser.id);
      } else {
        query.eq('patient_id', supabaseUser.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setPrescriptions(data.map(p => ({
          id: p.id,
          patientId: p.patient_id,
          patientName: p.patient_name,
          patientAge: p.patient_age || undefined,
          diagnosis: p.diagnosis || undefined,
          medications: (p.medications as any[]) || [],
          instructions: p.instructions || undefined,
          notes: p.notes || undefined,
          doctorId: p.doctor_id,
          doctorName: p.doctor_name,
          doctorSpecialty: p.doctor_specialty,
          doctorLicense: p.doctor_license,
          doctorCedula: p.doctor_cedula || undefined,
          signedAt: new Date(p.signed_at),
          createdAt: new Date(p.created_at),
          fileUrl: (p as any).file_url || undefined,
        })));
      }
      setIsLoading(false);
    };
    fetch();
  }, [supabaseUser?.id, role]);

  const handleDownload = async (rx: Prescription) => {
    // Abrimos la ventana YA, de forma síncrona con el clic, para que el bloqueador
    // de popups no la mate al llegar el await de las credenciales.
    const printWindow = window.open('', '_blank');
    // Traemos las credenciales completas del médico que firmó la receta para que
    // el membrete salga completo (universidad, hospital, cédulas…), incluso en
    // recetas antiguas donde sólo se guardó nombre/especialidad/licencia.
    const credentials = await fetchDoctorCredentials(rx.doctorId);
    exportPrescriptionToPDF({
      id: rx.id,
      patientName: rx.patientName,
      patientAge: rx.patientAge,
      diagnosis: rx.diagnosis,
      medications: rx.medications,
      instructions: rx.instructions,
      notes: rx.notes,
      doctorName: rx.doctorName,
      doctorSpecialty: credentials.doctorSpecialty || rx.doctorSpecialty,
      doctorLicense: credentials.doctorLicense || rx.doctorLicense,
      doctorCedula: credentials.doctorCedula || rx.doctorCedula,
      doctorNumeroConsejo: credentials.doctorNumeroConsejo,
      doctorUniversity: credentials.doctorUniversity,
      doctorHospital: credentials.doctorHospital,
      doctorCofepris: credentials.doctorCofepris,
      signedAt: rx.signedAt,
    }, printWindow);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === prescriptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prescriptions.map(r => r.id)));
    }
  };

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);

    try {
      const ids = Array.from(selectedIds);
      const toDelete = prescriptions.filter(r => selectedIds.has(r.id));

      // Delete DB records first
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .in('id', ids);

      if (error) throw error;

      // Best-effort storage cleanup
      for (const rx of toDelete) {
        if (rx.fileUrl) {
          const path = extractStoragePath(rx.fileUrl);
          if (path) {
            await supabase.storage.from('prescriptions').remove([path]).catch(() => {});
          }
        }
      }

      setPrescriptions(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setIsManaging(false);
      toast.success(t('manage.deleted'));
    } catch (error: any) {
      console.error('Error deleting prescriptions:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (prescriptions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Pill className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">
            {t('autoI18n.prescList1')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const canManage = role === 'doctor' || role === 'patient' || role === 'resident';

  return (
    <div className="space-y-3">
      {/* Manage bar */}
      {canManage && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant={isManaging ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setIsManaging(!isManaging);
              setSelectedIds(new Set());
            }}
            className="gap-1.5"
          >
            <Settings2 className="w-4 h-4" />
            {isManaging ? t('manage.done') : t('manage.manage')}
          </Button>

          {isManaging && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedIds.size === prescriptions.length ? t('manage.deselectAll') : t('manage.selectAll')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setShowDeleteDialog(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('manage.deleteSelected')} ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>
      )}

      {isManaging && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-primary/30 shadow-sm ring-1 ring-primary/10">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-card-foreground">{t('manage.selectHint')}</p>
        </div>
      )}

      {prescriptions.map(rx => (
        <Card 
          key={rx.id} 
          className={`hover:shadow-md transition-shadow cursor-pointer group ${isManaging && selectedIds.has(rx.id) ? 'ring-2 ring-primary' : ''}`}
          onClick={() => isManaging ? toggleSelect(rx.id) : navigate(`/prescriptions/${rx.id}`)}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {isManaging && (
                  <div className="pt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(rx.id)}
                      onCheckedChange={() => toggleSelect(rx.id)}
                    />
                  </div>
                )}
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {rx.fileUrl ? <Image className="w-6 h-6 text-info" /> : <FileText className="w-6 h-6 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-base inline-flex items-center gap-1 min-w-0 group-hover:text-primary transition-colors">
                    <span className="truncate">{role === 'doctor' ? rx.patientName : rx.doctorName}</span>
                    {role !== 'doctor' && <DoctorBadgeIcon userId={rx.doctorId} size="sm" className="flex-shrink-0" />}
                  </p>
                  {rx.diagnosis && (
                    <p className="text-sm text-muted-foreground truncate">{rx.diagnosis}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {rx.medications.length > 0 && (
                      <Badge variant="outline" className="text-sm">
                        {rx.medications.length} {t('autoI18n.prescList2')}
                      </Badge>
                    )}
                    {rx.fileUrl && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Image className="w-3 h-3" />
                        {t('autoI18n.prescList3')}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      }).format(rx.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              {!isManaging && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {rx.medications.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5 h-10 text-sm" 
                      onClick={(e) => { e.stopPropagation(); handleDownload(rx); }}
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </Button>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Floating bulk delete bar */}
      {isManaging && selectedIds.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
          <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-2xl p-3">
            <Button
              variant="destructive"
              className="w-full gap-2 h-12 text-base font-medium"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-5 h-5" />
              {t('manage.deleteSelected')} ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('manage.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('manage.confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('manage.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('common.delete')} ({selectedIds.size})
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
