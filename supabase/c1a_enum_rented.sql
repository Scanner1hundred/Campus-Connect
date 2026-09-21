-- COMMIT 1 · file 1 of 3
-- Run this ALONE in the Supabase SQL Editor, before c1b.
-- (Postgres won't let a brand-new enum value be used in the same batch that adds it.)
alter type listing_status add value if not exists 'rented';
