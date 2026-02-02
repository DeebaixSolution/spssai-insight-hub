

# Complete Rebuild: Advanced Statistical Analysis Wizard (SPSS-Level Professional)

## ✅ COMPLETED (Phase 1)

### 1. Database Schema ✅
- Created `analysis_blocks` table with RLS policies
- Created `hypotheses` table with RLS policies  
- Added `role` and `scale_group` columns to `variables` table

### 2. Core Types & Interfaces ✅
- Created `src/types/analysis.ts` with all TypeScript interfaces
- Defined Variable, Hypothesis, AnalysisBlock, BlockResults, BlockNarrative
- Added complete ANALYSIS_TESTS and ANALYSIS_CATEGORIES constants
- Implemented `getRecommendedTests()` for guided UI intelligence

### 3. useAnalysisWizard Hook ✅
- Enhanced with hypothesis management (add/update/remove)
- Added analysis block management (add/update/remove/reorder)
- Added variable role/measure helpers
- Integrated save/load for hypotheses and analysis blocks

### 4. Step 2 - SPSS Variable View ✅
- Full variable grid with Name, Role, Measure, Width, Decimals, Label, Values
- Role assignment (ID, Demographic, DV, IV, Scale Item) with color coding
- Value Labels editor dialog with auto-detected value suggestions
- Scale Item Grouping dialog for reliability analysis
- AI Detection button (Pro)
- Role summary cards and validation warnings

### 5. Step 3 - Hypothesis Builder ✅
- HypothesisCard component with collapsible UI
- Hypothesis type selector (Difference, Association, Prediction)
- DV/IV variable assignment with dropdowns
- Real-time test recommendations based on variable types
- AI Suggest Hypotheses button (Pro)
- Variable summary by role and measure

## 🔄 REMAINING (Phase 2-4)

### What Currently Exists

| Component | Current Status | Gap |
|-----------|---------------|-----|
| Step 1: Upload | Basic upload, CSV/Excel | Works, needs enhancement |
| Step 2: Variables | Limited SPSS Variable View | Missing roles, value labels editor |
| Step 3: Research | Basic text fields | Missing hypothesis builder, linking |
| Step 4: Analysis | Test selection only | No guided recommendations, no blocking |
| Step 5: Results | Basic tables/charts | No assumption output, missing tests |
| Step 6: Interpretation | 5 AI-generated sections | No per-test writing logic |
| Step 7: Export | HTML export | Missing Word/PDF with proper formatting |

### Statistical Tests Currently Implemented

- Frequencies, Descriptives, Crosstabs
- Independent T-Test, Paired T-Test
- One-Way ANOVA (basic)
- Pearson, Spearman
- Chi-Square, Mann-Whitney, Wilcoxon
- Cronbach's Alpha

### Missing Tests (Required by Your Specification)

- One-Sample T-Test
- Two-Way ANOVA
- Repeated Measures ANOVA
- Kruskal-Wallis H
- Friedman Test
- Kendall's Tau
- Simple Linear Regression
- Multiple Linear Regression
- Binary Logistic Regression
- KMO & Bartlett's Test
- Exploratory Factor Analysis (EFA)
- Normality Tests (standalone)

---

## Phase 1: Data Model & State Architecture

### 1.1 Enhanced WizardState Interface

