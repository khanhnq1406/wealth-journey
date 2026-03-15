-- ============================================================================
-- congdongvang.com Users Table
-- ============================================================================
-- This table stores user account information including OAuth data
-- Aligned with API Communication Guide improvements
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS user;

-- Create users table
CREATE TABLE user (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Authentication Fields
  email VARCHAR(255) NOT NULL,

  -- Profile Information
  name VARCHAR(255),
  picture VARCHAR(500),

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT user_pk PRIMARY KEY (id),
  CONSTRAINT user_email_unique UNIQUE (email),

  -- Indexes for performance
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE user COMMENT = 'User accounts table storing authentication and profile information';

-- ============================================================================
-- Sample Data (Optional - Comment out for production)
-- ============================================================================

-- INSERT INTO user (email, name, picture) VALUES
-- ('test@example.com', 'Test User', 'https://example.com/avatar.jpg');
