-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE UPDATE SCRIPT
-- Purpose: Schema & Table Update for "Payroll Ledger" (Submit PCU Settlements & Base Rates)
-- Compatible with: cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Execution: Run in cPanel > phpMyAdmin > SQL Tab OR via MySQL CLI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -----------------------------------------------------------------------------
-- 1. Create or Verify `pcu_settlements` Table for Payroll Ledger
-- Stores permanent settlement payouts, verified/pending credits, and disbursement details
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pcu_settlements` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `submitter` VARCHAR(255) NOT NULL,
  `total_submissions` INT DEFAULT 0,
  `verified_count` INT DEFAULT 0,
  `pending_count` INT DEFAULT 0,
  `base_rate` DECIMAL(10,2) DEFAULT 0.00,
  `pending_base_rate` DECIMAL(10,2) DEFAULT 0.00,
  `total_salary` DECIMAL(12,2) DEFAULT 0.00,
  `amount_paid` DECIMAL(12,2) DEFAULT 0.00,
  `payment_status` VARCHAR(50) DEFAULT 'SETTLED',
  `payment_method` VARCHAR(100) DEFAULT 'CASH',
  `reference_notes` TEXT,
  `settled_by` VARCHAR(100) DEFAULT 'Master Admin',
  `settled_at` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_settle_submitter` (`submitter`),
  INDEX `idx_settle_status` (`payment_status`),
  INDEX `idx_settle_at` (`settled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Add Columns to Existing `pcu_settlements` Table if Missing
-- (Safe idempotent execution across MySQL 5.7, 8.0, and MariaDB)
-- -----------------------------------------------------------------------------
SET @dbname = DATABASE();
SET @tablename = "pcu_settlements";

-- 2a. Add `verified_count`
SET @columnname = "verified_count";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_settlements` ADD COLUMN `verified_count` INT DEFAULT 0 AFTER `total_submissions`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2b. Add `pending_count`
SET @columnname = "pending_count";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_settlements` ADD COLUMN `pending_count` INT DEFAULT 0 AFTER `verified_count`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2c. Add `pending_base_rate`
SET @columnname = "pending_base_rate";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE `pcu_settlements` ADD COLUMN `pending_base_rate` DECIMAL(10,2) DEFAULT 0.00 AFTER `base_rate`;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- -----------------------------------------------------------------------------
-- 3. Ensure `site_settings` Table Exists & Stores Base Rates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` LONGTEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default base rates if not already set
INSERT INTO `site_settings` (`setting_key`, `setting_value`)
VALUES ('pcu_base_rate', '50.00')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

INSERT INTO `site_settings` (`setting_key`, `setting_value`)
VALUES ('pcu_pending_base_rate', '25.00')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- -----------------------------------------------------------------------------
-- 4. Verification Check
-- -----------------------------------------------------------------------------
SELECT 'Payroll Ledger cPanel MySQL database update completed successfully!' AS `status_message`;
DESCRIBE `pcu_settlements`;
