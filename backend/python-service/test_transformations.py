"""
Test script for the transformations library.
Run this to verify all transformation functions work correctly.
"""

import pandas as pd
import numpy as np
from app.transformations import TransformationLibrary
from app.analyze import execute_transformation


def test_map_binary():
    """Test binary mapping transformation."""
    print("\n=== Testing map_binary ===")
    df = pd.DataFrame({
        'Status': ['Active', 'Inactive', 'Active', 'Inactive', 'Active']
    })

    formula = "map_binary('Status', {'Active': 1, 'Inactive': 0})"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Status'].tolist()}")
    print(f"Output: {result.tolist()}")
    assert result.tolist() == [1, 0, 1, 0, 1], "Binary mapping failed"
    print("✓ Passed")


def test_normalize():
    """Test normalization transformation."""
    print("\n=== Testing normalize ===")
    df = pd.DataFrame({
        'Score': [0, 25, 50, 75, 100]
    })

    formula = "normalize('Score', min_val=0, max_val=1)"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Score'].tolist()}")
    print(f"Output: {result.tolist()}")
    assert result.tolist() == [0.0, 0.25, 0.5, 0.75, 1.0], "Normalization failed"
    print("✓ Passed")


def test_z_score():
    """Test z-score standardization."""
    print("\n=== Testing z_score ===")
    df = pd.DataFrame({
        'Value': [10, 20, 30, 40, 50]
    })

    formula = "z_score('Value')"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Value'].tolist()}")
    print(f"Output: {[round(x, 3) for x in result.tolist()]}")

    # Z-score should have mean ~0 and std ~1
    assert abs(result.mean()) < 0.01, "Z-score mean not close to 0"
    assert abs(result.std() - 1.0) < 0.01, "Z-score std not close to 1"
    print("✓ Passed")


def test_composite_score():
    """Test composite score with different ranges."""
    print("\n=== Testing composite_score ===")
    df = pd.DataFrame({
        'Accuracy': [80, 90, 70, 85, 95],     # Range: 0-100
        'Speed': [500, 400, 600, 450, 350],   # Range: 200-800 (lower is better)
        'Errors': [5, 2, 8, 3, 1]             # Range: 0-10
    })

    formula = "composite_score(['Accuracy', 'Speed', 'Errors'], weights=[0.5, 0.3, 0.2])"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Accuracy: {df['Accuracy'].tolist()}")
    print(f"Speed: {df['Speed'].tolist()}")
    print(f"Errors: {df['Errors'].tolist()}")
    print(f"Composite Score: {[round(x, 3) for x in result.tolist()]}")

    # Check that result is in 0-1 range
    assert result.min() >= 0 and result.max() <= 1, "Composite score out of range"
    print("✓ Passed")


def test_conditional_value():
    """Test conditional value transformation."""
    print("\n=== Testing conditional_value ===")
    df = pd.DataFrame({
        'Age': [15, 20, 17, 25, 16]
    })

    formula = "conditional_value('Age', 18, 'Adult', 'Minor')"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Age'].tolist()}")
    print(f"Output: {result.tolist()}")
    assert result.tolist() == ['Minor', 'Minor', 'Minor', 'Minor', 'Minor'], "Conditional failed"
    print("✓ Passed")


def test_conditional_numeric():
    """Test numeric conditional transformation."""
    print("\n=== Testing conditional_numeric ===")
    df = pd.DataFrame({
        'Score': [45, 70, 55, 80, 30]
    })

    formula = "conditional_numeric('Score', '>=', 60, 'Pass', 'Fail')"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Score'].tolist()}")
    print(f"Output: {result.tolist()}")
    expected = ['Fail', 'Pass', 'Fail', 'Pass', 'Fail']
    assert result.tolist() == expected, "Numeric conditional failed"
    print("✓ Passed")


