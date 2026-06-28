# DESIGN.md — Japan PR Navigator: Architecture & Technical Documentation

> Companion to `SPEC.md`. SPEC defines **what** and **why**; this document defines
> **how** — the layered architecture, module contracts, data flow, engine
> internals, persistence design, and the reasoning behind key decisions.
>
> Audience: developers building or extending the app.

---

## 1. Architectural Overview

### 1.1 Shape of the system
A single-page, client-only TypeScript application. Three conceptual layers, with a
strict dependency direction (arrows = "depends on"):

```
        ┌──────────────────────────────────────────────┐
        │              PRESENTATION (React)            │
        │   features/* · ui/* · app/* · i18n hooks     │
        └───────────────┬──────────────────────────────┘
                        │ reads/dispatches
        ┌───────────────▼──────────────────────────────┐
        │              STATE (Zustand stores)          │
        │   profile · questionnaire · progress ·       │
        │   documents · ui                             │
        └───────┬──────────────────┬───────────────────┘
                │ calls            │ calls
   ┌────────────▼─────────┐  ┌─────▼──────────────────────┐
   │   DOMAIN (pure)      │  │   INFRASTRUCTURE (I/O)     │
   │   engine/ · content/ │  │   persistence/ · i18n cfg  │
   │   (no React, no I/O) │  │   (IndexedDB, localStorage)│
   └──────────────────────┘  └────────────────────────────┘
```

**Rules of the dependency graph**
- Presentation never touches IndexedDB or the engine directly — only stores.
- Stores orchestrate: they call pure domain functions and infrastructure adapters.
- `engine/` and `content/` schemas are **pure** — no React, no `window`, no I/O —
  so they are trivially unit-testable and portable (Worker, RN, server later).
- `persistence/` is the **only** place that knows about IndexedDB/localStorage.

This is the central design bet: **isolate volatile concerns (UI framework,
storage, domain rules) behind stable interfaces** so each can change
independently. SPEC §5.3's future features (login, AI, mobile) all land on these
seams.

### 1.2 Why these choices
| Decision | Rationale | Alternative rejected |
|---|---|---|
| React + Vite | Fast DX, static-build friendly, huge ecosystem | Svelte/Solid (smaller community for contributors) |
| Zustand | Minimal, store-per-domain, no boilerplate, framework-agnostic store logic | Redux (ceremony), Context (re-render cost) |
| Pure `engine/` | Portability + testability + AI-swap seam | Logic embedded in components (untestable, locked-in) |
| Content as JSON/MD files | Non-devs can edit; no code deploy to change rules | Hardcoded rules (violates SPEC §6) |
| IndexedDB via `idb` | Blob storage + large quota + async | localStorage (no blobs, 5MB cap) |
| Cloudflare Pages | Free static hosting, Workers adjacency for future backend | Vercel/Netlify (fine, but Workers path is the stated future) |

---

## 2. Module Contracts

Each module exposes a narrow, typed surface. Consumers depend on the **interface**,
not the implementation.

### 2.1 `engine/` — pure domain logic
No I/O. Deterministic. Fully unit-tested.

```ts
// engine/conditions.ts
export type Op = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'includes';
export interface Condition { var: string; op: Op; value: unknown; }
export interface ConditionGroup { all?: Node[]; any?: Node[]; not?: Node; }
export type Node = Condition | ConditionGroup;

export function evaluate(node: Node, profile: AnswerProfile): boolean;

// engine/questionnaire.ts
export function nextQuestionId(
  current: Question,
  profile: AnswerProfile
): string | null;                       // null => questionnaire complete

// engine/decision.ts
export function evaluateTracks(
  ruleset: DecisionRuleset,
  profile: AnswerProfile,
  tracks: TrackMap
): TrackCandidate[];                     // 0..n matches, ordered by confidence
```

**Contract guarantees**
- Same inputs → same outputs (referential transparency).
- Never throws on valid (schema-checked) content; returns explainable results.
- `TrackCandidate` carries `matchedConditions` so the UI can render "why".

