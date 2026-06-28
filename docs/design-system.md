# Liquid Glass — Design System

The core idea: surfaces are **panes of glass floating over a living background**. They
are translucent, blur and tint what's behind them, carry a bright specular edge where
light catches, and cast a soft shadow that proves they're lifted off the page. Nothing
is flat-filled; depth is the medium. Motion is **physical** — things settle with a
spring, they don't snap.

Three layers always exist:
1. **Background** — a soft, slowly shifting gradient or imagery. This is what the glass
   refracts. Without a rich background, glass looks gray and dead.
2. **Glass surfaces** — translucent panes (cards, nav, sheets) sitting above it.
3. **Content** — text and controls on the glass, kept high-contrast and legible.

---

## Color

Color is delivered through CSS variables (`tokens.css`) so themes swap without touching
components. Hex values below are the light-theme defaults.

| Token | Value | Role |
|---|---|---|
| `--bg-base` | `#EEF1F6` | Page base behind the gradient |
| `--bg-tint-a` | `#C7D4FF` | Background gradient stop A |
| `--bg-tint-b` | `#FFD6EC` | Background gradient stop B |
| `--bg-tint-c` | `#D4F5E9` | Background gradient stop C |
| `--glass-fill` | `rgba(255,255,255,0.45)` | Glass surface fill |
| `--glass-fill-strong` | `rgba(255,255,255,0.65)` | Higher-opacity glass (modals, nav) |
| `--glass-border` | `rgba(255,255,255,0.7)` | Top/left specular edge |
| `--glass-border-soft` | `rgba(255,255,255,0.25)` | Bottom/right edge |
| `--text-primary` | `#10131A` | Headings, primary text |
| `--text-secondary` | `rgba(16,19,26,0.62)` | Body, muted |
| `--accent` | `#0A84FF` | Primary action (Apple system blue) |
| `--accent-hover` | `#0060DF` | Pressed/hover accent |
| `--danger` | `#FF453A` | Destructive |

**Dark theme** (`[data-theme="dark"]`): `--bg-base #0A0C12`; gradient stops deepen to
`#1B2A6B / #5A1E45 / #11402F`; `--glass-fill rgba(28,30,38,0.5)`;
`--glass-border rgba(255,255,255,0.18)`; `--text-primary #F2F4F8`;
`--text-secondary rgba(242,244,248,0.6)`.

Rules:
- Never fill a card with a flat opaque color. Use `--glass-fill` + blur.
- Accent is used sparingly — one primary action per view.
- Over busy backgrounds, text gets a faint scrim (`--glass-fill-strong` behind it) so
  AA contrast holds.

---

## The glass material

Every elevated surface is built from the same stack. This is the signature of the system.

```css
.glass {
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid transparent;
  /* specular edge: bright top-left, soft bottom-right */
  border-image: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-border-soft) 60%
  ) 1;
  border-radius: var(--radius-lg);
  box-shadow:
    0 1px 1px rgba(255,255,255,0.4) inset,   /* inner top highlight */
    0 8px 32px rgba(16,19,26,0.12),          /* elevation */
    0 2px 8px rgba(16,19,26,0.08);
}
```

Variants:
- `.glass-strong` — uses `--glass-fill-strong` and `blur(40px)`; for nav bars and modals
  that need more legibility.
- `.glass-thin` — `blur(12px)`, lighter fill; for chips, tooltips, inline badges.

Implementation notes:
- Always pair `backdrop-filter` with the `-webkit-` prefix.
- Blur is expensive — don't stack more than ~3 glass layers in one viewport.
- A glass surface needs something behind it to refract. Over a plain white section it
  reads as flat; place it over the gradient background or imagery.

---

## Typography

| Role | Font | Notes |
|---|---|---|
| Display / UI | `-apple-system, "SF Pro Display", "Inter", system-ui, sans-serif` | Headings, controls |
| Body | `-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif` | Paragraphs |
| Mono | `"SF Mono", "JetBrains Mono", ui-monospace, monospace` | Code, data |

Inter is the web fallback when SF isn't licensed/available. Load it with weights 400/500/600/700.

Type scale (rem, 16px base):

| Token | Size | Line | Weight | Tracking |
|---|---|---|---|---|
| `display` | 3.5rem | 1.05 | 700 | -0.02em |
| `h1` | 2.5rem | 1.1 | 600 | -0.02em |
| `h2` | 2rem | 1.15 | 600 | -0.015em |
| `h3` | 1.5rem | 1.2 | 600 | -0.01em |
| `body-lg` | 1.125rem | 1.5 | 400 | 0 |
| `body` | 1rem | 1.5 | 400 | 0 |
| `caption` | 0.8125rem | 1.4 | 500 | 0.01em |

