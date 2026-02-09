"""Main FastAPI application for Inferra Backend API Gateway."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import settings
from app.routes import health, decide, llm_proxy, run, datasets, sessions, selections, variables, trials, wrangling, files, compute, visualizations, code_canvas

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Inferra Backend API Gateway")
    logger.info(f"API Version: {settings.api_version}")
    logger.info(f"Python Service URL: {settings.python_service_url}")
    logger.info(f"R Service URL: {settings.r_service_url}")
    logger.info(f"Frontend Origin: {settings.frontend_origin}")

    # Startup logic
    yield

    # Shutdown logic
    logger.info("Shutting down Inferra Backend API Gateway")


# Create FastAPI application
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS - must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:8080", "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all uncaught exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_ERROR",
            "message": "An internal error occurred",
            "details": {"error": str(exc)} if settings.log_level == "DEBUG" else None
        }
    )


# Register routes
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(decide.router, prefix="/api", tags=["Decision"])
app.include_router(llm_proxy.router, prefix="/api", tags=["LLM"])
app.include_router(run.router, prefix="/api", tags=["Analysis"])
app.include_router(datasets.router, prefix="/api", tags=["Datasets"])

# Workflow database routes
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])
app.include_router(selections.router, prefix="/api", tags=["Selections"])
app.include_router(variables.router, prefix="/api", tags=["Variables"])
app.include_router(trials.router, prefix="/api", tags=["Trials"])
app.include_router(wrangling.router, prefix="/api", tags=["Wrangling"])
app.include_router(files.router, prefix="/api", tags=["Files"])
app.include_router(compute.router, prefix="/api", tags=["Compute"])
app.include_router(visualizations.router, prefix="/api", tags=["Visualizations"])
app.include_router(code_canvas.router, prefix="/api", tags=["Code Canvas"])


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API information."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "description": settings.api_description,
        "docs": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
