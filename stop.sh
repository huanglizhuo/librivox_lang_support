#!/bin/bash

# Stop all services gracefully

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO]${NC} Stopping LibriVox services..."
docker-compose down

echo -e "${GREEN}[SUCCESS]${NC} All services stopped"
echo ""
echo "To start again: ./deploy.sh"
echo "To start without full sync: docker-compose up -d"
