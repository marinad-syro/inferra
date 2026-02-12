#!/bin/bash

# Inferra Backend Services Startup Script
# Starts API Gateway, Python Service, and R Service

set -e

echo "=========================================="
echo "Starting Inferra Backend Services"
echo "=========================================="
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to check if port is available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "⚠️  Port $1 is already in use. Please stop the existing process first."
        return 1
    fi
    return 0
}

# Check if ports are available
echo "Checking ports..."
check_port 8000 || exit 1
check_port 8001 || exit 1
check_port 8002 || exit 1
echo "✓ All ports available"
echo ""

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found in backend/"
    echo "Services may fail without proper environment variables"
    echo ""
fi

# Start API Gateway (Port 8000)
echo "Starting API Gateway on port 8000..."
cd api
if [ ! -d "venv" ]; then
    echo "Creating virtual environment for API..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../logs/api.log 2>&1 &
API_PID=$!
deactivate
cd ..
echo "✓ API Gateway started (PID: $API_PID)"

# Start Python Service (Port 8001)
echo "Starting Python Service on port 8001..."
cd python-service
if [ ! -d "venv" ]; then
    echo "Creating virtual environment for Python Service..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.analyze:app --host 0.0.0.0 --port 8001 > ../logs/python-service.log 2>&1 &
PYTHON_PID=$!
deactivate
cd ..
echo "✓ Python Service started (PID: $PYTHON_PID)"

# Start R Service (Port 8002)
echo "Starting R Service on port 8002..."
cd r-service
R -e "pr <- plumber::plumb('app/main.R'); pr\$run(host='0.0.0.0', port=8002)" > ../logs/r-service.log 2>&1 &
R_PID=$!
cd ..
echo "✓ R Service started (PID: $R_PID)"

echo ""
echo "=========================================="
echo "All services started successfully!"
echo "=========================================="
echo ""
echo "Services:"
echo "  📡 API Gateway:     http://localhost:8000"
echo "  🐍 Python Service:  http://localhost:8001"
echo "  📊 R Service:       http://localhost:8002"
echo ""
echo "Logs:"
echo "  tail -f logs/api.log"
echo "  tail -f logs/python-service.log"
echo "  tail -f logs/r-service.log"
echo ""
echo "To stop all services:"
echo "  kill $API_PID $PYTHON_PID $R_PID"
echo ""
echo "Or use: ./stop-services.sh"
echo ""

# Save PIDs to file for easy stopping
mkdir -p logs
echo "$API_PID" > logs/api.pid
echo "$PYTHON_PID" > logs/python-service.pid
echo "$R_PID" > logs/r-service.pid

# Keep script running
echo "Press Ctrl+C to stop all services..."
trap "echo ''; echo 'Stopping services...'; kill $API_PID $PYTHON_PID $R_PID 2>/dev/null; rm -f logs/*.pid; echo 'All services stopped.'; exit" INT TERM

wait
