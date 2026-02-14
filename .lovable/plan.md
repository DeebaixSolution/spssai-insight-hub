

# Full Build Plan: Steps 4-7 Statistical Engines

## Gap Analysis Summary

| Component | Master Prompt Requirement | Current State | Gap |
|-----------|--------------------------|---------------|-----|
| **Step 4 UI** | 3 tabs (Descriptive, Normality, Reporting) | 3 tabs exist with SPSS tables | ~60% done |
| **Step 4 Normality** | Real Shapiro-Wilk/K-S via server | `Math.random()` placeholder (line 121) | Not implemented |
| **Step 4 Visual Diagnostics** | Histogram, Q-Q plot, Boxplot | Not present | Not implemented |
| **Step 4 DB Storage** | Save to `analysis_blocks` + `analysis_assumptions` | Not saving anything | Not implemented |
| **Step 4 Progression Gate** | Block Step 5+ until completed | Not enforced | Not implemented |
| **Step 5 Parametric** | Full t-test/ANOVA engine with UI | Empty placeholder (19 lines) | Not implemented |
| **Step 6 Non-Parametric** | Decision tree + 5 test types | Empty placeholder (19 lines) | Not implemented |
| **Step 7 ANOVA/GLM** | 5 model types with post-hoc | Empty placeholder (19 lines) | Not implemented |
| **Edge Function** | All test types server-side | `run-analysis` has: descriptives, frequencies, t-tests, ANOVA, chi-square, Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, correlations, regression, Cronbach's alpha | Backend mostly done |
| **DB Tables** | `analysis_assumptions`, `analysis_state` | Neither exists | Not created |

**Key Finding:** The `run-analysis` edge function already has deterministic implementations for nearly all required tests (t-tests, ANOVA, chi-square, Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, correlations, regression). What is missing is the **frontend UI** connecting to these computations and the **database persistence layer**.

---

## Phase 1: Database Migration

Create two new tables:

**`analysis_assumptions`** -- stores normality status, skewness, kurtosis per variable
- id (uuid, PK)
- analysis_id (uuid, references analyses)
- variable_name (text)
- normality_status (boolean)
- test_used (text) -- "Shapiro-Wilk" or "Kolmogorov-Smirnov"
- statistic (numeric)
- p_value (numeric)
- skewness (numeric)
- kurtosis (numeric)
- skewness_violation (boolean)
- kurtosis_violation (boolean)
- parametric_allowed (boolean)
- sample_size (integer)
- created_at, updated_at

**`analysis_state`** -- tracks per-step completion
- id (uuid, PK)
- analysis_id (uuid, references analyses)
- step_4_completed (boolean, default false)
- step_5_completed (boolean, default false)
- step_6_completed (boolean, default false)
- step_7_completed (boolean, default false)
- step_8_completed (boolean, default false)
- step_9_completed (boolean, default false)
- step_10_completed (boolean, default false)
- parametric_executed (boolean, default false)
- hypothesis_updated (boolean, default false)
- created_at, updated_at

Both tables will have RLS policies following the existing pattern (through analyses -> projects -> user_id).

---

## Phase 2: Step 4 Complete Rebuild

### What Already Works
- Descriptive statistics computation (lines 66-89): mean, SD, variance, min, max, range, skewness, kurtosis -- all computed correctly client-side
- Frequency tables (lines 92-114): correct category counts and percentages
- SPSS-style table rendering with `.spss-table-academic` CSS class
- Template-based reporting text (lines 139-168)
- 3-tab UI structure

### What Needs to Be Built

**A. Replace fake normality with server-side computation**
- Add `normality-test` case to `run-analysis` edge function (Shapiro-Wilk approximation for N<50, Kolmogorov-Smirnov for N>=50)
- Call `run-analysis` with `testType: 'normality-test'` from Step 4
- Remove `Math.random()` lines (121-122) and replace with actual results

**B. Add visual diagnostics (Tab B)**
- Histogram with normal curve overlay using Recharts BarChart + LineChart composition
- Q-Q plot using Recharts ScatterChart (sorted values vs theoretical quantiles)
- Boxplot using Recharts (custom bar chart showing Q1, Q3, median, whiskers)
- All rendered inline, no separate storage needed initially

**C. Add database persistence**
- After computation, save descriptive results to `analysis_blocks` (section = 'descriptives', test_category = 'descriptive')
- Save normality results to `analysis_assumptions` table
- Save frequency tables to `analysis_blocks`
- Store `parametric_allowed` flag per variable

**D. Add educational tooltips**
- Collapsible section: "What is Descriptive Statistics?", "What is Normality?", "When to use parametric tests?"

