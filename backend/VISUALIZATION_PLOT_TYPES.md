# Supported Visualization Plot Types

## Overview

The backend now supports **15+ plot types** using seaborn and matplotlib. All visualizations are generated server-side and returned as base64-encoded PNG images.

## Plot Types Reference

### Distribution Plots (Single Variable)

#### 1. **histogram**
- **Purpose:** Show frequency distribution of a numeric variable
- **Columns Required:** 1 (x_column)
- **Features:** Includes KDE (kernel density estimate) overlay
- **Use Cases:**
  - Understand data distribution
  - Identify skewness, modality
  - Spot potential outliers

**Example:**
```json
{
  "plot_type": "histogram",
  "columns": ["reaction_time"],
  "title": "Distribution of Reaction Times"
}
```

#### 2. **density**
- **Purpose:** Smooth density estimate (KDE plot)
- **Columns Required:** 1 (x_column)
- **Features:** Filled area under curve
- **Use Cases:**
  - Smooth distribution visualization
  - Compare shapes without binning artifacts
  - Overlay multiple distributions

#### 3. **boxplot** (or **box**)
- **Purpose:** Show distribution summary statistics
- **Columns Required:** 1 or 2
  - 1 column: Overall distribution
  - 2 columns: Distribution by category
- **Features:** Displays median, Q1, Q3, whiskers, outliers
- **Use Cases:**
  - Quick distribution summary
  - Compare distributions across groups
  - Identify outliers

**Example:**
```json
{
  "plot_type": "boxplot",
  "columns": ["response_time", "condition"],
  "title": "Response Time by Condition"
}
```

#### 4. **violin**
- **Purpose:** Combination of boxplot and KDE
- **Columns Required:** 1 or 2
- **Features:** Shows full distribution shape + quartiles
- **Use Cases:**
  - Detailed distribution comparison
  - See multimodal distributions
  - Better than boxplot for complex shapes

---

### Relationship Plots (Two Variables)

#### 5. **scatter**
- **Purpose:** Show relationship between two numeric variables
- **Columns Required:** 2 (x_column, y_column)
- **Optional:** color_column for grouping
- **Use Cases:**
  - Identify correlations
  - Spot patterns and clusters
  - Detect outliers

**Example:**
```json
{
  "plot_type": "scatter",
  "columns": ["trial_number", "accuracy"],
  "title": "Accuracy Over Trials"
}
```

#### 6. **line**
- **Purpose:** Show trends over continuous variable or time
- **Columns Required:** 2 (x_column, y_column)
- **Features:** Line plot with markers
- **Use Cases:**
  - Time series data
  - Learning curves
  - Sequential effects

#### 7. **heatmap** (or **correlation**)
- **Purpose:** Correlation matrix for multiple numeric variables
- **Columns Required:** 0 (uses all numeric columns)
- **Features:** Annotated with correlation coefficients
- **Use Cases:**
  - Understand relationships between all variables
  - Identify multicollinearity
  - Feature selection

**Example:**
```json
{
  "plot_type": "heatmap",
  "columns": [],
  "title": "Variable Correlation Matrix"
}
```

#### 8. **pairplot**
- **Purpose:** Pairwise relationships between multiple variables
- **Columns Required:** 0 (uses up to 5 numeric columns)
- **Optional:** color_column for grouping
- **Features:** Scatterplots + diagonal KDE
- **Use Cases:**
  - Explore all pairwise relationships
  - Identify clusters or groups
  - Multivariate data exploration

---

### Categorical Plots

#### 9. **bar**
- **Purpose:** Compare values across categories
- **Columns Required:** 1 or 2
  - 1 column: Count plot (frequency)
  - 2 columns: Aggregated values by category
- **Use Cases:**
  - Compare means/counts across groups
  - Show categorical summaries
  - Response by condition

**Example:**
```json
{
  "plot_type": "bar",
  "columns": ["condition", "accuracy"],
  "title": "Mean Accuracy by Condition"
}
```

#### 10. **count**
- **Purpose:** Show frequency counts for categorical variable
- **Columns Required:** 1 (x_column)
- **Use Cases:**
  - Distribution of categorical data
  - Sample sizes per group
  - Class imbalance visualization

#### 11. **strip**
- **Purpose:** Individual data points for categorical comparisons
- **Columns Required:** 2 (x_column=category, y_column=value)
- **Features:** Shows all individual points with jitter
- **Use Cases:**
  - See all raw data points
  - Spot individual outliers
  - Sample size visualization

#### 12. **swarm**
- **Purpose:** Non-overlapping points for categorical data
- **Columns Required:** 2 (x_column=category, y_column=value)
- **Features:** Arranges points to avoid overlap
- **Use Cases:**
  - See distribution shape with raw data
  - Better than strip for smaller datasets
  - Beautiful alternative to boxplot

---

### Specialized Plots

#### 13. **pairplot_preview**
- **Purpose:** Quick pairplot for first 4 numeric columns
- **Columns Required:** 0
- **Use Cases:**
  - Fast exploratory visualization
  - Avoid performance issues with many columns

---

## How to Use

### Frontend API Call
```typescript
const response = await apiClient.generateVisualization({
  dataset_reference: "session_id/file.csv",
  plot_type: "boxplot",
  x_column: "condition",      // Optional
  y_column: "response_time",  // Optional
  color_column: "subject_id"  // Optional
});

// Returns base64 PNG
const imageBase64 = response.plot_base64;
```

### Backend Endpoint
```bash
POST /api/visualize
Content-Type: application/json

{
  "dataset_reference": "path/to/data.csv",
  "plot_type": "scatter",
  "x_column": "trial_number",
  "y_column": "accuracy",
  "color_column": null
}
```

