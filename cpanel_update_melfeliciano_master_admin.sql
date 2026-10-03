-- =============================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL USER PRIVILEGES UPDATE
-- Purpose: Elevate account "melfeliciano85@gmail.com" (melfeliciano85) to
--          MASTER ADMIN with unrestricted access to all pages, sections, and actions.
-- =============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+08:00"; -- Asia/Manila (UTC+8)

-- 1. Update role and status to MASTER ADMIN & Active
UPDATE `users`
SET 
  `role` = 'MASTER ADMIN',
  `status` = 'Active',
  `permissions` = '["dashboard","inbox","map","directory","submit-pcu","returned","exist-acc-files","submitted-exist-acc","accounts","bulk","print","existing-account","verification-entry","settings"]',
  `updated_at` = NOW()
WHERE LOWER(TRIM(`email`)) = 'melfeliciano85@gmail.com'
   OR LOWER(TRIM(`username`)) = 'melfeliciano85';

-- 2. Verification Check: View the updated account details
SELECT `username`, `full_name`, `email`, `role`, `status`, `permissions`
FROM `users`
WHERE LOWER(TRIM(`email`)) = 'melfeliciano85@gmail.com'
   OR LOWER(TRIM(`username`)) = 'melfeliciano85';
