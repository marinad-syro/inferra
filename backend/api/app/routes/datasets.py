"""Dataset upload endpoint for LLM file-based queries."""

import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status

logger = logging.getLogger(__name__)

router = APIRouter()

# Dataset storage directory
DATASET_DIR = Path("/tmp/inferra/datasets")
DATASET_DIR.mkdir(parents=True, exist_ok=True)

# Maximum file size (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post(
    "/upload-dataset",
    status_code=status.HTTP_200_OK,
    summary="Upload dataset for LLM analysis",
    description="Upload a CSV/JSON dataset file for use in LLM prompts with file context"
)
async def upload_dataset(file: UploadFile = File(...)):
    """
    Upload a dataset file for LLM file-based queries.

    The uploaded file is stored temporarily and can be referenced in
    subsequent LLM API calls via the dataset_reference parameter.

    Args:
        file: CSV or JSON file to upload

    Returns:
        dict: File path and metadata

    Raises:
        HTTPException: If file is too large or upload fails
    """
    try:
        # Validate file extension
        if file.filename:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ['.csv', '.json', '.tsv']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error_code": "INVALID_FILE_TYPE",
                        "message": "Only CSV, TSV, and JSON files are supported",
                        "details": {"filename": file.filename}
                    }
                )

        # Read file content and check size
        content = await file.read()
        file_size = len(content)

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "error_code": "FILE_TOO_LARGE",
                    "message": f"File size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit",
                    "details": {"size_bytes": file_size}
                }
            )

        # Generate unique filename
        file_id = str(uuid.uuid4())
        original_ext = os.path.splitext(file.filename or "data.csv")[1]
        filename = f"{file_id}{original_ext}"
        file_path = DATASET_DIR / filename

        # Save file
        with open(file_path, "wb") as f:
            f.write(content)

        logger.info(
            f"Dataset uploaded: {filename} ({file_size} bytes) from {file.filename}"
        )

        return {
            "file_path": str(file_path),
            "file_id": file_id,
            "filename": file.filename,
            "size_bytes": file_size,
            "uploaded_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dataset upload failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "UPLOAD_FAILED",
                "message": "Failed to upload dataset",
                "details": {"error": str(e)}
            }
        )


@router.delete(
    "/datasets/{file_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete uploaded dataset",
    description="Delete a previously uploaded dataset file"
)
async def delete_dataset(file_id: str):
    """
    Delete an uploaded dataset file.

    Args:
        file_id: File ID from upload response

    Returns:
        dict: Deletion confirmation

    Raises:
        HTTPException: If file not found or deletion fails
    """
    try:
        # Find file with matching ID
        files = list(DATASET_DIR.glob(f"{file_id}.*"))

        if not files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "FILE_NOT_FOUND",
                    "message": "Dataset file not found",
                    "details": {"file_id": file_id}
                }
            )

        # Delete file
        file_path = files[0]
        file_path.unlink()

        logger.info(f"Dataset deleted: {file_path.name}")

        return {
            "file_id": file_id,
            "deleted": True,
            "deleted_at": datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dataset deletion failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "DELETION_FAILED",
                "message": "Failed to delete dataset",
                "details": {"error": str(e)}
            }
        )


async def cleanup_old_datasets(max_age_hours: int = 1):
    """
    Clean up dataset files older than max_age_hours.

    This should be called periodically (e.g., via background task or cron).

    Args:
        max_age_hours: Maximum age of files in hours
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        deleted_count = 0

        for file_path in DATASET_DIR.glob("*"):
            if file_path.is_file():
                # Get file modification time
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)

                if mtime < cutoff_time:
                    file_path.unlink()
                    deleted_count += 1
                    logger.debug(f"Cleaned up old dataset: {file_path.name}")

        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old dataset files")

    except Exception as e:
        logger.error(f"Dataset cleanup failed: {str(e)}", exc_info=True)


@router.get(
    "/datasets/cleanup",
    status_code=status.HTTP_200_OK,
    summary="Trigger dataset cleanup",
    description="Manually trigger cleanup of old dataset files"
)
async def trigger_cleanup(max_age_hours: Optional[int] = 1):
    """
    Manually trigger cleanup of old dataset files.

    Args:
        max_age_hours: Maximum age of files to keep (default: 1 hour)

    Returns:
        dict: Cleanup confirmation
    """
    await cleanup_old_datasets(max_age_hours)
    return {
        "cleanup_triggered": True,
        "max_age_hours": max_age_hours,
        "triggered_at": datetime.utcnow().isoformat()
    }
