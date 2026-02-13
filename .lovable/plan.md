

# Upgrade Plan: Research Design Intelligence (Steps 1-3) + Academic Production (Steps 11-13)

This plan covers two major issues: strengthening Steps 1-3 with academic SPSS-level intelligence, and building out Steps 11-13 from placeholders into fully functional engines.

---

## Current State

**Steps 1-3:** Basic functionality exists -- file upload with type/size validation, a Variable View with role/measure assignment and AI detection, and a Research step with hypothesis cards and AI suggestions. No data quality validation, no statistical decision engine, no automatic H0/H1 generation.

**Steps 11-13:** All three are placeholder components showing "Coming in Phase X" text. No actual logic, no database tables, no export capability.

---

## ISSUE 1: Research Design Intelligence (Steps 1-3)

### Step 1 -- Data Quality Intelligence Layer

**What changes:** After file parsing succeeds, automatically run a data quality scan and display a collapsible "Data Quality Summary" panel below the file preview.

**File:** `src/components/spss-editor/Step1Upload.tsx`

New sub-component: `src/components/spss-editor/DataQualitySummary.tsx`

**Intelligence computed (client-side, deterministic):**
- Header validation: detect empty headers, duplicate names, special characters
- Missing values: count and percentage per variable
- Data type detection: continuous, ordinal, binary, count (based on unique value analysis)
- Duplicate row detection (exact match count)
- Basic outlier flags: IQR method for numeric columns, flag count per variable
- Overall data quality score (Good / Needs Attention / Issues Found)

**UI:** A summary panel with 4 mini-cards (Missing Values, Duplicates, Outliers, Type Consistency) plus a collapsible detail table. No extra screen -- appears inline after upload.

**Progression gate:** Warns but does not block if issues are found. Displays a yellow/red badge on the Data Quality panel.

---

### Step 2 -- Variable Intelligence + Scale Logic Control

**What changes:** Enhance the existing Variable View with academic validation logic.

**Files:**
- `src/components/spss-editor/Step2Variables.tsx` (modify)
- `src/components/spss-editor/VariableIntelligencePanel.tsx` (new)

**Enhancements:**
1. **Enhanced AI classification** -- Extend the `detect-variables` edge function to return granular types: Continuous, Binary, Count, Likert, Categorical (in addition to scale/ordinal/nominal mapping)
2. **Scale grouping validation** -- Enforce minimum 2 items for scale groups (already exists in `saveScaleGroup`). Add: if scale items grouped, auto-trigger Cronbach's Alpha check via edge function. If alpha < 0.60, show red warning badge on the scale group.
3. **DV/IV consistency enforcement** -- Validate: at least 1 DV assigned before proceeding, warn if DV and IV are the same variable, warn if DV is nominal for parametric-oriented hypotheses
4. **Confidence indicator** -- Show a colored dot (green/yellow/red) next to each variable's detected type, based on detection confidence (high = >90% of values match, medium = 70-90%, low = <70%)

**Edge function update:** `supabase/functions/detect-variables/index.ts` -- extend prompt to return confidence scores and granular sub-types.

---

### Step 3 -- Statistical Decision Engine

**What changes:** Transform from a simple hypothesis input form into an academic statistical decision engine.

**Files:**
- `src/components/spss-editor/Step3Research.tsx` (major rewrite)
- `src/components/spss-editor/HypothesisCard.tsx` (enhance)
- `src/components/spss-editor/StatisticalDecisionEngine.tsx` (new)

**Enhancements:**

1. **Decision engine before test suggestion:**
   - Evaluate DV type (scale/nominal/ordinal)
   - Count IV groups (from unique values or value labels)
   - Check sample size per group
   - Determine assumption requirements
   - Decision logic: if parametric assumptions likely satisfied, recommend parametric; otherwise recommend non-parametric alternative

