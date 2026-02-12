"""
Dataset Version Service

Manages dataset versions as data flows through the workflow.
Every operation (upload, cleaning, transforms, code execution) creates a new version.
"""

import logging
import os
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from app.services.database import database_service

logger = logging.getLogger(__name__)


class DatasetVersionService:
    """Manage dataset versions and lineage."""

    def __init__(self):
        self.storage_dir = Path("/tmp/inferra/datasets")
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    async def create_version(
        self,
        session_id: str,
        dataset_path: str,
        row_count: int,
        column_names: List[str],
        source: str,
        description: str,
        code_snapshot: Optional[str] = None,
        operation_metadata: Optional[Dict] = None,
        parent_version_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new dataset version.

        Args:
            session_id: Session UUID
            dataset_path: Path to dataset file (already saved)
            row_count: Number of rows in dataset
            column_names: List of column names
            source: Source of this version ('upload', 'ui_cleaning', 'code_canvas', etc.)
            description: Human-readable description
            code_snapshot: Code that generated this version (if from code canvas)
            operation_metadata: Additional metadata about the operation
            parent_version_id: ID of parent version (None for initial upload)

        Returns:
            Created version record
        """
        try:
            # Get next version number
            versions = await self.list_versions(session_id)
            version_number = len(versions)

            logger.info(f"Creating dataset version {version_number} from {dataset_path}")

            # Create version record
            version_data = {
                "session_id": session_id,
                "version_number": version_number,
                "parent_version_id": parent_version_id,
                "source": source,
                "description": description,
                "dataset_reference": dataset_path,
                "row_count": row_count,
                "column_count": len(column_names),
                "column_names": column_names,
                "code_snapshot": code_snapshot,
                "operation_metadata": operation_metadata or {}
            }

            response = database_service.client.table("dataset_versions")\
                .insert(version_data)\
                .execute()

            if not response.data:
                raise ValueError("Failed to create version record")

            version = response.data[0]
            logger.info(f"Created dataset version {version_number} (id={version['id']})")

            # Update session's current version pointer
            await self._update_session_current_version(session_id, version['id'])

            return version

        except Exception as e:
            logger.error(f"Failed to create dataset version: {e}", exc_info=True)
            raise

    async def get_current_version(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current dataset version for a session.

        Args:
            session_id: Session UUID

        Returns:
            Current version record or None
        """
        try:
            # Get session to find current version ID
            session = await database_service.get_session(session_id)
            if not session:
                return None

            current_version_id = session.get('current_dataset_version_id')
            if not current_version_id:
                return None

            # Get version record
            response = database_service.client.table("dataset_versions")\
                .select("*")\
                .eq("id", current_version_id)\
                .execute()

            if response.data:
                return response.data[0]
            return None

        except Exception as e:
            logger.error(f"Failed to get current version: {e}")
            return None

    async def get_dataset_path(self, version_id: str) -> Optional[str]:
        """
        Get dataset path for a specific version.

        Args:
            version_id: Version UUID

        Returns:
            Path to dataset file or None if not found
        """
        try:
            response = database_service.client.table("dataset_versions")\
                .select("dataset_reference")\
                .eq("id", version_id)\
                .execute()

            if response.data:
                return response.data[0]['dataset_reference']
            return None

        except Exception as e:
            logger.error(f"Failed to get dataset path: {e}")
            return None

    async def list_versions(self, session_id: str) -> List[Dict[str, Any]]:
        """
        List all versions for a session in chronological order.

        Args:
            session_id: Session UUID

        Returns:
            List of version records
        """
        try:
            response = database_service.client.table("dataset_versions")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("version_number")\
                .execute()

            return response.data or []

        except Exception as e:
            logger.error(f"Failed to list versions: {e}")
            return []

    async def restore_version(self, session_id: str, version_id: str) -> Dict[str, Any]:
        """
        Restore to a previous dataset version.

        Args:
            session_id: Session UUID
            version_id: Version UUID to restore to

        Returns:
            Restored version record
        """
        try:
            # Verify version belongs to session
            response = database_service.client.table("dataset_versions")\
                .select("*")\
                .eq("id", version_id)\
                .eq("session_id", session_id)\
                .execute()

            if not response.data:
                raise ValueError(f"Version {version_id} not found for session {session_id}")

            version = response.data[0]

            # Update session's current version pointer
            await self._update_session_current_version(session_id, version_id)

            logger.info(f"Restored session {session_id} to version {version['version_number']}")
            return version

        except Exception as e:
            logger.error(f"Failed to restore version: {e}", exc_info=True)
            raise

    async def _update_session_current_version(self, session_id: str, version_id: str):
        """Update session's current_dataset_version_id pointer."""
        try:
            database_service.client.table("workflow_sessions")\
                .update({"current_dataset_version_id": version_id})\
                .eq("id", session_id)\
                .execute()

            logger.info(f"Updated session {session_id} current version to {version_id}")

        except Exception as e:
            logger.error(f"Failed to update session current version: {e}")
            raise


# Singleton instance
dataset_version_service = DatasetVersionService()
