-- Text stories keep the gradient their author picked ("#RRGGBB,#RRGGBB").
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stories' AND COLUMN_NAME='background');
SET @s := IF(@c=0, 'ALTER TABLE stories ADD COLUMN background VARCHAR(32) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
