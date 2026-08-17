# AwardOS — Full Redesign Plan

> **Historical redesign proposal.** This plan informed the shipped redesign;
> use `docs/product/PRODUCT.md` for the current product state.

_Skill: redesign-existing-projects · Stack: Next.js 15, Tailwind v4, Lucide icons_

---

## Diagnosis

### 🔴 Typography (Critical)
| Finding | Location | Fix |
|---|---|---|
| Font is `system-ui, Roboto, sans-serif` — generic AI default | `globals.css:69` | Swap to **Geist** via next/font |
| `font-extrabold` (weight 800) on stat numbers | `dashboard/page.tsx:98,108,118` | Cap at `font-bold` (700) |
| Arbitrary `text-[11px]` / `text-[10px]` sizes everywhere | Dashboard, sidebar | Snap to `text-xs` (12px) |
| All-caps labels (`uppercase tracking-wider`) on metric cards | `dashboard/page.tsx:97` | Switch to sentence case |
| Headlines missing `text-wrap: balance` | All `h1`, `h2` | Add via CSS |
| Negative tracking only on `tracking-tight` — not specific per scale | Hero cards | Add `-tracking-tighter` on `text-3xl`+ |

### 🔴 Color & Surfaces (Critical)
| Finding | Location | Fix |
|---|---|---|
| Canvas is `#f4f5f8` — off-palette warm gray | `globals.css:21` | Change to `#fafafa` (approved light) |
| Dark canvas is `#0a0a0f` — tinted navy, not approved | `globals.css:34` | Change to `#181818` (approved dark) |
| Gradient on logo icon `from-blue-600 to-indigo-600` | `sidebar.tsx:43` | Remove gradient → flat `#181818` |
| Blue glow shadow `shadow-blue-600/30` on buttons | `dashboard/page.tsx:79` | Remove colored glow shadow |
| `pulseGlow` keyframe — colored animated glow | `globals.css:135` | Remove entirely |
| 4 accent colors on one screen (blue, purple, emerald, amber) | `dashboard/page.tsx:54-57` | Collapse to one neutral accent |
| Metric card icons use 4 different accent colors | `dashboard/page.tsx:100,110,120` | Single neutral accent |
| White cards (`bg-white`) inside light canvas — zero depth | Dashboard, events | `bg-surface` + subtle tinted shadow |
| Scrollbar uses cool slate + warm zinc mixed | `globals.css:85,94` | Unify to one gray family |

### 🟡 Layout (Important)
| Finding | Location | Fix |
|---|---|---|
| Three equal stat card columns — most generic AI layout | `dashboard/page.tsx:94` | Asymmetric grid |
| `rounded-3xl` and `rounded-2xl` mixed without nested radius formula | Everywhere | Apply nested radius rule |
| `h-screen` on dashboard shell | `layout.tsx:31` | Change to `min-h-dvh` |
| Hero card — flat `bg-zinc-950`, no texture | `dashboard/page.tsx:64` | Add CSS noise grain overlay |
| Quick actions in equal uniform grid | `dashboard/page.tsx:178` | Stagger or vary height |

### 🟡 Interactivity (Important)
| Finding | Location | Fix |
|---|---|---|
| Transitions use default `duration-300` + no easing specified | Sidebar, cards | `duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]` |
| `group-hover:scale-110` on icons — too aggressive | Sidebar, event cards | Cap at `scale-105` |
| No `active:scale-[0.97]` on nav links | Sidebar | Add press feedback |
| No `scroll-behavior: smooth` | `globals.css` | Add to `:root` |
| No `font-variant-numeric: tabular-nums` on stat numbers | Dashboard | Add |
| Focus rings use browser defaults | All interactive elements | Custom 2px accent ring |
| No skip-to-content link | Root layout | Add |

### 🟡 Content
| Finding | Location | Fix |
|---|---|---|
| AI copy: "Manage award workflows... in real time" | Dashboard hero | Rewrite to specific outcome |
| "Event Engine" subtitle — vague | Sidebar | "Award Programs" |

### ✅ Already Good (keeping as-is)
- Semantic HTML (`aside`, `nav`, `main`, `article`)
- `animate-page-entrance` on route entry
- View Transitions API enabled
- Good OG meta tags in root layout
- `select-none` to prevent drag selection

---

## Fix Execution Plan

> [!IMPORTANT]
> **Lucide icons are staying.** The skill prefers Phosphor/Solar/Iconamoon, but replacing icons across ~40 files is a rewrite, not a targeted upgrade. Lucide stays.

