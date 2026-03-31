-- Add banner URL to users
ALTER TABLE users ADD COLUMN shop_banner_url VARCHAR(255);

-- Add linked listing ID to posts
ALTER TABLE posts ADD COLUMN linked_listing_id VARCHAR(50);
