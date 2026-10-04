ALTER TABLE shops ADD COLUMN highlights jsonb NOT NULL DEFAULT '[]'::jsonb;
