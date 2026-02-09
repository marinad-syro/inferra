"""Decision endpoint for analysis decision logic."""

import logging

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import DecisionRequest, DecisionResult
from app.services.decision import decision_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/decide",
    response_model=DecisionResult,
    status_code=status.HTTP_200_OK,
    summary="Get analysis decision",
    description="Determine which analysis to run based on prompt and dataset schema"
)
async def decide_analysis(request: DecisionRequest) -> DecisionResult:
    """
    Decide which analysis to run based on prompt and dataset schema.

    Uses deterministic rules to match the request to a specific
    Python library and function. Returns decision with confidence score.

    Args:
        request: Decision request with prompt and dataset schema

    Returns:
        DecisionResult with recommended analysis

    Raises:
        HTTPException: If decision fails
    """
    try:
        logger.info(f"Processing decision request: {request.prompt[:100]}...")

        # Get decision from service (supports file-based and reasoning fallback)
        decision = await decision_service.get_decision(
            prompt=request.prompt,
            dataset_schema=request.dataset_schema,
            dataset_path=request.dataset_path,
            use_reasoning=request.use_reasoning
        )

        logger.info(
            f"Decision result: {decision.source} - "
            f"{decision.library}.{decision.function} (confidence: {decision.confidence:.2f})"
        )

        return decision

    except Exception as e:
        logger.error(f"Decision failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "DECISION_FAILED",
                "message": "Failed to make analysis decision",
                "details": {"error": str(e)}
            }
        )
