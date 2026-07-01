export const FEATURE_FLAGS = {
  marketplaceVendors: false,
  // Marketplace reventa dr↔dr con fee de intermediación (cliente 2026-07-01).
  // OFF hasta aplicar la migración 20260701_marketplace_intro_fee_flow.sql + desplegar
  // las edge functions de Stripe. Con esto en false, rutas/nav del nuevo marketplace
  // quedan ocultas y prod no se ve afectado.
  marketplaceFeeModel: false,
} as const;

// NOTA: chat / recetas / videollamadas ya NO se controlan aquí.
// Ahora son toggles activables/desactivables desde el admin (estilo "publicidad"):
// `enable_patient_chat` · `enable_prescriptions` · `enable_video_calls`
// en hooks/useSiteToggles.ts → Ajustes del sitio → pestaña Toggles.
