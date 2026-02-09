# Comprehensive Code Export Feature - Implementation Plan

## Overview
Generate a complete, executable Python script that reproduces the entire workflow:
- Data loading
- Data cleaning (consistency checks)
- Derived variables (all types)
- Statistical analyses
- Data visualizations

The code should be **educational** (well-commented) and **executable** (runnable as-is).

---

## Current State Analysis

### ✅ What Exists:
- `CodeSummaryView.tsx` - basic code generation
  - Generates imports and data loading
  - Basic wrangling code
  - Trial structure parsing
  - Derived variables (but incomplete)
  - Analyses (generic, not using execution_spec)

### ❌ What's Missing:
1. **Data Cleaning:**
   - Consistency check code (duplicates, negative values, case issues)
   - Proper missing data handling code

2. **Derived Variables:**
   - Transform type formulas only show raw string (e.g., `map_binary(...)`)
   - These need actual pandas code or helper function definitions
   - Backtick issue: formulas have backticks for column names with spaces

3. **Analyses:**
   - Uses generic `analysis_type` instead of `execution_spec`
   - Doesn't map param_map correctly to scipy functions
   - Limited to a few hardcoded analysis types

4. **Visualizations:**
   - No visualization code generation at all

---

## Technical Challenges & Solutions

### Challenge 1: Transform Function Code Generation

**Problem:** Transform formulas are stored as function calls:
```python
map_binary('Gender', {'Male': 1, 'Female': 0})
```

These reference functions from `TransformationLibrary` that don't exist in the user's environment.

**Solutions:**

**Option A: Self-Contained (RECOMMENDED)**
- Include helper function definitions in the generated script
- User can run immediately without additional files
```python
# Helper function definitions
def map_binary(df, column, mapping):
    return df[column].map(mapping)

# Usage
df['Gender_Binary'] = map_binary(df, 'Gender', {'Male': 1, 'Female': 0})
```

**Option B: Inline Pandas Operations**
- Convert transform calls to raw pandas operations
- More verbose but no helper functions needed
```python
df['Gender_Binary'] = df['Gender'].map({'Male': 1, 'Female': 0})
```

**Decision: Use Option B** (inline pandas) because it's simpler and users learn actual pandas syntax.

---

### Challenge 2: Backticks in Column Names

**Problem:** Formulas with spaces use backticks:
```python
map_binary(`Nervous Break-down`, {'YES': 1, 'NO': 0})
```

But Python uses quotes, not backticks.

**Solution:** Replace backticks with square bracket notation:
```python
df['Nervous_Breakdown'] = df['Nervous Break-down'].map({'YES': 1, 'NO': 0})
```

---

### Challenge 3: execution_spec to Code Mapping

**Problem:** Need to map execution_spec to actual scipy code:
```json
{
  "library": "scipy.stats",
  "function": "chi2_contingency",
  "param_map": {"row_col": "Gender", "col_col": "Diagnosis"}
}
```

**Solution:** Create a mapping for each supported function:
```python
# scipy.stats.chi2_contingency with row_col/col_col
contingency_table = pd.crosstab(df['Gender'], df['Diagnosis'])
chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)

# scipy.stats.ttest_ind with group_col/value_col
group1 = df[df['Gender'] == 'Male']['Score']
group2 = df[df['Gender'] == 'Female']['Score']
t_stat, p_value = stats.ttest_ind(group1, group2)
```

---

### Challenge 4: Visualization Code Generation

**Problem:** Need to convert VisualizationConfig to seaborn code:
```typescript
{
  plotType: "scatter",
  columns: ["Age", "Score", "Gender"]
}
```

**Solution:** Map plot types to seaborn functions with parameter inference:
```python
# Scatter plot
plt.figure(figsize=(10, 6))
sns.scatterplot(data=df, x='Age', y='Score', hue='Gender')
plt.title('Score vs Age by Gender')
plt.tight_layout()
plt.savefig('scatter_age_score.png')
plt.show()
```

---

## Implementation Structure

### Generated Script Structure:

