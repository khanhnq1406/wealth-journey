-- ============================================================================
-- congdongvang.com Transactions Table
-- ============================================================================
-- This table stores financial transaction records
-- Aligned with API Communication Guide improvements
-- Based on: design/system_design.drawio
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS transaction;

-- Create transactions table
CREATE TABLE transaction (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Foreign Keys
  wallet_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED,

  -- Transaction Details
  amount DECIMAL(15, 2) NOT NULL,

  -- Transaction date (can be different from created_at for back-dating)
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Transaction note/description
  note TEXT,

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT transaction_pk PRIMARY KEY (id),
  CONSTRAINT transaction_fk_wallet FOREIGN KEY (wallet_id)
    REFERENCES wallet(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT transaction_fk_category FOREIGN KEY (category_id)
    REFERENCES category(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  -- Indexes for performance
  INDEX idx_wallet_id (wallet_id),
  INDEX idx_category_id (category_id),
  INDEX idx_date (date),
  INDEX idx_created_at (created_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE transaction COMMENT = 'Financial transactions linked to user wallets and categories';

-- ============================================================================
-- Sample Data (Optional - Comment out for production)
-- ============================================================================

-- INSERT INTO transaction (wallet_id, category_id, amount, date, note) VALUES
-- (1, 1, 50.00, '2024-01-01 12:00:00', 'Lunch'),
-- (1, 3, 3000.00, '2024-01-01 09:00:00', 'Monthly salary');
