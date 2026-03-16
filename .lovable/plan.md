

# Plan: Añadir "Publicidad" al menú dropdown de desktop para residentes y pacientes

## Problema

El enlace "Publicidad" ya está en:
- ✅ Sidebar de tablet (línea 337-342)
- ✅ Sheet móvil "Más" (línea 662-673)
- ❌ **Dropdown de desktop** (líneas 446-459) — **FALTA**

La captura de pantalla del usuario muestra exactamente esto: el dropdown de desktop para `residente1@medicalmasters.test` no tiene la opción "Publicidad".

## Solución

### Archivo: `src/components/layout/MainLayout.tsx`

En el dropdown menu de desktop (línea 454-455, entre el item de Wallet y el de Settings), añadir:

```tsx
{(role === 'patient' || role === 'resident') && hasCampaigns && (
  <DropdownMenuItem onClick={() => navigate('/advertiser/dashboard')} className="py-3 text-sm">
    <Megaphone className="w-4 h-4 mr-2" />
    {t('nav.advertising') || 'Publicidad'}
  </DropdownMenuItem>
)}
```

Esto lo inserta justo debajo de "Mi Wallet" y antes de "Configuración", exactamente como pidió el usuario.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/MainLayout.tsx` | Línea ~455: añadir DropdownMenuItem de "Publicidad" condicional en el menú dropdown de desktop |

Un solo cambio, 5 líneas de código.

