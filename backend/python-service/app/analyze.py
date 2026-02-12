"""Main analysis service application."""

import ast
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib
import numpy as np
import pandas as pd
import seaborn as sns
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

# Configure matplotlib for non-interactive use
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Import analysis modules
from app.param_mapper import map_parameters
from app.transformations import TransformationLibrary, AVAILABLE_TRANSFORMATIONS
from app.plots import create_plot

# ============================================================================
# Pydantic Models
# ============================================================================

class AnalysisDecision(BaseModel):
    """Decision about which analysis to run."""
    library: str = Field(..., description="Python library (e.g., scipy.stats)")
    function: str = Field(..., description="Function name")
    param_map: Dict[str, Dict[str, str]] = Field(..., description="Parameter mapping hints")


class AnalyzeRequest(BaseModel):
    """Request to analyze a dataset."""
    dataset_reference: str = Field(..., description="Dataset reference (URL or path)")
    decision: AnalysisDecision = Field(..., description="Analysis decision")
    job_id: str = Field(..., description="Job ID for tracking")
    rng_seed: Optional[int] = Field(None, description="Random seed for reproducibility")


class AnalyzeResponse(BaseModel):
    """Response from analysis."""
    status: str = Field(..., description="Status (success or error)")
    results: Dict[str, Any] = Field(..., description="Analysis results")
    plot_paths: List[str] = Field(default_factory=list, description="Paths to generated plots")
    metadata: Dict[str, Any] = Field(..., description="Execution metadata")
    error: Optional[str] = Field(None, description="Error message if failed")


class DerivedVariable(BaseModel):
    """Derived variable definition."""
    name: str = Field(..., description="Variable name")
    formula: str = Field(..., description="Formula to compute variable")
    formula_type: str = Field(default="eval", description="Formula type: 'eval' (numeric), 'transform' (advanced), or 'python' (future)")


class ComputeVariablesRequest(BaseModel):
    """Request to compute derived variables."""
    dataset_reference: str = Field(..., description="Dataset reference (path)")
    variables: List[DerivedVariable] = Field(..., description="Variables to compute")


class ComputeVariablesResponse(BaseModel):
    """Response from variable computation."""
    status: str = Field(..., description="Status (success or error)")
    new_columns: List[str] = Field(default_factory=list, description="Names of newly computed columns")
    sample_data: List[Dict[str, Any]] = Field(default_factory=list, description="Sample rows with new columns (first 5)")
    updated_dataset: Optional[List[Dict[str, Any]]] = Field(None, description="Full updated dataset with all rows")
    error: Optional[str] = Field(None, description="Error message if failed")
    failed_variables: List[Dict[str, Any]] = Field(default_factory=list, description="Variables that failed to compute with error details")


class VisualizationRequest(BaseModel):
    """Request to generate visualization."""
    dataset_reference: str = Field(..., description="Dataset reference (path)")
    plot_type: str = Field(..., description="Plot type (histogram, scatter, box, correlation, etc.)")
    x_column: Optional[str] = Field(None, description="X-axis column")
    y_column: Optional[str] = Field(None, description="Y-axis column")
    color_column: Optional[str] = Field(None, description="Color/hue column")


class VisualizationResponse(BaseModel):
    """Response from visualization generation."""
    status: str = Field(..., description="Status (success or error)")
    plot_path: Optional[str] = Field(None, description="Path to generated plot")
    plot_base64: Optional[str] = Field(None, description="Base64-encoded plot image")
    error: Optional[str] = Field(None, description="Error message if failed")


class CleaningRequest(BaseModel):
    """Request to apply data cleaning transformations."""
    dataset_reference: str = Field(..., description="Dataset reference (path)")
    label_standardization: Dict[str, Dict[str, str]] = Field(
        default_factory=dict,
        description="Map of columns to value mappings for standardizing labels"
    )
    duplicate_handling: Optional[str] = Field(
        None,
        description="Strategy for duplicate rows: keep_all, keep_first, keep_last, drop_all"
    )
    duplicate_id_column: Optional[str] = Field(
        None,
        description="Column name to check for duplicate IDs"
    )
    invalid_value_handling: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of columns to actions for invalid values (drop, replace_nan, etc.)"
    )


class CleaningResponse(BaseModel):
    """Response from data cleaning."""
    status: str = Field(..., description="Status (success or error)")
    rows_before: int = Field(..., description="Number of rows before cleaning")
    rows_after: int = Field(..., description="Number of rows after cleaning")
    changes_applied: Dict[str, Any] = Field(
        default_factory=dict,
        description="Summary of changes applied"
    )
    updated_dataset: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Cleaned dataset"
    )
    error: Optional[str] = Field(None, description="Error message if failed")


class CodeExecutionRequest(BaseModel):
    """Request to execute custom Python code."""
    code: str = Field(..., description="Python code to execute")
    session_id: str = Field(..., description="Session ID")
    dataset_reference: Optional[str] = Field(None, description="Dataset reference (path)")


class CodeExecutionResponse(BaseModel):
    """Response from code execution."""
    success: bool = Field(..., description="Whether execution succeeded")
    row_count: Optional[int] = Field(None, description="Number of rows in result dataset")
    column_names: Optional[List[str]] = Field(None, description="Column names in result dataset")
    dataset: Optional[List[Dict[str, Any]]] = Field(None, description="Result dataset")
    console_output: Optional[str] = Field(None, description="Captured print/console output")
    plots: Optional[List[str]] = Field(None, description="Base64-encoded plot images")
    analysis_results: Optional[Dict[str, Any]] = Field(None, description="Structured analysis results")
    error: Optional[str] = Field(None, description="Error message if failed")
    traceback: Optional[str] = Field(None, description="Full traceback if failed")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="Inferra Python Analysis Service",
    version="1.0.0",
    description="Statistical analysis and visualization service"
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    import scipy
    import statsmodels
    import numpy as np

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "versions": {
            "python": sys.version.split()[0],
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "seaborn": sns.__version__,
            "matplotlib": matplotlib.__version__
        }
    }


