"""
Code canvas endpoints for code generation and execution.

Supports Python and R code generation from UI operations and execution.
"""

import logging
import httpx
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.models.schemas import (
    CodeExecutionRequest,
    CodeExecutionResponse,
    CodeGenerationRequest,
    CodeGenerationResponse,
    CodeLanguage,
    ErrorResponse
)
from app.config.settings import settings
from app.services.database import database_service
from app.services.code_generator import code_generator
from app.services.dataset_versions import dataset_version_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/code-canvas/{session_id}/generate", response_model=CodeGenerationResponse)
async def generate_code(
    session_id: str,
    language: CodeLanguage = Query(default=CodeLanguage.PYTHON, description="Target language"),
    include_cleaning: bool = Query(default=True, description="Include data cleaning code"),
    include_transforms: bool = Query(default=True, description="Include derived variables"),
    include_analyses: bool = Query(default=True, description="Include analyses")
):
    """
    Generate executable code from UI operations.

    Reads the session's wrangling config, derived variables, and analyses,
    then generates Python or R code representing all operations.
    """
    try:
        # Fetch session data
        session = await database_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"}
            )

        operations_included = []

        # Fetch wrangling config
        wrangling_config = None
        if include_cleaning:
            wrangling_config = await database_service.get_wrangling_config(session_id)
            if wrangling_config:
                operations_included.append("data_cleaning")

        # Fetch derived variables
        derived_variables = None
        if include_transforms:
            derived_variables = await database_service.get_derived_variables(session_id)
            if derived_variables and len(derived_variables) > 0:
                operations_included.append("derived_variables")

        # Fetch analyses (from selections)
        analyses = None
        if include_analyses:
            all_selections = await database_service.get_analysis_selections(session_id)
            if all_selections and len(all_selections) > 0:
                # Only include analyses that user has explicitly selected
                selected_analyses = [s for s in all_selections if s.get('is_selected', False)]
                if selected_analyses and len(selected_analyses) > 0:
                    analyses = selected_analyses
                    operations_included.append("analyses")

        # Generate code
        code = code_generator.generate_full_script(
            language=language.value,
            session_id=session_id,
            wrangling_config=wrangling_config,
            derived_variables=derived_variables,
            analyses=analyses
        )

        return CodeGenerationResponse(
            code=code,
            language=language.value,
            operations_included=operations_included
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate code: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "CODE_GENERATION_FAILED", "message": str(e)}
        )


@router.post("/code-canvas/{session_id}/execute", response_model=CodeExecutionResponse)
async def execute_code(session_id: str, request: CodeExecutionRequest):
    """
    Execute user-edited code (Python or R) and return results.

    Routes the request to the appropriate service based on language:
    - Python: Python service (port 8001)
    - R: R service (port 8002)

    Creates a new dataset version if execution succeeds.
    """
    try:
        # Validate session exists
        session = await database_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"}
            )

        # Get current dataset version
        current_version = await dataset_version_service.get_current_version(session_id)
        if not current_version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "NO_DATASET", "message": "No dataset found for this session. Please upload a dataset first."}
            )

        dataset_reference = current_version['dataset_reference']
        logger.info(f"Loading dataset from version {current_version['version_number']}: {dataset_reference}")

        # Route to appropriate service based on language
        if request.language == CodeLanguage.PYTHON:
            service_url = settings.python_service_url or "http://localhost:8001"
        elif request.language == CodeLanguage.R:
            service_url = settings.r_service_url or "http://localhost:8002"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_LANGUAGE", "message": f"Unsupported language: {request.language}"}
            )

        # Forward request to execution service
        logger.info(f"Executing {request.language} code for session {session_id}")
        logger.debug(f"Forwarding to {service_url}/execute-code")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{service_url}/execute-code",
                json={
                    "code": request.code,
                    "session_id": session_id,
                    "dataset_reference": dataset_reference
                }
            )
            result = response.json()

        # If execution succeeded, create a new dataset version
        if result.get("success"):
            logger.info(f"Code execution succeeded: {result.get('row_count')} rows")

            # Save result dataset to CSV file
            import tempfile
            import csv
            temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv')
            temp_path = temp_file.name

            # Write CSV data from result dataset
            if result['dataset'] and len(result['dataset']) > 0:
                writer = csv.DictWriter(temp_file, fieldnames=result['column_names'])
                writer.writeheader()
                writer.writerows(result['dataset'])
            temp_file.close()

            # Create new version
            new_version = await dataset_version_service.create_version(
                session_id=session_id,
                dataset_path=temp_path,
                row_count=result['row_count'],
                column_names=result['column_names'],
                source='code_canvas',
                description=f"Code execution ({request.language})",
                code_snapshot=request.code,
                operation_metadata={
                    "language": request.language.value,
                    "previous_row_count": current_version['row_count'],
                    "new_row_count": result['row_count']
                },
                parent_version_id=current_version['id']
            )

            logger.info(f"Created new dataset version {new_version['version_number']}")

            return CodeExecutionResponse(**result)
        else:
            logger.error(f"Code execution failed: {result.get('error')}")
            return CodeExecutionResponse(**result)

    except HTTPException:
        raise
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to execution service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "SERVICE_UNAVAILABLE",
                "message": f"{request.language.capitalize()} execution service is not available"
            }
        )
    except Exception as e:
        logger.error(f"Failed to execute code: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "CODE_EXECUTION_FAILED", "message": str(e)}
        )


@router.get("/code-canvas/{session_id}/status")
async def get_code_canvas_status(session_id: str):
    """
    Get status of code canvas for a session.

    Returns information about available data and code generation capabilities.
    """
    try:
        session = await database_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"}
            )

        # Check what's available
        wrangling_config = await database_service.get_wrangling_config(session_id)
        derived_variables = await database_service.get_derived_variables(session_id)
        selections = await database_service.get_analysis_selections(session_id)

        return {
            "session_id": session_id,
            "has_data": bool(session.get("dataset_reference")),
            "has_cleaning": bool(wrangling_config),
            "has_transforms": bool(derived_variables and len(derived_variables) > 0),
            "has_analyses": bool(selections and len(selections) > 0),
            "supported_languages": ["python", "r"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get code canvas status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "STATUS_CHECK_FAILED", "message": str(e)}
        )
