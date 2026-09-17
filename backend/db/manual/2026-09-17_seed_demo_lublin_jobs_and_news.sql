-- ============================================================================
--  DEMO DATA — a populated jobs board and news desk for Lublin students.
--  NOT a migration. Nothing runs this automatically; you run it by hand.
-- ============================================================================
--
--  WHAT IT ADDS
--    12 job adverts, every one of them something a student can actually take:
--       part-time, weekend, gig, internship or short contract, nothing asking
--       for years of experience, and several that need English rather than
--       fluent Polish. Spread across 12 of the 15 JOB_CATEGORIES so the filter
--       bar has something behind every chip a user is likely to press.
--    10 news articles, one for each SECTION in taxonomy.js, so no section tab
--       opens onto an empty list.
--
--  EVERY ROW IS INVENTED, AND SAYS SO
--  Titles carry a [DEMO] prefix and each body opens by naming itself as sample
--  content. That is not timidity, it is the same rule as the existing test seed:
--  a plausible fake job advert is worse than an obvious one, because somebody
--  can apply to it and wait for an answer that is never coming. The immigration,
--  regulation and pay articles say it twice — invented guidance about residence
--  cards or contracts is the one kind of filler here that could actually cost an
--  international student something if it were believed.
--
--  The employers and the outlet are made up. No real Polish company, school or
--  news outlet is named anywhere in this file, because attaching an invented
--  advert or an invented article to a real organisation's name is a different
--  and worse thing than filler.
--
--  TO MAKE THEM LOOK REAL (your call, not mine)
--    UPDATE jobs          SET title = REPLACE(title, '[DEMO] ', '')
--      WHERE external_id LIKE 'demo-seed-2026-09-job-%';
--    UPDATE news_articles SET title = REPLACE(title, '[DEMO] ', '')
--      WHERE external_id LIKE 'demo-seed-2026-09-news-%';
--  The bodies still name themselves as samples, which is the part worth keeping.
--
--  WHY source_name AND source_url STAY NULL
--  Setting either flips the client into "aggregated from elsewhere" mode: the
--  job card replaces its Apply button with "Apply on <source>" pointing out of
--  the app, and the article header credits an outlet and links away. Demo rows
--  are meant to exercise the native apply and native reader paths, so both stay
--  NULL and external_id alone carries the marker — it is a dedupe key, never
--  rendered, and it makes cleanup a one-liner.
--
--  Re-runnable. Both inserts are guarded on the external_id prefix, so a second
--  run inserts nothing rather than doubling the board.
--
--  UNDO (removes exactly what this file added, and nothing else):
--    DELETE FROM job_media  WHERE job_id     IN (SELECT id FROM (SELECT id FROM jobs WHERE external_id LIKE 'demo-seed-2026-09-job-%') x);
--    DELETE FROM job_tags   WHERE job_id     IN (SELECT id FROM (SELECT id FROM jobs WHERE external_id LIKE 'demo-seed-2026-09-job-%') x);
--    DELETE FROM jobs       WHERE external_id LIKE 'demo-seed-2026-09-job-%';
--    DELETE FROM news_media WHERE article_id IN (SELECT id FROM (SELECT id FROM news_articles WHERE external_id LIKE 'demo-seed-2026-09-news-%') x);
--    DELETE FROM news_tags  WHERE article_id IN (SELECT id FROM (SELECT id FROM news_articles WHERE external_id LIKE 'demo-seed-2026-09-news-%') x);
--    DELETE FROM news_articles WHERE external_id LIKE 'demo-seed-2026-09-news-%';

-- Polish diacritics throughout, and this file is UTF-8. The mysql client on
-- Windows negotiates cp850 and turns every ą, ł and ż into box-drawing rubbish
-- on the way in, reporting no error at all. Declared here so the file is correct
-- however it is invoked.
SET NAMES utf8mb4;

-- Hangs off an approved hiring company when there is one, so the publisher-gated
-- read paths resolve. NULL is fine and matches the ingested adverts already there.
SET @PUB_PROFILE := (SELECT id      FROM publisher_profiles
                      WHERE type = 'HIRING_COMPANY' AND status = 'APPROVED' LIMIT 1);
SET @PUB_USER    := (SELECT user_id FROM publisher_profiles
                      WHERE type = 'HIRING_COMPANY' AND status = 'APPROVED' LIMIT 1);

-- ════════════════════════════════════════════════════════════════════════════
--  JOBS
-- ════════════════════════════════════════════════════════════════════════════
--
--  A note that appears on most of these, because it is the single most useful
--  thing a student in Poland can know about part-time work: on an umowa
--  zlecenie, students under 26 are exempt from ZUS social contributions, so
--  gross and net are much closer together than on an employment contract. It is
--  a real rule and worth surfacing even on filler — but it is summarised, not
--  advised, and the bodies say to check it rather than relying on a demo advert.

