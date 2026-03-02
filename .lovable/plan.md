

# Plan: Optimizacion UX/UI Movil + Vault + Footer Unificado

## 1. Barra flotante de eliminacion masiva - Optimizacion movil

**Problema**: La barra de eliminacion masiva en movil se ve mal cuando hay muchos items seleccionados (Notificaciones, Chat, Recetas, Grabaciones).

**Solucion**: Estandarizar la barra flotante de eliminacion masiva en todos los modulos para que:
- Use `fixed bottom-20` (sobre la barra de navegacion inferior) con bordes redondeados
- Fondo con efecto glassmorphism (`bg-card/95 backdrop-blur-lg`)
- Ancho limitado y centrado (`max-w-sm mx-auto`)
- Sombra elevada para que se distinga del contenido
- Padding seguro con `safe-area-inset-bottom`

**Archivos a modificar**:
- `src/pages/Notifications.tsx` - Ya tiene un patron similar, refinar estilos
- `src/components/chat/ChatSessionsList.tsx` - La barra esta dentro de un Card, moverla a `fixed`
- `src/components/prescriptions/PrescriptionsList.tsx` - Si tiene bulk delete, aplicar mismo patron

---

## 2. Vault Medico - Mejora completa UX/UI

**Problema**: La interfaz del Vault no es lo suficientemente intuitiva y la descripcion no es obligatoria al subir archivos.

**Cambios en `src/pages/Vault.tsx`**:

### Descripcion obligatoria
- Agregar validacion: el boton "Seleccionar Archivo" se deshabilita si la descripcion esta vacia
- Mostrar un hint visual debajo del campo: "Describe brevemente tu estudio (obligatorio)"
- Marcar el campo con un asterisco rojo

### Mejoras UX/UI generales
- **Zona de upload mejorada**: Cambiar el boton plano por una zona de drop con icono grande, texto claro y borde punteado para que sea mas intuitivo
- **Instrucciones claras**: Texto explicativo paso a paso: "1. Selecciona la categoria, 2. Describe tu estudio, 3. Selecciona el archivo"
- **Cards de archivos mejoradas**: Mostrar fecha siempre (incluso en movil), mejorar los botones de accion con iconos mas grandes y etiquetas claras
- **Empty state mejorado**: Agregar una ilustracion mas clara y un boton CTA directo para subir el primer archivo
- **Vista previa en movil**: Asegurar que los botones "Permisos" y "Eliminar" tengan touch targets de 44px+

---

## 3. Layout interno movil - Consistencia general

**Problema**: Algunas paginas internas se "descuadran" en movil.

**Cambios en `src/components/layout/MainLayout.tsx`**:
- Asegurar que `main` tenga `overflow-x-hidden` para prevenir scroll horizontal
- Agregar `min-h-[calc(100vh-56px-72px)]` al main content en movil para evitar que el contenido "flote"

**Revision global**:
- Verificar que todas las paginas usen `container mx-auto px-3 sm:px-4` de forma consistente
- Asegurar que los headers de pagina no desborden en pantallas pequenas (truncate en titulos)

---

## 4. Footer unificado inteligente

**Problema**: El footer del landing (`LandingFooter`) tiene redes sociales y links utiles, y el footer del app (`MainLayout`) tiene links legales y redes sociales, pero son independientes. Se quiere un footer unificado configurable desde el admin.

**Solucion**: Crear un componente `UnifiedFooter` que:
- Se use tanto en `LandingFooter` como en el footer de `MainLayout`
- Lea la configuracion desde `site_settings` (redes sociales ya existe, agregar links del footer)
- En la **landing**: Muestre el footer completo con columnas (Plataforma, Recursos, Legal, Redes)
- En la **app**: Muestre una version compacta con links legales + redes sociales + copyright
- Todo editable desde el panel de admin

### Nueva entrada en `site_settings`

Crear una nueva entrada `footer_links` en `site_settings` via migracion SQL:

```text
id: footer_links
value: {
  platform: [
    { label: "Para Doctores", href: "/for-doctors" },
    { label: "Para Pacientes", href: "/for-patients" },
    { label: "Empresas", href: "/enterprise" }
  ],
  resources: [
    { label: "Casos de Exito", href: "/success-stories" },
    { label: "Ayuda", href: "/help" },
    { label: "Contacto", href: "/contact" }
  ],
  legal: [
    { label: "Privacidad", href: "/privacy" },
    { label: "Terminos", href: "/terms" },
    { label: "Seguridad", href: "/security" },
    { label: "Cumplimiento", href: "/compliance" },
    { label: "Reportar", href: "/report-issue" }
  ],
  copyright: "2024 Medical Masters. Todos los derechos reservados.",
  show_status_badge: true
}
```

### Nuevos archivos
- `src/components/layout/UnifiedFooter.tsx` - Componente reutilizable con props `variant="landing" | "app"`
- `src/hooks/useFooterLinks.ts` - Hook para cargar links del footer desde site_settings

### Archivos a modificar
- `src/components/landing/LandingFooter.tsx` - Reemplazar contenido hardcodeado por `UnifiedFooter variant="landing"`
- `src/components/layout/MainLayout.tsx` - Reemplazar footer actual por `UnifiedFooter variant="app"`
- `src/pages/AdminSiteSettings.tsx` - Agregar nueva tab "Footer" para editar los links del footer

### Panel Admin - Editor de Footer
Agregar una nueva pestana en AdminSiteSettings:
- Secciones editables: Plataforma, Recursos, Legal (agregar/quitar/reordenar links)
- Cada link tiene: label (texto), href (ruta)
- Toggle para mostrar/ocultar badge de "Todos los sistemas operativos"
- Campo editable para el texto de copyright
- Vista previa en vivo del footer

---

## Resumen de archivos

**Nuevos archivos (2)**:
- `src/components/layout/UnifiedFooter.tsx`
- `src/hooks/useFooterLinks.ts`

**Archivos modificados (6)**:
- `src/pages/Vault.tsx` - Descripcion obligatoria + mejoras UX/UI completas
- `src/pages/Notifications.tsx` - Barra flotante de delete mejorada
- `src/components/chat/ChatSessionsList.tsx` - Barra flotante de delete consistente
- `src/components/layout/MainLayout.tsx` - Overflow fix + footer unificado
- `src/components/landing/LandingFooter.tsx` - Usar UnifiedFooter
- `src/pages/AdminSiteSettings.tsx` - Tab de edicion de footer

**Migracion SQL (1)**:
- Insertar `footer_links` en `site_settings`

