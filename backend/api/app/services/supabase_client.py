"""Supabase client service for database operations."""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from supabase import Client, create_client

from app.config.settings import settings
from app.models.schemas import AnalysisRequest, AnalysisResults, DecisionResult

logger = logging.getLogger(__name__)


class SupabaseService:
    """Service for interacting with Supabase database."""

    def __init__(self):
        """Initialize Supabase client."""
        # Skip initialization if using placeholder credentials (for testing)
        if "placeholder" in settings.supabase_url.lower() or "placeholder" in settings.supabase_service_role_key.lower():
            logger.warning("Supabase client initialized with placeholder credentials - database operations will fail")
            self.client = None
        else:
            try:
                # Use service_role_key for backend admin access
                # Simple initialization as per supabase-py docs
                self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
                logger.info("Supabase client initialized with service role key")
            except Exception as e:
                logger.warning(f"Supabase client initialization failed: {str(e)}. Database operations will not work.")
                self.client = None

    def validate_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate Supabase JWT token and extract payload.

        Note: For production, this should use JWK-based RS256 verification
        by fetching keys from: {supabase_url}/.well-known/jwks.json

        Args:
            token: JWT token string

        Returns:
            Token payload if valid, None otherwise
        """
        try:
            # Temporary: decode without verification for development
            # TODO: Implement JWK-based RS256 verification for production
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            return payload
        except JWTError as e:
            logger.warning(f"JWT validation failed: {str(e)}")
            return None

    async def create_job(
        self,
        user_id: str,
        analysis_request: AnalysisRequest
    ) -> str:
        """
        Create a new analysis job in the database.

        Args:
            user_id: User ID
            analysis_request: Analysis request details

        Returns:
            Job ID
        """
        job_data = {
            "user_id": user_id,
            "status": "created",
            "dataset_reference": analysis_request.dataset_reference,
            "prompt": analysis_request.prompt,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        try:
            response = self.client.table("jobs").insert(job_data).execute()
            job_id = response.data[0]["id"]
            logger.info(f"Created job {job_id} for user {user_id}")
            return str(job_id)
        except Exception as e:
            logger.error(f"Failed to create job: {str(e)}")
            raise

    async def update_job_status(
        self,
        job_id: str,
        status: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Update job status in the database.

        Args:
            job_id: Job ID
            status: New status (created, running, completed, failed)
            metadata: Optional metadata to store
        """
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }

        if metadata:
            update_data["metadata"] = metadata

        try:
            self.client.table("jobs").update(update_data).eq("id", job_id).execute()
            logger.info(f"Updated job {job_id} status to {status}")
        except Exception as e:
            logger.error(f"Failed to update job status: {str(e)}")
            raise

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve job details from the database.

        Args:
            job_id: Job ID

        Returns:
            Job data if found, None otherwise
        """
        try:
            response = self.client.table("jobs").select("*").eq("id", job_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve job: {str(e)}")
            return None

    async def save_job_results(
        self,
        job_id: str,
        results: AnalysisResults,
        provenance: Dict[str, Any]
    ) -> None:
        """
        Save analysis results and provenance to the database.

        Args:
            job_id: Job ID
            results: Analysis results
            provenance: Provenance information
        """
        update_data = {
            "results": results.model_dump(mode="json"),
            "provenance": provenance,
            "status": "completed",
            "updated_at": datetime.utcnow().isoformat()
        }

        try:
            self.client.table("jobs").update(update_data).eq("id", job_id).execute()
            logger.info(f"Saved results for job {job_id}")
        except Exception as e:
            logger.error(f"Failed to save job results: {str(e)}")
            raise

    async def save_job_error(
        self,
        job_id: str,
        error_message: str
    ) -> None:
        """
        Save job error to the database.

        Args:
            job_id: Job ID
            error_message: Error message
        """
        update_data = {
            "status": "failed",
            "error": error_message,
            "updated_at": datetime.utcnow().isoformat()
        }

        try:
            self.client.table("jobs").update(update_data).eq("id", job_id).execute()
            logger.info(f"Saved error for job {job_id}")
        except Exception as e:
            logger.error(f"Failed to save job error: {str(e)}")
            raise

    async def log_decision(
        self,
        job_id: str,
        decision_result: DecisionResult
    ) -> None:
        """
        Log a decision to the database.

        Args:
            job_id: Job ID
            decision_result: Decision result
        """
        log_data = {
            "job_id": job_id,
            "rule_id": decision_result.rule_id,
            "library": decision_result.library,
            "function": decision_result.function,
            "confidence": decision_result.confidence,
            "source": decision_result.source,
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            self.client.table("decision_logs").insert(log_data).execute()
            logger.info(f"Logged decision for job {job_id}")
        except Exception as e:
            logger.warning(f"Failed to log decision: {str(e)}")
            # Non-critical, don't raise

    async def log_llm_call(
        self,
        prompt: str,
        response: str,
        latency_ms: float,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log an LLM API call to the database.

        Args:
            prompt: Prompt sent to LLM (truncated for storage)
            response: LLM response (truncated for storage)
            latency_ms: Request latency in milliseconds
            user_id: Optional user ID
            metadata: Optional metadata (usage stats, etc.)
        """
        log_data = {
            "user_id": user_id,
            "prompt": prompt[:500],  # Truncate for storage
            "response": response[:500],  # Truncate for storage
            "latency_ms": latency_ms,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat()
        }

        try:
            self.client.table("llm_call_logs").insert(log_data).execute()
            logger.info(f"Logged LLM call (latency: {latency_ms}ms)")
        except Exception as e:
            logger.warning(f"Failed to log LLM call: {str(e)}")
            # Non-critical, don't raise


# Global Supabase service instance
supabase_service = SupabaseService()