```python
"""
Inferra Analysis Pipeline - Generated Code
===============================================
This script reproduces your entire analysis workflow.
Generated on: [timestamp]

Requirements:
    pip install pandas numpy scipy seaborn matplotlib
"""

import pandas as pd
import numpy as np
from scipy import stats
import seaborn as sns
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

# Configure plotting style
sns.set_theme(style="whitegrid")
plt.rcParams['figure.figsize'] = (10, 6)


# ============================================
# 1. DATA LOADING
# ============================================

print("Loading dataset...")
df = pd.read_csv("your_data.csv")
print(f"✓ Loaded {len(df)} rows, {len(df.columns)} columns")
print(f"  Columns: {list(df.columns)}")


# ============================================
# 2. DATA CLEANING & QUALITY CHECKS
# ============================================

print("\nRunning data quality checks...")

# Check for duplicate IDs
if 'subject_id' in df.columns:
    duplicates = df['subject_id'].duplicated().sum()
    if duplicates > 0:
        print(f"  ⚠ Warning: Found {duplicates} duplicate subject IDs")
    else:
        print(f"  ✓ No duplicate subject IDs")

# Check for negative reaction times
if 'reaction_time' in df.columns:
    negative_rt = (df['reaction_time'] < 0).sum()
    if negative_rt > 0:
        print(f"  ✗ Error: Found {negative_rt} negative reaction times")
    else:
        print(f"  ✓ No negative reaction times")

# Check for case-inconsistent labels
for col in ['condition', 'group', 'status']:
    if col in df.columns:
        values = df[col].dropna().unique()
        lower_values = [str(v).lower() for v in values]
        if len(values) != len(set(lower_values)):
            print(f"  ⚠ Warning: Column '{col}' has case-inconsistent labels")

# Handle missing data
print("\nMissing data summary:")
missing = df.isnull().sum()
missing_pct = (missing / len(df)) * 100
for col in missing[missing > 0].index:
    print(f"  {col}: {missing[col]} missing ({missing_pct[col]:.1f}%)")

# [Insert missing data handling strategy code if configured]


# ============================================
# 3. DERIVED VARIABLES
# ============================================

print("\nCreating derived variables...")

# [For each enabled derived variable]
# Variable: Bipolar_Diagnosis
# Description: Binary encoding for bipolar diagnosis
df['Bipolar_Diagnosis'] = df['Expert Diagnose'].map({
    'Bipolar Type-1': 1,
    'Bipolar Type-2': 1,
    'Depression': 0,
    'Normal': 0
})
print("  ✓ Created: Bipolar_Diagnosis")

# Variable: Overall_Performance
# Description: Composite score from accuracy and speed
# First normalize each component to 0-1 range
accuracy_norm = (df['Accuracy'] - df['Accuracy'].min()) / (df['Accuracy'].max() - df['Accuracy'].min())
speed_norm = (df['Speed'] - df['Speed'].min()) / (df['Speed'].max() - df['Speed'].min())
# Then compute weighted average
df['Overall_Performance'] = 0.6 * accuracy_norm + 0.4 * speed_norm
print("  ✓ Created: Overall_Performance")


# ============================================
# 4. STATISTICAL ANALYSES
# ============================================

print("\nRunning statistical analyses...")

# Analysis 1: Chi-Square Test
# Test for association between Gender and Diagnosis
print("\n--- Chi-Square Test: Gender vs Diagnosis ---")
contingency_table = pd.crosstab(df['Gender'], df['Bipolar_Diagnosis'])
chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
print(f"Chi-square statistic: {chi2:.4f}")
print(f"P-value: {p_value:.4f}")
print(f"Degrees of freedom: {dof}")
if p_value < 0.05:
    print("Result: SIGNIFICANT (p < 0.05)")
else:
    print("Result: Not significant (p >= 0.05)")

# Analysis 2: Independent t-Test
# Compare anxiety scores between genders
print("\n--- Independent t-Test: Anxiety by Gender ---")
group1 = df[df['Gender'] == 'Male']['Anxiety_Score'].dropna()
group2 = df[df['Gender'] == 'Female']['Anxiety_Score'].dropna()
t_stat, p_value = stats.ttest_ind(group1, group2)
print(f"t-statistic: {t_stat:.4f}")
print(f"P-value: {p_value:.4f}")
print(f"Group 1 (Male) mean: {group1.mean():.2f} (n={len(group1)})")
print(f"Group 2 (Female) mean: {group2.mean():.2f} (n={len(group2)})")
if p_value < 0.05:
    print("Result: SIGNIFICANT difference (p < 0.05)")
else:
    print("Result: No significant difference (p >= 0.05)")


# ============================================
# 5. DATA VISUALIZATIONS
# ============================================

print("\nGenerating visualizations...")

# Visualization 1: Distribution of Anxiety Scores
plt.figure(figsize=(10, 6))
sns.histplot(data=df, x='Anxiety_Score', bins=30, kde=True)
plt.title('Distribution of Anxiety Scores')
plt.xlabel('Anxiety Score')
plt.ylabel('Count')
plt.tight_layout()
plt.savefig('viz_01_anxiety_distribution.png', dpi=150)
print("  ✓ Saved: viz_01_anxiety_distribution.png")
plt.show()

# Visualization 2: Scatter Plot - Age vs Anxiety
plt.figure(figsize=(10, 6))
sns.scatterplot(data=df, x='Age', y='Anxiety_Score', hue='Gender', style='Bipolar_Diagnosis')
plt.title('Age vs Anxiety Score by Gender and Diagnosis')
plt.xlabel('Age')
plt.ylabel('Anxiety Score')
plt.legend(title='Legend', bbox_to_anchor=(1.05, 1), loc='upper left')
plt.tight_layout()
plt.savefig('viz_02_age_anxiety_scatter.png', dpi=150)
print("  ✓ Saved: viz_02_age_anxiety_scatter.png")
plt.show()


# ============================================
# 6. EXPORT RESULTS
# ============================================

print("\nExporting results...")

# Save processed dataset with derived variables
df.to_csv("processed_data_with_derived_variables.csv", index=False)
print("  ✓ Saved: processed_data_with_derived_variables.csv")

# Save analysis summary
# (You can expand this to save detailed results to CSV/JSON)

print("\n" + "="*50)
print("Analysis pipeline completed successfully!")
print("="*50)
```

