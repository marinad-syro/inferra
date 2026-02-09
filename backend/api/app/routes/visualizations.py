"""Visualization suggestion endpoints."""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.llm_adapter import llm_adapter
from app.services.database import database_service

logger = logging.getLogger(__name__)

router = APIRouter()


class VisualizationSuggestionRequest(BaseModel):
    """Request for visualization suggestions."""
    columns: List[str] = Field(..., description="Dataset column names")
    research_question: Optional[str] = Field(None, description="User's research question")
    distribution_type: Optional[str] = Field(None, description="Data distribution type")
    has_outliers: Optional[bool] = Field(None, description="Whether dataset has outliers")
    dataset_reference: Optional[str] = Field(None, description="Dataset storage path for better context")


class VisualizationSuggestion(BaseModel):
    """Single visualization suggestion."""
    plot_type: str = Field(..., description="Plot type (histogram, scatter, line, bar, boxplot, density)")
    columns: List[str] = Field(..., description="Columns to use in visualization")
    title: str = Field(..., description="Visualization title")
    description: str = Field(..., description="What this visualization reveals")


class VisualizationSuggestionsResponse(BaseModel):
    """Response with visualization suggestions."""
    suggestions: List[VisualizationSuggestion] = Field(..., description="List of visualization suggestions")


@router.post(
    "/suggest-visualizations",
    response_model=VisualizationSuggestionsResponse,
    status_code=status.HTTP_200_OK,
    summary="Suggest visualizations",
    description="Generate AI-powered visualization suggestions based on data characteristics"
)
async def suggest_visualizations(request: VisualizationSuggestionRequest):
    """
    Generate visualization suggestions using LLM.

    Takes into account:
    - Available columns
    - Research question
    - Data distribution
    - Presence of outliers
    - Actual dataset (if storage path provided)

    Returns:
        List of visualization suggestions
    """
    try:
        # Download dataset file if storage path provided
        dataset_path = None
        temp_file = None

        if request.dataset_reference:
            if "/" in request.dataset_reference and not request.dataset_reference.startswith("/tmp"):
                logger.info(f"Downloading dataset for visualization suggestions: {request.dataset_reference}")
                temp_file = await database_service.download_file_to_temp(request.dataset_reference)
                dataset_path = temp_file

        # Call LLM adapter
        suggestions = await llm_adapter.suggest_visualizations(
            columns=request.columns,
            research_question=request.research_question,
            distribution_type=request.distribution_type,
            has_outliers=request.has_outliers,
            dataset_path=dataset_path
        )

        # Clean up temp file
        if temp_file:
            import os
            try:
                os.remove(temp_file)
            except:
                pass

        # Convert to response format
        viz_suggestions = [
            VisualizationSuggestion(**sug) for sug in suggestions
        ]

        return VisualizationSuggestionsResponse(suggestions=viz_suggestions)

    except Exception as e:
        logger.error(f"Failed to generate visualization suggestions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "SUGGESTION_FAILED",
                "message": "Failed to generate visualization suggestions",
                "details": {"error": str(e)}
            }
        )
