# Tukkebaaz Design System

**Source of truth:** the Expo app at `D:\mobile\tukkabaz\frontend` (NativeWind / Tailwind, styles inline in screen components). The web admin app must match it exactly.

There is **no central theme file** in the Expo app — the only theme config is the Geist font family in `tailwind.config.js`. All colors, sizes, radii and spacing live inline as Tailwind classes (`bg-[#F7F7F8]`, `text-[14px]`, `rounded-[24px]`, etc.). The tokens below were extracted by auditing every `src/screens/*` and `src/components/*` file and ranking by frequency. The admin surface specifically maps from `AdminLoginScreen.tsx` and `AdminDashboardScreen.tsx`.

> RN→CSS mapping: dp values map 1:1 to px. `rounded-[Npx]` → `border-radius: Npx`. RN has no `box-shadow` on these screens — cards are flat (no border, no shadow). Flex direction/alignment map 1:1.

---

## 1. Typography

**Font family: Geist** (loaded via `@expo-google-fonts/geist`). The web app must load Geist (e.g. `next/font/google` `Geist` or the Google Fonts CSS), **not** Inter/Outfit.

| Token (RN class)      | Font            | CSS weight |
|-----------------------|-----------------|-----------|
| `font-geist`          | Geist Regular   | 400       |
| `font-geist-medium`   | Geist Medium    | 500       |
| `font-geist-semibold` | Geist SemiBold  | 600       |
| `font-geist-bold`     | Geist Bold      | 700       |

Headings in the Expo app use **`font-geist-bold` / `font-geist-semibold`** — never an "extrabold/800" weight and never a separate display font (Outfit). There is no global heading font override; every text element sets its own family + size.

### Font-size scale (px, from `text-[Npx]`)
`8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 26, 28, 30, 33, 34`

Most-used: **14** (body/inputs), **13** (secondary / tab labels), **12** (meta), **11** (uppercase card labels), **15/16** (emphasis), **18/20** (section titles), **22/26/28** (headlines & metric values).

### Canonical text styles
| Role                  | Size  | Family            | Color     |
|-----------------------|-------|-------------------|-----------|
| Screen title          | 28px  | geist-bold        | `#141414` |
| Section title         | 20px  | geist-semibold    | `#171717` |
| Sub-section title     | 18px  | geist-semibold    | `#171717` |
| Metric value          | 26px  | geist-bold        | `#111111` |
| Card title            | 15px  | geist-semibold    | `#131313`/`#171717` |
| Uppercase card label  | 11px  | geist-bold, `tracking-wider`, uppercase | `#77777D` |
| Body / input text     | 14px  | geist (400)       | `#111111` |
| Secondary / meta      | 12–13px | geist (400)     | `#5F6064` / `#606066` / `#6A6A70` |
| Tab label             | 13px  | geist-semibold    | active `#FFFFFF`, inactive `#6C6C6E` |
| Pill / filter label   | 12px  | geist-semibold    | active `#FFFFFF`, inactive `#33343A` |
| Input label           | 14px  | geist (400)       | `#55555A` |

---

## 2. Color palette

### Brand
| Token            | Hex       | Usage                          |
|------------------|-----------|--------------------------------|
| Primary          | `#ED7D4B` | Primary buttons, ROOM bar      |
| Primary deep     | `#EE5B1B` / `#C2410C` | pressed/deep accents |

> The Expo app has **no `:hover` state** (touch only). For web, hover may darken Primary toward `#EE5B1B`, but the resting color is always `#ED7D4B`.

### Text
| Token        | Hex       |
|--------------|-----------|
| Primary      | `#111111` (also `#131313`, `#141414`, `#171717` in headings) |
| Secondary    | `#66666A`, `#606066`, `#5F6064` |
| Muted        | `#77777C` / `#77777D`, `#6C6C6E`, `#6A6A70` |
| Tertiary     | `#8D8D93`, `#8E8E93` |
| Placeholder  | `#9A9AA0` |