@app.get("/environment")
async def environment_info():
    """Return environment information."""
    import scipy
    import statsmodels
    import numpy as np

    return {
        "python_version": sys.version,
        "platform": sys.platform,
        "package_versions": {
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "seaborn": sns.__version__,
            "matplotlib": matplotlib.__version__
        }
    }


class SafeCodeValidator(ast.NodeVisitor):
    """Validate code doesn't use dangerous operations."""
    FORBIDDEN_NAMES = {'eval', 'exec', 'compile', '__import__', 'open', 'input',
                       'file', 'execfile', 'reload', 'vars', 'locals', 'globals',
                       'dir', 'help', 'exit', 'quit'}
    FORBIDDEN_MODULES = {'os', 'sys', 'subprocess', 'socket', 'urllib', 'requests',
                        'shutil', 'pickle', 'shelve', 'multiprocessing', 'threading'}

    def visit_Call(self, node):
        """Check function calls for forbidden operations."""
        if isinstance(node.func, ast.Name):
            if node.func.id in self.FORBIDDEN_NAMES:
                raise ValueError(f"Forbidden function: {node.func.id}")
        self.generic_visit(node)

    def visit_Import(self, node):
        """Check imports for forbidden modules."""
        for alias in node.names:
            if alias.name.split('.')[0] in self.FORBIDDEN_MODULES:
                raise ValueError(f"Forbidden import: {alias.name}")
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        """Check from imports for forbidden modules."""
        if node.module and node.module.split('.')[0] in self.FORBIDDEN_MODULES:
            raise ValueError(f"Forbidden import from: {node.module}")
        self.generic_visit(node)


