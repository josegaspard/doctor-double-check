

# Fix: Tab/Toggle Button Styling Across the App

## Problem
The `TabsList` background (`bg-muted`, which is `hsl(187, 35%, 95%)`) is nearly white, and the active `TabsTrigger` uses `bg-background` (pure white). This creates almost no visual contrast between active/inactive states, making the tabs look broken.

## Solution
Update `src/components/ui/tabs.tsx` to improve the visual distinction:

**TabsList**: Change from `bg-muted` to a slightly darker background with a visible border, giving the container more definition.

**TabsTrigger**: 
- Active state: Use `bg-primary text-primary-foreground` (the deep blue brand color) instead of plain white, making the active tab clearly stand out
- Inactive state: Keep transparent with `text-muted-foreground` for clear distinction

This single file change fixes tabs globally across Login, Register, Profile, Chat, Content Gallery, Doctor Analytics, Doctor Earnings, and all other pages using the shared `Tabs` component.

## Files to modify
- `src/components/ui/tabs.tsx` -- Update TabsList and TabsTrigger class names

