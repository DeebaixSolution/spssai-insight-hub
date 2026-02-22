
# Comprehensive Fix Plan: Charts in Export, Unified Export, Admin Granular Control, Reports Page, and Master Writing Engine

## Issue Summary

1. **Charts not in export** -- The `generate-thesis-doc` edge function renders non-heatmap/non-boxplot charts as `[See visualization in application]` placeholder text instead of actual data
2. **Unified export** -- No single "Export All" button that combines Chapter 4 + Chapter 5 + Appendix in one document
3. **Admin granular control** -- The `step_functions` table currently has only 16 high-level entries (e.g., "Parametric Tests" for Step 5) but does NOT list individual sub-functions (One-Sample T, Independent T, Paired T, One-Way ANOVA, etc.)
4. **Reports page empty** -- `handleFinish` navigates to `/dashboard/reports` but never creates a `reports` record, so nothing appears; also no way to resume/edit a saved analysis
5. **Master Writing Engine** -- The current `interpret-results` edge function has a good writing logic library but the prompts need to be restructured to match the 8-layer academic reporting format provided by the user

---

## Detailed Changes

### 1. Charts in Export (generate-thesis-doc)

**Problem:** Lines 114-128 of `generate-thesis-doc/index.ts` -- for histogram, scatter, bar, line, and Q-Q charts, the export outputs:
```html
<p><em>[See visualization in application]</em></p>
```

**Fix:** Render chart data as HTML tables in the export (Word can display tables but not SVG charts). Each chart type gets a data table:

- **Histogram**: Table with columns `Bin Range | Count | Normal Expected`
- **Q-Q Plot**: Table with columns `Theoretical | Observed` (first 20 points)
- **Scatter**: Table with columns `X | Y` (first 30 points)
- **Bar**: Table with columns `Group | Value`
- **Line/Scree**: Table with columns `Component | Eigenvalue`

After each chart data table, add an italic note:
```html
<p><em>* Note: Interactive visualization available in application. Data values presented above.</em></p>
```

### 2. Unified "Export All" Button

**Problem:** Currently Step 13 has separate buttons for Chapter 4, Chapter 5, and Appendix. No way to get everything in one document.

**Fix:** Add a new `chapterFilter: 'all'` mode to the export:
- In `Step13ThesisBinder.tsx`: Add a primary "Export Complete Thesis (.doc)" button at the top of Export Options
- In `generate-thesis-doc/index.ts`: When `chapterFilter === 'all'`, generate: Title Page -> Chapter 4 (with inline tables) -> Chapter 5 -> Appendix (all blocks) -> References
- This produces one unified document

### 3. Admin Granular Control (Step Functions)

**Problem:** The `step_functions` table has entries like "Parametric Tests" for Step 5, but the user wants individual function control (One-Sample T, Independent T, Paired T, One-Way ANOVA each as separate toggleable rows).

**Fix:** 
- Insert additional granular rows into `step_functions` via a data operation
- Step 1: Upload Data, File Validation
- Step 4: Shapiro-Wilk, Kolmogorov-Smirnov, Descriptive Statistics, Frequencies
- Step 5: One-Sample T-Test, Independent T-Test, Paired T-Test, One-Way ANOVA
- Step 6: Mann-Whitney U, Wilcoxon Signed-Rank, Kruskal-Wallis, Friedman, Chi-Square
- Step 7: Two-Way ANOVA, MANOVA, Repeated Measures, ANCOVA
- Step 8: Pearson, Spearman, Partial Correlation, Point-Biserial
- Step 9: Simple Linear, Multiple Linear, Binary Logistic, Regression Diagnostics
- Step 10: Cronbach Alpha, KMO-Bartlett, EFA, CFA, Composite Reliability
- Step 11: Chapter 4 Generation, Section Regeneration, Manual Editing
- Step 12: Chapter 5 Generation, Theory Framework, Citation Manager
- Step 13: Word Export, HTML Export, Appendix Export, Unified Export

Each row has `is_pro_only` and `is_enabled` toggles in the admin panel. The existing `AnalysisManager.tsx` Step Functions tab already renders these correctly -- we just need more rows in the database.

### 4. Reports Page -- Show Saved Analyses and Exports

**Problem:** `handleFinish` saves the analysis and navigates to `/dashboard/reports`, but no `reports` record is created. The Reports page queries the `reports` table which is always empty. Also, there is no way to return to a previously saved analysis.