**E. Enforce progression gate**
- Update `NewAnalysis.tsx` `canProceed()` for step 4: require both descriptive and normality computation to be completed before allowing Step 5+
- Update `analysis_state.step_4_completed` in database

### Files Modified
- `src/components/spss-editor/Step4Descriptive.tsx` -- major enhancement
- `supabase/functions/run-analysis/index.ts` -- add `normality-test` case
- `src/pages/dashboard/NewAnalysis.tsx` -- update progression gate for step 4

---

## Phase 3: Step 5 Parametric Engine (Full Build)

**File:** `src/components/spss-editor/Step5Parametric.tsx` -- complete rewrite from placeholder

### UI Structure (6 Collapsible Panels)
1. **Test Selection Panel** -- 4 options: One-Sample T, Independent T, Paired T, One-Way ANOVA. Each enabled/disabled by rule engine checking `analysis_assumptions.parametric_allowed`
2. **Descriptive Preview** -- Group statistics table (N, Mean, SD, SE)
3. **Assumptions Check** -- Levene's test result for independent t-test; normality status from Step 4
4. **Main Results** -- Test statistic table (t/F, df, Sig., Mean Difference, 95% CI)
5. **Hypothesis Decision** -- Fetches H0/H1 from hypotheses table, applies p < 0.05 rule, stores decision
6. **Academic Report Preview** -- APA-7 template-based text

### Rule Engine (Pre-test Validation)
- Check `normality_status` from `analysis_assumptions` table
- If `parametric_allowed = false` for DV: block test, show warning with non-parametric suggestion
- Check DV measure = scale
- Independent T: require grouping variable with exactly 2 groups
- One-Way ANOVA: require grouping variable with 3+ groups
- All validation is client-side, deterministic

### Backend Connection
- Calls existing `run-analysis` edge function with appropriate `testType` (already implemented: `one-sample-t-test`, `independent-t-test`, `paired-t-test`, `one-way-anova`)
- No new edge function needed -- backend already computes all required statistics

### Effect Size
- Cohen's d for t-tests (already computed in edge function)
- Eta-squared for ANOVA (already computed in edge function)
- Display interpretation: 0.2 small, 0.5 medium, 0.8 large

### Database Storage
- Save all output tables to `analysis_blocks` (section = 'hypothesis', test_category = 'compare-means')
- Save effect size, p_value, decision to block record
- Update `hypotheses.status` to 'supported' or 'rejected'
- Update `analysis_state.step_5_completed`

### Charts
- Bar chart with error bars for t-tests (mean +/- SE per group)
- Mean comparison chart for ANOVA
- Uses existing Recharts components

---

## Phase 4: Step 6 Non-Parametric Engine (Full Build)

**File:** `src/components/spss-editor/Step6NonParametric.tsx` -- complete rewrite from placeholder

### Decision Tree Engine (Client-Side)
Automatic test selection based on variable properties:
- DV=Nominal + IV=Nominal -> Chi-Square (Fisher if expected < 5)
- DV=Ordinal/Scale(non-normal) + 2 Independent Groups -> Mann-Whitney U
- DV=Ordinal/Scale(non-normal) + 2 Related Groups -> Wilcoxon
- 3+ Independent Groups -> Kruskal-Wallis
- 3+ Related Measures -> Friedman
- Correlation + Non-normal -> Spearman
- Small sample / many ties -> Kendall Tau

### UI Structure
- Assumption check summary panel
- AI-selected test display with reasoning
- Alternative tests (collapsed)
- Results tables (SPSS-style)
- Effect size explanation
- Hypothesis decision
- Academic report preview

### Backend Connection
- All tests already implemented in `run-analysis`: `chi-square`, `mann-whitney`, `wilcoxon`, `kruskal-wallis`, `friedman`, `spearman`, `kendall-tau`
- No new edge function code needed

### Per-Test Output (from existing edge function)
- Chi-Square: Crosstab, Chi-Square table, Cramer's V
- Mann-Whitney: Ranks, U Statistics, Effect Size r
- Wilcoxon: Ranks (Pos/Neg), Z, Effect Size r
- Kruskal-Wallis: Ranks, Chi-Square, Epsilon-squared, Dunn's post-hoc
- Friedman: Ranks, Chi-Square, Kendall's W

### Database Storage
- Save to `analysis_blocks` (section = 'hypothesis', test_category = 'nonparametric')
- Update hypothesis status
- Update `analysis_state.step_6_completed`

