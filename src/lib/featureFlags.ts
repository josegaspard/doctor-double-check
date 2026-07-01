export const FEATURE_FLAGS = {
  marketplaceVendors: false,
  // Marketplace reventa dr↔dr con fee de intermediación (cliente 2026-07-01).
  // ACTIVADO 2026-07-01: migración aplicada + edge functions desplegadas. El marketplace
  // reventa dr↔dr con fee está vivo (rutas /marketplace y nav visibles para dr/residentes).
  marketplaceFeeModel: true,
} as const;

// NOTA: chat / recetas / videollamadas ya NO se controlan aquí.
// Ahora son toggles activables/desactivables desde el admin (estilo "publicidad"):
// `enable_patient_chat` · `enable_prescriptions` · `enable_video_calls`
// en hooks/useSiteToggles.ts → Ajustes del sitio → pestaña Toggles.
