/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  userRole?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  userRole,
}: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>
      {userRole === 'doctor'
        ? 'Confirma tu correo y comienza tu proceso de verificación'
        : userRole === 'resident'
        ? 'Confirma tu correo y accede a beneficios exclusivos para residentes'
        : 'Confirma tu correo para Medical Masters'}
    </Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Img
            src="https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/email-assets/logo-white.png"
            width="180"
            alt="Medical Masters"
            style={{ margin: '0 auto' }}
          />
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            {userRole === 'doctor'
              ? '¡Bienvenido, Doctor!'
              : userRole === 'resident'
              ? '¡Bienvenido, Residente!'
              : '¡Bienvenido a Medical Masters!'}
          </Heading>
          <Text style={text}>
            Gracias por registrarte en{' '}
            <Link href={siteUrl} style={link}>
              <strong>Medical Masters</strong>
            </Link>
            .
          </Text>
          <Text style={text}>
            Confirma tu dirección de correo (
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
            ) haciendo clic en el botón:
          </Text>
          <Button style={button} href={confirmationUrl}>
            Verificar correo electrónico
          </Button>

          {/* Doctor onboarding section */}
          {userRole === 'doctor' && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={h2}>📋 Tu proceso de verificación</Heading>
              <Text style={text}>
                Tu solicitud de registro como médico está siendo revisada por nuestro equipo. Aquí te explicamos los pasos:
              </Text>

              <Section style={stepBox}>
                <Text style={stepTitle}>✅ Paso 1 — Confirma tu correo</Text>
                <Text style={stepText}>Haz clic en el botón de arriba para verificar tu dirección de correo electrónico.</Text>
              </Section>

              <Section style={stepBox}>
                <Text style={stepTitle}>🔍 Paso 2 — Verificación de cédula profesional</Text>
                <Text style={stepText}>Durante el onboarding podrás ingresar tu cédula profesional para verificación automática con la SEP.</Text>
              </Section>

              <Section style={stepBox}>
                <Text style={stepTitle}>👨‍⚕️ Paso 3 — Revisión por el equipo</Text>
                <Text style={stepText}>Nuestro equipo revisará tu documentación. Este proceso toma entre 24 y 48 horas hábiles.</Text>
              </Section>

              <Section style={stepBox}>
                <Text style={stepTitle}>🚀 Paso 4 — ¡Listo para empezar!</Text>
                <Text style={stepText}>Una vez aprobado, podrás acceder a todas las funciones de la plataforma.</Text>
              </Section>

              <Heading as="h2" style={h2}>¿Qué podrás hacer como médico verificado?</Heading>
              <Text style={featureItem}>📡 Transmisiones en vivo para tus seguidores</Text>
              <Text style={featureItem}>💬 Consultas médicas por chat y videollamada</Text>
              <Text style={featureItem}>📚 Publicar contenido educativo exclusivo</Text>
              <Text style={featureItem}>📝 Emitir recetas digitales firmadas</Text>
              <Text style={featureItem}>💰 Recibir pagos directamente en tu cuenta</Text>
              <Text style={featureItem}>📰 Publicar artículos en noticias médicas</Text>
            </>
          )}

          {/* Resident onboarding section */}
          {userRole === 'resident' && (
            <>
              <Hr style={divider} />
              <Heading as="h2" style={h2}>🎓 Información para residentes</Heading>
              <Text style={text}>
                Tu solicitud de registro como residente médico está siendo revisada. Esto es lo que debes saber:
              </Text>

              <Section style={stepBox}>
                <Text style={stepTitle}>✅ Paso 1 — Confirma tu correo</Text>
                <Text style={stepText}>Haz clic en el botón de arriba para verificar tu dirección de correo electrónico.</Text>
              </Section>

              <Section style={stepBox}>
                <Text style={stepTitle}>👨‍⚕️ Paso 2 — Revisión de documentación</Text>
                <Text style={stepText}>Nuestro equipo verificará tu información institucional. El proceso toma entre 24 y 48 horas hábiles.</Text>
              </Section>

              <Section style={stepBox}>
                <Text style={stepTitle}>🎉 Paso 3 — ¡Acceso con beneficios!</Text>
                <Text style={stepText}>Una vez aprobado, tendrás acceso a la plataforma con descuentos exclusivos.</Text>
              </Section>

              <Heading as="h2" style={h2}>Beneficios exclusivos para residentes</Heading>
              <Text style={featureItem}>🏷️ 50% de descuento en todo el contenido</Text>
              <Text style={featureItem}>📡 Acceso a transmisiones en vivo</Text>
              <Text style={featureItem}>📚 Biblioteca de contenido educativo</Text>
              <Text style={featureItem}>👥 Grupos de estudio con otros residentes</Text>
            </>
          )}

          <Text style={footerNote}>
            Si no creaste una cuenta, puedes ignorar este correo.
          </Text>
        </Section>
        <Section style={footerBar}>
          <Text style={footerText}>© 2026 Medical Masters. Todos los derechos reservados.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Plus Jakarta Sans', Arial, sans-serif", padding: '20px 0' }
const wrapper = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const, boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }
const header = { background: 'linear-gradient(135deg, #163a83, #00768b)', padding: '32px 24px', textAlign: 'center' as const }
const content = { padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0b1d45', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const h2 = { fontSize: '18px', fontWeight: 'bold' as const, color: '#0b1d45', margin: '24px 0 12px', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#3d4f6f', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#163a83', textDecoration: 'underline' }
const button = { backgroundColor: '#163a83', color: '#ffffff', fontSize: '15px', borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', fontWeight: '600' as const }
const divider = { borderColor: '#e2e8f0', margin: '28px 0' }
const stepBox = { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid #e2e8f0' }
const stepTitle = { fontSize: '15px', fontWeight: '600' as const, color: '#0b1d45', margin: '0 0 4px' }
const stepText = { fontSize: '14px', color: '#3d4f6f', lineHeight: '1.5', margin: '0' }
const featureItem = { fontSize: '14px', color: '#3d4f6f', lineHeight: '1.6', margin: '0 0 8px', paddingLeft: '4px' }
const footerNote = { fontSize: '13px', color: '#7a8aaa', margin: '28px 0 0' }
const footerBar = { backgroundColor: '#f0f5f7', padding: '16px 24px', textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#7a8aaa', margin: '0' }