### 2.2 `content/` — loading + validation
```ts
// content/loader.ts
export interface ContentBundle {
  questions: Question[];
  decision: DecisionRuleset;
  tracks: TrackMap;
  documents: DocumentMetaMap;
  manifest: ContentManifest;            // version, ids index
}
export function loadContent(locale: Locale): Promise<ContentBundle>;
export function loadGuidanceMarkdown(docId: string, locale: Locale): Promise<string>;
```
- Validates every file against a schema (e.g. `zod`) at load; invalid content fails
  loudly in dev, and is reported (not silently dropped) in prod.
- Guidance Markdown is **lazy-loaded** per document/locale (perf, SPEC §4).
- The manifest lets the loader resolve ids → files and carries a content version
  used in exports (§5.3).

### 2.3 `persistence/` — storage abstraction
The single seam for the future backend.

```ts
// persistence/types.ts
export interface StateRepository {
  loadState(): Promise<PersistedState | null>;
  saveState(state: PersistedState): Promise<void>;
  clear(): Promise<void>;
}
export interface BlobRepository {
  put(docId: string, file: Blob, meta: BlobMeta): Promise<void>;
  get(docId: string): Promise<{ blob: Blob; meta: BlobMeta } | null>;
  delete(docId: string): Promise<void>;
  list(): Promise<BlobMeta[]>;
}
```
- Prototype implementation: `IndexedDbStateRepository` + `IndexedDbBlobRepository`
  (plus a `localStorage` fast-path for tiny UI prefs / last-route).
- Future: a `RemoteSyncRepository` implements the **same interfaces** behind a
  login — no store or UI change required.

### 2.4 `store/` — orchestration (Zustand)
One store per bounded concern; stores compose domain + infra.

```ts
useProfileStore        // answers, setAnswer(), reset()
useQuestionnaireStore  // currentId, path, next()/back(), complete
useResultsStore        // candidates, selectedTrackId, evaluate(), selectTrack()
useDocumentsStore      // per-doc status, notes, upload()/markHave()/remove()
useUiStore             // locale, theme, lastRoute
```
- Stores are the **only** thing the UI imports for data.
- Mutations that change persisted state trigger a debounced `saveState`.
- Stores never import React; they can be tested headless.

### 2.5 `features/` & `ui/`
- `features/*` = screen-level composition (questionnaire flow, results, quest map,
  document panel, export/import). They read stores and render `ui/*`.
- `ui/*` = dumb, reusable presentational components (buttons, cards, progress
  ring, milestone node, file dropzone). No store/domain imports.

---

## 3. Data Flow (end-to-end)

### 3.1 Answering a question
```
User selects answer
  → feature calls useProfileStore.setAnswer(qId, value)
  → useQuestionnaireStore.next():
        engine.nextQuestionId(currentQuestion, profile) → nextId | null
  → store updates currentId + path
  → debounced persistence.saveState()
  → UI re-renders next question (or routes to results when null)
```

### 3.2 Evaluating tracks
```
Questionnaire complete
  → useResultsStore.evaluate():
        engine.evaluateTracks(ruleset, profile, tracks) → TrackCandidate[]
  → results rendered side-by-side (pros/cons, difficulty, "why", confidence)
  → low-confidence/edge → render "consult a professional" guardrail (SPEC §3.8)
  → user selectTrack(id) → resolves milestones + required documents
  → route to Quest Map
```

### 3.3 Document interaction
```
Mark "I have it"
  → useDocumentsStore.markHave(docId): status='have', updatedAt; saveState()

Optional upload
  → useDocumentsStore.upload(docId, file):
        BlobRepository.put(docId, file, meta)   // IndexedDB, never network
        status='uploaded'; saveState()
  → preview/download read back via BlobRepository.get()
  → remove() deletes blob + resets status
```

### 3.4 Persistence lifecycle
```
App boot
  → persistence.loadState() → hydrate stores (or fresh start)
  → if selectedTrackId present → resume at Quest Map (SPEC §2)
On every meaningful mutation
  → debounced saveState() (coalesces bursts; avoids thrashing IndexedDB)
Export → serialize PersistedState (minus blobs) → download .json
Import → parse + validate + version-check → replace state (confirm overwrite)
Reset  → persistence.clear() (state + blobs) → stores to defaults
```

---

## 4. Engine Internals

