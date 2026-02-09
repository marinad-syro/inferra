"""LLM proxy endpoint for centralized LLM access."""

import logging
from typing import Union

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import LLMProxyRequest, LLMProxyResponse, LLMReasoningResponse
from app.services.llm_adapter import llm_adapter
from app.services.supabase_client import supabase_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/llm-proxy",
    response_model=Union[LLMProxyResponse, LLMReasoningResponse],
    status_code=status.HTTP_200_OK,
    summary="LLM proxy",
    description="Centralized endpoint for all LLM API calls with support for file uploads and reasoning"
)
async def llm_proxy(request: LLMProxyRequest) -> Union[LLMProxyResponse, LLMReasoningResponse]:
    """
    Proxy endpoint for LLM API calls.

    All LLM usage should go through this endpoint for:
    - Centralized logging
    - Usage tracking
    - Rate limiting
    - Caching
    - Cost monitoring

    Supports:
    - File-based queries (dataset uploads)
    - Reasoning models (with thinking process)
    - Model overrides

    Args:
        request: LLM proxy request

    Returns:
        LLMProxyResponse or LLMReasoningResponse with LLM response and metadata

    Raises:
        HTTPException: If LLM call fails
    """
    try:
        logger.info(f"LLM proxy request: {request.prompt[:100]}...")

        # Handle reasoning model request
        if request.use_reasoning:
            logger.info(f"Using reasoning model with effort: {request.reasoning_effort}")
            result = await llm_adapter.call_reasoning_model(
                prompt=request.prompt,
                reasoning_effort=request.reasoning_effort or "low",
                context=request.context,
                max_tokens=request.max_tokens
            )

            # Convert to LLMReasoningResponse
            response = LLMReasoningResponse(
                reasoning_content=result["reasoning_content"],
                response=result["response"],
                reasoning_tokens=result["reasoning_tokens"],
                completion_tokens=result["completion_tokens"],
                total_tokens=result["total_tokens"],
                latency_ms=result["latency_ms"],
                model=result["model"]
            )

            # Log to Supabase (non-blocking, best effort)
            try:
                await supabase_service.log_llm_call(
                    prompt=request.prompt,
                    response=response.response,
                    latency_ms=response.latency_ms,
                    user_id=request.metadata.get("user_id") if request.metadata else None,
                    metadata={
                        "reasoning_tokens": response.reasoning_tokens,
                        "total_tokens": response.total_tokens,
                        "model": response.model,
                        "reasoning": True
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to log LLM call: {str(e)}")

            return response

        # Handle file-based query (dataset upload)
        if request.dataset_reference:
            logger.info(f"Using file-based query with dataset: {request.dataset_reference}")
            response = await llm_adapter.call_llm_with_dataset(
                prompt=request.prompt,
                dataset_path=request.dataset_reference,
                context=request.context,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                model=request.model
            )
        else:
            # Standard LLM call
            response = await llm_adapter.call_llm(
                prompt=request.prompt,
                context=request.context,
                metadata=request.metadata,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                model=request.model
            )

        # Log to Supabase (non-blocking, best effort)
        try:
            await supabase_service.log_llm_call(
                prompt=request.prompt,
                response=response.response,
                latency_ms=response.latency_ms,
                user_id=request.metadata.get("user_id") if request.metadata else None,
                metadata={
                    "usage": response.usage.model_dump() if response.usage else None,
                    "model": response.model,
                    "with_dataset": request.dataset_reference is not None
                }
            )
        except Exception as e:
            logger.warning(f"Failed to log LLM call: {str(e)}")

        return response

    except Exception as e:
        logger.error(f"LLM proxy failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "LLM_CALL_FAILED",
                "message": "LLM API call failed",
                "details": {"error": str(e)}
            }
        )
