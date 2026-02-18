
# Root Causes Identified (Precise)

## Issue 1: Step 11 — Analysis Blocks Not Showing in Chapter 4

**Primary bug: `test_category` mismatch in `sectionCategoryMap`**

From the network request data, the actual `test_category` values stored in the database are:
- `"compare-means"` — for one-sample-t-test ✓ (mapped correctly to `hypothesis`)
- `"descriptive"` — for descriptives and frequencies ✓ (mapped correctly)
- `"anova-glm"` — for MANOVA ✗ (NOT in the map! The map has `'anova'` but the actual value is `'anova-glm'`)

The `hypothesis` section map is: `['compare-means', 'nonparametric', 'anova', 'parametric']` — missing `'anova-glm'`.

**Secondary issue: `getBlocksForSection` filters `b.status !== 'pending'`** — blocks with `status = 'completed'` do pass through, so this is fine. But it also explains why MANOVA doesn't appear in the Hypothesis Testing card in the overview (the `stepStatus.hypothesis` check also misses `'anova-glm'`).

**Third issue: Chapter Editor shows empty AI text for most sections** — when Chapter 4 is generated, the AI prompt receives `resultsDetail` which works, but the AI model (`gpt-4o-mini`) with `max_tokens: 4000` may truncate the response. The `sectionId` filter for single regeneration is also not used by the function (the function ignores `sectionId` and always returns all sections).

## Issue 2: Step 13 — Chapter 5 Not Showing

The user image shows Chapter 5: "Not generated yet. Complete Step 12." This means the user has NOT successfully run Step 12 yet, OR the generation succeeded but the `discussion_chapter` record was not saved. The `generate-chapter5` edge function now uses `.limit(1)` (fixed). The remaining risk: if `data?.sections` is an object with keys like `findings`, `theoretical`, etc., but the `setSections(data.sections)` call works — HOWEVER the `CHAPTER_5_SECTIONS` array has ids: `findings, theoretical, practical, unexpected, limitations, future, conclusion`. The AI is instructed to return those exact keys. This should work. The user simply needs to go to Step 12 and click Generate.

**The real problem for Step 13 Chapter 5:** The user hasn't generated Chapter 5 yet. After fixing Step 12's generation (ensuring it actually works), Chapter 5 will appear in Step 13.

## Issue 3: Step 13 — Download Produces Empty Tables

Looking at the network response body from the context, the download IS working (the file is created and contains HTML). However the tables are rendered with empty cells because of a data mapping issue in `generate-thesis-doc`:

```typescript
const vals = table.headers ? table.headers.map((h: string) => row[h] ?? '') : Object.values(row);
```

For the descriptives table, headers are `["Variable", "N", "Mean", "SD", ...]` but the row object keys are `{variable, n, mean, sd, ...}` — **lowercase keys vs. Title Case headers**. The lookup `row["Variable"]` returns `undefined` because the key is `"variable"` (lowercase). This is why all the table cells in the downloaded .htm file are empty.

Additionally, the analysis block tables are inserted **after** the chapter text body, not integrated section by section.

---

# Fix Plan

## Fix 1: `Step11AcademicResults.tsx` — sectionCategoryMap + stepStatus

**Change 1:** Add `'anova-glm'` to the `hypothesis` category in `sectionCategoryMap`:
```typescript
hypothesis: ['compare-means', 'nonparametric', 'anova', 'anova-glm', 'parametric'],
```

**Change 2:** Add `'anova-glm'` to the `stepStatus.hypothesis` check:
```typescript
hypothesis: blocks.some(b => ['compare-means', 'nonparametric', 'anova', 'anova-glm', 'parametric'].includes(b.test_category) && b.status !== 'pending'),
```

**Change 3:** Add a new "All Blocks" tab in the Chapter Editor that shows ALL analysis blocks regardless of section mapping, each with their full tables, charts, and narrative. This ensures the user can see everything even if the mapping is wrong.

**Change 4:** In the Chapter Editor overview section, make every section card clickable — clicking it scrolls to that section in the editor and shows its associated analysis blocks inline.

