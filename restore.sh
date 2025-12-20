#!/bin/bash

# LibriVox Database Restore Script
# Restores database from a backup file

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}[ERROR]${NC} Usage: ./restore.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/librivox_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo -e "${YELLOW}[WARNING]${NC} This will REPLACE all data in the database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo -e "${BLUE}[INFO]${NC} Stopping API server..."
docker-compose stop api

echo -e "${BLUE}[INFO]${NC} Decompressing backup..."
gunzip -c "$BACKUP_FILE" > /tmp/restore.sql

echo -e "${BLUE}[INFO]${NC} Dropping existing database..."
docker-compose exec -T postgres psql -U librivox_user -d postgres -c "DROP DATABASE IF EXISTS librivox;"

echo -e "${BLUE}[INFO]${NC} Creating new database..."
docker-compose exec -T postgres psql -U librivox_user -d postgres -c "CREATE DATABASE librivox;"

echo -e "${BLUE}[INFO]${NC} Restoring data..."
cat /tmp/restore.sql | docker-compose exec -T postgres psql -U librivox_user -d librivox

echo -e "${BLUE}[INFO]${NC} Cleaning up..."
rm /tmp/restore.sql

echo -e "${BLUE}[INFO]${NC} Starting API server..."
docker-compose start api

echo -e "${GREEN}[SUCCESS]${NC} Database restored successfully!"

# Verify
BOOK_COUNT=$(docker-compose exec -T postgres psql -U librivox_user -d librivox -t -c "SELECT COUNT(*) FROM audiobooks;" | xargs)
echo -e "${BLUE}[INFO]${NC} Total books in database: $BOOK_COUNT"
