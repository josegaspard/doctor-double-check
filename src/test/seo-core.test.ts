import { describe, it, expect } from 'vitest';
import {
  buildHeadHtml, buildRobotsTxt, buildSitemapXml, cleanVerificationCode, congressEntity, createDefaultSeoConfig,
  doctorEntity, formatDateEs, injectHead, matchRoute, mergeSeoConfig, normalizePath, renderTemplate, resolveSeo,
  safeUrl, sanitizeRobotsExtra, SEO_MARK_END, SEO_MARK_START,
} from '../../supabase/functions/_shared/seo-render.ts';

const PATRICIA = '8c5838ea-6e2a-47ca-8110-f679e2a3428e';

describe('plantillas', () => {
  it('quita los segmentos entre corchetes cuya variable está vacía', () => {
    const tpl = createDefaultSeoConfig().types.doctor.descriptionTemplate;
    const out = renderTemplate(tpl, { nombre: 'Dra. Patricia', especialidad: 'Nutriología', ciudad: 'Puebla', bio: '', sitio: 'Medical Masters' });
    expect(out).toBe('Dra. Patricia, Nutriología en Puebla. Perfil profesional en Medical Masters.');
    const sinCiudad = renderTemplate(tpl, { nombre: 'Dr. Ruiz', especialidad: '', ciudad: '', bio: '', sitio: 'Medical Masters' });
    expect(sinCiudad).toBe('Dr. Ruiz. Perfil profesional en Medical Masters.');
  });

  it('las fechas `date` de un congreso no se corren un día por la zona horaria', () => {
    expect(formatDateEs('2026-09-12')).toBe('12 de septiembre de 2026');
    const c = congressEntity({ id: PATRICIA, title: 'Congreso', starts_at: '2026-09-12', ends_at: '2026-09-14' });
    expect(c.vars.inicio).toBe('12 de septiembre de 2026');
    expect(c.vars.fin).toBe('14 de septiembre de 2026');
  });
});

describe('rutas', () => {
  it('normaliza y clasifica', () => {
    expect(normalizePath('/doctors/?x=1#a')).toBe('/doctors');
    expect(matchRoute('/doctor/dashboard').kind).toBe('private');
    expect(matchRoute(`/doctor/${PATRICIA}`)).toMatchObject({ kind: 'entity', type: 'doctor', id: PATRICIA });
    expect(matchRoute('/doctores')).toMatchObject({ kind: 'alias', target: '/doctors' });
    expect(matchRoute('/news/nuevo-tratamiento-2026')).toMatchObject({ kind: 'entity', type: 'news' });
    expect(matchRoute('/admin/seo').kind).toBe('private');
  });
});

describe('resolver', () => {
  const config = createDefaultSeoConfig();

  it('sin tocar nada reproduce el estado anterior: solo la home abierta a Google', () => {
    const home = resolveSeo(config, '/');
    expect(home.index).toBe(true);
    expect(home.title).toBe('Medical Masters | Plataforma de Médicos Especialistas Certificados');
    expect(resolveSeo(config, '/doctors').index).toBe(false);
    expect(resolveSeo(config, `/doctor/${PATRICIA}`, doctorEntity({ user_id: PATRICIA, name: 'Dra. Patricia' })).index).toBe(false);
  });

  it('la personalización de una página gana a lo automático', () => {
    const c = createDefaultSeoConfig();
    c.pages['/doctors'] = { title: 'Médicos certificados', index: true };
    const r = resolveSeo(c, '/doctors');
    expect(r.title).toBe('Médicos certificados | Medical Masters');
    expect(r.index).toBe(true);
    expect(r.customized).toBe(true);
  });

  it('una zona privada nunca se abre a Google aunque la config lo pida', () => {
    const c = createDefaultSeoConfig();
    c.pages['/chat'] = { index: true, title: 'x' };
    expect(resolveSeo(c, '/chat').index).toBe(false);
    expect(mergeSeoConfig({ pages: { '/admin': { index: true } } }).pages['/admin']).toBeUndefined();
  });

  it('una ficha que no existe queda fuera de Google', () => {
    const c = createDefaultSeoConfig();
    c.types.doctor.index = true;
    expect(resolveSeo(c, `/doctor/${PATRICIA}`, { exists: false, vars: {} }).index).toBe(false);
    expect(resolveSeo(c, `/doctor/${PATRICIA}`, doctorEntity({ user_id: PATRICIA, name: 'Dra. Patricia', specialty: 'Nutriología' })).index).toBe(true);
  });

  it('un atajo apunta su canonical al destino y no se indexa', () => {
    const r = resolveSeo(config, '/doctores');
    expect(r.canonical).toBe('https://medical-masters.com/doctors');
    expect(r.index).toBe(false);
  });
});

