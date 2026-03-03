

# Verificacion del flujo de registro doctor + correo de confirmacion

## Resultado del analisis

El flujo esta correctamente implementado. Aqui el recorrido completo:

### Flujo funcional (correcto)

```text
1. Doctor llena formulario en Login.tsx (nombre, email, password, role=doctor, specialty)
       ↓
2. supabase.auth.signUp() con metadata { name, role: 'doctor', specialty, license }
       ↓
3. Trigger handle_new_user() → INSERT en profiles, user_roles (role=doctor), wallets, doctor_profiles
       ↓
4. auth-email-hook recibe webhook → getUserRole(user_id) consulta user_roles → obtiene 'doctor'
       ↓
5. Renderiza SignupEmail con userRole='doctor' → incluye:
   - Preview: "Confirma tu correo y comienza tu proceso de verificación"
   - Titulo: "¡Bienvenido, Doctor!"
   - Boton: "Verificar correo electrónico"
   - Seccion onboarding: 4 pasos (confirmar correo → cedula SEP → revision equipo → listo)
   - Features: lives, consultas, contenido, recetas, pagos, noticias
       ↓
6. Subject personalizado: "Confirma tu correo y comienza tu verificación - Medical Masters"
```

### Sin problemas funcionales encontrados

- La secuencia trigger → email hook es correcta (trigger se ejecuta sincrónicamente en INSERT, el email hook es asincrónico posterior)
- El role lookup usa `maybeSingle()` con manejo de errores adecuado
- Los templates para doctor, resident y patient estan completos
- URLs apuntan a `https://cirugiaesteticauribe.com`
- Branding consistente "Medical Masters"

### Un ajuste menor recomendado

El background del `<Body>` en el email usa `#f0f5f7` en lugar de `#ffffff`. Segun las mejores practicas de email, el fondo exterior debe ser blanco para evitar problemas de rendering en modo oscuro de Gmail, Outlook, etc. (los clientes invierten backgrounds claros → si ya es gris, puede quedar raro).

## Cambio propuesto

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/_shared/email-templates/signup.tsx` | Cambiar `main.backgroundColor` de `#f0f5f7` a `#ffffff` |

Solo es 1 linea. Los demas templates tambien tienen el mismo patron pero el usuario solo pidio verificar el de signup.

