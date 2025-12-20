-- Migration: Change VARCHAR fields to TEXT for external API data
-- This prevents truncation errors with unpredictable LibriVox API data

-- Audiobook URL fields (can be very long with query parameters)
ALTER TABLE audiobooks ALTER COLUMN url_text_source TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN url_rss TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN url_zip_file TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN url_project TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN url_librivox TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN url_other TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN url_iarchive TYPE TEXT;

-- Section fields
ALTER TABLE sections ALTER COLUMN title TYPE TEXT;
ALTER TABLE sections ALTER COLUMN listen_url TYPE TEXT;
ALTER TABLE sections ALTER COLUMN file_name TYPE TEXT;

-- Author fields (can have long names)
ALTER TABLE authors ALTER COLUMN first_name TYPE TEXT;
ALTER TABLE authors ALTER COLUMN last_name TYPE TEXT;

-- Translator fields
ALTER TABLE translators ALTER COLUMN first_name TYPE TEXT;
ALTER TABLE translators ALTER COLUMN last_name TYPE TEXT;

-- Reader fields
ALTER TABLE readers ALTER COLUMN display_name TYPE TEXT;

-- Genre fields
ALTER TABLE genres ALTER COLUMN name TYPE TEXT;

-- Note: Keeping VARCHAR for these fields as they have predictable lengths:
-- - audiobooks.language (VARCHAR(100))
-- - audiobooks.totaltime (VARCHAR(50))
-- - audiobooks.copyright_year (VARCHAR(10))
-- - sections.language (VARCHAR(100))
