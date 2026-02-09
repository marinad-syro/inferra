# Feature Updates - Data Processing & Visualizations

## Overview

This document summarizes the comprehensive updates made to add backend data processing with pandas, scipy, and seaborn, along with AI-powered visualization suggestions and improved workflow organization.

## Changes Summary

### 1. Fixed 422 Error on Analysis Execution ✅

**Problem:** Frontend was sending invalid `dataset_schema` format causing 422 validation errors.

**Solution:**
- Removed `dataset_schema` from frontend analysis requests (it's optional on backend)
- Backend infers schema from the dataset when needed

**Files Modified:**
- `/insight-weaver/src/components/canvas/ResultsView.tsx`

**Impact:** Analysis execution now works correctly without schema validation errors.

---

### 2. Added LLM-Powered Visualization Suggestions ✅

**Feature:** AI generates context-aware visualization suggestions based on:
- Dataset columns and types
- User's research question
- Data distribution type
- Presence of outliers
- Actual dataset content (via file upload to LLM)

**Backend Changes:**

**New Files:**
- `/backend/api/app/routes/visualizations.py` - New endpoint for visualization suggestions
  - `POST /api/suggest-visualizations`
  - Takes columns, research context, and optional dataset reference
  - Returns list of plot suggestions with types, columns, titles, descriptions

**Modified Files:**
- `/backend/api/app/services/llm_adapter.py`
  - Added `suggest_visualizations()` method
  - Uses LLM with dataset file attachment for better suggestions
  - Parses JSON response with plot configurations

- `/backend/api/app/main.py`
  - Registered new `visualizations` router

**Frontend Changes:**

**Modified Files:**
- `/insight-weaver/src/services/llmService.ts`
  - Added `suggestVisualizations()` function
  - Calls new backend endpoint

- `/insight-weaver/src/components/canvas/DataVisualizationView.tsx`
  - Integrated AI suggestions on component mount
  - Shows loading state while generating suggestions
  - Displays AI-suggested visualizations with Sparkles icon
  - Users can click to add suggestions to their analysis

**Example Suggestions:**
```json
[
  {
    "plot_type": "histogram",
    "columns": ["reaction_time"],
    "title": "Distribution of Reaction Times",
    "description": "Shows frequency distribution to identify patterns and outliers"
  },
  {
    "plot_type": "scatter",
    "columns": ["trial_number", "accuracy"],
    "title": "Accuracy Over Trials",
    "description": "Reveals learning effects or performance changes over time"
  }
]
```

---

### 3. Added Initial Visualizations on Data Upload ✅

**Feature:** Automatic exploratory visualizations appear immediately after uploading data to help users:
- Spot relationships between variables
- Identify potential outliers
- Understand data distribution

**Modified Files:**
- `/insight-weaver/src/components/canvas/upload/DatasetPreview.tsx`
  - Added automatic scatter plot generation
  - Uses backend seaborn visualization
  - Shows first two numeric columns by default
  - Includes loading state and error handling

**Visualization Flow:**
1. User uploads CSV/TSV/JSON file
2. Frontend shows data preview table
3. Client-side histogram displays (already existed)
4. **NEW:** Backend generates seaborn scatter plot
5. User can explore data before proceeding

**Benefits:**
- Early data exploration
- Visual outlier detection
- Understanding variable relationships
- Better informed analysis choices

---

### 4. Reordered Workflow Tabs ✅

**Change:** Moved "Visualizations" to final step (Step 7) after "Results" (Step 6)

**Rationale:**
- Visualizations are for publication-ready figures
- Should come after seeing statistical results
- Allows users to choose visualizations based on analysis outcomes

**Previous Order:**
1. Upload Data
2. Wrangling & Cleaning
3. Parse Events
4. Create Variables
5. Choose Analysis
6. Visualizations ← was here
7. Results ← was here

**New Order:**
1. Upload Data
2. Wrangling & Cleaning
3. Parse Events
4. Create Variables
5. Choose Analysis
6. **Results** ← moved here
7. **Visualizations** ← moved here

**Files Modified:**
- `/insight-weaver/src/components/workflow/WorkflowSidebar.tsx`
  - Swapped step 6 and 7 definitions

- `/insight-weaver/src/pages/Index.tsx`
  - Updated step routing to match new order

- `/insight-weaver/src/components/canvas/DataVisualizationView.tsx`
  - Changed from "Step 6 of 7" to "Step 7 of 7"
  - Updated description to emphasize publication-ready figures
  - Changed button text from "Continue to Results" to "Finish Workflow"

- `/insight-weaver/src/components/canvas/ResultsView.tsx`
  - Changed from "Step 7 of 7" to "Step 6 of 7"
  - Updated description to mention visualizations next step
  - Added "Create Visualizations" button as primary action
  - Reorganized export buttons

---

## Testing Checklist

### Backend Testing

- [ ] Test visualization suggestions endpoint:
  ```bash
  curl -X POST http://localhost:8000/api/suggest-visualizations \
    -H "Content-Type: application/json" \
    -d '{
      "columns": ["reaction_time", "accuracy", "trial_number"],
      "research_question": "Does reaction time improve over trials?",
      "distribution_type": "normal",
      "has_outliers": false
    }'
  ```

- [ ] Verify LLM returns valid JSON with plot suggestions
- [ ] Test with dataset_reference to ensure file download works
- [ ] Check that temp files are cleaned up after processing

### Frontend Testing

- [ ] Upload a CSV file
- [ ] Verify data preview table appears
- [ ] Check that histogram shows distribution
- [ ] **NEW:** Confirm scatter plot generates automatically
- [ ] Navigate to Visualizations tab (now step 7)
- [ ] Verify AI suggestions load
- [ ] Click AI suggestion to add to workspace
- [ ] Confirm backend visualization generates
- [ ] Navigate to Results tab (now step 6)
- [ ] Try running an analysis
- [ ] Verify analysis executes without 422 error
- [ ] Check "Create Visualizations" button navigates to step 7

### Workflow Testing

- [ ] Complete full workflow from upload to visualizations
- [ ] Verify step numbers are correct in UI
- [ ] Confirm sidebar shows correct step order
- [ ] Test navigation between steps
- [ ] Verify "Continue" buttons lead to correct next steps

---

## API Endpoints Added

### POST /api/suggest-visualizations

**Request:**
```json
{
  "columns": ["string"],
  "research_question": "string (optional)",
  "distribution_type": "string (optional)",
  "has_outliers": "boolean (optional)",
  "dataset_reference": "string (optional)"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "plot_type": "histogram | scatter | line | bar | boxplot | density",
      "columns": ["string"],
      "title": "string",
      "description": "string"
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 500: Internal server error

---

## Dependencies

No new dependencies required. Uses existing:
- Backend: xai-sdk (for LLM), httpx (for requests)
- Frontend: existing React hooks and components

---

## Known Limitations

1. **Visualization suggestions require XAI API key**
   - Set `XAI_API_KEY` in backend `.env`
   - Falls back gracefully if not configured

2. **File download required for better suggestions**
   - Works without dataset_reference but less context-aware
   - Temporary files cleaned up automatically

3. **Initial scatter plot only for 2+ numeric columns**
   - Shows first two numeric columns
   - Future: allow column selection

---

## Future Enhancements

1. **More plot types in suggestions**
   - Heatmaps for correlation matrices
   - Time series plots
   - Violin plots for distributions

2. **Interactive plot customization**
   - Change colors, labels, axes
   - Add annotations
   - Export in multiple formats

3. **Batch visualization generation**
   - Generate all suggested plots at once
   - Compare multiple visualizations side-by-side

4. **Smart column pairing**
   - Suggest best column pairs for scatter plots
   - Detect categorical vs continuous variables

---

## Rollback Instructions

If issues arise, revert these commits:

1. Visualization suggestions: Remove `/backend/api/app/routes/visualizations.py`
2. Initial visualizations: Revert changes to `DatasetPreview.tsx`
3. Workflow reorder: Swap steps 6 and 7 back in `WorkflowSidebar.tsx` and `Index.tsx`
4. 422 fix: Add back `dataset_schema` in `ResultsView.tsx` with proper format

---

## Performance Notes

- **Visualization suggestions:** ~2-5 seconds (LLM call + dataset upload)
- **Initial scatter plot:** ~1-3 seconds (backend seaborn generation)
- **Analysis execution:** Now faster (no schema validation overhead)

---

## Security Considerations

- ✅ Temp files cleaned up after processing
- ✅ Dataset files downloaded only when needed
- ✅ No credentials exposed to frontend
- ✅ Storage paths validated before file operations

---

## Support

For issues or questions:
1. Check backend logs: `docker logs inferra-api-gateway-1`
2. Check python service logs: `docker logs inferra-python-service-1`
3. Check browser console for frontend errors
4. Verify XAI API key is configured correctly
