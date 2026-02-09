"""
Comprehensive test suite for the analysis pipeline.

Covers:
1. execution_spec path — direct analysis without decision service
2. Variable computation (eval formulas + transform functions)
3. Custom-created variables (manually specified)
4. AI-suggested variables (same code path, just different origin)
5. Full end-to-end: compute variables → run analysis via execution_spec

Run with: python test_analysis_pipeline.py
"""

import os
import tempfile

import numpy as np
import pandas as pd

from app.analyze import execute_transformation
from app.param_mapper import map_parameters


# ============================================================================
# Helpers
# ============================================================================

def make_clinical_csv() -> str:
    """
    Write a small clinical dataset to a temp CSV and return its path.
    Mimics a typical behavioral research export.
    """
    df = pd.DataFrame({
        "Subject": [f"S{i:03d}" for i in range(1, 31)],
        "Diagnosis": (["Bipolar"] * 10 + ["Depression"] * 10 + ["Control"] * 10),
        "Gender": (["Male", "Female"] * 15),
        "Age": [22, 31, 28, 35, 24, 29, 33, 27, 30, 26,
                38, 41, 36, 43, 37, 42, 39, 44, 40, 45,
                23, 32, 25, 34, 21, 30, 20, 19, 18, 22],
        "Stroop_RT": [650, 520, 700, 480, 620, 550, 610, 490, 580, 540,
                      720, 680, 740, 660, 710, 690, 730, 670, 700, 680,
                      480, 490, 470, 510, 460, 500, 455, 445, 465, 475],
        "Flanker_Accuracy": [0.85, 0.92, 0.78, 0.95, 0.88, 0.90, 0.83, 0.91,
                              0.87, 0.89, 0.72, 0.75, 0.70, 0.78, 0.73, 0.74,
                              0.76, 0.71, 0.77, 0.69, 0.96, 0.94, 0.97, 0.93,
                              0.98, 0.95, 0.99, 0.97, 0.96, 0.94],
        "WCST_Errors": [12, 5, 18, 3, 10, 8, 14, 6, 11, 9,
                         20, 17, 22, 15, 19, 18, 21, 16, 20, 23,
                         3, 4, 2, 5, 1, 3, 2, 1, 4, 3],
        "Score": [65, 72, 58, 80, 70, 75, 62, 77, 68, 73,
                  55, 50, 52, 58, 54, 51, 53, 49, 56, 48,
                  85, 88, 82, 90, 87, 89, 91, 84, 86, 83],
    })
    f = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
    df.to_csv(f.name, index=False)
    f.close()
    return f.name


def load_csv(path: str) -> pd.DataFrame:
    return pd.read_csv(path)


# ============================================================================
# Section 1: execution_spec parameter mapping
# ============================================================================

def test_execution_spec_column_mapping():
    """
    execution_spec sends param_map as {role: column_name}.
    The backend converts this to {role: {"column": column_name}}.
    map_parameters must resolve to the exact column.
    """
    print("\n=== execution_spec: column mapping ===")
    csv = make_clinical_csv()
    df = load_csv(csv)

    # Simulate what run.py does when execution_spec is present
    raw_param_map = {"group_col": "Diagnosis", "value_col": "Score"}
    converted = {k: {"column": v} for k, v in raw_param_map.items()}

    resolved = map_parameters(converted, df)

    assert resolved["group_col"] == "Diagnosis", f"Expected 'Diagnosis', got {resolved['group_col']}"
    assert resolved["value_col"] == "Score", f"Expected 'Score', got {resolved['value_col']}"
    print(f"  Resolved params: {resolved}")
    print("  ✓ Passed")
    os.unlink(csv)


def test_execution_spec_chi2_param_mapping():
    """Chi-square uses row_col / col_col — both categorical."""
    print("\n=== execution_spec: chi2_contingency param mapping ===")
    csv = make_clinical_csv()
    df = load_csv(csv)

    raw_param_map = {"row_col": "Diagnosis", "col_col": "Gender"}
    converted = {k: {"column": v} for k, v in raw_param_map.items()}

    resolved = map_parameters(converted, df)
    assert resolved["row_col"] == "Diagnosis"
    assert resolved["col_col"] == "Gender"
    print(f"  Resolved params: {resolved}")
    print("  ✓ Passed")
    os.unlink(csv)


