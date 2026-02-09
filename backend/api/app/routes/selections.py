"""
Analysis selection management endpoints.

Handles CRUD operations for analysis selections, including AI-generated
suggestions and user selections.
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    AnalysisSelectionBatchCreate,
    AnalysisSelectionResponse,
    UpdateColumnsRequest,
    ErrorResponse
)
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/selections/{session_id}", response_model=List[AnalysisSelectionResponse])
async def get_selections(session_id: str):
    """
    Get all analysis selections for a session.

    Returns all analysis selections including AI suggestions and user selections.
    """
    try:
        selections = await database_service.get_analysis_selections(session_id)
        return selections
    except Exception as e:
        logger.error(f"Failed to get selections: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SELECTIONS_GET_FAILED", "message": str(e)}
        )


@router.post("/selections", response_model=List[AnalysisSelectionResponse], status_code=status.HTTP_201_CREATED)
async def create_selections(session_id: str, request: AnalysisSelectionBatchCreate):
    """
    Batch create analysis selections.

    Creates multiple analysis selections for a session. This replaces
    any existing selections for the session.

    Typically used to store AI-generated analysis suggestions.
    """
    try:
        # Convert Pydantic models to dicts
        selections_data = [
            selection.model_dump(exclude_none=True)
            for selection in request.selections
        ]

        # Create selections (this will replace existing ones)
        selections = await database_service.create_analysis_selections(
            session_id,
            selections_data
        )
        return selections
    except Exception as e:
        logger.error(f"Failed to create selections: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SELECTIONS_CREATE_FAILED", "message": str(e)}
        )


@router.patch("/selections/{selection_id}/toggle", response_model=AnalysisSelectionResponse)
async def toggle_selection(selection_id: str):
    """
    Toggle is_selected status.

    Toggles the selection status for an analysis. Used when users
    check/uncheck analyses to run.
    """
    try:
        selection = await database_service.toggle_selection(selection_id)
        return selection
    except Exception as e:
        logger.error(f"Failed to toggle selection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SELECTION_TOGGLE_FAILED", "message": str(e)}
        )


@router.patch("/selections/{selection_id}/columns", response_model=AnalysisSelectionResponse)
async def update_selection_columns(selection_id: str, request: UpdateColumnsRequest):
    """
    Update selected columns for an analysis.

    Updates which columns are selected for a specific analysis.
    """
    try:
        selection = await database_service.update_selection_columns(
            selection_id,
            request.columns
        )
        return selection
    except Exception as e:
        logger.error(f"Failed to update columns: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "COLUMNS_UPDATE_FAILED", "message": str(e)}
        )
