
# Plan: terminar la configuración para que Google muestre “Medical Masters” y todo siga funcionando

## Lo que ya confirmé en tu app
- El login con Google y Apple ya está conectado al mismo sistema de usuarios.
- Si el usuario es nuevo, el código lo manda a `/onboarding`.
- Si ya existe, entra normal.
- El texto de Apple ya está definido como `Continuar con Apple` en traducciones.
- Si aún ves `login.continueWithApple`, eso apunta a que falta publicar/actualizar el frontend o revisar dónde se está renderizando esa clave.

## Lo importante: por qué aún no ves “Medical Masters”
Por tus capturas, ya configuraste bien la marca en Google Cloud, pero eso **no basta por sí solo**. Falta enlazar esas credenciales personalizadas dentro del backend de tu proyecto y completar URLs/orígenes.

## Exactamente qué hacer, paso a paso

### Paso 1: En Google Cloud → “Información de la marca”
En esa pantalla:
- Deja `Nombre de la aplicación`: `Medical Masters`
- Deja el logo cargado
- Página principal: `https://cirugiaesteticauribe.com/`
- Privacidad: `https://cirugiaesteticauribe.com/privacy`
- Términos: `https://cirugiaesteticauribe.com/terms`
- Dominio autorizado: `cirugiaesteticauribe.com`

Luego:
- Haz clic en `Guardar`

Eso está bien encaminado en tus capturas.

### Paso 2: En Google Cloud → “Público”
Tienes dos opciones:

#### Opción A: seguir en modo prueba
Sirve para probar ya mismo.
- Haz clic en `Add users`
- Agrega el/los correos con los que vas a probar login con Google

#### Opción B: publicar la app
Si quieres que cualquier usuario pueda usar Google login sin estar agregado como tester:
- Haz clic en `Publicar app`

Para pruebas inmediatas, con `Prueba + Add users` basta.

### Paso 3: En Google Cloud → “Clientes” → abre tu cliente “Medical Masters”
En tu captura veo que solo tienes esta URI:
- `https://oauth.lovable.app/callback`

Debes completar también estas URIs de redirección autorizadas:

```text
https://oauth.lovable.app/callback
https://doc-seek-relay.lovable.app/~oauth/callback
https://cirugiaesteticauribe.com/~oauth/callback
```

Si quieres probar también desde el preview actual, añade además el origen/entorno que uses para pruebas cuando aplique.

### Paso 4: En ese mismo cliente, agrega Orígenes autorizados de JavaScript
Añade estos orígenes:

```text
https://doc-seek-relay.lovable.app
https://cirugiaesteticauribe.com
```

Si también pruebas desde preview, añade además:

```text
https://id-preview--cb26d7e6-a55d-4434-aec6-0d5240b9ce16.lovable.app
```

Después:
- Haz clic en `Guardar`

## Paso 5: Copia el Client ID y el Client Secret
En la pantalla del cliente:
- Copia el `ID de cliente`
- Copia el `Secreto del cliente`

Esto es crítico: si no los pegas en el backend del proyecto, seguirá usando la configuración administrada y no verás tu branding completo.

## Paso 6: En tu backend del proyecto, cambia Google a tus credenciales
Abre la configuración de autenticación del proyecto y en Google:
- activa `Use your own credentials` / usar tus propias credenciales
- pega tu `Client ID`
- pega tu `Client Secret`
- guarda

Acción recomendada para abrirlo:
```xml
<lov-actions>
  <lov-open-backend>View Backend</lov-open-backend>
</lov-actions>
```

## Paso 7: Prueba desde el dominio correcto
Para validar el branding:
- prueba desde `https://cirugiaesteticauribe.com` o `https://doc-seek-relay.lovable.app`
- evita sacar conclusiones desde sesiones viejas o ventanas con caché

Haz la prueba en:
- una ventana incógnita
- o cerrando sesión de Google antes

## Qué deberías ver después
En la pantalla de consentimiento/cuenta de Google ya debería aparecer:
- nombre: `Medical Masters`
- logo: tu logo de Medical Masters

## Sobre Apple: qué debe pasar
Ya está planteado para que:
- usuario nuevo con Apple → entre al mismo sistema y vaya a onboarding
- usuario existente con Apple → login normal

Eso depende del mismo flujo de sesión/post-login, así que funcionalmente está alineado con Google.

## Sobre “Continuar con Apple”
Ya existe la traducción correcta en el código. Si todavía ves la clave cruda:
1. revisar si el botón que ves viene de una versión no publicada del frontend
2. actualizar/publicar frontend
3. si sigue igual, revisar el componente exacto donde se imprime esa clave

## Validación funcional que haría al implementar/revisar
1. Probar Google con usuario nuevo:
   - debe crear usuario
   - debe guardarse en la misma base de usuarios
   - debe ir a onboarding
2. Probar Google con usuario existente:
   - debe entrar normal
3. Probar Apple con usuario nuevo:
   - debe crear usuario
   - debe ir a onboarding
4. Probar Apple con usuario existente:
   - debe entrar normal
5. Confirmar que el texto del botón sea `Continuar con Apple`
6. Confirmar branding de Google en ventana incógnita

## Resumen corto de lo que te falta
Lo que te falta casi seguro es esto:
1. agregar las URIs/orígenes faltantes en Google Cloud
2. pegar ese Client ID + Client Secret dentro del backend del proyecto
3. probar en incógnito desde tu dominio publicado/custom

## Si apruebas, mi siguiente implementación/revisión sería
- revisar exactamente dónde se renderiza el texto de Apple para dejarlo consistente en todas las vistas
- validar si el flujo de Apple usa el mismo recovery/post-login que Google
- dejarte una checklist final de prueba para Google nuevo/existente y Apple nuevo/existente
