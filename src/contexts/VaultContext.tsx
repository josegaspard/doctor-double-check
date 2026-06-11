import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { tContext } from '@/lib/i18n-context';

export type VaultFileType = 'pdf' | 'image' | 'study';

export interface VaultFile {
  id: string;
  patientId: string;
  patientName?: string;
  name: string;
  type: VaultFileType;
  size: number;
  uploadedAt: Date;
  description?: string;
  category: string;
  fileUrl: string;
  permissions: VaultPermission[];
}

export interface VaultPermission {
  id: string;
  doctorId: string;
  doctorName?: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface MedicalHistoryItem {
  id: string;
  patientId: string;
  title: string;
  description?: string;
  category: string;
  fileType: VaultFileType;
  fileUrl: string;
  fileSize: number;
  dateOfStudy?: Date;
  createdAt: Date;
}

interface VaultContextType {
  files: VaultFile[];
  medicalHistory: MedicalHistoryItem[];
  isLoading: boolean;
  uploadProgress: number | null;
  uploadFile: (file: File, category: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (fileId: string) => Promise<{ success: boolean; error?: string }>;
  grantAccess: (fileId: string, doctorId: string) => Promise<{ success: boolean; error?: string }>;
  revokeAccess: (fileId: string, doctorId: string) => Promise<{ success: boolean; error?: string }>;
  getAccessibleFiles: (doctorId: string) => VaultFile[];
  hasAccess: (fileId: string, doctorId: string) => boolean;
  revokeAllAccessForConsultation: (consultationId: string) => Promise<void>;
  uploadMedicalHistory: (file: File, title: string, category: string, description?: string, dateOfStudy?: Date) => Promise<{ success: boolean; error?: string }>;
  refreshVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [accessibleFiles, setAccessibleFiles] = useState<VaultFile[]>([]);

  const fetchFiles = useCallback(async () => {
    if (!user?.id || user.role === 'visitor') return;

    try {
      if (user.role === 'patient') {
        // Fetch patient's own files
        const { data: vaultFiles } = await supabase
          .from('vault_files')
          .select('*')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (vaultFiles) {
          // Fetch permissions for each file
          const fileIds = vaultFiles.map(f => f.id);
          const { data: allAccess } = await supabase
            .from('vault_access')
            .select('*')
            .in('file_id', fileIds);

          const accessByFile = new Map<string, any[]>();
          allAccess?.forEach(a => {
            const existing = accessByFile.get(a.file_id) || [];
            existing.push(a);
            accessByFile.set(a.file_id, existing);
          });

          // Get doctor names from public view
          const doctorIds = [...new Set(allAccess?.map(a => a.doctor_id) || [])];
          const { data: doctorProfiles } = await supabase
            .from('profiles_public')
            .select('id, name')
            .in('id', doctorIds);

          const doctorMap = new Map(doctorProfiles?.map(d => [d.id, d.name]) || []);

          setFiles(vaultFiles.map(f => ({
            id: f.id,
            patientId: f.patient_id,
            name: f.name,
            type: f.file_type as VaultFileType,
            size: f.file_size,
            uploadedAt: new Date(f.created_at),
            description: f.description || undefined,
            category: f.category,
            fileUrl: f.file_url,
            permissions: (accessByFile.get(f.id) || []).map(a => ({
              id: a.id,
              doctorId: a.doctor_id,
              doctorName: doctorMap.get(a.doctor_id),
              grantedAt: new Date(a.granted_at),
              expiresAt: a.expires_at ? new Date(a.expires_at) : undefined,
            })),
          })));
        }

        // Fetch medical history
        const { data: history } = await supabase
          .from('medical_history')
          .select('*')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (history) {
          setMedicalHistory(history.map(h => ({
            id: h.id,
            patientId: h.patient_id,
            title: h.title,
            description: h.description || undefined,
            category: h.category,
            fileType: h.file_type as VaultFileType,
            fileUrl: h.file_url,
            fileSize: h.file_size,
            dateOfStudy: h.date_of_study ? new Date(h.date_of_study) : undefined,
            createdAt: new Date(h.created_at),
          })));
        }
      } else if (user.role === 'doctor') {
        // Fetch files doctor has access to
        const { data: accessData } = await supabase
          .from('vault_access')
          .select('*, vault_files(*)')
          .eq('doctor_id', user.id);

        if (accessData) {
          const patientIds = [...new Set(accessData.map(a => {
            const vf = a.vault_files as { patient_id?: string } | null;
            return vf?.patient_id;
          }).filter((id): id is string => !!id))];
          const { data: patientProfiles } = await supabase
            .from('profiles_public')
            .select('id, name')
            .in('id', patientIds);

          const patientMap = new Map(patientProfiles?.map(p => [p.id, p.name]) || []);

          setAccessibleFiles(accessData.filter(a => a.vault_files).map(a => {
            const file = a.vault_files as { id: string; patient_id: string; name: string; file_type: string; file_size: number; created_at: string; description?: string; category: string; file_url: string };
            return {
              id: file.id,
              patientId: file.patient_id,
              patientName: patientMap.get(file.patient_id),
              name: file.name,
              type: file.file_type as VaultFileType,
              size: file.file_size,
              uploadedAt: new Date(file.created_at),
              description: file.description || undefined,
              category: file.category,
              fileUrl: file.file_url,
              permissions: [{
                id: a.id,
                doctorId: a.doctor_id,
                grantedAt: new Date(a.granted_at),
                expiresAt: a.expires_at ? new Date(a.expires_at) : undefined,
              }],
            };
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching vault data:', error);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const refreshVault = async () => {
    await fetchFiles();
  };

  const uploadFile = async (
    file: File,
    category: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Server-side content validation (magic bytes + size). The file extension
      // and client MIME are NOT trusted: this blocks uploading a renamed binary
      // as a .pdf. vault-upload-validate inspects the real bytes.
      const validateForm = new FormData();
      validateForm.append('file', file);
      validateForm.append('declaredMime', file.type || '');
      const { data: validation, error: validationError } = await supabase.functions.invoke(
        'vault-upload-validate',
        { body: validateForm }
      );
      if (validationError || !validation?.ok) {
        setUploadProgress(null);
        setIsLoading(false);
        return {
          success: false,
          error: validation?.error || 'El archivo no pasó la validación de seguridad (tipo o tamaño no permitido).',
        };
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min((prev || 0) + 10, 90));
      }, 200);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('vault-files')
        .upload(filePath, file);

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      const fileType = file.type.includes('pdf') ? 'pdf' : 
                       file.type.includes('image') ? 'image' : 'study';

      // Store the storage path instead of a signed URL to avoid expiration issues
      const { error: dbError } = await supabase
        .from('vault_files')
        .insert({
          patient_id: user.id,
          name: file.name,
          file_type: fileType,
          file_size: file.size,
          file_url: filePath,
          description,
          category,
        });

      if (dbError) throw dbError;

      // Update storage usage in profile
      await supabase.rpc('increment_storage_used', { p_user_id: user.id, p_bytes: file.size });

      setUploadProgress(100);
      await fetchFiles();

      setUploadProgress(null);
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setUploadProgress(null);
      setIsLoading(false);
      return { success: false, error: error.message || tContext('contextErrors.uploadError') };
    }
  };

  const uploadMedicalHistory = async (
    file: File,
    title: string,
    category: string,
    description?: string,
    dateOfStudy?: Date
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Compress oversized phone images before upload and apply a hard timeout
      // so a hung network doesn't lock the dialog forever.
      const { compressImageIfNeeded, withTimeout } = await import('@/lib/imageUpload');
      const fileToUpload = await compressImageIfNeeded(file);

      const fileExt = fileToUpload.name.split('.').pop();
      const filePath = `${user.id}/history/${Date.now()}.${fileExt}`;

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min((prev || 0) + 10, 90));
      }, 200);

      let uploadError: any = null;
      try {
        const res = await withTimeout(
          supabase.storage.from('medical-history').upload(filePath, fileToUpload),
          90_000,
          'subida del estudio',
        );
        uploadError = res.error;
      } catch (e: any) {
        uploadError = e;
      } finally {
        clearInterval(progressInterval);
      }

      if (uploadError) throw uploadError;

      const fileType = file.type.includes('pdf') ? 'pdf' : 
                       file.type.includes('image') ? 'image' : 'study';

      // Store the storage path instead of a signed URL to avoid expiration issues
      const { error: dbError } = await supabase
        .from('medical_history')
        .insert({
          patient_id: user.id,
          title,
          description,
          category,
          file_type: fileType,
          file_url: filePath,
          file_size: file.size,
          date_of_study: dateOfStudy?.toISOString(),
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      await fetchFiles();

      setUploadProgress(null);
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setUploadProgress(null);
      setIsLoading(false);
      return { success: false, error: error.message || tContext('contextErrors.historyUploadError') };
    }
  };

  const deleteFile = async (fileId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    setIsLoading(true);
    try {
      // Get file size before deleting
      const fileToDelete = files.find(f => f.id === fileId);
      const fileSize = fileToDelete?.size || 0;

      const { error } = await supabase
        .from('vault_files')
        .delete()
        .eq('id', fileId)
        .eq('patient_id', user.id);

      if (error) throw error;

      // Decrement storage usage in profile
      if (fileSize > 0) {
        await supabase.rpc('decrement_storage_used', { p_user_id: user.id, p_bytes: fileSize });
      }

      await fetchFiles();
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || tContext('contextErrors.deleteError') };
    }
  };

  const grantAccess = async (fileId: string, doctorId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    try {
      const { error } = await supabase
        .from('vault_access')
        .insert({
          file_id: fileId,
          doctor_id: doctorId,
        });

      if (error) throw error;

      await fetchFiles();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || tContext('contextErrors.grantAccessError') };
    }
  };

  const revokeAccess = async (fileId: string, doctorId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    try {
      const { error } = await supabase
        .from('vault_access')
        .delete()
        .eq('file_id', fileId)
        .eq('doctor_id', doctorId);

      if (error) throw error;

      await fetchFiles();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || tContext('contextErrors.revokeAccessError') };
    }
  };

