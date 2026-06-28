# TASKS.md — Japan PR Navigator: Execution Plan

> Companion to `SPEC.md` and `DESIGN.md`. Breaks the build into sequential
> **phases** (each a shippable functional milestone) and small **tasks** (each
> independently testable). Section references point back to SPEC/DESIGN.
>
> **Conventions**
> - `[ ]` = todo · `[~]` = in progress · `[x]` = done
> - Each task has an explicit **Test** (the bar for "done").
> - Tasks within a phase are roughly ordered; cross-phase order is strict.
> - "Test" means: a unit/component/e2e test OR a concrete, repeatable manual check.

---

## Phase 0 — Project Foundation
**Milestone:** A blank app builds, lints, tests, and deploys to Cloudflare Pages.

- [x] **0.1 Scaffold Vite + React + TS (strict)**
  Init project; enable `strict` in `tsconfig`.
  **Test:** `npm run build` produces `dist/`; dev server renders a placeholder page.
- [x] **0.2 Tailwind setup**
  Install + configure Tailwind; base layout shell.
  **Test:** a component using Tailwind utility classes renders with expected styling.
- [x] **0.3 Tooling: ESLint + Prettier + test runner (Vitest)**
  Configure lint, format, and `vitest`.
  **Test:** `npm run lint` passes on clean tree; a trivial `expect(true)` test runs green.
- [x] **0.4 Directory skeleton (DESIGN §12)**
  Create empty `src/{app,engine,content,persistence,store,features,i18n,ui,types}` and `content/` tree.
  **Test:** project compiles with placeholder index files; import paths resolve.
- [ ] **0.5 Cloudflare Pages deploy**
  Connect repo / configure build (`dist/`).
  **Test:** pushing to main yields a live URL serving the placeholder page.

---

## Phase 1 — Domain Engine (pure, no UI)
**Milestone:** Branching + decision logic fully working and unit-tested, headless.
*(DESIGN §2.1, §4 — the highest-value, easiest-to-test core.)*

- [ ] **1.1 Shared types & schemas (`types/`)**
  Define `AnswerProfile`, `Question`, `Condition`/`ConditionGroup`, `DecisionRuleset`, `Track`, `TrackCandidate`, `DocumentMeta`.
  **Test:** types compile; schema objects (zod) instantiate for sample fixtures.
- [ ] **1.2 Condition evaluator (`engine/conditions.ts`)**
  Implement `evaluate(node, profile)` for all ops + `all/any/not`; no `eval`.
  **Test:** table-driven unit tests covering every op, nested groups, and undefined vars (must not throw).
- [ ] **1.3 Questionnaire traversal (`engine/questionnaire.ts`)**
  Implement `nextQuestionId(current, profile)` with `if/default/goto`.
  **Test:** unit tests assert different profiles yield different next-ids; terminal returns `null`.
- [ ] **1.4 Decision evaluator (`engine/decision.ts`)**
  Implement `evaluateTracks(ruleset, profile, tracks)` returning 0..n candidates ordered by confidence, each with `matchedConditions`.
  **Test:** unit tests prove multi-track output for a qualifying profile and empty output for a non-matching one; rationale present.
- [ ] **1.5 Milestone/document resolution**
  Expand a selected track's milestones → concrete document id checklist.
  **Test:** unit test: given a track, returns the exact ordered document id set.

**Exit criteria:** `engine/` has >90% test coverage and zero React/I/O imports.

---

## Phase 2 — Content Layer & Sample Knowledge Base
**Milestone:** Real sample content loads, validates, and drives the engine.
*(SPEC §6, DESIGN §2.2 — content/code separation proven.)*

- [ ] **2.1 Content schemas + validator (`content/loader.ts`)**
  Validate questions/decision/tracks/documents/manifest against schemas.
  **Test:** valid fixtures pass; a deliberately broken fixture fails with a clear error.
- [ ] **2.2 Sample questions (6–10, branching, ≥2 types)**
  Author `content/questions/questions.json` (SPEC §6.3).
  **Test:** loader validates them; engine produces a complete branching path.
