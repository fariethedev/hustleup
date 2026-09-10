-- ============================================================================
--  TEST DATA — one job advert and one news article, for exercising the UI.
--  NOT a migration. Nothing runs this automatically; you run it by hand.
-- ============================================================================
--
-- WHAT THIS IS FOR
-- The jobs board had exactly one advert and no way to see a card with several
-- images on it; news had 98 ingested articles and not one with a media gallery
-- (news_media was empty), so the gallery on an article had never actually been
-- rendered with anything in it. These two rows exist to exercise those paths:
--
--   * the job card's media strip and tag chips
--   * salary range, remote flag, category and expiry rendering
--   * the news cover image AND a separate in-body media gallery
--   * an article long enough to test the reader's typography and scroll
--
-- BOTH ARE OBVIOUSLY FAKE, ON PURPOSE
-- The company is "Testowa Fabryka" and the outlet is "HustleSpace Test Desk",
-- and each body says in its first line that it is test content. A plausible-looking
-- fake job advert is worse than a silly one: someone could apply to it. This way
-- nobody mistakes either for real, and you can still see exactly how a real one
-- will lay out.
--
-- ATTACHMENT
-- The job hangs off the existing APPROVED hiring company (GigaFactory Hub) so the
-- publisher-gated read paths resolve. The article deliberately leaves
-- publisher_user_id / publisher_profile_id NULL, matching the 97 ingested articles
-- already in the table — the only NEWS_OUTLET profile on this database is
-- SUSPENDED, and flipping somebody's moderation status to seed test data is not
-- this file's business.
--
-- Re-runnable: both inserts are guarded on a fixed id, so a second run does nothing.
--
-- UNDO (removes exactly these two and their child rows):
--   DELETE FROM job_media  WHERE job_id     = 'aaaaaaaa-0000-4000-a000-00000000ab01';
--   DELETE FROM job_tags   WHERE job_id     = 'aaaaaaaa-0000-4000-a000-00000000ab01';
--   DELETE FROM jobs       WHERE id         = 'aaaaaaaa-0000-4000-a000-00000000ab01';
--   DELETE FROM news_media WHERE article_id = 'bbbbbbbb-0000-4000-b000-00000000cd01';
--   DELETE FROM news_tags  WHERE article_id = 'bbbbbbbb-0000-4000-b000-00000000cd01';
--   DELETE FROM news_articles WHERE id      = 'bbbbbbbb-0000-4000-b000-00000000cd01';

SET NAMES utf8mb4;

SET @JOB  := 'aaaaaaaa-0000-4000-a000-00000000ab01';
SET @NEWS := 'bbbbbbbb-0000-4000-b000-00000000cd01';

-- Whichever hiring company is approved; NULL is fine if there is none.
SET @PUB_PROFILE := (SELECT id      FROM publisher_profiles
                      WHERE type = 'HIRING_COMPANY' AND status = 'APPROVED' LIMIT 1);
SET @PUB_USER    := (SELECT user_id FROM publisher_profiles
                      WHERE type = 'HIRING_COMPANY' AND status = 'APPROVED' LIMIT 1);

-- ── The job ─────────────────────────────────────────────────────────────────
-- GIG rather than FULL_TIME: the one advert already on the board is FULL_TIME, so
-- this covers the other end of the type enum and the shorter-commitment layout.
INSERT INTO jobs (id, publisher_user_id, publisher_profile_id, company_name, company_logo_url,
                  title, description, category, location, remote,
                  job_type, salary_min, salary_max, salary_currency, salary_period,
                  status, applications_count, views_count, created_at, updated_at, expires_at)
SELECT @JOB, @PUB_USER, @PUB_PROFILE, 'Testowa Fabryka',
       'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&q=80',
       'Weekend Warehouse Assistant (TEST POST)',
       CONCAT(
         'THIS IS A TEST ADVERT — do not apply, nobody is reading applications.\n\n',
         'Posted to check how a job card renders with photos, tags, a salary range and a ',
         'remote flag on it.\n\n',
         'What the role would involve\n',
         'Picking and packing student orders on Saturday and Sunday mornings, six hours a ',
         'shift, starting at 7am. Boxes are light — nothing over 12kg — but there is a lot ',
         'of walking and the floor is cold in winter.\n\n',
         'What you would need\n',
         'To be a student in or near Lublin, comfortable on your feet for a full shift, and ',
         'able to commit to both weekend days for at least a month. No experience needed; ',
         'the till and scanner take about twenty minutes to learn.\n\n',
         'Hours and pay\n',
         'Two shifts a week, paid monthly. The range below is the real range for this kind ',
         'of work locally, so the card shows something believable.'
       ),
       'warehouse', 'Lublin, Poland', 0,
       'GIG', 2400.00, 3200.00, 'PLN', 'MONTH',
       'OPEN', 0, 0, NOW() - INTERVAL 2 DAY, NOW(), NOW() + INTERVAL 30 DAY