@app.post("/execute-code", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest) -> CodeExecutionResponse:
    """
    Execute user Python code in sandboxed environment.

    Args:
        request: Code execution request with code, session_id, and optional dataset reference

    Returns:
        Execution results with dataset info or error details
    """
    import traceback as tb
    from scipy import stats

    try:
        # 1. Validate code syntax
        logger.info(f"Validating code for session {request.session_id}")
        try:
            tree = ast.parse(request.code)
        except SyntaxError as e:
            logger.error(f"Syntax error in code: {e}")
            return CodeExecutionResponse(
                success=False,
                error=f"Invalid Python syntax: {str(e)}"
            )

        # 2. Check for dangerous operations
        try:
            validator = SafeCodeValidator()
            validator.visit(tree)
        except ValueError as e:
            logger.error(f"Code validation failed: {e}")
            return CodeExecutionResponse(
                success=False,
                error=str(e)
            )

        # 3. Load dataset if provided
        df = None
        if request.dataset_reference:
            try:
                df = load_dataset(request.dataset_reference)
                logger.info(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
            except Exception as e:
                logger.error(f"Failed to load dataset: {e}")
                return CodeExecutionResponse(
                    success=False,
                    error=f"Failed to load dataset: {str(e)}"
                )

        # 4. Set up safe execution environment
        safe_globals = {
            'pd': pd,
            'pandas': pd,
            'np': np,
            'numpy': np,
            'stats': stats,
            'sns': sns,
            'seaborn': sns,
            'plt': plt,
            'matplotlib': matplotlib,
            'df': df,
            # Add transformation library functions
            'map_binary': TransformationLibrary.map_binary,
            'map_categorical': TransformationLibrary.map_categorical,
            'normalize': TransformationLibrary.normalize,
            'z_score': TransformationLibrary.z_score,
            'composite_score': TransformationLibrary.composite_score,
            'conditional_value': TransformationLibrary.conditional_value,
            'conditional_numeric': TransformationLibrary.conditional_numeric,
            'percentile_rank': TransformationLibrary.percentile_rank,
            'bin_numeric': TransformationLibrary.bin_numeric,
            'log_transform': TransformationLibrary.log_transform,
            'winsorize': TransformationLibrary.winsorize,
            '__builtins__': {
                'abs': abs, 'all': all, 'any': any, 'bool': bool,
                'dict': dict, 'enumerate': enumerate, 'filter': filter,
                'float': float, 'int': int, 'len': len, 'list': list,
                'map': map, 'max': max, 'min': min, 'print': print,
                'range': range, 'round': round, 'set': set, 'sorted': sorted,
                'str': str, 'sum': sum, 'tuple': tuple, 'type': type, 'zip': zip,
                'True': True, 'False': False, 'None': None,
                '__import__': __import__,  # Allow imports but they'll be restricted
            }
        }

        # 5. Preprocess code to handle common imports
        # Replace imports of safe libraries with pass statements
        # This allows generated code to include imports without breaking
        code_lines = request.code.split('\n')
        processed_lines = []
        for line in code_lines:
            stripped = line.strip()
            # Skip imports of libraries we already provide
            if (stripped.startswith('import pandas') or
                stripped.startswith('import numpy') or
                stripped.startswith('import seaborn') or
                stripped.startswith('import matplotlib') or
                stripped.startswith('from pandas') or
                stripped.startswith('from numpy') or
                stripped.startswith('from scipy') or
                stripped.startswith('from seaborn') or
                stripped.startswith('from matplotlib')):
                processed_lines.append('# ' + line)  # Comment out the import
            else:
                processed_lines.append(line)

        processed_code = '\n'.join(processed_lines)

        # 6. Execute code and capture console output
        logger.info("Executing user code")
        import io
        import sys

        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = captured_output = io.StringIO()

        try:
            exec(processed_code, safe_globals)
            console_output = captured_output.getvalue()
        except Exception as e:
            error_trace = tb.format_exc()
            logger.error(f"Code execution failed: {e}")
            logger.error(f"Traceback:\n{error_trace}")
            return CodeExecutionResponse(
                success=False,
                error=str(e),
                traceback=error_trace,
                console_output=captured_output.getvalue()
            )
        finally:
            # Restore stdout
            sys.stdout = old_stdout

        # 7. Extract result dataframe
        result_df = safe_globals.get('df')
        if result_df is None:
            logger.error("Code must define or maintain 'df' variable")
            return CodeExecutionResponse(
                success=False,
                error="Code must define or maintain 'df' variable with the dataset"
            )

        if not isinstance(result_df, pd.DataFrame):
            logger.error(f"'df' must be a DataFrame, got {type(result_df)}")
            return CodeExecutionResponse(
                success=False,
                error=f"'df' must be a pandas DataFrame, got {type(result_df).__name__}"
            )

        # 8. Convert result to JSON-serializable format
        row_count = len(result_df)
        column_names = result_df.columns.tolist()

        # Convert dataset to dict with proper type handling
        dataset_records = result_df.to_dict(orient='records')
        dataset_records = [
            {k: (float(v) if isinstance(v, (int, float, np.integer, np.floating)) and pd.notna(v)
                 else (None if pd.isna(v) else v))
             for k, v in row.items()}
            for row in dataset_records
        ]

        # 9. Capture matplotlib plots
        plots = []
        try:
            import io
            import base64

            # Get all figures (plt already imported at top)
            figs = [plt.figure(num) for num in plt.get_fignums()]
            logger.info(f"Found {len(figs)} matplotlib figures")

            for i, fig in enumerate(figs):
                # Save figure to bytes
                buf = io.BytesIO()
                fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
                buf.seek(0)

                # Encode as base64
                img_base64 = base64.b64encode(buf.read()).decode('utf-8')
                plots.append(img_base64)
                buf.close()

            # Close all figures to free memory
            plt.close('all')

        except Exception as e:
            logger.warning(f"Failed to capture plots: {e}")

        # 10. Extract analysis results from safe_globals
        analysis_results = {}
        for key, value in safe_globals.items():
            # Capture common result objects
            if key.startswith('result') or key.endswith('_result'):
                if hasattr(value, '__dict__'):
                    # Convert result objects to dict
                    try:
                        analysis_results[key] = str(value)
                    except:
                        pass
                elif isinstance(value, (int, float, str, bool, list, dict)):
                    analysis_results[key] = value

        logger.info(f"Code executed successfully: {row_count} rows, {len(column_names)} columns")
        if console_output:
            logger.info(f"Console output: {console_output[:200]}...")
        if plots:
            logger.info(f"Captured {len(plots)} plots")
        if analysis_results:
            logger.info(f"Captured analysis results: {list(analysis_results.keys())}")

        return CodeExecutionResponse(
            success=True,
            row_count=row_count,
            column_names=column_names,
            dataset=dataset_records,
            console_output=console_output if console_output else None,
            plots=plots if plots else None,
            analysis_results=analysis_results if analysis_results else None
        )

    except Exception as e:
        error_trace = tb.format_exc()
        logger.error(f"Unexpected error during code execution: {e}", exc_info=True)
        return CodeExecutionResponse(
            success=False,
            error=f"Unexpected error: {str(e)}",
            traceback=error_trace
        )


def execute_transformation(df: pd.DataFrame, formula_str: str) -> pd.Series:
    """
    Parse and execute transformation function call.

    Formula format: "function_name(arg1, arg2, kwarg1=val1)"

    Args:
        df: Input dataframe
        formula_str: Formula string to parse and execute

    Returns:
        Series with transformation results

    Raises:
        ValueError: If formula is invalid or function not found
    """
    # Preprocess: Convert pandas-style backticks to Python single quotes
    # Backticks are used for column names with spaces in pandas.eval(),
    # but ast.parse() requires valid Python syntax (single/double quotes only)
    formula_str = formula_str.replace('`', "'")

    # Parse function call safely
    try:
        tree = ast.parse(formula_str, mode='eval')
    except SyntaxError as e:
        raise ValueError(f"Invalid formula syntax: {e}")

    if not isinstance(tree.body, ast.Call):
        raise ValueError("Formula must be a function call (e.g., 'function_name(args)')")

    # Get function name
    if isinstance(tree.body.func, ast.Name):
        func_name = tree.body.func.id
    else:
        raise ValueError("Function name must be a simple identifier")

    # Verify function exists in library
    if func_name not in AVAILABLE_TRANSFORMATIONS:
        raise ValueError(
            f"Unknown transformation: '{func_name}'. "
            f"Available transformations: {', '.join(sorted(AVAILABLE_TRANSFORMATIONS))}"
        )

    # Extract arguments - convert to actual values
    args = []
    for arg in tree.body.args:
        try:
            # Use ast.literal_eval for safe evaluation of literals
            args.append(ast.literal_eval(arg))
        except (ValueError, SyntaxError):
            raise ValueError(f"Invalid argument: {ast.unparse(arg)}")

    # Extract keyword arguments
    kwargs = {}
    for kw in tree.body.keywords:
        try:
            kwargs[kw.arg] = ast.literal_eval(kw.value)
        except (ValueError, SyntaxError):
            raise ValueError(f"Invalid keyword argument: {kw.arg}={ast.unparse(kw.value)}")

    # Call transformation with df as first argument
    func = getattr(TransformationLibrary, func_name)
    try:
        return func(df, *args, **kwargs)
    except Exception as e:
        raise ValueError(f"Transformation '{func_name}' failed: {str(e)}")


@app.post("/compute-variables", response_model=ComputeVariablesResponse)
async def compute_variables(request: ComputeVariablesRequest) -> ComputeVariablesResponse:
    """
    Compute derived variables using formulas and add them to the dataset.

    Args:
        request: Variables to compute with formulas

    Returns:
        New column names and sample data
    """
    try:
        # Load dataset
        dataset = load_dataset(request.dataset_reference)
        logger.info(f"Loaded dataset: {dataset.shape[0]} rows, {dataset.shape[1]} columns")

        new_columns = []
        failed_variables = []

        # Compute each variable
        for variable in request.variables:
            try:
                formula_type = variable.formula_type or "eval"

                if formula_type == "eval":
                    # Use pandas eval for safe formula evaluation
                    # This supports basic math operations and column references
                    dataset[variable.name] = dataset.eval(variable.formula, inplace=False)
                    logger.info(f"✓ Computed variable '{variable.name}' using eval formula: {variable.formula}")

                elif formula_type == "transform":
                    # Parse and execute transformation function
                    result = execute_transformation(dataset, variable.formula)
                    dataset[variable.name] = result
                    logger.info(f"✓ Computed variable '{variable.name}' using transform: {variable.formula}")

                elif formula_type == "python":
                    # Multi-line Python code execution
                    # Set up safe execution environment
                    # Transform functions are pre-bound with `dataset` so the LLM can call
                    # them as map_categorical('col', {...}) without passing df explicitly.
                    import functools
                    safe_globals = {
                        'pd': pd,
                        'np': np,
                        'df': dataset,
                        # Transformation library functions (df pre-bound)
                        'map_binary': functools.partial(TransformationLibrary.map_binary, dataset),
                        'map_categorical': functools.partial(TransformationLibrary.map_categorical, dataset),
                        'normalize': functools.partial(TransformationLibrary.normalize, dataset),
                        'z_score': functools.partial(TransformationLibrary.z_score, dataset),
                        'composite_score': functools.partial(TransformationLibrary.composite_score, dataset),
                        'conditional_value': functools.partial(TransformationLibrary.conditional_value, dataset),
                        'conditional_numeric': functools.partial(TransformationLibrary.conditional_numeric, dataset),
                        'percentile_rank': functools.partial(TransformationLibrary.percentile_rank, dataset),
                        'bin_numeric': functools.partial(TransformationLibrary.bin_numeric, dataset),
                        'log_transform': functools.partial(TransformationLibrary.log_transform, dataset),
                        'winsorize': functools.partial(TransformationLibrary.winsorize, dataset),
                    }
                    safe_locals = {}

                    # Execute the multi-line code
                    exec(variable.formula, safe_globals, safe_locals)

                    # The last expression or assignment should be 'result'
                    # Or if there's only one assignment, use that
                    if 'result' in safe_locals:
                        dataset[variable.name] = safe_locals['result']
                    else:
                        # Find the last assigned variable
                        if safe_locals:
                            last_var = list(safe_locals.values())[-1]
                            dataset[variable.name] = last_var
                        else:
                            raise ValueError("Python formula must assign to 'result' or return a value")

                    logger.info(f"✓ Computed variable '{variable.name}' using python formula")

                else:
                    raise ValueError(
                        f"Invalid formula_type: '{formula_type}'. "
                        f"Must be 'eval', 'transform', or 'python'"
                    )

                new_columns.append(variable.name)

            except Exception as e:
                error_msg = str(e)
                logger.error(f"✗ Failed to compute variable '{variable.name}': {error_msg}")
                logger.error(f"  Formula: {variable.formula}")
                logger.error(f"  Formula type: {formula_type}")
                logger.error(f"  Error type: {type(e).__name__}")
                failed_variables.append({
                    "name": variable.name,
                    "formula": variable.formula,
                    "formula_type": formula_type,
                    "error": error_msg
                })
                # Continue with other variables even if one fails

        # Get sample data (first 5 rows with new columns)
        sample_cols = new_columns if new_columns else list(dataset.columns)[:5]
        sample_data = dataset[sample_cols].head(5).to_dict(orient='records')

        # Convert numpy types to Python types for JSON serialization
        sample_data = [
            {k: (float(v) if isinstance(v, (int, float, np.integer, np.floating)) and pd.notna(v) else (None if pd.isna(v) else v))
             for k, v in row.items()}
            for row in sample_data
        ]

        # Get full updated dataset
        updated_dataset = dataset.to_dict(orient='records')
        # Convert numpy types for full dataset
        updated_dataset = [
            {k: (float(v) if isinstance(v, (int, float, np.integer, np.floating)) and pd.notna(v) else (None if pd.isna(v) else v))
             for k, v in row.items()}
            for row in updated_dataset
        ]

        return ComputeVariablesResponse(
            status="success" if new_columns else "partial_failure",
            new_columns=new_columns,
            sample_data=sample_data,
            updated_dataset=updated_dataset,
            failed_variables=failed_variables
        )

    except Exception as e:
        logger.error(f"Failed to compute variables: {str(e)}", exc_info=True)
        return ComputeVariablesResponse(
            status="error",
            error=str(e)
        )


@app.post("/apply-cleaning", response_model=CleaningResponse)
async def apply_cleaning(request: CleaningRequest) -> CleaningResponse:
    """
    Apply data cleaning transformations to dataset.

    Args:
        request: Cleaning configuration and dataset reference

    Returns:
        Cleaned dataset with summary of changes
    """
    try:
        # Load dataset
        dataset = load_dataset(request.dataset_reference)
        rows_before = len(dataset)
        logger.info(f"Loaded dataset for cleaning: {rows_before} rows, {dataset.shape[1]} columns")

        changes_applied = {}

        # 1. Apply label standardization (case-inconsistent label fixes)
        if request.label_standardization:
            label_changes = {}
            for column, mappings in request.label_standardization.items():
                if column in dataset.columns:
                    # Count changes before applying
                    changed_count = sum(dataset[column].isin(mappings.keys()))
                    if changed_count > 0:
                        dataset[column] = dataset[column].replace(mappings)
                        label_changes[column] = {
                            "rows_affected": int(changed_count),
                            "mappings_applied": len(mappings)
                        }
                        logger.info(f"Standardized {changed_count} values in column '{column}'")

            if label_changes:
                changes_applied["label_standardization"] = label_changes

        # 2. Handle duplicate rows
        if request.duplicate_handling and request.duplicate_handling != "keep_all":
            duplicates_before = dataset.duplicated().sum()

            if request.duplicate_id_column and request.duplicate_id_column in dataset.columns:
                # Check for duplicates in specific ID column
                if request.duplicate_handling == "keep_first":
                    dataset = dataset.drop_duplicates(subset=[request.duplicate_id_column], keep='first')
                elif request.duplicate_handling == "keep_last":
                    dataset = dataset.drop_duplicates(subset=[request.duplicate_id_column], keep='last')
                elif request.duplicate_handling == "drop_all":
                    # Drop all rows with duplicate IDs
                    duplicate_mask = dataset.duplicated(subset=[request.duplicate_id_column], keep=False)
                    dataset = dataset[~duplicate_mask]
            else:
                # Check for fully duplicate rows
                if request.duplicate_handling == "keep_first":
                    dataset = dataset.drop_duplicates(keep='first')
                elif request.duplicate_handling == "keep_last":
                    dataset = dataset.drop_duplicates(keep='last')
                elif request.duplicate_handling == "drop_all":
                    # Drop all duplicate rows
                    duplicate_mask = dataset.duplicated(keep=False)
                    dataset = dataset[~duplicate_mask]

            duplicates_after = dataset.duplicated().sum()
            if duplicates_before > 0:
                changes_applied["duplicate_handling"] = {
                    "strategy": request.duplicate_handling,
                    "duplicates_removed": int(duplicates_before - duplicates_after),
                    "id_column": request.duplicate_id_column
                }
                logger.info(f"Removed {duplicates_before - duplicates_after} duplicate rows using strategy: {request.duplicate_handling}")

        # 3. Handle invalid values
        if request.invalid_value_handling:
            invalid_changes = {}
            for column, action in request.invalid_value_handling.items():
                if column not in dataset.columns:
                    continue

                if action == "drop":
                    # Drop rows with negative values or other invalid values
                    # For numeric columns, drop negative values
                    if pd.api.types.is_numeric_dtype(dataset[column]):
                        invalid_mask = dataset[column] < 0
                        invalid_count = invalid_mask.sum()
                        if invalid_count > 0:
                            dataset = dataset[~invalid_mask]
                            invalid_changes[column] = {
                                "action": "drop",
                                "rows_removed": int(invalid_count)
                            }
                            logger.info(f"Dropped {invalid_count} rows with negative values in '{column}'")

                elif action == "replace_nan":
                    # Replace invalid values with NaN
                    if pd.api.types.is_numeric_dtype(dataset[column]):
                        invalid_mask = dataset[column] < 0
                        invalid_count = invalid_mask.sum()
                        if invalid_count > 0:
                            dataset.loc[invalid_mask, column] = np.nan
                            invalid_changes[column] = {
                                "action": "replace_nan",
                                "values_replaced": int(invalid_count)
                            }
                            logger.info(f"Replaced {invalid_count} negative values with NaN in '{column}'")

            if invalid_changes:
                changes_applied["invalid_value_handling"] = invalid_changes

        rows_after = len(dataset)
        logger.info(f"Cleaning complete: {rows_before} → {rows_after} rows")

        # Convert to JSON-serializable format
        updated_dataset = dataset.to_dict(orient='records')
        updated_dataset = [
            {k: (float(v) if isinstance(v, (int, float, np.integer, np.floating)) and pd.notna(v) else (None if pd.isna(v) else v))
             for k, v in row.items()}
            for row in updated_dataset
        ]

        return CleaningResponse(
            status="success",
            rows_before=rows_before,
            rows_after=rows_after,
            changes_applied=changes_applied,
            updated_dataset=updated_dataset
        )

    except Exception as e:
        logger.error(f"Failed to apply cleaning: {str(e)}", exc_info=True)
        return CleaningResponse(
            status="error",
            rows_before=0,
            rows_after=0,
            error=str(e)
        )


@app.post("/visualize", response_model=VisualizationResponse)
async def visualize(request: VisualizationRequest) -> VisualizationResponse:
    """
    Generate visualization for dataset.

    Args:
        request: Visualization parameters

    Returns:
        Plot image as base64
    """
    import base64
    from io import BytesIO

    try:
        # Load dataset
        dataset = load_dataset(request.dataset_reference)
        logger.info(f"Generating {request.plot_type} visualization")

        # Create figure
        plt.figure(figsize=(10, 6))

        if request.plot_type == "histogram":
            if request.x_column:
                sns.histplot(data=dataset, x=request.x_column, bins=30, kde=True)
                plt.title(f"Distribution of {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel("Frequency")
            else:
                # Plot first numeric column
                numeric_cols = dataset.select_dtypes(include=['number']).columns
                if len(numeric_cols) > 0:
                    sns.histplot(data=dataset, x=numeric_cols[0], bins=30, kde=True)
                    plt.title(f"Distribution of {numeric_cols[0]}")

        elif request.plot_type == "scatter":
            if request.x_column and request.y_column:
                if request.color_column:
                    sns.scatterplot(data=dataset, x=request.x_column, y=request.y_column, hue=request.color_column, alpha=0.6)
                else:
                    sns.scatterplot(data=dataset, x=request.x_column, y=request.y_column, alpha=0.6)
                plt.title(f"{request.y_column} vs {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)

        elif request.plot_type in ["box", "boxplot"]:
            # Support both "box" and "boxplot"
            if request.x_column and request.y_column:
                sns.boxplot(data=dataset, x=request.x_column, y=request.y_column)
                plt.title(f"{request.y_column} by {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)
            elif request.y_column:
                sns.boxplot(data=dataset, y=request.y_column)
                plt.title(f"Distribution of {request.y_column}")
                plt.ylabel(request.y_column)
            elif request.x_column:
                # If only x_column provided, use it as y
                sns.boxplot(data=dataset, y=request.x_column)
                plt.title(f"Distribution of {request.x_column}")
                plt.ylabel(request.x_column)

        elif request.plot_type == "violin":
            if request.x_column and request.y_column:
                sns.violinplot(data=dataset, x=request.x_column, y=request.y_column)
                plt.title(f"{request.y_column} by {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)
            elif request.y_column:
                sns.violinplot(data=dataset, y=request.y_column)
                plt.title(f"Distribution of {request.y_column}")
                plt.ylabel(request.y_column)
            elif request.x_column:
                sns.violinplot(data=dataset, y=request.x_column)
                plt.title(f"Distribution of {request.x_column}")
                plt.ylabel(request.x_column)

        elif request.plot_type == "line":
            if request.x_column and request.y_column:
                sns.lineplot(data=dataset, x=request.x_column, y=request.y_column, marker='o')
                plt.title(f"{request.y_column} over {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)
            else:
                # Line plot with index as x-axis
                numeric_cols = dataset.select_dtypes(include=['number']).columns
                if len(numeric_cols) > 0:
                    col = request.y_column or numeric_cols[0]
                    plt.plot(dataset.index, dataset[col], marker='o')
                    plt.title(f"{col} over Index")
                    plt.xlabel("Index")
                    plt.ylabel(col)

        elif request.plot_type == "bar":
            if request.x_column and request.y_column:
                sns.barplot(data=dataset, x=request.x_column, y=request.y_column)
                plt.title(f"{request.y_column} by {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)
                plt.xticks(rotation=45, ha='right')
            elif request.x_column:
                # Count plot for categorical variable
                sns.countplot(data=dataset, x=request.x_column)
                plt.title(f"Count of {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel("Count")
                plt.xticks(rotation=45, ha='right')

        elif request.plot_type == "density":
            # KDE density plot
            if request.x_column:
                sns.kdeplot(data=dataset, x=request.x_column, fill=True, alpha=0.6)
                plt.title(f"Density Plot of {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel("Density")
            else:
                numeric_cols = dataset.select_dtypes(include=['number']).columns
                if len(numeric_cols) > 0:
                    sns.kdeplot(data=dataset, x=numeric_cols[0], fill=True, alpha=0.6)
                    plt.title(f"Density Plot of {numeric_cols[0]}")

        elif request.plot_type == "heatmap":
            # Correlation heatmap for numeric columns
            numeric_data = dataset.select_dtypes(include=['number'])
            if len(numeric_data.columns) > 1:
                corr = numeric_data.corr()
                sns.heatmap(corr, annot=True, cmap='coolwarm', center=0, square=True, fmt='.2f')
                plt.title("Correlation Matrix")

        elif request.plot_type == "correlation":
            # Alias for heatmap
            numeric_data = dataset.select_dtypes(include=['number'])
            if len(numeric_data.columns) > 1:
                corr = numeric_data.corr()
                sns.heatmap(corr, annot=True, cmap='coolwarm', center=0, square=True, fmt='.2f')
                plt.title("Correlation Matrix")

        elif request.plot_type == "pairplot":
            # Full pairplot for all numeric columns (or subset)
            numeric_cols = dataset.select_dtypes(include=['number']).columns
            # Limit to avoid performance issues
            cols_to_plot = numeric_cols[:5] if len(numeric_cols) > 5 else numeric_cols
            if len(cols_to_plot) >= 2:
                if request.color_column and request.color_column in dataset.columns:
                    sns.pairplot(dataset[list(cols_to_plot) + [request.color_column]], hue=request.color_column, diag_kind='kde', plot_kws={'alpha': 0.6})
                else:
                    sns.pairplot(dataset[cols_to_plot], diag_kind='kde', plot_kws={'alpha': 0.6})
                plt.suptitle("Pairplot", y=1.01)

        elif request.plot_type == "pairplot_preview":
            # Quick pairplot for first few numeric columns
            numeric_cols = dataset.select_dtypes(include=['number']).columns[:4]
            if len(numeric_cols) >= 2:
                sns.pairplot(dataset[numeric_cols], diag_kind='kde', plot_kws={'alpha': 0.6})
                plt.suptitle("Pairplot Preview", y=1.01)

        elif request.plot_type == "count":
            # Count plot for categorical variable
            if request.x_column:
                sns.countplot(data=dataset, x=request.x_column)
                plt.title(f"Count of {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel("Count")
                plt.xticks(rotation=45, ha='right')

        elif request.plot_type == "strip":
            # Strip plot (scatter plot for categorical data)
            if request.x_column and request.y_column:
                sns.stripplot(data=dataset, x=request.x_column, y=request.y_column, alpha=0.6)
                plt.title(f"{request.y_column} by {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)
                plt.xticks(rotation=45, ha='right')

        elif request.plot_type == "swarm":
            # Swarm plot (categorical scatter with no overlap)
            if request.x_column and request.y_column:
                sns.swarmplot(data=dataset, x=request.x_column, y=request.y_column, alpha=0.6)
                plt.title(f"{request.y_column} by {request.x_column}")
                plt.xlabel(request.x_column)
                plt.ylabel(request.y_column)
                plt.xticks(rotation=45, ha='right')

        else:
            raise ValueError(f"Unsupported plot type: {request.plot_type}")

        # Save to BytesIO and convert to base64
        buf = BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        plt.close()

        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')

        logger.info(f"Generated {request.plot_type} visualization successfully")

        return VisualizationResponse(
            status="success",
            plot_base64=img_base64
        )

    except Exception as e:
        logger.error(f"Failed to generate visualization: {str(e)}", exc_info=True)
        return VisualizationResponse(
            status="error",
            error=str(e)
        )


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Execute statistical analysis or visualization.

    Args:
        request: Analysis request with dataset and decision

    Returns:
        Analysis results with metadata
    """
    start_time = time.time()
    logger.info(f"Starting analysis for job {request.job_id}")

    try:
        # Set RNG seed if provided
        if request.rng_seed is not None:
            import numpy as np
            np.random.seed(request.rng_seed)
            logger.info(f"Set RNG seed: {request.rng_seed}")

        # Load dataset
        dataset = load_dataset(request.dataset_reference)
        logger.info(f"Loaded dataset: {dataset.shape[0]} rows, {dataset.shape[1]} columns")

        # Map parameters
        mapped_params = map_parameters(
            param_map=request.decision.param_map,
            dataset=dataset
        )
        logger.info(f"Mapped parameters: {mapped_params}")

        # Execute analysis based on library
        if request.decision.library.startswith("scipy"):
            results, plot_paths = execute_scipy_analysis(
                function=request.decision.function,
                dataset=dataset,
                params=mapped_params,
                job_id=request.job_id
            )
        elif request.decision.library.startswith("statsmodels"):
            results, plot_paths = execute_statsmodels_analysis(
                function=request.decision.function,
                dataset=dataset,
                params=mapped_params,
                job_id=request.job_id
            )
        elif request.decision.library == "seaborn":
            results, plot_paths = execute_seaborn_plot(
                function=request.decision.function,
                dataset=dataset,
                params=mapped_params,
                job_id=request.job_id
            )
        else:
            raise ValueError(f"Unsupported library: {request.decision.library}")

        # Collect metadata
        execution_time = time.time() - start_time
        metadata = collect_metadata(execution_time, request.rng_seed)

        logger.info(f"Analysis completed in {execution_time:.2f}s")

        return AnalyzeResponse(
            status="success",
            results=results,
            plot_paths=plot_paths,
            metadata=metadata
        )

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}", exc_info=True)
        return AnalyzeResponse(
            status="error",
            results={},
            plot_paths=[],
            metadata={},
            error=str(e)
        )


# ============================================================================
# Helper Functions
# ============================================================================

def load_dataset(reference: str) -> pd.DataFrame:
    """
    Load dataset from reference.

    Args:
        reference: Dataset reference (file path or URL)

    Returns:
        pandas DataFrame
    """
    # Support CSV and JSON formats
    if reference.endswith('.csv'):
        return pd.read_csv(reference)
    elif reference.endswith('.json'):
        return pd.read_json(reference)
    else:
        # Try CSV by default
        return pd.read_csv(reference)


def execute_scipy_analysis(
    function: str,
    dataset: pd.DataFrame,
    params: Dict[str, str],
    job_id: str
) -> tuple:
    """Execute scipy.stats analysis."""
    from scipy import stats

    results = {}
    plot_paths = []

    # Strip common prefixes (LLM may return "stats.ttest_ind" or "scipy.stats.ttest_ind")
    for prefix in ("scipy.stats.", "stats.", "scipy."):
        if function.startswith(prefix):
            function = function[len(prefix):]
            break

    if function == "ttest_ind":
        # Independent t-test
        group_col = params.get("group_col")
        value_col = params.get("value_col")

        working = dataset.dropna(subset=[group_col, value_col])
        groups = working[group_col].unique()
        if len(groups) != 2:
            raise ValueError(f"Expected 2 groups, found {len(groups)}: {list(groups)}")

        group1_data = working[working[group_col] == groups[0]][value_col]
        group2_data = working[working[group_col] == groups[1]][value_col]

        t_stat, p_value = stats.ttest_ind(group1_data, group2_data)

        results = {
            "t_statistic": float(t_stat),
            "p_value": float(p_value),
            "group1": str(groups[0]),
            "group2": str(groups[1]),
            "group1_mean": float(group1_data.mean()),
            "group2_mean": float(group2_data.mean()),
            "group1_n": int(len(group1_data)),
            "group2_n": int(len(group2_data))
        }

    elif function == "ttest_rel":
        # Paired t-test
        col1 = params.get("col1")
        col2 = params.get("col2")

        t_stat, p_value = stats.ttest_rel(dataset[col1], dataset[col2])

        results = {
            "t_statistic": float(t_stat),
            "p_value": float(p_value),
            "col1_mean": float(dataset[col1].mean()),
            "col2_mean": float(dataset[col2].mean()),
            "n": int(len(dataset))
        }

    elif function == "f_oneway":
        # One-way ANOVA
        group_col = params.get("group_col")
        value_col = params.get("value_col")

        groups = dataset[group_col].unique()
        group_data = [dataset[dataset[group_col] == g][value_col] for g in groups]

        f_stat, p_value = stats.f_oneway(*group_data)

        results = {
            "f_statistic": float(f_stat),
            "p_value": float(p_value),
            "num_groups": int(len(groups)),
            "groups": [str(g) for g in groups]
        }

    elif function == "pearsonr":
        # Pearson correlation
        x_col = params.get("x_col")
        y_col = params.get("y_col")

        r, p_value = stats.pearsonr(dataset[x_col], dataset[y_col])

        results = {
            "correlation": float(r),
            "p_value": float(p_value),
            "n": int(len(dataset))
        }

    elif function == "spearmanr":
        # Spearman correlation
        x_col = params.get("x_col")
        y_col = params.get("y_col")

        rho, p_value = stats.spearmanr(dataset[x_col], dataset[y_col])

        results = {
            "correlation": float(rho),
            "p_value": float(p_value),
            "n": int(len(dataset))
        }

    elif function == "kendalltau":
        # Kendall's tau correlation
        x_col = params.get("x_col")
        y_col = params.get("y_col")

        tau, p_value = stats.kendalltau(dataset[x_col], dataset[y_col])

        results = {
            "correlation": float(tau),
            "p_value": float(p_value),
            "n": int(len(dataset))
        }

    elif function == "chi2_contingency":
        # Chi-square test of independence
        row_col = params.get("row_col") or params.get("var1") or params.get("x_col")
        col_col = params.get("col_col") or params.get("var2") or params.get("y_col")

        if not row_col or not col_col:
            raise ValueError("chi2_contingency requires row_col and col_col parameters")

        contingency_table = pd.crosstab(dataset[row_col], dataset[col_col])
        chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)

        results = {
            "chi2_statistic": float(chi2),
            "p_value": float(p_value),
            "degrees_of_freedom": int(dof),
            "row_variable": row_col,
            "col_variable": col_col,
            "n": int(len(dataset))
        }

    elif function == "mannwhitneyu":
        # Mann-Whitney U test (non-parametric t-test alternative)
        group_col = params.get("group_col")
        value_col = params.get("value_col")

        working = dataset.dropna(subset=[group_col, value_col])
        groups = working[group_col].unique()
        if len(groups) != 2:
            raise ValueError(f"Expected 2 groups, found {len(groups)}: {list(groups)}")

        group1_data = working[working[group_col] == groups[0]][value_col]
        group2_data = working[working[group_col] == groups[1]][value_col]

        u_stat, p_value = stats.mannwhitneyu(group1_data, group2_data, alternative='two-sided')

        results = {
            "u_statistic": float(u_stat),
            "p_value": float(p_value),
            "group1": str(groups[0]),
            "group2": str(groups[1]),
            "group1_median": float(group1_data.median()),
            "group2_median": float(group2_data.median()),
            "group1_n": int(len(group1_data)),
            "group2_n": int(len(group2_data))
        }

    elif function == "wilcoxon":
        # Wilcoxon signed-rank test (non-parametric paired t-test)
        col1 = params.get("col1")
        col2 = params.get("col2")

        w_stat, p_value = stats.wilcoxon(dataset[col1], dataset[col2])

        results = {
            "w_statistic": float(w_stat),
            "p_value": float(p_value),
            "col1_median": float(dataset[col1].median()),
            "col2_median": float(dataset[col2].median()),
            "n": int(len(dataset))
        }

    elif function == "kruskal":
        # Kruskal-Wallis test (non-parametric ANOVA)
        group_col = params.get("group_col")
        value_col = params.get("value_col")

        groups = dataset[group_col].unique()
        group_data = [dataset[dataset[group_col] == g][value_col].dropna() for g in groups]

        h_stat, p_value = stats.kruskal(*group_data)

        results = {
            "h_statistic": float(h_stat),
            "p_value": float(p_value),
            "num_groups": int(len(groups)),
            "groups": [str(g) for g in groups]
        }

    else:
        raise ValueError(f"Unsupported scipy function: {function}")

    return results, plot_paths


def execute_statsmodels_analysis(
    function: str,
    dataset: pd.DataFrame,
    params: Dict[str, str],
    job_id: str
) -> tuple:
    """Execute statsmodels analysis."""
    import statsmodels.formula.api as smf

    results = {}
    plot_paths = []

    # Strip common prefixes
    for prefix in ("statsmodels.formula.api.", "statsmodels.", "smf."):
        if function.startswith(prefix):
            function = function[len(prefix):]
            break

    if function == "ols":
        # Ordinary least squares regression
        dependent = params.get("dependent")
        independent = params.get("independent")

        formula = f"{dependent} ~ {independent}"
        model = smf.ols(formula, data=dataset).fit()

        results = {
            "rsquared": float(model.rsquared),
            "rsquared_adj": float(model.rsquared_adj),
            "fvalue": float(model.fvalue),
            "f_pvalue": float(model.f_pvalue),
            "params": {k: float(v) for k, v in model.params.items()},
            "pvalues": {k: float(v) for k, v in model.pvalues.items()},
            "aic": float(model.aic),
            "bic": float(model.bic)
        }

    else:
        raise ValueError(f"Unsupported statsmodels function: {function}")

    return results, plot_paths


def execute_seaborn_plot(
    function: str,
    dataset: pd.DataFrame,
    params: Dict[str, str],
    job_id: str
) -> tuple:
    """Execute seaborn visualization."""
    plot_path = create_plot(
        function=function,
        dataset=dataset,
        params=params,
        job_id=job_id
    )

    return {
        "plot_created": True,
        "plot_type": function
    }, [plot_path]


def collect_metadata(execution_time: float, rng_seed: Optional[int]) -> Dict[str, Any]:
    """Collect execution metadata."""
    import scipy
    import statsmodels
    import numpy as np

    return {
        "execution_time_seconds": execution_time,
        "timestamp": datetime.utcnow().isoformat(),
        "python_version": sys.version.split()[0],
        "rng_seed": rng_seed,
        "package_versions": {
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "seaborn": sns.__version__,
            "matplotlib": matplotlib.__version__
        }
    }