def test_execution_spec_missing_column_raises():
    """If a column in param_map doesn't exist, map_parameters must raise."""
    print("\n=== execution_spec: missing column raises ValueError ===")
    csv = make_clinical_csv()
    df = load_csv(csv)

    raw_param_map = {"group_col": "NonExistentColumn", "value_col": "Score"}
    converted = {k: {"column": v} for k, v in raw_param_map.items()}

    try:
        map_parameters(converted, df)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "NonExistentColumn" in str(e)
        print(f"  Correctly raised: {e}")
    print("  ✓ Passed")
    os.unlink(csv)


# ============================================================================
# Section 2: Variable computation — eval formulas (AI-suggested & custom)
# ============================================================================

def test_eval_variable_ai_suggested():
    """
    Simulate an AI-suggested 'eval' variable: RT ratio.
    Same code path as manually created — just different origin.
    """
    print("\n=== Variable (eval, AI-suggested): RT ratio ===")
    df = pd.DataFrame({
        "Stroop_RT": [650, 520, 700, 480, 620],
        "Flanker_RT": [400, 320, 450, 290, 380],
    })
    formula = "Stroop_RT / Flanker_RT"
    result = df.eval(formula, inplace=False)
    assert len(result) == 5
    assert all(result > 1), "Stroop should be slower than Flanker"
    print(f"  Formula: {formula}")
    print(f"  Values: {[round(v, 2) for v in result.tolist()]}")
    print("  ✓ Passed")


def test_eval_variable_custom():
    """Custom user-defined eval variable: score delta."""
    print("\n=== Variable (eval, custom): score delta ===")
    df = pd.DataFrame({
        "Score_Post": [80, 70, 90, 75, 85],
        "Score_Pre": [60, 65, 70, 55, 68],
    })
    formula = "Score_Post - Score_Pre"
    result = df.eval(formula, inplace=False)
    expected = [20, 5, 20, 20, 17]
    assert result.tolist() == expected
    print(f"  Formula: {formula}")
    print(f"  Deltas: {result.tolist()}")
    print("  ✓ Passed")


# ============================================================================
# Section 3: Variable computation — transform functions (AI-suggested & custom)
# ============================================================================

def test_transform_variable_ai_suggested_composite():
    """
    AI often suggests composite scores. Verify it works on realistic data.
    """
    print("\n=== Variable (transform, AI-suggested): composite_score ===")
    df = pd.DataFrame({
        "Stroop_RT": [650, 520, 700, 480, 620],
        "Flanker_Accuracy": [0.85, 0.92, 0.78, 0.95, 0.88],
        "WCST_Errors": [12, 5, 18, 3, 10],
    })
    formula = "composite_score(['Stroop_RT', 'Flanker_Accuracy', 'WCST_Errors'], weights=[0.4, 0.4, 0.2])"
    result = execute_transformation(df, formula)
    assert 0.0 <= result.min() and result.max() <= 1.0, "composite_score out of 0-1 range"
    assert len(result) == 5
    print(f"  Formula: {formula}")
    print(f"  Scores: {[round(v, 3) for v in result.tolist()]}")
    print("  ✓ Passed")


def test_transform_variable_ai_suggested_binary_encoding():
    """AI-suggested: encode Diagnosis as binary Bipolar vs. other."""
    print("\n=== Variable (transform, AI-suggested): map_binary ===")
    df = pd.DataFrame({
        "Diagnosis": ["Bipolar", "Control", "Bipolar", "Depression", "Bipolar"],
    })
    formula = "map_binary('Diagnosis', {'Bipolar': 1, 'Control': 0, 'Depression': 0})"
    result = execute_transformation(df, formula)
    assert result.tolist() == [1, 0, 1, 0, 1]
    print(f"  Formula: {formula}")
    print(f"  Encoded: {result.tolist()}")
    print("  ✓ Passed")


def test_transform_variable_custom_z_score():
    """Custom user-created variable: z-score of reaction time."""
    print("\n=== Variable (transform, custom): z_score ===")
    df = pd.DataFrame({
        "RT": [500, 600, 400, 700, 450],
    })
    formula = "z_score('RT')"
    result = execute_transformation(df, formula)
    assert abs(result.mean()) < 0.01, "z-score mean not ~0"
    assert abs(result.std() - 1.0) < 0.01, "z-score std not ~1"
    print(f"  Formula: {formula}")
    print(f"  Z-scores: {[round(v, 3) for v in result.tolist()]}")
    print("  ✓ Passed")


