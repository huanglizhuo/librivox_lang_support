# LibriVox Language Support API

A Node.js/TypeScript service that synchronizes all LibriVox audiobooks to PostgreSQL and provides language-filtered REST APIs.

## Features

- 🔄 **Full Sync**: Syncs all LibriVox audiobooks with resumable batch processing
- 📅 **Incremental Sync**: Daily automatic sync of updated books using `since` parameter
- 🔍 **Language Filtering**: Fast indexed queries to filter audiobooks by language
- 📖 **Complete Metadata**: Books with authors, genres, translators, sections, and readers
- 🐳 **Docker Deployment**: Easy deployment with Docker Compose
- 📊 **Progress Tracking**: Monitor sync status via database and health endpoint
- 🔁 **Retry Logic**: Automatic retry with exponential backoff for failed requests
- 🔒 **Transaction Safety**: Atomic batch operations with rollback support

## Project Structure

```
librivox_lang_support/
├── src/
│   ├── api/                    # REST API layer
│   │   ├── controllers/        # Request handlers
│   │   ├── middlewares/        # Error handling
│   │   └── routes/             # Route definitions
│   ├── config/                 # Database configuration
│   ├── db/migrations/          # SQL schema migrations
│   ├── jobs/                   # Sync jobs and scheduler
│   ├── models/                 # Database models
│   ├── scripts/                # Manual sync scripts
│   ├── services/               # Business logic
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Logger and retry utilities
├── logs/                       # Application logs
├── docker-compose.yml          # Docker services configuration
├── Dockerfile                  # Multi-stage build
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
└── TECH_SPEC.md               # Detailed technical specification

25 TypeScript files implementing the complete system
```

## Prerequisites

- Node.js 20+ (for local development)
- Docker & Docker Compose (for deployment)
- PostgreSQL 16 (included in docker-compose)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and set your database password
# At minimum, change DB_PASSWORD to a strong password
nano .env
```

### 3. Start PostgreSQL Database

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Verify PostgreSQL is healthy
docker-compose logs -f postgres

# Check that database schema was created (should show 12 tables)
docker-compose exec postgres psql -U librivox_user -d librivox -c "\dt"
```

Expected tables:
- audiobooks, authors, readers, genres, translators
- audiobook_authors, audiobook_genres, audiobook_translators
- sections, section_readers
- sync_status

### 4. Build the Application

```bash
npm run build
```

### 5. Run Initial Full Sync

**Important**: For testing purposes, you may want to sync a limited number of books first.

```bash
# Option A: Sync ALL books (recommended for production, may take several hours)
node dist/scripts/run-sync.js --type=full

# Option B: For testing, modify src/jobs/fullSync.ts first
# Add this line after line 43 (inside the while loop):
# if (totalSynced >= 200) { hasMore = false; break; }
# Then rebuild and run:
npm run build
node dist/scripts/run-sync.js --type=full
```

Monitor sync progress:
```bash
# Watch logs
tail -f logs/combined.log

# Check database progress
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT sync_type, status, synced_books, last_offset FROM sync_status ORDER BY started_at DESC LIMIT 5;"
```

### 6. Start the API Server

```bash
# Development mode (with hot reload)
npm run dev

# Or start via Docker Compose (production)
docker-compose up -d api
docker-compose logs -f api
```

The API will be available at `http://localhost:3000`

### 7. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List English audiobooks (first page)
curl "http://localhost:3000/audiobooks?language=English&page=1&limit=5"

# List French audiobooks with different sorting
curl "http://localhost:3000/audiobooks?language=French&page=1&limit=10&sort=updated_at&order=desc"

# Get detailed information for a specific book (replace 52 with actual book ID)
curl http://localhost:3000/audiobooks/52
```

## API Endpoints

### GET /health

Returns API and database health status with last sync information.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "lastSync": {
    "type": "incremental",
    "completedAt": "2025-12-20T02:15:33Z",
    "totalBooks": 156
  }
}
```

### GET /audiobooks

List audiobooks filtered by language with pagination.

**Query Parameters:**
- `language` (required): Filter by language (e.g., "English", "French", "German")
- `page` (optional, default=1): Page number
- `limit` (optional, default=20, max=100): Items per page
- `sort` (optional, default="title"): Sort field ("title" or "updated_at")
- `order` (optional, default="asc"): Sort order ("asc" or "desc")

**Example:**
```bash
curl "http://localhost:3000/audiobooks?language=English&page=1&limit=20&sort=title&order=asc"
```

