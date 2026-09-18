-- Sample news articles and job adverts, so neither page is empty before aggregation runs.
--
-- RUN THIS BY HAND wherever the News and Jobs pages are empty — production, in practice.
--
-- WHY THEY ARE EMPTY
-- Both pages are filled by importers that are dormant until configured, and they are dormant
-- for different reasons:
--
--   Jobs   AdzunaJobImporter returns immediately unless app.adzuna.app-id and app-key are
--          both set. Free credentials at https://developer.adzuna.com. Until then the board
--          shows only natively posted adverts, which on a new deployment is none.
--
--   News   NewsImportService ships with working defaults (five lublin.eu channels and Notes
--          from Poland), so this one should populate on its own within a minute of boot and
--          every 30 minutes after. If it has not, the cause is environmental rather than
--          missing configuration — NEWS_SOURCES overridden to blank, outbound HTTP blocked,
--          or the service having failed to start. An admin can force a fetch and see
--          per-source success and failure counts with POST /api/v1/news/import, which is the
--          quickest way to tell which.
--
-- So these rows are a floor, not a replacement. Real aggregated content appears alongside
-- them the moment either importer runs, and sorts above them because it is newer.
--
-- IDEMPOTENT, AND REMOVABLE
-- Every row carries an external_id prefixed "sample:", which is the same natural key the
-- importers dedupe on — so this file can be run twice without duplicating, and real imports
-- can never collide with it. Deleting them again is one statement:
--
--   DELETE FROM news_articles WHERE external_id LIKE 'sample:%';
--   DELETE FROM jobs          WHERE external_id LIKE 'sample:%';
--
-- source_name is set to 'HustleSpace sample' on every row so they are identifiable in the UI
-- and in the database without reading ids.
--
-- Dates are relative to the moment this runs, staggered over the past few days, so the pages
-- read as a live feed rather than a wall of identical timestamps.

-- ── News ─────────────────────────────────────────────────────────────────────
INSERT INTO news_articles
  (id, outlet_name, title, summary, body, category, cover_image_url,
   source_name, source_url, external_id, status, views_count, created_at, published_at)
SELECT
    UUID() AS id,
    'HustleSpace' AS outlet_name,
    'Lublin student guide: what to sort out in your first week' AS title,
    'PESEL, a bank account, a tram card and a doctor — the four errands that unblock everything else.' AS summary,
    CONCAT(
      '<p>Arriving for a semester in Lublin means a short list of administrative jobs that everything ',
      'else depends on. Getting them done in the first week saves weeks of friction later.</p>',
      '<p><strong>PESEL number.</strong> Your national identification number. Apply at the city office ',
      'with your passport and confirmation of study. Almost every other service asks for it.</p>',
      '<p><strong>Bank account.</strong> Most Polish banks open a free student account with a passport ',
      'and proof of enrolment. A local account makes rent, bills and marketplace payouts far simpler.</p>',
      '<p><strong>Transport.</strong> The city card covers trams and buses at a reduced student rate. ',
      'Register it with your student ID before you top it up.</p>',
      '<p><strong>Healthcare.</strong> EU students should carry an EHIC card. Everyone else needs ',
      'either NFZ registration or private cover — sort it before you need it, not after.</p>'
    ) AS body,
    'students' AS category,
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80' AS cover_image_url,
    'HustleSpace sample' AS source_name,
    NULL AS source_url,
    'sample:news:first-week-guide' AS external_id,
    'PUBLISHED' AS status,
    0 AS views_count,
    NOW() - INTERVAL 2 HOUR AS created_at,
    NOW() - INTERVAL 2 HOUR AS published_at
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE external_id = 'sample:news:first-week-guide');

INSERT INTO news_articles
  (id, outlet_name, title, summary, body, category, cover_image_url,
   source_name, source_url, external_id, status, views_count, created_at, published_at)
SELECT
    UUID(), 'HustleSpace',
    'How many hours can a student work in Poland?',
    'Study visas allow work, but the rules differ by nationality and by the kind of contract you sign.',
    CONCAT(
      '<p>Students on a Polish national visa or residence card issued for study are generally allowed ',
      'to work without a separate work permit. That is the headline, and the detail underneath it is ',
      'what usually catches people out.</p>',
      '<p><strong>Contract type matters.</strong> An umowa o pracę is an employment contract with full ',
      'social contributions. An umowa zlecenie is a civil contract, common for part-time and seasonal ',
      'work, and students under 26 are usually exempt from social contributions on it — which is why ',
      'so many student jobs are offered this way.</p>',
      '<p><strong>Keep your own record.</strong> Hours, rates and payment dates. Most disputes come ',
      'down to no one having written anything down.</p>',
      '<p>This is general information, not legal advice. Check your own permit and contract.</p>'
    ),
    'immigration',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80',
    'HustleSpace sample', NULL, 'sample:news:student-work-hours', 'PUBLISHED', 0,
    NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE external_id = 'sample:news:student-work-hours');

