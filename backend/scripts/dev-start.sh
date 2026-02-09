#!/bin/bash
# Start backend services for development

set -e

echo "🚀 Starting Inferra Backend Services..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your credentials before continuing."
    exit 1
fi

# Start services with docker-compose
echo "📦 Starting Docker services..."
docker-compose up --build

echo "✅ Services started!"
echo "📝 API Gateway: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
