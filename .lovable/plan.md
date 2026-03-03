
# Plan: Arreglar menu "Mas" vacio para visitantes en movil

## Problema
Cuando un visitante (no logueado) toca el boton "Mas" (3 bolitas) en movil, el sheet se abre pero aparece vacio -- solo se ve el logo y el boton de login. Esto pasa porque:
1. `moreNavItems` filtra los items que ya estan en los bottom tabs, y para visitor Lives y Noticias ya estan ahi, asi que queda vacio
2. La seccion "Cuenta" esta oculta para visitors

## Solucion

### Archivo: `src/components/layout/MainLayout.tsx`

Agregar contenido visible al More sheet cuando el usuario es visitante:

1. **Agregar links utiles para visitantes** debajo del boton de login:
   - "Para Doctores" -> `/for-doctors`
   - "Para Pacientes" -> `/for-patients`
   - "Casos de Exito" -> `/success-stories`
   - "Contacto" -> `/contact`
   - "Ayuda" -> `/help`

2. **Estructura del bloque visitor en el More sheet** (lineas 575-583):
   - Mantener el login prompt existente
   - Agregar una seccion "Explorar" con los links de arriba
   - Agregar seccion "Legal" con links a Terminos, Privacidad
   - Esto llena el sheet con opciones relevantes para visitantes

3. **Agregar el bloque justo despues del login prompt** (despues de linea 583), condicionado a `role === 'visitor' || (!isAuthenticated && !role)`:

```text
Explorar:
  - Para Doctores (Stethoscope icon)
  - Para Pacientes (User icon)
  - Casos de Exito (Star icon)
  - Contacto (Mail icon)
  - Ayuda (HelpCircle icon)

Legal:
  - Terminos (FileText icon)
  - Privacidad (Shield icon)
```

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/MainLayout.tsx` | Agregar links de exploracion y legales al More sheet para visitantes |
