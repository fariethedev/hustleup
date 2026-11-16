CREATE TABLE IF NOT EXISTS story_comments (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  content VARCHAR(300) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_story_comments_story (story_id, created_at)
);