INSERT INTO news_articles
  (id, outlet_name, title, summary, body, category, cover_image_url,
   source_name, source_url, external_id, status, views_count, created_at, published_at)
SELECT
    UUID(), 'HustleSpace',
    'Renting your first flat in Lublin: deposits, bills and what to check',
    'What czynsz actually covers, why the deposit is usually a month, and the questions to ask before signing.',
    CONCAT(
      '<p>Rent in Lublin is usually quoted as a base figure plus <em>czynsz</em> — a monthly charge to ',
      'the building that covers shared costs such as water, waste and maintenance. Ask which of the two ',
      'you are being quoted, because the difference between them can be several hundred złoty.</p>',
      '<p><strong>Deposit.</strong> One month is standard, returnable at the end of the tenancy less any ',
      'damage. Photograph the flat on the day you move in and send the pictures to the landlord, so the ',
      'condition it was in is on the record rather than in dispute.</p>',
      '<p><strong>Bills.</strong> Establish which are included and which are metered. Electricity and ',
      'internet are usually separate.</p>',
      '<p><strong>The contract.</strong> Get it in writing, in a language you read. A verbal agreement is ',
      'legal and nearly impossible to enforce.</p>'
    ),
    'housing',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
    'HustleSpace sample', NULL, 'sample:news:renting-first-flat', 'PUBLISHED', 0,
    NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE external_id = 'sample:news:renting-first-flat');

INSERT INTO news_articles
  (id, outlet_name, title, summary, body, category, cover_image_url,
   source_name, source_url, external_id, status, views_count, created_at, published_at)
SELECT
    UUID(), 'HustleSpace',
    'Turning a side hustle into steady income while you study',
    'The students earning consistently are not the ones with the best idea — they are the ones who answered fastest.',
    CONCAT(
      '<p>Across the marketplace the pattern is the same: the sellers who earn steadily are not the ones ',
      'with the most unusual offer. They are the ones who reply quickly, describe honestly, and finish ',
      'what they start.</p>',
      '<p><strong>Reply speed decides most sales.</strong> A buyer messaging three sellers usually buys ',
      'from whoever answers first, not whoever is cheapest.</p>',
      '<p><strong>Photograph the real thing.</strong> Your own photo of the actual item outsells a ',
      'polished stock image, because a buyer can tell the difference and knows what it means.</p>',
      '<p><strong>Price for the work, not the panic.</strong> Underpricing to win a first order sets the ',
      'rate every later customer expects.</p>'
    ),
    'opportunity',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    'HustleSpace sample', NULL, 'sample:news:side-hustle-income', 'PUBLISHED', 0,
    NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 5 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE external_id = 'sample:news:side-hustle-income');

-- ── Jobs ─────────────────────────────────────────────────────────────────────
INSERT INTO jobs
  (id, company_name, title, description, category, location, remote, job_type,
   salary_min, salary_max, salary_currency, salary_period,
   source_name, source_url, external_id, status, applications_count, views_count, created_at)
SELECT
    UUID() AS id, 'Kawiarnia Centrum' AS company_name,
    'Barista — weekends, city centre' AS title,
    CONCAT(
      'Weekend shifts in a busy independent café near Krakowskie Przedmieście. ',
      'Training given — previous coffee experience is welcome but not required. ',
      'Polish helpful for orders, English fine for the rest of the team. ',
      'Umowa zlecenie, paid monthly.'
    ) AS description,
    'hospitality' AS category, 'Lublin' AS location, 0 AS remote, 'PART_TIME' AS job_type,
    30.00 AS salary_min, 38.00 AS salary_max, 'PLN' AS salary_currency, 'HOUR' AS salary_period,
    'HustleSpace sample' AS source_name, NULL AS source_url,
    'sample:job:barista-weekends' AS external_id,
    'OPEN' AS status, 0 AS applications_count, 0 AS views_count,
    NOW() - INTERVAL 4 HOUR AS created_at
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE external_id = 'sample:job:barista-weekends');

INSERT INTO jobs
  (id, company_name, title, description, category, location, remote, job_type,
   salary_min, salary_max, salary_currency, salary_period,
   source_name, source_url, external_id, status, applications_count, views_count, created_at)