WHERE NOT EXISTS (SELECT 1 FROM (SELECT id FROM jobs) j WHERE j.id = @JOB);

-- Three images: enough for the card's media strip to page rather than just show one.
INSERT INTO job_media (job_id, media_url)
SELECT @JOB, u.url FROM (
  SELECT 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=1200&q=80' AS url
  UNION ALL SELECT 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80'
  UNION ALL SELECT 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=1200&q=80'
) u
WHERE NOT EXISTS (SELECT 1 FROM (SELECT job_id FROM job_media) m WHERE m.job_id = @JOB);

INSERT INTO job_tags (job_id, tag)
SELECT @JOB, t.tag FROM (
  SELECT 'weekend' AS tag UNION ALL SELECT 'student-friendly'
  UNION ALL SELECT 'no-experience' UNION ALL SELECT 'lublin'
) t
WHERE NOT EXISTS (SELECT 1 FROM (SELECT job_id FROM job_tags) x WHERE x.job_id = @JOB);

-- ── The article ─────────────────────────────────────────────────────────────
-- Long enough to actually test the reader: several paragraphs, a list, and a body
-- that runs past one screen.
INSERT INTO news_articles (id, publisher_user_id, publisher_profile_id, outlet_name, outlet_logo_url,
                           title, summary, body, category, cover_image_url,
                           status, views_count, created_at, updated_at, published_at)
SELECT @NEWS, NULL, NULL, 'HustleSpace Test Desk',
       'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200&q=80',
       'Test article: what a full story looks like in the reader',
       'A placeholder story with a cover image, an in-body gallery and enough paragraphs to scroll. Written to check the news reader, not to be read.',
       CONCAT(
         'THIS IS A TEST ARTICLE. It exists so the news reader can be checked with real ',
         'length in it, and it is not reporting anything.\n\n',
         'Most of the articles already on this database arrived through the ingestion feed, ',
         'and every one of them has a cover image and nothing else — the in-body gallery had ',
         'never been rendered with a single image in it. This one has three, so that path is ',
         'exercised for the first time.\n\n',
         'What to look at\n',
         'The cover should sit above the headline without cropping anybody''s face out of ',
         'frame. The summary should read as a standfirst rather than as the first paragraph ',
         'repeated. Body text should hold a comfortable measure — somewhere near 65 ',
         'characters a line — instead of running the full width of a desktop window.\n\n',
         'Paragraph spacing is the thing most likely to be wrong. Too tight and the piece ',
         'reads as one block; too loose and it stops feeling like continuous prose. Scroll ',
         'to the end and see whether it still feels like one article.\n\n',
         'The gallery below the third paragraph is the part that has never been tested. ',
         'Three images, all landscape, all different aspect ratios — if it handles these it ',
         'will handle most of what an outlet uploads.\n\n',
         'Finally, the byline. It reads "HustleSpace Test Desk", which is not a real outlet, ',
         'so nothing here can be mistaken for something somebody actually published.'
       ),
       'students',
       'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1600&q=80',
       'PUBLISHED', 0, NOW() - INTERVAL 6 HOUR, NOW(), NOW() - INTERVAL 6 HOUR
WHERE NOT EXISTS (SELECT 1 FROM (SELECT id FROM news_articles) n WHERE n.id = @NEWS);

-- news_media was completely empty before this — this is the first article with a gallery.
INSERT INTO news_media (article_id, media_url)
SELECT @NEWS, u.url FROM (
  SELECT 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1400&q=80' AS url
  UNION ALL SELECT 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1400&q=80'
  UNION ALL SELECT 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1400&q=80'
) u
WHERE NOT EXISTS (SELECT 1 FROM (SELECT article_id FROM news_media) m WHERE m.article_id = @NEWS);

INSERT INTO news_tags (article_id, tag)
SELECT @NEWS, t.tag FROM (
  SELECT 'test' AS tag UNION ALL SELECT 'students' UNION ALL SELECT 'lublin'
) t
WHERE NOT EXISTS (SELECT 1 FROM (SELECT article_id FROM news_tags) x WHERE x.article_id = @NEWS);

-- ── Check ───────────────────────────────────────────────────────────────────
--   SELECT title, company_name, job_type, status FROM jobs WHERE id = @JOB;
--   SELECT title, outlet_name, status FROM news_articles WHERE id = @NEWS;
--   SELECT COUNT(*) FROM job_media  WHERE job_id     = @JOB;    -- 3
--   SELECT COUNT(*) FROM news_media WHERE article_id = @NEWS;   -- 3