2. **Auto-generated hypothesis components per HypothesisCard:**
   - H0 statement (auto-generated from H1 using templates)
   - H1 statement (user-entered, becomes the basis)
   - Direction selector (two-tailed default, one-tailed option)
   - Required assumptions list (auto-populated based on recommended test)
   - Effect size declaration (small/medium/large expected)
   - Post-hoc requirement flag (if 3+ groups detected)

3. **Progression gate:** Block "Next" if no valid hypothesis is added. Show validation panel listing what is missing.

4. **Statistical recommendation panel:** For each hypothesis, show the recommended test with reasoning chain (e.g., "DV is scale + IV has 2 groups + normality likely = Independent T-Test recommended").

---

## ISSUE 2: Academic Production (Steps 11-13)

### Current State of Steps 11-13

All three are empty placeholder components with just an icon and "Coming in Phase X" text. No database tables exist for chapter storage, citations, or exports.

---

### Database Migrations Required

**New tables:**

1. `chapter_results` -- Stores generated Chapter 4 content
   - id (uuid, PK), analysis_id (uuid, FK), full_text (text), section_mapping (jsonb), version (int default 1), created_at, updated_at

2. `discussion_chapter` -- Stores generated Chapter 5 content
   - id (uuid, PK), analysis_id (uuid, FK), chapter5_text (text), mode (text: free/pro), theory_input (jsonb), citations_used (jsonb), version (int default 1), created_at, updated_at

3. `citations` -- Reference management
   - id (uuid, PK), analysis_id (uuid), author (text), year (text), title (text), journal (text), doi (text), formatted_reference (text), created_at

4. `thesis_exports` -- Export tracking
   - id (uuid, PK), analysis_id (uuid), user_id (uuid), export_type (text), version (int), file_url (text), created_at

All tables will have RLS policies scoped through analyses -> projects -> user_id chain.

---

### Step 11 -- Academic Results Generator (Chapter 4)

**File:** `src/components/spss-editor/Step11AcademicResults.tsx` (full rewrite)

**5 Internal Engines (all client-side aggregation + AI formatting via edge function):**

1. **Results Aggregation Engine** -- Fetch all `analysis_blocks`, `hypotheses`, assumption results from database. No recalculation.

2. **Structured Chapter Constructor** -- Build sections 4.1 through 4.10 (Sample Description, Measurement Model, Descriptive Statistics, Reliability, Correlation, Regression, Hypothesis Testing, Diagnostics, Integrated Findings, Summary). Map analysis blocks to sections by test_category.

3. **Table and Figure Insertion Engine** -- Auto-number all tables and figures. Insert under correct sections. Render from stored JSON data.

4. **Academic Writing Engine** -- Edge function `generate-chapter4` that takes aggregated results and produces formal APA-7 narrative per section. Template-based for statistics, AI for connecting prose.

5. **Integrated Intelligence Layer** -- Cross-reference descriptive to inferential, reliability to regression, correlation to regression strength. Generate connecting paragraphs.

**UI Components:**
- Overview panel showing saved status per analysis step
- "Generate Chapter 4" button
- Rich text preview (read-only with edit toggle)
- Export Word / Save Draft buttons

**Edge function:** `supabase/functions/generate-chapter4/index.ts`

---

### Step 12 -- Theoretical Intelligence Engine (Chapter 5)

**File:** `src/components/spss-editor/Step12Theoretical.tsx` (full rewrite)

**6 Internal Engines:**

1. **Findings Synthesis** -- Summarize supported/rejected hypotheses, strongest predictors, model power
2. **Theoretical Integration** -- Free mode: simplified interpretation. PRO mode: user inputs theory name, description, prior references; AI connects findings to theory
3. **Citation System** -- APA-7 in-text citation formatting, reference list generation, manual citation entry (PRO)
4. **Unexpected Results Analyzer** -- Auto-detect rejected hypotheses, weak effects, low R-squared; generate academic explanations
5. **Practical Implications** -- Translate findings to actionable recommendations
6. **Limitations and Future Research** -- Auto-generate based on sample size, design type, model limitations

