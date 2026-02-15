

# Full Build Plan: Steps 8-10 Statistical Engines

## Current State vs Master Prompts

| Component | Master Prompt Requirement | Current State | Gap |
|-----------|--------------------------|---------------|-----|
| **Step 8 Frontend** | 3 modes (Pairwise/Matrix/DV-Centered), heatmap, scatter plots, tutorial | Empty placeholder (20 lines) | 0% done |
| **Step 8 Backend** | Pearson, Spearman, Kendall's Tau | All 3 already implemented in `run-analysis` | Backend ready |
| **Step 9 Frontend** | Simple/Multiple Linear, Binary Logistic, diagnostics, ROC | Empty placeholder (20 lines) | 0% done |
| **Step 9 Backend** | Simple linear, multiple linear, logistic, VIF, ROC | Only simple linear regression exists | ~30% done |
| **Step 10 Frontend** | EFA (KMO, Bartlett, Scree, Pattern Matrix), Reliability (Alpha, item-total) | Empty placeholder (20 lines) | 0% done |
| **Step 10 Backend** | KMO, Bartlett, factor extraction, rotation, Cronbach's Alpha | Only Cronbach's Alpha exists | ~20% done |
| **DB Storage** | All outputs to `analysis_blocks`, update `analysis_state` | Tables exist but Steps 8-10 don't use them | Not connected |

---

## Phase 1: Edge Function Extensions

Add the following cases to `supabase/functions/run-analysis/index.ts`:

**For Step 8 (Correlation):**
- `correlation-matrix`: Compute pairwise Pearson/Spearman for all scale variable pairs. Return full matrix with coefficients, p-values, and N.
- `dv-centered-correlation`: Correlate one DV against all IVs, return ranked by absolute coefficient strength.
- The existing `pearson`, `spearman`, `kendall-tau` cases handle pairwise mode already.

**For Step 9 (Regression):**
- `multiple-linear-regression`: Matrix-based OLS for 2+ predictors. Return R, R-squared, adjusted R-squared, ANOVA table, coefficients (B, Beta, t, Sig., 95% CI), VIF/Tolerance per predictor, Durbin-Watson statistic, residual data for diagnostic plots.
- `binary-logistic-regression`: Iteratively reweighted least squares (or simplified MLE). Return -2LL, Cox and Snell R-squared, Nagelkerke R-squared, Omnibus test, Wald statistics, Exp(B), classification table, ROC/AUC data.

**For Step 10 (Measurement):**
- `kmo-bartlett`: Compute KMO measure of sampling adequacy and Bartlett's test of sphericity from correlation matrix.
- `factor-analysis`: Principal Axis Factoring or PCA. Return eigenvalues, total variance explained, scree data, rotated pattern/component matrix (Varimax or Oblimin), factor correlation matrix.
- The existing `cronbach-alpha` case already handles reliability but needs extension for item-total correlations and alpha-if-deleted (which it already computes).

---

## Phase 2: Step 8 -- Correlation Intelligence Module

**File:** `src/components/spss-editor/Step8Correlation.tsx` -- complete rewrite

### Three Operation Modes (Tab-based UI)

**Mode 1 -- Pairwise Correlation**
- User selects Variable A and Variable B from dropdowns (filtered to scale variables)
- Auto-detect: if both normal (from `analysis_assumptions`) use Pearson, else Spearman
- Manual override toggle
- Output: correlation coefficient, p-value, N, strength classification, direction
- Scatter plot with line of best fit (Recharts ScatterChart)

**Mode 2 -- Full Correlation Matrix**
- Auto-detect all scale variables
- Run `correlation-matrix` via edge function
- Display SPSS-style matrix table (Variable x Variable grid with r, Sig, N)
- Heatmap visualization using Recharts with blue-white-red gradient
- Color legend for strength

**Mode 3 -- DV-Centered Correlation**
- User selects one DV
- System correlates DV against all IVs
- Ranked table by absolute coefficient: IV, r, p, Strength, Direction
- Scatter plots for top correlations

### Strength Classification Engine (client-side)
- |r| < .10: Negligible
- .10-.29: Weak
- .30-.49: Moderate
- .50-.69: Strong
- >= .70: Very Strong

### Database Storage
- Save each correlation result to `analysis_blocks` (section = 'correlation', test_category = 'correlation')
- Store mode_type, test_type, variables, coefficient, p_value in block config
- Update `analysis_state.step_8_completed`

