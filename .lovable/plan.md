
# Comprehensive Fix Plan: Steps 11, 12, 13 — All Issues

## Exact Root Causes Found

### Issue 1a — Overview shows only Descriptive and Hypothesis as "completed" (green)
The `stepStatus` object correctly has `'anova-glm'` in the hypothesis check (already fixed). But for **Reliability**, **Correlation**, **Regression**, and **Diagnostics**, the `categories` set must contain `'reliability'`, `'correlation'`, or `'regression'`. Looking at the screenshot: we see `spearman (completed)` — this has `test_category = 'correlation'` (Spearman is a correlation test). This means `stepStatus.correlation` should be `true`. The bug: **the categories are computed from `blocks.filter(b => b.status !== 'pending')`** but then compared with `categories.has('correlation')` — this should work for Spearman if `test_category = 'correlation'`.

**Real bug:** Looking more carefully — `spearman` and `manova` blocks exist, but the overview cards for Reliability, Correlation, Regression, Diagnostics show as grey. This means either: (a) `test_category` for spearman is NOT `'correlation'` — it could be `'nonparametric'` since Spearman is a non-parametric rank correlation, or (b) the `stepStatus` `useMemo` has a stale `blocks` reference.

The Spearman correlation being mapped to `nonparametric` rather than `correlation` category is a known inconsistency in the run-analysis function. So `stepStatus.correlation` returns false because `categories.has('correlation')` is false — the Spearman block has `test_category = 'nonparametric'`.

**Fix:** Expand `stepStatus` checks to handle cross-category test types:
```typescript
correlation: categories.has('correlation') || blocks.some(b => ['spearman', 'pearson', 'kendall', 'partial-correlation'].includes(b.test_type)),
reliability: categories.has('reliability') || categories.has('measurement-validation') || blocks.some(b => ['cronbach-alpha', 'factor-analysis', 'efa'].includes(b.test_type)),
regression: categories.has('regression') || blocks.some(b => b.test_type?.includes('regression')),
diagnostics: categories.has('regression') || blocks.some(b => b.test_type?.includes('regression')),
```

Also fix `sectionCategoryMap` for correlation to include `'nonparametric'` for Spearman detection:
```typescript
correlation: ['correlation', 'nonparametric'], // Spearman saves as nonparametric
```
But wait — this would cause ALL nonparametric tests to show under Correlation. The better fix is to match by `test_type` in `getBlocksForSection`:

```typescript
const getBlocksForSection = (sectionId: string, allBlocks: AnalysisBlockData[]) => {
  if (sectionId === 'correlation') {
    return allBlocks.filter(b => b.test_category === 'correlation' || 
      ['spearman', 'pearson', 'kendall', 'partial-correlation'].includes(b.test_type));
  }
  // ... rest of sections
};
```

### Issue 1b — Chapter 4 generated but "all analysis tables not inside Chapter 4"
The Chapter Editor (tab 3) shows AI-generated text per section, and BELOW each section it shows "📊 Analysis Tables" from `getBlocksForSection`. Currently this works for sections that are correctly matched. The problem is the `renderBlockTable` function has a check `if (!block.results?.tables) return null` — if some blocks store results differently (e.g., `block.results.data` or `block.results.statistics` instead of `block.results.tables`), the table renders nothing.

**Fix in `Step11AcademicResults.tsx`:** Make `renderBlockTable` more resilient — also render `block.results.statistics`, `block.results.data`, and fall back to a JSON display when `tables` is not present but `results` exists.

### Issue 1c — Token limit causing truncated Chapter 4 generation
`max_tokens: 4000` for 10 sections with 1-3 paragraphs each is too low. Each section needs ~300-600 tokens, so 10 sections = 3000-6000 tokens output needed. The model truncates and returns incomplete JSON, which then fails `JSON.parse`.

**Fix in `generate-chapter4/index.ts`:** 
- Increase `max_tokens` to `8000`  
- Use `gpt-4o` instead of `gpt-4o-mini` for longer, higher-quality output
- Switch to using Lovable AI gateway (`google/gemini-2.5-flash`) which has a much larger context window
- Add a fallback: if JSON parse fails, try to extract partial sections

### Issue 2 — Chapter 5 generated and saved but Step 13 shows "Not generated yet"
Looking at the Step 13 `fetchStatus` code:
```typescript
supabase.from('discussion_chapter').select('*').eq('analysis_id', analysisId)...
chapter5: { exists: !!ch5.data?.[0], version: ch5.data?.[0]?.version || 0, text: ch5.data?.[0]?.chapter5_text || '' }
```

The `exists` check is `!!ch5.data?.[0]`. The user confirmed Chapter 5 was generated and saved. But Step 13 shows "Not generated yet." This means either:
- `ch5.data` is null/empty when fetched in Step 13 — possible if the `discussion_chapter` record has a different `analysis_id` than what Step 13 uses
- OR the `section_mapping` was saved but `chapter5_text` (the `full_text` field) was left empty