**Fix:**
- In `handleFinish` (`NewAnalysis.tsx`): Create a `reports` record with the analysis data before navigating
- In `Reports.tsx`: Add a "Saved Analyses" tab that queries `analyses` table directly (not just `reports`), allowing users to click and resume any analysis by navigating back to `/dashboard/new-analysis` with the `analysisId` in state
- Add a "Re-export" button on each report card that navigates to Step 13 of that analysis
- Add actual download functionality: store export HTML content in the `thesis_exports` table `file_url` field (as a data URL or blob) so users can re-download

### 5. Master Writing Engine Integration

**Problem:** The user has provided a comprehensive 8-layer writing prompt structure that must be integrated into the `interpret-results` edge function and the `generate-chapter4` edge function.

**Fix:** Update the `interpret-results` edge function system prompt to enforce the 8-layer structure:
1. Test Identification
2. Statistical Evidence (APA format)
3. Decision Rule (H0 reject/fail)
4. Effect Size Interpretation (with classification thresholds)
5. Practical Interpretation
6. Assumption Reporting
7. Post Hoc Reporting
8. Graph Interpretation

The function already has `WritingLogic` per test type with `apaNotation`, `introTemplate`, `narrativePattern`, etc. The fix adds:
- A structured output format requirement in the system prompt
- Table footnotes with decision rules (italic, with asterisks)
- Each block's narrative must include all 8 layers
- Save the structured narrative as `{ methodology, statistical_result, effect_interpretation, assumption_report, posthoc_report, graph_interpretation, hypothesis_decision, apa }` in the `narrative` JSONB field

Also update `generate-chapter4` to instruct the AI to follow the same academic writing rules and include table footnotes.

For table footnotes in Step 11 and exports:
- After each table, add italic footnotes: `*p < .05. **p < .01. ***p < .001.`
- Add decision rule note: `*Note: The null hypothesis was [rejected/not rejected] at the .05 significance level.`

---

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `supabase/functions/generate-thesis-doc/index.ts` | Render chart data as HTML tables instead of placeholder text; add `chapterFilter: 'all'` unified export mode |
| 2 | `src/components/spss-editor/Step13ThesisBinder.tsx` | Add "Export Complete Thesis" button; create `reports` record on export |
| 3 | `src/pages/dashboard/NewAnalysis.tsx` | Create `reports` record in `handleFinish` |
| 4 | `src/pages/dashboard/Reports.tsx` | Add "Saved Analyses" tab showing all analyses with resume/re-export buttons |
| 5 | `supabase/functions/interpret-results/index.ts` | Restructure system prompt to enforce 8-layer academic writing format; add structured narrative output |
| 6 | `supabase/functions/generate-chapter4/index.ts` | Add master writing engine rules to prompt; require table footnotes |
| 7 | `src/components/spss-editor/Step11AcademicResults.tsx` | Add table footnotes (significance markers) after each rendered table |
| 8 | Database (data insert) | Insert ~40 granular step function rows into `step_functions` table |

---

## Technical Details

### Chart Data Tables in Export

For each chart type, render an HTML table with the actual data values:

```text
Histogram -> Bin Range | Count | Normal Expected
Q-Q Plot  -> Theoretical | Observed (max 20 rows)
Scatter   -> X | Y (max 30 rows) + note if truncated
Bar       -> Group Label | Value
Line      -> X Label | Y Value
Scree     -> Component | Eigenvalue
```

This approach works in Word exports because HTML tables render natively.

### Unified Export Structure

When `chapterFilter === 'all'`:
```text
1. Title Page
2. Table of Contents (section headings)
3. Chapter 4: Results (with inline analysis tables + charts-as-tables)
4. Chapter 5: Discussion
5. Appendix: Full SPSS Output (all blocks in category order)
6. References
```

### Reports Page Architecture

The Reports page will have two tabs:
- **Reports**: Shows `thesis_exports` records (actual exported documents) with re-download capability
- **Saved Analyses**: Shows `analyses` records with status, step progress, and resume button

### Master Writing Engine Narrative Structure

Each analysis block's `narrative` field will be structured as:
```json
{
  "methodology": "A one-way ANOVA was conducted to...",
  "statistical_result": "F(2, 52) = 4.23, p = .019, n^2 = .14",
  "effect_interpretation": "The effect size was large...",
  "assumption_report": "Levene's test was satisfied...",
  "posthoc_report": "Tukey HSD indicated...",
  "graph_interpretation": "The bar chart illustrates...",
  "hypothesis_decision": "The null hypothesis was rejected.",
  "apa": "Combined APA paragraph..."
}
```

### Table Footnotes

After each SPSS-style table in Step 11 and exports:
```html
<p style="font-size: 9pt; font-style: italic;">
  *p < .05. **p < .01. ***p < .001.
</p>
<p style="font-size: 9pt; font-style: italic;">
  Note. N = 55. The null hypothesis was rejected at the .05 significance level.
</p>
```