- [ ] **2.3 Sample decision tree (multi-result)**
  Author `decision-tree.json` that yields multiple tracks for some profiles.
  **Test:** feed a crafted profile → engine returns ≥2 candidates.
- [ ] **2.4 Sample tracks (2–3 w/ pros/cons, milestones)**
  Author `tracks/track-*.json`.
  **Test:** loader validates; resolution returns each track's document set.
- [ ] **2.5 Sample documents (8–12 meta + EN guidance.md)**
  Author `documents/<id>/{meta.json, guidance.en.md}` + `ja` stubs.
  **Test:** loader resolves every doc id referenced by tracks (no dangling ids).
- [ ] **2.6 Content manifest + lazy guidance loader**
  `content.manifest.json`; `loadGuidanceMarkdown(docId, locale)` lazy-loads MD.
  **Test:** guidance fetch returns correct MD per id/locale; missing locale falls back gracefully.

**Exit criteria:** A scripted run (no UI) loads content → answers profile → gets tracks → resolves documents.

---

## Phase 3 — Persistence Layer
**Milestone:** State and file blobs persist on-device and survive reload.
*(SPEC §3.5/§3.6, DESIGN §2.3, §5.)*

- [ ] **3.1 Repository interfaces (`persistence/types.ts`)**
  Define `StateRepository` + `BlobRepository`.
  **Test:** interfaces compile; a fake in-memory impl satisfies them.
- [ ] **3.2 IndexedDB state repository**
  Implement `loadState/saveState/clear` (store `app`).
  **Test:** round-trip save→load returns deep-equal state (fake-indexeddb).
- [ ] **3.3 IndexedDB blob repository**
  Implement `put/get/delete/list` (stores `documents` + `blobs`).
  **Test:** store a Blob, read it back byte-identical; delete removes it.
- [ ] **3.4 localStorage fast-path**
  Persist `locale/theme/lastRoute`.
  **Test:** values survive reload and are readable synchronously at boot.
- [ ] **3.5 DB versioning / `onupgradeneeded`**
  Centralize schema migration hook.
  **Test:** simulated version bump runs migration without data loss.

**Exit criteria:** A headless test writes state+blob, "reloads" (new DB connection), and reads everything back.

---

## Phase 4 — State Stores (orchestration)
**Milestone:** Zustand stores wire engine + content + persistence; testable headless.
*(DESIGN §2.4, §3.)*

- [ ] **4.1 `useProfileStore`** — answers + `setAnswer/reset`.
  **Test:** action updates state; reset clears it.
- [ ] **4.2 `useQuestionnaireStore`** — `currentId/path/next/back/complete` via engine.
  **Test:** `next()` advances per profile; `back()` restores exact prior question/answers.
- [ ] **4.3 `useResultsStore`** — `evaluate/selectTrack`, candidates, selectedTrackId.
  **Test:** evaluate populates candidates; selectTrack resolves documents.
- [ ] **4.4 `useDocumentsStore`** — `markHave/upload/remove/setNote` + statuses.
  **Test:** markHave sets metadata-only; upload calls BlobRepository and sets `uploaded`.
- [ ] **4.5 `useUiStore`** — locale/theme/lastRoute.
  **Test:** locale change updates state and triggers persistence.
- [ ] **4.6 Debounced autosave + boot hydration**
  Mutations → debounced `saveState`; boot → hydrate stores.
  **Test:** rapid mutations coalesce into ≤1 write within window; hydration restores prior session.

**Exit criteria:** Full flow (answer → evaluate → select → mark/upload) works in headless store tests with no UI.

---

## Phase 5 — Questionnaire UI
**Milestone:** A user can complete the branching questionnaire in the browser.
*(SPEC §3.1, §8.)*

- [ ] **5.1 App shell + routing + hydration gate (`app/`)**
  Router with lazy routes; resume logic (lastRoute + selectedTrackId).
  **Test:** with saved state, app resumes at correct route; fresh start lands on landing.
