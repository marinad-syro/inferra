/**
 * Catalog of supported statistical analysis functions.
 * Maps function identifiers to their metadata, library, and parameter role definitions.
 * Used by the custom analysis form to build execution_spec objects.
 */

export interface ParamDefinition {
  key: string;
  label: string;
  type: 'numeric' | 'categorical' | 'any';
}

export interface AnalysisCatalogEntry {
  library: string;
  label: string;
  description: string;
  complexity: 'Basic' | 'Intermediate' | 'Advanced';
  params: ParamDefinition[];
}

export const ANALYSIS_CATALOG: Record<string, AnalysisCatalogEntry> = {
  ttest_ind: {
    library: 'scipy.stats',
    label: 'Independent t-Test',
    description: 'Compare means between two independent groups',
    complexity: 'Basic',
    params: [
      { key: 'group_col', label: 'Group Column', type: 'categorical' },
      { key: 'value_col', label: 'Value Column', type: 'numeric' },
    ],
  },
  mannwhitneyu: {
    library: 'scipy.stats',
    label: 'Mann-Whitney U Test',
    description: 'Non-parametric comparison of two independent groups',
    complexity: 'Basic',
    params: [
      { key: 'group_col', label: 'Group Column', type: 'categorical' },
      { key: 'value_col', label: 'Value Column', type: 'numeric' },
    ],
  },
  wilcoxon: {
    library: 'scipy.stats',
    label: 'Wilcoxon Signed-Rank Test',
    description: 'Non-parametric comparison of two paired/related samples',
    complexity: 'Basic',
    params: [
      { key: 'value_col1', label: 'First Value Column', type: 'numeric' },
      { key: 'value_col2', label: 'Second Value Column', type: 'numeric' },
    ],
  },
  kruskal: {
    library: 'scipy.stats',
    label: 'Kruskal-Wallis Test',
    description: 'Non-parametric comparison across multiple groups',
    complexity: 'Intermediate',
    params: [
      { key: 'group_col', label: 'Group Column', type: 'categorical' },
      { key: 'value_col', label: 'Value Column', type: 'numeric' },
    ],
  },
  f_oneway: {
    library: 'scipy.stats',
    label: 'One-Way ANOVA',
    description: 'Compare means across multiple groups',
    complexity: 'Intermediate',
    params: [
      { key: 'group_col', label: 'Group Column', type: 'categorical' },
      { key: 'value_col', label: 'Value Column', type: 'numeric' },
    ],
  },
  chi2_contingency: {
    library: 'scipy.stats',
    label: 'Chi-Square Test',
    description: 'Test association between two categorical variables',
    complexity: 'Basic',
    params: [
      { key: 'row_col', label: 'Row Variable', type: 'categorical' },
      { key: 'col_col', label: 'Column Variable', type: 'categorical' },
    ],
  },
  pearsonr: {
    library: 'scipy.stats',
    label: "Pearson's Correlation",
    description: 'Measure linear relationship between two numeric variables',
    complexity: 'Basic',
    params: [
      { key: 'x_col', label: 'X Variable', type: 'numeric' },
      { key: 'y_col', label: 'Y Variable', type: 'numeric' },
    ],
  },
  spearmanr: {
    library: 'scipy.stats',
    label: "Spearman's Correlation",
    description: 'Measure monotonic relationship between two variables',
    complexity: 'Basic',
    params: [
      { key: 'x_col', label: 'X Variable', type: 'numeric' },
      { key: 'y_col', label: 'Y Variable', type: 'numeric' },
    ],
  },
  shapiro: {
    library: 'scipy.stats',
    label: 'Shapiro-Wilk Normality Test',
    description: 'Test whether a variable follows a normal distribution',
    complexity: 'Basic',
    params: [{ key: 'value_col', label: 'Value Column', type: 'numeric' }],
  },
  ks_2samp: {
    library: 'scipy.stats',
    label: 'Kolmogorov-Smirnov Test',
    description: 'Compare distributions of two groups',
    complexity: 'Intermediate',
    params: [
      { key: 'group_col', label: 'Group Column', type: 'categorical' },
      { key: 'value_col', label: 'Value Column', type: 'numeric' },
    ],
  },
};
