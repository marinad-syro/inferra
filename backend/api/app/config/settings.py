"""Application configuration using pydantic-settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file="../.env",  # Look in parent directory (backend/)
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Supabase Configuration
    supabase_url: str = Field(..., description="Supabase project URL")
    supabase_anon_key: str = Field(..., description="Supabase anonymous key")
    supabase_service_role_key: str = Field(..., description="Supabase service role key for backend operations")

    # XAI SDK Configuration
    xai_api_key: str = Field(..., description="XAI/Grok API key")
    xai_model: str = Field(default="grok-3", description="Default XAI model to use")
    xai_reasoning_model: str = Field(default="grok-3-mini", description="Reasoning model for complex decisions")
    xai_fast_model: str = Field(default="grok-4-fast", description="Fast model for file-based queries")

    # Internal Services
    python_service_url: str = Field(
        default="http://python-service:8001",
        description="Python analysis service URL"
    )

    # Frontend Configuration
    frontend_origin: str = Field(
        default="http://localhost:5173",
        description="Frontend origin for CORS"
    )

    # Application Settings
    log_level: str = Field(default="INFO", description="Logging level")

    # API Configuration
    api_title: str = Field(default="Inferra Backend API", description="API title")
    api_version: str = Field(default="1.0.0", description="API version")
    api_description: str = Field(
        default="FastAPI backend for Inferra statistical analysis platform",
        description="API description"
    )


# Global settings instance
settings = Settings()
