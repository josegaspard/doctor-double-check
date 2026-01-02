import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { VaultFile, VaultPermission } from '@/types';
import { useAuth } from './AuthContext';

interface VaultContextType {
  files: VaultFile[];
  isLoading: boolean;
  uploadProgress: number | null;
  uploadFile: (file: File, category: string, description?: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (fileId: string) => Promise<{ success: boolean; error?: string }>;
  grantAccess: (fileId: string, doctorId: string, doctorName: string) => Promise<{ success: boolean }>;
  revokeAccess: (fileId: string, doctorId: string) => Promise<{ success: boolean }>;
  getAccessibleFiles: (doctorId: string) => VaultFile[];
  hasAccess: (fileId: string, doctorId: string) => boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

// Mock initial files for demo patient
const INITIAL_FILES: VaultFile[] = [
  {
    id: 'file-001',
    patientId: 'patient-001',
    name: 'Electrocardiograma_2024.pdf',
    type: 'pdf',
    size: 2456000,
    uploadedAt: new Date('2024-02-15'),
    description: 'ECG de control',
    category: 'Estudios Cardíacos',
    permissions: [
      {
        doctorId: 'doctor-001',
        doctorName: 'Dr. Carlos Mendoza',
        grantedAt: new Date('2024-02-16'),
      },
    ],
  },
  {
    id: 'file-002',
    patientId: 'patient-001',
    name: 'Radiografia_Torax.jpg',
    type: 'image',
    size: 1890000,
    uploadedAt: new Date('2024-03-01'),
    description: 'Radiografía de tórax PA y lateral',
    category: 'Imagenología',
    permissions: [],
  },
  {
    id: 'file-003',
    patientId: 'patient-001',
    name: 'Laboratorios_Marzo_2024.pdf',
    type: 'pdf',
    size: 567000,
    uploadedAt: new Date('2024-03-10'),
    description: 'Biometría hemática, química sanguínea',
    category: 'Laboratorios',
    permissions: [
      {
        doctorId: 'doctor-001',
        doctorName: 'Dr. Carlos Mendoza',
        grantedAt: new Date('2024-03-11'),
      },
    ],
  },
];

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Load files from localStorage
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`drDoubleCheck_vault_${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored).map((f: any) => ({
          ...f,
          uploadedAt: new Date(f.uploadedAt),
          permissions: f.permissions.map((p: any) => ({
            ...p,
            grantedAt: new Date(p.grantedAt),
            expiresAt: p.expiresAt ? new Date(p.expiresAt) : undefined,
          })),
        }));
        setFiles(parsed);
      } else if (user.id === 'patient-001') {
        // Initialize with mock data for demo patient
        setFiles(INITIAL_FILES);
        localStorage.setItem(
          `drDoubleCheck_vault_${user.id}`,
          JSON.stringify(INITIAL_FILES)
        );
      }
    }
  }, [user?.id]);

  const saveFiles = (newFiles: VaultFile[]) => {
    if (user?.id) {
      localStorage.setItem(
        `drDoubleCheck_vault_${user.id}`,
        JSON.stringify(newFiles)
      );
    }
  };

  const uploadFile = async (
    file: File,
    category: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    setIsLoading(true);
    setUploadProgress(0);

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setUploadProgress(i);
    }

    const fileType = file.type.includes('pdf')
      ? 'pdf'
      : file.type.includes('image')
      ? 'image'
      : 'study';

    const newFile: VaultFile = {
      id: `file-${Date.now()}`,
      patientId: user.id,
      name: file.name,
      type: fileType,
      size: file.size,
      uploadedAt: new Date(),
      description,
      category,
      permissions: [],
    };

    const newFiles = [newFile, ...files];
    setFiles(newFiles);
    saveFiles(newFiles);

    setUploadProgress(null);
    setIsLoading(false);
    return { success: true };
  };

  const deleteFile = async (fileId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const newFiles = files.filter(f => f.id !== fileId);
    setFiles(newFiles);
    saveFiles(newFiles);

    setIsLoading(false);
    return { success: true };
  };

  const grantAccess = async (
    fileId: string,
    doctorId: string,
    doctorName: string
  ): Promise<{ success: boolean }> => {
    const newFiles = files.map(f => {
      if (f.id === fileId) {
        const alreadyHasAccess = f.permissions.some(p => p.doctorId === doctorId);
        if (alreadyHasAccess) return f;

        return {
          ...f,
          permissions: [
            ...f.permissions,
            {
              doctorId,
              doctorName,
              grantedAt: new Date(),
            },
          ],
        };
      }
      return f;
    });

    setFiles(newFiles);
    saveFiles(newFiles);
    return { success: true };
  };

  const revokeAccess = async (fileId: string, doctorId: string): Promise<{ success: boolean }> => {
    const newFiles = files.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          permissions: f.permissions.filter(p => p.doctorId !== doctorId),
        };
      }
      return f;
    });

    setFiles(newFiles);
    saveFiles(newFiles);
    return { success: true };
  };

  const getAccessibleFiles = (doctorId: string): VaultFile[] => {
    // Get all files where the doctor has permission
    const allVaultFiles: VaultFile[] = [];
    
    // In a real app, this would query the backend
    // For demo, we'll check localStorage for all patient vaults
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith('drDoubleCheck_vault_')
    );
    
    keys.forEach(key => {
      try {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        stored.forEach((file: any) => {
          const hasPermission = file.permissions?.some(
            (p: any) => p.doctorId === doctorId
          );
          if (hasPermission) {
            allVaultFiles.push({
              ...file,
              uploadedAt: new Date(file.uploadedAt),
              permissions: file.permissions.map((p: any) => ({
                ...p,
                grantedAt: new Date(p.grantedAt),
              })),
            });
          }
        });
      } catch (e) {
        // Ignore parse errors
      }
    });
    
    return allVaultFiles;
  };

  const hasAccess = (fileId: string, doctorId: string): boolean => {
    const file = files.find(f => f.id === fileId);
    if (!file) return false;
    return file.permissions.some(p => p.doctorId === doctorId);
  };

  return (
    <VaultContext.Provider
      value={{
        files,
        isLoading,
        uploadProgress,
        uploadFile,
        deleteFile,
        grantAccess,
        revokeAccess,
        getAccessibleFiles,
        hasAccess,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
