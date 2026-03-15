-- ============================================================================
-- congdongvang.com Wallets Table
-- ============================================================================
-- This table stores user wallet information
-- Aligned with API Communication Guide improvements
-- Based on: design/system_design.drawio
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS wallet;

-- Create wallets table
CREATE TABLE wallet (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Foreign Key to user
  user_id INT UNSIGNED NOT NULL,

  -- Wallet Information
  wallet_name VARCHAR(100) NOT NULL,

  -- Balance stored as DECIMAL for precise financial calculations
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

  -- Wallet icon (optional)
  icon VARCHAR(50),

  -- Wallet type: Basic or Investment
  type VARCHAR(20) COMMENT 'Basic or Investment',

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT wallet_pk PRIMARY KEY (id),
  CONSTRAINT wallet_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Check constraints for data integrity
  CONSTRAINT wallet_balance_check CHECK (balance >= 0),
  CONSTRAINT wallet_name_not_empty CHECK (wallet_name != ''),
  CONSTRAINT wallet_type_valid CHECK (type IN ('Basic', 'Investment', NULL)),

  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE wallet COMMENT = 'User wallets for storing balance information';

-- ============================================================================
-- Sample Data (Optional - Comment out for production)
-- ============================================================================

-- INSERT INTO wallet (user_id, wallet_name, balance, type) VALUES
-- (1, 'Main Wallet', 1000.00, 'Basic'),
-- (1, 'Investment', 5000.00, 'Investment');
