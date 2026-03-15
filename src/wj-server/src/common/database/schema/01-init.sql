-- ============================================================================
-- congdongvang.com Database Initialization
-- ============================================================================
-- This script initializes the congdongvang.com database with proper character set
-- and collation for full Unicode support.
-- ============================================================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS wealthjourney
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Use the database
USE wealthjourney;

-- ============================================================================
-- Database Configuration
-- ============================================================================

-- Set timezone to UTC for consistent timestamp handling
SET time_zone = '+00:00';

-- Set strict SQL mode for better data integrity
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
