#!/bin/bash

# Stop all Inferra backend services

echo "Stopping Inferra Backend Services..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if PID files exist
if [ -f "logs/api.pid" ] && [ -f "logs/python-service.pid" ] && [ -f "logs/r-service.pid" ]; then
    API_PID=$(cat logs/api.pid)
    PYTHON_PID=$(cat logs/python-service.pid)
    R_PID=$(cat logs/r-service.pid)

    echo "Stopping API Gateway (PID: $API_PID)..."
    kill $API_PID 2>/dev/null || echo "  Already stopped"

    echo "Stopping Python Service (PID: $PYTHON_PID)..."
    kill $PYTHON_PID 2>/dev/null || echo "  Already stopped"

    echo "Stopping R Service (PID: $R_PID)..."
    kill $R_PID 2>/dev/null || echo "  Already stopped"

    # Remove PID files
    rm -f logs/*.pid

    echo "✓ All services stopped"
else
    echo "No running services found (PID files not found)"
    echo "Checking for processes on ports 8000, 8001, 8002..."

    # Try to kill processes on the ports
    lsof -ti:8000 | xargs kill 2>/dev/null && echo "  Stopped process on port 8000" || true
    lsof -ti:8001 | xargs kill 2>/dev/null && echo "  Stopped process on port 8001" || true
    lsof -ti:8002 | xargs kill 2>/dev/null && echo "  Stopped process on port 8002" || true
fi
