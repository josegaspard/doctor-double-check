/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
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
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma tu correo para Medical Masters</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Img
            src="https://jbthjpnxiwnegzgfzfth.supabase.co/storage/v1/object/public/email-assets/logo.png"
            width="180"
            alt="Medical Masters"
            style={{ margin: '0 auto' }}
          />
        </Section>
        <Section style={content}>
          <Heading style={h1}>¡Bienvenido a Medical Masters!</Heading>
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

const main = { backgroundColor: '#f0f5f7', fontFamily: "'Inter', 'Plus Jakarta Sans', Arial, sans-serif", padding: '20px 0' }
const wrapper = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const, boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }
const header = { background: 'linear-gradient(135deg, #163a83, #00768b)', padding: '32px 24px', textAlign: 'center' as const }
const content = { padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0b1d45', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#3d4f6f', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#163a83', textDecoration: 'underline' }
const button = { backgroundColor: '#163a83', color: '#ffffff', fontSize: '15px', borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', fontWeight: '600' as const }
const footerNote = { fontSize: '13px', color: '#7a8aaa', margin: '28px 0 0' }
const footerBar = { backgroundColor: '#f0f5f7', padding: '16px 24px', textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#7a8aaa', margin: '0' }
