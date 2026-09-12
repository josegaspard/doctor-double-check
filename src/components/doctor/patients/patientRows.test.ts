import { describe, it, expect } from 'vitest';
import {
  parsePatientText,
  detectDelimiter,
  cleanPhone,
  validatePatientRow,
  INVITE_MAX_ROWS,
} from './patientRows';

describe('patientRows · lectura de la lista del médico', () => {
  it('pegado desde Excel con cabecera en castellano (nombre + apellidos)', () => {
    const text =
      'Nombre\tApellidos\tCorreo electrónico\tTeléfono\tNotas\n' +
      'Ana-Luisa\tRuiz Pérez\t ANA@Mail.com \t55 1234 5678\tControl mensual\n';
    const r = parsePatientText(text);
    expect(r.delimiter).toBe('\t');
    expect(r.hasHeader).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      full_name: 'Ana-Luisa Ruiz Pérez',
      email: 'ana@mail.com',
      phone: '5512345678',
      note: 'Control mensual',
      issue: null,
      line: 2,
    });
  });

  it('CSV con punto y coma, comillas escapadas, salto de línea dentro de comillas y BOM', () => {
    const text = '\uFEFFnombre;correo;telefono;nota\r\n"López, María";maria@x.mx;;"Dice ""hola""\ny adiós"\r\n';
    expect(detectDelimiter(text)).toBe(';');
    const r = parsePatientText(text);
    expect(r.hasHeader).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].full_name).toBe('López, María');
    expect(r.rows[0].email).toBe('maria@x.mx');
    expect(r.rows[0].phone).toBeNull();
    expect(r.rows[0].note).toBe('Dice "hola" y adiós');
    expect(r.rows[0].issue).toBeNull();
  });

  it('sin cabecera deduce las columnas por el contenido', () => {
    const r = parsePatientText('Ana Ruiz,ana@x.com,5512345678\nLuis Mora,luis@x.com,+52 55 8765 4321\n');
    expect(r.hasHeader).toBe(false);
    expect(r.mapping.name).toBe(0);
    expect(r.mapping.email).toBe(1);
    expect(r.mapping.phone).toBe(2);
    expect(r.rows.map(x => x.phone)).toEqual(['5512345678', '+525587654321']);
    expect(r.rows.every(x => x.issue === null)).toBe(true);
  });

  it('marca inválidas y repetidas con las mismas reglas que la RPC', () => {
    const text = [
      'nombre,correo,telefono',
      'A,a@x.com,',
      'Beatriz,,',
      'Carlos,carlos@x,',
      'Diana,d@x.com,123',
      'Eva,eva@x.com,',
      'Eva Dos,EVA@x.com,',
      'Fer,,5512345678',
      'Fer Dos,,55-1234-5678',
      '',
    ].join('\n');
    const r = parsePatientText(text);
    expect(r.rows.map(x => x.issue)).toEqual([
      'name_missing',
      'contact_missing',
      'email_invalid',
      'phone_invalid',
      null,
      'repeated_in_file',
      null,
      'repeated_in_file',
    ]);
  });

  it('más de 500 filas se marca como demasiadas sin recortar la lista', () => {
    const lines = ['nombre,correo'];
    for (let i = 0; i <= INVITE_MAX_ROWS; i++) lines.push(`Persona ${i},p${i}@x.com`);
    const r = parsePatientText(lines.join('\n'));
    expect(r.rows).toHaveLength(INVITE_MAX_ROWS + 1);
    expect(r.tooMany).toBe(true);
  });

  it('el + solo vale al principio del teléfono y la nota larga no pasa', () => {
    expect(cleanPhone('55+12 34')).toBe('551234');
    expect(cleanPhone('+52 (55) 1234-5678')).toBe('+525512345678');
    expect(validatePatientRow({ full_name: 'Ana', email: 'a@x.com', phone: null, note: 'x'.repeat(501) })).toBe('note_too_long');
  });

  it('reconoce la fila de títulos en los 8 idiomas de la app (la misma que enseña el ejemplo de pegado)', () => {
    const cabeceras: Record<string, string> = {
      es: 'Nombre\tCorreo\tTeléfono\tNota',
      en: 'Name\tEmail\tPhone\tNote',
      pt: 'Nome\tE-mail\tTelefone\tNota',
      fr: 'Nom\tE-mail\tTéléphone\tNote',
      it: 'Nome\tE-mail\tTelefono\tNota',
      de: 'Name\tE-Mail\tTelefon\tNotiz',
      ca: 'Nom\tCorreu\tTelèfon\tNota',
      zh: '姓名\t邮箱\t电话\t备注',
    };
    for (const [lang, header] of Object.entries(cabeceras)) {
      const r = parsePatientText(`${header}\nAna Ruiz\tana@x.com\t5512345678\tControl\n`);
      expect(r.hasHeader, lang).toBe(true);
      expect(r.rows, lang).toHaveLength(1);
      expect(r.rows[0], lang).toMatchObject({
        full_name: 'Ana Ruiz',
        email: 'ana@x.com',
        phone: '5512345678',
        note: 'Control',
        issue: null,
      });
    }
  });

  it('nombre y apellido en columnas separadas (Prénom / Nom, Vorname / Nachname)', () => {
    const fr = parsePatientText('Prénom;Nom;Courriel;Portable\nMarie;Dupont;marie@x.fr;0612345678\n');
    expect(fr.rows[0]).toMatchObject({ full_name: 'Marie Dupont', email: 'marie@x.fr', phone: '0612345678', issue: null });
    const de = parsePatientText('Vorname,Nachname,E-Mail,Telefon\nJonas,Müller,jonas@x.de,01511234567\n');
    expect(de.rows[0]).toMatchObject({ full_name: 'Jonas Müller', email: 'jonas@x.de', phone: '01511234567', issue: null });
  });
});
