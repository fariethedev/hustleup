-- MySQL 8: guard additions for databases previously managed with ddl-auto.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_products' AND COLUMN_NAME = 'stock_quantity');
SET @s := IF(@c = 0, 'ALTER TABLE shop_products ADD COLUMN stock_quantity INT NULL', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'stock_reserved');
SET @s := IF(@c = 0, 'ALTER TABLE shop_orders ADD COLUMN stock_reserved BOOLEAN NOT NULL DEFAULT FALSE', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_products' AND CONSTRAINT_NAME = 'shop_product_stock_nonnegative');
SET @s := IF(@c = 0, 'ALTER TABLE shop_products ADD CONSTRAINT shop_product_stock_nonnegative CHECK (stock_quantity IS NULL OR stock_quantity >= 0)', 'SELECT 1');
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