**Response:**
```json
{
  "data": [
    {
      "id": 47,
      "title": "Count of Monte Cristo",
      "language": "English",
      "copyright_year": "1844",
      "num_sections": 128,
      "totaltime": "49:43:15",
      "url_librivox": "https://librivox.org/...",
      "authors": [
        {
          "id": 431,
          "first_name": "Alexandre",
          "last_name": "Dumas"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1523,
    "totalPages": 77
  }
}
```

### GET /audiobooks/:id

Get detailed audiobook information including all sections, readers, genres, and translators.

**Example:**
```bash
curl http://localhost:3000/audiobooks/52
```

**Response:**
```json
{
  "id": 52,
  "title": "Letters of Two Brides",
  "description": "...",
  "language": "English",
  "copyright_year": "1902",
  "num_sections": 57,
  "totaltime": "9:09:20",
  "totaltimesecs": 32960,
  "url_librivox": "https://librivox.org/...",
  "authors": [...],
  "translators": [...],
  "genres": [...],
  "sections": [
    {
      "id": 121136,
      "section_number": 1,
      "title": "Letter 1",
      "listen_url": "https://archive.org/...",
      "playtime": 1764,
      "readers": [
        {
          "id": 19,
          "display_name": "Kara Shallenberg"
        }
      ]
    }
  ]
}
```

## Sync Operations

### Full Sync

Syncs all audiobooks from LibriVox. Resumable if interrupted.

```bash
# Start full sync from beginning
node dist/scripts/run-sync.js --type=full

# Resume from specific offset (e.g., if interrupted at 5000)
node dist/scripts/run-sync.js --type=full --resume=5000
```

**Features:**
- Batch size: 100 books per request
- Rate limiting: 1 request per second
- Retry logic: 3 attempts with exponential backoff
- Progress tracking: Updates `sync_status` table after each batch
- Safety limit: Stops at 100,000 books (adjustable)

### Incremental Sync

Syncs only books updated since the last successful sync.

```bash
node dist/scripts/run-sync.js --type=incremental
```

**Requirements:**
- Must run full sync at least once first
- Uses LibriVox API `since` parameter with Unix timestamp

### Automatic Daily Sync

The API server includes a cron scheduler that runs incremental sync daily at 2 AM UTC.

**Enable/Disable:**
Set `ENABLE_SYNC_CRON=true` in `.env` to enable (default when running via Docker).

## Database Operations

### Check Books by Language

```bash
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT language, COUNT(*) FROM audiobooks GROUP BY language ORDER BY COUNT(*) DESC LIMIT 10;"
```

### Check Sync History

```bash
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT id, sync_type, status, started_at, completed_at, synced_books FROM sync_status ORDER BY started_at DESC LIMIT 10;"
```

### Get Book Count

```bash
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT COUNT(*) FROM audiobooks;"
```

### Manual Database Backup

```bash
docker-compose exec postgres pg_dump -U librivox_user librivox > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
cat backup_20251220.sql | docker-compose exec -T postgres psql -U librivox_user librivox
```

## Docker Deployment

### Full Stack Deployment

```bash
# Start all services (PostgreSQL + API)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Run Sync Jobs in Docker

```bash
# Full sync
docker-compose exec api node dist/scripts/run-sync.js --type=full

# Incremental sync
docker-compose exec api node dist/scripts/run-sync.js --type=incremental
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | Database host |
| `DB_PORT` | 5432 | Database port |
| `DB_NAME` | librivox | Database name |
| `DB_USER` | librivox_user | Database user |
| `DB_PASSWORD` | - | Database password (required) |
| `PORT` | 3000 | API server port |
| `NODE_ENV` | development | Environment (development/production) |
| `ENABLE_SYNC_CRON` | true | Enable daily incremental sync |
| `SYNC_BATCH_SIZE` | 100 | Books per API request |
| `SYNC_RATE_LIMIT_MS` | 1000 | Delay between API requests (ms) |
| `LOG_LEVEL` | info | Logging level (error/warn/info/debug) |

## Monitoring & Logs

### Application Logs

```bash
# View all logs
tail -f logs/combined.log

# View errors only
tail -f logs/error.log

# Docker logs
docker-compose logs -f api
```

### Database Connection Pool

The application uses a connection pool with:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

Monitor pool usage in logs during heavy sync operations.

## Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Verify credentials in .env match docker-compose.yml
cat .env | grep DB_
```

### Sync Job Fails

```bash
# Check error logs
tail -f logs/error.log

# Check sync status in database
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT * FROM sync_status WHERE status = 'failed' ORDER BY started_at DESC LIMIT 5;"