**UI Components:**
- Mode selector (Free / PRO)
- Theory input panel (PRO only): theory name, description, key constructs, references
- "Generate Chapter 5" button
- Editable rich text editor with locked structure
- Advisory intelligence panel (strength/weakness indicators)

**Edge function:** `supabase/functions/generate-chapter5/index.ts`

---

### Step 13 -- Thesis Binder

**File:** `src/components/spss-editor/Step13ThesisBinder.tsx` (full rewrite)

**Engines:**
1. **Data Aggregation** -- Fetch chapter_results + discussion_chapter + citations
2. **Document Structure** -- Title page, TOC, List of Tables, List of Figures, Chapter 4, Chapter 5, References
3. **Professional Formatting** -- Times New Roman 12pt, 1.5/2.0 spacing, 1-inch margins, auto page numbering
4. **Table/Figure Injection** -- Insert all stored tables and figures with captions and auto-numbering
5. **Citation Integration** -- Insert reference list in APA-7 format (PRO only)

**Free vs PRO:**
- Free: Partial export, watermark footer, no PDF
- PRO: Full export, no watermark, PDF enabled, full references

**UI:** Preview panel, Export Word button, Export PDF button (PRO), Save metadata to thesis_exports table

**Edge function:** `supabase/functions/generate-thesis-doc/index.ts` (Word/PDF generation)

---

## Technical Details

### Files to Create (New)
| File | Purpose |
|------|---------|
| `src/components/spss-editor/DataQualitySummary.tsx` | Data quality panel for Step 1 |
| `src/components/spss-editor/VariableIntelligencePanel.tsx` | Confidence indicators and validation for Step 2 |
| `src/components/spss-editor/StatisticalDecisionEngine.tsx` | Decision logic for Step 3 |
| `supabase/functions/generate-chapter4/index.ts` | AI chapter 4 generation |
| `supabase/functions/generate-chapter5/index.ts` | AI chapter 5 generation |
| `supabase/functions/generate-thesis-doc/index.ts` | Document compilation and export |

### Files to Modify
| File | Changes |
|------|---------|
| `src/components/spss-editor/Step1Upload.tsx` | Add DataQualitySummary after file preview |
| `src/components/spss-editor/Step2Variables.tsx` | Add confidence indicators, scale validation, DV/IV consistency checks |
| `src/components/spss-editor/Step3Research.tsx` | Integrate StatisticalDecisionEngine, auto H0 generation, progression gate |
| `src/components/spss-editor/HypothesisCard.tsx` | Add H0 field, direction selector, assumptions list, effect size declaration |
| `src/components/spss-editor/Step11AcademicResults.tsx` | Full rewrite from placeholder |
| `src/components/spss-editor/Step12Theoretical.tsx` | Full rewrite from placeholder |
| `src/components/spss-editor/Step13ThesisBinder.tsx` | Full rewrite from placeholder |
| `supabase/functions/detect-variables/index.ts` | Add confidence scores and granular sub-types |
| `src/pages/dashboard/NewAnalysis.tsx` | Update Step 3 progression gate, pass new props to Steps 11-13 |
| `src/hooks/useAnalysisWizard.ts` | Add chapter/citation state management |
| `supabase/config.toml` | Register new edge functions |

### Database Migration
One migration creating 4 new tables: `chapter_results`, `discussion_chapter`, `citations`, `thesis_exports` with appropriate RLS policies.

### Implementation Order
1. Database migration (4 new tables)
2. Step 1 Data Quality Summary (client-side, no backend)
3. Step 2 Variable Intelligence (enhance detect-variables edge function + client validation)
4. Step 3 Statistical Decision Engine (client-side decision logic + HypothesisCard enhancements)
5. Step 11 Academic Results Generator (edge function + full UI)
6. Step 12 Theoretical Intelligence Engine (edge function + full UI)
7. Step 13 Thesis Binder (edge function + full UI)

