"""
Workflow session management endpoints.

Handles CRUD operations for workflow sessions including step tracking
and metadata updates.
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    SessionCreate,
    SessionResponse,
    SessionStepUpdate,
    SessionMetadataUpdate,
    ErrorResponse
)
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(request: SessionCreate = SessionCreate()):
    """
    Create a new workflow session.

    Creates a new workflow session with the specified initial step
    (defaults to step 1).
    """
    try:
        session = await database_service.create_session(request.current_step)
        return session
    except Exception as e:
        logger.error(f"Failed to create session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SESSION_CREATE_FAILED", "message": str(e)}
        )


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """
    Get workflow session by ID.

    Retrieves the complete session data including current step and metadata.
    """
    try:
        session = await database_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"}
            )
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SESSION_GET_FAILED", "message": str(e)}
        )


@router.patch("/sessions/{session_id}/step", response_model=SessionResponse)
async def update_session_step(session_id: str, request: SessionStepUpdate):
    """
    Update current workflow step.

    Updates the current step number for the session. Used to track
    user progress through the workflow.
    """
    try:
        # Verify session exists
        session = await database_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"}
            )

        # Update step
        updated_session = await database_service.update_session_step(session_id, request.step)
        return updated_session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update session step: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SESSION_UPDATE_FAILED", "message": str(e)}
        )


@router.patch("/sessions/{session_id}/metadata", response_model=SessionResponse)
async def update_session_metadata(session_id: str, request: SessionMetadataUpdate):
    """
    Update session metadata.

    Updates metadata fields like research question, distribution type,
    outlier information, etc.
    """
    try:
        # Verify session exists
        session = await database_service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": f"Session {session_id} not found"}
            )

        # Update metadata (only include non-None fields)
        metadata = request.model_dump(exclude_none=True)
        updated_session = await database_service.update_session_metadata(session_id, metadata)
        return updated_session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update session metadata: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "SESSION_UPDATE_FAILED", "message": str(e)}
        )
