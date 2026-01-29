// Internationalization (i18n) System
export type SupportedLanguage = 'es' | 'en';

export const translations = {
  es: {
    // Navigation
    nav: {
      lives: 'Lives',
      recordings: 'Grabaciones',
      chat: 'Chat',
      vault: 'Mi Vault',
      doctorVault: 'Vault Pacientes',
      dashboard: 'Mi Panel',
      availability: 'Disponibilidad',
      upload: 'Subir Contenido',
      admin: 'Admin',
      notifications: 'Notificaciones',
      settings: 'Configuración',
      profile: 'Mi Perfil',
      wallet: 'Mi Wallet',
      logout: 'Cerrar Sesión',
      login: 'Iniciar Sesión',
    },
    // Common
    common: {
      loading: 'Cargando...',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      confirm: 'Confirmar',
      back: 'Volver',
      next: 'Siguiente',
      previous: 'Anterior',
      search: 'Buscar',
      filter: 'Filtrar',
      all: 'Todos',
      none: 'Ninguno',
      yes: 'Sí',
      no: 'No',
      error: 'Error',
      success: 'Éxito',
      warning: 'Advertencia',
      info: 'Información',
    },
    // Roles
    roles: {
      visitor: 'Visitante',
      patient: 'Paciente',
      doctor: 'Médico',
      resident: 'Residente',
      admin: 'Administrador',
    },
    // Role selector page
    roleSelector: {
      title: '¿Cómo quieres entrar?',
      subtitle: 'Selecciona tu rol para acceder a la plataforma',
      tagline: 'Transmisiones médicas en vivo',
      exploreLives: 'Explorar Lives Gratis',
      exploreDescription: 'Mira transmisiones en vivo sin registro',
      imPatient: 'Soy Paciente',
      patientDescription: 'Accede a consultas, grabaciones y tu historial médico',
      imDoctor: 'Soy Médico',
      doctorDescription: 'Crea contenido, da consultas y comparte conocimiento',
      imResident: 'Soy Residente',
      residentDescription: 'Accede a contenido educativo y comunidad médica',
      freeLives: 'Lives gratis',
      verifiedDoctors: 'Médicos verificados',
      secureVault: 'Vault seguro',
      oneOnOneChat: 'Chat 1:1',
    },
    // Login page
    login: {
      title: 'Iniciar Sesión',
      email: 'Correo electrónico',
      password: 'Contraseña',
      forgotPassword: '¿Olvidaste tu contraseña?',
      noAccount: '¿No tienes cuenta?',
      register: 'Regístrate',
      orContinueWith: 'O continúa con',
      continueWithGoogle: 'Continuar con Google',
      loginTab: 'Iniciar Sesión',
      registerTab: 'Registrarse',
      name: 'Nombre completo',
      role: 'Rol',
      specialty: 'Especialidad',
      institution: 'Institución',
      createAccount: 'Crear cuenta',
      alreadyHaveAccount: '¿Ya tienes cuenta?',
      resetEmailSent: 'Te enviamos un correo para restablecer tu contraseña',
      checkEmail: 'Revisa tu correo electrónico',
      termsAgreement: 'Al registrarte, aceptas nuestros',
      termsOfService: 'Términos de Servicio',
      and: 'y',
      privacyPolicy: 'Política de Privacidad',
    },
    // Doctor status
    doctorStatus: {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
    },
    // Subscriptions
    subscriptions: {
      subscribe: 'Suscribirse',
      unsubscribe: 'Cancelar suscripción',
      subscribed: 'Suscrito',
      followers: 'Seguidores',
      following: 'Siguiendo',
      free: 'Gratis',
      basic: 'Básico',
      premium: 'Premium',
      notifyLive: 'Notificar cuando haga live',
      notifyContent: 'Notificar nuevo contenido',
      notifyAvailability: 'Notificar disponibilidad',
    },
    // Notifications
    notifications: {
      title: 'Notificaciones',
      noNotifications: 'No tienes notificaciones',
      markAsRead: 'Marcar como leído',
      markAllAsRead: 'Marcar todas como leídas',
      doctorLive: 'Live en vivo',
      doctorAvailability: 'Disponibilidad',
      newContent: 'Nuevo contenido',
      subscriptionUpdate: 'Actualización de suscripción',
      chatMessage: 'Mensaje de chat',
      system: 'Sistema',
    },
    // Content classification
    content: {
      audienceType: 'Tipo de audiencia',
      all: 'Todos',
      patients: 'Pacientes',
      professionals: 'Solo profesionales',
      patientsDescription: 'Apto para pacientes',
      professionalsDescription: 'Solo para médicos y residentes',
    },
    // Settings
    settings: {
      language: 'Idioma',
      spanish: 'Español',
      english: 'English',
      notifications: 'Notificaciones',
      emailNotifications: 'Notificaciones por email',
      pushNotifications: 'Notificaciones push',
      inAppNotifications: 'Notificaciones en la app',
      preferences: 'Preferencias',
    },
    // Identity verification
    verification: {
      title: 'Verificación de identidad',
      description: 'Verifica tu identidad para mayor seguridad',
      pending: 'Pendiente',
      inProgress: 'En proceso',
      verified: 'Verificado',
      failed: 'Fallido',
      expired: 'Expirado',
      startVerification: 'Iniciar verificación',
      verificationRequired: 'Verificación requerida',
    },
    // Doctor availability
    availability: {
      title: 'Disponibilidad',
      schedule: 'Programar',
      scheduled: 'Programado',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Completado',
      live: 'Live',
      consultation: 'Consulta',
      officeHours: 'Horario de oficina',
      notifySubscribers: 'Notificar suscriptores',
    },
    // Footer
    footer: {
      platform: 'Plataforma de educación médica continua',
      termsOfService: 'Términos de Servicio',
      privacyPolicy: 'Política de Privacidad',
      contact: 'Contacto',
      copyright: '© 2026 Medical Masters. Todos los derechos reservados.',
    },
  },
  en: {
    // Navigation
    nav: {
      lives: 'Lives',
      recordings: 'Recordings',
      chat: 'Chat',
      vault: 'My Vault',
      doctorVault: 'Patient Vault',
      dashboard: 'My Dashboard',
      availability: 'Availability',
      upload: 'Upload Content',
      admin: 'Admin',
      notifications: 'Notifications',
      settings: 'Settings',
      profile: 'My Profile',
      wallet: 'My Wallet',
      logout: 'Log Out',
      login: 'Log In',
    },
    // Common
    common: {
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      search: 'Search',
      filter: 'Filter',
      all: 'All',
      none: 'None',
      yes: 'Yes',
      no: 'No',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Information',
    },
    // Roles
    roles: {
      visitor: 'Visitor',
      patient: 'Patient',
      doctor: 'Doctor',
      resident: 'Resident',
      admin: 'Administrator',
    },
    // Role selector page
    roleSelector: {
      title: 'How do you want to enter?',
      subtitle: 'Select your role to access the platform',
      tagline: 'Live medical broadcasts',
      exploreLives: 'Explore Free Lives',
      exploreDescription: 'Watch live broadcasts without registration',
      imPatient: "I'm a Patient",
      patientDescription: 'Access consultations, recordings, and your medical history',
      imDoctor: "I'm a Doctor",
      doctorDescription: 'Create content, give consultations, and share knowledge',
      imResident: "I'm a Resident",
      residentDescription: 'Access educational content and the medical community',
      freeLives: 'Free lives',
      verifiedDoctors: 'Verified doctors',
      secureVault: 'Secure vault',
      oneOnOneChat: '1:1 Chat',
    },
    // Login page
    login: {
      title: 'Log In',
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot your password?',
      noAccount: "Don't have an account?",
      register: 'Sign up',
      orContinueWith: 'Or continue with',
      continueWithGoogle: 'Continue with Google',
      loginTab: 'Log In',
      registerTab: 'Sign Up',
      name: 'Full name',
      role: 'Role',
      specialty: 'Specialty',
      institution: 'Institution',
      createAccount: 'Create account',
      alreadyHaveAccount: 'Already have an account?',
      resetEmailSent: 'We sent you an email to reset your password',
      checkEmail: 'Check your email',
      termsAgreement: 'By signing up, you agree to our',
      termsOfService: 'Terms of Service',
      and: 'and',
      privacyPolicy: 'Privacy Policy',
    },
    // Doctor status
    doctorStatus: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
    },
    // Subscriptions
    subscriptions: {
      subscribe: 'Subscribe',
      unsubscribe: 'Unsubscribe',
      subscribed: 'Subscribed',
      followers: 'Followers',
      following: 'Following',
      free: 'Free',
      basic: 'Basic',
      premium: 'Premium',
      notifyLive: 'Notify when live',
      notifyContent: 'Notify new content',
      notifyAvailability: 'Notify availability',
    },
    // Notifications
    notifications: {
      title: 'Notifications',
      noNotifications: 'No notifications',
      markAsRead: 'Mark as read',
      markAllAsRead: 'Mark all as read',
      doctorLive: 'Live now',
      doctorAvailability: 'Availability',
      newContent: 'New content',
      subscriptionUpdate: 'Subscription update',
      chatMessage: 'Chat message',
      system: 'System',
    },
    // Content classification
    content: {
      audienceType: 'Audience type',
      all: 'Everyone',
      patients: 'Patients',
      professionals: 'Professionals only',
      patientsDescription: 'Suitable for patients',
      professionalsDescription: 'For doctors and residents only',
    },
    // Settings
    settings: {
      language: 'Language',
      spanish: 'Español',
      english: 'English',
      notifications: 'Notifications',
      emailNotifications: 'Email notifications',
      pushNotifications: 'Push notifications',
      inAppNotifications: 'In-app notifications',
      preferences: 'Preferences',
    },
    // Identity verification
    verification: {
      title: 'Identity verification',
      description: 'Verify your identity for enhanced security',
      pending: 'Pending',
      inProgress: 'In progress',
      verified: 'Verified',
      failed: 'Failed',
      expired: 'Expired',
      startVerification: 'Start verification',
      verificationRequired: 'Verification required',
    },
    // Doctor availability
    availability: {
      title: 'Availability',
      schedule: 'Schedule',
      scheduled: 'Scheduled',
      confirmed: 'Confirmed',
      cancelled: 'Cancelled',
      completed: 'Completed',
      live: 'Live',
      consultation: 'Consultation',
      officeHours: 'Office hours',
      notifySubscribers: 'Notify subscribers',
    },
    // Footer
    footer: {
      platform: 'Continuing medical education platform',
      termsOfService: 'Terms of Service',
      privacyPolicy: 'Privacy Policy',
      contact: 'Contact',
      copyright: '© 2026 Medical Masters. All rights reserved.',
    },
  },
} as const;

export type TranslationKey = keyof typeof translations.es;

export function getTranslations(language: SupportedLanguage) {
  return translations[language];
}

export function t(language: SupportedLanguage, path: string): string {
  const keys = path.split('.');
  let result: any = translations[language];
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      console.warn(`Translation missing for: ${path}`);
      return path;
    }
  }
  
  return typeof result === 'string' ? result : path;
}