### Surfaces
| Token              | Hex       | Usage                                   |
|--------------------|-----------|-----------------------------------------|
| Screen background  | `#FFFFFF` | Admin screens are **white**, not grey   |
| Panel (grouping)   | `#F7F7F8` | `rounded-[24px]` section panels          |
| Card (inner)       | `#FFFFFF` | `rounded-2xl` cards inside panels        |
| Muted surface      | `#F2F2F3` | tab-bar track, neutral chips             |
| Pill track         | `#E9E9EC` | filter pill group background             |
| Input background   | `#FFFFFF` | text inputs                             |

### Borders
| Token        | Hex       | Usage              |
|--------------|-----------|--------------------|
| Input border | `#DEDEE2` (login uses `#DDDEE2`) | input outlines |
| Subtle       | `#EBEBEF`, `#E4E4E7` | dividers       |

### Semantic / status
| State    | Background | Text      |
|----------|-----------|-----------|
| SUCCESS  | `#E8F8EE` | `#156D35` |
| PENDING  | `#FFF4D8` | `#9A6200` |
| FAILED   | `#FFE8EB` | `#9A1223` |
| Error text (inline) | `#FFE8EB` bg | `#9A1223` |
| Success (alt)       | `#1F7A1F` |           |
| Warning             | `#E5B800` |           |
| Info / blue         | `#2563EB` |           |

### Chart / category accents
ROOM `#ED7D4B` · SERVICE `#111111` · FOOD/GROCERY `#22C55E`
Delivery board: Processing `#ED9B33` · Ready `#24A148` · Assigned `#2563EB` · Out for delivery `#ED7D4B` · Delivered `#6B7280`

---

## 3. Border radius
| Token            | px    | Usage                              |
|------------------|-------|------------------------------------|
| `rounded-full`   | 9999  | buttons, pills, tabs, badges (most common) |
| `rounded-[28px]` | 28    | large panels                       |
| `rounded-[24px]` | 24    | section panels, login card         |
| `rounded-2xl`    | 16    | inner content cards                |
| `rounded-xl`     | 12    | inputs                             |
| `rounded-[20px]` | 20    | occasional panels                  |
| `rounded-lg`     | 8     | rare                               |
| `rounded-md`     | 6     | rare                               |

Do **not** introduce other radii.

---

## 4. Spacing (px, 1:1 from RN)
Tailwind scale used inline: `p-1`(4) `p-3`(12) `p-4`(16) `p-5`(20); `px-3`(12) `px-4`(16) `px-5`(20); `py-1.5`(6) `py-2.5`(10) `py-3`(12); gaps `gap-2`(8) `gap-2.5`(10) `gap-3`(12).

Key containers:
- **Screen padding:** `px-5` (20px horizontal), top 18px, bottom 36px.
- **Section panel:** `p-5` (20px).
- **Inner card:** `p-4` (16px).
- **Input:** `px-4 py-3` (16 / 12).
- **Primary button:** height `h-11`/`h-12` (44/48px), `px-5` (20px).
- **Tab/pill track:** `p-1` (4px).

---

## 5. Shadows
Admin screens are **flat** — cards and panels have **no shadow and no border** (just `bg-[#F7F7F8]` panels containing `bg-white` cards). The only outlines are on **inputs** (`border-[#DEDEE2]`) and the partner **badge** (`border border-white`). Do not add `box-shadow` to cards/panels to match the Expo look.

---

## 6. Component blueprints (Expo → web)

### Primary button
`h-11 (or h-12) rounded-full bg-[#ED7D4B] px-5` · label `text-[14px]/[15px] font-geist-semibold text-white` · pressed `active:opacity-85`.

### Secondary / neutral button
`h-11 rounded-full bg-[#F2F2F3] px-5` · label `text-[14px] font-geist-semibold text-[#222222]`.

### Tab bar (segmented)
Track `rounded-full bg-[#F2F2F3] p-1`; each tab `h-11 flex-1 rounded-full`, active `bg-[#111111]`, inactive transparent; label `text-[13px] font-geist-semibold`, active white, inactive `#6C6C6E`.

