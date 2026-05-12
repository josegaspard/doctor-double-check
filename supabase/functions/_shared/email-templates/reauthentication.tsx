/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación - Medical Masters</Preview>
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
          <Heading style={h1}>Código de verificación</Heading>
          <Text style={text}>Usa el siguiente código para confirmar tu identidad:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footerNote}>
            Este código expirará en breve. Si no lo solicitaste, puedes ignorar este correo.
          </Text>
        </Section>
        <Section style={footerBar}>
          <Text style={footerText}>© 2026 Medical Masters. Todos los derechos reservados.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#f0f5f7', fontFamily: "'Inter', 'Plus Jakarta Sans', Arial, sans-serif", padding: '20px 0' }
const wrapper = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const, boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }
const header = { background: 'linear-gradient(135deg, #163a83, #00768b)', padding: '32px 24px', textAlign: 'center' as const }
const content = { padding: '32px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0b1d45', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#3d4f6f', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = { fontFamily: "'Courier New', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#163a83', margin: '0 0 30px', letterSpacing: '4px', textAlign: 'center' as const }
const footerNote = { fontSize: '13px', color: '#7a8aaa', margin: '28px 0 0' }
const footerBar = { backgroundColor: '#f0f5f7', padding: '16px 24px', textAlign: 'center' as const }
const footerText = { fontSize: '12px', color: '#7a8aaa', margin: '0' }