---

## Implementation Steps

### Step 1: Update CodeSummaryView.tsx

Add comprehensive generation function:

```typescript
const generateComprehensiveCode = () => {
  // 1. Imports and setup
  // 2. Data loading with checks
  // 3. Data cleaning (consistency checks)
  // 4. Derived variables (parse and convert formulas)
  // 5. Analyses (use execution_spec)
  // 6. Visualizations (from viz configs)
  // 7. Export section
}
```

### Step 2: Create Transform Formula Parser

```typescript
const parseTransformFormula = (formula: string) => {
  // Parse: map_binary('col', {...})
  // Output: df['col'].map({...})

  // Parse: composite_score(['col1', 'col2'], weights=[0.6, 0.4])
  // Output: multi-line pandas normalization + weighted sum
}
```

### Step 3: Create Execution Spec to Code Mapper

```typescript
const generateAnalysisCode = (executionSpec: ExecutionSpec) => {
  const { library, function: func, param_map } = executionSpec;

  // Map to scipy code based on function name
  switch (func) {
    case 'chi2_contingency':
      return generateChi2Code(param_map);
    case 'ttest_ind':
      return generateTTestCode(param_map);
    // ... etc
  }
}
```

### Step 4: Create Visualization Code Generator

```typescript
const generateVizCode = (viz: VisualizationConfig) => {
  const { plotType, columns, title, description } = viz;

  // Map to seaborn code
  switch (plotType) {
    case 'scatter':
      return generateScatterCode(columns, title);
    case 'histogram':
      return generateHistogramCode(columns, title);
    // ... etc
  }
}
```

### Step 5: Add Export Button

In `DataVisualizationView.tsx` alongside other export buttons:
```tsx
<button onClick={handleExportCode}>
  <FileCode2 className="w-4 h-4" />
  Export Python Code
</button>
```

