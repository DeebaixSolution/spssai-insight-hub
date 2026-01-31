

## Summary

I identified 3 main issues:

1. **Export Report Failure**: The `generate-report` edge function has a bug where it tries to iterate over objects as if they were arrays (`for (const cell of row)` on object rows like `{ Variable: 'X', N: 10 }`)

2. **No Save Button Per Step**: Currently, data is only saved at specific transitions (Step 1→2, 4→5, 6→7). Users cannot manually save their progress.

3. **Cannot Resume Saved Analyses**: When users return to the Data Manager, there's no way to continue a previously saved analysis from where they left off.

---

## Implementation Plan

### Part 1: Fix Report Generation (Critical Bug)

**File: `supabase/functions/generate-report/index.ts`**

The bug is on lines 78-84. The results tables have rows as objects:
```typescript
// Current format from run-analysis:
rows: [{ Variable: 'X', N: 10, Mean: 5.2 }]

// But generateHTMLTable tries:
for (const cell of row) { ... }  // ERROR: row is an object, not iterable!
```

**Fix:** Change `generateHTMLTable` and `generateTableText` to iterate using headers:
```typescript
// Instead of: for (const cell of row)
// Use: for (const header of table.headers) { row[header] }
```

### Part 2: Add Save Button to Each Step

**File: `src/components/spss-editor/StepNavigation.tsx`**

Add a new "Save Progress" button between Previous and Next buttons.

**File: `src/pages/dashboard/NewAnalysis.tsx`**

Add a `handleSave` function that:
- Saves current step data to the database
- Shows a success toast
- Does NOT advance to next step

### Part 3: Enable Resume/Continue Saved Analyses

**File: `src/pages/dashboard/DataManager.tsx`**

Modify to show saved analyses with their current step:
- Add a new "Analyses" tab or section
- Show analyses with status (draft, configuring, completed)
- Add "Continue" button to resume from saved step

**File: `src/hooks/useAnalysisWizard.ts`**

Add a `loadAnalysis` function that:
- Fetches existing analysis by ID
- Populates all state fields
- Sets the correct step

**File: `src/pages/dashboard/NewAnalysis.tsx`**

- Check for `state.datasetId` passed via router location
- If an analysis exists, load it and resume from saved step

### Part 4: Fix Pro Plan Detection

The user mentioned they have Pro plan but something is cut off. I'll verify that `usePlanLimits` correctly reads the user's plan from the database.

---

## Technical Details

### 1. Fix generate-report Edge Function

```text
Lines to modify: 40-63 (generateTableText) and 65-89 (generateHTMLTable)

Current buggy code:
  for (const row of table.rows) {
    for (const cell of row) { ... }  // BUG!
  }

Fixed code:
  for (const row of table.rows) {
    for (const header of table.headers) {
      const cell = row[header];  // Access by key
      ...
    }
  }
```

### 2. StepNavigation Component Changes

```text
New props:
  - onSave: () => void
  - isSaving: boolean

New button (between Previous and Next):
  <Button variant="outline" onClick={onSave} disabled={isSaving}>
    <Save className="w-4 h-4 mr-2" />
    {isSaving ? 'Saving...' : 'Save Progress'}
  </Button>
```

### 3. NewAnalysis Page Changes

Add save handler:
```text
const handleSave = async () => {
  try {
    // If no project yet, create it first
    if (!state.projectId && state.parsedData) {
      const project = await createProject(state.projectName);
      await saveDataset({ projectId: project.id, parsedData: state.parsedData });
    }
    
    // Save current analysis state
    await saveAnalysis({
      currentStep: state.currentStep,
      analysisConfig: state.analysisConfig,
      results: state.results,
      aiInterpretation: state.aiInterpretation,
      apaResults: state.apaResults,
      discussion: state.discussion,
    });
    
    toast.success('Progress saved!');
  } catch (err) {
    toast.error('Failed to save progress');
  }
};
```

### 4. useAnalysisWizard Hook Changes

Add load function:
```text
const loadAnalysis = async (analysisId: string) => {
  const { data: analysis } = await supabase
    .from('analyses')
    .select('*, dataset:datasets(*), project:projects(*)')
    .eq('id', analysisId)
    .single();
    
  if (analysis) {
    // Parse raw_data from dataset
    // Load variables
    // Set all state fields
    updateState({
      currentStep: analysis.current_step,
      projectId: analysis.project_id,
      projectName: analysis.project?.name,
      datasetId: analysis.dataset_id,
      researchQuestion: analysis.research_question,
      ...
    });
  }
};
```

### 5. DataManager Analyses View

Add a section showing saved analyses:
```text
+--------------------------------------------------+
| My Analyses                              [View All]|
+--------------------------------------------------+
| Analysis Name      | Dataset    | Step | Status  |
|--------------------|------------|------|---------|
| Infant_Feeding...  | data.csv   | 5/7  | [Continue]|
| Study_Results      | survey.csv | 3/7  | [Continue]|
+--------------------------------------------------+
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/generate-report/index.ts` | Modify | Fix row iteration bug |
| `src/components/spss-editor/StepNavigation.tsx` | Modify | Add Save button |
| `src/pages/dashboard/NewAnalysis.tsx` | Modify | Add save handler, load existing analysis |
| `src/hooks/useAnalysisWizard.ts` | Modify | Add loadAnalysis function |
| `src/pages/dashboard/DataManager.tsx` | Modify | Add analyses section with Continue button |

---

## User Flow After Implementation

### Saving Progress
1. User is on any step
2. Clicks "Save Progress" button
3. Data is saved to database
4. Toast confirms save
5. User can leave and return later

### Resuming Analysis
1. User opens Data Manager
2. Sees saved analyses with step indicator
3. Clicks "Continue" on an analysis
4. Wizard opens at the saved step with all data restored

### Exporting Report (Fixed)
1. User reaches Step 7
2. Configures export options
3. Clicks "Download Report"
4. Report generates successfully with all tables
5. File downloads to browser