INSERT INTO jobs (id, publisher_user_id, publisher_profile_id, company_name, company_logo_url,
                  title, description, category, location, remote,
                  job_type, salary_min, salary_max, salary_currency, salary_period,
                  status, applications_count, views_count,
                  created_at, updated_at, expires_at, external_id)
SELECT d.id, @PUB_USER, @PUB_PROFILE, d.company, d.logo,
       d.title, d.body, d.cat, d.loc, d.remote,
       d.jtype, d.smin, d.smax, 'PLN', d.period,
       'OPEN', 0, d.views,
       NOW() - INTERVAL d.age_h HOUR, NOW() - INTERVAL d.age_h HOUR, NOW() + INTERVAL d.live_d DAY, d.ext
FROM (
  SELECT
    'd0000001-0000-4000-9000-00000000a001' AS id, 'Kawiarnia Ziarno' AS company,
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=80' AS logo,
    '[DEMO] Barista — mornings before lectures' AS title,
    CONCAT(
      'Sample advert, posted to fill the demo board. Nobody is reading applications.\n\n',
      'We open at seven and the first three hours are the whole day''s rush. We need two ',
      'more people on the bar who can start early and be gone by the time a 10am lecture ',
      'begins.\n\n',
      'What you would do\n',
      'Pull espresso, steam milk, run the till, keep the bar clean. If you have never made ',
      'a flat white before that is genuinely fine — the machine takes about two shifts to ',
      'get comfortable with and somebody is always on with you.\n\n',
      'What we ask\n',
      'Conversational Polish or English is enough; most of our morning regulars are students ',
      'and half the orders happen in English anyway. Three mornings a week minimum so the ',
      'rota is worth building around you.\n\n',
      'Contract and pay\n',
      'Umowa zlecenie, paid monthly. If you are a student under 26 there are no ZUS ',
      'deductions on that, so the hourly rate below is close to what actually lands. Check ',
      'your own situation rather than taking a demo advert''s word for it.'
    ) AS body,
    'hospitality' AS cat, 'Lublin, Poland' AS loc, 0 AS remote, 'PART_TIME' AS jtype,
    31.00 AS smin, 36.00 AS smax, 'HOUR' AS period, 214 AS views, 9 AS age_h, 38 AS live_d,
    'demo-seed-2026-09-job-01' AS ext

  UNION ALL SELECT 'd0000002-0000-4000-9000-00000000a002', 'Magazyn Wschód Sp. z o.o.',
    'https://images.unsplash.com/photo-1553413077-190dd305871c?w=200&q=80',
    '[DEMO] Weekend warehouse picker — Saturdays and Sundays',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Two six-hour shifts at the weekend, 7am to 1pm, picking and packing orders. The work ',
      'is repetitive and you will walk a long way, but nothing is heavier than about 12kg ',
      'and the scanner does the thinking.\n\n',
      'Who it suits\n',
      'Anyone who would rather keep weekdays completely free for lectures and get the whole ',
      'week''s hours done in two mornings. No experience — the induction is twenty minutes.\n\n',
      'Getting there\n',
      'The site is past Świdnik. There is a works bus from Lublin centre at 6:20am, free, and ',
      'it is the reason most of the weekend crew can do this without a car.\n\n',
      'Umowa zlecenie, paid monthly, ZUS-exempt for students under 26.'
    ),
    'warehouse', 'Świdnik, near Lublin', 0, 'PART_TIME',
    32.00, 38.00, 'HOUR', 331, 31, 45, 'demo-seed-2026-09-job-02'

  UNION ALL SELECT 'd0000003-0000-4000-9000-00000000a003', 'LingwoStart',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=200&q=80',
    '[DEMO] English tutor for children (7–12), afternoons',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Small groups of four to six children, 45-minute lessons, between 3pm and 6pm on ',
      'weekdays. Materials, lesson plans and the coursebook are provided — you are not ',
      'writing a syllabus, you are running a room.\n\n',
      'What we need\n',
      'Confident spoken English. A native or near-native speaker is ideal but a strong C1 is ',
      'plenty. No teaching qualification required; you get two paid shadowing sessions before ',
      'you take a group alone. Enough Polish to handle a parent at the door helps, and we ',
      'will cover for you if you have none yet.\n\n',
      'Why students take this one\n',
      'It is the best hourly rate on this board and it is only ever two or three hours a day, ',
      'so it does not eat a timetable. Umowa zlecenie, ZUS-exempt under 26.'
    ),
    'teaching', 'Lublin, Poland', 0, 'PART_TIME',
    55.00, 80.00, 'HOUR', 468, 54, 40, 'demo-seed-2026-09-job-03'

  UNION ALL SELECT 'd0000004-0000-4000-9000-00000000a004', 'HelpDesk Kresy',
    'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=200&q=80',
    '[DEMO] Customer support — English and Ukrainian, evening shifts',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Inbound chat and email for an e-commerce client. Evening shifts, 4pm to 9pm, three to ',
      'five days a week, and the rota is published a fortnight ahead so you can put your exam ',
      'weeks in before it is built.\n\n',
      'Languages\n',
      'English and Ukrainian are the two that matter here. Polish is useful but genuinely not ',
      'required — a good part of the team works in English all day.\n\n',
      'Where\n',
      'Hybrid. First three weeks in the Lublin office so training is not done over a video ',
      'call, then two days at home a week if you want them.\n\n',
      'No call-centre experience needed. If you can stay polite in writing at 8pm you can do ',
      'this. Umowa zlecenie, ZUS-exempt under 26.'
    ),
    'support', 'Lublin, Poland (hybrid)', 1, 'PART_TIME',
    34.00, 42.00, 'HOUR', 502, 76, 35, 'demo-seed-2026-09-job-04'

  UNION ALL SELECT 'd0000005-0000-4000-9000-00000000a005', 'Sklep Podkowa',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200&q=80',
    '[DEMO] Shop assistant — afternoons and Saturdays',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'A small neighbourhood shop, not a supermarket. Till, shelves, deliveries, and talking ',
      'to the same forty people every week.\n\n',
      'Hours\n',
      'Afternoons from 2pm, plus a Saturday. We can work around a fixed lecture timetable if ',
      'you give it to us at the start of the semester and stick to it.\n\n',
      'Polish\n',
      'You need enough to serve a customer — prices, directions, small talk. It does not have ',
      'to be good. Several of the team started here with about that much and it is a decent ',
      'way to stop being frightened of speaking it.\n\n',
      'Umowa zlecenie, paid monthly, ZUS-exempt for students under 26.'
    ),
    'retail', 'Lublin, Poland', 0, 'PART_TIME',
    30.00, 34.00, 'HOUR', 187, 96, 30, 'demo-seed-2026-09-job-05'

  UNION ALL SELECT 'd0000006-0000-4000-9000-00000000a006', 'Rowerowa Dostawa Lublin',
    'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=200&q=80',
    '[DEMO] Bike courier — pick your own hours',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Food delivery on a bike inside the centre and the university district. You open the ',
      'app when you want to work and close it when you are done — there is no rota and nobody ',
      'chases you if you do not appear for a fortnight.\n\n',
      'The honest version\n',
      'Earnings swing. Friday and Saturday evenings and any day it rains are worth roughly ',
      'double a wet Tuesday afternoon, which is why the range below is as wide as it is. ',
      'People who do well here work the peaks and ignore the rest.\n\n',
      'What you need\n',
      'Your own bike, a phone, and a thermal bag which we lend you. No Polish required beyond ',
      'reading an address. Under-26 students are ZUS-exempt on the zlecenie.'
    ),
    'delivery', 'Lublin, Poland', 0, 'GIG',
    28.00, 45.00, 'HOUR', 623, 120, 60, 'demo-seed-2026-09-job-06'

  UNION ALL SELECT 'd0000007-0000-4000-9000-00000000a007', 'Kod Kaskada',
    'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=200&q=80',
    '[DEMO] Frontend intern (React) — 20h/week, paid',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'A six-month paid internship on a small product team. Twenty hours a week, arranged ',
      'around your timetable, and it can drop to ten during exam sessions without anybody ',
      'making it awkward.\n\n',
      'What you would actually do\n',
      'Real tickets on a real codebase from week two — small ones, reviewed properly. React ',
      'and TypeScript. You will not be making coffee and you will not be writing tests for ',
      'somebody else''s code for six months either.\n\n',
      'What we look for\n',
      'Something you have built that you can talk about for ten minutes. A course project is ',
      'fine. We care far more about that than about which year you are in.\n\n',
      'English is the working language of the team. Monthly rate below is for the 20-hour week.'
    ),
    'it', 'Lublin, Poland (hybrid)', 1, 'INTERNSHIP',
    4000.00, 5500.00, 'MONTH', 1147, 150, 50, 'demo-seed-2026-09-job-07'

  UNION ALL SELECT 'd0000008-0000-4000-9000-00000000a008', 'Domowe Wsparcie',
    'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=200&q=80',
    '[DEMO] After-school childminder — 3pm to 6pm',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Collecting two children (6 and 9) from school, getting them home, feeding them ',
      'something simple and sitting with them through homework until a parent is back at six. ',
      'Two to four afternoons a week.\n\n',
      'What matters here\n',
      'Reliability more than experience. These are the same two children every week and the ',
      'whole arrangement rests on you actually turning up at ten to three.\n\n',
      'Language\n',
      'The family speaks Polish at home and would prefer the children hear English from you, ',
      'so an English speaker with basic Polish is the ideal shape. \n\n',
      'We ask for one reference — a previous family, a summer camp, a sports club, anything ',
      'where somebody watched you with children. Umowa zlecenie, ZUS-exempt under 26.'
    ),
    'babysitting', 'Lublin, Poland', 0, 'PART_TIME',
    35.00, 45.00, 'HOUR', 276, 168, 30, 'demo-seed-2026-09-job-08'

  UNION ALL SELECT 'd0000009-0000-4000-9000-00000000a009', 'Biuro Wisła',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&q=80',
    '[DEMO] Office assistant — student hours, 4 mornings',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Scanning and filing, answering the door and the phone, keeping the meeting room ',
      'stocked, chasing three people for the same document. Four mornings a week, 9am to 1pm.\n\n',
      'Why it is on a student board\n',
      'It is quiet, it is indoors, and there is usually an hour in the middle where nothing ',
      'happens and nobody minds if you read. Several people have done a degree around this ',
      'exact shift.\n\n',
      'What you need\n',
      'Polish good enough for a phone call, and to be the sort of person who notices the ',
      'printer is out of paper before it is.\n\n',
      'Umowa zlecenie, paid monthly, ZUS-exempt for students under 26.'
    ),
    'office', 'Lublin, Poland', 0, 'PART_TIME',
    32.00, 38.00, 'HOUR', 158, 192, 28, 'demo-seed-2026-09-job-09'

  UNION ALL SELECT 'd0000010-0000-4000-9000-00000000a010', 'Czyste Miasto Serwis',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=200&q=80',
    '[DEMO] Evening cleaner — student halls, 6pm to 9pm',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Three hours an evening, four or five evenings a week, in student accommodation. ',
      'Corridors, kitchens, stairwells. You work alone with headphones in and nobody ',
      'supervises you past the first week.\n\n',
      'No Polish needed\n',
      'Genuinely none. The handover is a checklist with pictures on it. This is the job on ',
      'this board with the lowest language barrier, which is why it goes quickly in October.\n\n',
      'It is finished by nine, which leaves the evening intact. Umowa zlecenie, ZUS-exempt ',
      'under 26.'
    ),
    'cleaning', 'Lublin, Poland', 0, 'PART_TIME',
    31.00, 35.00, 'HOUR', 341, 216, 30, 'demo-seed-2026-09-job-10'

  UNION ALL SELECT 'd0000011-0000-4000-9000-00000000a011', 'Słowo Studio',
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=200&q=80',
    '[DEMO] Freelance translator — PL↔EN or PL↔UA, remote',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'Per-document work, sent to you as it comes in. Mostly short things: product copy, ',
      'website pages, internal memos. Two to five thousand words a week if you want that ',
      'much, less if you do not, and you can turn a job down without it affecting the next ',
      'one.\n\n',
      'Fully remote, and the deadlines are in days rather than hours — this is the one on ',
      'this board you can genuinely do at 11pm from a dorm room.\n\n',
      'What we need\n',
      'Near-native in both directions of whichever pair you pick. No certification required, ',
      'but there is a short paid test piece before the first real job. Language students do ',
      'well at this and it is worth more on a CV than most part-time work.\n\n',
      'Rate below is per hour of work as estimated on each brief.'
    ),
    'language', 'Remote (Poland)', 1, 'CONTRACT',
    45.00, 70.00, 'HOUR', 389, 240, 55, 'demo-seed-2026-09-job-11'

  UNION ALL SELECT 'd0000012-0000-4000-9000-00000000a012', 'Scena Akademicka',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=200&q=80',
    '[DEMO] Event crew — student festival week',
    CONCAT(
      'Sample advert for the demo board. Not a real vacancy.\n\n',
      'One week of work around a student festival: building and striking the stage, running ',
      'wristbands on the gate, staffing the info point, moving a great many crates.\n\n',
      'Shifts\n',
      'Ten hours, day rate rather than hourly, and you can take as few as two shifts or all ',
      'seven. Nights pay at the top of the range.\n\n',
      'Who it suits\n',
      'Anyone who wants a concentrated burst of money in one week rather than a commitment ',
      'stretched over a semester. No experience; the gate briefing takes fifteen minutes and ',
      'the build crew teaches you on the day.\n\n',
      'English is fine throughout — the crew every year is half international. Umowa zlecenie, ',
      'ZUS-exempt under 26.'
    ),
    'creative', 'Lublin, Poland', 0, 'TEMPORARY',
    250.00, 350.00, 'DAY', 714, 264, 21, 'demo-seed-2026-09-job-12'
) d
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT external_id FROM jobs) j
   WHERE j.external_id LIKE 'demo-seed-2026-09-job-%'
);

