# ACCEPTANCE.md — SPEC §9 Prototype Acceptance Checklist

All 10 acceptance criteria from SPEC §9, each mapped to passing tests and/or
manual verification steps.

---

## Criteria

### 1. Branching questionnaire whose path changes with answers
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `e2e: questionnaire traversal` | `src/test/e2e.test.ts` | Answers drive different next-question paths |
| `QuestionnaireStore – next (4.2)` | `src/store/store.test.ts` | `next()` advances per profile; branching verified |
| `condition evaluator` | `src/engine/conditions.test.ts` | All operators + nested groups covered |
| `questionnaire traversal` | `src/engine/questionnaire.test.ts` | `nextQuestionId` returns different ids per profile |

---

### 2. Decision engine returns ≥1 tracks with pros/cons and rationale
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `e2e: track evaluation` | `src/test/e2e.test.ts` | ≥2 candidates for qualifying profile; 0 for non-qualifying |
| `ResultsPage – results list (6.1)` | `src/features/decision/results.test.tsx` | Both candidates render with pros/cons |
| `ResultsPage – explainability (6.2)` | `src/features/decision/results.test.tsx` | "Why this track" expands matched conditions |
| `evaluateTracks` | `src/engine/decision.test.ts` | Multi-track output with rationale |

---

### 3. User confirms a track and lands on a populated quest map
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `e2e: confirming a track resolves its document list` | `src/test/e2e.test.ts` | `resolvedDocIds` populated after `confirmTrack()` |
| `ResultsPage – track selection (6.4)` | `src/features/decision/results.test.tsx` | Clicking "Select" sets `selectedTrackId` and navigates |
| `QuestMapPage – layout (7.1)` | `src/features/quest-map/questmap.test.tsx` | Quest map renders all milestones for the selected track |

---

### 4. "I have it" (metadata) AND optional file upload (IndexedDB)
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `e2e: document checklist` | `src/test/e2e.test.ts` | markHave, note, upload, remove — full lifecycle |
| `DocumentPanel – markHave (8.2)` | `src/features/documents/documents.test.tsx` | Status → "have"; no blob stored |
| `DocumentPanel – file upload (8.3)` | `src/features/documents/documents.test.tsx` | Upload sets `uploaded`; blob in BlobRepository |
| `DocumentPanel – download/delete (8.4)` | `src/features/documents/documents.test.tsx` | Delete removes blob and resets status |
| `Privacy: uploading a blob` | `src/test/privacy.test.ts` | Upload uses MemoryBlobRepository — zero network calls |

---

### 5. Progress and completion % persist across reloads
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `e2e: state persistence` | `src/test/e2e.test.ts` | State saved to repo survives reset+reload cycle |
| `IdbStateRepository – round-trip` | `src/persistence/persistence.test.ts` | Save→load returns deep-equal state |
| `IdbBlobRepository – round-trip` | `src/persistence/persistence.test.ts` | Blob stored and retrieved byte-identical |
| `debounced autosave (4.6)` | `src/store/store.test.ts` | Mutations coalesce into ≤1 write |

---

### 6. Export produces plain JSON; import restores state
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `e2e: export → reset → import round-trip` | `src/test/e2e.test.ts` | Complete round-trip restores all state |
| `buildExport (9.1)` | `src/features/export-import/exportImport.test.ts` | Valid schema; excludes blobs |
| `parseImport (9.3)` | `src/features/export-import/exportImport.test.ts` | Validates schema; detects bad/old files |
| `applyImport round-trip (9.3)` | `src/features/export-import/exportImport.test.ts` | State restored after reset |
| `resetAllData (9.4)` | `src/features/export-import/exportImport.test.ts` | All stores cleared; IDB empty |

---

### 7. UI strings via i18n; language switcher present; `en` complete
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `t() — EN catalog (10.1)` | `src/i18n/i18n.test.ts` | All EN namespaces resolve correctly |
| `t() — JA locale (10.3)` | `src/i18n/i18n.test.ts` | JA keys resolve; missing fall back to EN |
| `useT() locale reactivity (10.3)` | `src/i18n/i18n.test.ts` | Switching locale updates all translated strings |
| LocaleSwitcher `aria-pressed` | `src/test/a11y.test.tsx` | EN / 日本語 buttons have correct ARIA state |

---

### 8. All domain content in `content/`; swappable without code changes
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `content loader validates schema` | `src/content/content.test.ts` | Valid fixtures pass; broken fixture fails loudly |
| `content loader validates documents` | `src/content/content.test.ts` | No dangling doc IDs |
| Architecture constraint | `CLAUDE.md` §Architecture | `content/` is the knowledge base; changing rules = edit content only |

---

### 9. Builds to static assets; deploys on Cloudflare Pages
**Status:** ✅ PASS (build) / 🔲 PENDING (live deploy)

| Check | Method |
|---|---|
| `npm run build` produces `dist/` | Run locally: `npm run build` |
| TypeScript strict compile passes | `tsc -b` exit 0 |
| Cloudflare Pages live URL | Manual: push to main → Pages CI → smoke test the live URL |

**Manual deploy step:** Connect repo to Cloudflare Pages with build command `npm run build`
and output directory `dist/`. Verify the happy-path flow works on the live URL.

---

### 10. No network calls carry user data
**Status:** ✅ PASS

| Test | File | Description |
|---|---|---|
| `Privacy audit (11.3)` — 10 tests | `src/test/privacy.test.ts` | `window.fetch` and `XHR.open` spied; zero calls across full flow |
| `full headless flow` privacy test | `src/test/privacy.test.ts` | questionnaire → evaluate → select → mark → export → reset → import, no network |

**Architectural guarantee:** All stores (profile, questionnaire, results, documents, ui) use
IndexedDB via the `idb` library. No store ever calls `fetch()` or `XMLHttpRequest`. The only
`fetch()` calls in the codebase are in `src/content/loader.ts` for loading static
`/content/*.json` and `*.md` files — which are public assets, not user data.

---

## Summary

| # | Criterion | Status |
|---|---|---|
| 1 | Branching questionnaire | ✅ |
| 2 | Multi-track results with rationale | ✅ |
| 3 | Track confirmation → quest map | ✅ |
| 4 | "I have it" + upload | ✅ |
| 5 | Persistence across reloads | ✅ |
| 6 | Export/import JSON | ✅ |
| 7 | i18n + language switcher | ✅ |
| 8 | Content in `content/` | ✅ |
| 9 | Static build + Cloudflare deploy | ✅ build / 🔲 live |
| 10 | No user-data network calls | ✅ |

**9/10 criteria fully verified by automated tests. Criterion 9 (live deploy) requires
a manual Cloudflare Pages smoke test.**