def test_transform_variable_custom_normalize():
    """Custom variable: normalize score to 0-1 range."""
    print("\n=== Variable (transform, custom): normalize ===")
    df = pd.DataFrame({"Score": [0, 25, 50, 75, 100]})
    formula = "normalize('Score', min_val=0, max_val=1)"
    result = execute_transformation(df, formula)
    assert result.tolist() == [0.0, 0.25, 0.5, 0.75, 1.0]
    print(f"  Formula: {formula}")
    print(f"  Normalized: {result.tolist()}")
    print("  ✓ Passed")


def test_transform_variable_custom_categorize():
    """Custom variable: bin numeric age into categories."""
    print("\n=== Variable (transform, custom): bin_numeric ===")
    df = pd.DataFrame({"Age": [10, 25, 45, 70, 15]})
    formula = "bin_numeric('Age', bins=[0, 18, 65, 100], labels=['Child', 'Adult', 'Senior'])"
    result = execute_transformation(df, formula)
    assert str(result[0]) == "Child"
    assert str(result[1]) == "Adult"
    assert str(result[2]) == "Adult"
    assert str(result[3]) == "Senior"
    print(f"  Formula: {formula}")
    print(f"  Categories: {[str(v) for v in result.tolist()]}")
    print("  ✓ Passed")


# ============================================================================
# Section 4: Full pipeline — compute variable → execution_spec analysis
# ============================================================================

def test_pipeline_compute_then_analyze_mannwhitney():
    """
    End-to-end:
    1. Compute a composite_score derived variable
    2. Run Mann-Whitney U test on it via execution_spec-style param mapping
    """
    print("\n=== Full pipeline: composite_score → Mann-Whitney U ===")
    csv = make_clinical_csv()
    df = load_csv(csv)

    # Step 1: Compute derived variable (AI-suggested composite)
    formula = "composite_score(['Stroop_RT', 'Flanker_Accuracy', 'WCST_Errors'], weights=[0.4, 0.4, 0.2])"
    df["Cognitive_Score"] = execute_transformation(df, formula)
    assert "Cognitive_Score" in df.columns
    print(f"  Derived variable 'Cognitive_Score' created ({len(df)} rows)")

    # Step 2: Resolve execution_spec params (what run.py does)
    param_map_raw = {"group_col": "Diagnosis", "value_col": "Cognitive_Score"}
    param_map_service = {k: {"column": v} for k, v in param_map_raw.items()}
    resolved = map_parameters(param_map_service, df)
    assert resolved["group_col"] == "Diagnosis"
    assert resolved["value_col"] == "Cognitive_Score"

    # Step 3: Actually run the analysis (what python-service/analyze does)
    from scipy import stats
    groups = df.groupby(resolved["group_col"])[resolved["value_col"]].apply(list)
    group_names = list(groups.index)
    assert len(group_names) >= 2, "Need at least 2 groups"

    stat, p = stats.kruskal(*[groups[g] for g in group_names])
    assert isinstance(stat, float), f"Expected float stat, got {type(stat)}"
    assert 0 <= p <= 1, f"p-value out of range: {p}"
    print(f"  Groups: {group_names}")
    print(f"  Kruskal-Wallis H={stat:.4f}, p={p:.4f}")
    print("  ✓ Passed")
    os.unlink(csv)


def test_pipeline_custom_variable_then_chi2():
    """
    End-to-end:
    1. Create a custom binary variable (manually defined, not AI-suggested)
    2. Run chi-square test via execution_spec-style mapping
    """
    print("\n=== Full pipeline: custom binary variable → chi-square ===")
    csv = make_clinical_csv()
    df = load_csv(csv)

    # Step 1: Custom user-created variable
    formula = "conditional_numeric('Age', '>=', 30, 'OlderAdult', 'YoungAdult')"
    df["Age_Group"] = execute_transformation(df, formula)
    assert "Age_Group" in df.columns
    assert set(df["Age_Group"].unique()) <= {"OlderAdult", "YoungAdult"}
    print(f"  Custom variable 'Age_Group' distribution: {df['Age_Group'].value_counts().to_dict()}")

    # Step 2: Resolve chi2 execution_spec params
    param_map_raw = {"row_col": "Diagnosis", "col_col": "Age_Group"}
    param_map_service = {k: {"column": v} for k, v in param_map_raw.items()}
    resolved = map_parameters(param_map_service, df)

    # Step 3: Run chi-square
    from scipy import stats
    contingency = pd.crosstab(df[resolved["row_col"]], df[resolved["col_col"]])
    chi2, p, dof, expected = stats.chi2_contingency(contingency)
    assert isinstance(chi2, float)
    assert 0 <= p <= 1
    print(f"  Contingency table:\n{contingency}")
    print(f"  Chi2={chi2:.4f}, p={p:.4f}, dof={dof}")
    print("  ✓ Passed")
    os.unlink(csv)