### 4.1 Condition evaluation
- A small, safe, **data-driven** evaluator — **no `eval`, no dynamic code**.
- `Condition` resolves `var` against the answer profile, applies `op` to `value`.
- `ConditionGroup` composes with `all` / `any` / `not` recursively.
- Unknown variables resolve to `undefined` and fail comparisons safely (never throw).
- This keeps branching logic expressible purely as JSON (SPEC §6.2) while staying
  injection-proof — important because content may later be user-/CMS-supplied.

### 4.2 Questionnaire traversal
- Each question carries an ordered `next[]` of `{ if?, default?, goto }`.
- `nextQuestionId` returns the first branch whose condition passes (or the
  `default`), enabling answer-dependent paths (SPEC §3.1).
- `visitedPath` is retained so **Back** navigation is exact (not recomputed),
  preserving answers and avoiding branch ambiguity.

### 4.3 Decision evaluation
- Rules are independent; **all** matching rules contribute candidates → multiple
  tracks can surface (SPEC §3.2).
- Each candidate captures `confidence` and the concrete `matchedConditions`,
  powering both ordering and the explainability UI.
- Resolution step expands a track's `milestones[].documents[]` into the concrete
  per-user checklist that seeds the progress map.

### 4.4 Testability
- `engine/` ships with table-driven unit tests: condition truth tables, branch
  selection per profile, multi-track resolution, edge/empty profiles.
- Because the engine is pure, these tests need no DOM, no mocks, no IndexedDB.

---

## 5. Persistence Design

### 5.1 IndexedDB schema (object stores)
```
DB: pr-navigator (version N)
  store "app"        key: 'state'   value: PersistedState (no blobs)
  store "documents"  key: docId     value: { meta: BlobMeta }     // index
  store "blobs"      key: docId     value: Blob                    // file bytes
```
- State and blobs are **separated** so exporting/clearing state never forces
  loading large file bytes, and blob quota pressure is isolated.
- `localStorage` holds only tiny, synchronous-read values: `locale`, `theme`,
  `lastRoute` (so first paint can route instantly before IndexedDB resolves).

### 5.2 Why split state vs blobs
- Aligns with SPEC §3.4/§3.6: "I have it" is metadata-only; uploads are optional
  bytes. Export defaults to metadata-only, so state and blobs have different
  lifecycles and sizes — separate stores keep each operation cheap.

### 5.3 Export format & versioning
```jsonc
{
  "app": "pr-navigator",
  "schemaVersion": 1,          // bump on breaking shape changes
  "contentVersion": "...",     // from content manifest at export time
  "exportedAt": "ISO-8601",
  "state": { /* PersistedState: profile, questionnaire, results,
                selectedTrackId, progress (status+notes), ui */ }
  // blobs intentionally omitted in prototype (SPEC §3.6)
}
```
- Import validates `schemaVersion`; unknown/newer → guided message, no silent
  corruption. A migration hook (`migrate(state, fromVersion)`) is the extension
  point when the shape evolves.
- `contentVersion` lets the app warn if an export was made against materially
  different content (e.g. a track id no longer exists).

### 5.4 Migrations
- IndexedDB `onupgradeneeded` centralizes DB schema migrations.
- State-shape migrations live beside the export schema (`migrate()`), reused for
  both on-disk hydrate and import.

---

## 6. Internationalization Design
- Two distinct string sources, unified at the UI:
  1. **UI chrome** strings → `content/locales/<locale>.json` via i18n lib.
  2. **Content** strings (questions/tracks/docs) → **locale keys** resolved
     through the same i18n catalog, so content carries `labelKey`/`titleKey`
     rather than literal text (SPEC §6.2).
- Guidance is authored as **per-locale Markdown** files, lazy-loaded by
  `loadGuidanceMarkdown(docId, locale)`.
- Adding a language = adding a locale catalog + guidance files; **no code change**.
- Locale changes update `useUiStore.locale`, re-resolving keys and re-loading the
  active guidance file.

---

## 7. Routing & App Shell
- Client-side routes (lazy-loaded chunks): `/` (landing), `/q` (questionnaire),
  `/results`, `/map` (quest map), with document detail as an overlay/panel rather
  than a full route (keeps context, SPEC §8).