### Response
```json
{
  "status": "success",
  "plot_base64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

---

## AI Visualization Suggestions

The AI now knows about all plot types and will suggest appropriate visualizations based on:
- Data types (numeric, categorical)
- Research question
- Distribution characteristics
- Presence of outliers

**Example AI Suggestions:**
```json
[
  {
    "plot_type": "histogram",
    "columns": ["reaction_time"],
    "title": "Distribution of Reaction Times",
    "description": "Shows frequency distribution to identify patterns and outliers"
  },
  {
    "plot_type": "boxplot",
    "columns": ["accuracy", "condition"],
    "title": "Accuracy by Experimental Condition",
    "description": "Compares accuracy distributions across experimental groups"
  },
  {
    "plot_type": "scatter",
    "columns": ["trial_number", "performance"],
    "title": "Performance Over Trials",
    "description": "Reveals learning effects or performance changes over time"
  },
  {
    "plot_type": "heatmap",
    "columns": [],
    "title": "Variable Correlation Matrix",
    "description": "Shows relationships between all numeric variables at once"
  }
]
```

---

## Plot Type Selection Guide

| Data Type | Goal | Recommended Plot Types |
|-----------|------|------------------------|
| 1 numeric | Distribution | histogram, density, boxplot |
| 1 numeric | Outliers | boxplot, violin |
| 1 categorical | Frequency | count, bar |
| 2 numeric | Relationship | scatter, line |
| 2 numeric | Correlation | scatter, heatmap |
| Numeric + Categorical | Comparison | boxplot, violin, bar, strip |
| Multiple numeric | Relationships | pairplot, heatmap |
| Time series | Trend | line, scatter |
| Learning/Sequential | Progress | line, scatter |

---

## Best Practices

### 1. **Start with Distribution Plots**
- histogram or density for each key variable
- Understand data shape before analysis

### 2. **Use Boxplots for Comparisons**
- Quickly compare groups
- Spot outliers across conditions

### 3. **Scatter Plots for Relationships**
- Always check bivariate relationships
- Use color_column to add third dimension

### 4. **Heatmaps for Many Variables**
- Get overview of all correlations
- Identify redundant variables

### 5. **Pairplots for Exploration**
- See everything at once
- Identify unexpected patterns

---

## Performance Considerations

- **Pairplot:** Limited to 5 columns to avoid slowness
- **Heatmap:** Works well even with 20+ columns
- **Swarm:** Can be slow with >1000 points
- **All others:** Fast even with large datasets

---

## Column Requirements Summary

| Plot Type | x_column | y_column | color_column | Auto-selects if missing? |
|-----------|----------|----------|--------------|--------------------------|
| histogram | Required | - | - | Uses first numeric |
| density | Required | - | - | Uses first numeric |
| boxplot | Optional | Required | - | Works with 1 column |
| violin | Optional | Required | - | Works with 1 column |
| scatter | Required | Required | Optional | No |
| line | Required | Required | - | No |
| bar | Required | Optional | - | Count plot if 1 column |
| count | Required | - | - | No |
| strip | Required | Required | - | No |
| swarm | Required | Required | - | No |
| heatmap | - | - | - | Uses all numeric |
| pairplot | - | - | Optional | Uses up to 5 numeric |

---

## Error Handling

If a plot cannot be generated:
```json
{
  "status": "error",
  "error": "Unsupported plot type: invalid_type"
}
```

Common errors:
- Missing required columns
- Non-numeric data for numeric plots
- Too few data points for certain plots
- Invalid column names

---

## Examples by Research Scenario

### 1. **Behavioral Experiment (RT, Accuracy)**
```json
[
  {"plot_type": "histogram", "columns": ["reaction_time"]},
  {"plot_type": "boxplot", "columns": ["reaction_time", "condition"]},
  {"plot_type": "scatter", "columns": ["trial_number", "accuracy"]},
  {"plot_type": "line", "columns": ["block", "mean_rt"]}
]
```

### 2. **Survey Data (Likert Scales)**
```json
[
  {"plot_type": "count", "columns": ["satisfaction_rating"]},
  {"plot_type": "bar", "columns": ["age_group", "satisfaction"]},
  {"plot_type": "heatmap", "columns": []}
]
```

### 3. **Physiological Data (EEG, Heart Rate)**
```json
[
  {"plot_type": "line", "columns": ["time", "heart_rate"]},
  {"plot_type": "violin", "columns": ["task", "hrv"]},
  {"plot_type": "heatmap", "columns": []}
]
```

### 4. **Learning Data (Performance Over Time)**
```json
[
  {"plot_type": "line", "columns": ["trial", "score"]},
  {"plot_type": "scatter", "columns": ["practice_time", "final_score"]},
  {"plot_type": "boxplot", "columns": ["session", "improvement"]}
]
```

---

## Future Enhancements

Potential additions:
- [ ] Ridge plots for distribution comparison
- [ ] Regression plots with confidence intervals
- [ ] Animated plots for time series
- [ ] 3D scatter plots
- [ ] Contour plots for density
- [ ] Interactive plots (plotly)

---

## Testing

Test all plot types:
```bash
# Test each plot type
curl -X POST http://localhost:8001/visualize \
  -H "Content-Type: application/json" \
  -d '{
    "dataset_reference": "path/to/data.csv",
    "plot_type": "boxplot",
    "x_column": "condition",
    "y_column": "response_time"
  }'
```

Verify AI suggestions:
```bash
curl -X POST http://localhost:8000/api/suggest-visualizations \
  -H "Content-Type: application/json" \
  -d '{
    "columns": ["reaction_time", "accuracy", "condition"],
    "research_question": "How does accuracy change with practice?"
  }'
```
