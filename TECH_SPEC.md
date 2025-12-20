# LibriVox Language Support - Technical Specification

## 1. Overview

A Node.js/TypeScript service that syncs LibriVox audiobook data to PostgreSQL and provides language-filtered APIs.

### Key Features
- Full sync of all LibriVox audiobooks
- Daily incremental sync using `since` parameter
- Language-indexed queries
- RESTful API with pagination
- Docker Compose deployment

---

## 2. Architecture

```
┌─────────────────┐
│   LibriVox API  │
└────────┬────────┘
         │
    HTTP Requests
         │
┌────────▼────────────────────────┐
│   Sync Service (Cron Job)       │
│  - Full Sync (Initial)          │
│  - Incremental Sync (Daily)     │
└────────┬────────────────────────┘
         │
    Write to DB
         │
┌────────▼────────────────────────┐
│      PostgreSQL Database        │
│  - audiobooks table             │
│  - authors table                │
│  - sections table               │
│  - genres table                 │
│  - translators table            │
│  - sync_status table            │
└────────┬────────────────────────┘
         │
    Read from DB
         │
┌────────▼────────────────────────┐
│      REST API Server            │
│  GET /audiobooks                │
│  GET /audiobooks/:id            │
│  GET /health                    │
└─────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- Main audiobooks table
CREATE TABLE audiobooks (
  id INTEGER PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  url_text_source VARCHAR(500),
  language VARCHAR(100) NOT NULL,
  copyright_year VARCHAR(10),
  num_sections INTEGER,
  url_rss VARCHAR(500),
  url_zip_file VARCHAR(500),
  url_project VARCHAR(500),
  url_librivox VARCHAR(500),
  url_other VARCHAR(500),
  url_iarchive VARCHAR(500),
  totaltime VARCHAR(50),
  totaltimesecs INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index on language for fast filtering
CREATE INDEX idx_audiobooks_language ON audiobooks(language);
CREATE INDEX idx_audiobooks_updated_at ON audiobooks(updated_at);

-- Authors table
CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  first_name VARCHAR(200),
  last_name VARCHAR(200),
  dob VARCHAR(10),
  dod VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audiobook-Author relationship (many-to-many)
CREATE TABLE audiobook_authors (
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES authors(id) ON DELETE CASCADE,
  PRIMARY KEY (audiobook_id, author_id)
);

-- Sections table (audio chapters)
CREATE TABLE sections (
  id BIGINT PRIMARY KEY,
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  title VARCHAR(500),
  listen_url VARCHAR(500),
  language VARCHAR(100),
  playtime INTEGER,
  file_name VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sections_audiobook_id ON sections(audiobook_id);

-- Readers table
CREATE TABLE readers (
  id INTEGER PRIMARY KEY,
  display_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section-Reader relationship (many-to-many)
CREATE TABLE section_readers (
  section_id BIGINT REFERENCES sections(id) ON DELETE CASCADE,
  reader_id INTEGER REFERENCES readers(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, reader_id)
);

-- Genres table
CREATE TABLE genres (
  id INTEGER PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audiobook-Genre relationship (many-to-many)
CREATE TABLE audiobook_genres (
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (audiobook_id, genre_id)
);

-- Translators table
CREATE TABLE translators (
  id INTEGER PRIMARY KEY,
  first_name VARCHAR(200),
  last_name VARCHAR(200),
  dob VARCHAR(10),
  dod VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audiobook-Translator relationship (many-to-many)
CREATE TABLE audiobook_translators (
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  translator_id INTEGER REFERENCES translators(id) ON DELETE CASCADE,
  PRIMARY KEY (audiobook_id, translator_id)
);

-- Sync status tracking
CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(20) NOT NULL, -- 'full' or 'incremental'
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'failed'
  total_books INTEGER,
  synced_books INTEGER,
  last_offset INTEGER, -- for resumable full sync
  error_message TEXT,
  metadata JSONB -- store additional info like 'since' timestamp
);

CREATE INDEX idx_sync_status_type_started ON sync_status(sync_type, started_at DESC);
```

---

## 4. Project Structure

