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

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma el cambio de correo en Medical Masters</Preview>
    <Body style={main}>
      <Container style={wrapper}>
        <Section style={header}>
          <Img
            src="https://medical-masters.com/email-logo-white.png"
            width="180"
            alt="Medical Masters"
            style={{ margin: '0 auto' }}
          />
        </Section>
        <Section style={content}>
          <Heading style={h1}>Confirma el cambio de correo</Heading>
          <Text style={text}>
            Solicitaste cambiar tu correo electrónico en Medical Masters de{' '}
            <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
            a{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>Haz clic en el botón para confirmar este cambio:</Text>
          <Button style={button} href={confirmationUrl}>
            Confirmar cambio de correo
          </Button>
          <Text style={footerNote}>
            Si no solicitaste este cambio, protege tu cuenta de inmediato.
          </Text>
        </Section>
        <Section style={footerBar}>
          <Text style={footerText}>© 2026 Medical Masters. Todos los derechos reservados.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
