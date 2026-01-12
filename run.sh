#!/bin/bash

# Configuration
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   CarNote One-Click Start Script (Linux/WSL) ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Function to handle shutdown
cleanup() {
    echo -e "\n${RED}Shutting down services...${NC}"
    # Kill all child processes
    pkill -P $$
    # Double check specific PIDs if needed, but pkill -P $$ is usually effective for background jobs
    exit 0
}

# Trap signals (Ctrl+C)
trap cleanup SIGINT SIGTERM

# 1. Build Frontend
echo -e "\n${BLUE}[1/2] Building Frontend...${NC}"
cd frontend || { echo -e "${RED}Frontend directory not found!${NC}"; exit 1; }

if [ ! -d "node_modules" ]; then
    echo -e "Installing frontend dependencies..."
    npm install
fi

echo -e "Building frontend..."
npm run build
cd ..

# 2. Start Backend (which serves Frontend)
echo -e "\n${BLUE}[2/2] Starting Unified Server...${NC}"
cd backend || { echo -e "${RED}Backend directory not found!${NC}"; exit 1; }

if [ ! -d "node_modules" ]; then
    echo -e "Installing backend dependencies..."
    npm install
fi

# Start backend
node server.js &
BACKEND_PID=$!
echo -e "${GREEN}Server started (PID: $BACKEND_PID)${NC}"

cd ..

echo -e "\n${GREEN}==============================================${NC}"
echo -e "${GREEN}   Application is RUNNING                     ${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "Access URL: ${BLUE}http://localhost:53300${NC}"
echo -e "Press ${RED}Ctrl+C${NC} to stop service.\n"

# Verify processes started
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Server failed to start! Check console output.${NC}"
fi

# Wait for user to stop
wait
