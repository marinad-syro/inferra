"""
Trial structure management endpoints.

Handles trial structure configuration for behavioral experiments.
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    TrialStructureResponse,
    TrialStructureUpdate,
    CountTrialsRequest,
    ErrorResponse
)
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/trials/{session_id}", response_model=TrialStructureResponse)
async def get_trial_structure(session_id: str):
    """
    Get or create trial structure for a session.

    Returns existing trial structure or creates a new one with defaults.
    """
    try:
        trial_structure = await database_service.get_or_create_trial_structure(session_id)
        return trial_structure
    except Exception as e:
        logger.error(f"Failed to get trial structure: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "TRIAL_STRUCTURE_GET_FAILED", "message": str(e)}
        )


@router.patch("/trials/{trial_id}", response_model=TrialStructureResponse)
async def update_trial_structure(trial_id: str, request: TrialStructureUpdate):
    """
    Update trial structure configuration.

    Updates trial event names and detected trial count.
    """
    try:
        updates = request.model_dump(exclude_none=True)
        trial_structure = await database_service.update_trial_structure(
            trial_id,
            updates
        )
        return trial_structure
    except Exception as e:
        logger.error(f"Failed to update trial structure: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "TRIAL_STRUCTURE_UPDATE_FAILED", "message": str(e)}
        )


@router.post("/trials/{trial_id}/count")
async def count_trials(trial_id: str, request: CountTrialsRequest):
    """
    Count trials in data based on onset event.

    Analyzes the provided data to count trials and updates the trial structure.
    """
    try:
        # Count trials based on onset event
        count = len([row for row in request.data if row.get("event_type") == request.onset_event])

        # Update trial structure with count
        updated_structure = await database_service.update_trial_structure(
            trial_id,
            {"trials_detected": count}
        )

        return {
            "trials_detected": count,
            "trial_structure": updated_structure
        }
    except Exception as e:
        logger.error(f"Failed to count trials: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "TRIAL_COUNT_FAILED", "message": str(e)}
        )
