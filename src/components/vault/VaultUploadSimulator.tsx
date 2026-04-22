import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/dicom',
]);
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.dcm'];
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

interface DoctorOption {
  id: string;
  name: string;
  specialty: string;
}

interface VaultUploadSimulatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  onCategoryChange: (cat: string) => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  categories: { value: string; label: string }[];
  availableDoctors: DoctorOption[];
}

type Step = 'select' | 'uploading' | 'permissions' | 'done';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

function detectFileType(mime: string): 'pdf' | 'image' | 'study' {
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return 'study';
}

export function VaultUploadSimulator({
  open,
  onOpenChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  categories,
  availableDoctors,
}: VaultUploadSimulatorProps) {
  const { supabaseUser } = useAuth();
  const { refreshVault } = useVault();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<Set<string>>(new Set());
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Reset internal state on open/close
  useEffect(() => {
    if (!open) {
      setFile(null);
      setStep('select');
      setProgress(0);
      setError(null);
      setUploadedFileId(null);
      setUploadedPath(null);
      setSelectedDoctorIds(new Set());
    }
  }, [open]);

  const validateFile = useCallback((f: File): string | null => {
    const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.has(f.type)) {
      return `Tipo no permitido. Aceptados: ${ALLOWED_EXT.join(', ')}`;
    }
    if (f.size > MAX_BYTES) {
      return `Archivo demasiado grande (${(f.size / 1024 / 1024).toFixed(1)}MB). Máximo 20MB.`;
    }
    if (f.size === 0) {
      return 'Archivo vacío.';
    }
    return null;
  }, []);

  const handlePickFile = (selected: File | undefined) => {
    if (!selected) return;
    const err = validateFile(selected);
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    handlePickFile(f);
  };

  const performUpload = async () => {
    if (!file || !supabaseUser?.id) return;

    setStep('uploading');
    setProgress(0);
    setError(null);

    try {
      const ext = file.name.split('.').pop();
      const safeName = sanitizeFilename(file.name);
      const path = `${supabaseUser.id}/${Date.now()}_${safeName}`;

      // Real upload progress via XHR to Supabase Storage REST endpoint
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error('Sesión expirada');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/vault-files/${encodeURIComponent(path)}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload fallido (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Error de red durante upload'));
        xhr.send(file);
      });

      setProgress(100);

      // Insert DB row
      const fileType = detectFileType(file.type);
      const { data: row, error: dbErr } = await supabase
        .from('vault_files')
        .insert({
          patient_id: supabaseUser.id,
          name: file.name,
          file_type: fileType,
          file_size: file.size,
          file_url: path,
          description: description || null,
          category,
        })
        .select('id')
        .single();

      if (dbErr) throw dbErr;

      // Increment storage usage
      await supabase.rpc('increment_storage_used', {
        p_user_id: supabaseUser.id,
        p_bytes: file.size,
      });

      setUploadedFileId(row.id);
      setUploadedPath(path);
      setStep('permissions');
    } catch (e: any) {
      console.error('[VaultUploadSimulator] upload error', e);
      setError(e?.message || 'Error subiendo archivo');
      setStep('select');
    }
  };

  const toggleDoctor = (id: string) => {
    setSelectedDoctorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finalizeWithPermissions = async () => {
    if (!uploadedFileId) return;
    setSavingPermissions(true);
    try {
      if (selectedDoctorIds.size > 0) {
        const rows = Array.from(selectedDoctorIds).map((doctorId) => ({
          file_id: uploadedFileId,
          doctor_id: doctorId,
        }));
        const { error: accessErr } = await supabase.from('vault_access').insert(rows);
        if (accessErr) throw accessErr;
      }
      await refreshVault();
      toast.success(
        selectedDoctorIds.size === 0
          ? 'Archivo guardado en privado (ningún doctor con acceso)'
          : `Archivo guardado · ${selectedDoctorIds.size} doctor(es) con acceso`
      );
      setStep('done');
      setTimeout(() => onOpenChange(false), 800);
    } catch (e: any) {
      toast.error(e?.message || 'Error otorgando permisos');
    } finally {
      setSavingPermissions(false);
    }
  };

  const skipPermissions = async () => {
    setSelectedDoctorIds(new Set());
    await finalizeWithPermissions();
  };

  const TypeIcon = ({ mime }: { mime: string }) => {
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-primary" />;
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-info" />;
    return <Activity className="w-5 h-5 text-warning" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {step === 'permissions' || step === 'done'
              ? 'Confirmar permisos'
              : 'Subir archivo al Vault'}
          </DialogTitle>
          <DialogDescription>
            {step === 'permissions' || step === 'done'
              ? 'Selecciona qué doctores podrán ver este archivo. Puedes cambiarlo en cualquier momento.'
              : 'Acepta PDF, JPG, PNG y estudios DICOM. Máximo 20MB.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {(step === 'select' || step === 'uploading') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría</label>
                  <Select value={category} onValueChange={onCategoryChange}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción (opcional)</label>
                  <Input
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder="Ej: Análisis sangre"
                    maxLength={200}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div
                role="region"
                aria-label="Zona para soltar archivo"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : file
                    ? 'border-success/40 bg-success/5'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
                onClick={() => step === 'select' && inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ALLOWED_EXT.join(',')}
                  className="hidden"
                  onChange={(e) => handlePickFile(e.target.files?.[0])}
                />
                {file ? (
                  <div className="flex items-center gap-3 justify-center">
                    <TypeIcon mime={file.type} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(0)} KB · {file.type || 'binario'}
                      </p>
                    </div>
                    {step === 'select' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        aria-label="Quitar archivo"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-sm font-medium">Arrastra un archivo aquí o haz click</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ALLOWED_EXT.join(' · ')} · máx 20MB
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive flex-1">{error}</p>
                </div>
              )}

              {step === 'uploading' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Subiendo…
                    </span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </>
          )}

          {step === 'permissions' && (
            <>
              <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium text-foreground">Privacy-first</p>
                  <p className="text-muted-foreground mt-0.5">
                    Por defecto ningún doctor tiene acceso. Marca a quién quieres otorgárselo.
                  </p>
                </div>
              </div>

              {availableDoctors.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No tienes doctores vinculados todavía. El archivo se guardará privado.
                </div>
              ) : (
                <ScrollArea className="max-h-[280px] pr-2">
                  <div className="space-y-1.5">
                    {availableDoctors.map((doc) => {
                      const checked = selectedDoctorIds.has(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${
                            checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleDoctor(doc.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{doc.specialty}</p>
                          </div>
                          {checked && <Badge variant="secondary" className="text-[10px]">Acceso</Badge>}
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-3" />
              <p className="text-sm font-medium">Archivo guardado correctamente</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={performUpload} disabled={!file}>
                <Upload className="w-4 h-4 mr-1" />
                Subir
              </Button>
            </>
          )}
          {step === 'uploading' && (
            <Button disabled className="gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Subiendo… {progress}%
            </Button>
          )}
          {step === 'permissions' && (
            <>
              <Button variant="outline" onClick={skipPermissions} disabled={savingPermissions}>
                Guardar privado
              </Button>
              <Button onClick={finalizeWithPermissions} disabled={savingPermissions}>
                {savingPermissions ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-1" />
                )}
                Confirmar permisos ({selectedDoctorIds.size})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
