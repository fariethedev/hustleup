-- Single shifts people need covered (restaurant evenings, warehouse nights) live on the
-- job board next to vacancies; these two columns hold when the shift runs.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='jobs' AND COLUMN_NAME='shift_starts_at');
SET @s := IF(@c=0, 'ALTER TABLE jobs ADD COLUMN shift_starts_at DATETIME(6) NULL, ADD COLUMN shift_ends_at DATETIME(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
