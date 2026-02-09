"""Health check endpoint."""

import logging
from datetime import datetime

import httpx
from fastapi import APIRouter, status

from app.config.settings import settings
from app.models.schemas import HealthStatus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthStatus,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Check the health status of the API and its dependencies"
)
async def health_check():
    """
    Health check endpoint.

    Checks:
    - API gateway is running
    - Python service is reachable
    - Configuration is loaded

    Returns:
        HealthStatus: Health status information
    """
    dependencies = {}

    # Check Python service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.python_service_url}/health")
            if response.status_code == 200:
                dependencies["python_service"] = "healthy"
            else:
                dependencies["python_service"] = f"unhealthy (status: {response.status_code})"
    except Exception as e:
        logger.warning(f"Python service health check failed: {str(e)}")
        dependencies["python_service"] = f"unreachable ({str(e)})"

    # Check Supabase configuration
    if settings.supabase_url and settings.supabase_anon_key:
        dependencies["supabase"] = "configured"
    else:
        dependencies["supabase"] = "not configured"

    # Check XAI SDK configuration
    if settings.xai_api_key and "placeholder" not in settings.xai_api_key.lower():
        dependencies["xai_llm"] = "configured"
    else:
        dependencies["xai_llm"] = "not configured (placeholder credentials)"

    # Determine overall status
    overall_status = "healthy"
    if dependencies.get("python_service", "").startswith("unhealthy") or \
       dependencies.get("python_service", "").startswith("unreachable"):
        overall_status = "degraded"

    return HealthStatus(
        status=overall_status,
        version=settings.api_version,
        timestamp=datetime.utcnow(),
        dependencies=dependencies
    )
