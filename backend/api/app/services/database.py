"""
Centralized database service for all Supabase operations.

This service provides a clean interface for database CRUD operations
used throughout the FastAPI backend, abstracting away direct Supabase calls.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.config.settings import settings
from app.services.supabase_client import supabase_service

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for handling all database operations through Supabase."""

    def __init__(self):
        """Initialize database service with Supabase client."""
        self.client = supabase_service.client

    # ========================================================================
    # WORKFLOW SESSIONS
    # ========================================================================

    async def create_session(self, current_step: int = 1) -> Dict[str, Any]:
        """
        Create a new workflow session.

        Args:
            current_step: Initial workflow step (default: 1)

        Returns:
            Created session data
        """
        try:
            response = self.client.table("workflow_sessions").insert({
                "current_step": current_step,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).execute()

            logger.info(f"Created workflow session: {response.data[0]['id']}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}")
            raise

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get workflow session by ID.

        Args:
            session_id: Session UUID

        Returns:
            Session data if found, None otherwise
        """
        try:
            response = self.client.table("workflow_sessions")\
                .select("*")\
                .eq("id", session_id)\
                .execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get session {session_id}: {str(e)}")
            raise

    async def update_session_step(self, session_id: str, step: int) -> Dict[str, Any]:
        """
        Update current workflow step.

        Args:
            session_id: Session UUID
            step: New step number

        Returns:
            Updated session data
        """
        try:
            response = self.client.table("workflow_sessions")\
                .update({
                    "current_step": step,
                    "updated_at": datetime.utcnow().isoformat()
                })\
                .eq("id", session_id)\
                .execute()

            logger.info(f"Updated session {session_id} to step {step}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to update session step: {str(e)}")
            raise

    async def update_session_metadata(
        self,
        session_id: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update session metadata (research question, distribution type, etc.).

        Args:
            session_id: Session UUID
            metadata: Metadata fields to update

        Returns:
            Updated session data
        """
        try:
            update_data = {**metadata, "updated_at": datetime.utcnow().isoformat()}
            response = self.client.table("workflow_sessions")\
                .update(update_data)\
                .eq("id", session_id)\
                .execute()

            logger.info(f"Updated session {session_id} metadata")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to update session metadata: {str(e)}")
            raise

    # ========================================================================
    # ANALYSIS SELECTIONS
    # ========================================================================

    async def get_analysis_selections(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get all analysis selections for a session.

        Args:
            session_id: Session UUID

        Returns:
            List of analysis selections
        """
        try:
            response = self.client.table("analysis_selections")\
                .select("*")\
                .eq("session_id", session_id)\
                .execute()

            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get analysis selections: {str(e)}")
            raise

    async def create_analysis_selections(
        self,
        session_id: str,
        selections: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Batch create analysis selections (replaces existing ones).

        Args:
            session_id: Session UUID
            selections: List of selection objects to create

        Returns:
            Created selections
        """
        try:
            # Delete existing selections for this session
            self.client.table("analysis_selections")\
                .delete()\
                .eq("session_id", session_id)\
                .execute()

            # Insert new selections
            to_insert = [
                {
                    **selection,
                    "session_id": session_id,
                    "created_at": datetime.utcnow().isoformat()
                }
                for selection in selections
            ]

            response = self.client.table("analysis_selections")\
                .insert(to_insert)\
                .execute()

            logger.info(f"Created {len(selections)} analysis selections for session {session_id}")
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to create analysis selections: {str(e)}")
            raise

    async def toggle_selection(self, selection_id: str) -> Dict[str, Any]:
        """
        Toggle is_selected status of an analysis selection.

        Args:
            selection_id: Selection UUID

        Returns:
            Updated selection
        """
        try:
            # Get current value
            current = self.client.table("analysis_selections")\
                .select("is_selected")\
                .eq("id", selection_id)\
                .single()\
                .execute()

            new_value = not current.data["is_selected"]

            # Update
            response = self.client.table("analysis_selections")\
                .update({"is_selected": new_value})\
                .eq("id", selection_id)\
                .execute()

            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to toggle selection: {str(e)}")
            raise

    async def update_selection_columns(
        self,
        selection_id: str,
        columns: List[str]
    ) -> Dict[str, Any]:
        """
        Update selected columns for an analysis.

        Args:
            selection_id: Selection UUID
            columns: List of column names

        Returns:
            Updated selection
        """
        try:
            response = self.client.table("analysis_selections")\
                .update({"selected_columns": columns})\
                .eq("id", selection_id)\
                .execute()

            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to update selection columns: {str(e)}")
            raise

    # ========================================================================
    # DERIVED VARIABLES
    # ========================================================================

    async def get_derived_variables(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get all derived variables for a session.

        Args:
            session_id: Session UUID

        Returns:
            List of derived variables
        """
        try:
            response = self.client.table("derived_variables")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("created_at", desc=False)\
                .execute()

            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get derived variables: {str(e)}")
            raise

    async def create_derived_variable(
        self,
        session_id: str,
        variable: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a new derived variable.

        Args:
            session_id: Session UUID
            variable: Variable data (name, formula, formula_type, description, is_enabled)

        Returns:
            Created variable
        """
        try:
            to_insert = {
                "session_id": session_id,
                "name": variable["name"],
                "formula": variable["formula"],
                "formula_type": variable.get("formula_type", "eval"),
                "description": variable.get("description"),
                "is_enabled": variable.get("is_enabled", True),
                "created_at": datetime.utcnow().isoformat()
            }

            response = self.client.table("derived_variables")\
                .insert(to_insert)\
                .execute()

            logger.info(f"Created derived variable: {variable['name']}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to create derived variable: {str(e)}")
            raise

    async def toggle_variable(self, variable_id: str, is_enabled: bool) -> Dict[str, Any]:
        """
        Toggle is_enabled status of a derived variable.

        Args:
            variable_id: Variable UUID
            is_enabled: New enabled status

        Returns:
            Updated variable
        """
        try:
            response = self.client.table("derived_variables")\
                .update({"is_enabled": is_enabled})\
                .eq("id", variable_id)\
                .execute()

            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to toggle variable: {str(e)}")
            raise

    async def delete_variable(self, variable_id: str) -> None:
        """
        Delete a derived variable.

        Args:
            variable_id: Variable UUID
        """
        try:
            self.client.table("derived_variables")\
                .delete()\
                .eq("id", variable_id)\
                .execute()

            logger.info(f"Deleted derived variable: {variable_id}")
        except Exception as e:
            logger.error(f"Failed to delete variable: {str(e)}")
            raise

    # ========================================================================
    # TRIAL STRUCTURES
    # ========================================================================

    async def get_or_create_trial_structure(self, session_id: str) -> Dict[str, Any]:
        """
        Get existing trial structure or create a new one.

        Args:
            session_id: Session UUID

        Returns:
            Trial structure data
        """
        try:
            # Try to get existing
            response = self.client.table("trial_structures")\
                .select("*")\
                .eq("session_id", session_id)\
                .execute()

            # If exists, return it
            if response.data and len(response.data) > 0:
                return response.data[0]

            # Create new with defaults
            create_response = self.client.table("trial_structures")\
                .insert({
                    "session_id": session_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                })\
                .execute()

            logger.info(f"Created trial structure for session {session_id}")
            return create_response.data[0]
        except Exception as e:
            logger.error(f"Failed to get/create trial structure: {str(e)}")
            raise

    async def update_trial_structure(
        self,
        structure_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update trial structure.

        Args:
            structure_id: Trial structure UUID
            updates: Fields to update

        Returns:
            Updated trial structure
        """
        try:
            update_data = {**updates, "updated_at": datetime.utcnow().isoformat()}
            response = self.client.table("trial_structures")\
                .update(update_data)\
                .eq("id", structure_id)\
                .execute()

            logger.info(f"Updated trial structure {structure_id}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to update trial structure: {str(e)}")
            raise

    # ========================================================================
    # WRANGLING CONFIGS
    # ========================================================================

    async def get_wrangling_config(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get wrangling config for a session.

        Args:
            session_id: Session UUID

        Returns:
            Wrangling config if found, None otherwise
        """
        try:
            response = self.client.table("wrangling_configs")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("created_at", desc=True)\
                .limit(1)\
                .execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get wrangling config: {str(e)}")
            raise

    async def create_wrangling_config(self, session_id: str) -> Dict[str, Any]:
        """
        Create a new wrangling config.

        Args:
            session_id: Session UUID

        Returns:
            Created wrangling config
        """
        try:
            # Check if already exists
            existing = await self.get_wrangling_config(session_id)
            if existing:
                return existing

            response = self.client.table("wrangling_configs")\
                .insert({
                    "session_id": session_id,
                    "datasets": [],
                    "join_keys": [],
                    "join_warnings": [],
                    "missing_data_strategy": {},
                    "critical_variables": [],
                    "optional_variables": [],
                    "transformations": [],
                    "consistency_checks": [],
                    "is_complete": False,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                })\
                .execute()

            logger.info(f"Created wrangling config for session {session_id}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to create wrangling config: {str(e)}")
            raise

    async def update_wrangling_config(
        self,
        config_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update wrangling config.

        Args:
            config_id: Config UUID
            updates: Fields to update

        Returns:
            Updated config
        """
        try:
            update_data = {**updates, "updated_at": datetime.utcnow().isoformat()}
            response = self.client.table("wrangling_configs")\
                .update(update_data)\
                .eq("id", config_id)\
                .execute()

            logger.info(f"Updated wrangling config {config_id}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to update wrangling config: {str(e)}")
            raise

    async def apply_cleaning_to_dataset(
        self,
        dataset_reference: str,
        wrangling_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Apply data cleaning transformations from wrangling config to dataset.

        This function calls the Python service's /apply-cleaning endpoint with
        the cleaning configuration from the wrangling_config.

        Args:
            dataset_reference: Dataset reference (session_id/filename.csv)
            wrangling_config: Wrangling configuration with cleaning settings

        Returns:
            Cleaned dataset as list of dictionaries
        """
        import httpx

        try:
            # Extract cleaning configuration
            cleaning_config = {
                "dataset_reference": dataset_reference,
                "label_standardization": wrangling_config.get("label_standardization", {}),
                "duplicate_handling": wrangling_config.get("duplicate_handling"),
                "duplicate_id_column": wrangling_config.get("duplicate_id_column"),
                "invalid_value_handling": wrangling_config.get("invalid_value_handling", {})
            }

            # Call Python service
            python_service_url = settings.PYTHON_SERVICE_URL or "http://localhost:8001"
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{python_service_url}/apply-cleaning",
                    json=cleaning_config
                )
                response.raise_for_status()
                result = response.json()

            if result.get("status") == "error":
                raise Exception(f"Cleaning failed: {result.get('error', 'Unknown error')}")

            logger.info(
                f"Applied cleaning: {result.get('rows_before')} → {result.get('rows_after')} rows. "
                f"Changes: {result.get('changes_applied', {})}"
            )

            return result.get("updated_dataset", [])

        except Exception as e:
            logger.error(f"Failed to apply cleaning to dataset: {str(e)}")
            raise

    # ========================================================================
    # FILE UPLOADS
    # ========================================================================

    async def create_file_metadata(
        self,
        session_id: str,
        file_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create file metadata record.

        Args:
            session_id: Session UUID
            file_info: File information (name, type, size, storage_path, etc.)

        Returns:
            Created file metadata
        """
        try:
            to_insert = {
                "session_id": session_id,
                "file_name": file_info["file_name"],
                "file_type": file_info.get("file_type", "text/plain"),
                "file_size": file_info["file_size"],
                "storage_path": file_info.get("storage_path"),
                "row_count": file_info.get("row_count"),
                "column_names": file_info.get("column_names", []),
                "created_at": datetime.utcnow().isoformat()
            }

            response = self.client.table("uploaded_files")\
                .insert(to_insert)\
                .execute()

            logger.info(f"Created file metadata: {file_info['file_name']}")
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to create file metadata: {str(e)}")
            raise

    async def get_file_metadata(
        self,
        session_id: str,
        latest_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get file metadata for a session.

        Args:
            session_id: Session UUID
            latest_only: If True, return only the most recent file

        Returns:
            List of file metadata records
        """
        try:
            query = self.client.table("uploaded_files")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("created_at", desc=True)

            if latest_only:
                query = query.limit(1)

            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get file metadata: {str(e)}")
            raise

    async def get_file_metadata_by_id(self, file_id: str) -> Optional[Dict[str, Any]]:
        """
        Get file metadata by file ID.

        Args:
            file_id: File UUID

        Returns:
            File metadata record or None
        """
        try:
            response = self.client.table("uploaded_files")\
                .select("*")\
                .eq("id", file_id)\
                .execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get file metadata by ID: {str(e)}")
            raise

    async def download_file_to_temp(self, storage_path: str) -> str:
        """
        Download file from Supabase Storage to temporary location.

        Args:
            storage_path: Path in storage bucket (e.g., "session_id/file.csv")

        Returns:
            Local file path
        """
        import tempfile
        import os

        try:
            # Download file from storage
            file_bytes = await self.download_from_storage("data-uploads", storage_path)

            # Create temp file with same extension
            file_ext = os.path.splitext(storage_path)[1]
            temp_fd, temp_path = tempfile.mkstemp(suffix=file_ext)

            # Write content to temp file
            with os.fdopen(temp_fd, 'wb') as f:
                f.write(file_bytes)

            logger.info(f"Downloaded file from storage to {temp_path}")
            return temp_path

        except Exception as e:
            logger.error(f"Failed to download file to temp: {str(e)}")
            raise

    async def apply_derived_variables_to_dataset(
        self,
        dataset_path: str,
        session_id: str,
        python_service_url: str
    ) -> str:
        """
        Apply derived variables to a dataset and return updated dataset path.

        Args:
            dataset_path: Path to dataset file
            session_id: Session UUID
            python_service_url: URL of python service

        Returns:
            Path to dataset with computed variables (same as input if no variables)
        """
        import httpx
        import tempfile
        import os

        try:
            # Get enabled derived variables
            variables = await self.get_derived_variables(session_id)
            enabled_vars = [v for v in variables if v.get("is_enabled", True)]

            if not enabled_vars:
                logger.info(f"No enabled derived variables for session {session_id}")
                return dataset_path

            logger.info(f"Computing {len(enabled_vars)} derived variables")

            # Prepare variable list for python service
            var_list = [
                {
                    "name": v["name"],
                    "formula": v["formula"],
                    "formula_type": v.get("formula_type", "eval")
                }
                for v in enabled_vars
            ]

            # Call python service to compute variables
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{python_service_url}/compute-variables",
                    json={
                        "dataset_reference": dataset_path,
                        "variables": var_list
                    }
                )

                if response.status_code != 200:
                    logger.error(f"Failed to compute variables: {response.text}")
                    return dataset_path  # Return original if computation fails

                result = response.json()

            if result.get("status") == "error":
                logger.error(f"Variable computation error: {result.get('error')}")
                return dataset_path

            # Log any failed variables with details
            failed_vars = result.get("failed_variables", [])
            if failed_vars:
                logger.warning(f"Some variables failed to compute:")
                for failed in failed_vars:
                    logger.warning(f"  ✗ {failed['name']}: {failed['error']}")
                    logger.warning(f"    Formula: {failed['formula']}")

            # Get updated dataset from python service
            updated_data = result.get("updated_dataset")
            if not updated_data:
                logger.warning("No updated dataset returned from python service")
                return dataset_path

            # Save updated dataset to new temp file
            import pandas as pd
            df = pd.DataFrame(updated_data)

            file_ext = os.path.splitext(dataset_path)[1]
            temp_fd, temp_path = tempfile.mkstemp(suffix=file_ext)
            os.close(temp_fd)

            df.to_csv(temp_path, index=False)
            logger.info(f"Saved dataset with derived variables to {temp_path}")

            # Clean up original temp file if it was a temp file
            if "/tmp" in dataset_path or "/var/folders" in dataset_path:
                try:
                    os.remove(dataset_path)
                    logger.info(f"Cleaned up original temp file: {dataset_path}")
                except:
                    pass

            return temp_path

        except Exception as e:
            logger.error(f"Failed to apply derived variables: {str(e)}")
            return dataset_path  # Return original on error

    async def delete_file_metadata(self, file_id: str) -> None:
        """
        Delete file metadata record.

        Args:
            file_id: File UUID
        """
        try:
            self.client.table("uploaded_files")\
                .delete()\
                .eq("id", file_id)\
                .execute()

            logger.info(f"Deleted file metadata: {file_id}")
        except Exception as e:
            logger.error(f"Failed to delete file metadata: {str(e)}")
            raise

    async def upload_to_storage(
        self,
        bucket: str,
        path: str,
        file_data: bytes
    ) -> str:
        """
        Upload file to Supabase Storage.

        Args:
            bucket: Storage bucket name
            path: File path within bucket
            file_data: File content as bytes

        Returns:
            Storage path
        """
        try:
            response = self.client.storage.from_(bucket).upload(
                path,
                file_data,
                {"upsert": "true"}
            )

            logger.info(f"Uploaded file to storage: {path}")
            return path
        except Exception as e:
            logger.error(f"Failed to upload to storage: {str(e)}")
            raise

    async def download_from_storage(self, bucket: str, path: str) -> bytes:
        """
        Download file from Supabase Storage.

        Args:
            bucket: Storage bucket name
            path: File path within bucket

        Returns:
            File content as bytes
        """
        try:
            response = self.client.storage.from_(bucket).download(path)
            logger.info(f"Downloaded file from storage: {path}")
            return response
        except Exception as e:
            logger.error(f"Failed to download from storage: {str(e)}")
            raise

    async def delete_from_storage(self, bucket: str, path: str) -> None:
        """
        Delete file from Supabase Storage.

        Args:
            bucket: Storage bucket name
            path: File path within bucket
        """
        try:
            self.client.storage.from_(bucket).remove([path])
            logger.info(f"Deleted file from storage: {path}")
        except Exception as e:
            logger.error(f"Failed to delete from storage: {str(e)}")
            raise


# Global database service instance
database_service = DatabaseService()
