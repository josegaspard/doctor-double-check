

# Plan: Bulk Delete for Chat History & Notifications + UX Polish

## 1. Chat History: Multi-Select & Bulk Delete

**File: `src/components/chat/ChatSessionsList.tsx`**

Add a selection mode toggle in the History tab:
- When on "Historial" tab, show a toolbar with "Seleccionar" toggle button
- In selection mode: show checkboxes on each closed session item, a "Select All" checkbox, and a floating action bar at the bottom with count + "Eliminar seleccionados" button
- The delete button triggers the existing `deleteSessions()` from ChatContext
- Exiting selection mode clears all selections
- Uses the existing `AlertDialog` for confirmation before bulk delete

**File: `src/components/chat/ChatSessionItem.tsx`**

Add an optional `checkbox` prop:
- When `isSelecting` is true, show a Checkbox on the left side of the item (before the avatar)
- `isChecked` and `onCheckChange` props for controlled state

## 2. Notifications: Multi-Select & Bulk Delete

**File: `src/pages/Notifications.tsx`**

Add selection mode to the notifications page:
- Add a "Seleccionar" toggle button next to "Marcar todo como leido"
- In selection mode: show checkboxes on each notification card, a "Select All" checkbox, and a sticky bottom action bar with count + "Eliminar" button
- Add a "Eliminar todas" button that selects all and confirms
- Uses `deleteNotifications()` from useNotifications hook (already implemented)
- Confirmation dialog before bulk delete

## 3. Implementation Details

### ChatSessionsList changes:
- New state: `isSelecting: boolean`, `selectedIds: Set<string>`
- When `activeTab === 'history'` and `closedSessions.length > 0`, show a small "Seleccionar" button in the header area
- In selection mode, the header shows: checkbox for "Select All" + count label + "Cancelar" button
- Bottom of the card: sticky bar with "Eliminar (N)" destructive button
- Clicking "Eliminar" opens the existing AlertDialog with updated text for bulk delete
- On successful delete, exit selection mode

### ChatSessionItem changes:
- Add optional props: `isSelecting?: boolean`, `isChecked?: boolean`, `onCheckChange?: (checked: boolean) => void`
- When `isSelecting`, render a Checkbox before the avatar; clicking the row toggles the checkbox instead of opening the session

### Notifications page changes:
- New state: `isSelecting: boolean`, `selectedIds: Set<string>`
- Header bar: add "Seleccionar" button (toggles mode)
- In selection mode: replace individual action buttons with checkboxes; show sticky bottom bar with "Eliminar (N)"
- Add `AlertDialog` for confirmation
- "Delete All" option: selects all visible notifications and confirms

## 4. Technical Notes

- Both `deleteSessions` and `deleteNotifications` are already implemented in their respective contexts/hooks
- RLS policies on `chat_sessions` and `notifications` tables already allow DELETE for the owning user
- No database migrations needed
- The Checkbox component from `@/components/ui/checkbox` is already available