- On boot, `lastRoute` + presence of `selectedTrackId` decide the resume target.
- `app/` holds providers (i18n, store hydration gate), the responsive layout
  shell (wide canvas vs stacked mobile), and the persistent disclaimer banner.

---

## 8. Performance Strategy
- **Code-split** by route/feature so the landing/questionnaire load minimal JS.
- **Lazy content**: decision/tracks loaded on demand; guidance Markdown fetched
  per open document, per locale.
- **Debounced persistence** coalesces rapid mutations into single IndexedDB writes.
- **Selective store subscriptions** (Zustand selectors) minimize re-renders on the
  quest map (many nodes).

---

## 9. Privacy & Security Posture
- **No network calls carry user data** (SPEC §4); prototype has no analytics.
- Uploaded files live only in IndexedDB on the user's device; a visible affordance
  states this (SPEC §3.4).
- Condition evaluator is data-driven (no `eval`) — safe even if content becomes
  user-supplied later.
- Markdown guidance is rendered with sanitization to prevent injected HTML/script
  from content files.
- Export is plain JSON by user action only; encrypted export is a future option
  (SPEC §10).

---

## 10. Testing Strategy
| Layer | Approach |
|---|---|
| `engine/` | Pure unit tests, table-driven (conditions, branching, decisions) |
| `content/` | Schema-validation tests; sample content must pass; fixtures |
| `persistence/` | Adapter tests against fake-indexeddb; round-trip save/load |
| `store/` | Headless store tests (actions → state transitions) |
| `features/ui` | Component tests for key flows (answer, select track, upload) |
| e2e (later) | Happy-path: questionnaire → track → checklist → export/import |

Pure-domain isolation is what makes the most important logic the easiest to test.

---

## 11. Extension Playbook (mapping SPEC §10 to seams)
| Future feature | Where it plugs in | Code impact |
|---|---|---|
| Login + backend sync | New `RemoteSyncRepository` implementing `StateRepository`/`BlobRepository` | Swap adapter at composition root; stores/UI unchanged |
| AI-assisted decisions | Alt implementation of `engine.evaluateTracks`/branching behind same signature | Engine interface stable; content still drives base case |
| Mobile app (RN) | Reuse `engine/` + `content/`; new presentation + persistence adapters | Domain reused as-is |
| Blob-embedded / encrypted export | Extend export serializer + `schemaVersion` bump + migrate hook | Localized to export-import module |
| PWA / offline SW | Add service worker + caching of app shell & content | Additive; no architecture change |
| XP / badges | New gamification store derived from `progress`; new UI | Reads existing state; no engine change |
| Content CMS | Authoring tool emits the same `content/` schemas | Loader/validation already enforce contract |

---

## 12. Repository Layout (concrete)
```
/
├── content/                      # knowledge base (SPEC §6) — editable, no code
│   ├── questions/questions.json
│   ├── decision/decision-tree.json
│   ├── tracks/track-*.json
│   ├── documents/<doc-id>/{meta.json,guidance.en.md,guidance.ja.md}
│   ├── locales/{en.json,ja.json}
│   └── content.manifest.json
├── src/
│   ├── app/                      # bootstrap, router, providers, shell
│   ├── engine/                   # pure logic (no React/I/O)
│   ├── content/                  # loader + schema validation
│   ├── persistence/              # IndexedDB + localStorage adapters
│   ├── store/                    # Zustand stores
│   ├── features/{questionnaire,decision,quest-map,documents,export-import}/
│   ├── i18n/                     # config + hooks
│   ├── ui/                       # presentational components
│   └── types/                    # shared types & schemas
├── tests/                        # mirrors src; engine-heavy
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json                 # strict
└── (cloudflare pages: build → dist/ as static assets)
```

---

## 13. Key Invariants (must hold)
1. UI never imports `persistence/` or `engine/` directly — only `store/`.
2. `engine/` and content schemas contain **no** React, `window`, or I/O.
3. All domain knowledge is in `content/`; changing rules requires **no code edit**.
4. No user data leaves the device; uploads stay in IndexedDB.
5. Persisted/exported state is versioned; imports are validated and migratable.
6. Every storage mechanism sits behind `StateRepository` / `BlobRepository`.

> Hold these six invariants and every SPEC §10 extension remains a localized,
> low-risk change rather than a rewrite.
