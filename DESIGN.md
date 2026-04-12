# WorkinFlow Design System (CheckinFlow-inspired)

Soft, friendly, approachable design — inspired by CheckinFlow with **blue** accent.

## Color Palette

### Primary (Blue)
- `blue-500` (#3b82f6) — Primary buttons, active states, accent
- `blue-600` (#2563eb) — Hover
- `blue-50` (#eff6ff) — Light backgrounds, active nav
- `blue-700` (#1d4ed8) — Active text (light mode)
- `blue-400` (#60a5fa) — Active text (dark mode)

### Backgrounds
- Light: `gray-50` (#f9fafb) — Page, `white` (#ffffff) — Cards
- Dark: `gray-900` (#111827) — Page, `gray-800` (#1f2937) — Cards

### Borders
- Light: `gray-200` (#e5e7eb)
- Dark: `gray-700` (#374151)

### Text
- Primary: `gray-900` / `gray-50`
- Secondary: `gray-600` / `gray-400`
- Muted: `gray-500` / `gray-500`

## Border Radius
- Cards, Modals: `rounded-2xl` (16px)
- Buttons, Inputs, Selects: `rounded-xl` (12px)
- Small buttons, Menu items: `rounded-lg` (8px)
- Badges: `rounded-full`

## Shadows
- Cards: `shadow-sm`
- Dropdowns: `shadow-lg`
- Modals: `shadow-2xl`
- Modal overlay: `bg-black/60` with `backdrop-blur-sm`

## Button Sizes
- Default: `h-10 px-4` with `font-semibold`
- Small: `h-8 px-3`
- Large: `h-11 px-5`

## Input Sizes
- Default: `h-10 px-4 py-2.5`
- Focus: `ring-2 ring-blue-500/30`

## Sidebar Navigation
- Active: `bg-blue-50 text-blue-700 shadow-sm` / `dark:bg-blue-900/20 dark:text-blue-400`
- Hover: `hover:bg-gray-100` / `dark:hover:bg-gray-800`
- Item radius: `rounded-xl`

## Status Badge Colors
Use Tailwind utilities with light+dark variants:
- Info: `bg-blue-50 text-blue-700` / `dark:bg-blue-900/20 dark:text-blue-400`
- Success: `bg-green-50 text-green-700` / `dark:bg-green-900/20 dark:text-green-400`
- Warning: `bg-orange-50 text-orange-700` / `dark:bg-orange-900/20 dark:text-orange-400`
- Error: `bg-red-50 text-red-700` / `dark:bg-red-900/20 dark:text-red-400`
- Active: `bg-amber-50 text-amber-700` / `dark:bg-amber-900/20 dark:text-amber-400`
- Purple: `bg-purple-50 text-purple-700` / `dark:bg-purple-900/20 dark:text-purple-400`
- Cyan: `bg-cyan-50 text-cyan-700` / `dark:bg-cyan-900/20 dark:text-cyan-400`
- Neutral: `bg-gray-100 text-gray-600` / `dark:bg-gray-800 dark:text-gray-400`

## Typography
- Headings: `font-bold` or `font-semibold`
- Body: default weight (400)
- Thai: Sarabun font / English: Inter font
- No special font-feature-settings or letter-spacing

## Do's
- Use Tailwind utility classes for all colors
- Provide both light and dark mode variants
- Use generous padding (`px-4 py-3` for inputs)
- Use soft rounded corners (`rounded-xl`, `rounded-2xl`)
- Use `shadow-sm` for cards

## Don'ts
- Don't use hardcoded rgba colors like `rgba(255,255,255,0.08)`
- Don't use hex colors directly — use Tailwind scale (`blue-500`, not `#3b82f6`)
- Don't use tight padding (`px-2`, `py-1`) on interactive elements
- Don't use `font-feature-settings` or negative letter-spacing
