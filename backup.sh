#!/bin/bash

# LibriVox Database Backup Script
# Creates a timestamped backup of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/librivox_backup_$TIMESTAMP.sql"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO]${NC} Creating backup directory..."
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}[INFO]${NC} Creating database backup..."
docker-compose exec -T postgres pg_dump -U librivox_user librivox > "$BACKUP_FILE"

# Compress backup
echo -e "${BLUE}[INFO]${NC} Compressing backup..."
gzip "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
echo -e "${GREEN}[SUCCESS]${NC} Backup created: $BACKUP_FILE.gz ($BACKUP_SIZE)"

# Keep only last 7 backups
echo -e "${BLUE}[INFO]${NC} Cleaning old backups (keeping last 7)..."
cd "$BACKUP_DIR"
ls -t librivox_backup_*.sql.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
cd ..

echo -e "${GREEN}[SUCCESS]${NC} Backup complete!"

# List all backups
echo -e "${BLUE}[INFO]${NC} Available backups:"
ls -lh "$BACKUP_DIR"/librivox_backup_*.sql.gz 2>/dev/null || echo "No backups found"