Headings track tighter and lean semibold (Apple's UI signature). Body stays at 400.

---

## Spacing, radius, layout

- Base unit **4px**. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Radius: `--radius-sm 10px`, `--radius-md 16px`, `--radius-lg 24px`, `--radius-xl 32px`,
  `--radius-full 9999px`. Glass surfaces favor large radii — corners feel like rounded
  physical edges, not sharp cuts.
- Generous padding inside glass (`24px`+ for cards) so content breathes above the blur.
- Container max-width `1120px`, gutter `24px` (`16px` on mobile).
- Mobile-first; breakpoints `sm 640 / md 768 / lg 1024 / xl 1280`.

---

## Motion

Motion is spring-based and physical. Things have weight and momentum; they overshoot
slightly and settle. Avoid `linear` and avoid long durations — interactions feel
instant but soft.

Easing / spring tokens:

| Token | Value | Use |
|---|---|---|
| `--ease-glass` | `cubic-bezier(0.32, 0.72, 0, 1)` | Default for transitions (Apple's sheet curve) |
| `--ease-out-soft` | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveals, entrances |
| `spring-press` | Framer: `{ type: "spring", stiffness: 400, damping: 30 }` | Button/tap feedback |
| `spring-sheet` | Framer: `{ type: "spring", stiffness: 300, damping: 34, mass: 0.9 }` | Modals, sheets, drawers |
| Durations | `--dur-fast 180ms`, `--dur-base 260ms`, `--dur-slow 420ms` | CSS transitions |

Signature behaviors:
- **Hover on glass** — surface lifts: shadow grows, fill opacity +0.08, a faint specular
  sweep moves across the top edge. `transition: all var(--dur-base) var(--ease-glass)`.
- **Press** — scales to `0.97` with `spring-press`, then springs back. Tactile, brief.
- **Sheet / modal entrance** — slides up + scales from `0.96` to `1` + blur fades in,
  using `spring-sheet`. Backdrop blur ramps `0 → 24px`.
- **Background** — the gradient drifts slowly (20–30s loop) so glass refraction subtly
  shifts. Keep it gentle; it's ambiance, not a focal point.
- **Scroll reveals** — content fades up 16px with `--ease-out-soft`, staggered ~60ms.

Accessibility:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```
Disable the drifting background and all springs under reduced motion.

---

## The `Glass` primitive

Don't re-implement the blur stack per component. Use one primitive:

```jsx
// <Glass variant="strong" className="p-6">…</Glass>
function Glass({ variant = "default", className = "", as: Tag = "div", ...props }) {
  const base = {
    default: "glass",
    strong: "glass-strong",
    thin: "glass-thin",
  }[variant];
  return <Tag className={`${base} ${className}`} {...props} />;
}
```

Components built on it: `Card`, `NavBar`, `Sheet`, `Modal`, `Popover`, `Toast`, `Chip`.

---

## Components

**Button (primary)** — accent fill, white text, `--radius-full` or `--radius-md`,
`h-11 px-6`, `spring-press` on tap, subtle inner top highlight. Secondary = `.glass-thin`
with `--text-primary`.

**Card** — `Glass`, `--radius-lg`, `p-6`, hover-lift behavior. Headings `h3`, body `body`.

**Nav bar** — `.glass-strong`, sticky, `--radius-full` pill on desktop floating with
margin, full-width translucent bar on mobile. Stronger blur so content scrolling
underneath stays readable.

**Modal / Sheet** — `.glass-strong` panel over a dimmed + blurred backdrop. Enters with
`spring-sheet`. On mobile, slides up as a bottom sheet with a drag handle.

**Input** — `.glass-thin` fill, `--radius-md`, `h-11`, focus ring in `--accent` at 40%
plus a brightened specular border. Placeholder uses `--text-secondary`.

**Chip / Badge** — `.glass-thin`, `--radius-full`, `caption` type.

---

## Quality floor
- Responsive to 360px wide.
- Visible keyboard focus (`--accent` ring) on every interactive element.
- `prefers-reduced-motion` respected; background animation and springs disabled.
- Text over glass meets WCAG AA — add a scrim if a busy background drops contrast.
- Don't over-blur: cap glass layers per viewport, watch performance on mobile.
