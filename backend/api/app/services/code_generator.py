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
            f"# Load dataset for session: {session_id}",
            "# df = load_dataset_version(session_id, version_id)",
            "# For now, assume df is already loaded",
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
            formula = var.get('transform_formula', '')
            formula_type = var.get('formula_type', 'expression')

            if formula_type == 'expression':
                # Direct pandas expression
                code_lines.append(f"df['{name}'] = {formula}")
            elif formula_type == 'function':
                # Function-based transformation
                code_lines.append(f"df['{name}'] = df.apply(lambda row: {formula}, axis=1)")

        return "\n".join(code_lines)

    def _generate_analysis_code_python(self, analyses: List[Dict]) -> str:
        """Generate Python code for statistical analyses."""
        code_lines = ["# === Statistical Analyses ==="]

        for analysis in analyses:
            if analysis.get('execution_spec'):
                spec = analysis['execution_spec']
                library = spec.get('library', 'scipy.stats')
                function = spec.get('function', '')
                param_map = spec.get('param_map', {})

                if library == 'scipy.stats' and function == 'ttest_ind':
                    group_col = param_map.get('group_col')
                    value_col = param_map.get('value_col')
                    if group_col and value_col:
                        code_lines.append(f"# T-test: {value_col} by {group_col}")
                        code_lines.append(f"groups = df['{group_col}'].unique()")
                        code_lines.append(f"group1 = df[df['{group_col}'] == groups[0]]['{value_col}']")
                        code_lines.append(f"group2 = df[df['{group_col}'] == groups[1]]['{value_col}']")
                        code_lines.append(f"t_stat, p_value = stats.ttest_ind(group1, group2)")
                        code_lines.append(f"print(f'T-test result: t={t_stat:.3f}, p={p_value:.4f}')")

                elif library == 'scipy.stats' and function == 'chi2_contingency':
                    row_col = param_map.get('row_col')
                    col_col = param_map.get('col_col')
                    if row_col and col_col:
                        code_lines.append(f"# Chi-square test: {row_col} vs {col_col}")
                        code_lines.append(f"contingency_table = pd.crosstab(df['{row_col}'], df['{col_col}'])")
                        code_lines.append(f"chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)")
                        code_lines.append(f"print(f'Chi-square result: chi2={chi2:.3f}, p={p_value:.4f}')")

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
            f"# Load dataset for session: {session_id}",
            "# df <- load_dataset_version(session_id, version_id)",
            "# For now, assume df is already loaded",
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
                    code_lines.append(f"df <- df %>% mutate({col} = recode({col}, {recode_pairs}))")

        # Missing data handling
        if wrangling_config.get('missing_data_strategy'):
            for col, strategy in wrangling_config['missing_data_strategy'].items():
                if strategy == 'drop':
                    code_lines.append(f"df <- df %>% drop_na({col})")
                elif strategy == 'impute_mean':
                    code_lines.append(f"df <- df %>% mutate({col} = ifelse(is.na({col}), mean({col}, na.rm=TRUE), {col}))")
                elif strategy == 'impute_median':
                    code_lines.append(f"df <- df %>% mutate({col} = ifelse(is.na({col}), median({col}, na.rm=TRUE), {col}))")

        # Duplicate handling
        if wrangling_config.get('duplicate_handling'):
            handling = wrangling_config['duplicate_handling']
            if handling in ['drop_all', 'keep_first']:
                if wrangling_config.get('duplicate_id_column'):
                    col = wrangling_config['duplicate_id_column']
                    if handling == 'keep_first':
                        code_lines.append(f"df <- df %>% distinct({col}, .keep_all = TRUE)")
                    else:
                        # Drop all duplicates (keep none)
                        code_lines.append(f"df <- df %>% group_by({col}) %>% filter(n() == 1) %>% ungroup()")
                else:
                    code_lines.append("df <- df %>% distinct()")

        return "\n".join(code_lines)

    def _generate_transform_code_r(self, derived_variables: List[Dict]) -> str:
        """Generate R code for derived variable transformations."""
        code_lines = ["# === Derived Variables ==="]

        for var in derived_variables:
            name = var['name']
            formula = var.get('transform_formula', '')

            # Convert Python-style formula to R syntax
            r_formula = self._convert_formula_to_r(formula)
            code_lines.append(f"df <- df %>% mutate({name} = {r_formula})")

        return "\n".join(code_lines)

    def _convert_formula_to_r(self, formula: str) -> str:
        """Convert Python-style formula to R syntax."""
        # Basic conversions
        r_formula = formula.replace('np.log', 'log')
        r_formula = r_formula.replace('np.exp', 'exp')
        r_formula = r_formula.replace('np.sqrt', 'sqrt')
        r_formula = r_formula.replace('np.abs', 'abs')

        # Handle common patterns
        # TODO: More sophisticated conversion if needed

        return r_formula

    def _generate_analysis_code_r(self, analyses: List[Dict]) -> str:
        """Generate R code for statistical analyses."""
        code_lines = ["# === Statistical Analyses ==="]

        for analysis in analyses:
            if analysis.get('execution_spec'):
                spec = analysis['execution_spec']
                library = spec.get('library', 'stats')
                function = spec.get('function', '')
                param_map = spec.get('param_map', {})

                if function == 'ttest_ind':
                    group_col = param_map.get('group_col')
                    value_col = param_map.get('value_col')
                    if group_col and value_col:
                        code_lines.append(f"# T-test: {value_col} by {group_col}")
                        code_lines.append(f"result <- t.test({value_col} ~ {group_col}, data = df)")
                        code_lines.append("print(result)")

                elif function == 'chi2_contingency':
                    row_col = param_map.get('row_col')
                    col_col = param_map.get('col_col')
                    if row_col and col_col:
                        code_lines.append(f"# Chi-square test: {row_col} vs {col_col}")
                        code_lines.append(f"contingency_table <- table(df${row_col}, df${col_col})")
                        code_lines.append("result <- chisq.test(contingency_table)")
                        code_lines.append("print(result)")

        return "\n".join(code_lines)


# Singleton instance
code_generator = CodeGenerator()
