# SPEC.md — Japan PR Navigator (working title)

> A local-first, no-login web app that guides non-Japanese speakers through their
> Permanent Residency (PR) application in Japan: figures out which track(s) fit
> their situation, tells them which documents to gather and where, and turns the
> whole thing into an interactive, game-like progress tracker — all running
> entirely in the browser.

---

## 1. Goals & Non-Goals

### 1.1 Goals
- Determine the applicable PR **track(s)** from a branching questionnaire.
- Produce a personalized **document checklist** per track, with guidance on where each document is obtained.
- Provide a **centralized, interactive, game-like** UI to track progress.
- Let users **optionally store** their actual documents on-device, or simply mark "I have this".
- Keep everything **local-first**: no login, no servers, no telemetry.
- Be **content-driven**: tracks, questions, decision logic, and document guidance live as editable JSON/Markdown, decoupled from code.

### 1.2 Non-Goals (for the prototype)
- No real/complete legal ruleset (sample content only; pluggable for later).
- No backend, accounts, sync, or AI integration (architected for, not built).
- No submission to government systems; this is a planning/tracking aid only.
- No XP/badges/streak economy (progress + milestones + quest map only).

### 1.3 Guiding Principles (from brief)
1. No login.
2. Never collect user data — all processing and storage is on-device.
3. Interactive, intuitive, minimal onboarding friction.
4. Game-like to motivate progress.
5. Document organization on-device (IndexedDB or downloadable files).
6. Simple; avoid information overload.

---

## 2. Personas & Core Flow

**Persona:** A foreign resident in Japan with limited Japanese, unsure which PR
route applies, overwhelmed by document requirements and agencies.

**Core flow:**
```
Landing ─▶ Questionnaire (branching) ─▶ Track Results (multi, pros/cons)
   ─▶ User confirms a track ─▶ Personalized Quest Map (checklist + progress)
   ─▶ Per-document: guidance / mark-have / optional upload
   ─▶ Export progress (JSON) / Import to restore
```

Re-entry is automatic: on load, if saved state exists, user resumes at the quest map (with an option to re-run the questionnaire).

---

## 3. Functional Requirements

### 3.1 Questionnaire Engine
- Renders an ordered/branching set of **questions** defined in content (Section 6).
- Question types (prototype): `single-choice`, `multi-choice`, `boolean`, `number`, `date`.
- **Branching:** the next question is selected by evaluating conditions against accumulated answers. Conditions are declarative (JSON), not code.
- Supports back/forward navigation; answers persist as the user moves.
- Progress indicator for the questionnaire itself.
- Produces a normalized **answer profile** consumed by the decision engine.

### 3.2 Decision Engine
- Evaluates a **decision tree / ruleset** (JSON) against the answer profile.
- May return **multiple matching tracks**; each result includes match rationale, **pros & cons**, estimated difficulty/time, and the resolved document set.
- Presents results side-by-side; user **selects/confirms** one track to proceed (selection can be changed later).
- Deterministic and explainable — every result can show "why" (which answers triggered it).
- Engine logic is generic; all branching/scoring data is pluggable content.

### 3.3 Quest Map (Progress Tracker)
- Visualizes the chosen track as a **map of milestones**, each containing document/task "quests".
- Per item state: `not-started` | `in-progress` | `have` | `uploaded` | `done`.
- Overall + per-milestone **completion %**; milestones unlock/celebrate on completion (lightweight juice: confetti/animation — no XP economy).
- Each quest links to **document guidance** (Markdown: what it is, which agency, how/where to obtain, notes/pitfalls).
- User can **add personal notes** per item (stored locally).

### 3.4 Document Handling
- For each required document the user can:
  - **Mark "I have it"** → stores **metadata only** (status, optional note, timestamp).
  - **Upload the file (optional)** → stored as a **blob in IndexedDB**, never transmitted.
- Uploaded files can be previewed (where browser-supported), downloaded back, and deleted.
- Clear UI affordance that uploads stay on-device.

### 3.5 Persistence
- **IndexedDB**: document blobs + document metadata + full progress state.
- **localStorage**: small, fast-read app state (current step, selected track id, UI prefs, last-route). No documents in localStorage.
- All writes are local; app is fully functional offline after first load.

### 3.6 Export / Import
- **Export:** single **plain JSON** file containing answer profile, selected track, progress, document metadata, and notes.
  - Prototype default: file blobs are **not** embedded (metadata only) to keep export small; embedding blobs as base64 is a documented future option.
