
# Plan: Video autoplay en Landing, corregir "Exp. Medico", y verificaciones

## 1. Agregar video autoplay al hero de Landing

**Archivo**: `src/pages/Landing.tsx` (lineas 126-130)

Dentro del `<div className="absolute inset-0 z-0">` del hero, agregar un tag `<video>` con autoplay, muted, loop y playsInline antes de los gradientes overlay:

```html
<video
  autoPlay
  muted
  loop
  playsInline
  className="absolute inset-0 w-full h-full object-cover"
  src="https://gestomarketing.com.mx/wp-content/uploads/2026/03/Video_de_Landing_Page_Hiperrealista-1-1.mp4"
/>
```

Los gradientes overlay existentes (`opacity-90`) se mantienen encima del video para que el texto siga siendo legible.

## 2. Corregir "Exp. Medico" - Eliminar auto-insercion de lives en doctor_content

**Archivo**: `src/pages/DoctorGoLive.tsx` (lineas 279-309)

**Problema encontrado**: Cuando un doctor termina un live con grabacion, el codigo en lineas 292-303 automaticamente inserta la grabacion en la tabla `doctor_content`. Esto hace que los lives aparezcan en la galeria de "Exp. Medico" (`/content`), lo cual el usuario no quiere.

**Solucion**: Eliminar el bloque completo de `saveAsContent` (lineas 280-309) que inserta las grabaciones de lives en `doctor_content`. Las grabaciones seguiran disponibles en la seccion de Grabaciones (`/recordings`) que es donde pertenecen.

## 3. Verificar PDF de Analytics manualmente (testing con browser)

Despues de implementar los cambios, navegar a `/admin/analytics` en el browser, hacer clic en el boton de PDF/imprimir, y verificar que:
- El dialogo de impresion se dispara correctamente
- Los datos de KPIs y graficas estan presentes

## 4. Probar flujo de reembolsos end-to-end (testing con browser)

Navegar a `/admin/refunds` y verificar:
- La pagina carga correctamente con las pestanas (Solicitudes, Historial)
- Los filtros funcionan
- El formulario de reembolso manual abre y muestra las opciones (Wallet, Stripe, Transferencia bancaria)
- La Edge Function `admin-refund` esta desplegada y responde

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Landing.tsx` | Agregar `<video>` autoplay muted loop en el hero |
| `src/pages/DoctorGoLive.tsx` | Eliminar bloque de auto-insercion en doctor_content (lineas 279-309) |

## Verificaciones con browser

1. Navegar a `/` y confirmar que el video se reproduce automaticamente en el hero
2. Navegar a `/admin/analytics` y probar el boton de PDF
3. Navegar a `/admin/refunds` y probar el flujo completo de reembolsos
