import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Live, Recording, LiveStatus } from '@/types';

interface LivesContextType {
  lives: Live[];
  recordings: Recording[];
  isLoading: boolean;
  getLive: (id: string) => Live | undefined;
  getRecording: (id: string) => Recording | undefined;
  getLivesByDoctor: (doctorId: string) => Live[];
  getRecordingsByDoctor: (doctorId: string) => Recording[];
}

const LivesContext = createContext<LivesContextType | undefined>(undefined);

// Mock data for lives
const MOCK_LIVES: Live[] = [
  {
    id: 'live-001',
    title: 'Hipertensión Arterial: Diagnóstico y Tratamiento',
    description: 'Aprende sobre las últimas guías de manejo de hipertensión arterial.',
    doctorId: 'doctor-001',
    doctorName: 'Dr. Carlos Mendoza',
    specialty: 'Cardiología',
    status: 'live',
    viewerCount: 127,
    startedAt: new Date(),
    tags: ['cardiología', 'hipertensión', 'guías clínicas'],
  },
  {
    id: 'live-002',
    title: 'Manejo del Dolor Crónico',
    description: 'Estrategias modernas para el tratamiento del dolor crónico.',
    doctorId: 'doctor-002',
    doctorName: 'Dra. Laura Jiménez',
    specialty: 'Medicina del Dolor',
    status: 'live',
    viewerCount: 89,
    startedAt: new Date(Date.now() - 30 * 60000),
    tags: ['dolor', 'tratamiento', 'rehabilitación'],
  },
  {
    id: 'live-003',
    title: 'Diabetes Tipo 2: Novedades en Tratamiento',
    description: 'Nuevos medicamentos y enfoques en el manejo de diabetes.',
    doctorId: 'doctor-003',
    doctorName: 'Dr. Roberto Sánchez',
    specialty: 'Endocrinología',
    status: 'live',
    viewerCount: 203,
    startedAt: new Date(Date.now() - 45 * 60000),
    tags: ['diabetes', 'endocrinología', 'tratamiento'],
  },
  {
    id: 'live-004',
    title: 'Emergencias Pediátricas',
    description: 'Cómo identificar y manejar emergencias en niños.',
    doctorId: 'doctor-004',
    doctorName: 'Dra. Patricia Morales',
    specialty: 'Pediatría',
    status: 'live',
    viewerCount: 156,
    startedAt: new Date(Date.now() - 20 * 60000),
    tags: ['pediatría', 'emergencias', 'niños'],
  },
  {
    id: 'live-005',
    title: 'Salud Mental en el Trabajo',
    description: 'Estrategias para mantener el bienestar mental laboral.',
    doctorId: 'doctor-005',
    doctorName: 'Dr. Miguel Ángel Ruiz',
    specialty: 'Psiquiatría',
    status: 'live',
    viewerCount: 312,
    startedAt: new Date(Date.now() - 60 * 60000),
    tags: ['salud mental', 'trabajo', 'estrés'],
  },
  {
    id: 'live-006',
    title: 'Nutrición y Enfermedades Crónicas',
    description: 'El papel de la alimentación en la prevención de enfermedades.',
    doctorId: 'doctor-006',
    doctorName: 'Dra. Carmen Vega',
    specialty: 'Nutrición Clínica',
    status: 'live',
    viewerCount: 178,
    startedAt: new Date(Date.now() - 15 * 60000),
    tags: ['nutrición', 'prevención', 'enfermedades crónicas'],
  },
];