### Academic Reporting Templates
- Pearson: "A Pearson correlation was conducted to examine the relationship between [X] and [Y]. There was a [significant/non-significant] [positive/negative] correlation, r([df]) = [r], p = [p], indicating a [strength] association."
- Spearman: "A Spearman rank-order correlation indicated a [significant/non-significant] [direction] association between [X] and [Y], rho = [rho], p = [p]."

### Tutorial Layer
- Collapsible section explaining Pearson vs Spearman, r interpretation, p-value meaning

---

## Phase 3: Step 9 -- Regression Modeling Engine

**File:** `src/components/spss-editor/Step9Regression.tsx` -- complete rewrite

### Regression Decision Tree (client-side)
- If DV = continuous: enable Simple Linear and Multiple Linear
- If DV = binary (0/1): enable Binary Logistic
- If wrong model selected: show warning

### Model A -- Simple Linear Regression
- Uses existing `simple-linear-regression` case
- Display: Model Summary (R, R-squared, Adjusted R-squared, SE), ANOVA table, Coefficients table (B, SE, t, Sig.)
- Diagnostic plots: Scatterplot with regression line, Residual vs Predicted plot, Histogram of residuals
- All using Recharts

### Model B -- Multiple Linear Regression
- Uses new `multiple-linear-regression` case
- Additional outputs: VIF/Tolerance table per predictor, Durbin-Watson statistic
- VIF interpretation: > 10 severe, 5-10 moderate, < 5 acceptable
- Contribution engine: identify strongest predictor by standardized Beta
- Standardized residuals plot

### Model C -- Binary Logistic Regression
- Uses new `binary-logistic-regression` case
- Display: Model Fit (-2LL, Cox and Snell R-squared, Nagelkerke R-squared), Omnibus test, Variables in Equation (B, Wald, Sig., Exp(B), 95% CI)
- Classification table
- ROC curve using Recharts AreaChart
- AUC interpretation: < .6 weak, .6-.7 fair, .7-.8 good, .8-.9 excellent
- Odds ratio interpretation engine: auto-convert Exp(B) to percentage statements

### State Machine
STATE 1: Model selection -> STATE 2: Assumption check -> STATE 3: Model estimation -> STATE 4: Diagnostic validation -> STATE 5: Writing generation -> STATE 6: Database persistence -> STATE 7: Ready for export

### Integration with Previous Steps
- Check Step 4 normality status for residual assumptions
- Check Step 8 correlation strength to advise on predictor selection
- Link to hypotheses from Step 3

### Database Storage
- Save all tables, charts, diagnostics, interpretation to `analysis_blocks` (section = 'regression', test_category = 'regression')
- Store model_type, DV, IVs, coefficients, R-squared, diagnostics flags in block config
- Update `analysis_state.step_9_completed`

### Academic Reporting Templates
- Simple: "A simple linear regression was conducted to predict [DV] from [IV]. The model was [significant/non-significant], F([df1], [df2]) = [F], p = [p], R-squared = [R2]."
- Multiple: "A multiple linear regression was conducted... The model explained [R2]% of the variance. [IV] was the strongest predictor (Beta = [beta], p = [p])."
- Logistic: "A binary logistic regression was performed... The model was [significant/non-significant] (chi-squared([df]) = [X2], p = [p]). [IV] significantly predicted [DV] (Wald = [W], p = [p], OR = [ExpB])."

---

## Phase 4: Step 10 -- Measurement Validation Engine

**File:** `src/components/spss-editor/Step10Measurement.tsx` -- complete rewrite

### Section A -- Construct Validity (EFA)

**Sub-step 1: Data Suitability**
- Call `kmo-bartlett` via edge function
- Display KMO value with interpretation (> .90 Excellent, > .80 Very Good, > .70 Good, > .60 Acceptable, < .50 Inadequate)
- Display Bartlett's test (chi-squared, df, Sig.)
- If KMO < .50 or Bartlett p >= .05: block factor analysis with warning

**Sub-step 2: Factor Extraction**
- Call `factor-analysis` via edge function
- Display Total Variance Explained table (eigenvalues, % variance, cumulative %)
- Scree plot using Recharts LineChart with eigenvalue > 1 threshold line
- Auto-detect number of factors using eigenvalue > 1 rule

**Sub-step 3: Rotation**
- Varimax (orthogonal, default) or Oblimin (if correlated factors expected)
- If Oblimin: display Component Correlation Matrix
- User toggle for rotation type

