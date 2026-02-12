"""
File upload and management endpoints.

Handles file uploads, storage, parsing, and retrieval.
"""

import logging
import io
import json
import csv
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.models.schemas import (
    FileMetadataResponse,
    ParsedFileData,
    FileUploadResponse,
    ErrorResponse
)
from app.services.database import database_service
from app.services.dataset_versions import dataset_version_service

logger = logging.getLogger(__name__)

router = APIRouter()


def parse_csv_content(content: str) -> ParsedFileData:
    """Parse CSV file content."""
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    columns = list(rows[0].keys()) if rows else []

    # Convert numeric values
    parsed_rows = []
    for row in rows:
        parsed_row = {}
        for key, value in row.items():
            # Try to convert to number
            try:
                parsed_row[key] = float(value)
            except (ValueError, TypeError):
                parsed_row[key] = value
        parsed_rows.append(parsed_row)

    return ParsedFileData(
        columns=columns,
        rows=parsed_rows,
        rowCount=len(parsed_rows)
    )


def parse_tsv_content(content: str) -> ParsedFileData:
    """Parse TSV file content."""
    reader = csv.DictReader(io.StringIO(content), delimiter='\t')
    rows = list(reader)
    columns = list(rows[0].keys()) if rows else []

    # Convert numeric values
    parsed_rows = []
    for row in rows:
        parsed_row = {}
        for key, value in row.items():
            # Try to convert to number
            try:
                parsed_row[key] = float(value)
            except (ValueError, TypeError):
                parsed_row[key] = value
        parsed_rows.append(parsed_row)

    return ParsedFileData(
        columns=columns,
        rows=parsed_rows,
        rowCount=len(parsed_rows)
    )


def parse_json_content(content: str) -> ParsedFileData:
    """Parse JSON file content."""
    data = json.loads(content)
    rows = data if isinstance(data, list) else [data]
    columns = list(rows[0].keys()) if rows else []

    return ParsedFileData(
        columns=columns,
        rows=rows,
        rowCount=len(rows)
    )


@router.post("/files/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(session_id: str, file: UploadFile = File(...)):
    """
    Upload a single file.

    Uploads file to Supabase Storage, parses content, and creates metadata record.
    Supports CSV, TSV, and JSON formats.
    """
    try:
        # Read file content
        content_bytes = await file.read()
        content = content_bytes.decode('utf-8')

        # Parse based on file type
        filename_lower = file.filename.lower() if file.filename else ""

        if filename_lower.endswith('.csv'):
            parsed_data = parse_csv_content(content)
        elif filename_lower.endswith('.tsv'):
            parsed_data = parse_tsv_content(content)
        elif filename_lower.endswith('.json'):
            parsed_data = parse_json_content(content)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "UNSUPPORTED_FORMAT",
                    "message": "Unsupported file format. Please upload CSV, TSV, or JSON."
                }
            )

        # Upload to storage
        storage_path = f"{session_id}/{file.filename}"
        await database_service.upload_to_storage(
            "data-uploads",
            storage_path,
            content_bytes
        )

        # Create metadata record
        file_metadata = await database_service.create_file_metadata(
            session_id,
            {
                "file_name": file.filename,
                "file_type": file.content_type or "text/plain",
                "file_size": len(content_bytes),
                "storage_path": storage_path,
                "row_count": parsed_data.rowCount,
                "column_names": parsed_data.columns
            }
        )

        # Create Version 0 (initial upload)
        # Save dataset to local file
        import tempfile
        import shutil
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv')
        temp_path = temp_file.name

        # Write CSV data
        writer = csv.DictWriter(temp_file, fieldnames=parsed_data.columns)
        writer.writeheader()
        writer.writerows(parsed_data.rows)
        temp_file.close()

        version_0 = await dataset_version_service.create_version(
            session_id=session_id,
            dataset_path=temp_path,
            row_count=parsed_data.rowCount,
            column_names=parsed_data.columns,
            source='upload',
            description=f"Initial upload: {file.filename}",
            operation_metadata={
                "filename": file.filename,
                "file_size": len(content_bytes),
                "file_type": file.content_type or "text/plain"
            }
        )

        logger.info(f"Created Version 0 for session {session_id}: {version_0['id']}")

        return FileUploadResponse(
            file=file_metadata,
            parsed_data=parsed_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "FILE_UPLOAD_FAILED", "message": str(e)}
        )


