/**
 * LLM Prompts for FastAPI Backend
 *
 * System and user prompts migrated from Supabase Edge Functions.
 * These prompts are used by the LLM service to generate analysis suggestions,
 * variable recommendations, and result interpretations.
 */

// ============================================================================
// Analysis Suggestions Prompts
// ============================================================================

export const SUGGEST_ANALYSES_SYSTEM_PROMPT = `You are a statistical methods expert for behavioral research.
Your task is to recommend appropriate analysis methods based on the data structure, research question, and available derived variables.

For each recommendation, provide:
- id: A unique snake_case identifier (must match one of the supported function names below)
- title: The analysis method name
- description: A brief explanation of what the method does
- complexity: One of "Basic", "Intermediate", or "Advanced"
- reasoning: Why this method is appropriate for this specific data
- execution_spec: { library, function, param_map } where param_map maps parameter roles to exact column names from the dataset

Consider factors like:
- Data distribution (normal vs non-normal)
- Sample size and trial counts
- Whether it's a trial-based experiment
- The research question's nature (if provided)
- Available derived variables and what they measure
- Presence of repeated measures
- Need for hierarchical modeling

SUPPORTED FUNCTIONS AND THEIR param_map KEYS:
- scipy.stats.ttest_ind: { "group_col": "<categorical column>", "value_col": "<numeric column>" }
- scipy.stats.mannwhitneyu: { "group_col": "<categorical column>", "value_col": "<numeric column>" }
- scipy.stats.wilcoxon: { "value_col1": "<numeric column>", "value_col2": "<numeric column>" }
- scipy.stats.kruskal: { "group_col": "<categorical column>", "value_col": "<numeric column>" }
- scipy.stats.f_oneway: { "group_col": "<categorical column>", "value_col": "<numeric column>" }
- scipy.stats.chi2_contingency: { "row_col": "<categorical column>", "col_col": "<categorical column>" }
- scipy.stats.pearsonr: { "x_col": "<numeric column>", "y_col": "<numeric column>" }
- scipy.stats.spearmanr: { "x_col": "<numeric column>", "y_col": "<numeric column>" }
- scipy.stats.shapiro: { "value_col": "<numeric column>" }
- scipy.stats.ks_2samp: { "group_col": "<categorical column>", "value_col": "<numeric column>" }

CRITICAL RULES:
1. param_map values MUST be EXACT column names copied from the "Data columns" list provided by the user. Never invent, abbreviate, or transform column names.
2. Every analysis recommendation must use a DIFFERENT function (no duplicates). All 4 recommendations must have distinct "id" values.
3. If a research question is provided, make sure at least 2 of your recommendations directly address it.
4. If derived variables are available, recommend analyses that utilize them.

Return exactly 4 analysis recommendations as a JSON array.
Only return the JSON array, no other text.`;

/**
 * Build user prompt for analysis suggestions
 */
export function buildAnalysisPrompt(context: {
  columns: string[];
  sampleRows: Record<string, unknown>[];
  researchQuestion?: string;
  distributionType?: string;
  hasOutliers?: boolean;
  derivedVariables?: { name: string; formula?: string }[];
  trialsDetected?: number;
  columnDescriptions?: Record<string, string>;
}): string {
  const derivedVarsContext =
    context.derivedVariables && context.derivedVariables.length > 0
      ? `\n\nDerived variables created by user:\n${context.derivedVariables
          .map((v) => `- ${v.name}${v.formula ? ` (formula: ${v.formula})` : ''}`)
          .join('\n')}`
      : '';

  const researchContext = context.researchQuestion
    ? `Research question: "${context.researchQuestion}"\nIMPORTANT: At least 2 of your recommendations should directly help answer this research question.`
    : 'Research question: Not specified';

  const descriptionsContext =
    context.columnDescriptions && Object.keys(context.columnDescriptions).length > 0
      ? `\n\nColumn descriptions provided by the researcher:\n${Object.entries(context.columnDescriptions)
          .map(([col, desc]) => `- ${col}: ${desc}`)
          .join('\n')}`
      : '';

  return `Recommend 4 appropriate analysis methods for this behavioral research data.

Data columns: ${context.columns.join(', ')}
Row count: ${context.sampleRows?.length || 0} sample rows provided

Sample data structure:
${JSON.stringify(context.sampleRows?.slice(0, 5), null, 2)}
${descriptionsContext}
Research context:
- ${researchContext}
- Data distribution: ${context.distributionType || 'Unknown'}
- Known outliers: ${context.hasOutliers ? 'Yes' : 'No or unknown'}
- Trials detected: ${context.trialsDetected || 'N/A (non-trial data)'}${derivedVarsContext}

Recommend 4 appropriate statistical analysis methods, ranging from basic to advanced. Make sure recommendations leverage the derived variables if available. Return only a JSON array.`;
}

// ============================================================================
// Variable Suggestions Prompts
// ============================================================================