## Fix 2: `generate-thesis-doc/index.ts` — Fix Empty Table Cells

The row key lookup needs to be case-insensitive. Fix the table rendering:
```typescript
// Create a case-insensitive lookup for row keys
const rowKeys = Object.keys(row);
const vals = table.headers.map((h: string) => {
  // Try exact match first, then lowercase match
  if (row[h] !== undefined) return row[h];
  const lowerKey = rowKeys.find(k => k.toLowerCase() === h.toLowerCase());
  return lowerKey ? row[lowerKey] : '';
});
```

Also reorganize the structure: instead of dumping all tables AFTER the chapter text, **integrate the tables section by section**. The chapter text has section headings like `## 4.3 Descriptive Statistics` — after each such heading, insert the corresponding analysis block tables before the next section.

**New approach:** Build a map of `sectionHeading → blocks[]` using the same `sectionCategoryMap` logic, then as we process each `## heading` in the chapter text, inject the matching tables right after that heading.

## Fix 3: `generate-chapter5/index.ts` — Verify Section Key Structure

The function returns `{ sections: result.sections || result }`. If the AI returns:
```json
{ "findings": "...", "theoretical": "...", ... }
```
Then `result.sections` is undefined, so `result` is returned as sections — CORRECT.

But if the AI returns:
```json
{ "sections": { "findings": "...", ... }, "advisory": [...] }
```
Then `result.sections` IS the sections object — also CORRECT.

The issue: when the AI includes the `"advisory"` key in its JSON, the regex `/\{[\s\S]*\}/` captures everything including advisory. The advisory is then at `result.advisory`. But when we do `{ sections: result.sections || result }`, if `result.sections` is undefined, we return the ENTIRE result object including `advisory` as the sections. This means `data.sections.advisory` would be an array, not a string. The frontend then calls `setSections(data.sections)` — and `sections.advisory` gets stored as the advisory array.

**Fix:** Make the parsing more robust — strip the `advisory` key before using as sections:
```typescript
const { advisory, sections: nestedSections, ...flatSections } = result;
const finalSections = nestedSections || flatSections;
return new Response(JSON.stringify({ sections: finalSections, advisory: advisory || [] }), ...);
```

## Fix 4: Step 13 — Show All Analysis Block Tables in Chapter 4 Download

The current `generate-thesis-doc` places all tables after the narrative. Fix: parse the chapter 4 text line by line, detect section headings (e.g., `## 4.3 Descriptive Statistics`), and after each heading, inject the relevant tables for that section using the same category-to-section mapping logic.

The section detection can use keywords:
- `4.3` or `Descriptive` → inject `descriptive` category blocks
- `4.7` or `Hypothesis` → inject `compare-means`, `anova-glm` blocks
- etc.

---

# Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/spss-editor/Step11AcademicResults.tsx` | Add `'anova-glm'` to sectionCategoryMap and stepStatus; add "All Blocks" view; improve section display |
| 2 | `supabase/functions/generate-thesis-doc/index.ts` | Fix case-insensitive row key lookup; integrate tables section by section |
| 3 | `supabase/functions/generate-chapter5/index.ts` | Fix advisory/sections parsing to avoid polluting sections with advisory array |
| 4 | `src/components/spss-editor/Step13ThesisBinder.tsx` | Add clear indicator for Chapter 5 missing with a direct link/button to go to Step 12 |

---

# Technical Details

**Why `anova-glm` not `anova`:** The `run-analysis` edge function assigns `test_category: 'anova-glm'` to ANOVA/MANOVA tests. The frontend map was written with `'anova'` as the expected value but the actual value coming from the DB is `'anova-glm'`. This one character mismatch causes MANOVA results to not appear in any section.

**Why tables are empty in downloads:** Row objects use camelCase or lowercase property names that don't match Title Case column headers. The fix must normalize key comparison.

**Why Chapter 5 shows "not generated":** The user has not yet successfully generated Chapter 5 in Step 12. After fixing the `generate-chapter5` advisory parsing bug, generating Chapter 5 in Step 12 will cause it to appear in Step 13.
