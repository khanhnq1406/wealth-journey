-- ============================================================================
-- congdongvang.com Sessions Table
-- ============================================================================
-- This table stores user session information for authentication
-- Aligned with API Communication Guide improvements
-- Supports Redis-backed session management
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS session;

-- Create sessions table (fallback/backup for Redis)
CREATE TABLE session (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Foreign Key to user
  user_id INT UNSIGNED NOT NULL,

  -- Session Information
  token VARCHAR(500) NOT NULL,
  refresh_token VARCHAR(500),

  -- Session metadata
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),

  -- Expiration
  expires_at TIMESTAMP NOT NULL,

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT session_pk PRIMARY KEY (id),
  CONSTRAINT session_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT session_token_unique UNIQUE (token (255)),

  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_token (token (255)),
  INDEX idx_expires_at (expires_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE session COMMENT = 'User sessions for authentication (fallback for Redis)';
