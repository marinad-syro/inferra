"""
Code generation service for Python and R.

Generates executable code from UI operations (data cleaning, transformations, analyses).
"""

from typing import Dict, List, Optional, Any


class CodeGenerator:
    """Generate Python or R code from UI operations."""

    def generate_full_script(
        self,
        language: str,
        session_id: str,
        wrangling_config: Optional[Dict] = None,
        derived_variables: Optional[List[Dict]] = None,
        analyses: Optional[List[Dict]] = None
    ) -> str:
        """Generate complete executable script."""

        if language == 'python':
            return self._generate_python_script(
                session_id, wrangling_config, derived_variables, analyses
            )
        elif language == 'r':
            return self._generate_r_script(
                session_id, wrangling_config, derived_variables, analyses
            )
        else:
            raise ValueError(f"Unsupported language: {language}")

    # ============================================================
    # PYTHON CODE GENERATION
    # ============================================================

    def _generate_python_script(
        self,
        session_id: str,
        wrangling_config: Optional[Dict],
        derived_variables: Optional[List[Dict]],
        analyses: Optional[List[Dict]]
    ) -> str:
        """Generate complete Python script."""

        parts = [
            "# Inferra Data Analysis - Python",
            "# Auto-generated from UI operations",
            "",
            "import pandas as pd",
            "import numpy as np",
            "from scipy import stats",
            "import seaborn as sns",
            "import matplotlib.pyplot as plt",
            "",
            f"# Dataset is pre-loaded as 'df' by the execution environment",
            f"# Session: {session_id}",
            "",
        ]

        # Data cleaning
        if wrangling_config:
            cleaning_code = self._generate_cleaning_code_python(wrangling_config)
            if cleaning_code.strip():
                parts.append(cleaning_code)
                parts.append("")

        # Derived variables
        if derived_variables:
            transform_code = self._generate_transform_code_python(derived_variables)
            if transform_code.strip():
                parts.append(transform_code)
                parts.append("")

        # Analyses
        if analyses:
            analysis_code = self._generate_analysis_code_python(analyses)
            if analysis_code.strip():
                parts.append(analysis_code)
                parts.append("")

        parts.extend([
            "# Display summary",
            "print(f'Dataset shape: {df.shape}')",
            "print(f'Columns: {list(df.columns)}')",
            "print(df.head())",
        ])

        return "\n".join(parts)

    def _generate_cleaning_code_python(self, wrangling_config: Dict) -> str:
        """Generate Python code for data cleaning operations."""
        code_lines = ["# === Data Cleaning ==="]

        # Label standardization
        if wrangling_config.get('label_standardization'):
            for col, mappings in wrangling_config['label_standardization'].items():
                if mappings:
                    code_lines.append(f"df['{col}'] = df['{col}'].replace({mappings})")

        # Missing data handling
        if wrangling_config.get('missing_data_strategy'):
            for col, strategy in wrangling_config['missing_data_strategy'].items():
                if strategy == 'drop':
                    code_lines.append(f"df = df.dropna(subset=['{col}'])")
                elif strategy == 'impute_mean':
                    code_lines.append(f"df['{col}'].fillna(df['{col}'].mean(), inplace=True)")
                elif strategy == 'impute_median':
                    code_lines.append(f"df['{col}'].fillna(df['{col}'].median(), inplace=True)")

        # Duplicate handling
        if wrangling_config.get('duplicate_handling'):
            handling = wrangling_config['duplicate_handling']
            if handling == 'drop_all':
                if wrangling_config.get('duplicate_id_column'):
                    col = wrangling_config['duplicate_id_column']
                    code_lines.append(f"df = df.drop_duplicates(subset=['{col}'], keep=False)")
                else:
                    code_lines.append("df = df.drop_duplicates(keep=False)")
            elif handling == 'keep_first':
                if wrangling_config.get('duplicate_id_column'):
                    col = wrangling_config['duplicate_id_column']
                    code_lines.append(f"df = df.drop_duplicates(subset=['{col}'], keep='first')")
                else:
                    code_lines.append("df = df.drop_duplicates(keep='first')")

        return "\n".join(code_lines)

    def _generate_transform_code_python(self, derived_variables: List[Dict]) -> str:
        """Generate Python code for derived variable transformations."""
        code_lines = ["# === Derived Variables ==="]

        for var in derived_variables:
            name = var['name']
            # Try both 'formula' (from DB) and 'transform_formula' (legacy)
            formula = var.get('formula') or var.get('transform_formula', '')

            if not formula:
                # Skip variables with no formula
                continue

            formula_type = var.get('formula_type', 'eval')

            # Convert backticks to quotes for Python (backticks are for R, not Python)
            formula = self._convert_backticks_to_quotes_python(formula)

            # Convert df["column"] to df['column'] for consistency
            formula = self._normalize_python_column_refs(formula)

            # Check if formula uses transformation functions (map_binary, etc.)
            # These need df as first argument
            formula = self._fix_transformation_function_calls(formula)

            # Handle different formula types
            # 'eval' and 'expression' are treated the same - direct pandas expressions
            if formula_type in ('eval', 'expression', 'python'):
                # Direct pandas expression
                code_lines.append(f"df['{name}'] = {formula}")
            elif formula_type == 'function':
                # Function-based transformation
                code_lines.append(f"df['{name}'] = df.apply(lambda row: {formula}, axis=1)")
            else:
                # Default to direct expression for unknown types
                code_lines.append(f"df['{name}'] = {formula}")

        return "\n".join(code_lines)

    def _fix_transformation_function_calls(self, formula: str) -> str:
        """Fix transformation function calls to include df as first argument."""
        import re
        if not formula:
            return formula

        # List of transformation functions that need df as first argument
        transform_funcs = [
            'map_binary', 'map_categorical', 'normalize', 'z_score',
            'composite_score', 'conditional_value', 'conditional_numeric',
            'percentile_rank', 'bin_numeric', 'log_transform', 'winsorize'
        ]

        # Pattern: function_name(args) → function_name(df, args)
        for func in transform_funcs:
            # Match function_name( but not already function_name(df,
            pattern = rf'\b{func}\s*\((?!df\s*,)'
            replacement = f'{func}(df, '
            formula = re.sub(pattern, replacement, formula)

        return formula

    def _convert_backticks_to_quotes_python(self, formula: str) -> str:
        """Convert backticks (R-style column names) to single quotes for Python."""
        import re
        if not formula:
            return formula
        # Replace `column name` with 'column name' (just remove backticks)
        # For transformation functions like map_binary('column', {...}),
        # the column name should be a string, not df['column']
        formula = re.sub(r'`([^`]+)`', r"'\1'", formula)
        return formula

    def _normalize_python_column_refs(self, formula: str) -> str:
        """Normalize Python column references to use single quotes."""
        import re
        if not formula:
            return formula
        # Convert df["column"] to df['column'] for consistency
        formula = re.sub(r'df\["([^"]+)"\]', r"df['\1']", formula)
        return formula

    def _generate_analysis_code_python(self, analyses: List[Dict]) -> str:
        """Generate Python code for statistical analyses."""
        code_lines = ["# === Statistical Analyses ==="]

        for analysis in analyses:
            if not analysis.get('execution_spec'):
                continue

            spec = analysis['execution_spec']
            library = spec.get('library', 'scipy.stats')
            function = spec.get('function', '')
            param_map = spec.get('param_map', {})

            # scipy.stats analyses
            if library == 'scipy.stats':
                if function == 'ttest_ind':
                    group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                    if group_col and value_col:
                        code_lines.extend([
                            f"# Independent t-test: {value_col} by {group_col}",
                            f"groups = df['{group_col}'].unique()",
                            f"group1 = df[df['{group_col}'] == groups[0]]['{value_col}']",
                            f"group2 = df[df['{group_col}'] == groups[1]]['{value_col}']",
                            f"t_stat, p_value = stats.ttest_ind(group1, group2)",
                            f"print(f'Independent t-test: t={{t_stat:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'ttest_rel':
                    col1, col2 = param_map.get('col1'), param_map.get('col2')
                    if col1 and col2:
                        code_lines.extend([
                            f"# Paired t-test: {col1} vs {col2}",
                            f"t_stat, p_value = stats.ttest_rel(df['{col1}'], df['{col2}'])",
                            f"print(f'Paired t-test: t={{t_stat:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'f_oneway':
                    group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                    if group_col and value_col:
                        code_lines.extend([
                            f"# One-way ANOVA: {value_col} by {group_col}",
                            f"groups = df['{group_col}'].unique()",
                            f"group_data = [df[df['{group_col}'] == g]['{value_col}'] for g in groups]",
                            f"f_stat, p_value = stats.f_oneway(*group_data)",
                            f"print(f'One-way ANOVA: F={{f_stat:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'pearsonr':
                    x_col, y_col = param_map.get('x_col'), param_map.get('y_col')
                    if x_col and y_col:
                        code_lines.extend([
                            f"# Pearson correlation: {x_col} vs {y_col}",
                            f"r, p_value = stats.pearsonr(df['{x_col}'], df['{y_col}'])",
                            f"print(f'Pearson correlation: r={{r:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'spearmanr':
                    x_col, y_col = param_map.get('x_col'), param_map.get('y_col')
                    if x_col and y_col:
                        code_lines.extend([
                            f"# Spearman correlation: {x_col} vs {y_col}",
                            f"rho, p_value = stats.spearmanr(df['{x_col}'], df['{y_col}'])",
                            f"print(f'Spearman correlation: rho={{rho:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'kendalltau':
                    x_col, y_col = param_map.get('x_col'), param_map.get('y_col')
                    if x_col and y_col:
                        code_lines.extend([
                            f"# Kendall's tau correlation: {x_col} vs {y_col}",
                            f"tau, p_value = stats.kendalltau(df['{x_col}'], df['{y_col}'])",
                            f"print(f'Kendall tau correlation: tau={{tau:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'chi2_contingency':
                    row_col = param_map.get('row_col') or param_map.get('var1')
                    col_col = param_map.get('col_col') or param_map.get('var2')
                    if row_col and col_col:
                        code_lines.extend([
                            f"# Chi-square test: {row_col} vs {col_col}",
                            f"contingency_table = pd.crosstab(df['{row_col}'], df['{col_col}'])",
                            f"chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)",
                            f"print(f'Chi-square test: chi2={{chi2:.3f}}, p={{p_value:.4f}}, dof={{dof}}')",
                            ""
                        ])

                elif function == 'mannwhitneyu':
                    group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                    if group_col and value_col:
                        code_lines.extend([
                            f"# Mann-Whitney U test: {value_col} by {group_col}",
                            f"groups = df['{group_col}'].unique()",
                            f"group1 = df[df['{group_col}'] == groups[0]]['{value_col}'].dropna()",
                            f"group2 = df[df['{group_col}'] == groups[1]]['{value_col}'].dropna()",
                            f"u_stat, p_value = stats.mannwhitneyu(group1, group2, alternative='two-sided')",
                            f"print(f'Mann-Whitney U test: U={{u_stat:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'wilcoxon':
                    col1, col2 = param_map.get('col1'), param_map.get('col2')
                    if col1 and col2:
                        code_lines.extend([
                            f"# Wilcoxon signed-rank test: {col1} vs {col2}",
                            f"w_stat, p_value = stats.wilcoxon(df['{col1}'], df['{col2}'])",
                            f"print(f'Wilcoxon test: W={{w_stat:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

                elif function == 'kruskal':
                    group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                    if group_col and value_col:
                        code_lines.extend([
                            f"# Kruskal-Wallis test: {value_col} by {group_col}",
                            f"groups = df['{group_col}'].unique()",
                            f"group_data = [df[df['{group_col}'] == g]['{value_col}'].dropna() for g in groups]",
                            f"h_stat, p_value = stats.kruskal(*group_data)",
                            f"print(f'Kruskal-Wallis test: H={{h_stat:.3f}}, p={{p_value:.4f}}')",
                            ""
                        ])

            # statsmodels analyses
            elif library == 'statsmodels' or library == 'statsmodels.formula.api':
                if function == 'ols':
                    dependent = param_map.get('dependent')
                    independent = param_map.get('independent')
                    if dependent and independent:
                        code_lines.extend([
                            f"# OLS Regression: {dependent} ~ {independent}",
                            "import statsmodels.formula.api as smf",
                            f"model = smf.ols('{dependent} ~ {independent}', data=df).fit()",
                            "print(model.summary())",
                            f"print(f'R-squared: {{model.rsquared:.3f}}, Adj R-squared: {{model.rsquared_adj:.3f}}')",
                            ""
                        ])

        return "\n".join(code_lines)

    # ============================================================
    # R CODE GENERATION
    # ============================================================

    def _generate_r_script(
        self,
        session_id: str,
        wrangling_config: Optional[Dict],
        derived_variables: Optional[List[Dict]],
        analyses: Optional[List[Dict]]
    ) -> str:
        """Generate complete R script."""

        parts = [
            "# Inferra Data Analysis - R",
            "# Auto-generated from UI operations",
            "",
            "library(dplyr)",
            "library(tidyr)",
            "library(ggplot2)",
            "",
            f"# Dataset is pre-loaded as 'df' by the execution environment",
            f"# Session: {session_id}",
            "",
        ]

        # Data cleaning
        if wrangling_config:
            cleaning_code = self._generate_cleaning_code_r(wrangling_config)
            if cleaning_code.strip():
                parts.append(cleaning_code)
                parts.append("")

        # Derived variables
        if derived_variables:
            transform_code = self._generate_transform_code_r(derived_variables)
            if transform_code.strip():
                parts.append(transform_code)
                parts.append("")

        # Analyses
        if analyses:
            analysis_code = self._generate_analysis_code_r(analyses)
            if analysis_code.strip():
                parts.append(analysis_code)
                parts.append("")

        parts.extend([
            "# Display summary",
            "cat('Dataset dimensions:', nrow(df), 'rows x', ncol(df), 'columns\\n')",
            "cat('Columns:', paste(colnames(df), collapse=', '), '\\n')",
            "print(head(df))",
        ])

        return "\n".join(parts)

    def _generate_cleaning_code_r(self, wrangling_config: Dict) -> str:
        """Generate R code for data cleaning operations."""
        code_lines = ["# === Data Cleaning ==="]

        # Label standardization
        if wrangling_config.get('label_standardization'):
            for col, mappings in wrangling_config['label_standardization'].items():
                if mappings:
                    # Convert Python dict to R named vector syntax
                    recode_pairs = ", ".join([f"'{k}' = '{v}'" for k, v in mappings.items()])
                    # Quote column name if it contains spaces
                    col_ref = self._quote_r_column(col)
                    code_lines.append(f"df <- df %>% mutate({col_ref} = recode({col_ref}, {recode_pairs}))")

        # Missing data handling
        if wrangling_config.get('missing_data_strategy'):
            for col, strategy in wrangling_config['missing_data_strategy'].items():
                # Quote column name if it contains spaces
                col_ref = self._quote_r_column(col)
                if strategy == 'drop':
                    code_lines.append(f"df <- df %>% drop_na({col_ref})")
                elif strategy == 'impute_mean':
                    code_lines.append(f"df <- df %>% mutate({col_ref} = ifelse(is.na({col_ref}), mean({col_ref}, na.rm=TRUE), {col_ref}))")
                elif strategy == 'impute_median':
                    code_lines.append(f"df <- df %>% mutate({col_ref} = ifelse(is.na({col_ref}), median({col_ref}, na.rm=TRUE), {col_ref}))")

        # Duplicate handling
        if wrangling_config.get('duplicate_handling'):
            handling = wrangling_config['duplicate_handling']
            if handling in ['drop_all', 'keep_first']:
                if wrangling_config.get('duplicate_id_column'):
                    col = wrangling_config['duplicate_id_column']
                    col_ref = self._quote_r_column(col)
                    if handling == 'keep_first':
                        code_lines.append(f"df <- df %>% distinct({col_ref}, .keep_all = TRUE)")
                    else:
                        # Drop all duplicates (keep none)
                        code_lines.append(f"df <- df %>% group_by({col_ref}) %>% filter(n() == 1) %>% ungroup()")
                else:
                    code_lines.append("df <- df %>% distinct()")

        return "\n".join(code_lines)

    def _quote_r_column(self, col_name: str) -> str:
        """Quote R column name with backticks if it contains spaces or special chars."""
        # If column name has spaces or starts with a number, use backticks
        if ' ' in col_name or col_name[0].isdigit() or not col_name.replace('_', '').isalnum():
            return f"`{col_name}`"
        return col_name

    def _generate_transform_code_r(self, derived_variables: List[Dict]) -> str:
        """Generate R code for derived variable transformations."""
        code_lines = ["# === Derived Variables ==="]

        for var in derived_variables:
            name = var['name']
            # Try both 'formula' (from DB) and 'transform_formula' (legacy)
            formula = var.get('formula') or var.get('transform_formula', '')

            if not formula:
                continue

            # Convert Python-style formula to R syntax
            r_formula = self._convert_formula_to_r(formula)

            # Fix transformation function calls to include df as first argument
            r_formula = self._fix_r_transformation_calls(r_formula)

            code_lines.append(f"df <- df %>% mutate({name} = {r_formula})")

        return "\n".join(code_lines)

    def _fix_r_transformation_calls(self, formula: str) -> str:
        """Fix R transformation function calls to include df as first argument."""
        import re
        if not formula:
            return formula

        # List of transformation functions that need df as first argument
        transform_funcs = [
            'map_binary', 'map_categorical', 'normalize', 'z_score',
            'composite_score', 'conditional_value', 'conditional_numeric',
            'percentile_rank', 'bin_numeric', 'log_transform', 'winsorize'
        ]

        # Pattern: function_name(args) → function_name(df, args)
        for func in transform_funcs:
            # Match function_name( but not already function_name(df,
            pattern = rf'\b{func}\s*\((?!df\s*,)'
            replacement = f'{func}(df, '
            formula = re.sub(pattern, replacement, formula)

        return formula

    def _convert_formula_to_r(self, formula: str) -> str:
        """Convert Python-style formula to R syntax."""
        import re

        r_formula = formula

        # Convert numpy functions
        r_formula = r_formula.replace('np.log', 'log')
        r_formula = r_formula.replace('np.exp', 'exp')
        r_formula = r_formula.replace('np.sqrt', 'sqrt')
        r_formula = r_formula.replace('np.abs', 'abs')

        # Convert pandas functions
        r_formula = r_formula.replace('pd.cut', 'cut')

        # Convert Python dict syntax to R named vector: {'key': value, ...} → c('key' = value, ...)
        # This handles map_binary and similar functions
        def convert_dict_to_named_vector(match):
            dict_content = match.group(1)
            # Replace colons with equals for R named vector syntax
            # 'key': value → 'key' = value
            converted = re.sub(r"'([^']+)':\s*", r"'\1' = ", dict_content)
            converted = re.sub(r'"([^"]+)":\s*', r'"\1" = ', converted)
            return f"c({converted})"

        r_formula = re.sub(r'\{([^}]+)\}', convert_dict_to_named_vector, r_formula)

        # Convert df["column"] to df$column or `column` if it has spaces
        # Match df["column_name"] or df['column_name']
        def convert_df_column(match):
            col_name = match.group(1)
            if ' ' in col_name or col_name[0].isdigit():
                return f'`{col_name}`'
            return col_name

        r_formula = re.sub(r'df\["([^"]+)"\]', convert_df_column, r_formula)
        r_formula = re.sub(r"df\['([^']+)'\]", convert_df_column, r_formula)

        # Convert backticks to backticks (column references in formulas)
        # Already handled above, just ensure they're preserved

        # Convert Python list syntax to R vector syntax (for non-dict lists)
        # [1, 2, 3] → c(1, 2, 3)
        # ["a", "b", "c"] → c("a", "b", "c")
        # Note: This is now after dict conversion, so dicts are already handled
        r_formula = re.sub(r'\[([^\]]+)\]', r'c(\1)', r_formula)

        # Convert pandas cut() parameters: bins= → breaks=
        r_formula = r_formula.replace('bins=', 'breaks=')

        # Convert pandas method calls to R function calls
        # Pattern: df$column.method() → method(df$column, na.rm=TRUE)
        # Must match the full df$column_name expression

        # Handle quantile specially (needs probs parameter)
        r_formula = re.sub(r'(df\$\w+)\.quantile\(([^)]+)\)', r'quantile(\1, probs=\2, na.rm=TRUE)', r_formula)

        # Convert other methods: .min(), .max(), .mean(), .std(), etc.
        r_formula = re.sub(r'(df\$\w+)\.min\(\)', r'min(\1, na.rm=TRUE)', r_formula)
        r_formula = re.sub(r'(df\$\w+)\.max\(\)', r'max(\1, na.rm=TRUE)', r_formula)
        r_formula = re.sub(r'(df\$\w+)\.mean\(\)', r'mean(\1, na.rm=TRUE)', r_formula)
        r_formula = re.sub(r'(df\$\w+)\.median\(\)', r'median(\1, na.rm=TRUE)', r_formula)
        r_formula = re.sub(r'(df\$\w+)\.std\(\)', r'sd(\1, na.rm=TRUE)', r_formula)
        r_formula = re.sub(r'(df\$\w+)\.sum\(\)', r'sum(\1, na.rm=TRUE)', r_formula)

        return r_formula

    def _generate_analysis_code_r(self, analyses: List[Dict]) -> str:
        """Generate R code for statistical analyses."""
        code_lines = ["# === Statistical Analyses ==="]

        for analysis in analyses:
            if not analysis.get('execution_spec'):
                continue

            spec = analysis['execution_spec']
            function = spec.get('function', '')
            param_map = spec.get('param_map', {})

            # R stats analyses
            if function == 'ttest_ind':
                group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                if group_col and value_col:
                    code_lines.extend([
                        f"# Independent t-test: {value_col} by {group_col}",
                        f"result <- t.test({value_col} ~ {group_col}, data = df)",
                        "print(result)",
                        ""
                    ])

            elif function == 'ttest_rel':
                col1, col2 = param_map.get('col1'), param_map.get('col2')
                if col1 and col2:
                    code_lines.extend([
                        f"# Paired t-test: {col1} vs {col2}",
                        f"result <- t.test(df${col1}, df${col2}, paired = TRUE)",
                        "print(result)",
                        ""
                    ])

            elif function == 'f_oneway':
                group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                if group_col and value_col:
                    code_lines.extend([
                        f"# One-way ANOVA: {value_col} by {group_col}",
                        f"result <- aov({value_col} ~ {group_col}, data = df)",
                        "print(summary(result))",
                        ""
                    ])

            elif function == 'pearsonr':
                x_col, y_col = param_map.get('x_col'), param_map.get('y_col')
                if x_col and y_col:
                    code_lines.extend([
                        f"# Pearson correlation: {x_col} vs {y_col}",
                        f"result <- cor.test(df${x_col}, df${y_col}, method = 'pearson')",
                        "print(result)",
                        ""
                    ])

            elif function == 'spearmanr':
                x_col, y_col = param_map.get('x_col'), param_map.get('y_col')
                if x_col and y_col:
                    code_lines.extend([
                        f"# Spearman correlation: {x_col} vs {y_col}",
                        f"result <- cor.test(df${x_col}, df${y_col}, method = 'spearman')",
                        "print(result)",
                        ""
                    ])

            elif function == 'kendalltau':
                x_col, y_col = param_map.get('x_col'), param_map.get('y_col')
                if x_col and y_col:
                    code_lines.extend([
                        f"# Kendall's tau correlation: {x_col} vs {y_col}",
                        f"result <- cor.test(df${x_col}, df${y_col}, method = 'kendall')",
                        "print(result)",
                        ""
                    ])

            elif function == 'chi2_contingency':
                row_col = param_map.get('row_col') or param_map.get('var1')
                col_col = param_map.get('col_col') or param_map.get('var2')
                if row_col and col_col:
                    code_lines.extend([
                        f"# Chi-square test: {row_col} vs {col_col}",
                        f"contingency_table <- table(df${row_col}, df${col_col})",
                        "result <- chisq.test(contingency_table)",
                        "print(result)",
                        ""
                    ])

            elif function == 'mannwhitneyu':
                group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                if group_col and value_col:
                    code_lines.extend([
                        f"# Mann-Whitney U test: {value_col} by {group_col}",
                        f"result <- wilcox.test({value_col} ~ {group_col}, data = df)",
                        "print(result)",
                        ""
                    ])

            elif function == 'wilcoxon':
                col1, col2 = param_map.get('col1'), param_map.get('col2')
                if col1 and col2:
                    code_lines.extend([
                        f"# Wilcoxon signed-rank test: {col1} vs {col2}",
                        f"result <- wilcox.test(df${col1}, df${col2}, paired = TRUE)",
                        "print(result)",
                        ""
                    ])

            elif function == 'kruskal':
                group_col, value_col = param_map.get('group_col'), param_map.get('value_col')
                if group_col and value_col:
                    code_lines.extend([
                        f"# Kruskal-Wallis test: {value_col} by {group_col}",
                        f"result <- kruskal.test({value_col} ~ {group_col}, data = df)",
                        "print(result)",
                        ""
                    ])

            elif function == 'ols':
                dependent = param_map.get('dependent')
                independent = param_map.get('independent')
                if dependent and independent:
                    code_lines.extend([
                        f"# OLS Regression: {dependent} ~ {independent}",
                        f"model <- lm({dependent} ~ {independent}, data = df)",
                        "print(summary(model))",
                        ""
                    ])

        return "\n".join(code_lines)


# Singleton instance
code_generator = CodeGenerator()