### State Machine
Track states: INIT -> CHECKING_REQUIREMENTS -> SELECTING_TEST -> RUNNING_TEST -> GENERATING_TABLES -> SAVING_RESULTS -> COMPLETED

---

## Phase 5: Step 7 ANOVA & GLM Engine (Full Build)

**File:** `src/components/spss-editor/Step7AnovaGLM.tsx` -- complete rewrite from placeholder

### Auto-Detection Decision Tree (Client-Side)
| Condition | Model |
|-----------|-------|
| 1 DV + 1 IV (3+ groups) | One-Way ANOVA |
| 1 DV + 2 IVs | Two-Way ANOVA |
| 1 DV across time (within-subject) | GLM Repeated Measures |
| Multiple DVs + 1 IV | One-Way MANOVA |
| Multiple DVs + 2 IVs | Two-Way MANOVA |

### UI Structure (Collapsible Sections)
A. Model Summary -- type, DV(s), IV(s), design classification, total N
B. Assumptions -- Normality status (from Step 4), Levene's test, Mauchly's sphericity (repeated measures), Box's M (MANOVA)
C. Main Effects -- F, df, Sig., Partial Eta Squared
D. Interaction Effects (Two-Way/MANOVA) -- A x B interaction
E. Post Hoc -- Tukey HSD / Bonferroni pairwise comparisons
F. Effect Size -- Partial eta-squared interpretation (.01 small, .06 medium, .14 large)
G. Visualization -- Bar chart with error bars (One-Way), Interaction plot (Two-Way), Line plot (Repeated Measures)
H. Academic Report -- APA-7 formatted narrative

### Backend Changes
- One-Way ANOVA already implemented in `run-analysis`
- Need to add: `two-way-anova`, `repeated-measures-anova`, `manova` cases to `run-analysis` edge function
- Two-Way ANOVA: compute main effects A, B, and interaction A*B using sum of squares decomposition
- Repeated Measures: within-subject SS decomposition with Mauchly's sphericity test and Greenhouse-Geisser correction
- MANOVA: Wilks' Lambda computation with follow-up univariate ANOVAs

### Database Storage
- Save to `analysis_blocks` (section = 'hypothesis', test_category = 'anova-glm')
- Update hypothesis status
- Update `analysis_state.step_7_completed`

---

## Implementation Order

| Order | Task | Dependencies |
|-------|------|-------------|
| 1 | Database migration (analysis_assumptions + analysis_state) | None |
| 2 | Add normality-test to run-analysis edge function | None |
| 3 | Rebuild Step 4 (normality integration, charts, DB storage, gate) | Steps 1-2 |
| 4 | Build Step 5 Parametric (UI + rule engine + DB storage) | Step 3 |
| 5 | Build Step 6 Non-Parametric (decision tree + UI + DB storage) | Step 3 |
| 6 | Add Two-Way ANOVA, Repeated Measures, MANOVA to edge function | None |
| 7 | Build Step 7 ANOVA/GLM (auto-detection + UI + DB storage) | Step 6 |
| 8 | Update NewAnalysis.tsx for progression gates and prop passing | Steps 3-7 |

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| Migration SQL | `analysis_assumptions` and `analysis_state` tables |

### Files to Modify
| File | Changes |
|------|---------|
| `src/components/spss-editor/Step4Descriptive.tsx` | Add normality edge function call, visual diagnostics (histogram/Q-Q/boxplot), DB persistence, educational tooltips |
| `src/components/spss-editor/Step5Parametric.tsx` | Full rewrite: 6-panel UI, rule engine, hypothesis decision, academic templates |
| `src/components/spss-editor/Step6NonParametric.tsx` | Full rewrite: decision tree, 7 test types, state machine, DB storage |
| `src/components/spss-editor/Step7AnovaGLM.tsx` | Full rewrite: 5 model types, 8-section UI, auto-detection |
| `supabase/functions/run-analysis/index.ts` | Add: normality-test, two-way-anova, repeated-measures-anova, manova cases |
| `src/pages/dashboard/NewAnalysis.tsx` | Update `canProceed()` for steps 4-7, pass analysis_id and normality data as props |
| `src/hooks/useAnalysisWizard.ts` | Add assumption state management and analysis_state sync |

### Key Architecture Rules
- All statistics computed server-side in `run-analysis` (deterministic, not AI)
- AI used only for interpretation formatting in academic templates
- All tables/charts saved to `analysis_blocks` -- never regenerated
- SPSS-style formatting via `.spss-table-academic` CSS class throughout
- State machine prevents step-skipping
- `parametric_allowed` flag from Step 4 controls Steps 5 and 7