```
File: src/hooks/useAnalysisWizard.ts

New interfaces:

Variable (enhanced):
  - name, label, type, measure
  - role: 'id' | 'demographic' | 'dependent' | 'independent' | 'scale_item' | null
  - valueLabels: Record<string, string>
  - decimals, width
  - missingValues: string[]
  - scaleGroup?: string (for grouped scale items)

Hypothesis:
  - id: string (H1, H2, H3...)
  - type: 'difference' | 'association' | 'prediction'
  - statement: string
  - dependentVariables: string[]
  - independentVariables: string[]
  - linkedAnalysisBlockId?: string
  - status: 'untested' | 'supported' | 'rejected' | null

AnalysisBlock:
  - id: string
  - section: 'reliability' | 'descriptives' | 'hypothesis'
  - sectionId: string (e.g., 'H1', 'demographics')
  - testType: string
  - testCategory: string
  - dependentVariables: string[]
  - independentVariables: string[]
  - groupingVariable?: string
  - linkedHypothesisId?: string
  - assumptions: AssumptionResult[]
  - results: BlockResults | null
  - narrative: BlockNarrative | null

BlockResults:
  - tables: Table[]
  - charts: Chart[]
  - effectSize: EffectSizeResult
  - confidenceIntervals: CIResult[]
  - postHocTests?: PostHocResult[]

BlockNarrative:
  - tableTitle: string (APA formatted)
  - introduction: string
  - interpretation: string
  - figureTitle?: string
  - figureInterpretation?: string
  - hypothesisDecision?: string
```

### 1.2 New Database Schema

```
Table: analysis_blocks
  - id: uuid
  - analysis_id: uuid (FK)
  - section: text
  - section_id: text
  - test_type: text
  - config: jsonb
  - assumptions: jsonb
  - results: jsonb
  - narrative: jsonb
  - display_order: integer
  - created_at: timestamp

Table: hypotheses
  - id: uuid
  - analysis_id: uuid (FK)
  - hypothesis_id: text (H1, H2...)
  - type: text
  - statement: text
  - dependent_vars: text[]
  - independent_vars: text[]
  - status: text
  - created_at: timestamp
```

---

## Phase 2: Step-by-Step Rebuild

### Step 1: Upload Data (Enhanced)

**File: `src/components/spss-editor/Step1Upload.tsx`**

Current functionality retained plus:

1. **Project Name Enforcement**
   - Project name becomes mandatory
   - Auto-generate from filename if empty, but require confirmation

2. **Enhanced Validation**
   - Real-time row/column count display
   - File type validation with clear error messages
   - Preview first 10 rows with column type indicators

3. **Auto-Save Trigger**
   - Create project immediately on file upload
   - Save dataset to database before proceeding

No major changes needed - current implementation is solid.

---

### Step 2: Variables Configuration (SPSS Variable View)

**File: `src/components/spss-editor/Step2Variables.tsx` (Complete Rebuild)**

New component structure:

1. **Full SPSS Variable View Table**
   - Columns: Name | Label | Type | Measure | Role | Width | Decimals | Values | Missing
   - Inline editing for all fields
   - Drag-to-reorder support

2. **Role Assignment (New)**
   - Dropdown for each variable:
     - ID
     - Demographic
     - Dependent Variable (DV)
     - Independent Variable (IV)
     - Scale Item
   - Visual color coding by role

3. **Value Labels Editor (New)**
   - Modal dialog for editing value labels
   - Example: 1 = Male, 2 = Female
   - Import from common patterns

4. **Scale Item Grouping (New)**
   - Group multiple items into a scale
   - Auto-detect patterns (e.g., Q1_1, Q1_2, Q1_3)
   - Name the scale construct

5. **AI Detection (Pro)**
   - Button: "AI Detect Types & Roles"
   - Uses LLM to analyze variable names and sample data
   - Suggests type, measure, and role

6. **Validation Rules**
   - Cannot mark ID variable as DV
   - Warning if no DV assigned for inferential tests
   - Enforce at least 2 scale items for reliability analysis

---

### Step 3: Research Question & Hypotheses Builder

**File: `src/components/spss-editor/Step3Research.tsx` (Complete Rebuild)**

New component structure:

1. **Research Question Input**
   - Text area for main research question
   - Guidance text explaining importance

2. **Hypotheses Builder (New - Critical)**
   - Add Hypothesis button creates cards
   - Each hypothesis card contains:
     - ID: H1, H2, H3... (auto-assigned)
     - Type selector: Difference | Association | Prediction
     - Statement text area
     - Link to DV(s): Dropdown from variables with role=DV
     - Link to IV(s): Dropdown from variables with role=IV
   - Visual indicator showing linked variables