SELECT
    UUID(), 'LingwaLab',
    'English conversation tutor (online)',
    CONCAT(
      'Run 45-minute conversation sessions with Polish adults preparing for work abroad. ',
      'You set your own availability; sessions are booked around it. ',
      'Native or C1 English required. No teaching qualification needed — the sessions are ',
      'conversation practice, not grammar instruction.'
    ),
    'teaching', 'Remote', 1, 'PART_TIME',
    45.00, 70.00, 'PLN', 'HOUR',
    'HustleSpace sample', NULL, 'sample:job:english-tutor', 'OPEN', 0, 0,
    NOW() - INTERVAL 1 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE external_id = 'sample:job:english-tutor');

INSERT INTO jobs
  (id, company_name, title, description, category, location, remote, job_type,
   salary_min, salary_max, salary_currency, salary_period,
   source_name, source_url, external_id, status, applications_count, views_count, created_at)
SELECT
    UUID(), 'Magazyn Wschód',
    'Warehouse picker — evening shift',
    CONCAT(
      'Order picking and packing on the 16:00–22:00 shift, Monday to Friday, with flexibility ',
      'around exam periods. Scanner training on the first day. Site is on a direct bus route ',
      'from the centre. Umowa zlecenie.'
    ),
    'warehouse', 'Lublin', 0, 'PART_TIME',
    31.00, 35.00, 'PLN', 'HOUR',
    'HustleSpace sample', NULL, 'sample:job:warehouse-evening', 'OPEN', 0, 0,
    NOW() - INTERVAL 2 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE external_id = 'sample:job:warehouse-evening');

INSERT INTO jobs
  (id, company_name, title, description, category, location, remote, job_type,
   salary_min, salary_max, salary_currency, salary_period,
   source_name, source_url, external_id, status, applications_count, views_count, created_at)
SELECT
    UUID(), 'Nordvia Software',
    'Junior frontend developer — internship',
    CONCAT(
      'Six-month paid internship working on a React product with a small team. ',
      'You will ship real features from the first month, reviewed by a senior developer. ',
      'We look for JavaScript fundamentals and curiosity rather than a long CV. ',
      'Hybrid: two days in the Lublin office, three remote.'
    ),
    'it', 'Lublin', 0, 'INTERNSHIP',
    4200.00, 5500.00, 'PLN', 'MONTH',
    'HustleSpace sample', NULL, 'sample:job:frontend-intern', 'OPEN', 0, 0,
    NOW() - INTERVAL 3 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE external_id = 'sample:job:frontend-intern');

INSERT INTO jobs
  (id, company_name, title, description, category, location, remote, job_type,
   salary_min, salary_max, salary_currency, salary_period,
   source_name, source_url, external_id, status, applications_count, views_count, created_at)
SELECT
    UUID(), 'Dom i Porządek',
    'Flat cleaning — flexible hours',
    CONCAT(
      'Cleaning shifts for short-let flats across Lublin, arranged around your timetable. ',
      'Two to four hours per flat, materials provided. Suits anyone wanting daytime work ',
      'between lectures. Paid per completed flat rather than per hour.'
    ),
    'cleaning', 'Lublin', 0, 'GIG',
    90.00, 140.00, 'PLN', 'DAY',
    'HustleSpace sample', NULL, 'sample:job:flat-cleaning', 'OPEN', 0, 0,
    NOW() - INTERVAL 4 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE external_id = 'sample:job:flat-cleaning');

INSERT INTO jobs
  (id, company_name, title, description, category, location, remote, job_type,
   salary_min, salary_max, salary_currency, salary_period,
   source_name, source_url, external_id, status, applications_count, views_count, created_at)
SELECT
    UUID(), 'Rynek Retail',
    'Weekend sales assistant — clothing',
    CONCAT(
      'Saturday and Sunday shifts in a clothing store in the old town. ',
      'Serving customers, restocking and fitting-room cover. ',
      'Conversational Polish needed for this one. Staff discount included.'
    ),
    'retail', 'Lublin', 0, 'PART_TIME',
    30.50, 34.00, 'PLN', 'HOUR',
    'HustleSpace sample', NULL, 'sample:job:weekend-retail', 'OPEN', 0, 0,
    NOW() - INTERVAL 6 DAY
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE external_id = 'sample:job:weekend-retail');

-- Verify:
--   SELECT COUNT(*) FROM news_articles WHERE external_id LIKE 'sample:%';  -- expect 4
--   SELECT COUNT(*) FROM jobs          WHERE external_id LIKE 'sample:%';  -- expect 6
