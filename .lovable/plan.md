
# Fix Plan: Charts, Academic Reports, and Data Persistence for Steps 4-13

## Root Causes Identified

### Issue 1: Charts and Graphs Not Appearing in Steps 11 and 13

**Two problems:**

A. **Step 4 normality charts (histograms, Q-Q plots, boxplots):** These are computed client-side in `Step4Descriptive.tsx` as `visualDiagnostics` and rendered using Recharts. However, when saving to `analysis_blocks`, the descriptives block stores `results.charts: []` (empty array). The visual diagnostics data is never persisted in the block's `charts` field.

B. **Step 11 chart rendering:** Even for blocks that DO have chart data (MANOVA has 2 charts, one-way ANOVA has 1 chart), Step 11's `renderBlockTable` function never renders `results.charts`. It only renders `tables`, `statistics`, and `narrative`.

### Issue 2: Academic Reports from Steps 4-10 Not in Steps 11/13

Each step (4, 5, 6, 7, 8, 9, 10) generates in-step academic report text (APA format paragraphs). However:
- Steps 5/6/7 save blocks with `narrative.apa` and `narrative.interpretation` -- these DO appear in Step 11
- Step 4 saves `reportText` only in local state, and blocks have empty `narrative.tableInterpretation`
- **Steps 8, 9, 10 do NOT save to `analysis_blocks` at all** -- results exist only in local React state

### Issue 3: Reliability/Regression/Diagnostics Not Saved

**This is the critical root cause.** Steps 8 (Correlation), 9 (Regression), and 10 (Measurement/Reliability) call `run-analysis` and display results, but **never write to the `analysis_blocks` table**. Only Steps 4, 5, 6, and 7 persist their results. This means:
- Step 11 can never show correlation, regression, or reliability data
- Step 13 export can never include these results
- The overview cards correctly show grey because no blocks exist

### Issue 4: Chapter Appendix Request

The user wants a dedicated appendix section showing ALL tables, charts, and graphs from Steps 4-10 in a "Full SPSS Analysis" format.

---

## Implementation Plan

### 1. Add Database Persistence to Steps 8, 9, and 10

Each step needs a `saveToDatabase` function (like Step 4 has) that:
- Deletes any existing blocks for that analysis + test_type
- Creates new `analysis_blocks` records with the computed results
- Updates `analysis_state` (step_8/9/10_completed)

**Step 8 (Correlation):**
```
analysis_blocks record:
  section: 'correlation'
  test_type: 'pearson' | 'spearman' | 'correlation-matrix' | 'dv-centered-correlation'
  test_category: 'correlation'
  results: { tables, charts (heatmap data, scatter data), summary }
  narrative: { apa: academic report text }
```

**Step 9 (Regression):**
```
analysis_blocks record:
  section: 'regression'
  test_type: 'simple-linear-regression' | 'multiple-linear-regression' | 'binary-logistic-regression'
  test_category: 'regression'
  results: { tables, charts (residual plots, predicted vs actual), summary }
  narrative: { apa: regression interpretation text }
```

**Step 10 (Measurement):**
```
analysis_blocks records (up to 3):
  - KMO/Bartlett: test_type='kmo-bartlett', test_category='measurement-validation'
  - EFA: test_type='factor-analysis', test_category='measurement-validation'  
  - Reliability: test_type='cronbach-alpha', test_category='reliability'
  results: { tables, charts (scree plot), summary }
  narrative: { apa: reliability/validity interpretation }
```

### 2. Fix Step 4 Visual Diagnostics Persistence

In `Step4Descriptive.tsx`, the `saveToDatabase` function saves descriptives blocks with `charts: []`. Fix: save the `visualDiagnostics` data into a normality block's `charts` field:

```
analysis_blocks record:
  test_type: 'normality-test'
  test_category: 'descriptive'
  results: {
    tables: [normality results table],
    charts: [
      { type: 'histogram', title: 'Histogram: VarName', data: histogramBins },
      { type: 'qq-plot', title: 'Q-Q Plot: VarName', data: qqData },
      { type: 'boxplot', title: 'Boxplot: VarName', data: boxplotData }
    ]
  }
```

### 3. Add Chart Rendering to Step 11