-- Tags. Driven off external_id so this is re-runnable and needs no id list.
INSERT INTO job_tags (job_id, tag)
SELECT j.id, t.tag
FROM (SELECT id, external_id FROM jobs WHERE external_id LIKE 'demo-seed-2026-09-job-%') j
JOIN (
            SELECT 'demo-seed-2026-09-job-01' AS ext, 'student-friendly' AS tag
  UNION ALL SELECT 'demo-seed-2026-09-job-01', 'mornings'
  UNION ALL SELECT 'demo-seed-2026-09-job-01', 'no-experience'
  UNION ALL SELECT 'demo-seed-2026-09-job-02', 'weekend'
  UNION ALL SELECT 'demo-seed-2026-09-job-02', 'no-experience'
  UNION ALL SELECT 'demo-seed-2026-09-job-02', 'no-polish-needed'
  UNION ALL SELECT 'demo-seed-2026-09-job-03', 'english-speaking'
  UNION ALL SELECT 'demo-seed-2026-09-job-03', 'best-paid'
  UNION ALL SELECT 'demo-seed-2026-09-job-03', 'afternoons'
  UNION ALL SELECT 'demo-seed-2026-09-job-04', 'english-speaking'
  UNION ALL SELECT 'demo-seed-2026-09-job-04', 'ukrainian'
  UNION ALL SELECT 'demo-seed-2026-09-job-04', 'hybrid'
  UNION ALL SELECT 'demo-seed-2026-09-job-05', 'student-friendly'
  UNION ALL SELECT 'demo-seed-2026-09-job-05', 'basic-polish'
  UNION ALL SELECT 'demo-seed-2026-09-job-06', 'flexible-hours'
  UNION ALL SELECT 'demo-seed-2026-09-job-06', 'no-polish-needed'
  UNION ALL SELECT 'demo-seed-2026-09-job-06', 'gig'
  UNION ALL SELECT 'demo-seed-2026-09-job-07', 'internship'
  UNION ALL SELECT 'demo-seed-2026-09-job-07', 'react'
  UNION ALL SELECT 'demo-seed-2026-09-job-07', 'english-speaking'
  UNION ALL SELECT 'demo-seed-2026-09-job-08', 'english-speaking'
  UNION ALL SELECT 'demo-seed-2026-09-job-08', 'afternoons'
  UNION ALL SELECT 'demo-seed-2026-09-job-09', 'mornings'
  UNION ALL SELECT 'demo-seed-2026-09-job-09', 'quiet'
  UNION ALL SELECT 'demo-seed-2026-09-job-10', 'no-polish-needed'
  UNION ALL SELECT 'demo-seed-2026-09-job-10', 'evenings'
  UNION ALL SELECT 'demo-seed-2026-09-job-11', 'remote'
  UNION ALL SELECT 'demo-seed-2026-09-job-11', 'flexible-hours'
  UNION ALL SELECT 'demo-seed-2026-09-job-12', 'one-week'
  UNION ALL SELECT 'demo-seed-2026-09-job-12', 'no-experience'
) t ON t.ext = j.external_id
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT jt.job_id FROM job_tags jt
                   JOIN jobs jj ON jj.id = jt.job_id
                  WHERE jj.external_id LIKE 'demo-seed-2026-09-job-%') x
);

