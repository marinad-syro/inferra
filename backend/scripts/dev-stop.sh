#!/bin/bash
# Stop backend services

set -e

echo "🛑 Stopping Inferra Backend Services..."

docker-compose down

echo "✅ Services stopped!"
