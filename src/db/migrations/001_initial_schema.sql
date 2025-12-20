-- LibriVox Audiobooks Database Schema
-- Creation order respects foreign key dependencies

-- ============================================
-- Core Entity Tables
-- ============================================

-- Main audiobooks table
CREATE TABLE audiobooks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url_text_source TEXT,
  language VARCHAR(100) NOT NULL,
  copyright_year VARCHAR(10),
  num_sections INTEGER,
  url_rss TEXT,
  url_zip_file TEXT,
  url_project TEXT,
  url_librivox TEXT,
  url_other TEXT,
  url_iarchive TEXT,
  totaltime VARCHAR(50),
  totaltimesecs INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Authors table
CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  dob VARCHAR(10),
  dod VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Readers table
CREATE TABLE readers (
  id INTEGER PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Genres table
CREATE TABLE genres (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Translators table
CREATE TABLE translators (
  id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  dob VARCHAR(10),
  dod VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Relationship Tables (Many-to-Many)
-- ============================================

-- Audiobook-Author relationship
CREATE TABLE audiobook_authors (
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES authors(id) ON DELETE CASCADE,
  PRIMARY KEY (audiobook_id, author_id)
);

-- Audiobook-Genre relationship
CREATE TABLE audiobook_genres (
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (audiobook_id, genre_id)
);

-- Audiobook-Translator relationship
CREATE TABLE audiobook_translators (
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  translator_id INTEGER REFERENCES translators(id) ON DELETE CASCADE,
  PRIMARY KEY (audiobook_id, translator_id)
);

-- ============================================
-- Sections Table (Audio chapters)
-- ============================================

CREATE TABLE sections (
  id BIGINT PRIMARY KEY,
  audiobook_id INTEGER REFERENCES audiobooks(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  title TEXT,
  listen_url TEXT,
  language VARCHAR(100),
  playtime INTEGER,
  file_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Section-Reader relationship
CREATE TABLE section_readers (
  section_id BIGINT REFERENCES sections(id) ON DELETE CASCADE,
  reader_id INTEGER REFERENCES readers(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, reader_id)
);

-- ============================================
-- Sync Status Tracking Table
-- ============================================

CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL,
  total_books INTEGER,
  synced_books INTEGER,
  last_offset INTEGER,
  error_message TEXT,
  metadata JSONB
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Critical index for language filtering (main API query)
CREATE INDEX idx_audiobooks_language ON audiobooks(language);

-- Index for incremental sync queries
CREATE INDEX idx_audiobooks_updated_at ON audiobooks(updated_at);

-- Index for fetching book sections
CREATE INDEX idx_sections_audiobook_id ON sections(audiobook_id);

-- Index for sync status queries
CREATE INDEX idx_sync_status_type_started ON sync_status(sync_type, started_at DESC);

-- Indexes for relationship lookups (foreign keys)
CREATE INDEX idx_audiobook_authors_audiobook ON audiobook_authors(audiobook_id);
CREATE INDEX idx_audiobook_authors_author ON audiobook_authors(author_id);
CREATE INDEX idx_audiobook_genres_audiobook ON audiobook_genres(audiobook_id);
CREATE INDEX idx_audiobook_genres_genre ON audiobook_genres(genre_id);
CREATE INDEX idx_audiobook_translators_audiobook ON audiobook_translators(audiobook_id);
CREATE INDEX idx_audiobook_translators_translator ON audiobook_translators(translator_id);
CREATE INDEX idx_section_readers_section ON section_readers(section_id);
CREATE INDEX idx_section_readers_reader ON section_readers(reader_id);

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE audiobooks IS 'Main table storing LibriVox audiobook metadata';
COMMENT ON TABLE sync_status IS 'Tracks full and incremental sync operations for resumability';
COMMENT ON COLUMN audiobooks.language IS 'Indexed for fast filtering by language';
COMMENT ON COLUMN audiobooks.updated_at IS 'Indexed for incremental sync queries';
COMMENT ON INDEX idx_audiobooks_language IS 'Primary index for /audiobooks API endpoint';
