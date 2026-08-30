ALTER TABLE posts
    ADD COLUMN media_urls TEXT NULL,
    ADD COLUMN media_types TEXT NULL;

UPDATE posts
SET media_urls = image_url,
    media_types = 'IMAGE'
WHERE image_url IS NOT NULL
  AND image_url <> ''
  AND (media_urls IS NULL OR media_urls = '');