```
librivox_lang_support/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── config/
│   │   └── database.ts          # DB connection config
│   ├── models/
│   │   ├── Audiobook.ts         # Audiobook model
│   │   ├── Author.ts
│   │   ├── Section.ts
│   │   └── SyncStatus.ts
│   ├── services/
│   │   ├── librivox.service.ts  # LibriVox API client
│   │   ├── sync.service.ts      # Sync orchestration
│   │   └── audiobook.service.ts # Business logic
│   ├── api/
│   │   ├── routes/
│   │   │   ├── audiobooks.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── controllers/
│   │   │   └── audiobooks.controller.ts
│   │   └── middlewares/
│   │       ├── errorHandler.ts
│   │       └── validation.ts
│   ├── jobs/
│   │   ├── fullSync.ts          # Full sync job
│   │   └── incrementalSync.ts   # Incremental sync job
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql
│   │   └── seeds/               # Optional test data
│   ├── utils/
│   │   ├── logger.ts            # Winston logger
│   │   └── retry.ts             # Retry logic for API calls
│   ├── types/
│   │   └── librivox.types.ts    # TypeScript interfaces
│   ├── server.ts                # Express app setup
│   └── index.ts                 # Entry point
└── scripts/
    └── run-sync.ts              # Manual sync trigger script
```

---

## 5. Sync Mechanism

### 5.1 Full Sync (Initial)

```typescript
// Algorithm:
// 1. Mark sync as 'running' in sync_status table
// 2. Start from offset=0, limit=100
// 3. For each batch:
//    a. Fetch from LibriVox API (with extended=1)
//    b. Upsert audiobooks, authors, genres, translators, sections
//    c. Update sync_status.last_offset for resumability
// 4. Continue until API returns empty books array
// 5. Mark sync as 'completed'

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function runFullSync() {
  const syncRecord = await createSyncRecord('full');
  let offset = syncRecord.last_offset || 0;
  let totalSynced = 0;

  try {
    while (true) {
      const url = `https://librivox.org/api/feed/audiobooks/?format=json&limit=${BATCH_SIZE}&offset=${offset}&extended=1`;
      const response = await fetchWithRetry(url);

      if (!response.books || response.books.length === 0) {
        break; // No more books
      }

      // Process in database transaction
      await db.transaction(async (trx) => {
        for (const book of response.books) {
          await upsertAudiobook(book, trx);
        }
      });

      totalSynced += response.books.length;
      offset += BATCH_SIZE;

      // Update progress
      await updateSyncProgress(syncRecord.id, offset, totalSynced);

      // Rate limiting: small delay between requests
      await sleep(1000);
    }

    await completeSyncRecord(syncRecord.id, totalSynced);
  } catch (error) {
    await failSyncRecord(syncRecord.id, error.message);
    throw error;
  }
}
```

### 5.2 Incremental Sync (Daily)

```typescript
// Algorithm:
// 1. Get last successful sync completed_at timestamp
// 2. Convert to Unix timestamp for 'since' parameter
// 3. Fetch with since parameter and extended=1
// 4. Upsert all returned books
// 5. Mark sync as completed

async function runIncrementalSync() {
  const lastSync = await getLastSuccessfulSync();
  const sinceTimestamp = Math.floor(lastSync.completed_at.getTime() / 1000);

  const syncRecord = await createSyncRecord('incremental', { since: sinceTimestamp });
  let offset = 0;
  let totalSynced = 0;

  try {
    while (true) {
      const url = `https://librivox.org/api/feed/audiobooks/?format=json&limit=${BATCH_SIZE}&offset=${offset}&since=${sinceTimestamp}&extended=1`;
      const response = await fetchWithRetry(url);

      if (!response.books || response.books.length === 0) {
        break;
      }

      await db.transaction(async (trx) => {
        for (const book of response.books) {
          await upsertAudiobook(book, trx);
        }
      });

      totalSynced += response.books.length;
      offset += BATCH_SIZE;
      await sleep(1000);
    }

    await completeSyncRecord(syncRecord.id, totalSynced);
  } catch (error) {
    await failSyncRecord(syncRecord.id, error.message);
    throw error;
  }
}
```

### 5.3 Cron Schedule

```typescript
// Using node-cron
import cron from 'node-cron';

// Run incremental sync daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  logger.info('Starting daily incremental sync');
  await runIncrementalSync();
});
```

---

## 6. API Endpoints

### 6.1 GET /audiobooks

**Purpose**: List audiobooks filtered by language with pagination

**Query Parameters**:
- `language` (required): Filter by language (e.g., "English", "French")
- `page` (optional, default=1): Page number
- `limit` (optional, default=20, max=100): Items per page
- `sort` (optional, default="title"): Sort field (title, updated_at)
- `order` (optional, default="asc"): Sort order (asc, desc)

**Response**:
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

**SQL Query**:
```sql
SELECT
  a.*,
  COUNT(*) OVER() as total_count