### Filter pill group
Track `rounded-full bg-[#E9E9EC] p-1`; pill `rounded-full px-4 py-1.5`, active `bg-[#111111]`; label `text-[12px] font-geist-semibold`, active white, inactive `#33343A`.

### Section panel
`rounded-[24px] bg-[#F7F7F8] p-5`. Title `text-[20px] font-geist-semibold text-[#171717]`.

### Metric card
`rounded-2xl bg-white p-4 min-w-[145px]` · label `text-[11px] font-geist-bold uppercase tracking-wider text-[#77777D]` · value `text-[26px] font-geist-bold text-[#111111] mt-2`.

### Text input
`rounded-xl border border-[#DEDEE2] bg-white px-4 py-3 text-[14px] font-geist text-[#111111]` · placeholder `#9A9AA0`. Label above: `text-[14px] font-geist text-[#55555A]`.

### Status pill
`rounded-full px-2.5 py-1` with `STATUS_STYLES[status].bg`; label `text-[11px] font-geist-bold` with `.text` color (see §2).

### Badge (count)
`bg-[#F04646] rounded-full min-w-[18px] h-[18px] border border-white` · `text-[9px] font-geist-bold text-white`.

---

## 7. Responsive scaling (web only)

The Expo app is fixed mobile sizing. On web, **phone width (`base`, < 768px) is pixel-identical to Expo.** Sizes then step **up** at two breakpoints toward ~1.25× at the largest screens:

- **`base`** (< 768px) — exact Expo value.
- **`md:`** (≥ 768px) — intermediate (~1.12×).
- **`xl:`** (≥ 1280px) — top tier (~1.25×).

Apply the same three-stop ramp to **font size, padding, button height, and radius**. Never scale colors, borders, or status tokens.

### Font-size ramp (`base → md: → xl:`)
| base | md  | xl  |
|------|-----|-----|
| 11   | 12  | 14  |
| 12   | 13  | 15  |
| 13   | 14  | 16  |
| 14   | 15  | 17  |
| 15   | 16  | 19  |
| 16   | 18  | 20  |
| 18   | 20  | 22  |
| 20   | 22  | 25  |
| 22   | 24  | 27  |
| 26   | 30  | 33  |
| 28   | 32  | 35  |

Example: `text-[14px] md:text-[15px] xl:text-[17px]`.

### Spacing / size ramp
| base (px) | md  | xl  | Typical use            |
|-----------|-----|-----|------------------------|
| p-4 (16)  | 20  | 24  | inner card padding     |
| p-5 (20)  | 24  | 32  | section panel padding  |
| px-5 (20) | 24  | 32  | screen / button px     |
| h-11 (44) | 48  | 56  | buttons, tabs          |
| h-12 (48) | 52  | 56  | primary button         |
| gap-3 (12)| 16  | 20  | grid/stack gaps        |

Example: `p-4 md:p-5 xl:p-6`, `h-11 md:h-12 xl:h-14`.

### Radius ramp (one step up only — keep it subtle)
| base            | md             | xl             |
|-----------------|----------------|----------------|
| `rounded-2xl` (16) | `rounded-[20px]` | `rounded-[24px]` |
| `rounded-[24px]`   | `rounded-[28px]` | `rounded-[32px]` |
| `rounded-xl` (12)  | `rounded-xl` (12) | `rounded-[14px]` |
| `rounded-full`     | `rounded-full`   | `rounded-full`   |

---

## 8. Web-specific adaptations (allowed, flagged)
These have no Expo equivalent because Expo is a single-column mobile app. Keep them, but built from the tokens above:
- **Max-width container** (`max-w-[1200px]`) + multi-column grids on desktop. On a phone-width viewport the result must collapse to the single-column Expo layout.
- **`:hover` states** — Expo is touch-only. Use restrained hover (e.g. primary → `#EE5B1B`).
- **Separate routes** for tabs (Next.js) vs. in-screen `activeSection` state. Visual result must be identical.
