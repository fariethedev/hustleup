-- Restore for the legacy premium revocation of 2026-08-28.
-- These ten subscriptions were granted by the old POST /subscriptions/upgrade endpoint,
-- which set VERIFIED for a month with no payment. Run any line to put one account back.

UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-08-29 09:19:24.966478' WHERE id='0bc36ea5-8b4a-41ca-bc35-847489ab5398';  -- kiekie@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-09-13 17:11:58.570052' WHERE id='1450717e-7d6a-4b2f-9f09-eab4437d046e';  -- spiderman@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-08-28 18:02:51.753792' WHERE id='7359d934-fae5-4890-b6d6-6b849dc91563';  -- faraimahaso8@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-08-29 08:57:43.964888' WHERE id='7c82eae7-47a1-461e-9a72-753fdbcda75e';  -- hortexrim@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-09-26 07:05:25.290546' WHERE id='a230a4b9-8f26-4635-bf18-ee2bf7ecc15c';  -- anesvox@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-09-12 16:14:40.305577' WHERE id='c23579d9-cb43-4f62-be6d-0492b636b825';  -- indianajud@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-08-28 18:14:38.384219' WHERE id='d70a5445-63b8-40ee-ad5c-298ca0a206af';  -- hortex@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-09-26 06:58:24.510709' WHERE id='e156a525-41ef-4549-819f-86dacdc526bd';  -- FARAI05MAHA@GMAIL.COM
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-09-22 09:05:07.551560' WHERE id='e28a4bba-ae1c-4003-95b8-b76af7802dea';  -- takudzwagombiro@gmail.com
UPDATE subscriptions SET plan='VERIFIED', status='ACTIVE', expires_at='2026-09-05 11:56:04.799759' WHERE id='e4f60a58-0fcb-4a9f-9e65-ff0289b9a49f';  -- tijjani@gmail.com
