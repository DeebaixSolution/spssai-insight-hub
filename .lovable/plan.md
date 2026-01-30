

## Summary of Issues Found

### Issue 1: Export Report Failed (Step 7)
The `Step7Export` component tries to call an edge function called `generate-report`, but **this function does not exist**. The `supabase/functions` directory only contains:
- ai-chat
- check-assumptions
- check-subscription
- create-checkout
- customer-portal
- detect-variables
- interpret-results
- run-analysis
- suggest-analysis

When users click "Download Report", the call to `supabase.functions.invoke('generate-report')` fails because the function is not implemented.

### Issue 2: No File Save in Data Manager
Currently, datasets are only saved to the database during the **New Analysis workflow** (Step 1 → Step 2 transition). There is no way to:
1. Upload and save a dataset directly from the Data Manager
2. Resume a previous analysis from where you left off
3. View saved analyses and continue working on them

The Data Manager only shows existing datasets but has no upload functionality of its own.

---

## Implementation Plan

### Part 1: Create the `generate-report` Edge Function

Create a new edge function that generates downloadable reports.

**File: `supabase/functions/generate-report/index.ts`**

The function will:
- Accept report configuration (format, sections, content)
- Generate a plain text report with all sections formatted properly
- For Word/PDF: Generate a structured document using text formatting
- Return the content for client-side download (no external file storage needed)

**Sections to include:**
- Title Page (Project name, date, research question)
- Methods (Test type, variables used)
- Results (Statistical tables in text format)
- Summary Interpretation
- APA Results (if Pro)
- Discussion (if Pro)

**Export approach:**
- For immediate MVP: Generate formatted text/HTML that can be downloaded
- The browser will handle the actual file download

**Config update: `supabase/config.toml`**
- Add `[functions.generate-report]` with `verify_jwt = false`

---

### Part 2: Add Dataset Upload to Data Manager

Modify the Data Manager to allow direct dataset uploads.

**File: `src/pages/dashboard/DataManager.tsx`**

Add:
1. **Upload Dialog** - A modal with:
   - Project name input (creates a new project)
   - File upload zone (CSV, Excel, SPSS)
   - Data preview before saving
   
2. **Save to Database** - Reuse the same logic from `useAnalysisWizard`:
   - Create project
   - Save dataset with `raw_data`
   - Auto-detect and save variables

---

### Part 3: Add Saved Analyses View

Allow users to continue previous analyses from where they left off.

**Modify: `src/pages/dashboard/DataManager.tsx` or create new component**

Add a section or tab showing:
- List of saved analyses with their current step
- "Continue" button to resume from the saved step
- Status indicator (draft, configuring, completed)

---

## Technical Details

### Generate Report Edge Function

```text
supabase/functions/generate-report/index.ts

Flow:
1. Receive: format, projectName, researchQuestion, results, aiInterpretation, apaResults, discussion, sections[]
2. Build formatted text document with:
   - Title: "[Project Name] - Analysis Report"
   - Date: Current date
   - Sections based on user selection
3. Return: { content: formattedText } for client download

For format handling:
- 'docx'/'pdf': Return HTML-formatted content that browser can print/save
- Content includes proper headings, tables in text format, spacing
```

### Data Manager Upload Enhancement

```text
New components/state in DataManager.tsx:

1. Add import for useDataParser hook
2. Add state:
   - isUploadOpen: boolean
   - uploadProjectName: string
   - uploadedFile: File | null
   - uploadedData: ParsedDataset | null
   - isUploading: boolean

3. Add Upload Dialog with:
   - Project name input
   - File drop zone (reuse pattern from Step1Upload)
   - Data preview (first 5 rows)
   - "Save Dataset" button

4. On save:
   - Create project in database
   - Insert dataset with raw_data
   - Auto-detect variables and insert them
   - Refresh dataset list
   - Close dialog with success toast
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/generate-report/index.ts` | Create | Report generation edge function |
| `supabase/config.toml` | Modify | Add generate-report function config |
| `src/pages/dashboard/DataManager.tsx` | Modify | Add upload dialog and save functionality |

---

## User Flow After Implementation

### Report Export (Fixed)
1. User completes analysis through Step 6
2. Goes to Step 7 (Export)
3. Selects format and sections
4. Clicks "Download Report"
5. `generate-report` function creates formatted content
6. Browser downloads the file

### Data Manager Upload (New)
1. User opens Data Manager
2. Clicks "Upload Dataset" button
3. Enters project name
4. Drops/selects file (CSV, Excel)
5. Previews data
6. Clicks "Save"
7. Dataset appears in list immediately
8. User can then "Open in Analysis" to continue