export const SUGGEST_VARIABLES_SYSTEM_PROMPT = `You are a data analysis assistant for behavioral research. Suggest 3-5 useful derived variables based on the dataset columns and sample rows provided.

Return a JSON array only. Each item must have:
- name: snake_case
- formula: expression string (see below)
- formula_type: "eval", "transform", or "python"
- description: one sentence explaining what it measures

## formula_type: "eval"
Simple math on numeric columns. Use backticks around column names that contain spaces.
Example: \`RT\` / 1000

## formula_type: "transform"
Call exactly ONE of these functions. No Python code, no if/else, no row[] syntax.

- map_binary(col, {val1: 1, val2: 1, val3: 0, ...})  —  map multiple categorical values to 0/1 (list ALL possible values)
- map_categorical(col, {old: new, ...})  —  remap strings to numbers
- normalize(col, min_val=0, max_val=1)  —  min-max scale
- z_score(col)  —  standardize (mean=0, std=1)
- composite_score([col1, col2, ...], weights=[w1, w2, ...])  —  weighted composite; auto-normalizes each numeric column first
- conditional_value(cond_col, cond_val, true_val, false_val)  —  categorical if/else
- conditional_numeric(col, op, threshold, true_val, false_val)  —  op: >, <, >=, <=, ==, !=
- percentile_rank(col)  —  values as 0–100 percentile
- bin_numeric(col, bins=[...], labels=[...])  —  cut numeric into labelled buckets
- log_transform(col, base=2.71828)  —  log transformation
- winsorize(col, lower_percentile=5, upper_percentile=95)  —  clip extreme values

## formula_type: "python"
Use when you need 2+ steps that can't be expressed as a single function call — most commonly when a composite score includes a categorical column that must be converted to numeric first.

Rules:
- \`df\` is the dataset (pandas DataFrame). All transform functions above are also available.
- Assign the final Series to \`result\`.
- Newlines in the JSON string must be written as \\n.

Example — composite including a categorical column:
\`\`\`
"formula": "numeric_mood = map_categorical('Mood', {'Low': 1, 'Medium': 2, 'High': 3})\\nresult = composite_score(['RT', 'Accuracy', numeric_mood], weights=[0.4, 0.4, 0.2])",
"formula_type": "python"
\`\`\`

Use "python" only when a single "transform" call is genuinely insufficient. Prefer "transform" otherwise.

## Rules
- composite_score auto-normalizes numeric inputs — never normalize separately before combining
- If 2+ related numeric measures exist, suggest composite_score as your first recommendation
- If a column needed for a composite is categorical, convert it first using "python" type (see example above)
- If a research question is given, most suggestions should directly address it — only include general-purpose variables if they add clear value
- NEVER nest function calls inside "transform" formulas — arguments must be plain literals (strings, numbers, lists). Use "map_binary" to match multiple categorical values to 0/1 instead of nesting conditional_value. Use "python" type if you genuinely need multi-step logic`;

/**
 * Build user prompt for variable suggestions
 */
export function buildVariablesPrompt(context: {
  sampleRows: Record<string, unknown>[];
  columns: string[];
  researchQuestion?: string;
  columnDescriptions?: Record<string, string>;
}): string {
  const descriptionsContext =
    context.columnDescriptions && Object.keys(context.columnDescriptions).length > 0
      ? `\n\nColumn descriptions provided by the researcher:\n${Object.entries(context.columnDescriptions)
          .map(([col, desc]) => `- ${col}: ${desc}`)
          .join('\n')}\n`
      : '';

  const sampleText = context.sampleRows && context.sampleRows.length > 0
    ? `\nSample rows:\n${JSON.stringify(context.sampleRows, null, 2)}\n`
    : '';

  if (context.researchQuestion) {
    return `Suggest 3-5 useful derived variables for this dataset. Most suggestions should directly help answer the research question — only include general-purpose variables if they add clear value.

Research Question: "${context.researchQuestion}"

Columns: ${context.columns.join(', ')}
${sampleText}${descriptionsContext}
Return only a JSON array.`;
  }

  return `Suggest 3-5 useful derived variables for this dataset.

Columns: ${context.columns.join(', ')}
${sampleText}${descriptionsContext}
Return only a JSON array.`;
}

// ============================================================================
// Result Interpretation Prompts
// ============================================================================

export const INTERPRET_RESULTS_SYSTEM_PROMPT = `You are a statistician providing clear, accessible interpretations of statistical results for behavioral psychology researchers.

Your interpretations should:
1. Explain what the numbers mean in plain language
2. Describe the practical significance, not just statistical significance
3. Note any caveats or limitations
4. Suggest what this might mean for the research question
5. Be concise (2-3 paragraphs max)

Avoid jargon where possible, but use proper statistical terminology when needed.`;

/**
 * Build user prompt for result interpretation
 */
export function buildInterpretationPrompt(context: {
  result: {
    title: string;
    analysisType: string;
    description?: string;
    parameters?: { name: string; value: string; interpretation?: string }[];
    metrics?: { name: string; value: string; highlight?: boolean }[];
    [key: string]: any;
  };
  researchContext?: {
    researchQuestion?: string;
    distributionType?: string;
    hasOutliers?: boolean;
  };
}): string {
  const parametersText =
    context.result.parameters
      ?.map((p) => `${p.name}: ${p.value}${p.interpretation ? ` (${p.interpretation})` : ''}`)
      .join('\n') || 'None computed';

  const metricsText =
    context.result.metrics
      ?.map((m) => `${m.name}: ${m.value}${m.highlight ? ' [significant]' : ''}`)
      .join('\n') || 'None computed';

  return `Please interpret these statistical results:

**Analysis:** ${context.result.title}
${context.result.description ? `\n**Description:** ${context.result.description}` : ''}

**Parameters:**
${parametersText}

**Test Results:**
${metricsText}

${context.researchContext?.researchQuestion ? `\n**Research Question:** ${context.researchContext.researchQuestion}` : ''}
${context.researchContext?.distributionType ? `\n**Data Distribution:** ${context.researchContext.distributionType}` : ''}
${context.researchContext?.hasOutliers ? '\n**Note:** Data contains outliers' : ''}

Provide a clear interpretation of these results for a behavioral psychology researcher.`;
}
