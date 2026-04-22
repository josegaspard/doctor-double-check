import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatMessagePreview } from '@/lib/utils';

describe('Chat preview formatting (lists + notifications)', () => {
  it('formats image markers as 📷 Foto and never shows raw [Imagen:] token', () => {
    const inputs = [
      '📷 [Imagen: scan.jpg]',
      '[Imagen: x.png]',
      '[Image: photo.jpg]',
      '📷 [Foto: y.jpg]',
    ];
    inputs.forEach((raw) => {
      const out = formatMessagePreview(raw, 60);
      expect(out).toBe('📷 Foto');
      expect(out).not.toMatch(/\[Imagen:/i);
      expect(out).not.toMatch(/\[Image:/i);
    });
  });

  it('formats file markers as 📎 <name> with raw token stripped', () => {
    expect(formatMessagePreview('📎 [Archivo: estudio.pdf]', 60)).toBe('📎 estudio.pdf');
    expect(formatMessagePreview('[Archivo: lab.pdf]', 60)).toBe('📎 lab.pdf');
    expect(formatMessagePreview('[File: report.docx]', 60)).toBe('📎 report.docx');
    // Long names fall back to generic "📎 Archivo"
    expect(formatMessagePreview('[Archivo: a-very-long-file-name-that-exceeds-twenty-eight.pdf]', 60))
      .toBe('📎 Archivo');
    // Never leaks the raw bracket
    const out = formatMessagePreview('[Archivo: foo.pdf]', 60);
    expect(out).not.toMatch(/\[Archivo:/i);
  });

  it('formats video markers as 🎥 Video', () => {
    expect(formatMessagePreview('🎥 [Video: live.mp4]', 60)).toBe('🎥 Video');
    expect(formatMessagePreview('[Vídeo: x.mov]', 60)).toBe('🎥 Video');
  });

  it('formats audio markers as 🎤 Mensaje de voz', () => {
    expect(formatMessagePreview('🎤 [Audio: msg.m4a]', 60)).toBe('🎤 Mensaje de voz');
    expect(formatMessagePreview('[Voice: x.ogg]', 60)).toBe('🎤 Mensaje de voz');
  });

  it('formats prescription URLs and markers as 📋 Receta médica', () => {
    expect(formatMessagePreview('📋 https://app.example/prescriptions/abc-123', 60))
      .toBe('📋 Receta médica');
    expect(formatMessagePreview('[Receta]: ver detalles', 60)).toBe('📋 Receta médica');
    expect(formatMessagePreview('Mira tu receta: /prescriptions/xyz', 60))
      .toBe('📋 Receta médica');
  });

  it('truncates long plain text at the requested max length and adds ellipsis', () => {
    const long = 'a'.repeat(200);
    const short = formatMessagePreview(long, 60);
    expect(short).toHaveLength(63); // 60 + "..."
    expect(short.endsWith('...')).toBe(true);

    const notif = formatMessagePreview(long, 120);
    expect(notif).toHaveLength(123);
  });

  it('returns empty string for null/empty/whitespace inputs', () => {
    expect(formatMessagePreview(null, 60)).toBe('');
    expect(formatMessagePreview(undefined, 60)).toBe('');
    expect(formatMessagePreview('', 60)).toBe('');
    expect(formatMessagePreview('   ', 60)).toBe('');
  });

  it('keeps short normal text untouched (no token, no truncation)', () => {
    expect(formatMessagePreview('Hola doctor, tengo una duda', 60))
      .toBe('Hola doctor, tengo una duda');
  });

  it('renders cleanly inside a list item — no raw markers leak to DOM', () => {
    const messages = [
      '📷 [Imagen: scan.jpg]',
      '[Archivo: lab.pdf]',
      '[Video: x.mp4]',
      'https://x.com/prescriptions/abc',
    ];
    render(
      <ul>
        {messages.map((m, i) => (
          <li key={i} data-testid={`msg-${i}`}>
            {formatMessagePreview(m, 60)}
          </li>
        ))}
      </ul>
    );
    for (let i = 0; i < messages.length; i++) {
      const el = screen.getByTestId(`msg-${i}`);
      expect(el.textContent).not.toMatch(/\[Imagen:|\[Archivo:|\[Video:|\[File:/i);
    }
    expect(screen.getByTestId('msg-0').textContent).toBe('📷 Foto');
    expect(screen.getByTestId('msg-1').textContent).toBe('📎 lab.pdf');
    expect(screen.getByTestId('msg-2').textContent).toBe('🎥 Video');
    expect(screen.getByTestId('msg-3').textContent).toBe('📋 Receta médica');
  });
});
