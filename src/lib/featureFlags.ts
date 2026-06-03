export const FEATURE_FLAGS = {
  marketplaceVendors: false,
} as const;

// NOTA: chat / recetas / videollamadas ya NO se controlan aquí.
// Ahora son toggles activables/desactivables desde el admin (estilo "publicidad"):
// `enable_patient_chat` · `enable_prescriptions` · `enable_video_calls`
// en hooks/useSiteToggles.ts → Ajustes del sitio → pestaña Toggles.
