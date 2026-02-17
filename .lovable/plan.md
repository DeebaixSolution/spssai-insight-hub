
# Fix Plan: Step 11 (Chapter 4 Tables), Step 12 (Chapter 5 Save), Step 13 (Download) + Auto-Save

## Root Cause Analysis

### Issue 1 — Step 11: Only descriptive analysis shows; other tables/graphs/interpretations missing
**Root cause:** `Step11AcademicResults.tsx` calls `generate-chapter4` passing only block metadata. The `generate-chapter4` edge function uses this to write narrative text, but the frontend only shows inline tables for "completed" blocks. The problem is that **blocks run in Steps 5–10 (correlations, regression, measurement) are saved to `analysis_blocks` with `status = 'completed'`** BUT the `sectionCategoryMap` only maps these sections correctly IF the `test_category` field exactly matches the map keys. The blocks from Steps 8/9 use `test_category = 'correlation'` and `'regression'` which ARE in the map, but the `status === 'completed'` filter is the key issue — the auto-pilot blocks or manually run blocks may not have `status = 'completed'` set on the DB record. Additionally, the `generate-chapter4` edge function needs to embed the actual table data into the AI prompt so the narrative text references real numbers.

### Issue 2 — Step 12: Chapter 5 not saved / generation errors
**Root cause:** The `generate-chapter5` edge function uses `.single()` on a query that may return zero rows (no Chapter 4 saved yet), causing a PostgREST error that breaks the whole function. Also, when generation succeeds, `data.sections` is returned as a flat object but the frontend checks `data.sections` — if the AI returns nested keys, sections are missing.

### Issue 3 — Step 13: No file downloaded
**Root cause:** `generate-thesis-doc` returns `{ content: html, format: 'html' }` correctly. The `Step13ThesisBinder.tsx` calls it with `chapter4Text: String(status.chapter4.text || '')`. The problem: `status.chapter4.text` comes from `chapter_results.full_text` which is a long string. BUT `status.chapter5.text` comes from `discussion_chapter.chapter5_text`. The `readyToExport` guard is `status.chapter4.exists || status.chapter5.exists`. If the user hasn't generated either chapter first, the button is disabled. However, even if the user has generated chapters, the edge function may return an empty or very short HTML string if `chapter4Text` is empty — but the Blob is still created and download triggered. The real issue is that the **download IS triggered but the file opens blank in Word** because `application/msword` MIME type with HTML content requires the HTML to be properly structured. The current HTML is missing the `<meta charset="utf-8">` in a way Word recognizes AND the Blob content-type should be `application/vnd.ms-word` or the file extension should be `.html` so the browser can open it. Also, analysis block tables are sent in `analysisBlocks` but the edge function only inserts them AFTER the chapter text, not integrated section by section.

### Issue 4 — Auto-save: "no need to save progress in each step"
**Current state:** Auto-save on step transitions is already implemented in `NewAnalysis.tsx`. However, there is NO manual "Save Progress" button between steps that should be removed. The `handleProceed` function does auto-save. This is working but the user sees save buttons in Steps 11 and 12 that they need to click manually — these should auto-save on navigation.

---

## Changes Required

### Fix 1: Step 11 — Show ALL tables/graphs from all steps in Chapter 4

**File: `src/components/spss-editor/Step11AcademicResults.tsx`**

Problem: The `sectionCategoryMap` uses `test_category` to match blocks. The categories from the run-analysis function are: `descriptive`, `normality`, `compare-means`, `nonparametric`, `anova`, `correlation`, `regression`, `measurement-validation`. The current map is missing `normality` and `anova`.

Fix the section-to-category mapping:
```
sample: ['descriptive', 'normality']
measurement: ['measurement-validation', 'factor-analysis']  
descriptive: ['descriptive']
reliability: ['reliability', 'measurement-validation']
correlation: ['correlation']
regression: ['regression']
hypothesis: ['compare-means', 'nonparametric', 'anova', 'parametric']
diagnostics: ['regression']
```

Also remove the `b.status === 'completed'` filter — replace with `b.status !== 'pending'` or remove entirely, since blocks saved by the analysis engine may have status `'running'` or `'completed'` depending on how they were persisted.

Add a "Show all blocks" section at the top of the editor tab that renders ALL analysis blocks with their full tables and interpretations, not just section-filtered ones. This ensures nothing is missed.

**File: `supabase/functions/generate-chapter4/index.ts`**

Currently the prompt only receives a text summary. Enhance it to include the actual table data from each block's `results.tables` array so the AI can write sentences like "Table 4.1 shows a mean of 3.45 (SD = 0.82)".

### Fix 2: Step 12 — Fix Chapter 5 generation error

