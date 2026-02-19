
# Fix Plan: Steps 11-13 Data Flow, Chapter 5 Persistence, Export, Admin Step Control

## Root Causes (Database-Verified)

### Issue 1: Reliability/Regression/Diagnostics not appearing in Step 11 Overview
**Not a bug.** The actual `analysis_blocks` in the database contain ONLY these categories: `descriptive`, `compare-means`, `nonparametric`, `anova-glm`. There are zero `regression`, `reliability`, or `correlation` category blocks. The Spearman test is saved as `nonparametric`, which the current code already handles via `CORRELATION_TEST_TYPES`. The overview cards for Reliability/Regression/Diagnostics are correctly grey because the user never ran those analyses in Steps 9/10. However, we should make this clearer to the user by showing "No analysis run" vs "Data available" labels, and allow clicking the card to navigate to the relevant step.

### Issue 2: Charts/graphics from Steps 4-10 not appearing in Step 11
The `analysis_blocks` table stores `results` as JSONB. Some blocks have `results.tables` (structured tables), some have `results.summary` or `results.statistics`. The current `renderBlockTable` handles all three cases. However, **charts** (`results.charts`) are never rendered in Step 11. The run-analysis function may return chart data (e.g., histograms, box plots) inside `results.charts`, but Step 11 ignores this field entirely.

**Fix:** Add chart rendering in `renderBlockTable` using Recharts (already installed).

### Issue 3: Chapter 5 not appearing in Step 13
**Database evidence:** The `discussion_chapter` table has a record for `analysis_id = f2d089f1...` (Chapter 5 generated on Feb 15), but the user's CURRENT analysis is `analysis_id = 4948d97e...` (most recent). These are DIFFERENT analyses. Chapter 5 was generated for an older analysis, not the current one.

Additionally, `discussion_chapter` has NO `section_mapping` column. Step 12's save code writes `section_mapping: data.sections` which Supabase silently ignores (unknown column). Only `chapter5_text` is actually saved. When Step 12 tries to restore sections from `section_mapping`, it gets `undefined`, so the sections state is empty.

**Fix:** 
1. Add `section_mapping` column to `discussion_chapter` via migration
2. Parse sections from `chapter5_text` as fallback when `section_mapping` is null

### Issue 4: Export .doc not matching Step 11 structure
The `generate-thesis-doc` edge function appends all tables AFTER the chapter text instead of integrating them section by section. The section headings in the chapter text (e.g., `## 4.3 Descriptive Statistics`) should have their matching tables injected right after them.

**Fix:** Parse chapter text line by line, detect section headings, inject matching block tables after each heading using keyword matching.

### Issue 5: Finish and Export / Save-Return not preserving all steps
The `handleFinish` in `NewAnalysis.tsx` saves `currentStep: 13` and navigates to `/dashboard/reports`. But when loading back, `loadAnalysis` restores the `currentStep` from the DB and loads variables/hypotheses. The `completedSteps` Set is NOT persisted — it's local React state that resets on reload. So when returning, no steps show as completed.

**Fix:** Derive `completedSteps` from the loaded `currentStep` value (all steps up to `currentStep` are completed).

### Issue 6: Admin panel step-level control
The current `AnalysisManager` only manages `analysis_tests` (individual statistical tests). The user wants per-step function control: enable/disable, reorder, and link to plan tier for Steps 2-13 features (e.g., AI variable detection in Step 2, regression in Step 9).

**Fix:** Create a new `step_functions` table and a "Step Functions" tab in `AnalysisManager`.

---

## Changes Required

### 1. Database Migration: Add `section_mapping` to `discussion_chapter`

```sql
ALTER TABLE discussion_chapter ADD COLUMN section_mapping jsonb DEFAULT '{}'::jsonb;
```

### 2. Database Migration: Create `step_functions` table for admin control

```sql
CREATE TABLE step_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number integer NOT NULL,
  function_id text NOT NULL,
  function_name text NOT NULL,
  description text,
  is_enabled boolean DEFAULT true,
  is_pro_only boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(step_number, function_id)
);

ALTER TABLE step_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage step functions" ON step_functions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view step functions" ON step_functions FOR SELECT USING (true);

-- Seed initial step functions
INSERT INTO step_functions (step_number, function_id, function_name, description, is_pro_only, display_order) VALUES
(2, 'ai-variable-detection', 'AI Variable Detection', 'Auto-detect variable types and measures', true, 1),
(2, 'manual-variable-config', 'Manual Variable Config', 'Manually set variable types', false, 2),
(3, 'ai-research-suggestions', 'AI Research Suggestions', 'AI-powered hypothesis generation', true, 1),
(3, 'manual-hypothesis', 'Manual Hypothesis Entry', 'Enter hypotheses manually', false, 2),
(4, 'normality-test', 'Normality Testing', 'Shapiro-Wilk / Kolmogorov-Smirnov', false, 1),
(4, 'descriptive-stats', 'Descriptive Statistics', 'Mean, SD, frequencies', false, 2),
(5, 'parametric-tests', 'Parametric Tests', 'T-tests, paired comparisons', false, 1),
(6, 'nonparametric-tests', 'Non-Parametric Tests', 'Mann-Whitney, Wilcoxon, Kruskal-Wallis', false, 2),
(7, 'anova-glm', 'ANOVA / GLM', 'One-way, factorial, MANOVA, repeated measures', false, 1),
(8, 'correlation', 'Correlation Analysis', 'Pearson, Spearman, partial correlations', false, 1),
(9, 'regression', 'Regression Models', 'Linear, logistic regression with diagnostics', true, 1),
(10, 'measurement', 'Measurement Validation', 'Cronbach alpha, EFA, CFA', true, 1),
(11, 'chapter4-generation', 'Chapter 4 AI Generation', 'AI-generated academic results chapter', false, 1),
(12, 'chapter5-generation', 'Chapter 5 AI Generation', 'AI-generated discussion chapter', false, 1),
(12, 'theory-framework', 'Theoretical Framework Input', 'Theory and citation management', true, 2),
(13, 'thesis-export', 'Thesis Export', 'Word/HTML document export', false, 1);
```