- [ ] **5.2 Question renderer (all 5 input types)**
  Render `single/multi/boolean/number/date` from content.
  **Test:** component test per type captures input into the profile store.
- [ ] **5.3 Branching navigation + progress indicator**
  Next/Back wired to questionnaire store; show progress.
  **Test:** e2e: answering a branch-triggering question changes the following question.
- [ ] **5.4 Landing page + start/resume**
  Entry screen, instant start, resume affordance.
  **Test:** manual + component: start routes to first question; resume to saved point.

**Exit criteria:** End-to-end in browser: land → answer branching questionnaire → reach completion state.

---

## Phase 6 — Results & Track Selection UI
**Milestone:** User sees matched tracks and confirms one.
*(SPEC §3.2, §3.8.)*

- [ ] **6.1 Results list (side-by-side, pros/cons, difficulty, confidence)**
  Render candidates from results store.
  **Test:** component test: given ≥2 candidates, both render with pros/cons.
- [ ] **6.2 "Why this track" explainability**
  Show `matchedConditions` per candidate.
  **Test:** rationale text reflects the actual matched answers.
- [ ] **6.3 Guardrail / disclaimer surfacing**
  Persistent disclaimer + low-confidence "consult a professional" note.
  **Test:** a low-confidence candidate renders the guardrail; banner always present.
- [ ] **6.4 Confirm/select track → route to map**
  selectTrack persists and routes.
  **Test:** e2e: selecting a track lands on a populated quest map; reload resumes there.

**Exit criteria:** e2e from questionnaire completion → results → confirmed track persisted.

---

## Phase 7 — Quest Map & Progress UI
**Milestone:** Game-like progress tracker with milestones and completion %.
*(SPEC §3.3, §8; DESIGN §8.)*

- [ ] **7.1 Quest map layout (wide canvas / mobile stacked)**
  Milestones as nodes on a path; responsive.
  **Test:** renders all milestones for the selected track; mobile layout stacks.
- [ ] **7.2 Milestone + quest nodes with status states**
  5 statuses (`not-started…done`) visualized.
  **Test:** status change in store updates node appearance.
- [ ] **7.3 Completion % (overall + per-milestone)**
  Derived from document statuses.
  **Test:** unit: % calculation correct for mixed statuses; UI reflects it.
- [ ] **7.4 Completion juice (confetti/animation, lightweight)**
  Fire on milestone completion only.
  **Test:** manual: completing a milestone triggers animation once.
- [ ] **7.5 Selective subscriptions / render perf**
  Zustand selectors to avoid full-map re-renders.
  **Test:** changing one node does not re-render unrelated nodes (render-count assertion).

**Exit criteria:** Selecting documents updates the map and completion % live and persistently.

---

## Phase 8 — Document Handling UI
**Milestone:** Per-document guidance, "I have it", optional upload/preview/download.
*(SPEC §3.4; DESIGN §2.3, §3.3.)*

- [ ] **8.1 Document detail panel/overlay (guidance MD render, sanitized)**
  Lazy-load `guidance.<locale>.md`; render sanitized.
  **Test:** opening a doc shows its guidance; injected HTML is stripped.
- [ ] **8.2 "I have it" (metadata-only)**
  markHave updates status/notes.
  **Test:** status persists across reload; no blob stored.
- [ ] **8.3 Optional file upload (IndexedDB) + on-device affordance**
  Dropzone → BlobRepository.put; visible "stays on device" message.
  **Test:** upload sets `uploaded`; blob present in IndexedDB; no network request (verify in devtools/e2e).
- [ ] **8.4 Preview / download / delete**
  Read back blob; download; delete resets status.
  **Test:** download yields byte-identical file; delete removes blob + status.
- [ ] **8.5 Per-document notes**
  setNote stored locally.
  **Test:** note persists across reload.

**Exit criteria:** Full document lifecycle works and persists; zero user-data network calls confirmed.

