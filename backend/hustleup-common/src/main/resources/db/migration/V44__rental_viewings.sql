-- Viewing appointments for RENTAL listings. A room is not bought or haggled over from the
-- listing page: a would-be tenant books a time to see it, and the agent and other viewers
-- can see that the place has interest. One active viewing per person per listing.
CREATE TABLE IF NOT EXISTS rental_viewings (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  listing_id    VARCHAR(36)  NOT NULL,
  seller_id     VARCHAR(36)  NOT NULL,
  viewer_id     VARCHAR(36)  NOT NULL,
  scheduled_at  DATETIME(6)  NOT NULL,
  note          VARCHAR(500) NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'BOOKED' COMMENT 'BOOKED | CANCELLED',
  created_at    DATETIME(6)  NOT NULL,
  updated_at    DATETIME(6)  NOT NULL,
  KEY idx_rental_viewings_listing (listing_id, status, scheduled_at),
  KEY idx_rental_viewings_viewer (viewer_id, status)
);
