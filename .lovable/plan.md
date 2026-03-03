

# Fix: Global UI Components -- Buttons, Tabs, Toggles, Selects, Checkboxes

## Root Cause

The **primary issue** is in `src/index.css` lines 207-210:

```css
button, a, [role="button"], input[type="checkbox"], input[type="radio"] {
  min-height: 44px;
  min-width: 44px;
}
```

This forces **every** button, link, checkbox, radio, and tab trigger to be at least 44x44px. Tab triggers are `<button>` elements, so they balloon in size. Checkboxes become 44x44px squares. The exception list (lines 213-215) only covers `h-7`, `h-8`, `h-9` -- far too narrow.

This single rule is breaking the entire UI.

## Plan

### 1. Fix global touch target rules (`src/index.css`)
- **Remove** the blanket `min-height: 44px` / `min-width: 44px` on all buttons/links/checkboxes/radios
- **Replace** with a targeted approach: only standalone action buttons get 44px touch targets via a utility class or by scoping to specific button sizes (h-10, h-11, h-12, xl)
- Tab triggers, checkbox indicators, radio indicators, toggle items, badge buttons, and inline buttons should NOT have forced 44px
- Keep `touch-action: manipulation` on all interactive elements (that's fine)

### 2. Polish Tabs (`src/components/ui/tabs.tsx`)
- `TabsList`: solid `bg-muted` background, `border border-border`, `rounded-xl`, `p-1.5`, proper `h-12`
- `TabsTrigger`: `rounded-lg`, `px-4 py-2`, `font-semibold`, active state with `bg-white shadow-sm text-foreground` (pill style) instead of primary color which clashes. Inactive: `text-muted-foreground`

### 3. Polish Checkbox (`src/components/ui/checkbox.tsx`)
- Increase to `h-5 w-5` for mobile friendliness without the 44px bloat
- Add transition for smooth check animation

### 4. Polish Radio (`src/components/ui/radio-group.tsx`)
- Increase to `h-5 w-5` for better touch targets without 44px bloat

### 5. Polish Switch (`src/components/ui/switch.tsx`)
- Already fine at `h-6 w-11`, just verify no 44px override is affecting it

### 6. Polish Select (`src/components/ui/select.tsx`)
- Increase `SelectItem` padding for mobile: `py-2.5` instead of `py-1.5`
- `SelectTrigger` height to `h-11` for mobile touch comfort

### 7. Polish Toggle/ToggleGroup
- Ensure toggle items have proper padding and don't get forced to 44px squares

## Files to modify
- `src/index.css` -- Remove/replace blanket 44px rule (THE critical fix)
- `src/components/ui/tabs.tsx` -- Clean pill-style tabs
- `src/components/ui/checkbox.tsx` -- Size bump to h-5 w-5
- `src/components/ui/radio-group.tsx` -- Size bump to h-5 w-5
- `src/components/ui/select.tsx` -- Better mobile padding
- `src/components/ui/button.tsx` -- Ensure proper touch targets are built-in
- `src/components/ui/toggle.tsx` -- Minor padding adjustments