- **Import:** load a previously exported JSON to restore state (with confirm-overwrite prompt).
- **Reset:** clear all local data (with confirmation).

### 3.7 Internationalization (i18n)
- All UI strings externalized via an i18n layer from day one.
- Content (questions/tracks/docs) is **locale-keyed** so translations can be added without code changes.
- Prototype ships **English** (and structure ready for `ja`, others). Language switcher in UI.

### 3.8 Disclaimers / Guardrails
- Persistent, non-intrusive disclaimer: informational tool, not legal advice; recommend professional/official confirmation for edge cases.
- Results screen surfaces a "consult a professional" note for low-confidence/edge matches.

---

## 4. Non-Functional Requirements
- **Privacy:** zero network calls for user data; no analytics in prototype. Any future telemetry must be opt-in and documented.
- **Offline:** works offline after initial load (PWA/service worker is a documented near-term option; not required for prototype).
- **Performance:** initial load lean; content lazy-loaded per track/locale.
- **Accessibility:** keyboard-navigable, semantic HTML, sufficient contrast, screen-reader labels.
- **Responsive:** large-screen-first layout, fully usable on mobile.
- **Maintainability:** modular, typed, content/code separation for easy future edits.

---

## 5. Architecture

### 5.1 Stack
| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI | React + Vite |
| Styling | Tailwind CSS |
| State | Zustand (modular stores) |
| Local DB | IndexedDB (via thin wrapper, e.g. `idb`) |
| i18n | lightweight i18n lib (e.g. `i18next` + react bindings) |
| Markdown | MD renderer for document guidance |
| Routing | client-side router (hash or history) |
| Deploy | **Cloudflare Pages** (static assets); Workers reserved for future backend |

Pure front-end, no backend required. Static build deploys directly to Cloudflare Pages.

### 5.2 Module Layout (separation of concerns)
```
src/
  app/                 # bootstrap, router, providers, layout shell
  features/
    questionnaire/     # question renderer, branching navigation
    decision/          # decision engine (pure, content-driven)
    quest-map/         # progress visualization & milestones
    documents/         # have/upload/preview, IndexedDB binding
    export-import/     # JSON serialize / restore / reset
  engine/              # pure logic: condition eval, tree eval, scoring
                       #   - framework-agnostic, unit-testable, no React
  content/             # loaders + schema validation for bundled content
  store/               # Zustand stores (profile, progress, documents, ui)
  persistence/         # IndexedDB + localStorage adapters (swappable)
  i18n/                # config, locale resources, hooks
  ui/                  # reusable presentational components
  types/               # shared TypeScript types & content schemas
content/               # the bundled knowledge base (Section 6)
```

**Key boundaries**
- `engine/` is **pure** (no I/O, no React) so the same logic can later run in a Worker or be swapped for AI-assisted evaluation.
- `persistence/` hides the storage mechanism behind an interface → future swap to a backend/sync layer touches one module.
- `content/` validates content against schemas at load → bad content fails fast.
- `store/` is the single source of truth the UI reads from.

### 5.3 Future-Proofing (architected for, not built)
- **Login / backend:** persistence interface + export format already model the full user state; a sync adapter can be added behind the same interface. Cloudflare Workers + D1/KV is the natural target.
- **AI integration:** decision engine is pure and content-driven; an AI evaluator can implement the same interface to assist branching/explanation.
- **Mobile app:** logic isolation in `engine/` + content separation allows reuse (e.g. React Native shell) without rewriting rules.
- These must not require large sacrifices in the prototype — only clean seams.

---

## 6. Content Model (the pluggable knowledge base)

All domain knowledge lives in a centralized, well-structured `content/` directory,
**decoupled from code**, validated by schemas, and locale-aware. Adding/modifying a
track, question, rule, or document = editing content, not code.

### 6.1 Directory structure
```
content/
  questions/
    questions.json          # question bank + branching conditions
  decision/
    decision-tree.json      # rules mapping answers → candidate tracks
  tracks/
    track-<id>.json         # per-track metadata, pros/cons, required doc ids
  documents/
    <doc-id>/
      meta.json             # agency, category, obtain-method, links
      guidance.en.md        # human guidance (Markdown), per locale
      guidance.ja.md
  locales/
    en.json                 # UI strings
    ja.json
  content.manifest.json     # index/version of all content for the loader
```

