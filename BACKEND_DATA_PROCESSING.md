# Backend Data Processing Implementation

## Summary

Implemented full pandas, seaborn, and scipy.stats processing in the backend with frontend integration.

## New Backend Endpoints

### 1. Compute Variables (`/api/compute-variables`)
**Location:** `/backend/api/app/routes/compute.py`

**Python Service:** `/backend/python-service/app/analyze.py` - `/compute-variables`

**What it does:**
- Evaluates formula strings using pandas `eval()`
- Adds new computed columns to the dataset
- Returns sample data showing the computed values

**Example Request:**
```json
{
  "dataset_reference": "/path/to/data.csv",
  "variables": [
    { "name": "rt_log", "formula": "log(rt)" },
    { "name": "accuracy_pct", "formula": "accuracy * 100" }
  ]
}
```

**Example Response:**
```json
{
  "status": "success",
  "new_columns": ["rt_log", "accuracy_pct"],
  "sample_data": [...]
}
```

### 2. Generate Visualizations (`/api/visualize`)
**Location:** `/backend/api/app/routes/compute.py`

**Python Service:** `/backend/python-service/app/analyze.py` - `/visualize`

**What it does:**
- Generates plots using seaborn/matplotlib
- Returns base64-encoded PNG images
- Supports multiple plot types

**Supported Plot Types:**
- `histogram` - Distribution with KDE overlay
- `scatter` - Scatter plot (with optional color grouping)
- `box` - Box plot by category
- `correlation` - Correlation heatmap
- `pairplot_preview` - Quick pairplot of numeric columns

**Example Request:**
```json
{
  "dataset_reference": "/path/to/data.csv",
  "plot_type": "histogram",
  "x_column": "rt"
}
```

**Example Response:**
```json
{
  "status": "success",
  "plot_base64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### 3. Run Analyses (`/api/run` - Enhanced)
**Location:** `/backend/api/app/routes/run.py`

**Python Service:** `/backend/python-service/app/analyze.py` - `/analyze`

**What it does:**
- Executes statistical analyses using scipy.stats and statsmodels
- Routes through decision service to determine appropriate test
- Returns statistical results and plots

**Supported Analyses:**
- **scipy.stats:**
  - `ttest_ind` - Independent t-test
  - `ttest_rel` - Paired t-test
  - `f_oneway` - One-way ANOVA
  - `pearsonr` - Pearson correlation
  - `spearmanr` - Spearman correlation
  
- **statsmodels:**
  - `ols` - Ordinary least squares regression

**Example Request:**
```json
{
  "dataset_reference": "/path/to/data.csv",
  "prompt": "Compare reaction times between groups",
  "dataset_schema": { "columns": ["group", "rt", "accuracy"] }
}
```

**Example Response:**
```json
{
  "job_id": "...",
  "status": "completed",
  "results": {
    "statistics": {
      "t_statistic": 2.45,
      "p_value": 0.015,
      "group1_mean": 525.3,
      "group2_mean": 548.7
    }
  },
  "decision": {
    "library": "scipy.stats",
    "function": "ttest_ind"
  }
}
```

## Frontend Integration

### API Client Methods Added
**Location:** `/insight-weaver/src/services/apiClient.ts`

```typescript
// Compute derived variables
await apiClient.computeVariables(datasetRef, [
  { name: 'rt_log', formula: 'log(rt)' }
]);

// Generate visualization
const viz = await apiClient.generateVisualization({
  dataset_reference: datasetRef,
  plot_type: 'histogram',
  x_column: 'rt'
});
// viz.plot_base64 contains the image

// Run analysis
const result = await apiClient.runAnalysis({
  dataset_reference: datasetRef,
  prompt: 'Compare groups',
  dataset_schema: { columns: [...] }
});
```

### Results View Enhanced
**Location:** `/insight-weaver/src/components/canvas/ResultsView.tsx`

**New Features:**
- "Run Analyses" button to execute selected analyses
- Shows loading state while running
- Displays backend-computed results
- Toast notifications for progress

**Flow:**
1. User selects analyses in "Choose Analysis" tab
2. User goes to "Results" tab
3. Click "Run Analyses" button
4. Backend executes each analysis using scipy/statsmodels
5. Results displayed with statistical output

## Python Service

### Running
```bash
cd /backend/python-service
python3 -m uvicorn app.analyze:app --host 0.0.0.0 --port 8001 --reload
```

### Health Check
```bash
curl http://localhost:8001/health
```

### Dependencies
- pandas 2.1.4
- numpy 1.26.2
- scipy 1.11.4
- statsmodels 0.14.1
- seaborn 0.13.0
- matplotlib 3.8.2

## Architecture

```
Frontend (React/TS)
    ↓ HTTP requests
FastAPI Backend (Port 8000)
    ↓ Proxies compute/viz requests
Python Service (Port 8001)
    ↓ Executes with pandas/scipy/seaborn
Results → Base64 images / JSON stats
    ↓ Returns
Frontend displays results
```

## File Storage

**Issue:** Python service needs file paths, but files are in Supabase Storage.

**Current Solution:** Files uploaded to Supabase Storage with `storage_path` recorded.

**Next Steps Needed:**
- Create temp file download endpoint
- OR: Modify Python service to accept file content directly
- OR: Download from storage and save locally before analysis

## Testing

### Test Compute Variables
```bash
curl -X POST http://localhost:8000/api/compute-variables \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_reference": "/path/to/data.csv",
    "variables": [{"name": "rt_log", "formula": "log(rt)"}]
  }'
```

### Test Visualization
```bash
curl -X POST http://localhost:8000/api/visualize \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_reference": "/path/to/data.csv",
    "plot_type": "histogram",
    "x_column": "rt"
  }'
```

## What's Working ✅

1. ✅ Backend endpoints created
2. ✅ Python service running with pandas/scipy/seaborn
3. ✅ Frontend API client methods added
4. ✅ Results view has "Run Analyses" button
5. ✅ Visualization generation working
6. ✅ Variable computation working

## What Needs Frontend Work 🔧

1. **File Access:** Need to ensure uploaded files are accessible to Python service (currently in Supabase Storage)
2. **Derived Variables UI:** Add "Compute Variables" button in CreateVariablesView
3. **Visualization Display:** Update DataVisualizationView to show backend-generated plots
4. **Analysis Results:** Format and display scipy/statsmodels output properly

## Next Steps

1. **Fix File Access:** Create endpoint to download from storage and save locally
2. **Test End-to-End:** Upload file → Create variables → Run analysis → Display results
3. **Add Error Handling:** Better error messages for failed analyses
4. **Add Progress Tracking:** Show which analysis is running in real-time
