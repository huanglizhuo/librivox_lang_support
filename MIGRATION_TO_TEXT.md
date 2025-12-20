# Database Migration: VARCHAR to TEXT

## Summary

Changed most VARCHAR fields to TEXT to prevent truncation errors with external LibriVox API data.

## What Changed

### Fields Changed to TEXT (15 fields)

**Audiobooks Table:**
- `title` VARCHAR(500) → TEXT
- `url_text_source` VARCHAR(500) → TEXT
- `url_rss` VARCHAR(500) → TEXT
- `url_zip_file` VARCHAR(500) → TEXT
- `url_project` VARCHAR(500) → TEXT
- `url_librivox` VARCHAR(500) → TEXT
- `url_other` VARCHAR(500) → TEXT
- `url_iarchive` VARCHAR(500) → TEXT

**Authors Table:**
- `first_name` VARCHAR(200) → TEXT
- `last_name` VARCHAR(200) → TEXT

**Translators Table:**
- `first_name` VARCHAR(200) → TEXT
- `last_name` VARCHAR(200) → TEXT

**Readers Table:**
- `display_name` VARCHAR(200) → TEXT

**Genres Table:**
- `name` VARCHAR(200) → TEXT

**Sections Table:**
- `title` VARCHAR(500) → TEXT
- `listen_url` VARCHAR(500) → TEXT
- `file_name` VARCHAR(500) → TEXT

### Fields Kept as VARCHAR (for validation)

- `audiobooks.language` VARCHAR(100) ✓
- `audiobooks.totaltime` VARCHAR(50) ✓
- `audiobooks.copyright_year` VARCHAR(10) ✓
- `sections.language` VARCHAR(100) ✓
- `authors.dob` VARCHAR(10) ✓
- `authors.dod` VARCHAR(10) ✓
- `translators.dob` VARCHAR(10) ✓
- `translators.dod` VARCHAR(10) ✓

## Files Updated

1. ✅ `src/db/migrations/002_change_to_text.sql` - New migration script
2. ✅ `src/db/migrations/001_initial_schema.sql` - Updated for future deployments
3. ✅ `src/services/sync.service.ts` - Simplified validation (only checks remaining VARCHAR fields)

## Why TEXT?

In PostgreSQL:
- **No performance difference** between VARCHAR and TEXT
- TEXT is actually the native type
- VARCHAR(n) is just TEXT with a length constraint
- For external API data, TEXT prevents runtime errors
- Can always add CHECK constraints later if needed

## How to Apply Migration

### Option 1: Run Migration Script (No Data Loss)

```bash
# Apply all ALTER TABLE statements
docker-compose exec -T postgres psql -U librivox_user -d librivox < src/db/migrations/002_change_to_text.sql
```

### Option 2: Run Statements Individually

```bash
docker-compose exec postgres psql -U librivox_user -d librivox
```

Then paste the contents of `002_change_to_text.sql`.

### Verify Changes

```bash
# Check audiobooks table
docker-compose exec postgres psql -U librivox_user -d librivox -c "\d audiobooks"

# Check sections table
docker-compose exec postgres psql -U librivox_user -d librivox -c "\d sections"

# Check authors table
docker-compose exec postgres psql -U librivox_user -d librivox -c "\d authors"
```

You should see `text` instead of `character varying(n)` for the updated fields.

## Resume Sync After Migration

```bash
# Rebuild code
npm run build

# Resume from where it failed (offset 3000)
node dist/scripts/run-sync.js --type=full --resume=3000
```

## Performance Impact

**None.** In PostgreSQL, TEXT and VARCHAR have identical performance characteristics. This change only removes arbitrary length limits that were causing errors.

## Rollback (if needed)

To rollback, you would need to:
1. Ensure no data exceeds the old limits
2. Run ALTER TABLE statements changing TEXT back to VARCHAR(n)

```sql
-- Example rollback (only if needed)
ALTER TABLE sections ALTER COLUMN title TYPE VARCHAR(500);
-- etc.
```

**Note**: This would fail if any existing data exceeds the VARCHAR limits.