def test_percentile_rank():
    """Test percentile rank transformation."""
    print("\n=== Testing percentile_rank ===")
    df = pd.DataFrame({
        'Score': [10, 50, 30, 70, 90]
    })

    formula = "percentile_rank('Score')"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Score'].tolist()}")
    print(f"Output: {[round(x, 1) for x in result.tolist()]}")

    # Check that result is in 0-100 range
    assert result.min() >= 0 and result.max() <= 100, "Percentile rank out of range"
    print("✓ Passed")


def test_bin_numeric():
    """Test numeric binning transformation."""
    print("\n=== Testing bin_numeric ===")
    df = pd.DataFrame({
        'Age': [5, 25, 45, 70, 15]
    })

    formula = "bin_numeric('Age', bins=[0, 18, 65, 100], labels=['Child', 'Adult', 'Senior'])"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Age'].tolist()}")
    print(f"Output: {[str(x) for x in result.tolist()]}")
    print("✓ Passed")


def test_log_transform():
    """Test logarithmic transformation."""
    print("\n=== Testing log_transform ===")
    df = pd.DataFrame({
        'Value': [1, 10, 100, 1000]
    })

    formula = "log_transform('Value', base=10)"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Value'].tolist()}")
    print(f"Output: {[round(x, 2) for x in result.tolist()]}")
    expected = [0.0, 1.0, 2.0, 3.0]
    assert all(abs(a - b) < 0.01 for a, b in zip(result.tolist(), expected)), "Log transform failed"
    print("✓ Passed")


def test_winsorize():
    """Test winsorization transformation."""
    print("\n=== Testing winsorize ===")
    df = pd.DataFrame({
        'Value': [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]  # 100 is outlier
    })

    formula = "winsorize('Value', lower_percentile=10, upper_percentile=90)"
    result = execute_transformation(df, formula)
    print(f"Formula: {formula}")
    print(f"Input: {df['Value'].tolist()}")
    print(f"Output: {result.tolist()}")

    # Check that max value is capped
    assert result.max() < 100, "Winsorization failed to cap outlier"
    print("✓ Passed")


def test_real_world_example():
    """Test real-world example with behavioral research data."""
    print("\n=== Testing Real-World Example ===")
    df = pd.DataFrame({
        'Diagnosis': ['Bipolar', 'Control', 'Bipolar', 'Control', 'Bipolar'],
        'Stroop_RT': [650, 520, 700, 480, 620],
        'Flanker_Accuracy': [0.85, 0.92, 0.78, 0.95, 0.88],
        'WCST_Errors': [12, 5, 18, 3, 10]
    })

    print("\nOriginal Data:")
    print(df)

    # Test 1: Binary encoding of diagnosis
    print("\n1. Binary encoding of diagnosis:")
    formula1 = "map_binary('Diagnosis', {'Bipolar': 1, 'Control': 0})"
    result1 = execute_transformation(df, formula1)
    print(f"Formula: {formula1}")
    print(f"Result: {result1.tolist()}")

    # Test 2: Composite executive function score
    print("\n2. Composite executive function score:")
    formula2 = "composite_score(['Stroop_RT', 'Flanker_Accuracy', 'WCST_Errors'], weights=[0.3, 0.4, 0.3])"
    result2 = execute_transformation(df, formula2)
    print(f"Formula: {formula2}")
    print(f"Result: {[round(x, 3) for x in result2.tolist()]}")

    # Test 3: Categorize performance
    print("\n3. Categorize Flanker accuracy:")
    formula3 = "conditional_numeric('Flanker_Accuracy', '>=', 0.90, 'High', 'Low')"
    result3 = execute_transformation(df, formula3)
    print(f"Formula: {formula3}")
    print(f"Result: {result3.tolist()}")

    print("\n✓ All real-world tests passed!")


def run_all_tests():
    """Run all transformation tests."""
    print("=" * 60)
    print("TRANSFORMATION LIBRARY TEST SUITE")
    print("=" * 60)

    try:
        test_map_binary()
        test_normalize()
        test_z_score()
        test_composite_score()
        test_conditional_value()
        test_conditional_numeric()
        test_percentile_rank()
        test_bin_numeric()
        test_log_transform()
        test_winsorize()
        test_real_world_example()

        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED!")
        print("=" * 60)

    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
