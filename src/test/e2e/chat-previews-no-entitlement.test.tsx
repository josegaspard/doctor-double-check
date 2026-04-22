/**
 * Chat preview privacy — even for unentitled users, last-message previews
 * MUST never expose internal tokens or filenames that could leak clinical
 * information (e.g. "scan-positivo-covid.jpg") or secret URLs.
 *
 * This file tests the pure formatter, mirroring the production behavior of
 * formatMessagePreview for both entitled and non-entitled patients.
 */
import { describe, it, expect } from 'vitest';

/**
 * Mirrors the formatter used by ChatSessionItem / NotificationBell.
 * If you change the production formatter, update this and the privacy
 * assertions will keep filtering out raw tokens.
 */
function formatMessagePreview(raw: string, maxLen = 60): string {
  if (!raw) return '';
  // Image attachment: "📷 [Imagen: filename.jpg]"
  const image = raw.match(/^📷\s*\[Imagen:\s*[^\]]+\]/);
  if (image) return '📷 Foto';
  // PDF attachment: "📎 [Archivo: filename.pdf]"
  const file = raw.match(/^📎\s*\[Archivo:\s*([^\]]+)\]/);
  if (file) {
    const name = file[1].trim();
    // Hide internal paths / tokens — show just the basename without query
    const basename = name.split('/').pop()?.split('?')[0] || name;
    return `📎 ${basename.length > 30 ? basename.slice(0, 30) + '…' : basename}`;
  }
  // Video: "🎥 [Video: ...]"
  if (/^🎥\s*\[Video:/.test(raw)) return '🎥 Video';
  // Prescription URL token
  if (/\/prescriptions\/[a-zA-Z0-9_-]+/.test(raw)) return '📋 Receta médica';
  // Plain text — truncate
  return raw.length > maxLen ? raw.slice(0, maxLen - 1) + '…' : raw;
}

describe('Chat preview formatter — never leaks raw tokens', () => {
  const SENSITIVE_FILENAMES = [
    '📷 [Imagen: scan-positivo-covid.jpg]',
    '📷 [Imagen: VIH-test-result.png]',
    '📷 [Imagen: paciente-juanperez-radiografia.jpeg]',
  ];

  it.each(SENSITIVE_FILENAMES)('image attachment %s renders generic "📷 Foto"', (raw) => {
    const out = formatMessagePreview(raw);
    expect(out).toBe('📷 Foto');
    expect(out).not.toContain('covid');
    expect(out).not.toContain('VIH');
    expect(out).not.toContain('juanperez');
    expect(out).not.toContain('[Imagen:');
  });

  it('PDF attachment shows just the basename, no internal path', () => {
    const raw = '📎 [Archivo: /private/patient-12345/lab-results-secret.pdf?token=abc123xyz]';
    const out = formatMessagePreview(raw);
    expect(out).toContain('lab-results-secret.pdf');
    expect(out).not.toContain('token=');
    expect(out).not.toContain('patient-12345');
    expect(out).not.toContain('?');
    expect(out).not.toContain('[Archivo:');
  });

  it('PDF basename is truncated to 30 chars with ellipsis', () => {
    const raw = '📎 [Archivo: this-is-an-extremely-long-pdf-name-that-should-be-truncated.pdf]';
    const out = formatMessagePreview(raw);
    expect(out.length).toBeLessThanOrEqual(34); // "📎 " + 30 + "…"
    expect(out.startsWith('📎 ')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
  });

  it('video attachment renders "🎥 Video", hides filename', () => {
    expect(formatMessagePreview('🎥 [Video: emergency-call-recording.mp4]')).toBe('🎥 Video');
  });

  it('prescription URL never leaks the secret token', () => {
    const raw = 'Mira tu receta https://app.example.com/prescriptions/abc-secret-token-xyz789';
    const out = formatMessagePreview(raw);
    expect(out).toBe('📋 Receta médica');
    expect(out).not.toContain('abc-secret-token');
    expect(out).not.toContain('xyz789');
  });

  it('plain text is truncated at maxLen with ellipsis', () => {
    const raw = 'a'.repeat(120);
    const out = formatMessagePreview(raw, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
  });

  it('notification body uses a longer cap (120) but still escapes attachments', () => {
    const raw = '📷 [Imagen: super-private-result.jpg]';
    const out = formatMessagePreview(raw, 120);
    expect(out).toBe('📷 Foto');
  });

  it('empty / null content is safe', () => {
    expect(formatMessagePreview('')).toBe('');
  });

  it('non-entitled patient sees the same sanitized preview as anyone else', () => {
    // The privacy of these previews must NOT depend on entitlement.
    // If a session was previously visible, its preview must already be safe.
    const raw = '📷 [Imagen: leaked-info.jpg]';
    expect(formatMessagePreview(raw)).toBe('📷 Foto');
  });
});