describe('salida segura', () => {
  it('escapa el título y la descripción', () => {
    const c = createDefaultSeoConfig();
    c.pages['/help'] = { title: '</title><script>alert(1)</script>', description: '"><img src=x onerror=alert(1)>' };
    const head = buildHeadHtml(resolveSeo(c, '/help'));
    expect(head).not.toContain('<script>alert');
    expect(head).not.toContain('<img');
    expect(head.match(/<title>/g)).toHaveLength(1);
    c.pages['/help'] = { title: 'Salud & "bienestar"', description: 'Uno > dos' };
    const escaped = buildHeadHtml(resolveSeo(c, '/help'));
    expect(escaped).toContain('<title>Salud &amp; &quot;bienestar&quot; | Medical Masters</title>');
    expect(escaped).toContain('content="Uno &gt; dos"');
  });

  it('la descripción recortada termina en una frase entera', () => {
    const e = doctorEntity({
      user_id: PATRICIA, name: 'Dra. Patricia Morales Sánchez', specialty: 'Nutriología Clínica', location: 'Puebla',
      bio: 'Nutrióloga clínica, planes alimenticios personalizados, diabetes, obesidad y deporte. Atiende en línea y en consultorio desde hace diez años.',
    });
    const r = resolveSeo(createDefaultSeoConfig(), `/doctor/${PATRICIA}`, e);
    expect(r.description.length).toBeLessThanOrEqual(160);
    expect(r.description.endsWith('.')).toBe(true);
  });

  it('un texto con </script> no rompe el JSON-LD', () => {
    const c = createDefaultSeoConfig();
    const e = doctorEntity({ user_id: PATRICIA, name: 'Dra. X</script><script>alert(1)</script>', bio: 'bio' });
    const head = buildHeadHtml(resolveSeo(c, `/doctor/${PATRICIA}`, e));
    expect(head).not.toMatch(/<\/script><script>alert/);
  });

  it('solo acepta URLs http(s) o rutas propias', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('//evil.com/x.png')).toBe('');
    expect(safeUrl('/icon-512.png')).toBe('https://medical-masters.com/icon-512.png');
  });

  it('limpia los códigos de verificación y las reglas extra de robots', () => {
    expect(cleanVerificationCode('<meta name="google-site-verification" content="abc_123-XYZ" />')).toBe('abc_123-XYZ');
    expect(cleanVerificationCode('"><script>')).toBe('');
    expect(sanitizeRobotsExtra('Disallow: /tmp\n<script>alert(1)</script>\nUser-agent: GPTBot')).toEqual(['Disallow: /tmp', 'User-agent: GPTBot']);
  });

  it('descarta en la mezcla los valores con el tipo equivocado', () => {
    const c = mergeSeoConfig({ site: { name: 123, homeTitle: 'Nuevo' } });
    expect(c.site.name).toBe('Medical Masters');
    expect(c.site.homeTitle).toBe('Nuevo');
  });
});

describe('robots, sitemap e inyección', () => {
  it('robots.txt deja cargar /assets/ y abre /doctor/ sin abrir el panel del médico', () => {
    const c = createDefaultSeoConfig();
    const base = buildRobotsTxt(c);
    expect(base).toContain('Allow: /$');
    expect(base).toContain('Allow: /assets/');
    expect(base).toContain('Disallow: /');
    expect(base).not.toContain('Allow: /doctor/');
    c.types.doctor.index = true;
    const open = buildRobotsTxt(c);
    expect(open).toContain('Allow: /doctor/');
    expect(open).toContain('Disallow: /doctor/dashboard');
  });

  it('el sitemap escapa y no repite URLs', () => {
    const xml = buildSitemapXml([{ loc: 'https://medical-masters.com/a?b=1&c=2' }, { loc: 'https://medical-masters.com/a?b=1&c=2' }]);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toContain('&amp;c=2');
  });

  it('sustituye solo lo que hay entre las marcas', () => {
    const html = `<head><meta charset="UTF-8" />${SEO_MARK_START}<title>viejo</title>${SEO_MARK_END}<script src="/x.js"></script></head>`;
    const out = injectHead(html, '<title>nuevo</title>');
    expect(out).toContain('<title>nuevo</title>');
    expect(out).not.toContain('viejo');
    expect(out).toContain('<meta charset="UTF-8" />');
    expect(out).toContain('<script src="/x.js"></script>');
  });
});
