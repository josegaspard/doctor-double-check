import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Patient, Doctor, Resident, Admin, UserRole } from '@/types';

// Demo users
const DEMO_USERS = {
  patient: {
    id: 'patient-001',
    email: 'paciente@demo.com',
    password: 'demo123',
    name: 'María García',
    role: 'patient' as const,
    avatar: undefined,
    createdAt: new Date('2024-01-15'),
    walletBalance: 1500,
    entitlements: {
      chat: true,
      recordings: ['rec-001', 'rec-002'],
    },
  } as Patient,
  doctor: {
    id: 'doctor-001',
    email: 'medico@demo.com',
    password: 'demo123',
    name: 'Dr. Carlos Mendoza',
    role: 'doctor' as const,
    avatar: undefined,
    createdAt: new Date('2023-06-10'),
    status: 'approved' as const,
    specialty: 'Cardiología',
    license: 'MED-2023-001',
    bio: 'Cardiólogo con más de 15 años de experiencia. Especialista en arritmias y enfermedades cardiovasculares.',
    isVerified: true,
    consultationFee: 500,
    rating: 4.8,
    totalConsultations: 342,
  } as Doctor,
  resident: {
    id: 'resident-001',
    email: 'residente@demo.com',
    password: 'demo123',
    name: 'Ana López',
    role: 'resident' as const,
    avatar: undefined,
    createdAt: new Date('2024-03-01'),
    walletBalance: 800,
    institution: 'Hospital General de México',
    specialty: 'Medicina Interna',
    year: 2,
    entitlements: {
      recordings: ['rec-001'],
    },
  } as Resident,
  admin: {
    id: 'admin-001',
    email: 'admin@demo.com',
    password: 'admin123',
    name: 'Administrador Sistema',
    role: 'admin' as const,
    avatar: undefined,
    createdAt: new Date('2023-01-01'),
    permissions: ['all'],
  } as Admin,
};

interface AuthContextType {
  user: User | Patient | Doctor | Resident | Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loginAsVisitor: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  updateUser: (updates: Partial<User>) => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: Exclude<UserRole, 'visitor' | 'admin'>;
  specialty?: string;
  institution?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | Patient | Doctor | Resident | Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('drDoubleCheck_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Restore dates
        parsed.createdAt = new Date(parsed.createdAt);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem('drDoubleCheck_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check demo users
    const demoUser = Object.values(DEMO_USERS).find(
      u => u.email === email && (u as any).password === password
    );
    
    if (demoUser) {
      const { password: _pass, ...userWithoutPassword } = demoUser as any;
      setUser(userWithoutPassword);
      localStorage.setItem('drDoubleCheck_user', JSON.stringify(userWithoutPassword));
      setIsLoading(false);
      return { success: true };
    }
    
    // Check registered users in localStorage
    const registeredUsers = JSON.parse(localStorage.getItem('drDoubleCheck_registeredUsers') || '[]');
    const registeredUser = registeredUsers.find(
      (u: any) => u.email === email && u.password === password
    );
    
    if (registeredUser) {
      const { password: _pw, ...userWithoutPassword } = registeredUser as any;
      userWithoutPassword.createdAt = new Date(userWithoutPassword.createdAt);
      setUser(userWithoutPassword);
      localStorage.setItem('drDoubleCheck_user', JSON.stringify(userWithoutPassword));
      setIsLoading(false);
      return { success: true };
    }
    
    setIsLoading(false);
    return { success: false, error: 'Credenciales incorrectas' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('drDoubleCheck_user');
  };

  const loginAsVisitor = () => {
    const visitorUser: User = {
      id: `visitor-${Date.now()}`,
      email: '',
      name: 'Visitante',
      role: 'visitor',
      createdAt: new Date(),
    };
    setUser(visitorUser);
    // Don't persist visitor sessions
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if email exists
    const existingUsers = Object.values(DEMO_USERS).map(u => u.email);
    const registeredUsers = JSON.parse(localStorage.getItem('drDoubleCheck_registeredUsers') || '[]');
    const allEmails = [...existingUsers, ...registeredUsers.map((u: any) => u.email)];
    
    if (allEmails.includes(data.email)) {
      setIsLoading(false);
      return { success: false, error: 'El correo ya está registrado' };
    }
    
    let newUser: any = {
      id: `${data.role}-${Date.now()}`,
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
      createdAt: new Date(),
    };
    
    if (data.role === 'patient') {
      newUser = {
        ...newUser,
        walletBalance: 0,
        entitlements: { chat: false, recordings: [] },
      };
    } else if (data.role === 'doctor') {
      newUser = {
        ...newUser,
        status: 'pending',
        specialty: data.specialty || '',
        license: '',
        bio: '',
        isVerified: false,
        consultationFee: 0,
        rating: 0,
        totalConsultations: 0,
      };
    } else if (data.role === 'resident') {
      newUser = {
        ...newUser,
        walletBalance: 0,
        institution: data.institution || '',
        specialty: data.specialty || '',
        year: 1,
        entitlements: { recordings: [] },
      };
    }
    
    registeredUsers.push(newUser);
    localStorage.setItem('drDoubleCheck_registeredUsers', JSON.stringify(registeredUsers));
    
    const { password: _, ...userWithoutPassword } = newUser;
    setUser(userWithoutPassword);
    localStorage.setItem('drDoubleCheck_user', JSON.stringify(userWithoutPassword));
    
    setIsLoading(false);
    return { success: true };
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser as any);
      localStorage.setItem('drDoubleCheck_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        role: user?.role || null,
        login,
        logout,
        loginAsVisitor,
        register,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { DEMO_USERS };
