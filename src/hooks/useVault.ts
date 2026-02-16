/**
 * @deprecated Use VaultContext instead. This hook duplicates logic already in VaultProvider.
 * Kept for backwards compatibility but all new code should use useVault from '@/contexts/VaultContext'.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VaultFile, VaultAccess, MedicalHistory } from '@/types/database';

export function useVault(userId: string | undefined, userRole: string | undefined) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [accessibleFiles, setAccessibleFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Fetch vault data
  const fetchData = useCallback(async () => {
    if (!userId) {
      setFiles([]);
      setMedicalHistory([]);
      setAccessibleFiles([]);
      setIsLoading(false);
      return;
    }

    try {
      if (userRole === 'patient') {
        // Fetch patient's own files
        const { data: filesData } = await supabase
          .from('vault_files')
          .select('*')
          .eq('patient_id', userId)
          .order('created_at', { ascending: false });

        setFiles((filesData || []) as VaultFile[]);

        // Fetch patient's medical history
        const { data: historyData } = await supabase
          .from('medical_history')
          .select('*')
          .eq('patient_id', userId)
          .order('created_at', { ascending: false });

        setMedicalHistory((historyData || []) as MedicalHistory[]);
      } else if (userRole === 'doctor') {
        // Fetch files the doctor has access to
        const { data: accessData } = await supabase
          .from('vault_access')
          .select(`
            *,
            file:vault_files(*)
          `)
          .eq('doctor_id', userId);

        const accessibleFilesData = (accessData || [])
          .map((a: any) => a.file)
          .filter(Boolean);

        setAccessibleFiles(accessibleFilesData as VaultFile[]);
      }
    } catch (error) {
      console.error('Error fetching vault data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Upload a file to vault
  const uploadFile = async (
    file: File,
    category: string,
    description?: string,
    saveToHistory: boolean = true
  ): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'No user' };

    try {
      setUploadProgress(0);

      // Determine file type
      let fileType: 'pdf' | 'image' | 'study' = 'image';
      if (file.type === 'application/pdf') {
        fileType = 'pdf';
      } else if (file.type.startsWith('image/')) {
        fileType = 'image';
      } else {
        fileType = 'study';
      }

      // Upload to storage
      const fileName = `${userId}/${Date.now()}-${file.name}`;
      const bucket = saveToHistory ? 'medical-history' : 'vault-files';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      // Simulate progress since Supabase JS doesn't support progress
      setUploadProgress(50);

      if (uploadError) {
        setUploadProgress(null);
        return { success: false, error: uploadError.message };
      }

      // Store the raw storage path (bucket/filePath) instead of a signed URL
      // This prevents links from expiring. Generate signed URLs on-demand when viewing.
      const fileUrl = `${bucket}/${fileName}`;

      // Save to medical history if requested
      let medicalHistoryId: string | null = null;
      if (saveToHistory) {
        const { data: historyData, error: historyError } = await supabase
          .from('medical_history')
          .insert({
            patient_id: userId,
            title: file.name,
            description,
            file_type: fileType,
            file_url: fileUrl,
            file_size: file.size,
            category,
          })
          .select()
          .single();

        if (historyError) {
          setUploadProgress(null);
          return { success: false, error: historyError.message };
        }

        medicalHistoryId = historyData.id;
      }

      // Save to vault files
      const { error: vaultError } = await supabase
        .from('vault_files')
        .insert({
          patient_id: userId,
          medical_history_id: medicalHistoryId,
          name: file.name,
          file_type: fileType,
          file_url: fileUrl,
          file_size: file.size,
          category,
          description,
        });

      if (vaultError) {
        setUploadProgress(null);
        return { success: false, error: vaultError.message };
      }

      setUploadProgress(null);
      await fetchData();
      return { success: true };
    } catch (error) {
      setUploadProgress(null);
      return { success: false, error: 'Error al subir archivo' };
    }
  };

  // Delete a file
  const deleteFile = async (fileId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('vault_files')
        .delete()
        .eq('id', fileId);

      if (error) {
        return { success: false, error: error.message };
      }

      await fetchData();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Error al eliminar archivo' };
    }
  };

  // Grant access to a doctor
  const grantAccess = async (
    fileId: string,
    doctorId: string,
    expiresAt?: string,
    consultationId?: string
  ): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('vault_access')
        .insert({
          file_id: fileId,
          doctor_id: doctorId,
          expires_at: expiresAt,
          consultation_id: consultationId,
        });

      if (error && error.code !== '23505') {
        console.error('Error granting access:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  // Revoke access from a doctor
  const revokeAccess = async (fileId: string, doctorId: string): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('vault_access')
        .delete()
        .eq('file_id', fileId)
        .eq('doctor_id', doctorId);

      if (error) {
        console.error('Error revoking access:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  // Check if doctor has access to a file
  const hasAccess = async (fileId: string, doctorId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('vault_access')
      .select('id')
      .eq('file_id', fileId)
      .eq('doctor_id', doctorId)
      .single();

    return !!data;
  };

  // Revoke all access after consultation ends (data cleanup)
  const revokeAllAccessForConsultation = async (consultationId: string): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('vault_access')
        .delete()
        .eq('consultation_id', consultationId);

      if (error) {
        console.error('Error revoking consultation access:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  return {
    files,
    medicalHistory,
    accessibleFiles,
    isLoading,
    uploadProgress,
    uploadFile,
    deleteFile,
    grantAccess,
    revokeAccess,
    hasAccess,
    revokeAllAccessForConsultation,
    refresh: fetchData,
  };
}
