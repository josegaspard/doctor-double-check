

# Plan: Content Protection for Expediente Médico (Vault + Medical History)

## Scope

Apply the same content protection strategy already used in the Content Library to the medical record sections: **Vault** (`/vault`), **Medical History** (`/medical-history`), and the **VaultFilePreviewModal**.

## Changes

### 1. VaultFilePreviewModal — Remove download/open buttons, add protections

**File:** `src/components/vault/VaultFilePreviewModal.tsx`

- **Remove** the "Abrir" and "Descargar" buttons (lines 178-192) entirely — even for non-viewOnly mode
- **Add** `onContextMenu={e => e.preventDefault()}` to the entire `DialogContent` to block right-click
- **Images**: Add `draggable={false}` and wrap with a transparent overlay div (`pointer-events-none`) to prevent drag-save
- **PDFs**: Use blob fetch approach (like ContentPreviewModal) — fetch signed URL as blob, create local objectURL, render in iframe with `#toolbar=0` to hide browser PDF toolbar. This prevents direct URL exposure
- **Add** CSS `user-select: none` on the preview area
- Keep the "Cerrar" button and the viewOnly OTP message

### 2. Vault page — Remove download references

**File:** `src/pages/Vault.tsx`

- Add `onContextMenu` prevention on the file list area
- No download buttons exist on this page currently (only Permissions and Delete), so minimal changes needed

### 3. MedicalHistory page — Remove export/download, add protections

**File:** `src/pages/MedicalHistory.tsx`

- **Remove** the "Exportar PDF" button (line 185-189) and related `handleExportPDF` function — this generates a downloadable PDF of all records
- **Remove** the `Download` icon import
- Add `onContextMenu` prevention on the studies list
- Add click-to-preview functionality on study items using `VaultFilePreviewModal` (currently items are not clickable)

### 4. DoctorVault — Ensure viewOnly protections

**File:** `src/pages/DoctorVault.tsx`

- Confirm `viewOnly={true}` is already passed (it is) — the modal changes above will handle the rest

## Summary of protections applied

- No download or "open in new tab" buttons anywhere
- Right-click disabled on all preview areas
- Images wrapped with transparent overlay to prevent drag-save
- PDFs rendered via blob URL with toolbar hidden
- `user-select: none` on preview content
- No direct signed URLs exposed in the DOM

