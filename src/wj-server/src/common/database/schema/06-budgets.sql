-- ============================================================================
-- congdongvang.com Budgets Table
-- ============================================================================
-- This table stores budget plans for expense tracking
-- Aligned with API Communication Guide improvements
-- Based on: design/system_design.drawio
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS budget;

-- Create budgets table
CREATE TABLE budget (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Foreign Key to user
  user_id INT UNSIGNED NOT NULL,

  -- Budget name
  name VARCHAR(100) NOT NULL,

  -- Total budget amount
  total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT budget_pk PRIMARY KEY (id),
  CONSTRAINT budget_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT budget_total_check CHECK (total >= 0),

  -- Indexes for performance
  INDEX idx_user_id (user_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE budget COMMENT = 'Budget plans for expense tracking';
