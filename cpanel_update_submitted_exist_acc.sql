-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE UPDATE SCRIPT
-- Purpose: Schema Update for "Submitted Exist. Acc." Page, Barangay Folders & Ledger
-- Compatible with: cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Execution: Run in cPanel > phpMyAdmin > SQL Tab OR via MySQL CLI
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -----------------------------------------------------------------------------
-- 1. Create `submitted_exist_acc` Table for Submitted Existing Accounts
-- Stores Patient Data, Geotag Telemetry, Multi-File Attachments, and Status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `exist_account_id` VARCHAR(100) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) NOT NULL DEFAULT 'General / Unassigned',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `pin` VARCHAR(100) DEFAULT '',
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `geotagged` TINYINT(1) DEFAULT 0,
  `facebook_link` VARCHAR(255) DEFAULT '',
  `uploaded_files` LONGTEXT NULL,
  `files_count` INT DEFAULT 0,
  `uploaded_by` VARCHAR(255) DEFAULT 'Admin',
  `uploaded_at` VARCHAR(100) DEFAULT '',
  `status` VARCHAR(50) DEFAULT 'FILES',
  `verified_at` VARCHAR(100) NULL,
  `verified_by` VARCHAR(255) NULL,
  `pending_at` VARCHAR(100) NULL,
  `pending_by` VARCHAR(255) NULL,
  `updated_status_at` VARCHAR(100) NULL,
  `updated_status_by` VARCHAR(255) NULL,
  `verified_credit_added` TINYINT(1) DEFAULT 0,
  `pending_credit_added` TINYINT(1) DEFAULT 0,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sea_barangay` (`barangay`),
  INDEX `idx_sea_full_name` (`full_name`),
  INDEX `idx_sea_status` (`status`),
  INDEX `idx_sea_uploaded_by` (`uploaded_by`),
  INDEX `idx_sea_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Create `submitted_exist_acc_settlements` Table for Payroll Ledger Settlements
-- Tracks payment records, total submissions, base rate, and payment receipts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc_settlements` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `submitter` VARCHAR(255) NOT NULL,
  `total_submissions` INT DEFAULT 0,
  `base_rate` DECIMAL(10,2) DEFAULT 0.00,
  `total_salary` DECIMAL(12,2) DEFAULT 0.00,
  `amount_paid` DECIMAL(12,2) DEFAULT 0.00,
  `payment_status` VARCHAR(50) DEFAULT 'SETTLED',
  `payment_method` VARCHAR(100) DEFAULT 'CASH',
  `reference_notes` TEXT,
  `settled_by` VARCHAR(100) DEFAULT 'Master Admin',
  `settled_at` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sea_settle_submitter` (`submitter`),
  INDEX `idx_sea_settle_status` (`payment_status`),
  INDEX `idx_sea_settle_at` (`settled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Create `submitted_exist_acc_history` Table for Audit Trail & Action History
-- Logs verify, pending, return-to-files, file removal, and settlement events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `submitted_exist_acc_history` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `action` VARCHAR(100) NOT NULL,
  `record_id` VARCHAR(100) DEFAULT '',
  `patient_name` VARCHAR(255) NOT NULL,
  `barangay` VARCHAR(255) DEFAULT '',
  `submitter` VARCHAR(255) DEFAULT '',
  `performed_by` VARCHAR(255) NOT NULL,
  `previous_status` VARCHAR(100) DEFAULT '',
  `new_status` VARCHAR(100) DEFAULT '',
  `timestamp` VARCHAR(100) NOT NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sea_hist_time` (`timestamp`),
  INDEX `idx_sea_hist_patient` (`patient_name`),
  INDEX `idx_sea_hist_action` (`action`),
  INDEX `idx_sea_hist_submitter` (`submitter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- End of Migration Script for Submitted Exist. Acc.
-- =============================================================================