FROM audiobooks a
WHERE a.language = $1
ORDER BY a.title ASC
LIMIT $2 OFFSET $3;
```

### 6.2 GET /audiobooks/:id

**Purpose**: Get detailed audiobook info including sections

**Path Parameters**:
- `id`: Audiobook ID

**Response**:
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
  "url_zip_file": "https://archive.org/...",
  "authors": [
    {
      "id": 86,
      "first_name": "Honoré de",
      "last_name": "Balzac",
      "dob": "1799",
      "dod": "1850"
    }
  ],
  "translators": [
    {
      "id": 9787,
      "first_name": "R. S.",
      "last_name": "Scott"
    }
  ],
  "genres": [
    {
      "id": 8,
      "name": "Epistolary Fiction"
    }
  ],
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

**SQL Queries**:
```sql
-- Main book info
SELECT * FROM audiobooks WHERE id = $1;

-- Authors
SELECT a.* FROM authors a
JOIN audiobook_authors aa ON a.id = aa.author_id
WHERE aa.audiobook_id = $1;

-- Sections with readers
SELECT s.*,
  json_agg(json_build_object('id', r.id, 'display_name', r.display_name)) as readers
FROM sections s
LEFT JOIN section_readers sr ON s.id = sr.section_id
LEFT JOIN readers r ON sr.reader_id = r.id
WHERE s.audiobook_id = $1
GROUP BY s.id
ORDER BY s.section_number;

-- Similar for genres and translators
```

### 6.3 GET /health

**Purpose**: Health check endpoint

**Response**:
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

---

## 7. Technology Stack

### 7.1 Core Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1",
    "node-cron": "^3.0.3",
    "axios": "^1.6.2",
    "winston": "^3.11.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/pg": "^8.10.9",
    "@types/node-cron": "^3.0.11",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2"
  }
}
```

### 7.2 Type Definitions

```typescript
// src/types/librivox.types.ts

export interface LibriVoxBook {
  id: string;
  title: string;
  description: string;
  url_text_source: string;
  language: string;
  copyright_year: string;
  num_sections: string;
  url_rss: string;
  url_zip_file: string;
  url_project: string;
  url_librivox: string;
  url_other: string;
  url_iarchive?: string;
  totaltime: string;
  totaltimesecs: number;
  authors: LibriVoxAuthor[];
  sections?: LibriVoxSection[];
  genres?: LibriVoxGenre[];
  translators?: LibriVoxTranslator[];
}

export interface LibriVoxAuthor {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  dod: string;
}

export interface LibriVoxSection {
  id: string;
  section_number: string;
  title: string;
  listen_url: string;
  language: string;
  playtime: string;
  file_name: string | null;
  readers: LibriVoxReader[];
}

export interface LibriVoxReader {
  reader_id: string;
  display_name: string;
}

export interface LibriVoxGenre {
  id: string;
  name: string;
}

export interface LibriVoxTranslator {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  dod: string;
}

export interface LibriVoxApiResponse {
  books: LibriVoxBook[];
}
```

---

## 8. Docker Configuration

### 8.1 docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: librivox_db
    environment:
      POSTGRES_DB: librivox
      POSTGRES_USER: librivox_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/db/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U librivox_user -d librivox"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: librivox_api
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: librivox
      DB_USER: librivox_user
      DB_PASSWORD: ${DB_PASSWORD}
      PORT: 3000
      ENABLE_SYNC_CRON: "true"
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

volumes:
  postgres_data:
```

### 8.2 Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### 8.3 .env.example

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=librivox
DB_USER=librivox_user
DB_PASSWORD=your_secure_password

# API Server
PORT=3000
NODE_ENV=development

# Sync Configuration
ENABLE_SYNC_CRON=true
SYNC_BATCH_SIZE=100
SYNC_RATE_LIMIT_MS=1000

# Logging
LOG_LEVEL=info
```

---

## 9. Error Handling & Resilience

### 9.1 Retry Logic

