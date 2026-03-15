-- ============================================================================
-- congdongvang.com Categories Table
-- ============================================================================
-- This table stores transaction categories (Income/Expense)
-- Aligned with API Communication Guide improvements
-- Based on: design/system_design.drawio
-- ============================================================================

USE wealthjourney;

-- Drop table if exists (for clean recreation)
DROP TABLE IF EXISTS category;

-- Create categories table
CREATE TABLE category (
  -- Primary Key
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Foreign Key to user
  user_id INT UNSIGNED NOT NULL,

  -- Category type: Income or Expense
  type VARCHAR(10) NOT NULL COMMENT 'Income or Expense',

  -- Category name
  name VARCHAR(100) NOT NULL,

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT category_pk PRIMARY KEY (id),
  CONSTRAINT category_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT category_type_valid CHECK (type IN ('Income', 'Expense')),

  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_type (type)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

ALTER TABLE category COMMENT = 'Transaction categories for income and expenses';

-- ============================================================================
-- Sample Data (Optional - Comment out for production)
-- ============================================================================

-- INSERT INTO category (user_id, type, name) VALUES
-- (1, 'Expense', 'Food'),
-- (1, 'Expense', 'Transport'),
-- (1, 'Income', 'Salary');
