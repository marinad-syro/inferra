"""Parameter mapping utilities."""

import logging
from typing import Dict

import pandas as pd

logger = logging.getLogger(__name__)


def map_parameters(
    param_map: Dict[str, Dict[str, str]],
    dataset: pd.DataFrame
) -> Dict[str, str]:
    """
    Map parameter hints to actual column names.

    Args:
        param_map: Parameter mapping hints from decision
        dataset: DataFrame to map against

    Returns:
        Dictionary mapping parameter names to column names

    Example:
        param_map = {
            "group_col": {"type": "group"},
            "value_col": {"type": "value"}
        }
        Returns: {"group_col": "treatment", "value_col": "score"}
    """
    mapped = {}

    for param_name, hint in param_map.items():
        param_type = hint.get("type")
        specified_col = hint.get("column")

        # If column is specified, use it
        if specified_col:
            if specified_col in dataset.columns:
                mapped[param_name] = specified_col
                logger.debug(f"Mapped {param_name} to specified column: {specified_col}")
            else:
                raise ValueError(f"Specified column '{specified_col}' not found in dataset")
            continue

        # Otherwise, infer from type
        if param_type == "group":
            # Find categorical column with reasonable unique count
            group_col = find_group_column(dataset)
            if group_col:
                mapped[param_name] = group_col
                logger.debug(f"Mapped {param_name} to group column: {group_col}")
            else:
                raise ValueError("No suitable grouping column found")

        elif param_type == "value":
            # Find numeric column
            value_col = find_numeric_column(dataset, exclude=list(mapped.values()))
            if value_col:
                mapped[param_name] = value_col
                logger.debug(f"Mapped {param_name} to value column: {value_col}")
            else:
                raise ValueError("No suitable numeric column found")

        elif param_type in ["x", "y"]:
            # Find numeric column
            col = find_numeric_column(dataset, exclude=list(mapped.values()))
            if col:
                mapped[param_name] = col
                logger.debug(f"Mapped {param_name} to column: {col}")
            else:
                raise ValueError(f"No suitable numeric column found for {param_type}")

        elif param_type == "col1" or param_type == "col2":
            # For paired tests, find numeric columns
            col = find_numeric_column(dataset, exclude=list(mapped.values()))
            if col:
                mapped[param_name] = col
                logger.debug(f"Mapped {param_name} to column: {col}")
            else:
                raise ValueError(f"No suitable numeric column found for {param_name}")

        else:
            logger.warning(f"Unknown parameter type: {param_type}")

    return mapped


def find_group_column(dataset: pd.DataFrame) -> str:
    """
    Find a suitable grouping column.

    Args:
        dataset: DataFrame to search

    Returns:
        Column name or None
    """
    for col in dataset.columns:
        # Check if categorical or object type
        if dataset[col].dtype in ['object', 'category', 'bool']:
            unique_count = dataset[col].nunique()
            # Reasonable number of groups (2-20)
            if 2 <= unique_count <= 20:
                return col

    return None


def find_numeric_column(dataset: pd.DataFrame, exclude: list = None) -> str:
    """
    Find a suitable numeric column.

    Args:
        dataset: DataFrame to search
        exclude: Columns to exclude

    Returns:
        Column name or None
    """
    exclude = exclude or []

    for col in dataset.columns:
        if col in exclude:
            continue

        # Check if numeric type
        if pd.api.types.is_numeric_dtype(dataset[col]):
            return col

    return None
