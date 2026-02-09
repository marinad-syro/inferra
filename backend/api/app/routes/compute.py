"""
Data computation endpoints for derived variables and visualizations.

Proxies requests to the Python service for pandas/scipy operations.
"""

import logging
import httpx
from fastapi import APIRouter, HTTPException, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.config.settings import settings
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


class DerivedVariable(BaseModel):
    """Derived variable definition."""
    name: str
    formula: str


class ComputeVariablesRequest(BaseModel):
    """Request to compute derived variables."""
    dataset_reference: str
    variables: List[DerivedVariable]


class ComputeVariablesResponse(BaseModel):
    """Response from variable computation."""
    status: str
    new_columns: List[str] = []
    sample_data: List[Dict[str, Any]] = []
    error: Optional[str] = None


class VisualizationRequest(BaseModel):
    """Request to generate visualization."""
    dataset_reference: str
    plot_type: str
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    color_column: Optional[str] = None


class VisualizationResponse(BaseModel):
    """Response from visualization generation."""
    status: str
    plot_base64: Optional[str] = None
    error: Optional[str] = None


@router.post("/compute-variables", response_model=ComputeVariablesResponse)
async def compute_variables(request: ComputeVariablesRequest):
    """
    Compute derived variables using pandas eval.

    Evaluates formulas and adds new columns to the dataset.
    """
    try:
        # If dataset_reference looks like a storage path, download it first
        dataset_ref = request.dataset_reference
        temp_file = None

        if "/" in dataset_ref and not dataset_ref.startswith("/tmp"):
            # This is a storage path, download to temp
            logger.info(f"Downloading file from storage: {dataset_ref}")
            temp_file = await database_service.download_file_to_temp(dataset_ref)
            dataset_ref = temp_file

        # Update request with local path
        request_data = request.model_dump()
        request_data["dataset_reference"] = dataset_ref

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.python_service_url}/compute-variables",
                json=request_data,
                timeout=30.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"error_code": "COMPUTE_FAILED", "message": "Failed to compute variables"}
                )

            result = response.json()

        # Clean up temp file
        if temp_file:
            import os
            try:
                os.remove(temp_file)
            except:
                pass

        return result

    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Python service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "SERVICE_UNAVAILABLE", "message": "Python service unavailable"}
        )
    except Exception as e:
        logger.error(f"Failed to compute variables: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "COMPUTE_FAILED", "message": str(e)}
        )


@router.post("/visualize", response_model=VisualizationResponse)
async def visualize(request: VisualizationRequest):
    """
    Generate data visualization.

    Creates plots using seaborn/matplotlib and returns as base64.
    """
    try:
        # If dataset_reference looks like a storage path, download it first
        dataset_ref = request.dataset_reference
        temp_file = None
        session_id = None

        if "/" in dataset_ref and not dataset_ref.startswith("/tmp"):
            # This is a storage path, download to temp
            logger.info(f"Downloading file from storage: {dataset_ref}")
            temp_file = await database_service.download_file_to_temp(dataset_ref)
            dataset_ref = temp_file
            # Extract session_id from storage path (format: "session_id/file.csv")
            session_id = request.dataset_reference.split("/")[0] if "/" in request.dataset_reference else None

        # Apply derived variables if any exist
        if session_id and dataset_ref:
            logger.info(f"Checking for derived variables in session {session_id}")
            dataset_ref = await database_service.apply_derived_variables_to_dataset(
                dataset_path=dataset_ref,
                session_id=session_id,
                python_service_url=settings.python_service_url
            )
            # Update temp_file to point to new file with derived variables
            temp_file = dataset_ref

        # Update request with local path
        request_data = request.model_dump()
        request_data["dataset_reference"] = dataset_ref

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.python_service_url}/visualize",
                json=request_data,
                timeout=30.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"error_code": "VISUALIZATION_FAILED", "message": "Failed to generate visualization"}
                )

            result = response.json()

        # Clean up temp file
        if temp_file:
            import os
            try:
                os.remove(temp_file)
            except:
                pass

        return result

    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Python service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "SERVICE_UNAVAILABLE", "message": "Python service unavailable"}
        )
    except Exception as e:
        logger.error(f"Failed to generate visualization: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "VISUALIZATION_FAILED", "message": str(e)}
        )
