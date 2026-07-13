# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Japan PR Navigator** — a local-first, no-login browser app that guides non-Japanese speakers through Japan's Permanent Residency application process. It runs entirely in the browser with zero network calls for user data.

## Stack

- **React + Vite** (TypeScript strict mode)
- **Tailwind CSS** with custom design tokens
- **Framer Motion** for spring-based animation
- **Zustand** (modular stores, no Redux)
- **IndexedDB** via `idb` for document blobs and progress state
- **Custom i18n** (`src/i18n/`) — `t()` / `useT()` hook backed by static locale JSON catalogs; no i18next
- **Vitest** for unit/component tests
- **Cloudflare Pages** for static hosting (build output: `dist/`)

## Commands

```bash
npm run dev        # dev server
npm run build      # TypeScript compile + Vite build → dist/
npm run lint       # ESLint
npm run test       # Vitest (all tests)
npm run test FILE  # run a single test file
```

## Architecture

Strict three-layer dependency direction:

```
PRESENTATION (features/* · ui/* · app/*)
    ↓ reads/dispatches
STATE (store/ — Zustand stores)
    ↓ calls                    ↓ calls
DOMAIN (engine/ · content/)   INFRASTRUCTURE (persistence/ · i18n/)
```

**Key invariants that must never be broken:**
1. UI/features import only from `store/` — never directly from `engine/` or `persistence/`.
2. `engine/` has zero React, `window`, or I/O imports — pure functions only.
3. All domain knowledge lives in `content/`; changing rules requires no code edits.
4. No user data ever leaves the device; file blobs stay in IndexedDB only.
5. All storage goes through `StateRepository` / `BlobRepository` interfaces in `persistence/`.

## Module Responsibilities

| Module | Role |
|---|---|
| `src/engine/` | Pure, deterministic logic: condition evaluator, questionnaire traversal, decision evaluation. Zero dependencies. Table-driven unit tests only. |
| `src/content/` | Loader + Zod schema validation for the `content/` knowledge base. Fails loudly on invalid content. |
| `src/persistence/` | IndexedDB and localStorage adapters behind `StateRepository` / `BlobRepository` interfaces. The only place that knows about storage APIs. |
| `src/store/` | Zustand stores (`useProfileStore`, `useQuestionnaireStore`, `useResultsStore`, `useDocumentsStore`, `useUiStore`). Orchestrate engine calls + persistence. Testable headless. |
| `src/features/` | Screen-level composition: `landing`, `track-select`, `questionnaire`, `decision` (results), `quest-map`, `documents`, `export-import`. Reads stores + renders `ui/`. |
| `src/ui/` | Dumb presentational components. No store or domain imports. |
| `src/app/` | Bootstrap, router, providers, layout shell, hydration gate. |
| `content/` | The pluggable knowledge base: questions, decision tree, tracks, documents, locales. JSON + Markdown. |

## Content Model

Domain content lives in `content/` as JSON/Markdown, not in code:

```
content/
  questions/questions.json              # branching question bank
  decision/decision-tree.json           # rules mapping answers → candidate tracks
  tracks/track-<id>.json                # track metadata, milestones, document ids
  checklists/checklist-<id>.json        # per-track document checklists
  documents/meta.json                   # top-level document registry
  documents/<doc-id>/meta.json          # document agency/category/obtain-method
  documents/<doc-id>/guidance.en.md     # per-locale guidance Markdown (lazy-loaded)
  locales/{en,ja,zh-CN,zh-TW,ko}.json  # UI i18n strings (5 supported locales)
  content.manifest.json                 # version index
```

All content (except guidance Markdown) is loaded eagerly via Vite `import.meta.glob` and bundled at build time — zero runtime fetches. Guidance Markdown is lazy-loaded on demand with locale fallback to `en`.

Questions use declarative `next[]` branches (JSON conditions, never `eval`). Adding a track or document = edit `content/`, no code change needed.

## Routes

| Path | Feature | Component |
|---|---|---|
| `/` | Landing | `LandingPage` |
| `/track-select` | Track selection | `TrackSelectPage` |
| `/questionnaire` | Q&A flow | `QuestionPage` |
| `/results` | Track candidates | `ResultsPage` |
| `/map` | Quest map / checklist | `QuestMapPage` |
| `/settings` | Export / import | `ExportImportPage` |

All routes are wrapped in `HydrationGate` (waits for IndexedDB load before render) and lazy-loaded with `React.lazy`.

## i18n

`src/i18n/index.ts` is a custom translation layer — **not i18next**.

- `t(key, vars?, locale?)` — pure function, safe outside React. Falls back: requested locale → EN → raw key.
- `useT()` — React hook that binds `t()` to `useUiStore` locale.
- Key mapping: `q.<id>.label` → `questions.<id>.label`, `q.<id>.opt.<v>` → `questions.<id>.options.<v>`, `track.<id>.*` → `tracks.<id>.*`, `milestone.<id>` → `milestones.<id>`.
- Supported locales: `en`, `ja`, `zh-CN`, `zh-TW`, `ko`. Add a new locale by adding the JSON file to `content/locales/` and one line to `CATALOGS` in `src/i18n/index.ts`.

## Design System (Liquid Glass)

**See `docs/design-system.md` for full reference. `CLAUDE.design.md` is the authoritative rules summary.**

Core rules:
- Use Tailwind utility classes + tokens from `tailwind.config.js` and `tokens.css` only — never hardcode hex or px values.
- Every elevated surface (cards, nav, modals) uses `.glass` / `.glass-strong` / `.glass-thin` — `backdrop-blur` + semi-transparent fill + specular border + elevation shadow.
- Colors come from CSS variables so light/dark themes swap without component changes.
- Motion uses spring tokens. Use Framer Motion `spring-press` / `spring-sheet` presets. Always respect `prefers-reduced-motion`.
- Use the `<Glass>` primitive for any new glass surface; don't re-implement the blur stack.
- Text over glass must meet WCAG AA — add a `--glass-fill-strong` scrim if needed.
- Mobile-first. Visible keyboard focus (`--accent` ring) on every interactive element.

## Persistence Design

- **IndexedDB** (`pr-navigator` DB):
  - `app` store: full `PersistedState` (no blobs), key `'state'`
  - `documents` store: blob metadata, key `docId`
  - `blobs` store: raw `Blob`, key `docId`
- **localStorage**: only `locale`, `theme`, `lastRoute` (tiny, sync-read for fast first paint)
- **Autosave**: every Zustand store subscribes via `store/persistence.ts`; any state change triggers a 500 ms debounced `IdbStateRepository.saveState()`. Boot hydration runs in `HydrationGate` before any route renders.
- **Export format**: versioned JSON (`schemaVersion` + `contentVersion`), blobs intentionally excluded in prototype

## Testing Approach

| Layer | Method |
|---|---|
| `engine/` | Pure unit tests, table-driven. No mocks needed. |
| `content/` | Schema validation tests; sample fixtures must pass. |
| `persistence/` | Adapter tests with `fake-indexeddb`; round-trip save/load. |
| `store/` | Headless store tests (action → state transitions). |
| `features/ui/` | Component tests for key flows. |
| e2e | Happy-path: questionnaire → track → checklist → export/import. |
