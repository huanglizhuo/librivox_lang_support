-- Migration: Convert ALL remaining VARCHAR fields to TEXT
-- This eliminates all potential truncation errors with external API data

-- Audiobook remaining VARCHAR fields
ALTER TABLE audiobooks ALTER COLUMN language TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN totaltime TYPE TEXT;
ALTER TABLE audiobooks ALTER COLUMN copyright_year TYPE TEXT;

-- Author date fields
ALTER TABLE authors ALTER COLUMN dob TYPE TEXT;
ALTER TABLE authors ALTER COLUMN dod TYPE TEXT;

-- Translator date fields
ALTER TABLE translators ALTER COLUMN dob TYPE TEXT;
ALTER TABLE translators ALTER COLUMN dod TYPE TEXT;

-- Section language field
ALTER TABLE sections ALTER COLUMN language TYPE TEXT;

-- Result: ALL text-based fields are now TEXT (unlimited)
-- No more VARCHAR constraints that could cause runtime errors