**Sub-step 4: Pattern Matrix**
- Display Pattern/Component Matrix table
- Highlight loadings >= .40 (green)
- Flag cross-loadings >= .30 on multiple factors (yellow warning)
- Flag weak items < .40 (red)
- Auto-assign items to strongest factor
- Suggest removal candidates

**Sub-step 5: Scree Plot Interpretation**
- Auto-detect elbow point
- Academic narrative explaining factor count decision

### Section B -- Internal Consistency (Reliability)

**Sub-step 6: Cronbach's Alpha**
- Uses existing `cronbach-alpha` case (already computes overall alpha, alpha-if-deleted, item-total correlations)
- Display overall alpha with interpretation
- Display per-item table: Item, Scale Mean if Deleted, Corrected Item-Total Correlation, Alpha if Deleted
- Identify items lowering reliability

**Sub-step 7: Smart Item Optimization**
- MODE 1 (Advisory): AI recommends items to remove but does not auto-delete
- MODE 2 (Optimization): Simulate removal and show improved alpha, user confirms
- Scale statistics table: Mean, Variance, SD, N items

### Final Decision Block
- Measurement Validation Summary panel:
  - Scale structurally valid? (Yes/No)
  - Factors retained count
  - Total variance explained
  - Final Cronbach's Alpha
  - Items removed
  - Scale ready for regression/SEM?

### UI Structure (7 sub-steps in left sidebar)
1. Suitability (KMO/Bartlett)
2. Extraction (Eigenvalues)
3. Rotation
4. Pattern Matrix
5. Scree Plot
6. Reliability
7. Final Decision

### Database Storage
- Save all outputs to `analysis_blocks` (section = 'measurement', test_category = 'measurement-validation')
- Update `analysis_state.step_10_completed`

### Academic Reporting Templates
- EFA: "An exploratory factor analysis using Principal Axis Factoring with [Varimax/Oblimin] rotation revealed a [N]-factor structure explaining [X]% of the total variance. The KMO measure verified sampling adequacy (KMO = [value]), and Bartlett's test of sphericity was significant (chi-squared([df]) = [X2], p < .001)."
- Reliability: "The internal consistency of the scale was assessed using Cronbach's alpha. The reliability coefficient was [alpha], indicating [interpretation] internal consistency."

---

## Implementation Order

| Order | Task | Dependencies |
|-------|------|-------------|
| 1 | Add `correlation-matrix` and `dv-centered-correlation` to edge function | None |
| 2 | Add `multiple-linear-regression` and `binary-logistic-regression` to edge function | None |
| 3 | Add `kmo-bartlett` and `factor-analysis` to edge function | None |
| 4 | Build Step 8 Correlation (3 modes + heatmap + DB storage) | Step 1 |
| 5 | Build Step 9 Regression (3 model types + diagnostics + DB storage) | Step 2 |
| 6 | Build Step 10 Measurement (EFA + Reliability + DB storage) | Step 3 |
| 7 | Update NewAnalysis.tsx for prop passing and state tracking | Steps 4-6 |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/run-analysis/index.ts` | Add 5 new cases: correlation-matrix, dv-centered-correlation, multiple-linear-regression, binary-logistic-regression, kmo-bartlett, factor-analysis |
| `src/components/spss-editor/Step8Correlation.tsx` | Full rewrite: 3-mode correlation engine with heatmap, scatter plots, SPSS tables |
| `src/components/spss-editor/Step9Regression.tsx` | Full rewrite: 3 regression model types with diagnostics, VIF, ROC, academic templates |
| `src/components/spss-editor/Step10Measurement.tsx` | Full rewrite: EFA engine (KMO, extraction, rotation, pattern matrix) + reliability engine |
| `src/pages/dashboard/NewAnalysis.tsx` | Pass analysisId and hypotheses props to Steps 8-10, update state tracking |

### Key Architecture Rules
- All statistics computed server-side in `run-analysis` (deterministic, not AI-generated)
- AI used only for interpretation text formatting
- All tables and charts saved to `analysis_blocks` -- never regenerated
- SPSS-style formatting via `.spss-table-academic` CSS class
- Steps 8-10 integrate with Step 4 normality results (via `analysis_assumptions` table)
- Step 9 checks Step 8 correlation results before regression modeling
- All outputs compatible with Step 11-13 academic production and Word export

