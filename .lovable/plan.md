

# Comprehensive Fix Plan: Steps 2, 3, 4-10, 11, 12, 13 + Persistence + AI Assistant

## Issues Identified

### Critical Bug: Database Constraint Blocks Saving (Steps 8-13)
The `analyses_current_step_check` constraint limits `current_step` to values 1-7. This causes "failed to save progress" errors in Steps 8 (Correlation), 9 (Regression), and all subsequent steps. This single constraint is the root cause of multiple reported failures.

### Issue List Summary
| # | Issue | Root Cause |
|---|-------|-----------|
| 1 | Step 2: AI Detect doesn't assign role/measure/values properly | `detect-variables` edge function doesn't return `role` or `valueLabels`; scale grouping only manual |
| 2 | Step 3a: No "Generate Research Questions" button | Missing feature |
| 3 | Step 3b: Only 3 hypotheses generated; no numbering control | AI generates fixed count; no quantity input |
| 4 | Step 3c: Hypothesis doesn't auto-show DV/IV selectors | DV/IV selectors exist in HypothesisCard but not pre-populated by AI |
| 5 | Steps 4-10: No "SPSS Brain Analysis" one-click button | Missing feature |
| 6 | Step 8: "Failed to save progress" | `current_step` constraint blocks saving beyond step 7 |
| 7 | Step 9: "Failed to save progress" | Same constraint issue |
| 8 | Step 11: Chapter 4 generation missing tables/charts from prior steps | `generate-chapter4` only receives block metadata, not actual result tables |
| 9 | Step 11: No per-section regenerate button | Missing feature |
| 10 | Step 12: Chapter 5 sections not saved/generated properly | `section_mapping` not saved; missing per-section AI button |
| 11 | Step 13: Download produces nothing visible | `generate-thesis-doc` returns plain text, not actual .docx binary |
| 12 | Note 1: Analysis not persisted when closing and returning | `saveAnalysis` hits constraint; auto-save not triggered |
| 13 | Note 2: No AI assistant guidance across steps | Missing feature |

---

## Phase 1: Database Migration (Fixes Issues 6, 7, 12)

**Update the `analyses_current_step_check` constraint** to allow steps 1-13:

```sql
ALTER TABLE analyses DROP CONSTRAINT analyses_current_step_check;
ALTER TABLE analyses ADD CONSTRAINT analyses_current_step_check CHECK (current_step >= 1 AND current_step <= 13);
```

This single fix resolves:
- Step 8 correlation "failed to save"
- Step 9 regression "failed to save"
- All step persistence beyond step 7

---

## Phase 2: Step 2 -- Enhanced AI Detection (Issue 1)

**File: `supabase/functions/detect-variables/index.ts`**
- Update the prompt to also return `role` (dependent/independent/demographic/scale_item/id) and detect scale item patterns (e.g., Q1, Q2... or Likert items) and group them with a `scaleGroup` name.
- Return: `{name, type, label, role, scaleGroup, valueLabels}`

**File: `src/components/spss-editor/Step2Variables.tsx`**
- Add a new button: "AI Detect and Group" that calls the enhanced detect-variables function, assigns roles, measures, value labels, AND auto-groups scale items.
- Keep existing "Group Scale Items" button as the manual option.
- Remove the PRO gate from the AI Detect button (make it available to all users).
- After AI detection, apply detected `role`, `measure`, `valueLabels`, and `scaleGroup` to each variable.

---

## Phase 3: Step 3 -- Research Question Generator + Hypothesis Improvements (Issues 2, 3, 4)

**3a -- Research Question Generator**

**File: `src/components/spss-editor/Step3Research.tsx`**
- Add a "Generate Research Questions" button below the textarea.
- When clicked, call `suggest-analysis` edge function with the variable list and get back 3 research question suggestions.
- Display as selectable cards; clicking one fills the textarea.

**File: `supabase/functions/suggest-analysis/index.ts`**
- Add a `mode: 'research-questions'` option that returns 3 research question suggestions based on variables.

**3b -- Hypothesis Count Control**

**File: `src/components/spss-editor/Step3Research.tsx`**
- Add a number input (1-10) before the "AI Suggest Hypotheses" button to control how many hypotheses to generate.
- Pass the count to the edge function.
- Each generated hypothesis gets a sequential number (H1, H2, H3...).

**3c -- Auto DV/IV Selection on Generation**

**File: `src/components/spss-editor/Step3Research.tsx`**
- Update `applySuggestion` to auto-populate `dependentVariables` and `independentVariables` from the AI response.
- Update `suggest-analysis` edge function to return `suggestedDV` and `suggestedIV` fields matching actual variable names.

**File: `src/components/spss-editor/HypothesisCard.tsx`**
- When hypothesis is created from AI, auto-expand the card and highlight the DV/IV dropdowns.

---

## Phase 4: SPSS Brain Analysis Button (Issue 5)

**File: `src/components/spss-editor/StatisticalAnalysisCenter.tsx`**
- Add a prominent "SPSS Brain Analysis" button at the top of the Statistical Analysis Center (Layer 2).
- When clicked, it runs a sequence:
  1. Step 4: Auto-run descriptive stats and normality for all scale variables.
  2. Step 5/6: Based on hypotheses and normality results, auto-select and run appropriate parametric or non-parametric tests.
  3. Step 7: If multi-factor design detected, auto-run ANOVA/GLM.
  4. Step 8: Auto-run correlation matrix for all scale variables.
  5. Step 9: If prediction hypothesis exists, auto-run regression.
  6. Step 10: If scale items exist, auto-run reliability analysis.