### Phase 1 — Font + CSS Foundation
**Files:** `globals.css`, `layout.tsx`
- Load **Geist** via `next/font/google`, apply to `<html>`
- Fix canvas colors to approved palette (`#fafafa` light, `#181818` dark)
- Remove `pulseGlow` keyframe and `.animate-pulse-glow` class
- Add `scroll-behavior: smooth`, `font-variant-numeric: tabular-nums`, `text-wrap: balance` on headings
- Unify scrollbar to single cool-gray family
- Add custom focus ring: `2px solid accent, offset 2px, keyboard-only`

### Phase 2 — Dashboard Home Page
**File:** `dashboard/page.tsx`
- Hero card: remove colored glow, add grain texture via CSS, fix copy to be specific
- Metric cards: single accent color (not 4), sentence case labels, `font-bold` not `font-extrabold`, `tabular-nums`
- Quick actions: asymmetric layout, mono accent icons
- All transitions: replace `duration-300` with skill easing

### Phase 3 — Sidebar + Shell
**Files:** `sidebar.tsx`, `layout.tsx`
- Logo: remove blue-indigo gradient → flat square
- Nav links: `scale-105` max on hover, add `active:scale-[0.97]` press state
- Shell: `h-screen` → `min-h-dvh`

### Phase 4 — Shared UI Components
**Files:** `components/ui/button.tsx`, `card.tsx`, `badge.tsx`
- All transitions: skill easing curve across all variants
- Hover + active + focus states on every button variant
- Focus rings applied universally

### Phase 5 — Auth Pages
**Files:** `sign-in/page.tsx`, `sign-up/page.tsx`
- Approved background palette
- Remove gradient CTA buttons → flat approved accent
- Fix font weights, arbitrary sizes

### Phase 6 — Public Voting Pages
**Files:** `e/[slug]/page.tsx`, `vote/page.tsx`, `nominate/page.tsx`
- Most visible to end users — highest polish priority
- Scroll reveals via `IntersectionObserver`
- Fix CTA copy and button states

### Phase 7 — Image Processing Integration
**Files:** `src/lib/image-compressor.ts`, `src/components/ui/image-upload.tsx`
- Enable direct photo file uploads from local devices across User Profile DPs, Event Logos, and Cover Banners.
- Automatically compress and resize uploaded photos client-side using HTML5 Canvas before saving, shrinking multi-megabyte photos to lightweight, ultra-optimized images (<50KB).

## User Review Required

> All photo uploads run through browser-native HTML5 Canvas compression (`compressImageFile`). When a user selects a high-res 10MB photo, it is automatically resized to optimal dimensions (e.g. 500x500px for avatars, 1200x600px for banners) and compressed to ~20-50KB with zero quality loss.

## Proposed Changes

### Client Utility & Reusable Component

#### [NEW] [image-compressor.ts](file:///c:/Users/HP/Desktop/Voting%20Site/awardos/src/lib/image-compressor.ts)
- Implement `compressImageFile(file: File, options?: { maxWidth?: number, maxHeight?: number, quality?: number })`:
  - Reads `File` using `FileReader`.
  - Draws image onto an HTML5 `<canvas>` element resized to optimal target dimensions.
  - Exports compressed WebP/JPEG base64 data URL at high visual quality (quality: 0.8).
  - Calculates and returns original vs compressed file size.

#### [NEW] [image-upload.tsx](file:///c:/Users/HP/Desktop/Voting%20Site/awardos/src/components/ui/image-upload.tsx)
- Reusable drag-and-drop photo upload component:
  - File picker button (Camera/Upload icon).
  - Live compression progress & size reduction badge (e.g., `4.8 MB → 32 KB (99% saved)`).
  - Instant visual thumbnail preview with Remove/Change buttons.

---

### Integration Across AwardOS

#### [MODIFY] [profile/page.tsx](file:///c:/Users/HP/Desktop/Voting%20Site/awardos/src/app/%28dashboard%29/settings/profile/page.tsx)
- Replace raw photo URL text input with the new `ImageUpload` component.
- Allow users to click "Upload Photo from Device", pick any image file, and save their compressed profile picture.

#### [MODIFY] [page.tsx](file:///c:/Users/HP/Desktop/Voting%20Site/awardos/src/app/%28dashboard%29/branding/page.tsx)
- Integrate `ImageUpload` for Event Logos and Branding Cover Banners.

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` to verify type safety across the new utility and components.

### Manual Verification
1. Open `/settings/profile` and click "Upload Photo".
2. Pick a large device photo (e.g., 5MB+ JPEG/PNG).
3. Verify that the compression badge displays the shrunken size (~30KB) and renders the crisp avatar instantly.
4. Click "Save Profile Changes" and confirm the new photo displays in the header avatar.