-- ════════════════════════════════════════════════════════════════════════════
--  NEWS
-- ════════════════════════════════════════════════════════════════════════════
--
--  One per SECTION in taxonomy.js, so every tab on the news desk has something
--  behind it. The outlet is invented.
--
--  The visas, regulation and pay pieces deliberately refuse to state a figure, a
--  processing time or a rule as fact, and say so in the body. Everything else
--  here is filler nobody can be hurt by; invented immigration guidance is not,
--  and a demo database that later gets pointed at real users should not be
--  carrying a confident wrong answer about somebody''s residence card.

INSERT INTO news_articles (id, publisher_user_id, publisher_profile_id, outlet_name, outlet_logo_url,
                           title, summary, body, category, cover_image_url,
                           status, views_count, created_at, updated_at, published_at, external_id)
SELECT d.id, NULL, NULL, 'Lublin Student Wire',
       'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200&q=80',
       d.title, d.summary, d.body, d.cat, d.cover,
       'PUBLISHED', d.views,
       NOW() - INTERVAL d.age_h HOUR, NOW() - INTERVAL d.age_h HOUR, NOW() - INTERVAL d.age_h HOUR, d.ext
FROM (
  SELECT
    'e0000001-0000-4000-8000-00000000b001' AS id,
    '[DEMO] Night bus to the campuses returns for the winter semester' AS title,
    'Sample article for the demo news desk. A late service linking the centre to the student districts, described here purely to fill the Lublin tab.' AS summary,
    CONCAT(
      'This is sample content on a demo database. It is not reporting and the service ',
      'described does not exist.\n\n',
      'The usual complaint at the start of every winter semester is the same one: the ',
      'evening ends at half past ten because that is when getting home stops being simple. ',
      'A late route connecting the centre with the halls would change what a Tuesday evening ',
      'can be.\n\n',
      'What a route like this is worth\n',
      'Not much on paper — a handful of departures nobody in the city centre would notice. ',
      'To a first-year living twenty-five minutes out who has not yet made the friends whose ',
      'floors you can sleep on, it is most of the difference between going out and not.\n\n',
      'Written to give the Lublin section something to display.'
    ) AS body,
    'lublin' AS cat,
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1600&q=80' AS cover,
    1284 AS views, 5 AS age_h, 'demo-seed-2026-09-news-01' AS ext

  UNION ALL SELECT 'e0000002-0000-4000-8000-00000000b002',
    '[DEMO] The first fortnight: what to sort out before the queues start',
    'Sample article. A start-of-semester checklist — student card, library, transport pass, doctor — written to populate the Student life tab.',
    CONCAT(
      'Sample content on a demo database, not advice.\n\n',
      'Everything administrative in the first two weeks of a semester takes four times as ',
      'long as it does in the third, because everybody is doing it at once. The list itself ',
      'barely changes year to year.\n\n',
      'The order that tends to work\n',
      'Student card first, because half the other things want to see it. Then the transport ',
      'pass, then the library, then registering with a doctor — which almost nobody does ',
      'until they are already ill and the queue is a week long.\n\n',
      'The part people skip\n',
      'Finding out which building your department actually teaches in, before the morning of ',
      'the first lecture. Campuses here are not one site and the walk between two of them is ',
      'not five minutes.\n\n',
      'Filler, written to give this section a card.'
    ),
    'students',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&q=80',
    2106, 11, 'demo-seed-2026-09-news-02'

  UNION ALL SELECT 'e0000003-0000-4000-8000-00000000b003',
    '[DEMO] Before a residence permit appointment: a sample, not a source',
    'Sample article, and deliberately vague. It names no processing time, fee or rule, because inventing those is the one kind of filler that could actually cost somebody.',
    CONCAT(
      'READ THIS FIRST: this is placeholder content on a demo database. It is not guidance ',
      'and nothing in it should be relied on for an immigration matter.\n\n',
      'This article exists so the Visas & residence tab is not empty. It deliberately does ',
      'not tell you how long anything takes, what anything costs, or what documents any ',
      'office wants — every one of those changes, and a confident wrong answer about a ',
      'residence card is worse to a reader than a blank page.\n\n',
      'The only thing worth saying\n',
      'Check the voivodeship office''s own published information, and where the stakes are ',
      'high, a qualified adviser. Not a student app''s demo article, and not a forum post ',
      'from three years ago either.\n\n',
      'When this section carries real material, it should be sourced and dated.'
    ),
    'immigration',
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1600&q=80',
    3471, 20, 'demo-seed-2026-09-news-03'

  UNION ALL SELECT 'e0000004-0000-4000-8000-00000000b004',
    '[DEMO] Halls or a shared flat: how students here actually decide',
    'Sample article weighing dorm places against private rentals — no prices quoted, because inventing a rent figure would misinform the exact person this tab is for.',
    CONCAT(
      'Sample content on a demo database. No real figures appear below, on purpose.\n\n',
      'The decision is rarely about money alone, even though that is how it gets discussed. ',
      'Halls are cheaper and come furnished, with a bed guaranteed before you arrive in the ',
      'country — which matters enormously if you are choosing from abroad and cannot view ',
      'anything.\n\n',
      'What a shared flat buys\n',
      'A kitchen you can actually cook in, quiet when you need it, and a lease that is yours. ',
      'It also wants a deposit up front, a landlord willing to rent to students, and usually ',
      'somebody on the tenancy who speaks Polish.\n\n',
      'The thing nobody mentions\n',
      'Most people who moved out of halls after first year say the reason was noise, not ',
      'money — and most who stayed say the reason was the ten-minute walk to lectures.\n\n',
      'Filler, written to give the Housing section a card.'
    ),
    'housing',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&q=80',
    1893, 29, 'demo-seed-2026-09-news-04'

  UNION ALL SELECT 'e0000005-0000-4000-8000-00000000b005',
    '[DEMO] What an hourly minimum means for part-time work',
    'Sample article on how a minimum hourly rate interacts with student contracts. States no figure — the real one changes, and a stale number here would read as current.',
    CONCAT(
      'Placeholder content on a demo database. It quotes no rate, because a number written ',
      'once and left on a page is wrong within a year and still looks authoritative.\n\n',
      'Poland sets a minimum hourly rate that applies to civil-law contracts as well as ',
      'employment — which is the part that matters on a board like this, since most student ',
      'work is on an umowa zlecenie rather than a contract of employment.\n\n',
      'Why students see a bigger number than they expect\n',
      'Students under 26 on an umowa zlecenie are exempt from ZUS social contributions. Gross ',
      'and net therefore sit much closer together than a friend on a full employment contract ',
      'would lead you to assume. That exemption is real, but it has conditions — status, age, ',
      'contract type — and they are worth confirming for your own situation.\n\n',
      'For the current rate, look it up. Not here.'
    ),
    'poland',
    'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=1600&q=80',
    2755, 38, 'demo-seed-2026-09-news-05'

  UNION ALL SELECT 'e0000006-0000-4000-8000-00000000b006',
    '[DEMO] Scholarship windows open earlier than most people check',
    'Sample article about application deadlines slipping past students who assume they are later than they are. Written to fill the Opportunities tab.',
    CONCAT(
      'Sample content on a demo database. No real scheme or deadline is named.\n\n',
      'The commonest way to miss funding is not being ineligible for it. It is finding out ',
      'about it in November for something that closed in October.\n\n',
      'The pattern\n',
      'Departmental and hardship funds tend to open with the semester and close within weeks, ',
      'while the larger national schemes run on their own calendar entirely. There is rarely ',
      'a single page listing all of them, which is exactly why they get missed.\n\n',
      'Worth doing once\n',
      'Spend an hour in the first fortnight finding the three or four your department, your ',
      'faculty and your university actually run, and put the closing dates in a calendar. It ',
      'is the highest-value hour of admin in the academic year.\n\n',
      'Filler, written so this section has a card.'
    ),
    'opportunity',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1600&q=80',
    1612, 47, 'demo-seed-2026-09-news-06'

  UNION ALL SELECT 'e0000007-0000-4000-8000-00000000b007',
    '[DEMO] Festival week: what the crew do when nobody is watching',
    'Sample article about the week of student festival season, from the side that builds the stage rather than stands in front of it.',
    CONCAT(
      'Sample content on a demo database. The event described is invented.\n\n',
      'Most of the work happens before anybody arrives. Fencing, cabling, the gate layout, ',
      'and the endless moving of crates from where they were left to where they are needed.\n\n',
      'Why it is worth doing once\n',
      'It is the fastest way into a group of people you would not otherwise meet — the crew ',
      'every year is half international and nobody cares what you are studying at four in the ',
      'morning with a stage half built.\n\n',
      'There is also a day rate, which is not nothing.\n\n',
      'Filler, written to give the Events section a card.'
    ),
    'event',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&q=80',
    2298, 56, 'demo-seed-2026-09-news-07'

  UNION ALL SELECT 'e0000008-0000-4000-8000-00000000b008',
    '[DEMO] Zlecenie or dzieło: the difference students get caught by',
    'Sample article on the two civil-law contracts most student work uses. Explains why they differ without stating any rule as current fact.',
    CONCAT(
      'Placeholder content on a demo database, not legal advice.\n\n',
      'Almost every job on a student board is one of two contracts, and they are not ',
      'interchangeable even when the work looks identical.\n\n',
      'Roughly\n',
      'An umowa zlecenie is a contract to perform work — hours, effort, a rate. An umowa o ',
      'dzieło is a contract for a specific result: a translation, a design, a thing that ',
      'either exists at the end or does not. They carry different treatment for ',
      'contributions and tax, which is why an employer sometimes prefers one.\n\n',
      'What to actually do\n',
      'Ask which one you are being offered before you start, and get it in writing. That ',
      'single question is the whole practical point of this article, and it is the only part ',
      'of it that is not filler.\n\n',
      'The specifics change. Confirm them somewhere that is not a demo article.'
    ),
    'regulation',
    'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&q=80',
    3105, 66, 'demo-seed-2026-09-news-08'

  UNION ALL SELECT 'e0000009-0000-4000-8000-00000000b009',
    '[DEMO] The small places that only survive because students work there',
    'Sample article on the cafés, shops and studios around the university district that are staffed almost entirely by people studying nearby.',
    CONCAT(
      'Sample content on a demo database. No real business is named.\n\n',
      'Walk the streets around any campus and most of what is open is running on part-time ',
      'hours worked by people who will have graduated and gone within three years. It is a ',
      'strange, functioning arrangement that neither side treats as temporary while it is ',
      'happening.\n\n',
      'What it means for a student\n',
      'These are the employers most willing to build a rota around a timetable, because they ',
      'have been doing it for years and expect to be doing it again next October.\n\n',
      'Filler, written to give the Business section a card.'
    ),
    'business',
    'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=1600&q=80',
    1447, 78, 'demo-seed-2026-09-news-09'

  UNION ALL SELECT 'e0000010-0000-4000-8000-00000000b010',
    '[DEMO] Free meetups beat another course you will not finish',
    'Sample article arguing that showing up somewhere in person does more for a first junior job than a seventh unfinished online course.',
    CONCAT(
      'Sample content on a demo database.\n\n',
      'The advice given to students who want a first technical job is almost always another ',
      'course. Most people already have four they did not finish.\n\n',
      'What tends to work better\n',
      'Turning up somewhere in person, monthly, and eventually giving a ten-minute talk about ',
      'something small you built. Nobody in the room minds that it is small. A surprising ',
      'share of first jobs come out of that room rather than out of an application form.\n\n',
      'It also fixes the thing a course cannot: being able to talk about your own work to ',
      'somebody who does it professionally, without freezing.\n\n',
      'Filler, written to give the Tech section a card.'
    ),
    'tech',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1600&q=80',
    1974, 90, 'demo-seed-2026-09-news-10'
) d
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT external_id FROM news_articles) n
   WHERE n.external_id LIKE 'demo-seed-2026-09-news-%'
);