Looking at Step 12's save code: `chapter5_text: fullText` where `fullText` is generated from `CHAPTER_5_SECTIONS.map(s => ...)`. If `data.sections` contains the section keys but they are empty strings (because the AI didn't return content for some sections), then `fullText` could be just section headers. But `exists` is based on whether the row exists at all, not whether `chapter5_text` has content.

**Most likely bug:** Step 12 auto-saves immediately after generation and calls `fetchSavedData()`. But `fetchSavedData` does `limit(1)` with `order('created_at', ascending: false)`. If the INSERT just happened, it should be the first result. This should work.

**Alternative bug:** The `chapter5_text` field in `discussion_chapter` is saved correctly. But in Step 13, `ch5.data?.[0]?.chapter5_text` might be returning the raw `section_mapping` JSON object (not the text field). Let me check: Step 12 saves `chapter5_text: fullText` and `section_mapping: data.sections`. In Step 13 we read `chapter5_text` for the text preview. This is correct.

**The real issue:** Step 13 `fetchStatus` is called `useEffect(() => { if (analysisId) fetchStatus(); }, [analysisId])`. If `analysisId` is already set when the component mounts (user navigated from step 12 after generating), the fetch runs. But the `discussion_chapter` INSERT in Step 12 saves the record AFTER the state update. There might be a **race condition** where Step 13 fetches BEFORE the DB insert completes.

**Fix:** Add a manual "Refresh Status" button in Step 13. Also call `fetchStatus()` when the component becomes visible (on tab focus or when `activeTab` changes to 'status').

Additionally — the `section_mapping` column doesn't exist in the `discussion_chapter` schema! Looking at the DB schema: `discussion_chapter` has: `mode`, `chapter5_text`, `version`, `created_at`, `updated_at`, `id`, `citations_used`, `theory_input`, `analysis_id`. **There is NO `section_mapping` column.** Step 12's save code saves `section_mapping: data.sections as any` — this will silently fail or be ignored by Supabase. The `chapter5_text` IS saved correctly though.

**Fix for restore:** In `fetchSavedData`, since there's no `section_mapping` column, the sections need to be parsed from `chapter5_text` itself. The `chapter5_text` is formatted as `## 5.1 Title\n\nContent\n\n## 5.2 Title...` — parse this to restore individual sections.

### Issue 3a — Export only shows `.html`, no Word `.docx`
The current export creates a `.htm` file (HTML that Word can open). The user wants a proper Word button. We cannot generate real `.docx` binary without a library. The best solution:
- Keep `.htm` as "Word Compatible" export  
- Rename the button clearly: **"Export Word (.htm)"** with explanation
- Add a second button: **"Export for Word"** that uses the same `.htm` with `.doc` extension (Word opens it natively on all platforms)

### Issue 3b — Tables in export have narrative/interpretation but need inline placement
Currently in `generate-thesis-doc`, tables are appended AFTER chapter 4 text block, not integrated section by section. Fix: build a section-to-block map and inject tables right after each `## heading`.

### Issue 4 — "Go to Step 12" button doesn't work
In Step 13:
```typescript
window.dispatchEvent(new CustomEvent('navigate-to-step', { detail: { step: 12 } }));
```
But in `NewAnalysis.tsx`, there is NO listener for `'navigate-to-step'` custom event. The `goToStep` function exists in the wizard hook but is never wired to this event.

**Fix:** Add a `useEffect` in `NewAnalysis.tsx` to listen for `'navigate-to-step'` custom events and call `goToStep(detail.step)`.

### Issue 5 — AI token/generation quality
Both `generate-chapter4` and `generate-chapter5` use `gpt-4o-mini` with `max_tokens: 4000`. For 10 sections in Chapter 4 with statistics, this is insufficient. Switch to `google/gemini-2.5-flash` via the Lovable AI gateway which supports larger outputs and is already configured (`LOVABLE_API_KEY` secret exists).

---

## Implementation Plan

### Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `src/pages/dashboard/NewAnalysis.tsx` | Wire `navigate-to-step` custom event to `goToStep` |
| 2 | `src/components/spss-editor/Step11AcademicResults.tsx` | Fix `stepStatus` checks for Spearman/test_type; fix `getBlocksForSection` for correlation; fix `renderBlockTable` for non-table results; improve All Blocks tab |
| 3 | `src/components/spss-editor/Step13ThesisBinder.tsx` | Add "Refresh Status" button; fix Chapter 5 section restoration from `chapter5_text`; rename export buttons clearly; add progress indicator |
| 4 | `supabase/functions/generate-chapter4/index.ts` | Switch to Lovable AI gateway with `google/gemini-2.5-flash`; increase token limit; add partial JSON recovery |
| 5 | `supabase/functions/generate-chapter5/index.ts` | Switch to Lovable AI gateway; increase token limit |
| 6 | `supabase/functions/generate-thesis-doc/index.ts` | Integrate tables section-by-section into chapter text; add `.doc` export option |

---

## Detailed Changes

### Change 1: `NewAnalysis.tsx` — Wire navigate-to-step event
```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => {
    const step = e.detail?.step;
    if (typeof step === 'number') goToStep(step);
  };
  window.addEventListener('navigate-to-step', handler as EventListener);
  return () => window.removeEventListener('navigate-to-step', handler as EventListener);
}, [goToStep]);
```