---

## Phase 9 — Export / Import / Reset
**Milestone:** Portable state via plain JSON; safe restore and reset.
*(SPEC §3.6; DESIGN §5.3, §5.4.)*

- [ ] **9.1 Export serializer (versioned, blobs omitted)**
  Emit `{app, schemaVersion, contentVersion, exportedAt, state}`.
  **Test:** exported JSON validates against export schema; excludes blobs.
- [ ] **9.2 Download export file**
  Trigger `.json` download.
  **Test:** manual/e2e: file downloads and parses.
- [ ] **9.3 Import (validate + version-check + confirm overwrite)**
  Parse, validate, migrate if needed, replace state with confirmation.
  **Test:** importing a prior export restores identical state; bad/old file shows guided error.
- [ ] **9.4 Reset (clear state + blobs, confirmed)**
  persistence.clear() everything.
  **Test:** after reset, app returns to fresh start; IndexedDB empty.

**Exit criteria:** Export → wipe → import round-trip reproduces the session exactly (minus blobs by design).

---

## Phase 10 — i18n
**Milestone:** All UI + content strings localized; language switcher works.
*(SPEC §3.7; DESIGN §6.)*

- [ ] **10.1 i18n config + EN catalog (complete)**
  Wire i18next; externalize all UI strings.
  **Test:** no hardcoded user-facing strings in components (lint/grep check); EN renders fully.
- [ ] **10.2 Content key resolution**
  Questions/tracks resolve `labelKey/titleKey` via catalog.
  **Test:** content renders via keys; missing key surfaces a visible fallback, not a crash.
- [ ] **10.3 Language switcher + JA stubs + guidance fallback**
  Switch locale; JA stub catalog + guidance fallback to EN.
  **Test:** switching to `ja` updates chrome; missing JA guidance falls back to EN.

**Exit criteria:** Adding a locale requires no code change (proven by JA stub path).

---

## Phase 11 — Hardening & Prototype Acceptance
**Milestone:** Meets all SPEC §9 acceptance criteria; ready to demo/deploy.

- [ ] **11.1 Accessibility pass** (keyboard, semantics, contrast, labels — SPEC §4).
  **Test:** axe checks pass on key screens; full keyboard traversal of core flow.
- [ ] **11.2 Responsive pass** (large-screen-first + mobile — SPEC §8).
  **Test:** core flow usable at desktop and mobile breakpoints.
- [ ] **11.3 Privacy audit** (no user-data network calls — SPEC §4, DESIGN §9).
  **Test:** e2e network log shows no outbound user data across full flow.
- [ ] **11.4 Happy-path e2e** (land → questionnaire → track → checklist → upload → export/import).
  **Test:** single automated e2e passes end-to-end.
- [ ] **11.5 SPEC §9 acceptance checklist sign-off**
  Verify all 10 criteria.
  **Test:** each criterion mapped to a passing test/check; checklist fully ticked.
- [ ] **11.6 Production deploy verification**
  Deploy to Cloudflare Pages; smoke test live URL.
  **Test:** live site completes the happy-path e2e.

**Exit criteria:** All SPEC §9 acceptance criteria green on the deployed build.

---

## Dependency Map (phase order)
```
P0 ─▶ P1 ─▶ P2 ─▶ P3 ─▶ P4 ─┬▶ P5 ─▶ P6 ─▶ P7 ─▶ P8 ─▶ P9 ─▶ P11
                            └▶ P10 (can run alongside P5–P9)
```
- P1–P4 are headless and testable before any UI exists (de-risks the core).
- P10 (i18n) is woven in but isolated; it can proceed in parallel once stores exist.
- P11 gates the release against SPEC §9.

## Out of scope for this plan (SPEC §10 future work)
XP/badges economy · PWA/service worker · blob-embedded/encrypted export ·
login + backend sync · AI-assisted decisions · React Native shell · content CMS.
Each maps to a documented seam in DESIGN §11 and is intentionally deferred.