# Resume from last successful offset
node dist/scripts/run-sync.js --type=full --resume=<last_offset>
```

### API Returns 500 Error

```bash
# Check API logs
docker-compose logs api

# Check database connection
curl http://localhost:3000/health

# Restart API server
docker-compose restart api
```

### Out of Disk Space

```bash
# Check Docker volume size
docker system df -v

# Clean up unused Docker resources
docker system prune

# Check database size
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT pg_size_pretty(pg_database_size('librivox'));"
```

## Performance

### Expected Metrics

- **Database Size**: ~500MB for 20,000 books (plus indexes)
- **Full Sync Duration**: 5-8 hours for all books (depends on LibriVox API response time)
- **API Response Time**:
  - List endpoint: <200ms
  - Detail endpoint: <100ms
- **Memory Usage**: ~150-200MB during sync operations

### Optimization Tips

1. **Increase batch size** for faster syncs (but higher memory usage):
   ```bash
   SYNC_BATCH_SIZE=200
   ```

2. **Add database indexes** for custom queries (if needed):
   ```sql
   CREATE INDEX idx_audiobooks_title ON audiobooks(title);
   ```

3. **Adjust connection pool** for high traffic:
   Edit `src/config/database.ts` and increase `max: 20` to higher value.

## Production Checklist

Before deploying to production:

- [ ] Set strong `DB_PASSWORD` in `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Configure database backups (daily pg_dump cron job)
- [ ] Set up reverse proxy (nginx) with SSL certificates
- [ ] Allocate 10GB+ PostgreSQL volume
- [ ] Configure log rotation for Docker volumes
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Configure alerts for sync failures
- [ ] Test incremental sync after full sync
- [ ] Verify cron job runs at 2 AM UTC
- [ ] Load test API endpoints
- [ ] Document API for consumers (Swagger/OpenAPI)

## Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL only
docker-compose up -d postgres

# Run in development mode (hot reload)
npm run dev
```

### Running Tests

```bash
# Build project
npm run build

# Test LibriVox API connection
curl "https://librivox.org/api/feed/audiobooks/?format=json&limit=1&offset=0&extended=1"

# Test database connection
docker-compose exec postgres psql -U librivox_user -d librivox -c "SELECT 1;"
```

### Code Structure

- **Models**: Database operations with parameterized queries (SQL injection safe)
- **Services**: Business logic and orchestration
- **Jobs**: Batch processing and scheduling
- **API**: RESTful endpoints with validation
- **Utils**: Shared utilities (logging, retry logic)

## Architecture Overview

```
┌─────────────────┐
│   LibriVox API  │
└────────┬────────┘
         │ HTTP (1 req/sec, retry with backoff)
         │
┌────────▼────────────────────────┐
│   Sync Service (Cron Job)       │
│  - Full Sync (resumable)        │
│  - Incremental Sync (daily)     │
└────────┬────────────────────────┘
         │ Transactions
         │
┌────────▼────────────────────────┐
│      PostgreSQL Database        │
│  - 12 tables (normalized)       │
│  - Indexed for fast queries     │
│  - FK constraints with CASCADE  │
└────────┬────────────────────────┘
         │ Connection Pool (max: 20)
         │
┌────────▼────────────────────────┐
│      REST API Server            │
│  GET /audiobooks?language=...   │
│  GET /audiobooks/:id            │
│  GET /health                    │
└─────────────────────────────────┘
```

## Database Schema

See [TECH_SPEC.md](TECH_SPEC.md) for complete schema documentation.

**Key Tables:**
- `audiobooks`: Main book metadata (indexed on `language`)
- `authors`, `readers`, `genres`, `translators`: Entity tables
- `sections`: Audio chapters with readers
- `audiobook_*`: Many-to-many relationship tables
- `sync_status`: Track sync operations for resumability

## API Rate Limiting

To respect LibriVox servers:
- 1 request per second (configurable via `SYNC_RATE_LIMIT_MS`)
- Exponential backoff on failures (5s, 10s, 20s)
- User-Agent header: `LibriVoxSync/1.0`
- Maximum 3 retries per request

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check logs: `logs/combined.log` and `logs/error.log`
- Review [TECH_SPEC.md](TECH_SPEC.md) for detailed architecture
- Check database sync status: `SELECT * FROM sync_status ORDER BY started_at DESC;`

## Acknowledgments

- LibriVox for providing the public domain audiobook API
- PostgreSQL for robust relational database
- Node.js and TypeScript communities
