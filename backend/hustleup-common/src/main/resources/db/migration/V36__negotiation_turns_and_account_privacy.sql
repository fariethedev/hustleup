ALTER TABLE bookings ADD COLUMN last_offer_by uuid;
ALTER TABLE bookings ADD COLUMN negotiation_history jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN private_account boolean NOT NULL DEFAULT false;
CREATE TABLE follow_requests (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE TABLE message_email_gates (
  recipient_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  PRIMARY KEY (recipient_id, sender_id)
);
