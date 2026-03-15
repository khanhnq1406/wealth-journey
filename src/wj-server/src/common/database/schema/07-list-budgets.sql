-- ============================================================================
-- congdongvang.com List Budgets Table
-- ============================================================================
-- This table stores budget items for detailed expense tracking
-- Aligned with API Communication Guide improvements
-- Based on: design/system_design.drawio
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS list_budget;

-- Create list budgets table
CREATE TABLE list_budget (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Foreign Key to budget
  budget_id INT UNSIGNED NOT NULL,

  -- Budget item name
  name VARCHAR(100) NOT NULL,

  -- Budget item total
  total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT list_budget_pk PRIMARY KEY (id),
  CONSTRAINT list_budget_fk_budget FOREIGN KEY (budget_id)
    REFERENCES budget(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT list_budget_total_check CHECK (total >= 0),

  -- Indexes for performance
  INDEX idx_budget_id (budget_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE list_budget COMMENT = 'Budget items for detailed expense tracking';
