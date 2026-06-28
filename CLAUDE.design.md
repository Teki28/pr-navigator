# Project: Liquid Glass Web App

## Design System
Follow the full design system in `docs/design-system.md`. Design tokens live in
`tailwind.config.js` and `src/styles/tokens.css` — always use tokens, never hardcode values.

The aesthetic is **Apple Liquid Glass**: translucent, depth-layered surfaces that
refract and blur whatever sits behind them, with light specular edges, soft elevation
shadows, and fluid spring-based motion. Surfaces feel like physical glass — they bend
light, catch highlights, and respond to interaction with momentum, not linear easing.

## Non-negotiable rules
- Use Tailwind utility classes + the defined tokens only. No inline hex, no magic numbers.
- Every elevated surface (cards, modals, nav, popovers) uses the `.glass` layer pattern:
  `backdrop-blur` + semi-transparent fill + specular border + elevation shadow.
- Color comes from CSS variables so light/dark and tint themes swap cleanly.
- Motion uses the spring/easing tokens in the config. No abrupt linear transitions on
  interactive elements. Respect `prefers-reduced-motion` everywhere.
- Mobile-first. Keyboard focus must be visible. Maintain WCAG AA contrast for text
  (place a subtle scrim behind text over glass if contrast drops).

## Stack assumptions
- React + Tailwind CSS. Framer Motion for orchestrated/spring animation.
- If a component needs glass, reach for the `Glass` primitive (see design-system.md)
  rather than re-implementing the blur stack.