**File: `supabase/functions/generate-chapter5/index.ts`**

The critical bug: `.single()` throws when no rows exist. Fix:
```typescript
// BEFORE (crashes if no chapter 4 exists):
const { data: chapter4 } = await supabase.from('chapter_results')...single();

// AFTER (safe):
const { data: chapter4Data } = await supabase.from('chapter_results')...limit(1);
const chapter4 = chapter4Data?.[0] || null;
```

Also the returned JSON from OpenAI may wrap sections under a `sections` key. The frontend does `data.sections` but the edge function returns `{ sections: result.sections || result, advisory: ... }`. If the AI returns `{ "sections": { "findings": "..." } }` then `result.sections` is the object. If the AI returns `{ "findings": "..." }` directly then `result` is used. This is correct. The issue is only the `.single()` crash.

Add `sectionId` handling for single-section regeneration (the function doesn't currently use the `sectionId` parameter sent from the frontend).

### Fix 3: Step 13 — Make download actually work

**Root cause confirmed:** The HTML content is built correctly in the edge function, but:
1. The MIME type `application/msword` causes Word to try to interpret the file as binary .doc, not HTML. Word cannot open it.
2. The file extension is `.doc` but the content is HTML.

**Fix: Change to `.html` extension with proper HTML MIME type** OR use `.doc` with `application/vnd.ms-word` and ensure the HTML has the full Word XML namespace. The current code already has the correct Word XML namespaces in the HTML tag, so the MIME type just needs to match.

**File: `src/components/spss-editor/Step13ThesisBinder.tsx`**

Change the Blob creation:
```typescript
// BEFORE:
const blob = new Blob([data.content], { type: 'application/msword' });
a.download = `thesis-chapters-4-5.doc`;

// AFTER: save as .htm which Word opens natively AND browsers can open to verify
const blob = new Blob([data.content], { type: 'text/html;charset=utf-8' });
a.download = `thesis-chapters-4-5.htm`;
```

This `.htm` file will:
- Open in any browser to verify content
- Open in Word when double-clicked (Word recognizes HTML files)
- Preserve all table formatting and APA styles

Also add a **"Download Chapter 4 Only"** button and a **"Download Chapter 5 Only"** button that use simpler targeted payloads, so users don't have to generate both chapters to get a download.

**File: `supabase/functions/generate-thesis-doc/index.ts`**

Add `chapterFilter` parameter: `'both' | 'chapter4' | 'chapter5'`. If `chapterFilter = 'chapter4'`, skip chapter 5 section entirely.

Ensure all analysis block tables are embedded **section by section** within the chapter text, not appended at the end. Reorganize so tables appear right after their section heading.

### Fix 4: Auto-save — Remove manual save buttons from Steps 11/12

**File: `src/components/spss-editor/Step11AcademicResults.tsx`**
- Remove the "Save Draft" button from the editor tab. Instead, auto-save the chapter after generation completes (call `handleSave()` at the end of `handleGenerate()`).
- Keep the manual save available only as a small "Saved" badge that updates.

**File: `src/components/spss-editor/Step12Theoretical.tsx`**
- Same: auto-save after generation in `handleGenerate()`.
- Remove the prominent "Save Draft" button.

---

## Implementation Order

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-chapter5/index.ts` | Fix `.single()` crash; add `sectionId` filter; remove `.single()` |
| 2 | `supabase/functions/generate-chapter4/index.ts` | Include actual table data from blocks in AI prompt |
| 3 | `supabase/functions/generate-thesis-doc/index.ts` | Add `chapterFilter` param; integrate tables by section |
| 4 | `src/components/spss-editor/Step11AcademicResults.tsx` | Fix `sectionCategoryMap`; remove status filter; auto-save after generation; show all blocks |
| 5 | `src/components/spss-editor/Step12Theoretical.tsx` | Auto-save after generation |
| 6 | `src/components/spss-editor/Step13ThesisBinder.tsx` | Fix MIME type to `text/html`; change extension to `.htm`; add Chapter 4/5 individual download buttons |

---

## Technical Notes

- The `.htm` format is the correct approach for Word-compatible HTML exports without a backend OOXML library. Word has natively opened HTML files since Word 2000.
- The `generate-chapter5` `.single()` bug will throw a `PGRST116` error ("JSON object requested, multiple (or no) rows returned") which propagates as a 500 error with a non-descriptive message. This is the root cause of "Chapter 5 generation error."
- No database migrations needed — all fixes are application-layer only.
- The auto-save on step transition in `NewAnalysis.tsx` is already correct; we only need to add auto-save triggers inside the chapter generation functions themselves.
