# Leyline Brand Guidelines

This document outlines the visual identity and brand standards for Leyline.

## Brand Overview

**Tagline:** EVERYTHING. CONNECTED.

**Core Pillars:**
- Collection
- Decks
- Pod
- Deals

## Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| Purple 600 | `#7C3AED` | Primary accent, buttons, links |
| Purple 500 | `#8B5CF6` | Gradient start, glow effects |
| Purple 400 | `#A78BFA` | Gradient middle, highlights |
| Purple 300 | `#C4B5FD` | Gradient end, subtle accents |

### Background Colors

| Name | Hex | Usage |
|------|-----|-------|
| Gray 950 | `#030712` | App background |
| Gray 900 | `#111827` | Card backgrounds, containers |
| Gray 800 | `#1F2937` | Borders, inactive states |
| Gray 100 | `#F3F4F6` | Light mode background |

### Text Colors

| Name | Hex | Usage |
|------|-----|-------|
| White | `#FFFFFF` | Primary text on dark |
| Gray 400 | `#9CA3AF` | Secondary text |
| Gray 500 | `#6B7280` | Tertiary text, labels |
| Purple 400 | `#A78BFA` | Accent text, links |

## Logo

### Primary Logo

The Leyline logo consists of:
1. **Icon:** A stylized "L" shape with rounded corners representing connection and flow
2. **Wordmark:** "LEYLINE" in light weight, system font with wide letter spacing
3. **Tagline:** "EVERYTHING. CONNECTED." in small caps with tracking

### Logo Mark (Icon Only)

The icon can be used standalone for:
- App icon (iOS/Android)
- Favicon
- Social media avatar
- Loading states

### Logo Specifications

**Icon Path:**
```svg
M30 60 L30 25 Q30 15 40 15 L55 15
```

**Gradient:**
- Start: `#8B5CF6` (0%)
- Middle: `#A78BFA` (50%)
- End: `#C4B5FD` (100%)
- Direction: top-left to bottom-right

**Glow Effect:**
- Gaussian blur with 2px standard deviation
- Applied via SVG filter

### App Icon Specifications

- Background: Gradient from purple-900 to gray-900
- Corner radius: 2xl (iOS standard)
- Icon centered at 60% of container size
- Shadow: purple-900/30

### Usage Guidelines

**Do:**
- Maintain minimum clear space around logo
- Use on dark backgrounds when possible
- Apply glow effect for premium feel
- Keep proportions consistent

**Don't:**
- Stretch or distort the logo
- Use low contrast color combinations
- Add additional effects or shadows
- Modify the gradient colors

## Typography

### Font Family

Primary: `system-ui` (native system font stack)

### Font Weights

| Weight | Usage |
|--------|-------|
| 300 (Light) | Headlines, logo wordmark |
| 400 (Regular) | Body text |
| 500 (Medium) | Buttons, emphasis |

### Letter Spacing

| Style | Value | Usage |
|-------|-------|-------|
| Tight | Default | Body text |
| Wide | 2-3px | Logo, headings |
| Widest | 4-6px | Tagline, labels |

## UI Components

### Buttons

**Primary Button:**
- Background: `bg-purple-600`
- Hover: `bg-purple-500`
- Text: White
- Padding: `px-5 py-2`
- Border radius: `rounded-lg`

### Cards

- Background: `bg-gray-900`
- Border: `border border-gray-800`
- Border radius: `rounded-xl`
- Padding: `p-5` to `p-8`

### Gradients

**Premium gradient (for feature highlights):**
```css
bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900
border border-purple-800/30
```

**App store banner:**
```css
bg-gradient-to-r from-purple-900 to-gray-900
```

**Upgrade prompts:**
```css
bg-gradient-to-r from-purple-900/50 to-gray-900
border border-purple-700/30
```

## Marketing Copy

### Key Phrases

- "Begin with an edge."
- "Tap into more."
- "Everything. Connected."

### Voice & Tone

- Confident but not arrogant
- Helpful and knowledgeable
- Direct and concise
- Slightly playful

### Feature Announcement Pattern

```
[NEW FEATURE badge]
[Feature Name] is here
[One-line description of benefit]
Tap into more →
```

## In-App Patterns

### Empty States

- Centered layout
- Icon in circular purple-tinted container
- Light headline
- Secondary description text
- Call-to-action link

### Loading States

- App icon centered
- Wordmark below
- Horizontal progress bar with gradient fill

### Navigation

- Bottom tab bar
- Active state: Purple-400 text with purple background tint
- Inactive state: Gray-500 text

## Social Media

### Handle

`@mtgleyline`

### Post Style

- Lead with data or insight
- Line breaks for readability
- End with "Tap into more."

## Live Component Reference

The interactive brand system component is available at:

`apps/mobile/components/brand/LeylineBrandSystem.tsx`

This component demonstrates:
- All logo variations
- Marketing material templates
- In-app UI patterns
- Color and typography in context

To view the component, import and render it in any screen:

```tsx
import { LeylineBrandSystem } from '@/components/brand';

export default function BrandScreen() {
  return <LeylineBrandSystem />;
}
```