  const getAccessibleFiles = (doctorId: string): VaultFile[] => {
    if (user?.role === 'doctor' && user.id === doctorId) {
      return accessibleFiles;
    }
    return files.filter(f => f.permissions.some(p => p.doctorId === doctorId));
  };

  const hasAccess = (fileId: string, doctorId: string): boolean => {
    const file = files.find(f => f.id === fileId);
    if (!file) return false;
    return file.permissions.some(p => p.doctorId === doctorId);
  };

  const revokeAllAccessForConsultation = async (consultationId: string) => {
    try {
      await supabase
        .from('vault_access')
        .delete()
        .eq('consultation_id', consultationId);

      await fetchFiles();
    } catch (error) {
      console.error('Error revoking access:', error);
    }
  };

  return (
    <VaultContext.Provider
      value={{
        files,
        medicalHistory,
        isLoading,
        uploadProgress,
        uploadFile,
        deleteFile,
        grantAccess,
        revokeAccess,
        getAccessibleFiles,
        hasAccess,
        revokeAllAccessForConsultation,
        uploadMedicalHistory,
        refreshVault,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

const VAULT_DEFAULTS: VaultContextType = {
  files: [],
  medicalHistory: [],
  isLoading: false,
  uploadProgress: null,
  uploadFile: async () => ({ success: false, error: 'Context not ready' }),
  deleteFile: async () => ({ success: false, error: 'Context not ready' }),
  grantAccess: async () => ({ success: false, error: 'Context not ready' }),
  revokeAccess: async () => ({ success: false, error: 'Context not ready' }),
  getAccessibleFiles: () => [],
  hasAccess: () => false,
  revokeAllAccessForConsultation: async () => {},
  uploadMedicalHistory: async () => ({ success: false, error: 'Context not ready' }),
  refreshVault: async () => {},
};

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    console.warn('useVault called outside VaultProvider – returning defaults');
    return VAULT_DEFAULTS;
  }
  return context;
}
