"""
Safe transformation library for derived variable formulas.

This module provides whitelisted transformation functions that can be used
in derived variable formulas with formula_type='transform'. All functions
are designed to be safe (no arbitrary code execution) and useful for
common data transformations.

Supported transformations:
- Type conversions (categorical to numeric)
- Normalization and standardization
- Composite score calculations
- Conditional logic
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Union, Optional


class TransformationLibrary:
    """Library of safe transformation functions for derived variables."""

    @staticmethod
    def map_binary(df: pd.DataFrame, column: str, mapping: Dict[Any, int]) -> pd.Series:
        """
        Map categorical values to binary (0/1) encoding.

        Args:
            df: Input dataframe
            column: Column name to transform
            mapping: Dictionary mapping values to 0 or 1

        Returns:
            Series with binary values

        Example:
            map_binary('Status', {'Yes': 1, 'No': 0})
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")
        return df[column].map(mapping)

    @staticmethod
    def map_categorical(df: pd.DataFrame, column: str, mapping: Dict[Any, Any]) -> pd.Series:
        """
        Map categorical values to other values (numeric or categorical).

        Args:
            df: Input dataframe
            column: Column name to transform
            mapping: Dictionary mapping old values to new values

        Returns:
            Series with mapped values

        Example:
            map_categorical('Grade', {'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0})
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")
        return df[column].map(mapping)

    @staticmethod
    def normalize(df: pd.DataFrame, column: str, min_val: float = 0, max_val: float = 1) -> pd.Series:
        """
        Min-max normalization to scale values to a specified range.

        Args:
            df: Input dataframe
            column: Column name to normalize
            min_val: Minimum value of output range (default: 0)
            max_val: Maximum value of output range (default: 1)

        Returns:
            Series with normalized values

        Example:
            normalize('Score', min=0, max=100)
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")

        col = df[column]

        # Check if column is numeric
        if not pd.api.types.is_numeric_dtype(col):
            raise ValueError(f"Column '{column}' must be numeric for normalization. Found type: {col.dtype}")

        col_min = col.min()
        col_max = col.max()

        if col_max == col_min:
            # Handle case where all values are the same
            return pd.Series([min_val] * len(col), index=col.index)

        normalized = (col - col_min) / (col_max - col_min)
        return min_val + normalized * (max_val - min_val)

    @staticmethod
    def z_score(df: pd.DataFrame, column: str) -> pd.Series:
        """
        Z-score normalization (standardization) to mean=0, std=1.

        Args:
            df: Input dataframe
            column: Column name to standardize

        Returns:
            Series with z-scores

        Example:
            z_score('Reaction_Time')
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")

        col = df[column]
        mean = col.mean()
        std = col.std()

        if std == 0:
            # Handle case where all values are the same
            return pd.Series([0] * len(col), index=col.index)

        return (col - mean) / std

    @staticmethod
    def composite_score(
        df: pd.DataFrame,
        columns: list,
        weights: Optional[List[float]] = None,
        normalize_first: bool = True
    ) -> pd.Series:
        """
        Calculate weighted composite score from multiple columns.

        Args:
            df: Input dataframe
            columns: List of column name strings OR pre-computed Series objects (or a mix)
            weights: List of weights for each column (default: equal weights)
            normalize_first: Whether to normalize each column before combining (default: True)

        Returns:
            Series with composite scores

        Example:
            composite_score(['Stroop_Score', 'Flanker_Score'], weights=[0.6, 0.4])
            composite_score([numeric_series, 'Flanker_Score'], weights=[0.5, 0.5])
        """
        # Resolve each element to a Series (accept both column names and Series directly)
        resolved = []
        for col in columns:
            if isinstance(col, pd.Series):
                series = col.reset_index(drop=True)
            elif isinstance(col, str):
                if col not in df.columns:
                    raise ValueError(f"Column '{col}' not found in dataset")
                series = df[col]
            else:
                raise ValueError(f"columns must be column name strings or Series, got {type(col)}")

            if not pd.api.types.is_numeric_dtype(series):
                raise ValueError(f"Column must be numeric for composite score. Found type: {series.dtype}")
            resolved.append(series)

        # Default to equal weights
        if weights is None:
            weights = [1.0 / len(resolved)] * len(resolved)

        if len(weights) != len(resolved):
            raise ValueError(f"Number of weights ({len(weights)}) must match number of columns ({len(resolved)})")

        # Normalize weights to sum to 1
        total_weight = sum(weights)
        if total_weight == 0:
            raise ValueError("Sum of weights cannot be zero")
        weights = [w / total_weight for w in weights]

        # Normalize each series if requested
        if normalize_first:
            normalized_cols = []
            for series in resolved:
                col_min, col_max = series.min(), series.max()
                if col_max == col_min:
                    normalized_cols.append(pd.Series([0.0] * len(series), index=series.index))
                else:
                    normalized_cols.append((series - col_min) / (col_max - col_min))
        else:
            normalized_cols = resolved

        # Calculate weighted sum
        result = pd.Series([0.0] * len(df), index=df.index)
        for series, weight in zip(normalized_cols, weights):
            result += weight * series.values

        return result

    @staticmethod
    def conditional_value(
        df: pd.DataFrame,
        condition_col: str,
        condition_val: Any,
        true_val: Any,
        false_val: Any
    ) -> pd.Series:
        """
        Apply conditional logic: if column equals value, return true_val, else false_val.

        Args:
            df: Input dataframe
            condition_col: Column to check condition on
            condition_val: Value to check for
            true_val: Value to return when condition is true
            false_val: Value to return when condition is false

        Returns:
            Series with conditional values

        Example:
            conditional_value('Age', 18, 'Adult', 'Minor')
        """
        if condition_col not in df.columns:
            raise ValueError(f"Column '{condition_col}' not found in dataset")

        return df[condition_col].apply(lambda x: true_val if x == condition_val else false_val)

    @staticmethod
    def conditional_numeric(
        df: pd.DataFrame,
        condition_col: str,
        operator: str,
        threshold: float,
        true_val: Any,
        false_val: Any
    ) -> pd.Series:
        """
        Apply numeric conditional logic based on comparison operators.

        Args:
            df: Input dataframe
            condition_col: Column to check condition on
            operator: Comparison operator ('>', '<', '>=', '<=', '==', '!=')
            threshold: Numeric threshold value
            true_val: Value to return when condition is true
            false_val: Value to return when condition is false

        Returns:
            Series with conditional values

        Example:
            conditional_numeric('Score', '>', 50, 'Pass', 'Fail')
        """
        if condition_col not in df.columns:
            raise ValueError(f"Column '{condition_col}' not found in dataset")

        valid_operators = {'>', '<', '>=', '<=', '==', '!='}
        if operator not in valid_operators:
            raise ValueError(f"Invalid operator '{operator}'. Must be one of {valid_operators}")

        col = df[condition_col]

        if operator == '>':
            condition = col > threshold
        elif operator == '<':
            condition = col < threshold
        elif operator == '>=':
            condition = col >= threshold
        elif operator == '<=':
            condition = col <= threshold
        elif operator == '==':
            condition = col == threshold
        else:  # operator == '!='
            condition = col != threshold

        return condition.apply(lambda x: true_val if x else false_val)

    @staticmethod
    def percentile_rank(df: pd.DataFrame, column: str) -> pd.Series:
        """
        Calculate percentile rank for each value (0-100).

        Args:
            df: Input dataframe
            column: Column name to calculate percentile ranks for

        Returns:
            Series with percentile ranks (0-100)

        Example:
            percentile_rank('Score')
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")

        return df[column].rank(pct=True) * 100

    @staticmethod
    def bin_numeric(
        df: pd.DataFrame,
        column: str,
        bins: List[float],
        labels: Optional[List[str]] = None
    ) -> pd.Series:
        """
        Bin numeric values into discrete categories.

        Args:
            df: Input dataframe
            column: Column name to bin
            bins: List of bin edges (must be in ascending order)
            labels: Optional labels for bins (length must be len(bins)-1)

        Returns:
            Series with binned values

        Example:
            bin_numeric('Age', bins=[0, 18, 65, 100], labels=['Child', 'Adult', 'Senior'])
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")

        if len(bins) < 2:
            raise ValueError("Must provide at least 2 bin edges")

        if labels is not None and len(labels) != len(bins) - 1:
            raise ValueError(f"Number of labels ({len(labels)}) must be len(bins)-1 ({len(bins)-1})")

        return pd.cut(df[column], bins=bins, labels=labels, include_lowest=True)

    @staticmethod
    def log_transform(df: pd.DataFrame, column: str, base: float = np.e) -> pd.Series:
        """
        Apply logarithmic transformation to a column.

        Args:
            df: Input dataframe
            column: Column name to transform
            base: Logarithm base (default: natural log)

        Returns:
            Series with log-transformed values

        Example:
            log_transform('Skewed_Variable', base=10)
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")

        col = df[column]

        if (col <= 0).any():
            raise ValueError(f"Cannot apply log transform to column '{column}' containing non-positive values")

        if base == np.e:
            return np.log(col)
        else:
            return np.log(col) / np.log(base)

    @staticmethod
    def winsorize(
        df: pd.DataFrame,
        column: str,
        lower_percentile: float = 5,
        upper_percentile: float = 95
    ) -> pd.Series:
        """
        Winsorize (cap) extreme values at specified percentiles.

        Args:
            df: Input dataframe
            column: Column name to winsorize
            lower_percentile: Lower percentile threshold (0-100)
            upper_percentile: Upper percentile threshold (0-100)

        Returns:
            Series with winsorized values

        Example:
            winsorize('Outlier_Variable', lower_percentile=1, upper_percentile=99)
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")

        if not (0 <= lower_percentile < upper_percentile <= 100):
            raise ValueError("Must have 0 <= lower_percentile < upper_percentile <= 100")

        col = df[column]
        lower_val = col.quantile(lower_percentile / 100)
        upper_val = col.quantile(upper_percentile / 100)

        return col.clip(lower=lower_val, upper=upper_val)


# List all available transformation functions for validation
AVAILABLE_TRANSFORMATIONS = {
    'map_binary',
    'map_categorical',
    'normalize',
    'z_score',
    'composite_score',
    'conditional_value',
    'conditional_numeric',
    'percentile_rank',
    'bin_numeric',
    'log_transform',
    'winsorize'
}
