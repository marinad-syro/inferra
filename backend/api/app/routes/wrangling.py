"""
Data wrangling configuration endpoints.

Handles complex data wrangling configurations including datasets,
joins, transformations, and consistency checks.
"""

import logging
from typing import Any, Dict, List, Set
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    WranglingConfigResponse,
    WranglingConfigUpdate,
    DatasetInfo,
    Transformation,
    ConsistencyCheck,
    RunConsistencyChecksRequest,
    ErrorResponse
)
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/wrangling/{session_id}", response_model=WranglingConfigResponse)
async def get_wrangling_config(session_id: str):
    """
    Get wrangling config for a session.

    Returns the wrangling configuration or creates a new one if none exists.
    """
    try:
        config = await database_service.get_wrangling_config(session_id)
        if not config:
            # Create new config
            config = await database_service.create_wrangling_config(session_id)
        return config
    except Exception as e:
        logger.error(f"Failed to get wrangling config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "WRANGLING_CONFIG_GET_FAILED", "message": str(e)}
        )


@router.post("/wrangling", response_model=WranglingConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_wrangling_config(session_id: str):
    """
    Create a new wrangling config.

    Creates a new wrangling configuration with default values.
    """
    try:
        config = await database_service.create_wrangling_config(session_id)
        return config
    except Exception as e:
        logger.error(f"Failed to create wrangling config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "WRANGLING_CONFIG_CREATE_FAILED", "message": str(e)}
        )


@router.patch("/wrangling/{config_id}", response_model=WranglingConfigResponse)
async def update_wrangling_config(config_id: str, request: WranglingConfigUpdate):
    """
    Update wrangling configuration.

    Updates any fields of the wrangling configuration.
    """
    try:
        # Convert to dict, excluding None values
        updates = request.model_dump(exclude_none=True)

        # Convert nested Pydantic models to dicts
        if "datasets" in updates:
            updates["datasets"] = [d.model_dump() if hasattr(d, "model_dump") else d for d in updates["datasets"]]
        if "transformations" in updates:
            updates["transformations"] = [t.model_dump() if hasattr(t, "model_dump") else t for t in updates["transformations"]]
        if "consistency_checks" in updates:
            updates["consistency_checks"] = [c.model_dump() if hasattr(c, "model_dump") else c for c in updates["consistency_checks"]]
        if "join_warnings" in updates:
            updates["join_warnings"] = [w.model_dump() if hasattr(w, "model_dump") else w for w in updates["join_warnings"]]

        config = await database_service.update_wrangling_config(config_id, updates)
        return config
    except Exception as e:
        logger.error(f"Failed to update wrangling config: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "WRANGLING_CONFIG_UPDATE_FAILED", "message": str(e)}
        )


@router.post("/wrangling/{config_id}/datasets", response_model=WranglingConfigResponse)
async def add_dataset(config_id: str, dataset: DatasetInfo):
    """
    Add a dataset to the wrangling configuration.

    Adds a new dataset to the list of datasets being wrangled.
    """
    try:
        # Get current config
        # We need to get it from the database first
        # For now, we'll use the update endpoint to add to the datasets array
        # This is a simplified version - in production you'd want to fetch, modify, update

        # This endpoint would need more complex logic to properly append to arrays
        # For now, return a placeholder response
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"error_code": "NOT_IMPLEMENTED", "message": "Use PATCH /wrangling/{config_id} with full datasets array"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add dataset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "DATASET_ADD_FAILED", "message": str(e)}
        )


@router.delete("/wrangling/{config_id}/datasets/{dataset_id}", response_model=WranglingConfigResponse)
async def remove_dataset(config_id: str, dataset_id: str):
    """
    Remove a dataset from the wrangling configuration.

    Removes a dataset from the list of datasets being wrangled.
    """
    try:
        # Similar to add_dataset, this would need complex array manipulation
        # Recommend using PATCH endpoint with full updated arrays for now
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"error_code": "NOT_IMPLEMENTED", "message": "Use PATCH /wrangling/{config_id} with full datasets array"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove dataset: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "DATASET_REMOVE_FAILED", "message": str(e)}
        )


@router.post("/wrangling/{config_id}/transformations", response_model=WranglingConfigResponse)
async def add_transformation(config_id: str, transformation: Transformation):
    """
    Add a transformation to the wrangling configuration.

    Adds a new data transformation.
    """
    try:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"error_code": "NOT_IMPLEMENTED", "message": "Use PATCH /wrangling/{config_id} with full transformations array"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add transformation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "TRANSFORMATION_ADD_FAILED", "message": str(e)}
        )


