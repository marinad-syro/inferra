

# Plan: AI-Powered Data Analysis Enhancements

## Overview

This plan implements several enhancements to make the analysis workflow more intelligent and data-driven. The key changes include adding data visualization options, metadata collection, AI-powered variable suggestions, and dynamic analysis recommendations.

---

## Changes Summary

### 1. Upload Data View Enhancements

**Add Data Visualization Options**
- Add a visualization section after file upload with histogram/distribution plots
- Let users select which column to visualize from a dropdown
- Use the recharts library (already installed) to render histograms and bar charts

**Add Research Metadata Collection**
- Add an expandable "Study Information" card with fields for:
  - Research question (text area)
  - Data distribution assumption (dropdown: Normal, Non-normal, Unknown)
  - Known outliers (yes/no toggle with optional description)
  - Additional notes (text area)

**Database Update**
- Add new columns to `workflow_sessions` table:
  - `research_question` (text, nullable)
  - `distribution_type` (text, nullable - "normal", "non_normal", "unknown")
  - `has_outliers` (boolean, nullable)
  - `outlier_notes` (text, nullable)

### 2. Trial Structure (Parse Events) Improvements

**Handle Zero Trials**
- When 0 trials are detected, show "No trials detected" message
- Clear the dropdown selections (show placeholder "Select event..." instead of default values)
- Display a helpful message: "This appears to be a non-trial experiment. You can skip trial structure or select events manually."

### 3. Create Variables - AI-Powered Suggestions

**Empty State**
- Start with an empty variables list (remove hardcoded defaults)
- Show a prominent "Generate Suggestions" button

**AI Variable Derivation**
- Create an edge function `suggest-variables` that:
  - Receives sample data rows (first 20-30 rows)
  - Uses Lovable AI to analyze column names and values
  - Returns suggested derived variables with formulas
- Display AI suggestions as cards that users can accept or modify

### 4. Data Quality View Adjustments

**Conditional Trial Count**
- Hide the "Trial Count" check when `trials_detected` is 0 or null
- Adjust the summary grid to show only relevant metrics

### 5. Choose Analysis - AI-Powered Recommendations

**Dynamic Analysis Suggestions**
- Create an edge function `suggest-analyses` that:
  - Receives: research question, data columns, trial structure, derived variables
  - Uses Lovable AI to recommend 4 appropriate analysis methods
  - Returns analysis suggestions with explanations of why each fits
- Replace the static analysis options with AI-generated recommendations

**Database Update**
- Modify `analysis_selections` to store the full analysis info:
  - Add `title` (text)
  - Add `description` (text)
  - Add `complexity` (text)
  - Add `reasoning` (text) - why the AI suggested this

---

## Technical Implementation

### New Edge Functions

```text
supabase/functions/
├── suggest-variables/
│   └── index.ts      # AI-powered variable suggestion
└── suggest-analyses/
    └── index.ts      # AI-powered analysis recommendation
```

Both functions will use the Lovable AI API with the `LOVABLE_API_KEY` secret (already available).

### Database Migration

New columns for `workflow_sessions`:
- `research_question` text
- `distribution_type` text
- `has_outliers` boolean
- `outlier_notes` text

New columns for `analysis_selections`:
- `title` text
- `description` text  
- `complexity` text
- `reasoning` text

### Updated Hooks

**useWorkflowSession.ts**
- Add methods for updating research metadata

**useAnalysisSelections.ts**
- Modify to handle dynamic AI-suggested analyses instead of fixed types
- Add method to set AI-suggested analyses

### Updated Components

**UploadDataView.tsx**
- Add histogram visualization using recharts
- Add column selector dropdown
- Add "Study Information" expandable section with metadata fields

**TrialStructureCard.tsx**
- Add empty state handling
- Show "Select event..." placeholder when trials = 0
- Add "non-trial experiment" helper message

**CreateVariablesView.tsx**
- Remove default variables, start empty
- Add "Generate AI Suggestions" button
- Show loading state during AI generation
- Display AI suggestions with accept/edit/reject options

**DataQualityView.tsx**
- Conditionally render trial count check
- Adjust layout when trial-related checks are hidden

**ChooseAnalysisView.tsx**
- Add "Generate Recommendations" button
- Replace static options with dynamic AI suggestions
- Show reasoning for each recommendation

---

## Data Flow

```text
1. Upload Data
   ├── Parse file → parsedData
   ├── Show histogram visualization
   └── Collect research metadata → workflow_sessions

2. Parse Events
   ├── Detect event types
   ├── If trials = 0 → Show "non-trial" message, clear defaults
   └── Count trials → trial_structures

3. Create Variables
   ├── Start empty
   ├── "Generate Suggestions" → Edge function → AI
   └── User accepts/modifies suggestions → derived_variables

4. Check Data Quality
   └── Conditionally show trial-related checks

5. Choose Analysis
   ├── "Generate Recommendations" → Edge function → AI
   ├── AI considers: research question, data structure, variables
   └── User selects from AI recommendations → analysis_selections
```

---

## User Experience

1. **Upload Data**: User uploads file, sees a histogram of any numeric column, and can describe their research question and data characteristics

2. **Parse Events**: If no trials detected, the UI gracefully handles this case with helpful messaging rather than showing incorrect defaults

3. **Create Variables**: Empty slate until user clicks "Generate Suggestions" - AI analyzes actual data to propose meaningful variables

4. **Check Data Quality**: Only shows relevant quality checks based on the data type (trial vs non-trial)

5. **Choose Analysis**: AI recommends analyses tailored to the specific research question and data structure, with explanations

---

## Files to Create

1. `supabase/functions/suggest-variables/index.ts`
2. `supabase/functions/suggest-analyses/index.ts`

## Files to Modify

1. `src/components/canvas/UploadDataView.tsx` - visualization + metadata
2. `src/components/canvas/TrialStructureCard.tsx` - empty state handling
3. `src/components/canvas/CreateVariablesView.tsx` - AI suggestions
4. `src/components/canvas/DataQualityView.tsx` - conditional checks
5. `src/components/canvas/ChooseAnalysisView.tsx` - dynamic AI analyses
6. `src/hooks/useWorkflowSession.ts` - metadata methods
7. `src/hooks/useAnalysisSelections.ts` - dynamic analysis support
8. `src/contexts/WorkflowContext.tsx` - expose new methods

## Database Migration

- Add columns to `workflow_sessions` and `analysis_selections` tables

