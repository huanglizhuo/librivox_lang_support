#!/bin/bash

# LibriVox Monitoring Script
# Shows real-time status of the application

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║          LibriVox Language Support - Monitor               ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    # Services Status
    echo -e "${BLUE}■ Services Status${NC}"
    docker-compose ps
    echo ""

    # Database Statistics
    echo -e "${BLUE}■ Database Statistics${NC}"
    TOTAL_BOOKS=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" 2>/dev/null | xargs || echo "N/A")
    TOTAL_SECTIONS=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM sections;" 2>/dev/null | xargs || echo "N/A")
    TOTAL_AUTHORS=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM authors;" 2>/dev/null | xargs || echo "N/A")

    echo "  Total Audiobooks: $TOTAL_BOOKS"
    echo "  Total Sections:   $TOTAL_SECTIONS"
    echo "  Total Authors:    $TOTAL_AUTHORS"
    echo ""

    # Top 5 Languages
    echo -e "${BLUE}■ Top 5 Languages${NC}"
    docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT language, COUNT(*) as count FROM audiobooks GROUP BY language ORDER BY count DESC LIMIT 5;" 2>/dev/null | head -5
    echo ""

    # Last Sync Status
    echo -e "${BLUE}■ Last Sync Status${NC}"
    docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT sync_type, status, completed_at, synced_books FROM sync_status ORDER BY started_at DESC LIMIT 3;" 2>/dev/null | head -3
    echo ""

    # API Health
    echo -e "${BLUE}■ API Health${NC}"
    HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "  Status: ${GREEN}✓ Healthy${NC}"
        echo "  $HEALTH" | jq -r '.lastSync | "  Last Sync: \(.type) at \(.completedAt // "N/A")"' 2>/dev/null || echo "  Response: OK"
    else
        echo -e "  Status: ${RED}✗ Unhealthy${NC}"
    fi
    echo ""

    # Recent Errors (last 5)
    echo -e "${BLUE}■ Recent Errors (last 5)${NC}"
    if [ -f logs/error.log ]; then
        tail -5 logs/error.log 2>/dev/null || echo "  No errors"
    else
        echo "  No error log found"
    fi
    echo ""

    # Disk Usage
    echo -e "${BLUE}■ Disk Usage${NC}"
    DB_SIZE=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT pg_size_pretty(pg_database_size('librivox'));" 2>/dev/null | xargs || echo "N/A")
    echo "  Database Size: $DB_SIZE"
    echo ""

    echo -e "${YELLOW}Refreshing every 10 seconds... (Press Ctrl+C to exit)${NC}"
    sleep 10
done