### 6.2 Schemas (illustrative shape)

**Question**
```jsonc
{
  "id": "residence_years",
  "type": "number",
  "labelKey": "q.residence_years.label",
  "next": [
    { "if": { "var": "residence_years", "op": ">=", "value": 10 }, "goto": "criminal_record" },
    { "default": true, "goto": "has_hsp_points" }
  ]
}
```

**Decision rule → track candidates**
```jsonc
{
  "rules": [
    {
      "trackId": "hsp_1yr",
      "when": { "all": [
        { "var": "hsp_points", "op": ">=", "value": 80 },
        { "var": "residence_years", "op": ">=", "value": 1 }
      ]},
      "confidence": "high"
    }
  ]
}
```

**Track**
```jsonc
{
  "id": "hsp_1yr",
  "titleKey": "track.hsp_1yr.title",
  "summaryKey": "track.hsp_1yr.summary",
  "pros": ["track.hsp_1yr.pro1"],
  "cons": ["track.hsp_1yr.con1"],
  "difficulty": "medium",
  "estimatedMonths": 4,
  "milestones": [
    { "id": "m_personal", "titleKey": "...", "documents": ["passport", "residence_card"] }
  ]
}
```

**Document meta**
```jsonc
{
  "id": "tax_certificate",
  "category": "tax",
  "agency": "Municipal office (市区町村)",
  "obtainMethod": "in-person | mail | online",
  "links": ["https://..."],
  "guidance": { "en": "guidance.en.md", "ja": "guidance.ja.md" }
}
```

### 6.3 Prototype sample content (must ship)
- ~6–10 sample questions exercising branching and ≥2 question types.
- A sample decision tree returning **multiple candidate tracks** for some profiles.
- 2–3 sample tracks (e.g. a long-residence track, an HSP-points track, a spouse-based track) with pros/cons and milestones.
- ~8–12 sample documents with `meta.json` + English guidance Markdown.
- English locale complete; `ja` stubs to prove i18n wiring.

> Sample content is illustrative scaffolding, **not legally authoritative**. Real rules to be authored later by replacing content only.

---

## 7. State Shape (high level)
```ts
AppState = {
  profile: AnswerProfile;          // answers keyed by question id
  questionnaire: { currentId, visitedPath, complete };
  results: TrackCandidate[];       // last evaluation output
  selectedTrackId: string | null;
  progress: Record<documentId, {
    status: 'not-started'|'in-progress'|'have'|'uploaded'|'done';
    note?: string; updatedAt: string;
  }>;
  // file blobs stored separately in IndexedDB, referenced by documentId
  ui: { locale, theme?, lastRoute };
}
```
Export JSON = serialized `AppState` minus blobs (prototype default).

---

## 8. UX Notes
- **Large-screen-first**: questionnaire centered single-column; quest map as a wide canvas/board; document drawer/panel on the side.
- **Mobile**: stacked, collapsible panels; quest map scrolls vertically.
- **Game feel**: milestone nodes on a path, completion animations, encouraging copy — kept lightweight and non-childish.
- **Friction reduction**: no account, instant start, autosave, resume-on-return, one primary action per screen.
- **Anti-overload**: progressive disclosure — show only the next relevant question/document; details on demand.

---

## 9. Acceptance Criteria (prototype "done")
1. User completes a branching questionnaire whose path changes with answers.
2. Decision engine returns one **or more** tracks with pros/cons and rationale.
3. User confirms a track and lands on a populated quest map.
4. User can mark "I have it" (metadata) **and** optionally upload a file (IndexedDB).
5. Progress + completion % persist across reloads (no login).
6. Export produces a single plain JSON; import restores state.
7. UI strings come through i18n; language switcher present; `en` complete.
8. All domain content lives in `content/` and is swappable without code changes.
9. Builds to static assets and deploys on Cloudflare Pages.
10. No network calls carry user data.

---

## 10. Open Items / Future Extensions (documented, out of prototype scope)
- XP / badges / streaks gamification economy.
- PWA/offline service worker.
- Embedding file blobs in export (base64) and/or encrypted export.
- Login + backend sync (Cloudflare Workers + D1/KV) behind existing persistence interface.
- AI-assisted branching, document help, and translation behind the engine interface.
- React Native / mobile shell reusing `engine/` + `content/`.
- Authoring tooling / CMS for non-developers to edit content.