INSERT INTO news_tags (article_id, tag)
SELECT a.id, t.tag
FROM (SELECT id, external_id FROM news_articles WHERE external_id LIKE 'demo-seed-2026-09-news-%') a
JOIN (
            SELECT 'demo-seed-2026-09-news-01' AS ext, 'lublin' AS tag
  UNION ALL SELECT 'demo-seed-2026-09-news-01', 'transport'
  UNION ALL SELECT 'demo-seed-2026-09-news-02', 'students'
  UNION ALL SELECT 'demo-seed-2026-09-news-02', 'semester-start'
  UNION ALL SELECT 'demo-seed-2026-09-news-03', 'visas'
  UNION ALL SELECT 'demo-seed-2026-09-news-03', 'international'
  UNION ALL SELECT 'demo-seed-2026-09-news-04', 'housing'
  UNION ALL SELECT 'demo-seed-2026-09-news-04', 'lublin'
  UNION ALL SELECT 'demo-seed-2026-09-news-05', 'pay'
  UNION ALL SELECT 'demo-seed-2026-09-news-05', 'work'
  UNION ALL SELECT 'demo-seed-2026-09-news-06', 'scholarships'
  UNION ALL SELECT 'demo-seed-2026-09-news-07', 'events'
  UNION ALL SELECT 'demo-seed-2026-09-news-07', 'lublin'
  UNION ALL SELECT 'demo-seed-2026-09-news-08', 'contracts'
  UNION ALL SELECT 'demo-seed-2026-09-news-08', 'work'
  UNION ALL SELECT 'demo-seed-2026-09-news-09', 'business'
  UNION ALL SELECT 'demo-seed-2026-09-news-10', 'tech'
  UNION ALL SELECT 'demo-seed-2026-09-news-10', 'careers'
) t ON t.ext = a.external_id
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT nt.article_id FROM news_tags nt
                   JOIN news_articles na ON na.id = nt.article_id
                  WHERE na.external_id LIKE 'demo-seed-2026-09-news-%') x
);

-- ── Check ───────────────────────────────────────────────────────────────────
--   SELECT COUNT(*) FROM jobs          WHERE external_id LIKE 'demo-seed-2026-09-job-%';   -- 12
--   SELECT COUNT(*) FROM news_articles WHERE external_id LIKE 'demo-seed-2026-09-news-%';  -- 10
--   SELECT category, COUNT(*) FROM jobs WHERE external_id LIKE 'demo-seed-2026-09-job-%'  GROUP BY category;
--   SELECT category, COUNT(*) FROM news_articles WHERE external_id LIKE 'demo-seed-2026-09-news-%' GROUP BY category;
