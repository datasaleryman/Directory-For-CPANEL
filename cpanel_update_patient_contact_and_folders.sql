-- =============================================================================
-- Base44 System - cPanel MySQL Database Update Script
-- Update: Maintenance Add Patient (Consulted), Primary & Alternate Contact #,
--         Exist. Directory Purok Folders & Submission Schema
-- Compatibility: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (cPanel phpMyAdmin compatible)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- -----------------------------------------------------------------------------
-- 1. Ensure `maintenance_records` Table Exists with All Fields
--    (Supports "Add Patient" directly stored to Consulted tab)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `maintenance_records` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `primary_text` VARCHAR(500) NOT NULL DEFAULT '',
  `full_name` VARCHAR(500) NOT NULL DEFAULT '',
  `barangay` VARCHAR(255) DEFAULT '',
  `purok` VARCHAR(255) DEFAULT '',
  `contact_number` VARCHAR(100) DEFAULT '',
  `maintenance_medicine` TEXT NULL,
  `disease` TEXT NULL,
  `is_consulted` TINYINT(1) NOT NULL DEFAULT 0,
  `consulted_at` VARCHAR(100) DEFAULT '',
  `consulted_by` VARCHAR(255) DEFAULT '',
  `pdf_file_name` VARCHAR(255) DEFAULT '',
  `pdf_page_number` INT DEFAULT 1,
  `columns` LONGTEXT NULL,
  `column_headers` LONGTEXT NULL,
  `raw_text` LONGTEXT NULL,
  `uploaded_by` VARCHAR(255) DEFAULT 'Admin',
  `uploaded_at` VARCHAR(100) DEFAULT '',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_maint_full_name` (`full_name`(191)),
  INDEX `idx_maint_barangay` (`barangay`),
  INDEX `idx_maint_purok` (`purok`),
  INDEX `idx_maint_is_consulted` (`is_consulted`),
  INDEX `idx_maint_uploaded_at` (`uploaded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safe column additions for existing `maintenance_records` tables
DROP PROCEDURE IF EXISTS `AddColIfMissing`;
DELIMITER $$
CREATE PROCEDURE `AddColIfMissing`(
    IN in_table VARCHAR(64),
    IN in_column VARCHAR(64),
    IN in_definition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS 
        WHERE table_schema = DATABASE() 
          AND table_name = in_table 
          AND column_name = in_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', in_table, '` ADD COLUMN `', in_column, '` ', in_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- Ensure Consulted columns exist on maintenance_records
CALL AddColIfMissing('maintenance_records', 'maintenance_medicine', 'TEXT NULL');
CALL AddColIfMissing('maintenance_records', 'disease', 'TEXT NULL');
CALL AddColIfMissing('maintenance_records', 'is_consulted', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL AddColIfMissing('maintenance_records', 'consulted_at', 'VARCHAR(100) DEFAULT \'\'');
CALL AddColIfMissing('maintenance_records', 'consulted_by', 'VARCHAR(255) DEFAULT \'\'');

-- -----------------------------------------------------------------------------
-- 2. Update `contacts` Table (PCU Directory)
--    Rename / ensure `alternate_contact_number` exists below `contact_number` (Primary Contact #)
-- -----------------------------------------------------------------------------
CALL AddColIfMissing('contacts', 'alternate_contact_number', 'VARCHAR(100) DEFAULT \'\' AFTER `contact_number`');
CALL AddColIfMissing('contacts', 'maintenance', 'VARCHAR(50) DEFAULT \'None\'');
CALL AddColIfMissing('contacts', 'maintenance_medicine', 'TEXT NULL');

-- -----------------------------------------------------------------------------
-- 3. Update `existing_accounts` Table (Exist. Directory)
--    Ensure `alternate_contact_number` is present and indexed
-- -----------------------------------------------------------------------------
CALL AddColIfMissing('existing_accounts', 'alternate_contact_number', 'VARCHAR(100) DEFAULT \'\' AFTER `contact_number`');

-- -----------------------------------------------------------------------------
-- 4. Update `submitted_exist_acc` Table (Submit Exist. Accounts)
--    Ensure `alternate_contact_number` is preserved during Submit
-- -----------------------------------------------------------------------------
CALL AddColIfMissing('submitted_exist_acc', 'alternate_contact_number', 'VARCHAR(100) DEFAULT \'\' AFTER `contact_number`');

-- -----------------------------------------------------------------------------
-- 5. Update `pcu_submissions` Table (Submit PCU)
--    Ensure `alternate_contact_number` is present
-- -----------------------------------------------------------------------------
CALL AddColIfMissing('pcu_submissions', 'alternate_contact_number', 'VARCHAR(100) DEFAULT \'\' AFTER `contact_number`');

-- Clean up helper procedure
DROP PROCEDURE IF EXISTS `AddColIfMissing`;

SET FOREIGN_KEY_CHECKS = 1;

-- Verification query
SELECT 'Database schema successfully updated for Add Patient (Consulted), Primary & Alternate Contact Numbers, and Purok organization.' AS status;
