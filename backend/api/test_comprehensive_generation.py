"""
Comprehensive test for Python and R code generation.

Tests all 11 statistical analyses and multiple transformation types.
"""

from app.services.code_generator import code_generator


def test_all_scipy_analyses():
    """Test code generation for all scipy.stats analyses."""
    print("=" * 80)
    print("Testing All Statistical Analyses - Python")
    print("=" * 80)

    # Sample analyses covering all 11 scipy functions + OLS
    analyses = [
        {
            'name': 'Independent t-test',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'ttest_ind',
                'param_map': {'group_col': 'Diagnosis', 'value_col': 'reaction_time'}
            }
        },
        {
            'name': 'Paired t-test',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'ttest_rel',
                'param_map': {'value_col1': 'pre_score', 'value_col2': 'post_score'}
            }
        },
        {
            'name': 'One-way ANOVA',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'f_oneway',
                'param_map': {'group_col': 'Condition', 'value_col': 'accuracy'}
            }
        },
        {
            'name': 'Pearson correlation',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'pearsonr',
                'param_map': {'value_col1': 'age', 'value_col2': 'reaction_time'}
            }
        },
        {
            'name': 'Spearman correlation',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'spearmanr',
                'param_map': {'value_col1': 'stress_level', 'value_col2': 'performance'}
            }
        },
        {
            'name': 'Kendall tau',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'kendalltau',
                'param_map': {'value_col1': 'rank1', 'value_col2': 'rank2'}
            }
        },
        {
            'name': 'Chi-square test',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'chi2_contingency',
                'param_map': {'row_col': 'Gender', 'col_col': 'Treatment'}
            }
        },
        {
            'name': 'Mann-Whitney U test',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'mannwhitneyu',
                'param_map': {'group_col': 'Group', 'value_col': 'score'}
            }
        },
        {
            'name': 'Wilcoxon signed-rank test',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'wilcoxon',
                'param_map': {'value_col1': 'before', 'value_col2': 'after'}
            }
        },
        {
            'name': 'Kruskal-Wallis test',
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'kruskal',
                'param_map': {'group_col': 'Treatment', 'value_col': 'outcome'}
            }
        },
        {
            'name': 'OLS Regression',
            'execution_spec': {
                'library': 'statsmodels',
                'function': 'ols',
                'param_map': {'dependent': 'salary', 'independent': 'years_experience'}
            }
        }
    ]

    code = code_generator.generate_full_script(
        language='python',
        session_id='comprehensive-test',
        wrangling_config={},
        derived_variables=[],
        analyses=analyses
    )

    print(code)
    print("\n")


def test_all_transformations():
    """Test code generation for various transformation types."""
    print("=" * 80)
    print("Testing All Transformation Types - Python & R")
    print("=" * 80)

    # Sample derived variables using different transformation patterns
    derived_variables = [
        {
            'name': 'RT_Log',
            'transform_formula': 'np.log(df["reaction_time"])',
            'formula_type': 'expression'
        },
        {
            'name': 'Age_Normalized',
            'transform_formula': '(df["age"] - df["age"].min()) / (df["age"].max() - df["age"].min())',
            'formula_type': 'expression'
        },
        {
            'name': 'High_Performer',
            'transform_formula': 'df["score"] > df["score"].quantile(0.75)',
            'formula_type': 'expression'
        },
        {
            'name': 'Composite_Score',
            'transform_formula': '0.4 * df["math"] + 0.3 * df["verbal"] + 0.3 * df["spatial"]',
            'formula_type': 'expression'
        }
    ]

    # Test Python
    python_code = code_generator.generate_full_script(
        language='python',
        session_id='transform-test',
        wrangling_config={},
        derived_variables=derived_variables,
        analyses=[]
    )

    print("PYTHON CODE:")
    print(python_code)
    print("\n" + "=" * 80 + "\n")

    # Test R
    r_code = code_generator.generate_full_script(
        language='r',
        session_id='transform-test',
        wrangling_config={},
        derived_variables=derived_variables,
        analyses=[]
    )

    print("R CODE:")
    print(r_code)
    print("\n")


def test_complete_workflow():
    """Test a complete workflow with cleaning, transforms, and analyses."""
    print("=" * 80)
    print("Testing Complete Workflow - Python and R")
    print("=" * 80)

    wrangling_config = {
        'label_standardization': {
            'Emotion': {'sadness': 'Sadness', 'joy': 'Joy', 'fear': 'Fear'},
            'Diagnosis': {'adhd': 'ADHD', 'control': 'Control'}
        },
        'missing_data_strategy': {
            'age': 'impute_median',
            'iq': 'impute_mean',
            'reaction_time': 'drop'
        },
        'duplicate_handling': 'drop_duplicates'
    }

    derived_variables = [
        {'name': 'RT_Log', 'transform_formula': 'np.log(df["reaction_time"])', 'formula_type': 'expression'},
        {'name': 'Age_Group', 'transform_formula': 'pd.cut(df["age"], bins=[0, 18, 35, 60, 100], labels=["Child", "Young Adult", "Adult", "Senior"])', 'formula_type': 'expression'},
        {'name': 'RT_Z', 'transform_formula': '(df["reaction_time"] - df["reaction_time"].mean()) / df["reaction_time"].std()', 'formula_type': 'expression'}
    ]

    analyses = [
        {
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'ttest_ind',
                'param_map': {'group_col': 'Diagnosis', 'value_col': 'RT_Log'}
            }
        },
        {
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'pearsonr',
                'param_map': {'value_col1': 'age', 'value_col2': 'RT_Log'}
            }
        },
        {
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'chi2_contingency',
                'param_map': {'row_col': 'Age_Group', 'col_col': 'Diagnosis'}
            }
        }
    ]

    # Generate Python
    python_code = code_generator.generate_full_script(
        language='python',
        session_id='complete-workflow',
        wrangling_config=wrangling_config,
        derived_variables=derived_variables,
        analyses=analyses
    )

    print("PYTHON COMPLETE WORKFLOW:")
    print(python_code)
    print("\n" + "=" * 80 + "\n")

    # Generate R
    r_code = code_generator.generate_full_script(
        language='r',
        session_id='complete-workflow',
        wrangling_config=wrangling_config,
        derived_variables=derived_variables,
        analyses=analyses
    )

    print("R COMPLETE WORKFLOW:")
    print(r_code)
    print("\n")


if __name__ == "__main__":
    test_all_scipy_analyses()
    print("\n\n")
    test_all_transformations()
    print("\n\n")
    test_complete_workflow()