---

## Function Mappings Reference

### Transform Functions → Pandas Code

| Transform Function | Pandas Equivalent |
|-------------------|-------------------|
| `map_binary(col, mapping)` | `df[col].map(mapping)` |
| `map_categorical(col, mapping)` | `df[col].map(mapping)` |
| `normalize(col, min, max)` | `min + (df[col] - df[col].min()) / (df[col].max() - df[col].min()) * (max - min)` |
| `z_score(col)` | `(df[col] - df[col].mean()) / df[col].std()` |
| `composite_score(cols, weights)` | Multi-line: normalize each → weighted sum |
| `conditional_numeric(col, op, threshold, true, false)` | `df[col].apply(lambda x: true if x op threshold else false)` |

### Analysis Functions → Scipy Code

| Function | param_map Keys | Scipy Code |
|----------|---------------|------------|
| `chi2_contingency` | row_col, col_col | `pd.crosstab(df[row_col], df[col_col])` → `stats.chi2_contingency()` |
| `ttest_ind` | group_col, value_col | Split by group → `stats.ttest_ind(group1, group2)` |
| `mannwhitneyu` | group_col, value_col | Split by group → `stats.mannwhitneyu(group1, group2)` |
| `pearsonr` | x_col, y_col | `stats.pearsonr(df[x_col], df[y_col])` |
| `spearmanr` | x_col, y_col | `stats.spearmanr(df[x_col], df[y_col])` |

### Plot Types → Seaborn Code

| Plot Type | Seaborn Function | Parameters |
|-----------|-----------------|------------|
| scatter | `sns.scatterplot()` | x, y, hue (if 3+ cols) |
| histogram | `sns.histplot()` | x, bins, kde |
| boxplot | `sns.boxplot()` | x, y |
| line | `sns.lineplot()` | x, y |
| bar | `sns.barplot()` | x, y |
| density | `sns.kdeplot()` | x, fill=True |

---

## Validation & Testing

### Test Cases:

1. **Eval formula**: `df.eval('Age * 2')` → generates correctly
2. **Transform formula**: `map_binary('Gender', {...})` → converts to `.map()`
3. **Composite score**: Generates multi-line normalization code
4. **Backticks**: `\`Column Name\`` → `df['Column Name']`
5. **execution_spec**: Chi-square → correct crosstab code
6. **Multiple visualizations**: All generate with unique filenames
7. **Empty sections**: Gracefully handles no derived variables, no analyses, etc.

### Manual Test:
1. Generate code for a complete workflow
2. Copy generated code to Jupyter notebook
3. Run it (should execute without errors)
4. Verify output matches app results

---

## Benefits

1. **Educational**: Users learn Python data analysis step-by-step
2. **Reproducible**: Complete workflow in one script
3. **Portable**: Share with collaborators
4. **Customizable**: Users can modify and extend
5. **Publication-ready**: Can be included in supplementary materials

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Generated code has syntax errors | Extensive testing, validation |
| Complex formulas don't convert properly | Fallback to commented warning |
| Different results due to random state | Add random seed setting |
| Large datasets slow down code | Add sampling option in comments |
| Transform functions too complex to inline | Provide helper function definitions as option |

---

## Decision: PROCEED or DEFER?

### ✅ PROCEED IF:
- We can handle all transform types correctly
- execution_spec mapping is comprehensive
- Testing confirms generated code runs successfully

### ⚠️ DEFER IF:
- Too many edge cases in formula parsing
- execution_spec coverage is incomplete
- Generated code too fragile

---

## Recommendation: **PROCEED with Phase 1**

**Phase 1 (MVP):**
- Data loading + cleaning checks
- Derived variables (eval + simple transforms like map_binary)
- Analyses with execution_spec (common functions only)
- Simple visualizations (scatter, histogram, boxplot)

**Phase 2 (Future):**
- Complex transforms (composite_score with inline normalization)
- All 10+ analysis functions
- Advanced visualizations
- R code generation improvements

This gives users 80% of the value with manageable complexity.