```typescript
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delay = 5000
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'LibriVoxSync/1.0'
        }
      });
      return response.data;
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const shouldRetry =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        (error.response && error.response.status >= 500);

      if (!shouldRetry) throw error;

      logger.warn(`Retry ${i + 1}/${maxRetries} for ${url}`);
      await sleep(delay * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

### 9.2 Database Transaction Management

```typescript
async function upsertAudiobook(book: LibriVoxBook, trx: Transaction) {
  try {
    // Upsert main audiobook
    await trx.raw(`
      INSERT INTO audiobooks (id, title, language, ...)
      VALUES (?, ?, ?, ...)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = NOW()
    `, [book.id, book.title, ...]);

    // Upsert related entities
    await upsertAuthors(book.authors, trx);
    await linkAuthorsToBook(book.id, book.authors, trx);

    if (book.sections) {
      await upsertSections(book.id, book.sections, trx);
    }
    // ... similar for genres, translators
  } catch (error) {
    logger.error(`Failed to upsert book ${book.id}:`, error);
    throw error;
  }
}
```

### 9.3 Logging Strategy

```typescript
// Winston logger configuration
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

---

## 10. Performance Considerations

### 10.1 Database Indexing

- Index on `audiobooks.language` for fast filtering
- Index on `audiobooks.updated_at` for incremental sync queries
- Foreign key indexes automatically created by PostgreSQL
- Consider composite index on `(language, updated_at)` if queries combine both

### 10.2 Caching Strategy (Future Enhancement)

```typescript
// Optional: Redis cache for popular queries
// Cache audiobook list by language for 1 hour
const cacheKey = `audiobooks:${language}:page:${page}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await db.query(...);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

### 10.3 Connection Pooling

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## 11. Deployment Steps

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd librivox_lang_support

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f api

# 5. Trigger initial full sync (manual)
docker-compose exec api node dist/scripts/run-sync.js --type=full

# 6. Verify sync status
curl http://localhost:3000/health
```

### Production Considerations

1. **Database Backups**: Schedule daily backups of PostgreSQL
2. **Monitoring**: Add Prometheus metrics and Grafana dashboards
3. **SSL/TLS**: Use reverse proxy (nginx) with SSL certificates
4. **Rate Limiting**: Implement rate limiting on API endpoints
5. **API Documentation**: Add Swagger/OpenAPI documentation

---

## 12. Testing Strategy

### 12.1 Unit Tests

- Test LibriVox API client with mocked responses
- Test data transformation logic
- Test database operations with test database

### 12.2 Integration Tests

- Test full sync with limited offset (first 100 books)
- Test incremental sync
- Test API endpoints with seeded data

### 12.3 Manual Verification

```bash
# Test language filter
curl "http://localhost:3000/audiobooks?language=English&page=1&limit=10"

# Test book detail
curl "http://localhost:3000/audiobooks/52"

# Verify database
docker-compose exec postgres psql -U librivox_user -d librivox -c \
  "SELECT language, COUNT(*) FROM audiobooks GROUP BY language ORDER BY COUNT(*) DESC LIMIT 10;"
```

---

## 13. Monitoring & Maintenance

### 13.1 Key Metrics to Track

- Sync job success/failure rate
- Sync duration
- API response times
- Database query performance
- Error rates

### 13.2 Alerts

- Sync job failures
- Database connection issues
- High error rates on API endpoints
- Disk space warnings

### 13.3 Maintenance Tasks

- Weekly: Review sync logs for errors
- Monthly: Analyze slow queries and optimize
- Quarterly: Review and update LibriVox API integration for changes

---

## 14. Future Enhancements

1. **Search Functionality**: Full-text search on title/description
2. **Advanced Filtering**: Filter by author, genre, duration
3. **GraphQL API**: Alternative to REST for flexible queries
4. **WebSocket Updates**: Real-time notifications of new books
5. **Analytics**: Track popular books, languages, authors
6. **Admin Dashboard**: UI to monitor sync status and trigger manual syncs

---

## 15. API Rate Limiting Compliance

Based on LibriVox API documentation:
- Respect their servers with reasonable request rates (1 req/sec in our implementation)
- Use User-Agent header to identify our application
- Cache responses when appropriate
- Implement exponential backoff on failures

---

## 16. Estimated Storage Requirements

Assuming ~20,000 audiobooks:
- Audiobooks table: ~50 MB
- Sections table (avg 50 sections/book): ~200 MB
- Related tables: ~50 MB
- Total: ~300 MB + indexes (~100 MB)

**Recommended**: 10 GB PostgreSQL volume for growth
