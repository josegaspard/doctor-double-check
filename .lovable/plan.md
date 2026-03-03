

# Plan: Enriquecer sección de onboarding para residentes en el correo de confirmación

## Estado actual
La sección de residente ya existe pero es más básica que la del doctor (3 pasos vs 4, y solo 4 beneficios genéricos).

## Cambios en `supabase/functions/_shared/email-templates/signup.tsx`

Expandir la sección de residente (líneas 117-147) para incluir:

### Pasos de onboarding (de 3 a 4)
1. ✅ Confirma tu correo
2. 🏥 Completa tu perfil institucional (institución, especialidad, año de residencia)
3. 👨‍⚕️ Revisión por el equipo (24-48h)
4. 🎉 ¡Acceso con beneficios exclusivos!

### Beneficios ampliados (de 4 a 7)
- 🏷️ **50% de descuento** en orientaciones médicas, contenido premium y grabaciones
- 📡 Acceso a transmisiones en vivo de especialistas
- 📚 Biblioteca de contenido educativo
- 👥 Grupos de estudio y networking con otros residentes
- 💬 Chat de colaboración profesional con doctores
- 🎓 Acceso a Meets Médicos y sesiones clínicas
- 💰 Recarga saldo en tu wallet para acceder a contenido con descuento

### Destacado de descuento
Agregar un box visual destacado (similar a `stepBox` pero con fondo de acento) que resalte el **50% de descuento automático** en todas las transacciones.

## Archivo a modificar
- `supabase/functions/_shared/email-templates/signup.tsx` — expandir sección residente
- Redesplegar `auth-email-hook`