@router.post("/files/upload-multiple", response_model=List[FileUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_multiple_files(session_id: str, files: List[UploadFile] = File(...)):
    """
    Upload multiple files.

    Uploads multiple files to Supabase Storage and creates metadata records.
    """
    try:
        results = []
        for file in files:
            # Read file content
            content_bytes = await file.read()
            content = content_bytes.decode('utf-8')

            # Parse based on file type
            filename_lower = file.filename.lower() if file.filename else ""

            if filename_lower.endswith('.csv'):
                parsed_data = parse_csv_content(content)
            elif filename_lower.endswith('.tsv'):
                parsed_data = parse_tsv_content(content)
            elif filename_lower.endswith('.json'):
                parsed_data = parse_json_content(content)
            else:
                continue  # Skip unsupported files

            # Upload to storage with timestamp to avoid conflicts
            import time
            storage_path = f"{session_id}/{int(time.time() * 1000)}_{file.filename}"
            await database_service.upload_to_storage(
                "data-uploads",
                storage_path,
                content_bytes
            )

            # Create metadata record
            file_metadata = await database_service.create_file_metadata(
                session_id,
                {
                    "file_name": file.filename,
                    "file_type": file.content_type or "text/plain",
                    "file_size": len(content_bytes),
                    "storage_path": storage_path,
                    "row_count": parsed_data.rowCount,
                    "column_names": parsed_data.columns
                }
            )

            results.append(FileUploadResponse(
                file=file_metadata,
                parsed_data=parsed_data
            ))

        return results

    except Exception as e:
        logger.error(f"Failed to upload files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "FILES_UPLOAD_FAILED", "message": str(e)}
        )


@router.get("/files/{session_id}", response_model=List[FileMetadataResponse])
async def get_files(session_id: str, latest: bool = False):
    """
    Get all files for a session.

    Returns metadata for all uploaded files. Use latest=true to get only
    the most recent file.
    """
    try:
        files = await database_service.get_file_metadata(session_id, latest_only=latest)
        return files
    except Exception as e:
        logger.error(f"Failed to get files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "FILES_GET_FAILED", "message": str(e)}
        )


@router.get("/files/{session_id}/latest", response_model=FileMetadataResponse)
async def get_latest_file(session_id: str):
    """
    Get the most recent file for a session.

    Returns metadata for the most recently uploaded file.
    """
    try:
        files = await database_service.get_file_metadata(session_id, latest_only=True)
        if not files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "FILE_NOT_FOUND", "message": "No files found for this session"}
            )
        return files[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get latest file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "FILE_GET_FAILED", "message": str(e)}
        )


@router.get("/files/data/{file_id}", response_model=ParsedFileData)
async def get_file_data(file_id: str):
    """
    Get parsed file data.

    Downloads and parses the file from storage, returning the parsed data.
    """
    try:
        # Get file metadata to get storage path
        file_metadata = await database_service.get_file_metadata_by_id(file_id)
        if not file_metadata:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "FILE_NOT_FOUND", "message": f"File {file_id} not found"}
            )

        storage_path = file_metadata.get("storage_path")
        if not storage_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "STORAGE_PATH_MISSING", "message": "File has no storage path"}
            )

        # Download file from storage
        file_bytes = await database_service.download_from_storage("data-uploads", storage_path)
        content = file_bytes.decode('utf-8')

        # Parse based on file type
        filename_lower = file_metadata.get("file_name", "").lower()

        if filename_lower.endswith('.csv'):
            parsed_data = parse_csv_content(content)
        elif filename_lower.endswith('.tsv'):
            parsed_data = parse_tsv_content(content)
        elif filename_lower.endswith('.json'):
            parsed_data = parse_json_content(content)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error_code": "UNSUPPORTED_FORMAT",
                    "message": "Unsupported file format. File must be CSV, TSV, or JSON."
                }
            )

        return parsed_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get file data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "FILE_DATA_GET_FAILED", "message": str(e)}
        )


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(file_id: str):
    """
    Delete a file.

    Deletes file from storage and removes metadata record.
    """
    try:
        # Would need to fetch metadata first to get storage path
        # Then delete from storage and database
        # For now, just delete metadata
        await database_service.delete_file_metadata(file_id)
        return None
    except Exception as e:
        logger.error(f"Failed to delete file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error_code": "FILE_DELETE_FAILED", "message": str(e)}
        )
