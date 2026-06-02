# Nope Design System

## Color Palette

### Primary Colors
- **Indigo**: `indigo-500` (primary actions, links, highlights)
- **Emerald**: `emerald-500` (success, positive sentiment)
- **Rose**: `rose-500` (danger, negative sentiment, errors)
- **Amber**: `amber-500` (warnings, medium risk)
- **Purple**: `purple-500` (secondary actions, AI features)

### Background Colors
- **Primary Background**: `bg-[#050A15]` (main page background)
- **Card Background**: `bg-[#111827]` (card backgrounds)
- **Secondary Card**: `bg-[#1E293B]` (inputs, secondary elements)
- **Accent Background**: `bg-white/5` (subtle card backgrounds with backdrop blur)

### Text Colors
- **Primary Text**: `text-white` (headings, primary content)
- **Secondary Text**: `text-gray-300` (body text)
- **Muted Text**: `text-gray-400` (labels, descriptions)
- **Disabled Text**: `text-gray-500` (disabled states)

## Typography

### Font Sizes
- **XS**: `text-[10px]` (badges, labels, metadata)
- **SM**: `text-xs` (secondary labels, helper text)
- **Base**: `text-sm` (body text, buttons)
- **MD**: `text-base` (card headings)
- **LG**: `text-lg` (section headings)
- **XL**: `text-xl` (page headings)
- **2XL**: `text-2xl` (main page titles)

### Font Weights
- **Normal**: `font-normal` (body text)
- **Medium**: `font-medium` (buttons, labels)
- **Semibold**: `font-semibold` (headings)
- **Bold**: `font-bold` (emphasis)
- **Black**: `font-black` (large numbers, titles)

### Text Transformations
- **Uppercase**: `uppercase tracking-wider` (badges, labels)
- **Capitalize**: `capitalize` (proper nouns)
- **None**: default (body text)

## Spacing

### Padding
- **XS**: `p-2` (compact elements)
- **SM**: `p-3` (small cards)
- **MD**: `p-4` (standard cards)
- **LG**: `p-5` (large cards)
- **XL**: `p-6` (extra large cards)

### Gap
- **XS**: `gap-1` (tight spacing)
- **SM**: `gap-2` (compact spacing)
- **MD**: `gap-3` (standard spacing)
- **LG**: `gap-4` (loose spacing)
- **XL**: `gap-6` (section spacing)

## Border Radius

- **SM**: `rounded-lg` (small elements, buttons)
- **MD**: `rounded-xl` (cards, inputs)
- **LG**: `rounded-2xl` (large cards, modals)

## Borders

- **Primary Border**: `border-white/10` (subtle borders)
- **Secondary Border**: `border-gray-800` (card borders)
- **Accent Border**: `border-indigo-500/20` (highlighted borders)
- **Focus Ring**: `focus:ring-2 focus:ring-indigo-500` (input focus)

## Shadows

- **SM**: `shadow-sm` (subtle elevation)
- **MD**: `shadow-xl` (card elevation)
- **LG**: `shadow-2xl` (modal elevation)
- **Accent**: `shadow-indigo-500/20` (colored shadows)

## Buttons

### Primary Button
```tsx
className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-500 transition-colors shadow-sm shadow-indigo-500/20"
```

### Secondary Button
```tsx
className="px-4 py-2.5 bg-[#1E293B] text-gray-300 font-medium rounded-xl hover:bg-gray-800 hover:text-white transition-colors border border-gray-700"
```

### Danger Button
```tsx
className="px-4 py-2.5 bg-rose-600 text-white font-medium rounded-xl hover:bg-rose-500 transition-colors shadow-sm shadow-rose-500/20"
```

### Success Button
```tsx
className="px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-500/20"
```

## Cards

### Standard Card
```tsx
className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5"
```

### Hover Card
```tsx
className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-all duration-500 group"
```

## Badges

### Severity Badge
- **Critical**: `bg-rose-500/10 text-rose-400 border-rose-500/20`
- **High**: `bg-amber-500/10 text-amber-400 border-amber-500/20`
- **Medium**: `bg-yellow-500/10 text-yellow-400 border-yellow-500/20`
- **Low**: `bg-indigo-500/10 text-indigo-400 border-indigo-500/20`

### Sentiment Badge
- **Positive**: `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
- **Neutral**: `bg-[#1E293B] text-gray-400 border-gray-700`
- **Negative**: `bg-rose-500/10 text-rose-400 border-rose-500/20`

## Icons

### Icon Sizes
- **XS**: `w-3 h-3` (compact icons)
- **SM**: `w-4 h-4` (standard icons)
- **MD**: `w-5 h-5` (large icons)
- **LG**: `w-6 h-6` (extra large icons)

### Icon Colors
- **Primary**: `text-indigo-400`
- **Success**: `text-emerald-400`
- **Danger**: `text-rose-400`
- **Warning**: `text-amber-400`
- **Muted**: `text-gray-400`

## Inputs

### Standard Input
```tsx
className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
```

### Textarea
```tsx
className="w-full px-4 py-2.5 bg-[#1E293B] border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500 resize-none"
```

## Modals

### Standard Modal
```tsx
className="fixed inset-0 z-50 overflow-y-auto"
// Backdrop
className="fixed inset-0 bg-black/70 backdrop-blur-sm"
// Content
className="bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg"
```

## Transitions

### Standard Transition
```tsx
className="transition-all duration-300"
```

### Hover Effects
```tsx
className="hover:bg-white/10 hover:text-white transition-colors"
className="hover:-translate-y-1 hover:shadow-xl transition-all"
```

## Loading States

### Spinner
```tsx
<Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
```

### Skeleton
```tsx
className="animate-pulse bg-gray-800"
```

## Empty States

### Standard Empty State
```tsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  <Icon className="w-16 h-16 text-gray-500 mb-4" />
  <p className="text-gray-400 font-medium">Empty message</p>
</div>
```

## Responsive Breakpoints

- **SM**: `sm:` (640px+)
- **MD**: `md:` (768px+)
- **LG**: `lg:` (1024px+)
- **XL**: `xl:` (1280px+)

## Common Patterns

### Page Header
```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold text-white tracking-wide">Page Title</h1>
    <p className="text-sm text-gray-400 mt-1">Page description</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Action buttons */}
  </div>
</div>
```

### Section Header
```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-base font-bold text-white tracking-wide">Section Title</h2>
  <span className="text-xs font-bold uppercase bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg">
    Badge
  </span>
</div>
```

### Filter Chip
```tsx
<button className="px-4 py-2 rounded-xl text-sm font-medium transition-all">
  {/* Active state: bg-indigo-600 text-white */}
  {/* Inactive state: bg-[#111827] text-gray-400 border border-gray-800 */}
</button>
```