3. **AI Hypothesis Assistant (Pro)**
   - "AI Suggest Hypotheses" button
   - Analyzes research question + variables
   - Suggests testable hypotheses
   - Warns if hypothesis is untestable

4. **Test Recommendation Preview**
   - Based on hypothesis type and variable measures:
     - Difference + Scale DV + Nominal IV (2 groups) -> "Recommended: Independent T-Test"
     - Association + Scale + Scale -> "Recommended: Pearson Correlation"
   - Displayed as chips under each hypothesis

5. **Validation**
   - Cannot proceed if hypothesis has no linked variables
   - Warning for hypotheses without clear DV/IV distinction

---

### Step 4: Analysis Mapping & Configuration (Critical Rebuild)

**File: `src/components/spss-editor/Step4Selection.tsx` (Complete Rebuild)**

This is the most complex step requiring complete architectural change.

1. **Analysis Block Architecture**
   - Each test becomes an independent "Analysis Block"
   - Blocks are organized by section:
     - Descriptives/Demographics (no hypothesis)
     - Reliability (no hypothesis)
     - Hypothesis Testing (linked to H1, H2...)

2. **Left Panel: Analysis Library**
   - Categories with all tests:

   ```
   Descriptive & Preliminary:
   - Frequencies
   - Descriptives
   - Crosstabs
   - Normality Tests (Shapiro-Wilk, K-S)
   - Outlier Detection

   Reliability:
   - Cronbach's Alpha
   - Item-Total Statistics

   Mean Comparisons:
   - One-Sample T-Test
   - Independent Samples T-Test
   - Paired Samples T-Test
   - One-Way ANOVA
   - Two-Way ANOVA
   - Repeated Measures ANOVA

   Nonparametric:
   - Mann-Whitney U
   - Wilcoxon Signed-Rank
   - Kruskal-Wallis H
   - Friedman Test
   - Chi-Square Test

   Correlation:
   - Pearson Correlation
   - Spearman Correlation
   - Kendall's Tau

   Regression:
   - Simple Linear Regression
   - Multiple Linear Regression
   - Binary Logistic Regression

   Factor Analysis:
   - KMO & Bartlett's Test
   - Exploratory Factor Analysis (EFA)
   ```

3. **Guided UI Intelligence (Critical)**
   - Real-time analysis of selected DV and IV:
     - If DV = Scale AND IV = Nominal (2 groups):
       - Highlight Independent T-Test with blue glow
       - Show: "Recommended based on variable measurement levels"
     - If DV = Ordinal:
       - Disable Pearson (red overlay)
       - Highlight Spearman/Mann-Whitney (blue glow)
   - Test incompatibility = Red block with tooltip
   - Assumption violation warning = Orange warning badge

4. **Right Panel: Block Configuration**
   - For each added block:
     - Section: Dropdown (Descriptives | Reliability | H1 | H2...)
     - Link to Hypothesis: Required for inferential tests
     - Variable assignment:
       - DV slot(s)
       - IV slot(s)
       - Grouping variable (if applicable)
     - Test options (e.g., post-hoc selection)

5. **Validation & Blocking**
   - Cannot add T-Test without linked hypothesis
   - Cannot proceed with invalid variable assignments
   - Show clear error messages with resolution steps

6. **Block Reordering**
   - Drag-and-drop to reorder blocks
   - Auto-order: Descriptives -> Reliability -> H1 -> H2...

---

### Step 5: Run Analysis (Separated & Structured Results)

**Files:**
- `src/components/spss-editor/Step5Results.tsx` (Complete Rebuild)
- `supabase/functions/run-analysis/index.ts` (Major Enhancement)

#### Frontend Component

1. **Block-by-Block Execution**
   - Run button for each analysis block separately
   - "Run All" button for sequential execution
   - Progress indicator per block