// Mock data for recordings
const MOCK_RECORDINGS: Recording[] = [
  {
    id: 'rec-001',
    liveId: 'live-old-001',
    title: 'Fundamentos de Cardiología',
    description: 'Conceptos básicos de cardiología para médicos generales.',
    doctorId: 'doctor-001',
    doctorName: 'Dr. Carlos Mendoza',
    specialty: 'Cardiología',
    duration: 45,
    price: 300,
    createdAt: new Date('2024-01-10'),
    tags: ['cardiología', 'fundamentos', 'ECG'],
  },
  {
    id: 'rec-002',
    liveId: 'live-old-002',
    title: 'Interpretación de Electrocardiogramas',
    description: 'Guía práctica para leer e interpretar ECGs.',
    doctorId: 'doctor-001',
    doctorName: 'Dr. Carlos Mendoza',
    specialty: 'Cardiología',
    duration: 60,
    price: 450,
    createdAt: new Date('2024-02-05'),
    tags: ['ECG', 'diagnóstico', 'arritmias'],
  },
  {
    id: 'rec-003',
    liveId: 'live-old-003',
    title: 'Manejo de Asma en Adultos',
    description: 'Protocolo actualizado para el manejo del asma.',
    doctorId: 'doctor-007',
    doctorName: 'Dr. Fernando Castro',
    specialty: 'Neumología',
    duration: 50,
    price: 350,
    createdAt: new Date('2024-02-20'),
    tags: ['asma', 'neumología', 'tratamiento'],
  },
  {
    id: 'rec-004',
    liveId: 'live-old-004',
    title: 'Dermatología Práctica',
    description: 'Diagnóstico visual de las lesiones cutáneas más comunes.',
    doctorId: 'doctor-008',
    doctorName: 'Dra. Isabel Torres',
    specialty: 'Dermatología',
    duration: 55,
    price: 400,
    createdAt: new Date('2024-03-01'),
    tags: ['dermatología', 'diagnóstico', 'lesiones'],
  },
  {
    id: 'rec-005',
    liveId: 'live-old-005',
    title: 'Urgencias Neurológicas',
    description: 'Manejo inicial del ACV y otras urgencias neurológicas.',
    doctorId: 'doctor-009',
    doctorName: 'Dr. Alejandro Vargas',
    specialty: 'Neurología',
    duration: 65,
    price: 500,
    createdAt: new Date('2024-03-15'),
    tags: ['neurología', 'ACV', 'urgencias'],
  },
  {
    id: 'rec-006',
    liveId: 'live-old-006',
    title: 'Oftalmología para Médicos Generales',
    description: 'Conceptos esenciales de oftalmología en atención primaria.',
    doctorId: 'doctor-010',
    doctorName: 'Dra. Lucía Campos',
    specialty: 'Oftalmología',
    duration: 40,
    price: 280,
    createdAt: new Date('2024-03-25'),
    tags: ['oftalmología', 'atención primaria', 'ojo'],
  },
];

export function LivesProvider({ children }: { children: ReactNode }) {
  const [lives, setLives] = useState<Live[]>(MOCK_LIVES);
  const [recordings, setRecordings] = useState<Recording[]>(MOCK_RECORDINGS);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate live viewer count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setLives(prev =>
        prev.map(live => ({
          ...live,
          viewerCount: Math.max(
            10,
            live.viewerCount + Math.floor(Math.random() * 11) - 5
          ),
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getLive = (id: string): Live | undefined => {
    return lives.find(l => l.id === id);
  };

  const getRecording = (id: string): Recording | undefined => {
    return recordings.find(r => r.id === id);
  };

  const getLivesByDoctor = (doctorId: string): Live[] => {
    return lives.filter(l => l.doctorId === doctorId);
  };

  const getRecordingsByDoctor = (doctorId: string): Recording[] => {
    return recordings.filter(r => r.doctorId === doctorId);
  };

  return (
    <LivesContext.Provider
      value={{
        lives,
        recordings,
        isLoading,
        getLive,
        getRecording,
        getLivesByDoctor,
        getRecordingsByDoctor,
      }}
    >
      {children}
    </LivesContext.Provider>
  );
}

export function useLives() {
  const context = useContext(LivesContext);
  if (context === undefined) {
    throw new Error('useLives must be used within a LivesProvider');
  }
  return context;
}
