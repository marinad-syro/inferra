#!/bin/bash
# View logs from backend services

# Default to all services
SERVICE=${1:-}

if [ -z "$SERVICE" ]; then
    echo "📋 Viewing logs for all services..."
    docker-compose logs -f
else
    echo "📋 Viewing logs for $SERVICE..."
    docker-compose logs -f "$SERVICE"
fi