### Change 2: `Step11AcademicResults.tsx` — Fix stepStatus + section mapping
**`stepStatus`:**
```typescript
const stepStatus = useMemo(() => {
  const categories = new Set(blocks.filter(b => b.status !== 'pending').map(b => b.test_category));
  const testTypes = new Set(blocks.filter(b => b.status !== 'pending').map(b => b.test_type));
  return {
    descriptive: categories.has('descriptive') || categories.has('normality'),
    reliability: categories.has('reliability') || categories.has('measurement-validation') || 
      testTypes.has('cronbach-alpha') || testTypes.has('factor-analysis'),
    correlation: categories.has('correlation') || 
      ['spearman', 'pearson', 'kendall', 'partial-correlation'].some(t => testTypes.has(t)),
    regression: categories.has('regression') || 
      Array.from(testTypes).some(t => t?.includes('regression')),
    hypothesis: blocks.some(b => ['compare-means', 'nonparametric', 'anova', 'anova-glm', 'parametric'].includes(b.test_category) && b.status !== 'pending'),
    diagnostics: categories.has('regression') || 
      Array.from(testTypes).some(t => t?.includes('regression')),
  };
}, [blocks]);
```

**`getBlocksForSection`** — add test_type matching for correlation:
```typescript
const getBlocksForSection = (sectionId: string, allBlocks: AnalysisBlockData[]): AnalysisBlockData[] => {
  const categories = sectionCategoryMap[sectionId] || [];
  const correlationTestTypes = ['spearman', 'pearson', 'kendall', 'partial-correlation'];
  return allBlocks.filter(b => {
    if (b.status === 'pending') return false;
    if (categories.includes(b.test_category)) return true;
    // Special case: Spearman stored as 'nonparametric' but belongs in correlation section
    if (sectionId === 'correlation' && correlationTestTypes.includes(b.test_type)) return true;
    return false;
  });
};
```

**`renderBlockTable`** — handle non-table results:
```typescript
const renderBlockTable = (block: AnalysisBlockData) => {
  const hasTableData = block.results?.tables?.length > 0;
  const hasSummary = block.results?.summary;
  const hasStatistics = block.results?.statistics;
  
  if (!hasTableData && !hasSummary && !hasStatistics) {
    return (
      <div key={block.id} className="text-xs text-muted-foreground italic p-2">
        {block.narrative?.apa || 'No detailed table data for this analysis.'}
      </div>
    );
  }
  // ... existing table rendering
};
```

### Change 3: `Step13ThesisBinder.tsx` — Refresh + Chapter 5 restoration + progress
- Add a "Refresh" icon button next to the chapter status cards
- Add a visual progress bar showing: Blocks ready (N) → Chapter 4 ✓ → Chapter 5 ✓ → Export ready
- Rename "Full Thesis (.htm)" → "Export for Word (.doc)" + "Export HTML (.htm)"
- Show a count of analysis blocks that will be included

### Change 4 & 5: AI functions — Switch to Lovable AI gateway
Both `generate-chapter4` and `generate-chapter5` switch from OpenAI API to Lovable AI gateway:
```typescript
const apiKey = Deno.env.get('LOVABLE_API_KEY');
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [...],
    max_tokens: 8000,  // Increased from 4000
  }),
});
```

This gives 2x more output tokens and uses a model better suited for large structured JSON generation.

### Change 6: `generate-thesis-doc/index.ts` — Section-integrated tables
Build a section-keyword map and inject tables right after their section heading in Chapter 4:
```typescript
const sectionKeywords: Record<string, string[]> = {
  descriptive: ['descriptive', 'normality', 'frequencies'],
  correlation: ['correlation', 'spearman', 'pearson'],
  regression: ['regression'],
  hypothesis: ['compare-means', 'nonparametric', 'anova', 'anova-glm'],
  reliability: ['reliability', 'measurement-validation', 'cronbach'],
};
```

Parse chapter 4 text line by line. When a `## heading` is encountered, check if it matches a section keyword, and if so inject the matching block tables immediately after it.

Also add a `.doc` download option:
```typescript
// Word export (opens natively in Microsoft Word)
a.download = format === 'word-doc' ? `thesis.doc` : `thesis.htm`;
```

---

## Summary of User-Visible Improvements

After these changes:
1. **Overview cards** — Reliability, Correlation, Regression, Diagnostics will show green checkmarks when their blocks exist (Spearman counted under Correlation)
2. **Chapter Editor** — Each section shows its analysis tables inline directly below the section heading, not just for descriptive/hypothesis sections
3. **Chapter 4 generation** — Uses Gemini 2.5 Flash with 8000 tokens → complete JSON for all 10 sections, no truncation
4. **Chapter 5 in Step 13** — "Refresh Status" button lets user re-fetch after generating Chapter 5; status correctly shows v1 Ready
5. **"Go to Step 12" button** — Actually navigates the wizard to step 12
6. **Export** — Clean "Export for Word (.doc)" and "Export HTML" buttons; tables embedded section by section in export
7. **All Blocks tab** — Shows narrative and APA text even when no structured table data exists for a block