- Show a progress indicator while running.
- All results saved to `analysis_blocks`.
- Manual step access remains unchanged -- user can still go to each step individually.

**New file: `src/hooks/useSpssAutoPilot.ts`**
- Contains the orchestration logic for the auto-pilot sequence.
- Calls `run-analysis` edge function sequentially for each step.
- Tracks progress and errors.

---

## Phase 5: Step 11 -- Chapter 4 with Real Tables (Issues 8, 9)

**File: `supabase/functions/generate-chapter4/index.ts`**
- Enhance the prompt to include actual statistical values from `analysis_blocks.results`.
- For each section, include the real tables (means, SD, F-values, p-values, etc.) so the AI references them correctly.
- Return structured content with embedded table references.

**File: `src/components/spss-editor/Step11AcademicResults.tsx`**
- Add a "Regenerate" button per section (not just global regenerate).
- For each section, display the actual SPSS-style tables from `analysis_blocks` inline (descriptive tables, correlation matrices, regression coefficients, etc.).
- Show the AI interpretation text below each table.
- Tables are rendered using the existing `.spss-table-academic` CSS class.
- Section layout: Table first, then interpretation paragraph.

---

## Phase 6: Step 12 -- Chapter 5 Fix (Issue 10)

**File: `src/components/spss-editor/Step12Theoretical.tsx`**
- Save `section_mapping` as a proper JSON object when saving (currently missing from the save record).
- Add per-section "AI Generate" button that regenerates only that section.
- Add "AI Autofill Theory" button in the theory tab that suggests a theoretical framework based on variables and research question.

**File: `src/components/spss-editor/Step12Theoretical.tsx` (handleSave)**
- Add `section_mapping: sections as any` to the save record so sections are persisted individually.

---

## Phase 7: Step 13 -- Working Download (Issue 11)

**File: `supabase/functions/generate-thesis-doc/index.ts`**
- Currently returns plain text. Needs to generate actual downloadable content.
- Format the text as structured HTML that can be converted to a .docx Blob on the client side.
- Include all tables from `analysis_blocks` in the document body.
- Include chapter headings, section numbers, and APA formatting.

**File: `src/components/spss-editor/Step13ThesisBinder.tsx`**
- Fix the download handler to properly create a downloadable .docx file.
- Use the edge function response to create a Blob with proper MIME type.
- For Word export: generate HTML-based .doc file (simpler than full OOXML).
- Include tables, interpretation text, and references in the download.

---

## Phase 8: Auto-Save and Persistence (Issue 12)

**File: `src/pages/dashboard/NewAnalysis.tsx`**
- Add auto-save on step transitions (when user navigates between steps, auto-save current state).
- Add periodic auto-save every 60 seconds if changes detected.
- Save analysis state including all variables, hypotheses, and current step.

**File: `src/hooks/useAnalysisWizard.ts`**
- Fix `saveAnalysis` to cap `current_step` at 13 (now valid after constraint fix).
- Update status mapping: step >= 11 should be 'completed' or 'reviewing'.

---

## Phase 9: AI Assistant Guidance (Issue 13)

**New file: `src/components/spss-editor/AIAssistantPanel.tsx`**
- A floating or sidebar panel that provides contextual guidance at each step.
- Shows as a pulsing light/indicator on important steps.
- Displays tips like:
  - Step 1: "Upload your SPSS, Excel, or CSV file"
  - Step 2: "Assign roles (DV/IV) to your variables for better test recommendations"
  - Step 4: "Check normality before running parametric tests"
  - Step 8: "Strong correlations (r > .70) may indicate multicollinearity"
- Collapsible panel with a lightbulb icon.
- Each step has 2-3 contextual tips stored as static content (no AI call needed).

**File: `src/pages/dashboard/NewAnalysis.tsx`**
- Integrate the AIAssistantPanel, showing relevant tips based on `state.currentStep`.

---

## Implementation Order

| Order | Task | Files Changed |
|-------|------|--------------|
| 1 | DB Migration: update step constraint to 1-13 | Migration SQL |
| 2 | Step 2: Enhanced AI detection with roles + scale grouping | `detect-variables/index.ts`, `Step2Variables.tsx` |
| 3 | Step 3: Research question generator + hypothesis improvements | `suggest-analysis/index.ts`, `Step3Research.tsx`, `HypothesisCard.tsx` |
| 4 | Step 12: Fix section_mapping save + per-section AI buttons | `Step12Theoretical.tsx` |
| 5 | Step 11: Add real tables inline + per-section regenerate | `generate-chapter4/index.ts`, `Step11AcademicResults.tsx` |
| 6 | Step 13: Fix download to produce real .doc file | `generate-thesis-doc/index.ts`, `Step13ThesisBinder.tsx` |
| 7 | Auto-save + persistence | `NewAnalysis.tsx`, `useAnalysisWizard.ts` |
| 8 | SPSS Brain Analysis auto-pilot button | `StatisticalAnalysisCenter.tsx`, new `useSpssAutoPilot.ts` |
| 9 | AI Assistant guidance panel | New `AIAssistantPanel.tsx`, `NewAnalysis.tsx` |

---

## Technical Notes

- The constraint fix (Phase 1) is the highest priority -- it unblocks saving for Steps 8-13.
- The `generate-thesis-doc` edge function currently returns plain text strings, not binary file data. The fix will use HTML-to-doc approach (HTML with Word-compatible XML namespace).
- All edge function changes will be deployed automatically after code changes.
- No new database tables needed -- all fixes use existing schema.