@router.patch("/wrangling/{config_id}/transformations/{transformation_id}/toggle")
async def toggle_transformation(config_id: str, transformation_id: str):
    """
    Toggle transformation enabled status.

    Enables or disables a specific transformation.
    """
    try:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"error_code": "NOT_IMPLEMENTED", "message": "Use PATCH /wrangling/{config_id} with full transformations array"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle transformation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "TRANSFORMATION_TOGGLE_FAILED", "message": str(e)}
        )


@router.delete("/wrangling/{config_id}/transformations/{transformation_id}")
async def remove_transformation(config_id: str, transformation_id: str):
    """
    Remove a transformation from the wrangling configuration.

    Removes a data transformation.
    """
    try:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"error_code": "NOT_IMPLEMENTED", "message": "Use PATCH /wrangling/{config_id} with full transformations array"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove transformation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "TRANSFORMATION_REMOVE_FAILED", "message": str(e)}
        )


@router.post("/wrangling/{config_id}/consistency-checks", response_model=List[ConsistencyCheck])
async def run_consistency_checks(config_id: str, request: RunConsistencyChecksRequest):
    """
    Run consistency checks on data.

    Analyzes data for common issues like duplicates, negative values,
    and inconsistent labels.
    """
    try:
        checks: List[Dict[str, Any]] = []

        # Check for duplicate IDs
        id_columns = ['subject_id', 'participant_id', 'id', 'subj_id']
        for col in id_columns:
            if request.data and col in request.data[0]:
                values = [row.get(col) for row in request.data]
                seen: Set[Any] = set()
                duplicates = [v for v in values if v in seen or seen.add(v)]  # type: ignore
                checks.append({
                    "id": f"dup_{col}",
                    "name": f"Duplicate {col}",
                    "description": f"Check for duplicate values in {col}",
                    "status": "passed" if len(duplicates) == 0 else "warning",
                    "details": f"Found {len(duplicates)} duplicate values" if duplicates else None,
                    "affectedRows": len(duplicates)
                })
                break

        # Check for negative reaction times
        rt_columns = ['rt', 'reaction_time', 'response_time', 'RT']
        for col in rt_columns:
            if request.data and col in request.data[0]:
                negative_rts = [row for row in request.data if isinstance(row.get(col), (int, float)) and row.get(col) < 0]
                checks.append({
                    "id": f"neg_{col}",
                    "name": "Negative reaction times",
                    "description": f"Check for impossible negative values in {col}",
                    "status": "passed" if len(negative_rts) == 0 else "failed",
                    "details": f"Found {len(negative_rts)} rows with negative RT" if negative_rts else None,
                    "affectedRows": len(negative_rts)
                })
                break

        # Check for inconsistent labels
        if request.data:
            categorical_cols = [
                col for col in request.data[0].keys()
                if all(isinstance(row.get(col), str) for row in request.data[:min(100, len(request.data))])
                and len(set(row.get(col) for row in request.data[:100])) < 20
            ]

            for col in categorical_cols[:3]:  # Limit to 3 columns
                # Filter out None, empty strings, and ensure they are strings
                values = [
                    row.get(col) for row in request.data
                    if isinstance(row.get(col), str) and row.get(col).strip() != ''
                ]

                if not values:
                    continue

                unique_vals = list(set(values))
                has_inconsistent = any(
                    any(v != other and v.lower() == other.lower() for other in unique_vals)
                    for v in unique_vals
                )

                if has_inconsistent:
                    # Group values by lowercase to find case variations
                    from collections import Counter
                    value_counts = Counter(values)

                    # Collect ALL variations for this column (excluding empty strings)
                    all_variations = []
                    for val, count in value_counts.items():
                        if val and val.strip():  # Double-check no empty strings
                            all_variations.append({"value": val, "count": count})

                    # Skip if no valid variations
                    if not all_variations:
                        continue

                    # Create one group per column with all variations
                    check_data = {
                        "id": f"label_{col}",
                        "name": f"Inconsistent labels in {col}",
                        "description": "Check for case-inconsistent category labels",
                        "status": "warning",
                        "details": f"Found {len(all_variations)} label variations that differ only by case",
                        "affectedRows": len(all_variations),
                        "inconsistencies": [{
                            "column": col,
                            "variations": all_variations
                        }]
                    }

                    logger.info(f"[DEBUG] Created check with inconsistencies for {col}: {len(all_variations)} variations")
                    checks.append(check_data)

        # Add general passed check if no issues
        if len(checks) == 0:
            checks.append({
                "id": "general",
                "name": "Data consistency",
                "description": "General data quality check",
                "status": "passed",
                "details": "No obvious consistency issues detected"
            })

        # Update config with checks
        await database_service.update_wrangling_config(
            config_id,
            {"consistency_checks": checks}
        )

        return checks
    except Exception as e:
        logger.error(f"Failed to run consistency checks: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "CONSISTENCY_CHECKS_FAILED", "message": str(e)}
        )