In `Step11AcademicResults.tsx`, extend `renderBlockTable` to also render `results.charts`:
- `type: 'bar'` -- render using Recharts BarChart
- `type: 'histogram'` -- render using ComposedChart (bars + normal curve line)
- `type: 'qq-plot'` -- render using ScatterChart
- `type: 'boxplot'` -- render as a summary card (matching Step 4 style)
- `type: 'scatter'` -- render using ScatterChart
- `type: 'heatmap'` -- render as a color-coded HTML table (matching Step 8 style)
- `type: 'line'` / `type: 'scree'` -- render using LineChart

### 4. Add Charts to Step 13 Export

In `generate-thesis-doc/index.ts`, when rendering analysis block tables section-by-section, also include a text reference for each chart (since HTML export cannot embed Recharts):
```html
<p class="no-indent"><em>Figure 4.X: [chart title]</em></p>
<p>See attached chart data for visualization.</p>
```

For heatmap-type charts, render them as HTML tables in the export (they are just colored tables).

### 5. Create Chapter Appendix

Add a new export option in Step 13: **"Export Appendix (Full SPSS Output)"**

This appendix will:
- List ALL analysis blocks in execution order
- For each block: show the test type heading, all tables, chart references, APA narrative, and interpretation
- Format as a proper academic appendix with numbering (Appendix A, B, C...)

The appendix export uses the same `generate-thesis-doc` edge function with a new `appendixOnly: true` parameter.

---

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `src/components/spss-editor/Step8Correlation.tsx` | Add `saveToDatabase()` after successful computation -- persist tables, charts (heatmap, scatter), and academic report to `analysis_blocks` |
| 2 | `src/components/spss-editor/Step9Regression.tsx` | Add `saveToDatabase()` -- persist model tables, diagnostic charts, and regression interpretation to `analysis_blocks` |
| 3 | `src/components/spss-editor/Step10Measurement.tsx` | Add `saveToDatabase()` -- persist KMO, EFA (with scree chart), and Cronbach alpha results to `analysis_blocks` |
| 4 | `src/components/spss-editor/Step4Descriptive.tsx` | Fix `saveToDatabase()` to include a normality block with visual diagnostics (histogram, Q-Q, boxplot) in `charts` field |
| 5 | `src/components/spss-editor/Step11AcademicResults.tsx` | Add chart rendering in `renderBlockTable` using Recharts (bar, scatter, histogram, heatmap, line) |
| 6 | `src/components/spss-editor/Step13ThesisBinder.tsx` | Add "Export Appendix" button; include chart references in export |
| 7 | `supabase/functions/generate-thesis-doc/index.ts` | Support `appendixOnly` mode; render heatmap charts as HTML tables in export |

---

## Technical Details

### Why Steps 8/9/10 Don't Save

Looking at the code:
- **Step 5** (`Step5Parametric.tsx`): Has `analysis_blocks.insert` at line 176
- **Step 6** (`Step6NonParametric.tsx`): Has `analysis_blocks.insert` at line 173  
- **Step 7** (`Step7AnovaGLM.tsx`): Has `analysis_blocks.insert` at line 143
- **Step 8** (`Step8Correlation.tsx`): NO `analysis_blocks` reference at all
- **Step 9** (`Step9Regression.tsx`): NO `analysis_blocks` reference at all
- **Step 10** (`Step10Measurement.tsx`): NO `analysis_blocks` reference at all

Steps 8-10 were built to compute and display results locally but the persistence layer was never added. This is the primary reason reliability, regression, and correlation data never appears in Steps 11/13.

### Chart Data Structure in Database

Blocks that DO have charts (MANOVA, one-way ANOVA) store them as:
```json
{ "type": "bar", "title": "Group Means", "data": [{ "group": "A", "mean": 3.5 }, ...] }
```

Step 4 visual diagnostics use a different structure with `bins`, `theoretical`/`observed`, and boxplot stats. These need to be normalized into the standard chart format before saving.

### Heatmap Rendering in Export

The correlation heatmap is stored as chart data `[{ var1, var2, r, p }]`. In HTML export, this can be rendered as a colored HTML table (same as Step 8 renders it), which Word will display correctly.
