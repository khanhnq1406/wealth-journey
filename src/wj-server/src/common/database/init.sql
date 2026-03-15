-- ============================================================================
-- congdongvang.com Database Initialization Script
-- ============================================================================
-- This script sets up the complete database schema for the congdongvang.com
-- Personal Financial Management application.
--
-- Version: 2.0.0
-- Last Updated: 2024
-- Aligned with: API Communication Guide improvements
-- Based on: design/system_design.drawio
-- ============================================================================

-- ============================================================================
-- 1. Database Initialization
-- ============================================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS wealthjourney
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Use the database
USE wealthjourney;

-- Set timezone to UTC
SET time_zone = '+00:00';

-- ============================================================================
-- 2. Users Table
-- ============================================================================

DROP TABLE IF EXISTS user;

CREATE TABLE user (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  picture VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT user_pk PRIMARY KEY (id),
  CONSTRAINT user_email_unique UNIQUE (email),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'User accounts table storing authentication and profile information';

-- ============================================================================
-- 3. Wallets Table
-- ============================================================================

DROP TABLE IF EXISTS wallet;

CREATE TABLE wallet (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  wallet_name VARCHAR(100) NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  icon VARCHAR(50),
  type VARCHAR(20) COMMENT 'Basic or Investment',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT wallet_pk PRIMARY KEY (id),
  CONSTRAINT wallet_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT wallet_balance_check CHECK (balance >= 0),
  CONSTRAINT wallet_name_not_empty CHECK (wallet_name != ''),
  CONSTRAINT wallet_type_valid CHECK (type IN ('Basic', 'Investment', NULL)),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'User wallets for storing balance information';

-- ============================================================================
-- 4. Categories Table
-- ============================================================================

DROP TABLE IF EXISTS category;

CREATE TABLE category (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(10) NOT NULL COMMENT 'Income or Expense',
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT category_pk PRIMARY KEY (id),
  CONSTRAINT category_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT category_type_valid CHECK (type IN ('Income', 'Expense')),
  INDEX idx_user_id (user_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Transaction categories for income and expenses';

-- ============================================================================
-- 5. Transactions Table
-- ============================================================================

DROP TABLE IF EXISTS transaction;

CREATE TABLE transaction (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  wallet_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED,
  amount DECIMAL(15, 2) NOT NULL,
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT transaction_pk PRIMARY KEY (id),
  CONSTRAINT transaction_fk_wallet FOREIGN KEY (wallet_id)
    REFERENCES wallet(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT transaction_fk_category FOREIGN KEY (category_id)
    REFERENCES category(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  INDEX idx_wallet_id (wallet_id),
  INDEX idx_category_id (category_id),
  INDEX idx_date (date),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Financial transactions linked to user wallets and categories';

-- ============================================================================
-- 6. Budgets Table
-- ============================================================================

DROP TABLE IF EXISTS budget;

CREATE TABLE budget (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT budget_pk PRIMARY KEY (id),
  CONSTRAINT budget_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT budget_total_check CHECK (total >= 0),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Budget plans for expense tracking';

-- ============================================================================
-- 7. List Budgets Table
-- ============================================================================

DROP TABLE IF EXISTS list_budget;

CREATE TABLE list_budget (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  budget_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  total DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT list_budget_pk PRIMARY KEY (id),
  CONSTRAINT list_budget_fk_budget FOREIGN KEY (budget_id)
    REFERENCES budget(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT list_budget_total_check CHECK (total >= 0),
  INDEX idx_budget_id (budget_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Budget items for detailed expense tracking';

-- ============================================================================
-- 8. Sessions Table
-- ============================================================================

DROP TABLE IF EXISTS session;

CREATE TABLE session (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(500) NOT NULL,
  refresh_token VARCHAR(500),
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT session_pk PRIMARY KEY (id),
  CONSTRAINT session_fk_user FOREIGN KEY (user_id)
    REFERENCES user(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT session_token_unique UNIQUE (token (255)),
  INDEX idx_user_id (user_id),
  INDEX idx_token (token (255)),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'User sessions for authentication (fallback for Redis)';

-- ============================================================================
-- 9. Sample Data (Optional - Remove for production)
-- ============================================================================

-- Uncomment below for sample data
-- INSERT INTO user (email, name, picture) VALUES
-- ('test@example.com', 'Test User', 'https://example.com/avatar.jpg');
--
-- INSERT INTO wallet (user_id, wallet_name, balance, type) VALUES
-- (1, 'Main Wallet', 1000.00, 'Basic'),
-- (1, 'Investment', 5000.00, 'Investment');
--
-- INSERT INTO category (user_id, type, name) VALUES
-- (1, 'Expense', 'Food'),
-- (1, 'Expense', 'Transport'),
-- (1, 'Income', 'Salary');
--
-- INSERT INTO transaction (wallet_id, category_id, amount, date, note) VALUES
-- (1, 1, 50.00, '2024-01-01 12:00:00', 'Lunch'),
-- (1, 3, 3000.00, '2024-01-01 09:00:00', 'Monthly salary');

-- ============================================================================
-- Database Setup Complete
-- ============================================================================