2. **Per-Block Output Structure**
   - Each block produces:
     - One or more SPSS-style tables
     - Assumption check results (expanded/collapsed)
     - Effect size interpretation
     - One chart (if applicable)
   - Blocks are visually separated with section headers

3. **Assumption Panel (New - Critical)**
   - Displayed above main results for each block
   - Shows:
     - Normality test result (Shapiro-Wilk)
     - Homogeneity of variance (Levene's)
     - Outlier detection summary
   - Traffic light system: Green (pass), Orange (warning), Red (violation)
   - Action buttons: "Switch to Non-parametric", "Proceed Anyway"

4. **Effect Size Display (Mandatory)**
   - Dedicated row/card for effect size
   - Shows: Value | Magnitude | Interpretation
   - Never hidden or omitted

5. **Post-Hoc Automatic Trigger**
   - If ANOVA/Kruskal-Wallis/Friedman is significant (p < 0.05):
     - Automatically run post-hoc tests
     - Display pairwise comparison table

6. **No Mixed Tables**
   - Each variable in Frequencies = separate table
   - Each analysis block = separate output section
   - Clear visual separation

#### Backend Edge Function

Add new statistical tests:

```
Tests to implement in run-analysis/index.ts:

1. one-sample-t-test
   - Compare mean to known value
   - Cohen's d effect size

2. two-way-anova
   - Main effects + interaction
   - Partial eta-squared for each effect

3. repeated-measures-anova
   - Sphericity check (Mauchly's)
   - Greenhouse-Geisser correction
   - Post-hoc with Bonferroni

4. kruskal-wallis
   - H statistic
   - Post-hoc: Dunn's test

5. friedman-test
   - Chi-square approximation
   - Pairwise Wilcoxon post-hoc

6. kendall-tau
   - Tau-b coefficient
   - P-value

7. simple-linear-regression
   - R-squared
   - Coefficients with CI
   - ANOVA table
   - Residual diagnostics

8. multiple-regression
   - Model summary (R, R-squared, adjusted)
   - ANOVA
   - Coefficients (B, SE, Beta, t, p)
   - Collinearity (VIF, Tolerance)

9. logistic-regression
   - Model fit (Chi-square, -2LL)
   - Coefficients (B, SE, Wald, Exp(B))
   - Classification table
   - ROC curve data

10. kmo-bartlett
    - KMO value
    - Bartlett's test of sphericity

11. efa
    - Initial eigenvalues
    - Scree plot data
    - Rotated factor loadings
    - Communalities
```

---

### Step 6: AI Academic Writing Engine (Core Intelligence)

**Files:**
- `src/components/spss-editor/Step6Interpretation.tsx` (Major Enhancement)
- `supabase/functions/interpret-results/index.ts` (Major Enhancement)

#### Frontend Component

1. **Per-Block Writing**
   - Generate interpretation for each analysis block separately
   - Not one combined interpretation

2. **Writing Sections per Block**
   - Section Heading (auto-generated based on hypothesis)
   - Academic Introduction (1-2 sentences)
   - Table Title (SPSS/APA format: "Table 4.1: ...")
   - Table Narrative Interpretation
   - Figure Title (if chart exists)
   - Figure Interpretation
   - Hypothesis Decision (if linked)

3. **Generate All vs. Generate Per Block**
   - "Generate All" for complete Chapter Four
   - Individual generate buttons per section

#### Backend Writing Logic Library (Critical)

Each test MUST have unique writing logic:

```
Writing Logic Templates (in interpret-results/index.ts):

frequencies:
  - Intro: "The demographic characteristics of the sample..."
  - Required stats: n, %, valid %
  - Forbidden: Mean, SD (unless numeric)
  - Pattern: "The majority of participants were [category] (n = X, X%)..."

descriptives:
  - Intro: "Descriptive statistics were computed..."
  - Required stats: M, SD, Min, Max
  - Pattern: "The mean score for [variable] was M = X.XX (SD = X.XX)..."

cronbach-alpha:
  - Intro: "Internal consistency reliability was assessed..."
  - Required stats: alpha, N items
  - Forbidden: Mean, correlation
  - Pattern: "Cronbach's alpha indicated [excellent/good/...] reliability (α = .XX)..."

independent-t-test:
  - Intro: "An independent-samples t-test was conducted..."
  - Required: M1, M2, SD1, SD2, t, df, p, d
  - Hypothesis: "The results [supported/did not support] H1..."
  - Assumption mention mandatory

paired-t-test:
  - Intro: "A paired-samples t-test examined..."
  - Required: M_pre, M_post, t, df, p, d
  - Pattern: "There was a significant [increase/decrease]..."

one-way-anova:
  - Intro: "A one-way ANOVA was conducted..."
  - Required: F, df1, df2, p, eta-squared
  - Post-hoc: "Tukey post-hoc tests revealed..."
  - Assumption mention mandatory

pearson:
  - Intro: "Pearson product-moment correlation..."
  - Required: r, p, N
  - Pattern: "There was a [weak/moderate/strong] [positive/negative] correlation..."

spearman:
  - Intro: "Spearman's rank-order correlation..."
  - Required: rs, p, N
  - Note: Non-parametric justification

kendall-tau:
  - Intro: "Kendall's tau-b was computed..."
  - Required: tau, p

linear-regression:
  - Intro: "Simple linear regression was performed..."
  - Required: R-squared, F, B, SE, t, p
  - Pattern: "[Variable] significantly predicted [outcome]..."

multiple-regression:
  - Intro: "Multiple regression analysis examined..."
  - Required: R, R-squared, adjusted R-squared, F, coefficients
  - Model equation interpretation

logistic-regression:
  - Intro: "Binary logistic regression examined..."
  - Required: Chi-square, -2LL, Nagelkerke R-squared, OR
  - Pattern: "The odds of [outcome] were X times higher..."

efa:
  - Intro: "Exploratory factor analysis with varimax rotation..."
  - Required: KMO, Bartlett's chi-square, factors extracted, variance explained
  - Pattern: "X factors were extracted, accounting for X% of variance..."
```

#### Hypothesis Decision Language

```
If p < alpha (typically 0.05):
  "The results support H1, indicating that [restate finding]."

If p >= alpha:
  "The results do not support H1; no significant [difference/relationship/effect] was found."
```

---

### Step 7: Report Assembly & Export (Professional Output)

**Files:**
- `src/components/spss-editor/Step7Export.tsx` (Major Enhancement)
- `supabase/functions/generate-report/index.ts` (Major Enhancement)

#### Frontend Component

1. **Chapter Structure Preview**
   - Show report structure:
     ```
     CHAPTER FOUR: RESULTS
       4.1 Preliminary Analyses
         4.1.1 Data Screening
         4.1.2 Descriptive Statistics
       4.2 Reliability Analysis
       4.3 Hypothesis Testing
         4.3.1 Hypothesis 1
         4.3.2 Hypothesis 2
     ```

2. **Section Selection**
   - Toggle sections on/off
   - Reorder sections via drag-drop

3. **Table/Figure Numbering Preview**
   - Show: "Table 4.1", "Table 4.2", "Figure 4.1"
   - Auto-numbered based on chapter

4. **Export Formats**
   - Word (.docx) - Native tables, proper formatting
   - PDF - Print-ready with pagination
   - (Both Pro only)

5. **Formatting Options**
   - Font: Times New Roman (default)
   - Table font size: 10pt
   - Body font size: 12pt
   - APA/Custom style toggle

#### Backend Report Generation

Implement proper Word generation:

```
Use docx library for Deno:
- Native Word tables (not HTML converted)
- Proper heading styles
- Table captions ABOVE tables
- Figure captions BELOW figures
- Table notes under each table
- Auto-numbering: Table 4.1, Figure 4.1

Structure:
1. Title page (optional)
2. Chapter heading
3. For each analysis block:
   - Section heading
   - Academic introduction
   - Table with caption
   - Narrative interpretation
   - Figure with caption (if applicable)
   - Hypothesis decision (if applicable)
4. Summary section
```

---

## Phase 3: Additional Components

### 3.1 Supervisor Mode Toggle

**File: `src/components/spss-editor/SupervisorMode.tsx` (New)**

Toggle in Step 5/6/7 that when enabled:
- Uses conservative language
- Includes all assumption checks explicitly
- Adds confidence intervals everywhere
- Avoids strong causal claims
- Increases reporting depth

### 3.2 Style Profile Selector

**File: `src/components/spss-editor/StyleProfile.tsx` (New)**

Dropdown for:
- APA 7th Edition (default)
- University Custom (placeholder for future)

Controls:
- Table caption format
- Figure caption format
- Statistical notation preferences

### 3.3 Audit Trail

**File: `src/hooks/useAuditTrail.ts` (New)**

Track for each analysis:
- Selected test
- Variable configuration
- Assumption status
- Effect size calculated
- Hypothesis decision

Store in database for review/export.

---

## Phase 4: Edge Function Enhancements

### 4.1 run-analysis/index.ts Additions

New tests to implement:
- one-sample-t-test
- two-way-anova
- repeated-measures-anova
- kruskal-wallis (with Dunn's post-hoc)
- friedman (with pairwise Wilcoxon)
- kendall-tau
- simple-linear-regression
- multiple-regression
- logistic-regression
- kmo-bartlett
- efa

Each test must return:
- Tables array
- Charts array
- Effect sizes
- Confidence intervals
- Assumption results (integrated)

### 4.2 check-assumptions/index.ts Enhancements

Add:
- Sphericity test (Mauchly's) for repeated measures
- Multicollinearity check (VIF) for regression
- Independence test
- Linearity check for regression

### 4.3 interpret-results/index.ts Enhancements

Complete per-test writing logic library as detailed in Step 6.

### 4.4 generate-report/index.ts Rebuild

Implement proper Word document generation with:
- docx library
- Native Word tables
- APA formatting
- Auto-numbering

---

## Summary: Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useAnalysisWizard.ts` | Major Modify | New interfaces, analysis blocks |
| `src/components/spss-editor/Step2Variables.tsx` | Complete Rebuild | Full SPSS Variable View |
| `src/components/spss-editor/Step3Research.tsx` | Complete Rebuild | Hypothesis builder |
| `src/components/spss-editor/Step4Selection.tsx` | Complete Rebuild | Analysis blocks, guided UI |
| `src/components/spss-editor/Step5Results.tsx` | Complete Rebuild | Per-block results, assumptions |
| `src/components/spss-editor/Step6Interpretation.tsx` | Major Modify | Per-block writing |
| `src/components/spss-editor/Step7Export.tsx` | Major Modify | Chapter structure |
| `src/components/spss-editor/SupervisorMode.tsx` | New | Conservative mode toggle |
| `src/components/spss-editor/StyleProfile.tsx` | New | APA style selector |
| `src/components/spss-editor/VariableRoleEditor.tsx` | New | Role assignment |
| `src/components/spss-editor/ValueLabelsEditor.tsx` | New | Value labels dialog |
| `src/components/spss-editor/HypothesisCard.tsx` | New | Hypothesis UI component |
| `src/components/spss-editor/AnalysisBlockCard.tsx` | New | Block configuration UI |
| `src/components/spss-editor/AssumptionPanel.tsx` | New | Assumption display |
| `src/components/spss-editor/EffectSizeDisplay.tsx` | New | Effect size card |
| `src/hooks/useAuditTrail.ts` | New | Audit logging |
| `supabase/functions/run-analysis/index.ts` | Major Modify | Add 11 new tests |
| `supabase/functions/check-assumptions/index.ts` | Modify | Add sphericity, VIF |
| `supabase/functions/interpret-results/index.ts` | Major Modify | Per-test writing logic |
| `supabase/functions/generate-report/index.ts` | Complete Rebuild | Word/PDF generation |

---

## Confirmation of Requirements Coverage

| Requirement | Covered | Implementation Location |
|-------------|---------|------------------------|
| Project name mandatory | Yes | Step 1 |
| Variable roles (ID, DV, IV, etc.) | Yes | Step 2 |
| Value labels editor | Yes | Step 2 |
| Scale item grouping | Yes | Step 2 |
| AI variable detection | Yes | Step 2 (Pro) |
| Hypothesis builder with H1, H2... | Yes | Step 3 |
| Hypothesis type (difference, association, prediction) | Yes | Step 3 |
| Hypothesis linked to variables | Yes | Step 3 |
| AI hypothesis suggestions | Yes | Step 3 (Pro) |
| All 24 statistical tests | Yes | Step 4/5 |
| Analysis blocks architecture | Yes | Step 4 |
| Linked to hypothesis | Yes | Step 4 |
| Guided UI recommendations | Yes | Step 4 |
| Disable invalid tests | Yes | Step 4 |
| Block progression when invalid | Yes | Step 4 |
| SPSS-style tables per block | Yes | Step 5 |
| Assumption checking integrated | Yes | Step 5 |
| Effect sizes mandatory | Yes | Step 5 |
| Post-hoc auto-trigger | Yes | Step 5 |
| No mixed tables | Yes | Step 5 |
| Per-test writing logic | Yes | Step 6 |
| Section heading | Yes | Step 6 |
| Table title (APA) | Yes | Step 6 |
| Figure title/interpretation | Yes | Step 6 |
| Hypothesis decision language | Yes | Step 6 |
| Academic doctoral tone | Yes | Step 6 |
| No AI meta-language | Yes | Step 6 |
| Chapter Four structure | Yes | Step 7 |
| Auto-numbered tables/figures | Yes | Step 7 |
| Word native tables | Yes | Step 7 |
| Times New Roman formatting | Yes | Step 7 |
| Table captions above | Yes | Step 7 |
| Figure captions below | Yes | Step 7 |
| Supervisor mode | Yes | Toggle component |
| APA 7th edition style | Yes | Style profile |
| Audit trail | Yes | Audit hook |

---

n addition to the current plan, enforce the following mandatory academic rules:

1️⃣ Separate Narrative per Output Type
For every Analysis Block:

Table Interpretation MUST be a standalone paragraph

Figure Interpretation MUST be a separate paragraph

Never merge table and figure interpretation into one narrative

2️⃣ Questionnaire Item Referencing
When variables originate from a questionnaire:

Narrative must explicitly reference item ranges (e.g., Q12–Q18)

Reliability sections must state number of items and construct name

Descriptive sections must reference scale origin

3️⃣ Assumption Narrative Writing (Academic)
In Step 6 writing engine:

Each inferential test must include a short academic paragraph stating:

Whether assumptions were met

Which assumption tests were used

Any corrective action (e.g., non-parametric switch)

These rules apply to all APA, Full Results, and Supervisor Mode outputs.                           ## Implementation Priority

**Week 1-2: Core Architecture**
1. Enhanced WizardState and database schema
2. Step 2 rebuild (Variable View with roles)
3. Step 3 rebuild (Hypothesis builder)

**Week 3-4: Analysis Engine**
4. Step 4 rebuild (Analysis blocks, guided UI)
5. Add missing statistical tests to backend

**Week 5-6: Results & Writing**
6. Step 5 rebuild (Per-block results, assumptions)
7. Step 6 enhance (Per-test writing logic)

**Week 7-8: Export & Polish**
8. Step 7 rebuild (Word/PDF generation)
9. Supervisor mode, audit trail
10. Testing and refinement

