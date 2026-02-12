"""Execution endpoints for running analyses."""

import logging
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, status

from app.config.settings import settings
from app.models.schemas import (
    AnalysisJob,
    AnalysisRequest,
    AnalysisResults,
    DecisionResult,
    JobProvenance,
    JobStatus
)
from app.services.decision import decision_service
from app.services.supabase_client import supabase_service
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/run",
    status_code=status.HTTP_200_OK,
    summary="Execute analysis",
    description="Execute an analysis with a provided decision"
)
async def run_analysis(request: AnalysisRequest):
    """
    Execute an analysis job.

    Simplified flow (no job tracking):
    1. Download file from storage if needed
    2. Apply data cleaning transformations (label standardization, duplicates, invalid values)
    3. Apply derived variables to dataset
    4. Get decision from LLM (using local temp file) or use execution_spec directly
    5. Forward to python-service
    6. Return results

    Args:
        request: Analysis request

    Returns:
        Analysis results
    """
    temp_file = None
    try:
        # Step 1: Download file from storage if needed
        dataset_ref = request.dataset_reference
        session_id = None

        logger.info(f"[DIAGNOSTIC] Received dataset_reference: {dataset_ref}")
        logger.info(f"[DIAGNOSTIC] Has execution_spec: {request.execution_spec is not None}")
        if request.execution_spec:
            logger.info(f"[DIAGNOSTIC] execution_spec.param_map: {request.execution_spec.param_map}")

        # Check if this is a storage path (format: "session_id/file.csv")
        # vs a local file path (format: "/path/to/file.csv")
        if "/" in dataset_ref and not dataset_ref.startswith("/"):
            # Extract session_id from storage path BEFORE downloading (format: "session_id/file.csv")
            session_id = request.dataset_reference.split("/")[0]
            logger.info(f"[DIAGNOSTIC] Extracted session_id from storage path: {session_id}")

            # This is a storage path, download to temp
            logger.info(f"Downloading file from storage: {dataset_ref}")
            temp_file = await database_service.download_file_to_temp(dataset_ref)
            dataset_ref = temp_file
        else:
            logger.warning(f"[DIAGNOSTIC] session_id is None - dataset_reference does not match storage path format")

        # Step 2: Apply data cleaning transformations if configured
        if session_id and dataset_ref:
            try:
                logger.info(f"[DIAGNOSTIC] Checking for cleaning configuration for session {session_id}")
                wrangling_config = await database_service.get_wrangling_config(session_id)

                if wrangling_config:
                    # Check if any cleaning configuration is present
                    has_cleaning_config = (
                        wrangling_config.get("label_standardization") or
                        wrangling_config.get("duplicate_handling") != "keep_all" or
                        wrangling_config.get("invalid_value_handling")
                    )

                    if has_cleaning_config:
                        logger.info(f"[DIAGNOSTIC] Applying data cleaning transformations")
                        cleaned_dataset = await database_service.apply_cleaning_to_dataset(
                            dataset_reference=dataset_ref,
                            wrangling_config=wrangling_config
                        )

                        # Write cleaned dataset to temp file
                        import pandas as pd
                        import tempfile

                        df_cleaned = pd.DataFrame(cleaned_dataset)
                        temp_cleaned = tempfile.NamedTemporaryFile(
                            mode='w',
                            suffix='.csv',
                            delete=False
                        )
                        df_cleaned.to_csv(temp_cleaned.name, index=False)
                        temp_cleaned.close()

                        # Update dataset_ref and temp_file to point to cleaned version
                        dataset_ref = temp_cleaned.name
                        temp_file = temp_cleaned.name

                        logger.info(f"[DIAGNOSTIC] Data cleaning applied: {len(cleaned_dataset)} rows")
                    else:
                        logger.info(f"[DIAGNOSTIC] No cleaning configuration found, skipping cleaning step")
                else:
                    logger.info(f"[DIAGNOSTIC] No wrangling config found, skipping cleaning step")
            except Exception as e:
                logger.warning(f"[DIAGNOSTIC] Failed to apply cleaning, continuing without it: {e}")

        # Step 3: Apply derived variables if any exist
        if session_id and dataset_ref:
            logger.info(f"[DIAGNOSTIC] Applying derived variables for session {session_id}")
            dataset_ref = await database_service.apply_derived_variables_to_dataset(
                dataset_path=dataset_ref,
                session_id=session_id,
                python_service_url=settings.python_service_url
            )
            # Update temp_file to point to new file with derived variables
            temp_file = dataset_ref

            # Log columns after applying derived variables
            import pandas as pd
            try:
                df_check = pd.read_csv(dataset_ref)
                logger.info(f"[DIAGNOSTIC] Columns after applying derived variables: {list(df_check.columns)}")
            except Exception as e:
                logger.warning(f"[DIAGNOSTIC] Could not read columns after derived variables: {e}")
        else:
            logger.warning(f"[DIAGNOSTIC] Skipping derived variables (session_id={session_id}, dataset_ref={dataset_ref is not None})")
            # Log columns in original dataset
            import pandas as pd
            try:
                df_check = pd.read_csv(dataset_ref)
                logger.info(f"[DIAGNOSTIC] Columns in dataset (no derived variables applied): {list(df_check.columns)}")
            except Exception as e:
                logger.warning(f"[DIAGNOSTIC] Could not read columns: {e}")

        # Step 4: Determine how to run the analysis
        # IMPORTANT: All analyses use Python service (port 8001), never R service
        python_service_url = settings.python_service_url
        if not python_service_url:
            python_service_url = "http://localhost:8001"

        analyze_endpoint = f"{python_service_url}/analyze"
        logger.info(f"Using Python service for analysis: {analyze_endpoint}")

        if request.execution_spec:
            # Use execution_spec directly — skip decision service entirely
            logger.info(f"Using execution_spec directly, skipping decision service: "
                        f"{request.execution_spec.library}.{request.execution_spec.function}")

            param_map_for_service = {
                k: {"column": v}
                for k, v in request.execution_spec.param_map.items()
            }

            payload = {
                "dataset_reference": dataset_ref,
                "decision": {
                    "library": request.execution_spec.library,
                    "function": request.execution_spec.function,
                    "param_map": param_map_for_service
                },
                "job_id": "temp"
            }

            # Build a minimal decision object for the response
            from app.models.schemas import DecisionResult, DecisionSource
            decision = DecisionResult(
                library=request.execution_spec.library,
                function=request.execution_spec.function,
                param_map=None,
                confidence=1.0,
                source=DecisionSource.DETERMINISTIC,
                explanation="Executed from frontend-provided execution_spec"
            )
        else:
            # Fallback: existing decision flow (deterministic rules → LLM)
            if not request.prompt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error_code": "MISSING_INPUT",
                        "message": "Either execution_spec or prompt must be provided"
                    }
                )

            dataset_schema = request.dataset_schema

            # IMPORTANT: Read actual columns from the dataset after derived variables are applied
            import pandas as pd
            try:
                df_actual = pd.read_csv(dataset_ref)
                actual_columns = list(df_actual.columns)
                logger.info(f"Actual columns in dataset after derived variables: {actual_columns}")
            except Exception as e:
                logger.warning(f"Could not read actual columns: {e}")
                actual_columns = []

            decision = await decision_service.get_decision(
                prompt=request.prompt,
                dataset_schema=dataset_schema,
                dataset_path=dataset_ref
            )

            if decision.source == "none":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error_code": "NO_DECISION",
                        "message": "Could not determine appropriate analysis",
                        "suggestion": "Try rephrasing your request or providing more details"
                    }
                )

            logger.info(f"Decision: {decision.library}.{decision.function}")

            param_map_for_service = {}
            if decision.param_map:
                for k, v in decision.param_map.items():
                    if v.column:
                        param_map_for_service[k] = {"column": v.column}
                    else:
                        param_map_for_service[k] = {"type": v.type}

            payload = {
                "dataset_reference": dataset_ref,
                "decision": {
                    "library": decision.library,
                    "function": decision.function,
                    "param_map": param_map_for_service
                },
                "job_id": "temp"
            }

        logger.info(f"Forwarding to python-service at {analyze_endpoint}: {decision.library}.{decision.function}")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(analyze_endpoint, json=payload)

            if response.status_code != 200:
                error_msg = f"Python service error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error_code": "ANALYSIS_FAILED",
                        "message": "Analysis execution failed",
                        "details": {"error": error_msg}
                    }
                )

            analysis_result = response.json()
            logger.info(f"Python service response: {analysis_result}")

        # Check if analysis succeeded
        if analysis_result.get("status") == "error":
            error_msg = analysis_result.get("error", "Unknown error")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "error_code": "ANALYSIS_ERROR",
                    "message": "Analysis execution encountered an error",
                    "details": {"error": error_msg}
                }
            )

        # Build results
        results = {
            "status": "completed",
            "results": analysis_result.get("results", {}),
            "decision": decision.model_dump(),
            "metadata": analysis_result.get("metadata", {})
        }

        logger.info(f"Analysis completed successfully")

        # Clean up temp file
        if temp_file:
            import os
            try:
                os.remove(temp_file)
            except:
                pass

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis execution failed: {str(e)}", exc_info=True)

        # Clean up temp file in case of error
        if temp_file:
            import os
            try:
                os.remove(temp_file)
            except:
                pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "EXECUTION_FAILED",
                "message": "Failed to execute analysis",
                "details": {"error": str(e)}
            }
        )


@router.get(
    "/jobs/{job_id}",
    status_code=status.HTTP_200_OK,
    summary="Get job status",
    description="Retrieve job details and results"
)
async def get_job(job_id: str):
    """
    Get job details.

    Args:
        job_id: Job ID

    Returns:
        Job details
    """
    try:
        job = await supabase_service.get_job(job_id)

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "JOB_NOT_FOUND",
                    "message": f"Job {job_id} not found"
                }
            )

        return job

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve job: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "RETRIEVAL_FAILED",
                "message": "Failed to retrieve job",
                "details": {"error": str(e)}
            }
        )


@router.post(
    "/analyze",
    status_code=status.HTTP_200_OK,
    summary="Combined analyze endpoint",
    description="Decision + execution in one call"
)
async def analyze(request: AnalysisRequest):
    """
    Convenience endpoint combining decision and execution.

    This is the main endpoint for end-to-end analysis.

    Args:
        request: Analysis request

    Returns:
        Analysis results
    """
    return await run_analysis(request)