### 3. `Step12Theoretical.tsx` — Fix section persistence

**Problem:** Saves `section_mapping` to a column that doesn't exist (fixed by migration above). Also needs fallback parsing from `chapter5_text`.

After the migration, the save code will work. For the restore code, add parsing from `chapter5_text` as fallback:

```typescript
// In fetchSavedData, after getting saved record:
if (saved.section_mapping && Object.keys(saved.section_mapping).length > 0) {
  // Use section_mapping directly
  setSections(saved.section_mapping);
} else if (saved.chapter5_text) {
  // Parse sections from chapter5_text using heading patterns
  const parsed = parseChapter5Sections(saved.chapter5_text);
  setSections(parsed);
}
```

### 4. `Step13ThesisBinder.tsx` — Fix Chapter 5 detection

The `ch5Exists` check requires `ch5Text.trim().length > 50`. This is correct but the real issue is the Chapter 5 simply doesn't exist for the current analysis. The fix is:
- Show the actual `analysis_id` being queried (for debugging)  
- Add a more helpful message when Chapter 5 is missing
- Fix the "Refresh" button to actually re-query

### 5. `NewAnalysis.tsx` — Restore completedSteps on load

```typescript
// After loadAnalysis completes, derive completed steps
useEffect(() => {
  if (state.currentStep > 1) {
    const completed = new Set<number>();
    for (let i = 1; i < state.currentStep; i++) completed.add(i);
    setCompletedSteps(completed);
  }
}, [state.analysisId]); // Only when analysis is loaded
```

### 6. `generate-thesis-doc/index.ts` — Section-integrated tables

Parse chapter 4 text line by line. When encountering a `## heading`, check if it matches a section keyword and inject tables for that section right after the heading. Build a section keyword map:

```text
descriptive/normality/frequencies -> descriptive blocks
correlation/spearman/pearson -> correlation blocks  
regression -> regression blocks
hypothesis/compare/anova/manova -> hypothesis blocks
reliability/cronbach -> reliability blocks
```

After injecting a block's tables under a section heading, mark it as "used" so it's not duplicated at the end.

### 7. `AnalysisManager.tsx` — Add Step Functions tab

Add a second tab "Step Functions" alongside the existing "Tests" tab. The Step Functions tab shows a table grouped by step number with columns: Step, Function, Description, Plan (Free/Pro), Enabled, Order.

### 8. `Step11AcademicResults.tsx` — Add chart rendering + navigation links

In `renderBlockTable`, after rendering tables, also render `results.charts` using Recharts BarChart/LineChart components. Add clickable overview cards that navigate to the relevant step when the section has no data.

---

## Files to Modify

| # | Type | File | Change |
|---|------|------|--------|
| 1 | Migration | DB | Add `section_mapping` column to `discussion_chapter` |
| 2 | Migration | DB | Create `step_functions` table with seed data |
| 3 | Frontend | `Step12Theoretical.tsx` | Fix section restore with `chapter5_text` parsing fallback |
| 4 | Frontend | `Step13ThesisBinder.tsx` | Improve Chapter 5 detection messaging |
| 5 | Frontend | `NewAnalysis.tsx` | Restore `completedSteps` from loaded `currentStep` |
| 6 | Edge Fn | `generate-thesis-doc/index.ts` | Integrate tables section-by-section into chapter text |
| 7 | Frontend | `AnalysisManager.tsx` | Add "Step Functions" admin tab with CRUD |
| 8 | Frontend | `Step11AcademicResults.tsx` | Add chart rendering; navigation links on overview cards |

---

## Technical Notes

- The `discussion_chapter` table currently has NO `section_mapping` column. Every `section_mapping` write from Step 12 has been silently dropped. The migration adds it.
- The DB confirms no `regression` or `reliability` blocks exist. Those overview cards are correctly grey — the user did not run Steps 9/10 for this analysis.
- Chapter 5 exists only for analysis `f2d089f1` (Feb 15) but the current analysis is `4948d97e` (Feb 19). The user needs to generate Chapter 5 again for the current analysis.
- The `completedSteps` Set in `NewAnalysis.tsx` is ephemeral React state. When the user navigates away and back, all steps reset to incomplete. The fix derives completed state from the persisted `currentStep`.
