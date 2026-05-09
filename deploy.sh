#!/bin/bash
set -e

FULL_SYNC_LIMIT=${FULL_SYNC_LIMIT:-0}

if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed." && exit 1
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example — set DB_PASSWORD then re-run."
    exit 1
fi

echo "Stopping existing containers..."
docker compose down

echo "Starting PostgreSQL..."
docker compose up -d --build postgres

echo -n "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U librivox_user -d librivox &>/dev/null; do
    echo -n "."; sleep 1
done
echo " ready"

echo "Applying migrations..."
for migration in src/db/migrations/*.sql; do
    echo "  $migration"
    docker compose exec -T postgres psql -U librivox_user -d librivox < "$migration" 2>/dev/null || true
done

BOOK_COUNT=$(docker compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" | xargs)

if [ "$BOOK_COUNT" -eq "0" ] || [ "$FORCE_FULL_SYNC" = "true" ]; then
    echo "Running initial full sync (this may take several hours)..."
    docker rm -f librivox_initial_sync 2>/dev/null || true
    SYNC_ID=$(docker compose run -d --name librivox_initial_sync api node dist/scripts/run-sync.js --type=full)

    while [ "$(docker inspect -f '{{.State.Running}}' "$SYNC_ID" 2>/dev/null)" = "true" ]; do
        COUNT=$(docker compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" | xargs)
        echo -ne "\rBooks synced: $COUNT"
        sleep 10
    done
    echo ""

    EXIT_CODE=$(docker inspect -f '{{.State.ExitCode}}' "$SYNC_ID")
    if [ "$EXIT_CODE" -eq "0" ]; then
        docker rm "$SYNC_ID" > /dev/null
        echo "Sync complete!"
    else
        echo "Sync failed (exit $EXIT_CODE) — check: docker logs librivox_initial_sync"
        exit 1
    fi
else
    echo "Database has $BOOK_COUNT books, skipping sync (use FORCE_FULL_SYNC=true to override)"
fi

echo "Starting API server..."
docker compose up -d api

echo -n "Waiting for API..."
until curl -s http://localhost:3000/health > /dev/null 2>&1; do
    echo -n "."; sleep 1
done
echo " ready"

echo ""
echo "Deployment complete!"
echo "  API:    http://localhost:3000"
echo "  Health: http://localhost:3000/health"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f api"
echo "  docker compose down"
echo "  docker compose ps"
