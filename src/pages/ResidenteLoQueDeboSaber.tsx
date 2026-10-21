import { Link } from 'react-router-dom';
import {
  GraduationCap, IdCard, Calculator, Scale, ShieldCheck, FileText,
  Landmark, Stethoscope, ChevronRight, MessageCircle,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';

// "Lo que debo saber" para el RESIDENTE de último año (cliente 21-oct-2026): el
// residente que está por terminar y ejercer como médico en México necesita, a la
// mano, los trámites y asesores clave (cédula, contador/SAT, abogado, seguro,
// COFEPRIS). Contenido informativo y general: no sustituye la asesoría de un
// profesional, y por eso NO inventamos nombres, precios ni despachos concretos.

interface Tema {
  icon: React.ElementType;
  titulo: string;
  resumen: string;
  puntos: string[];
  asesor: string;
}

const TEMAS: Tema[] = [
  {
    icon: IdCard,
    titulo: 'Cédula profesional',
    resumen: 'Sin cédula no puedes ejercer ni firmar recetas. Es lo primero.',
    puntos: [
      'Al terminar la residencia tramitas la cédula de especialista ante la Dirección General de Profesiones (SEP).',
      'Reúne tu título de especialidad, el diploma del CONACEM si tu especialidad lo requiere y tu identificación.',
      'Guarda tu número de cédula: lo vas a necesitar para facturar, para tu perfil y para cada receta.',
    ],
    asesor: 'Trámite SEP / tu hospital o universidad',
  },
  {
    icon: Calculator,
    titulo: 'Contador y SAT',
    resumen: 'Vas a cobrar como profesional: necesitas RFC, régimen fiscal y facturar.',
    puntos: [
      'Date de alta en el SAT con tu RFC y elige régimen (muchos médicos empiezan en RESICO de personas físicas por su tasa baja).',
      'Para cobrar a pacientes y a hospitales tendrás que emitir CFDI (facturas). Un contador te configura esto en minutos.',
      'Separa tus ingresos del dinero personal desde el primer mes y aparta para el ISR: te evita sustos en la declaración.',
    ],
    asesor: 'Contador público',
  },
  {
    icon: Scale,
    titulo: 'Legal y responsabilidad',
    resumen: 'El consentimiento informado y el expediente clínico te protegen.',
    puntos: [
      'El expediente clínico es obligatorio y se rige por la NOM-004-SSA3: documenta todo, siempre.',
      'Usa consentimiento informado por escrito en procedimientos: es tu mejor defensa ante una queja.',
      'Antes de firmar contratos con hospitales o clínicas, pídele a un abogado que revise cláusulas de exclusividad y responsabilidad.',
    ],
    asesor: 'Abogado (salud / civil)',
  },
  {
    icon: ShieldCheck,
    titulo: 'Seguro de responsabilidad civil',
    resumen: 'Cubre tu patrimonio si surge una demanda por mala práctica.',
    puntos: [
      'Contrata un seguro de responsabilidad civil profesional médica antes de atender por tu cuenta.',
      'Revisa la suma asegurada, si cubre tu especialidad y si incluye defensa jurídica.',
      'Algunos hospitales lo exigen para darte privilegios: tenlo listo antes de postularte.',
    ],
    asesor: 'Agente de seguros',
  },
  {
    icon: FileText,
    titulo: 'COFEPRIS y permisos',
    resumen: 'Si vas a tener consultorio o manejar ciertos insumos, hay avisos que presentar.',
    puntos: [
      'Un consultorio propio requiere aviso de funcionamiento y responsable sanitario ante COFEPRIS.',
      'Para recetar medicamentos controlados necesitas tu recetario y código de barras correspondiente.',
      'Verifica los requisitos locales de tu estado: cambian de una entidad a otra.',
    ],
    asesor: 'Gestoría sanitaria',
  },
  {
    icon: Landmark,
    titulo: 'Finanzas personales',
    resumen: 'El primer sueldo de especialista es el momento de ordenar el dinero.',
    puntos: [
      'Arma un fondo de emergencia de tres a seis meses de gastos.',
      'Si vas a invertir en equipo o consultorio, compara crédito y arrendamiento con tu contador.',
      'Automatiza el ahorro y el apartado de impuestos el mismo día que cobras.',
    ],
    asesor: 'Asesor financiero',
  },
];

export default function ResidenteLoQueDeboSaber() {
  return (
    <MainLayout>
      <header className="relative pt-20 sm:pt-28 pb-10 sm:pb-16 bg-gradient-to-br from-secondary via-primary to-secondary overflow-hidden">
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-light/20 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/20 backdrop-blur-sm mb-4">
            <GraduationCap className="w-4 h-4 text-light" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">Residentes · Último año</span>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Lo que debo saber antes de ejercer
          </h1>
          <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto">
            Estás por terminar tu residencia. Esto es lo que conviene resolver para ejercer
            como médico en México: trámites, dinero, legal y los asesores que te ayudan.
          </p>
        </div>
      </header>

      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 max-w-4xl">
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
            {TEMAS.map((tema) => {
              const Icon = tema.icon;
              return (
                <article key={tema.titulo} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-heading text-lg font-bold text-foreground leading-tight">{tema.titulo}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{tema.resumen}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {tema.puntos.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/90">
                        <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 rounded-full px-3 py-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Asesor: {tema.asesor}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Asesores a la mano */}
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center">
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">¿Necesitas un asesor?</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-5">
              Si quieres que te pongamos en contacto con un contador, abogado o asesor de seguros
              con experiencia en el gremio médico, escríbenos y te orientamos.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4" />
              Contactar a un asesor
            </Link>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6 max-w-2xl mx-auto">
            Esta guía es informativa y general. No sustituye la asesoría de un contador, abogado o
            especialista. Verifica siempre los requisitos vigentes de tu estado y especialidad.
          </p>
        </div>
      </section>
    </MainLayout>
  );
}