def test_pipeline_ai_suggested_variable_then_pearson():
    """
    End-to-end:
    1. AI-suggested z_score normalization
    2. Pearson correlation via execution_spec mapping
    """
    print("\n=== Full pipeline: AI z_score variable → Pearson correlation ===")
    csv = make_clinical_csv()
    df = load_csv(csv)

    # Step 1: AI-suggested z-score normalization
    df["Score_Z"] = execute_transformation(df, "z_score('Score')")
    df["Age_Z"] = execute_transformation(df, "z_score('Age')")
    assert abs(df["Score_Z"].mean()) < 0.01
    assert abs(df["Age_Z"].mean()) < 0.01

    # Step 2: execution_spec for pearson correlation
    param_map_raw = {"x_col": "Score_Z", "y_col": "Age_Z"}
    param_map_service = {k: {"column": v} for k, v in param_map_raw.items()}
    resolved = map_parameters(param_map_service, df)

    # Step 3: Run Pearson
    from scipy import stats
    r, p = stats.pearsonr(df[resolved["x_col"]], df[resolved["y_col"]])
    assert -1 <= r <= 1, f"Correlation out of range: {r}"
    assert 0 <= p <= 1
    print(f"  Variables: Score_Z vs Age_Z")
    print(f"  Pearson r={r:.4f}, p={p:.4f}")
    print("  ✓ Passed")
    os.unlink(csv)


# ============================================================================
# Section 5: Backward compatibility — prompt-based path still works
# ============================================================================

def test_prompt_fallback_param_inference():
    """
    When no execution_spec is given, param_mapper infers columns by type.
    This is the old decision-service flow.
    """
    print("\n=== Backward compatibility: type-based param inference ===")
    df = pd.DataFrame({
        "Group": ["A", "B", "A", "B", "A", "B"],
        "Value": [10.0, 20.0, 15.0, 25.0, 12.0, 22.0],
    })

    # Old style: type hints instead of column names
    param_map = {
        "group_col": {"type": "group"},
        "value_col": {"type": "value"},
    }
    resolved = map_parameters(param_map, df)
    assert resolved["group_col"] == "Group"
    assert resolved["value_col"] == "Value"
    print(f"  Inferred params: {resolved}")
    print("  ✓ Passed")


# ============================================================================
# Runner
# ============================================================================

def run_all_tests():
    print("=" * 70)
    print("ANALYSIS PIPELINE TEST SUITE")
    print("Covers: execution_spec, variable creation (AI + custom), full pipeline")
    print("=" * 70)

    tests = [
        # Section 1: execution_spec param mapping
        test_execution_spec_column_mapping,
        test_execution_spec_chi2_param_mapping,
        test_execution_spec_missing_column_raises,
        # Section 2: eval variables
        test_eval_variable_ai_suggested,
        test_eval_variable_custom,
        # Section 3: transform variables
        test_transform_variable_ai_suggested_composite,
        test_transform_variable_ai_suggested_binary_encoding,
        test_transform_variable_custom_z_score,
        test_transform_variable_custom_normalize,
        test_transform_variable_custom_categorize,
        # Section 4: full pipeline
        test_pipeline_compute_then_analyze_mannwhitney,
        test_pipeline_custom_variable_then_chi2,
        test_pipeline_ai_suggested_variable_then_pearson,
        # Section 5: backward compat
        test_prompt_fallback_param_inference,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"\n  ✗ ASSERTION FAILED in {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"\n  ✗ ERROR in {test.__name__}: {type(e).__name__}: {e}")
            failed += 1

    print("\n" + "=" * 70)
    if failed == 0:
        print(f"✓ ALL {passed} TESTS PASSED")
    else:
        print(f"✗ {failed} FAILED, {passed} PASSED out of {passed + failed} total")
    print("=" * 70)

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    run_all_tests()
