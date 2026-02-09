"""
Test code generation for Python and R.

Run this script to test code generation without needing the full API running.
"""

from app.services.code_generator import code_generator


def test_python_code_generation():
    """Test Python code generation."""
    print("=" * 60)
    print("Testing Python Code Generation")
    print("=" * 60)

    # Sample wrangling config
    wrangling_config = {
        'label_standardization': {
            'Emotion': {'sadness': 'Sadness', 'excitement': 'Excitement'}
        },
        'missing_data_strategy': {
            'age': 'impute_median',
            'reaction_time': 'drop'
        }
    }

    # Sample derived variables
    derived_variables = [
        {
            'name': 'RT_Log',
            'transform_formula': 'np.log(df["reaction_time"])',
            'formula_type': 'expression'
        },
        {
            'name': 'Age_Group',
            'transform_formula': 'pd.cut(df["age"], bins=[0, 30, 50, 100], labels=["Young", "Middle", "Senior"])',
            'formula_type': 'expression'
        }
    ]

    # Sample analyses
    analyses = [
        {
            'execution_spec': {
                'library': 'scipy.stats',
                'function': 'ttest_ind',
                'param_map': {
                    'group_col': 'Diagnosis',
                    'value_col': 'reaction_time'
                }
            }
        }
    ]

    code = code_generator.generate_full_script(
        language='python',
        session_id='test-session-123',
        wrangling_config=wrangling_config,
        derived_variables=derived_variables,
        analyses=analyses
    )

    print(code)
    print()


def test_r_code_generation():
    """Test R code generation."""
    print("=" * 60)
    print("Testing R Code Generation")
    print("=" * 60)

    # Sample wrangling config
    wrangling_config = {
        'label_standardization': {
            'Emotion': {'sadness': 'Sadness', 'excitement': 'Excitement'}
        },
        'missing_data_strategy': {
            'age': 'impute_median',
            'reaction_time': 'drop'
        }
    }

    # Sample derived variables
    derived_variables = [
        {
            'name': 'RT_Log',
            'transform_formula': 'log(reaction_time)',
            'formula_type': 'expression'
        },
        {
            'name': 'Age_Group',
            'transform_formula': 'cut(age, breaks=c(0, 30, 50, 100), labels=c("Young", "Middle", "Senior"))',
            'formula_type': 'expression'
        }
    ]

    # Sample analyses
    analyses = [
        {
            'execution_spec': {
                'library': 'stats',
                'function': 'ttest_ind',
                'param_map': {
                    'group_col': 'Diagnosis',
                    'value_col': 'reaction_time'
                }
            }
        }
    ]

    code = code_generator.generate_full_script(
        language='r',
        session_id='test-session-123',
        wrangling_config=wrangling_config,
        derived_variables=derived_variables,
        analyses=analyses
    )

    print(code)
    print()


if __name__ == "__main__":
    test_python_code_generation()
    print("\n\n")
    test_r_code_generation()
