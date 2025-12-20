#!/bin/bash

# LibriVox Language Support - Production Deployment Script
# This script deploys the entire application including:
# - PostgreSQL database setup
# - Database migrations
# - Initial full sync
# - API server with daily cron sync

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FULL_SYNC_LIMIT=${FULL_SYNC_LIMIT:-0}  # 0 = unlimited, set to limit for testing

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Pre-deployment checks
log_info "Step 1/8: Running pre-deployment checks..."

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

if [ ! -f .env ]; then
    log_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    log_warning "Please edit .env and set DB_PASSWORD before continuing!"
    read -p "Press Enter after you've updated .env file..."
fi

log_success "Pre-deployment checks passed"

# Step 2: Install dependencies
log_info "Step 2/8: Installing Node.js dependencies..."
npm install
log_success "Dependencies installed"

# Step 3: Build TypeScript
log_info "Step 3/8: Building TypeScript application..."
npm run build
log_success "Application built successfully"

# Step 4: Stop existing containers (if any)
log_info "Step 4/8: Stopping existing containers..."
docker-compose down || true
log_success "Containers stopped"

# Step 5: Start PostgreSQL and wait for it to be ready
log_info "Step 5/8: Starting PostgreSQL database..."
docker-compose up -d postgres

log_info "Waiting for PostgreSQL to be ready..."
sleep 5

# Wait for PostgreSQL to be healthy
MAX_WAIT=30
WAIT_COUNT=0
until docker-compose exec -T postgres pg_isready -U librivox_user -d librivox &> /dev/null; do
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log_error "PostgreSQL did not become ready in time"
        docker-compose logs postgres
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
log_success "PostgreSQL is ready"

# Step 6: Apply database migrations
log_info "Step 6/8: Applying database migrations..."

# Check if tables already exist
TABLE_COUNT=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)

if [ "$TABLE_COUNT" -eq "0" ]; then
    log_info "Applying initial schema migration..."
    docker-compose exec -T postgres psql -U librivox_user -d librivox < src/db/migrations/001_initial_schema.sql
    log_success "Initial schema created"
else
    log_info "Tables already exist, checking for additional migrations..."

    # Apply migration 002 if needed (check if audiobooks.title is TEXT)
    TITLE_TYPE=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT data_type FROM information_schema.columns WHERE table_name = 'audiobooks' AND column_name = 'title';" | xargs)
    if [ "$TITLE_TYPE" = "character varying" ]; then
        log_info "Applying migration 002 (VARCHAR to TEXT)..."
        docker-compose exec -T postgres psql -U librivox_user -d librivox < src/db/migrations/002_change_to_text.sql || true
    fi

    # Apply migration 003 if needed (check if audiobooks.language is TEXT)
    LANGUAGE_TYPE=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT data_type FROM information_schema.columns WHERE table_name = 'audiobooks' AND column_name = 'language';" | xargs)
    if [ "$LANGUAGE_TYPE" = "character varying" ]; then
        log_info "Applying migration 003 (all VARCHAR to TEXT)..."
        docker-compose exec -T postgres psql -U librivox_user -d librivox < src/db/migrations/003_all_to_text.sql || true
    fi
fi

# Verify database schema
log_info "Verifying database schema..."
docker-compose exec -T postgres psql -U librivox_user -d librivox -c "\dt" > /dev/null
log_success "Database migrations completed"

# Step 7: Run full sync (if database is empty or forced)
log_info "Step 7/8: Checking if initial sync is needed..."

BOOK_COUNT=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" | xargs)

if [ "$BOOK_COUNT" -eq "0" ] || [ "$FORCE_FULL_SYNC" = "true" ]; then
    log_info "Running initial full sync..."
    log_warning "This may take several hours depending on the number of books."
    log_info "You can monitor progress in logs/combined.log"

    if [ "$FULL_SYNC_LIMIT" -gt "0" ]; then
        log_warning "TESTING MODE: Will sync only first $FULL_SYNC_LIMIT books"
    fi

    # Run sync in background and show progress
    node dist/scripts/run-sync.js --type=full &
    SYNC_PID=$!

    log_info "Sync running in background (PID: $SYNC_PID)"
    log_info "Monitoring progress (Ctrl+C to stop monitoring, sync will continue)..."

    # Monitor progress
    while kill -0 $SYNC_PID 2> /dev/null; do
        sleep 10
        CURRENT_COUNT=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" | xargs)
        SYNC_STATUS=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT status FROM sync_status WHERE sync_type = 'full' ORDER BY started_at DESC LIMIT 1;" | xargs)
        echo -ne "\rBooks synced: $CURRENT_COUNT (Status: $SYNC_STATUS)    "
    done
    echo ""

    # Check if sync completed successfully
    wait $SYNC_PID
    SYNC_EXIT_CODE=$?

    if [ $SYNC_EXIT_CODE -eq 0 ]; then
        FINAL_COUNT=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" | xargs)
        log_success "Initial sync completed! Total books: $FINAL_COUNT"
    else
        log_error "Initial sync failed with exit code $SYNC_EXIT_CODE"
        log_error "Check logs/error.log for details"
        exit 1
    fi
else
    log_info "Database already contains $BOOK_COUNT books, skipping initial sync"
    log_info "To force a new sync, run: FORCE_FULL_SYNC=true ./deploy.sh"
fi

# Step 8: Start API server with cron
log_info "Step 8/8: Starting API server..."
docker-compose up -d api

log_info "Waiting for API server to be ready..."
sleep 5

# Health check
MAX_WAIT=30
WAIT_COUNT=0
until curl -s http://localhost:3000/health > /dev/null 2>&1; do
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log_error "API server did not become ready in time"
        docker-compose logs api
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""

log_success "API server is ready!"

# Final status check
log_info "Performing final health check..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
echo "$HEALTH_RESPONSE" | jq '.' || echo "$HEALTH_RESPONSE"

# Display deployment summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log_success "API Server: http://localhost:3000"
log_success "Health Check: http://localhost:3000/health"
log_success "Audiobooks API: http://localhost:3000/audiobooks?language=English&page=1&limit=10"
echo ""
log_info "Services Status:"
docker-compose ps
echo ""
log_info "Database Statistics:"
docker-compose exec -T postgres psql -U librivox_user -d librivox -c "SELECT language, COUNT(*) as count FROM audiobooks GROUP BY language ORDER BY count DESC LIMIT 10;"
echo ""
log_info "Cron Job Status:"
log_success "Daily incremental sync enabled (runs at 2 AM UTC)"
echo ""
log_info "Useful Commands:"
echo "  - View logs:              docker-compose logs -f api"
echo "  - Stop services:          docker-compose down"
echo "  - Restart services:       docker-compose restart"
echo "  - Manual full sync:       node dist/scripts/run-sync.js --type=full"
echo "  - Manual incremental:     node dist/scripts/run-sync.js --type=incremental"
echo "  - Database backup:        ./backup.sh"
echo ""
log_success "Deployment complete! 🚀"
