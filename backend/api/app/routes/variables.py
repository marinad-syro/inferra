"""
Derived variable management endpoints.

Handles CRUD operations for user-defined derived variables.
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.models.schemas import (
    DerivedVariableCreate,
    DerivedVariableResponse,
    ToggleVariableRequest,
    ErrorResponse
)
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/variables/{session_id}", response_model=List[DerivedVariableResponse])
async def get_variables(session_id: str):
    """
    Get all derived variables for a session.

    Returns all derived variables ordered by creation time.
    """
    try:
        variables = await database_service.get_derived_variables(session_id)
        return variables
    except Exception as e:
        logger.error(f"Failed to get variables: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "VARIABLES_GET_FAILED", "message": str(e)}
        )


@router.post("/variables", response_model=DerivedVariableResponse, status_code=status.HTTP_201_CREATED)
async def create_variable(session_id: str, request: DerivedVariableCreate):
    """
    Create a new derived variable.

    Creates a derived variable with the specified formula and metadata.
    """
    try:
        # Validate required fields
        if not request.name or not request.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_NAME", "message": "Variable name is required"}
            )

        if not request.formula or not request.formula.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_FORMULA", "message": "Variable formula is required"}
            )

        logger.info(f"Creating variable '{request.name}' with formula: {request.formula[:100]}...")

        variable_data = request.model_dump(exclude_none=True)
        variable = await database_service.create_derived_variable(
            session_id,
            variable_data
        )

        logger.info(f"Successfully created variable: {variable.get('id')}")
        return variable
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create variable '{request.name}': {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "VARIABLE_CREATE_FAILED", "message": str(e)}
        )


@router.patch("/variables/{variable_id}/toggle", response_model=DerivedVariableResponse)
async def toggle_variable(variable_id: str, request: ToggleVariableRequest):
    """
    Toggle variable enabled status.

    Enables or disables a derived variable.
    """
    try:
        variable = await database_service.toggle_variable(
            variable_id,
            request.is_enabled
        )
        return variable
    except Exception as e:
        logger.error(f"Failed to toggle variable: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "VARIABLE_TOGGLE_FAILED", "message": str(e)}
        )


@router.delete("/variables/{variable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variable(variable_id: str):
    """
    Delete a derived variable.

    Permanently deletes a derived variable.
    """
    try:
        await database_service.delete_variable(variable_id)
        return None
    except Exception as e:
        logger.error(f"Failed to delete variable: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "VARIABLE_DELETE_FAILED", "message": str(e)}
        )
