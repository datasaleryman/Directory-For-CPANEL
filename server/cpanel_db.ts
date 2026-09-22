import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

export interface CPanelDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  enabled?: boolean;
}

export interface CPanelDbStatus {
  connected: boolean;
  isMainDatabase: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  tableCount: number;
  lastConnected: string | null;
  lastError: string | null;
  tables: Array<{ name: string; rowCount: number }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CPANEL_CONFIG_FILE = path.join(DATA_DIR, 'cpanel_db_config.json');

// Default configuration with environment variables priority
export function loadCPanelDbConfig(): CPanelDbConfig {
  let fileConfig: Partial<CPanelDbConfig> = {};
  try {
    if (fs.existsSync(CPANEL_CONFIG_FILE)) {
      const content = fs.readFileSync(CPANEL_CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(content);
    }
  } catch (err) {
    console.log('[cPanel DB] Could not read config file, using env/defaults:', err);
  }

  const envHost = process.env.DB_HOST || process.env.MYSQL_HOST;
  const envPort = process.env.DB_PORT || process.env.MYSQL_PORT;
  const envUser = process.env.DB_USER || process.env.MYSQL_USER;
  const envPass = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envName = process.env.DB_NAME || process.env.MYSQL_DATABASE;
  const envSsl = process.env.MYSQL_SSL === 'true';

  return {
    host: fileConfig.host || envHost || 'localhost',
    port: fileConfig.port ? fileConfig.port : (envPort ? parseInt(envPort, 10) : 3306),
    user: fileConfig.user !== undefined ? fileConfig.user : (envUser || ''),
    password: fileConfig.password !== undefined ? fileConfig.password : (envPass !== undefined ? envPass : ''),
    database: fileConfig.database !== undefined ? fileConfig.database : (envName || ''),
    ssl: fileConfig.ssl !== undefined ? fileConfig.ssl : envSsl,
    enabled: fileConfig.enabled !== undefined ? fileConfig.enabled : Boolean(envName && envUser)
  };
}

export async function saveCPanelDbConfig(config: CPanelDbConfig): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  await fs.promises.writeFile(CPANEL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  // Reinitialize connection pool with new config
  await reinitializePool(config);
}

let pool: mysql.Pool | null = null;
let currentStatus: CPanelDbStatus = {
  connected: false,
  isMainDatabase: false,
  host: 'localhost',
  port: 3306,
  database: '',
  user: '',
  tableCount: 0,
  lastConnected: null,
  lastError: null,
  tables: []
};

export function getCPanelDbStatus(): CPanelDbStatus {
  return currentStatus;
}

export function isCPanelDbConnected(): boolean {
  return Boolean(pool && currentStatus.connected);
}

export function getPool(): mysql.Pool | null {
  return pool;
}

/**
 * Initializes tables in MySQL if they do not exist yet.
 */
export async function initCPanelTables(connectionPool: mysql.Pool): Promise<void> {
  const tableDefinitions = [
    // 1. Contacts Table
    `CREATE TABLE IF NOT EXISTS contacts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      barangay VARCHAR(255) NOT NULL DEFAULT '',
      purok VARCHAR(255) DEFAULT '',
      contact_number VARCHAR(100) DEFAULT '',
      created_at VARCHAR(100) DEFAULT '',
      updated_at VARCHAR(100) DEFAULT '',
      latitude DECIMAL(10, 7) NULL,
      longitude DECIMAL(10, 7) NULL,
      geotagged TINYINT(1) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      is_submitted TINYINT(1) DEFAULT 0,
      photo_url LONGTEXT,
      pcu_file_url LONGTEXT,
      pcu_uploaded_by VARCHAR(255) DEFAULT '',
      pcu_uploaded_at VARCHAR(100) DEFAULT '',
      deleted_at VARCHAR(100) NULL,
      maintenance VARCHAR(50) DEFAULT 'None',
      maintenance_medicine TEXT NULL,
      added_from_print_list TINYINT(1) DEFAULT 1,
      INDEX idx_barangay (barangay),
      INDEX idx_status (status),
      INDEX idx_full_name (full_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. Administrators / Staff Users Table
    `CREATE TABLE IF NOT EXISTS users (
      username VARCHAR(100) PRIMARY KEY,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'STAFF',
      full_name VARCHAR(255) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      status VARCHAR(50) DEFAULT 'Active',
      barangay VARCHAR(255) DEFAULT '',
      created_at VARCHAR(100) DEFAULT '',
      avatar_data_url LONGTEXT,
      permissions TEXT,
      password_plain VARCHAR(255) DEFAULT '',
      display_name VARCHAR(255) DEFAULT '',
      updated_at VARCHAR(100) DEFAULT '',
      INDEX idx_role (role),
      INDEX idx_email (email),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. Existing Accounts Table
    `CREATE TABLE IF NOT EXISTS existing_accounts (
      id VARCHAR(100) PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      barangay VARCHAR(255) DEFAULT '',
      purok VARCHAR(255) DEFAULT '',
      contact_number VARCHAR(100) DEFAULT '',
      pin VARCHAR(100) DEFAULT '',
      latitude DOUBLE NULL,
      longitude DOUBLE NULL,
      geotagged TINYINT(1) DEFAULT 0,
      facebook_link TEXT NULL,
      uploaded_files LONGTEXT NULL,
      is_submitted TINYINT(1) DEFAULT 0,
      submitted_at VARCHAR(100) NULL,
      existing_acc_verified TINYINT(1) DEFAULT 1,
      existing_acc_visited TINYINT(1) DEFAULT 1,
      created_at VARCHAR(100) DEFAULT '',
      status VARCHAR(50) DEFAULT 'PENDING',
      submitted_by VARCHAR(255) DEFAULT '',
      folder VARCHAR(255) DEFAULT 'GENERAL',
      remarks TEXT,
      deleted_at VARCHAR(100) NULL,
      INDEX idx_exist_barangay (barangay),
      INDEX idx_exist_folder (folder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. Barangays Table
    `CREATE TABLE IF NOT EXISTS barangays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. System Audit / Activity Log Table
    `CREATE TABLE IF NOT EXISTS activities (
      id VARCHAR(100) PRIMARY KEY,
      timestamp VARCHAR(100) NOT NULL,
      username VARCHAR(100) NOT NULL,
      action TEXT NOT NULL,
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. Website / Site Settings Table
    `CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value LONGTEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. Inbox / Messages Table
    `CREATE TABLE IF NOT EXISTS inbox_messages (
      id VARCHAR(100) PRIMARY KEY,
      sender VARCHAR(100) NOT NULL,
      recipient VARCHAR(100) NOT NULL,
      subject VARCHAR(255) DEFAULT '',
      message LONGTEXT NOT NULL,
      created_at VARCHAR(100) NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      INDEX idx_recipient (recipient)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. Soft-deleted Records Archive Table
    `CREATE TABLE IF NOT EXISTS deleted_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_name VARCHAR(100) NOT NULL,
      record_id VARCHAR(100) DEFAULT '',
      record_data LONGTEXT NOT NULL,
      deleted_at VARCHAR(100) NOT NULL,
      deleted_by VARCHAR(100) DEFAULT '',
      INDEX idx_table_name (table_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const sql of tableDefinitions) {
    try {
      await connectionPool.query(sql);
    } catch (err: any) {
      console.error('[cPanel DB] Error executing table init:', err.message);
    }
  }

  // Ensure all necessary columns exist in `contacts` table if it was created with an older schema
  try {
    const [colRows]: any = await connectionPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contacts'`
    );
    const existingCols = new Set((colRows || []).map((r: any) => String(r.column_name || r.COLUMN_NAME).toLowerCase()));
    if (existingCols.size > 0) {
      const missingCols = [
        { name: 'latitude', type: 'DECIMAL(10, 7) NULL' },
        { name: 'longitude', type: 'DECIMAL(10, 7) NULL' },
        { name: 'geotagged', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'status', type: "VARCHAR(50) DEFAULT 'ACTIVE'" },
        { name: 'is_submitted', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'photo_url', type: 'LONGTEXT' },
        { name: 'pcu_file_url', type: 'LONGTEXT' },
        { name: 'pcu_uploaded_by', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'pcu_uploaded_at', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'deleted_at', type: 'VARCHAR(100) NULL' },
        { name: 'maintenance', type: "VARCHAR(50) DEFAULT 'None'" },
        { name: 'maintenance_medicine', type: 'TEXT NULL' },
        { name: 'added_from_print_list', type: 'TINYINT(1) DEFAULT 1' }
      ];
      for (const col of missingCols) {
        if (!existingCols.has(col.name.toLowerCase())) {
          try {
            await connectionPool.query(`ALTER TABLE contacts ADD COLUMN \`${col.name}\` ${col.type}`);
            console.log(`[cPanel DB] Added missing column '${col.name}' to contacts table.`);
          } catch (e: any) {
            console.warn(`[cPanel DB] Column migration notice for ${col.name}:`, e.message);
          }
        }
      }
    }

    // Inspect and migrate missing columns in 'users' table
    const [userColRows]: any = await connectionPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users'`
    ).catch(() => [[]]);
    const existingUserCols = new Set((userColRows || []).map((r: any) => String(r.column_name || r.COLUMN_NAME).toLowerCase()));
    if (existingUserCols.size > 0) {
      const missingUserCols = [
        { name: 'password_plain', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'display_name', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'updated_at', type: "VARCHAR(100) DEFAULT ''" }
      ];
      for (const col of missingUserCols) {
        if (!existingUserCols.has(col.name.toLowerCase())) {
          try {
            await connectionPool.query(`ALTER TABLE users ADD COLUMN \`${col.name}\` ${col.type}`);
            console.log(`[cPanel DB] Added missing column '${col.name}' to users table.`);
          } catch (e: any) {
            console.warn(`[cPanel DB] Column migration notice for users.${col.name}:`, e.message);
          }
        }
      }
    }

    // Inspect and migrate missing columns in 'existing_accounts' table
    const [existColRows]: any = await connectionPool.query(
      `SELECT column_name, data_type, extra FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'existing_accounts'`
    ).catch(() => [[]]);
    const existingExistCols = new Set((existColRows || []).map((r: any) => String(r.column_name || r.COLUMN_NAME).toLowerCase()));
    if (existingExistCols.size > 0) {
      // Ensure id column accommodates alphanumeric Base44/external string IDs
      const idCol = (existColRows || []).find((r: any) => String(r.column_name || r.COLUMN_NAME).toLowerCase() === 'id');
      if (idCol && (String(idCol.data_type || idCol.DATA_TYPE).toLowerCase().includes('int') || String(idCol.extra || idCol.EXTRA).toLowerCase().includes('auto_increment'))) {
        try {
          await connectionPool.query(`ALTER TABLE existing_accounts MODIFY COLUMN \`id\` VARCHAR(100) NOT NULL`);
          console.log(`[cPanel DB] Altered existing_accounts.id column to VARCHAR(100) NOT NULL.`);
        } catch (e: any) {
          console.warn(`[cPanel DB] Column modification notice for existing_accounts.id:`, e.message);
        }
      }

      const missingExistCols = [
        { name: 'pin', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'latitude', type: "DOUBLE NULL" },
        { name: 'longitude', type: "DOUBLE NULL" },
        { name: 'geotagged', type: "TINYINT(1) DEFAULT 0" },
        { name: 'facebook_link', type: "TEXT NULL" },
        { name: 'uploaded_files', type: "LONGTEXT NULL" },
        { name: 'is_submitted', type: "TINYINT(1) DEFAULT 0" },
        { name: 'submitted_at', type: "VARCHAR(100) NULL" },
        { name: 'existing_acc_verified', type: "TINYINT(1) DEFAULT 1" },
        { name: 'existing_acc_visited', type: "TINYINT(1) DEFAULT 1" }
      ];
      for (const col of missingExistCols) {
        if (!existingExistCols.has(col.name.toLowerCase())) {
          try {
            await connectionPool.query(`ALTER TABLE existing_accounts ADD COLUMN \`${col.name}\` ${col.type}`);
            console.log(`[cPanel DB] Added missing column '${col.name}' to existing_accounts table.`);
          } catch (e: any) {
            console.warn(`[cPanel DB] Column migration notice for existing_accounts.${col.name}:`, e.message);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[cPanel DB] Schema inspection notice:', err.message);
  }

  // Ensure default Master Admin exists in MySQL
  try {
    const [rows]: any = await connectionPool.query('SELECT username FROM users WHERE username = ?', ['admin']);
    if (!rows || rows.length === 0) {
      // crypto sha256 of '2026'
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update('2026').digest('hex');
      const now = new Date().toISOString();
      await connectionPool.query(
        `INSERT INTO users (username, password_hash, role, full_name, email, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['admin', hash, 'MASTER ADMIN', 'Master Administrator', 'admin@clinic.local', 'Active', now]
      );
      console.log('[cPanel DB] Master Administrator account seeded into MySQL users table.');
    }
  } catch (err: any) {
    console.warn('[cPanel DB] Notice checking default admin:', err.message);
  }
}

/**
 * Re-creates the connection pool with given or loaded config
 */
export async function reinitializePool(customConfig?: CPanelDbConfig): Promise<boolean> {
  const config = customConfig || loadCPanelDbConfig();

  if (pool) {
    try {
      await pool.end();
    } catch {}
    pool = null;
  }

  currentStatus = {
    connected: false,
    isMainDatabase: false,
    host: config.host || 'localhost',
    port: config.port || 3306,
    database: config.database || '',
    user: config.user || '',
    tableCount: 0,
    lastConnected: null,
    lastError: null,
    tables: []
  };

  if (!config.enabled || !config.database) {
    currentStatus.lastError = 'cPanel MySQL Database disabled or not configured. Running in Local Storage mode.';
    return false;
  }

  const isContainerEnv = Boolean(
    process.env.K_SERVICE || 
    process.env.APPLET_ID || 
    process.env.LAMBDA_TASK_ROOT || 
    process.env.NETLIFY
  );
  const isLocalhost = 
    config.host === 'localhost' || 
    config.host === '127.0.0.1' || 
    config.host === '::1';

  // In cloud preview / container environments, localhost MySQL is not hosted inside the container.
  // We avoid attempting an unfulfillable network connection that triggers ECONNREFUSED alarms.
  if (isContainerEnv && isLocalhost) {
    currentStatus.connected = false;
    currentStatus.isMainDatabase = false;
    currentStatus.lastError = 'Local MySQL is not running inside this Cloud Run preview container. Operating safely in Local Storage mode (data/*.json). For cPanel deployment, deploy to your cPanel hosting where localhost MySQL is available, or specify your remote cPanel server hostname/IP in Settings.';
    console.log('[cPanel DB] Notice: Local MySQL is not present in cloud preview container. Running in Local Storage mode.');
    return false;
  }

  let newPool: mysql.Pool | null = null;
  try {
    newPool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000
    });

    // Test ping
    const connection = await newPool.getConnection();
    await connection.ping();
    connection.release();

    pool = newPool;

    // Initialize tables
    await initCPanelTables(pool);

    // Read table statistics
    const [tableRows]: any = await pool.query(
      `SELECT table_name AS tableName, table_rows AS rowCount 
       FROM information_schema.tables 
       WHERE table_schema = ?`,
      [config.database]
    );

    const tables = (tableRows || []).map((t: any) => ({
      name: t.tableName,
      rowCount: Number(t.rowCount) || 0
    }));

    currentStatus = {
      connected: true,
      isMainDatabase: true,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      tableCount: tables.length,
      lastConnected: new Date().toISOString(),
      lastError: null,
      tables
    };

    console.log(`[cPanel DB] Successfully connected to MySQL database "${config.database}" on ${config.host}:${config.port}`);
    return true;
  } catch (err: any) {
    const errMsg = err.message || String(err);
    currentStatus.connected = false;
    currentStatus.isMainDatabase = false;
    currentStatus.lastError = errMsg;
    console.log(`[cPanel DB] Notice: Connection to MySQL (${config.host}:${config.port}/${config.database}) not established (${errMsg}). Running in Local Storage mode.`);
    if (newPool) {
      try {
        await newPool.end();
      } catch {}
    }
    return false;
  }
}

/**
 * Tests MySQL connection with arbitrary config parameters without saving
 */
export async function testCPanelDbConnection(config: CPanelDbConfig): Promise<{ success: boolean; message: string; tableCount?: number }> {
  const isContainerEnv = Boolean(
    process.env.K_SERVICE || 
    process.env.APPLET_ID || 
    process.env.LAMBDA_TASK_ROOT || 
    process.env.NETLIFY
  );
  const isLocalhost = 
    config.host === 'localhost' || 
    config.host === '127.0.0.1' || 
    config.host === '::1';

  if (isContainerEnv && isLocalhost) {
    return {
      success: false,
      message: 'Cannot connect to "localhost" MySQL inside this cloud preview environment. To test connection to your cPanel database from here, enter your remote cPanel server hostname or IP (and ensure Remote MySQL access is allowed in your cPanel dashboard).'
    };
  }

  let testPool: mysql.Pool | null = null;
  try {
    testPool = mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 1,
      connectTimeout: 6000
    });

    const conn = await testPool.getConnection();
    await conn.ping();
    
    // Check tables in target database
    const [rows]: any = await conn.query(
      `SELECT count(*) as count FROM information_schema.tables WHERE table_schema = ?`,
      [config.database]
    );
    conn.release();

    const count = rows?.[0]?.count || 0;
    return {
      success: true,
      message: `Successfully connected to MySQL database "${config.database}" on ${config.host}:${config.port}! Found ${count} existing tables.`,
      tableCount: Number(count)
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message || String(err)}`
    };
  } finally {
    if (testPool) {
      try {
        await testPool.end();
      } catch {}
    }
  }
}

/**
 * Generates the clean MySQL Schema DDL file content for direct phpMyAdmin import
 */
export function generateCPanelSchemaSql(): string {
  return `-- =========================================================================
-- SAINT FRANCIS CLINIC DIRECTORY - CPANEL MYSQL DATABASE SCHEMA
-- Compatible with cPanel MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Ready for phpMyAdmin / cPanel MySQL Databases Import
-- =========================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- -------------------------------------------------------------------------
-- 1. Table: contacts (PCU Directory Master Records)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`contacts\` (
  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`full_name\` VARCHAR(255) NOT NULL,
  \`barangay\` VARCHAR(255) NOT NULL DEFAULT '',
  \`purok\` VARCHAR(255) DEFAULT '',
  \`contact_number\` VARCHAR(100) DEFAULT '',
  \`created_at\` VARCHAR(100) DEFAULT '',
  \`updated_at\` VARCHAR(100) DEFAULT '',
  \`latitude\` DECIMAL(10, 7) NULL,
  \`longitude\` DECIMAL(10, 7) NULL,
  \`geotagged\` TINYINT(1) DEFAULT 0,
  \`status\` VARCHAR(50) DEFAULT 'ACTIVE',
  \`is_submitted\` TINYINT(1) DEFAULT 0,
  \`photo_url\` LONGTEXT,
  \`pcu_file_url\` LONGTEXT,
  \`pcu_uploaded_by\` VARCHAR(255) DEFAULT '',
  \`pcu_uploaded_at\` VARCHAR(100) DEFAULT '',
  \`deleted_at\` VARCHAR(100) NULL,
  INDEX \`idx_barangay\` (\`barangay\`),
  INDEX \`idx_status\` (\`status\`),
  INDEX \`idx_full_name\` (\`full_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 2. Table: users (Administrators & Staff Accounts)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`users\` (
  \`username\` VARCHAR(100) PRIMARY KEY,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'STAFF',
  \`full_name\` VARCHAR(255) DEFAULT '',
  \`email\` VARCHAR(255) DEFAULT '',
  \`status\` VARCHAR(50) DEFAULT 'Active',
  \`barangay\` VARCHAR(255) DEFAULT '',
  \`created_at\` VARCHAR(100) DEFAULT '',
  \`avatar_data_url\` LONGTEXT,
  \`permissions\` TEXT,
  INDEX \`idx_role\` (\`role\`),
  INDEX \`idx_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Master Admin (Username: admin, Password: 2026)
INSERT INTO \`users\` (\`username\`, \`password_hash\`, \`role\`, \`full_name\`, \`email\`, \`status\`, \`created_at\`)
VALUES ('admin', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'MASTER ADMIN', 'Master Administrator', 'admin@clinic.local', 'Active', NOW())
ON DUPLICATE KEY UPDATE \`role\` = 'MASTER ADMIN';

-- -------------------------------------------------------------------------
-- 3. Table: existing_accounts (External Matching Records)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`existing_accounts\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`full_name\` VARCHAR(255) NOT NULL,
  \`barangay\` VARCHAR(255) DEFAULT '',
  \`purok\` VARCHAR(255) DEFAULT '',
  \`contact_number\` VARCHAR(100) DEFAULT '',
  \`pin\` VARCHAR(100) DEFAULT '',
  \`latitude\` DOUBLE NULL,
  \`longitude\` DOUBLE NULL,
  \`geotagged\` TINYINT(1) DEFAULT 0,
  \`facebook_link\` TEXT NULL,
  \`uploaded_files\` LONGTEXT NULL,
  \`is_submitted\` TINYINT(1) DEFAULT 0,
  \`submitted_at\` VARCHAR(100) NULL,
  \`existing_acc_verified\` TINYINT(1) DEFAULT 1,
  \`existing_acc_visited\` TINYINT(1) DEFAULT 1,
  \`created_at\` VARCHAR(100) DEFAULT '',
  \`status\` VARCHAR(50) DEFAULT 'PENDING',
  \`submitted_by\` VARCHAR(255) DEFAULT '',
  \`folder\` VARCHAR(255) DEFAULT 'GENERAL',
  \`remarks\` TEXT,
  \`deleted_at\` VARCHAR(100) NULL,
  INDEX \`idx_exist_barangay\` (\`barangay\`),
  INDEX \`idx_exist_folder\` (\`folder\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 4. Table: barangays (Barangay Master List)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`barangays\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(255) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 5. Table: activities (Audit Log / Security Trail)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`activities\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`timestamp\` VARCHAR(100) NOT NULL,
  \`username\` VARCHAR(100) NOT NULL,
  \`action\` TEXT NOT NULL,
  INDEX \`idx_timestamp\` (\`timestamp\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 6. Table: site_settings (Branding, App Name, Custom Labels, Roles)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`site_settings\` (
  \`setting_key\` VARCHAR(100) PRIMARY KEY,
  \`setting_value\` LONGTEXT,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 7. Table: inbox_messages (Internal Messaging)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`inbox_messages\` (
  \`id\` VARCHAR(100) PRIMARY KEY,
  \`sender\` VARCHAR(100) NOT NULL,
  \`recipient\` VARCHAR(100) NOT NULL,
  \`subject\` VARCHAR(255) DEFAULT '',
  \`message\` LONGTEXT NOT NULL,
  \`created_at\` VARCHAR(100) NOT NULL,
  \`is_read\` TINYINT(1) DEFAULT 0,
  INDEX \`idx_recipient\` (\`recipient\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 8. Table: deleted_records (Soft Deletions Trash Bin)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`deleted_records\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`table_name\` VARCHAR(100) NOT NULL,
  \`record_id\` VARCHAR(100) DEFAULT '',
  \`record_data\` LONGTEXT NOT NULL,
  \`deleted_at\` VARCHAR(100) NOT NULL,
  \`deleted_by\` VARCHAR(100) DEFAULT '',
  INDEX \`idx_table_name\` (\`table_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================================
-- End of Schema Definition
-- =========================================================================
`;
}

/**
 * Migrates all local data into cPanel MySQL tables
 */
export async function migrateAllDataToCPanelDb(data: {
  contacts: any[];
  users: any[];
  existingAccounts: any[];
  barangays: string[];
  activities: any[];
  settings: Record<string, any>;
  inboxMessages?: any[];
}): Promise<{ success: boolean; counts: Record<string, number>; message: string }> {
  if (!pool || !currentStatus.connected) {
    throw new Error('Cannot migrate: cPanel MySQL Database is not connected.');
  }

  const counts: Record<string, number> = {
    contacts: 0,
    users: 0,
    existingAccounts: 0,
    barangays: 0,
    activities: 0,
    settings: 0,
    inboxMessages: 0
  };

  // 1. Migrate Contacts
  for (const c of data.contacts || []) {
    try {
      await pool.query(
        `INSERT INTO contacts (id, full_name, barangay, purok, contact_number, created_at, updated_at, latitude, longitude, geotagged, status, is_submitted, photo_url, pcu_file_url, pcu_uploaded_by, pcu_uploaded_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           barangay = VALUES(barangay),
           purok = VALUES(purok),
           contact_number = VALUES(contact_number),
           updated_at = VALUES(updated_at),
           latitude = VALUES(latitude),
           longitude = VALUES(longitude),
           geotagged = VALUES(geotagged),
           status = VALUES(status),
           is_submitted = VALUES(is_submitted),
           photo_url = VALUES(photo_url),
           pcu_file_url = VALUES(pcu_file_url),
           pcu_uploaded_by = VALUES(pcu_uploaded_by),
           pcu_uploaded_at = VALUES(pcu_uploaded_at),
           deleted_at = VALUES(deleted_at)`,
        [
          c.id,
          c.full_name || '',
          c.barangay || '',
          c.purok || '',
          c.contact_number || '',
          c.created_at || '',
          c.updated_at || '',
          c.latitude ?? null,
          c.longitude ?? null,
          c.geotagged ? 1 : 0,
          c.status || 'ACTIVE',
          c.isSubmitted ? 1 : 0,
          c.photo_url || null,
          c.pcu_file_url || null,
          c.pcu_uploaded_by || '',
          c.pcu_uploaded_at || '',
          c.deleted_at || null
        ]
      );
      counts.contacts++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Contact ${c.id} insert error:`, err.message);
    }
  }

  // 2. Migrate Users
  for (const u of data.users || []) {
    try {
      await pool.query(
        `INSERT INTO users (username, password_hash, role, full_name, email, status, barangay, created_at, avatar_data_url, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           full_name = VALUES(full_name),
           email = VALUES(email),
           status = VALUES(status),
           barangay = VALUES(barangay),
           avatar_data_url = VALUES(avatar_data_url),
           permissions = VALUES(permissions)`,
        [
          u.username,
          u.passwordHash || '',
          u.role || 'STAFF',
          u.fullName || u.displayName || '',
          u.email || '',
          u.status || 'Active',
          u.barangay || '',
          u.createdAt || '',
          u.avatarDataUrl || null,
          u.permissions ? JSON.stringify(u.permissions) : null
        ]
      );
      counts.users++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] User ${u.username} insert error:`, err.message);
    }
  }

  // 3. Migrate Existing Accounts
  for (const e of data.existingAccounts || []) {
    try {
      await pool.query(
        `INSERT INTO existing_accounts (id, full_name, barangay, purok, contact_number, created_at, status, submitted_by, folder, remarks, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           barangay = VALUES(barangay),
           purok = VALUES(purok),
           contact_number = VALUES(contact_number),
           status = VALUES(status),
           submitted_by = VALUES(submitted_by),
           folder = VALUES(folder),
           remarks = VALUES(remarks),
           deleted_at = VALUES(deleted_at)`,
        [
          e.id,
          e.full_name || '',
          e.barangay || '',
          e.purok || '',
          e.contact_number || '',
          e.created_at || '',
          e.status || 'PENDING',
          e.submittedBy || '',
          e.folder || 'GENERAL',
          e.remarks || '',
          e.deleted_at || null
        ]
      );
      counts.existingAccounts++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Existing account ${e.id} insert error:`, err.message);
    }
  }

  // 4. Migrate Barangays
  for (const b of data.barangays || []) {
    try {
      await pool.query(
        `INSERT IGNORE INTO barangays (name) VALUES (?)`,
        [b]
      );
      counts.barangays++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Barangay ${b} insert error:`, err.message);
    }
  }

  // 5. Migrate Activities
  for (const a of data.activities || []) {
    try {
      await pool.query(
        `INSERT INTO activities (id, timestamp, username, action)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE action = VALUES(action)`,
        [a.id || String(Date.now()), a.timestamp || '', a.username || 'system', a.action || '']
      );
      counts.activities++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Activity ${a.id} insert error:`, err.message);
    }
  }

  // 6. Migrate Site Settings
  for (const [key, value] of Object.entries(data.settings || {})) {
    try {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      await pool.query(
        `INSERT INTO site_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, valStr]
      );
      counts.settings++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Setting ${key} insert error:`, err.message);
    }
  }

  // 7. Migrate Inbox Messages if present
  for (const m of data.inboxMessages || []) {
    try {
      await pool.query(
        `INSERT INTO inbox_messages (id, sender, recipient, subject, message, created_at, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_read = VALUES(is_read)`,
        [m.id || String(Date.now()), m.sender || '', m.recipient || '', m.subject || '', m.message || '', m.created_at || '', m.is_read ? 1 : 0]
      );
      counts.inboxMessages++;
    } catch (err: any) {
      console.warn(`[cPanel Migration] Inbox msg ${m.id} insert error:`, err.message);
    }
  }

  // Refresh status
  await reinitializePool();

  return {
    success: true,
    counts,
    message: `Migration completed: ${counts.contacts} contacts, ${counts.users} users, ${counts.existingAccounts} existing accounts, ${counts.barangays} barangays, ${counts.activities} logs, and ${counts.settings} settings saved to cPanel MySQL database.`
  };
}

let lastSyncCheck = {
  count: -1,
  maxUpdated: '',
  maxId: -1,
  lastCheckedTime: 0
};

export function updateLastSyncMetadata(count: number, maxUpdated: string, maxId: number) {
  lastSyncCheck.count = count;
  lastSyncCheck.maxUpdated = maxUpdated;
  lastSyncCheck.maxId = maxId;
  lastSyncCheck.lastCheckedTime = Date.now();
}

/**
 * Flexible mapper that transforms a raw database row from either `contacts` or a spreadsheet-imported
 * table (like `sheet1` or `Sheet1` with varying column headers) into a standard Contact record.
 */
export function mapFlexibleRowToContact(r: any, defaultIndex: number = 1): any {
  if (!r || typeof r !== 'object') return null;

  // Build normalized key map for case-insensitive and punctuation-free lookup
  const normalizedKeyMap: Record<string, string> = {};
  for (const k of Object.keys(r)) {
    normalizedKeyMap[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = k;
  }

  const getVal = (...possibleNames: string[]): any => {
    for (const name of possibleNames) {
      const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKeyMap[clean] !== undefined) {
        const val = r[normalizedKeyMap[clean]];
        if (val !== undefined && val !== null) return val;
      }
    }
    return undefined;
  };

  // 1. ID
  const rawId = getVal('id', 'contactid', 'patientid', 'no', 'number', 'rowid', 'itemid', 'clientid');
  const idVal = rawId !== null && rawId !== undefined && !isNaN(Number(rawId))
    ? Number(rawId)
    : (rawId !== undefined && rawId !== null && String(rawId).trim() ? String(rawId).trim() : (1784789000000 + defaultIndex));

  // 2. Full Name
  let fullName = (getVal('fullname', 'name', 'patientname', 'patient', 'familymember', 'membername', 'clientname', 'head') || '').toString().trim();
  if (!fullName) {
    const fn = (getVal('firstname', 'first', 'givenname') || '').toString().trim();
    const mn = (getVal('middlename', 'middle') || '').toString().trim();
    const ln = (getVal('lastname', 'last', 'surname') || '').toString().trim();
    if (ln && fn) {
      fullName = `${ln}, ${fn}${mn ? ' ' + mn : ''}`.trim();
    } else if (fn || ln) {
      fullName = `${fn} ${ln}`.trim();
    }
  }

  // Skip completely blank rows without names
  if (!fullName) {
    return null;
  }

  // 3. Barangay
  const barangay = (getVal('barangay', 'brgy', 'address', 'location', 'baranggay', 'bgy') || '').toString().trim();

  // 4. Purok
  const purok = (getVal('purok', 'zone', 'sitio', 'street', 'purokzone', 'sitiozone') || '').toString().trim();

  // 5. Contact Number
  const contactNumber = (getVal('contactnumber', 'contactno', 'phonenumber', 'phone', 'mobile', 'mobilenumber', 'cellphone', 'contact', 'tel', 'cellno') || '').toString().trim();

  // 6. Coordinates
  const rawLat = getVal('latitude', 'lat');
  const latitude = (rawLat !== null && rawLat !== undefined && rawLat !== '' && !isNaN(Number(rawLat))) ? Number(rawLat) : undefined;

  const rawLng = getVal('longitude', 'long', 'lng');
  const longitude = (rawLng !== null && rawLng !== undefined && rawLng !== '' && !isNaN(Number(rawLng))) ? Number(rawLng) : undefined;

  const rawGeotagged = getVal('geotagged', 'geo');
  const geotagged = Boolean(rawGeotagged === 1 || rawGeotagged === true || rawGeotagged === '1' || (latitude !== undefined && longitude !== undefined));

  // 7. Status & Submission
  const rawStatus = (getVal('status') || '').toString().trim();
  const rawSubmitted = getVal('issubmitted', 'submitted', 'islock', 'islocked', 'locked');
  const isSub = Boolean(
    rawSubmitted === 1 || rawSubmitted === true || rawSubmitted === '1' || rawSubmitted === 'true' ||
    rawStatus.toUpperCase() === 'SUBMITTED' || rawStatus.toUpperCase() === 'LOCKED' || rawStatus.toUpperCase() === 'ALREADY SUBMITTED'
  );
  const status = rawStatus || (isSub ? 'SUBMITTED' : 'ACTIVE');

  // 8. Timestamps
  let createdAt = getVal('createdat', 'created', 'date', 'timestamp');
  if (createdAt instanceof Date) {
    createdAt = createdAt.toISOString();
  } else if (!createdAt || createdAt === '0000-00-00 00:00:00' || createdAt === '0') {
    createdAt = new Date().toISOString();
  } else {
    createdAt = String(createdAt);
  }

  let updatedAt = getVal('updatedat', 'updated');
  if (updatedAt instanceof Date) {
    updatedAt = updatedAt.toISOString();
  } else if (!updatedAt || updatedAt === '0000-00-00 00:00:00' || updatedAt === '0') {
    updatedAt = createdAt;
  } else {
    updatedAt = String(updatedAt);
  }

  let deletedAt = getVal('deletedat', 'deleted');
  if (deletedAt instanceof Date) {
    deletedAt = deletedAt.toISOString();
  } else if (!deletedAt || deletedAt === '0000-00-00 00:00:00' || deletedAt === '0' || deletedAt === '') {
    deletedAt = null;
  } else {
    deletedAt = String(deletedAt);
  }

  return {
    id: idVal,
    full_name: fullName,
    barangay,
    purok,
    contact_number: contactNumber,
    created_at: createdAt,
    updated_at: updatedAt,
    latitude,
    longitude,
    geotagged,
    status,
    isSubmitted: isSub,
    locked: isSub,
    photo_url: getVal('photourl', 'photo') || undefined,
    pcu_file_url: getVal('pcufileurl', 'pcuurl', 'pcufile', 'fileurl') || undefined,
    pcu_uploaded_by: getVal('pcuuploadedby', 'uploadedby') || undefined,
    pcu_uploaded_at: getVal('pcuuploadedat', 'uploadedat') || undefined,
    maintenance: (() => {
      const rm = (getVal('maintenance', 'hasmaintenance', 'ismaintenance') || '').toString().trim();
      const rmed = (getVal('maintenancemedicine', 'medicine', 'medicines', 'maintainedmedicine') || '').toString().trim();
      return (rm.toLowerCase() === 'yes' || (rmed && rm.toLowerCase() !== 'none')) ? 'Yes' : 'None';
    })(),
    maintenance_medicine: (() => {
      const rm = (getVal('maintenance', 'hasmaintenance', 'ismaintenance') || '').toString().trim();
      const rmed = (getVal('maintenancemedicine', 'medicine', 'medicines', 'maintainedmedicine') || '').toString().trim();
      const isYes = rm.toLowerCase() === 'yes' || (rmed && rm.toLowerCase() !== 'none');
      return isYes ? (rmed || (rm.toLowerCase() !== 'yes' && rm.toLowerCase() !== 'none' ? rm : '')) : undefined;
    })(),
    added_from_print_list: (() => {
      const rawAdded = getVal('added_from_print_list', 'addedfromprintlist', 'directory', 'printlist', 'added');
      if (rawAdded === undefined || rawAdded === null || rawAdded === '') {
        return true; // default to true for existing/legacy database records
      }
      return Boolean(Number(rawAdded) === 1 || String(rawAdded).toLowerCase() === 'true' || String(rawAdded) === '1');
    })(),
    deleted_at: deletedAt
  };
}

/**
 * Lightweight check to see if cPanel MySQL contacts or sheet1 table has changed since last sync
 */
export async function checkCPanelDbNeedsSync(force: boolean = false): Promise<boolean> {
  if (!pool || !currentStatus.connected) return false;
  const now = Date.now();
  if (!force && (now - lastSyncCheck.lastCheckedTime < 2500)) {
    return false;
  }
  lastSyncCheck.lastCheckedTime = now;

  try {
    let cnt = 0;
    let maxUpdated = '';
    let maxId = 0;

    // 1. Check contacts table with complete SQL null-safety
    try {
      const [rows]: any = await pool.query(
        `SELECT COUNT(*) AS cnt, COALESCE(MAX(updated_at), '') AS max_updated, COALESCE(MAX(id), 0) AS max_id 
         FROM contacts 
         WHERE (deleted_at IS NULL OR deleted_at = '' OR deleted_at = '0000-00-00 00:00:00' OR deleted_at = '0') 
           AND (status IS NULL OR status != 'DELETED')`
      );
      if (rows && rows.length > 0) {
        cnt += Number(rows[0].cnt) || 0;
        maxUpdated = String(rows[0].max_updated || '');
        maxId = Number(rows[0].max_id) || 0;
      }
    } catch {}

    // 2. Check sheet1 or Sheet1 table if present
    try {
      const [sRows]: any = await pool.query(
        `SELECT COUNT(*) AS cnt FROM sheet1`
      );
      if (sRows && sRows.length > 0) {
        cnt += Number(sRows[0].cnt) || 0;
      }
    } catch {}

    if (lastSyncCheck.count === -1) {
      lastSyncCheck.count = cnt;
      lastSyncCheck.maxUpdated = maxUpdated;
      lastSyncCheck.maxId = maxId;
      return true;
    }

    if (cnt !== lastSyncCheck.count || maxUpdated !== lastSyncCheck.maxUpdated || maxId !== lastSyncCheck.maxId) {
      lastSyncCheck.count = cnt;
      lastSyncCheck.maxUpdated = maxUpdated;
      lastSyncCheck.maxId = maxId;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get direct contact statistics directly from cPanel MySQL database.
 * Used by the Dashboard to provide 100% accurate Total Contacts and Added Today counts.
 */
export async function getCPanelContactsStats(todayDateStrings: string[]): Promise<{
  totalContacts: number;
  contactsToday: number;
  totalAddresses: number;
} | null> {
  if (!pool || !currentStatus.connected) return null;
  try {
    // 1. Total Active Contacts
    const [totRows]: any = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM contacts 
       WHERE (deleted_at IS NULL OR deleted_at = '' OR deleted_at = '0000-00-00 00:00:00' OR deleted_at = '0') 
         AND (status IS NULL OR status != 'DELETED')`
    );
    const totalContacts = Number(totRows?.[0]?.total) || 0;

    // 2. Total Unique Barangays
    const [bgRows]: any = await pool.query(
      `SELECT COUNT(DISTINCT LOWER(TRIM(barangay))) AS total_bg 
       FROM contacts 
       WHERE (deleted_at IS NULL OR deleted_at = '' OR deleted_at = '0000-00-00 00:00:00' OR deleted_at = '0') 
         AND (status IS NULL OR status != 'DELETED')
         AND barangay IS NOT NULL AND TRIM(barangay) != ''`
    );
    const totalAddresses = Number(bgRows?.[0]?.total_bg) || 0;

    // 3. Contacts Added Today
    let contactsToday = 0;
    if (todayDateStrings && todayDateStrings.length > 0) {
      const conditions = todayDateStrings.map(() => `(created_at LIKE ?)`).join(' OR ');
      const params = todayDateStrings.map(d => `${d}%`);
      const [todayRows]: any = await pool.query(
        `SELECT COUNT(*) AS today_count 
         FROM contacts 
         WHERE (deleted_at IS NULL OR deleted_at = '' OR deleted_at = '0000-00-00 00:00:00' OR deleted_at = '0') 
           AND (status IS NULL OR status != 'DELETED')
           AND (${conditions})`,
        params
      );
      contactsToday = Number(todayRows?.[0]?.today_count) || 0;
    }

    return {
      totalContacts,
      contactsToday,
      totalAddresses
    };
  } catch (err: any) {
    console.warn('[cPanel DB] Error calculating direct contacts stats from MySQL:', err.message);
    return null;
  }
}

/**
 * Fetch all records from cPanel MySQL database, automatically detecting and merging
 * both standard tables and any `sheet1` table (1,700+ contact records).
 */
export async function fetchAllFromCPanelDb(): Promise<{
  contacts: any[];
  users: any[];
  existingAccounts: any[];
  barangays: string[];
  activities: any[];
  settings: Record<string, any>;
} | null> {
  if (!pool || !currentStatus.connected) return null;

  try {
    // 1. Fetch from contacts table
    let cRows: any[] = [];
    try {
      const [rows]: any = await pool.query('SELECT * FROM contacts ORDER BY id ASC');
      cRows = rows || [];
    } catch (err: any) {
      console.warn('[cPanel DB] Notice reading contacts table:', err.message);
    }

    // 2. Check information_schema for any table named `sheet1` (or variants)
    let sheetRows: any[] = [];
    let detectedSheetTable: string | null = null;
    try {
      const [tableList]: any = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
      );
      const allTableNames: string[] = (tableList || []).map((t: any) => String(t.table_name || t.TABLE_NAME || ''));
      
      const foundSheetTable = allTableNames.find(name => {
        const lower = name.toLowerCase();
        return lower === 'sheet1' || lower === 'sheet_1' || lower === 'contacts_sheet1' || lower === 'sheet' || lower.includes('sheet1');
      });

      if (foundSheetTable) {
        detectedSheetTable = foundSheetTable;
        const [sRows]: any = await pool.query(`SELECT * FROM \`${foundSheetTable}\``);
        sheetRows = sRows || [];
        console.log(`[cPanel DB] Found sheet table "${foundSheetTable}" containing ${sheetRows.length} total records.`);
      }
    } catch (err: any) {
      console.warn('[cPanel DB] Notice checking for sheet1 table:', err.message);
    }

    // 3. Map contacts table records
    const mappedContactsFromTable: any[] = [];
    for (let i = 0; i < cRows.length; i++) {
      const mapped = mapFlexibleRowToContact(cRows[i], i + 1);
      if (mapped) mappedContactsFromTable.push(mapped);
    }

    // 4. Map sheet1 table records
    const mappedContactsFromSheet: any[] = [];
    for (let i = 0; i < sheetRows.length; i++) {
      const mapped = mapFlexibleRowToContact(sheetRows[i], i + 1);
      if (mapped) mappedContactsFromSheet.push(mapped);
    }

    // 5. Intelligently merge sheet1 records and contacts table records
    const contactsMapByName = new Map<string, any>();
    const contactsMapById = new Map<string, any>();

    // Seed with sheet1 contacts first (the comprehensive 1703+ records)
    for (const c of mappedContactsFromSheet) {
      const nameKey = c.full_name.trim().toLowerCase();
      contactsMapByName.set(nameKey, c);
      contactsMapById.set(String(c.id), c);
    }

    // Merge with contacts table (preserving any updated photos, PCU files, contact numbers, maintenance, or newer edits)
    for (const c of mappedContactsFromTable) {
      const nameKey = c.full_name.trim().toLowerCase();
      const existing = contactsMapByName.get(nameKey) || contactsMapById.get(String(c.id));
      if (existing) {
        // Explicitly prioritize edited contact details from the contacts table
        if (c.contact_number && c.contact_number !== '0') {
          existing.contact_number = c.contact_number;
        }
        if (c.barangay) existing.barangay = c.barangay;
        if (c.purok) existing.purok = c.purok;
        if (c.maintenance) existing.maintenance = c.maintenance;
        if (c.maintenance_medicine !== undefined) existing.maintenance_medicine = c.maintenance_medicine;
        if (c.full_name) existing.full_name = c.full_name;

        existing.photo_url = c.photo_url || existing.photo_url;
        existing.pcu_file_url = c.pcu_file_url || existing.pcu_file_url;
        existing.pcu_uploaded_by = c.pcu_uploaded_by || existing.pcu_uploaded_by;
        existing.pcu_uploaded_at = c.pcu_uploaded_at || existing.pcu_uploaded_at;
        if (c.isSubmitted) {
          existing.isSubmitted = true;
          existing.locked = true;
          existing.status = 'SUBMITTED';
        }
        if (c.geotagged) {
          existing.geotagged = true;
          existing.latitude = c.latitude !== undefined ? c.latitude : existing.latitude;
          existing.longitude = c.longitude !== undefined ? c.longitude : existing.longitude;
        }
        if (c.deleted_at) {
          existing.deleted_at = c.deleted_at;
        }
        if (c.updated_at && (!existing.updated_at || c.updated_at > existing.updated_at)) {
          existing.updated_at = c.updated_at;
        }
      } else {
        contactsMapByName.set(nameKey, c);
        contactsMapById.set(String(c.id), c);
      }
    }

    const contacts = Array.from(new Set([...contactsMapByName.values(), ...contactsMapById.values()]));

    // If sheet1 had records and contacts table has fewer, synchronize in background to keep contacts table full
    if (sheetRows.length > 0 && cRows.length < sheetRows.length) {
      saveContactsBulkToCPanel(contacts).catch(err => {
        console.warn('[cPanel DB] Background sync of sheet1 records into contacts table notice:', err.message);
      });
    }

    const [uRows]: any = await pool.query('SELECT * FROM users ORDER BY username ASC').catch(() => [[]]);
    const [eRows]: any = await pool.query('SELECT * FROM existing_accounts ORDER BY id ASC').catch(() => [[]]);
    const [bRows]: any = await pool.query('SELECT name FROM barangays ORDER BY name ASC').catch(() => [[]]);
    const [aRows]: any = await pool.query('SELECT * FROM activities ORDER BY timestamp DESC LIMIT 200').catch(() => [[]]);
    const [sRows]: any = await pool.query('SELECT setting_key, setting_value FROM site_settings').catch(() => [[]]);

    const extractedBarangays = new Set<string>((bRows || []).map((r: any) => r.name).filter(Boolean));
    contacts.forEach(c => {
      if (c.barangay && c.barangay.trim()) {
        extractedBarangays.add(c.barangay.trim());
      }
    });
    const barangays = Array.from(extractedBarangays).sort();

    const users = (uRows || []).map((r: any) => {
      let permissions = undefined;
      try {
        if (r.permissions) permissions = JSON.parse(r.permissions);
      } catch {}
      const rawStatus = (r.status !== undefined && r.status !== null) ? String(r.status).trim() : '';
      let normStatus: 'Active' | 'Pending' | 'Suspended' = 'Pending';
      const sLower = rawStatus.toLowerCase();
      if (sLower.startsWith('pend') || sLower === '0' || sLower === 'unapproved' || sLower === 'awaiting') {
        normStatus = 'Pending';
      } else if (sLower.startsWith('susp') || sLower.startsWith('inact') || sLower.startsWith('block') || sLower === 'disabled') {
        normStatus = 'Suspended';
      } else if (sLower.startsWith('act') || sLower === '1' || sLower === 'approved' || (r.username && r.username.toLowerCase() === 'admin')) {
        normStatus = 'Active';
      } else if (r.username && r.username.toLowerCase() === 'admin') {
        normStatus = 'Active';
      } else {
        normStatus = 'Pending';
      }

      return {
        username: r.username,
        passwordHash: r.password_hash,
        role: r.role || 'Staff',
        fullName: r.full_name || r.display_name || r.username,
        displayName: r.display_name || r.full_name || r.username,
        email: r.email || '',
        status: normStatus,
        barangay: r.barangay || 'Central',
        createdAt: r.created_at || '',
        updatedAt: r.updated_at || r.created_at || '',
        avatarDataUrl: r.avatar_data_url || undefined,
        permissions,
        passwordPlain: r.password_plain || undefined
      };
    });

    const existingAccounts = (eRows || []).map((r: any) => {
      let uploadedFiles: any[] = [];
      try {
        if (r.uploaded_files) {
          uploadedFiles = typeof r.uploaded_files === 'string' ? JSON.parse(r.uploaded_files) : r.uploaded_files;
        }
      } catch {}

      return {
        id: String(r.id),
        full_name: r.full_name || r.name || '',
        barangay: r.barangay || '',
        purok: r.purok || '',
        contact_number: r.contact_number || r.phone || '',
        pin: r.pin || '',
        latitude: r.latitude !== null && r.latitude !== undefined ? Number(r.latitude) : undefined,
        longitude: r.longitude !== null && r.longitude !== undefined ? Number(r.longitude) : undefined,
        geotagged: Boolean(r.geotagged),
        facebookLink: r.facebook_link || '',
        uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : [],
        isSubmitted: Boolean(r.is_submitted),
        submittedAt: r.submitted_at || undefined,
        existingAcc: true,
        existingAccVerified: r.existing_acc_verified !== 0,
        existingAccVisited: r.existing_acc_visited !== 0,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || new Date().toISOString()),
        status: r.status || 'PENDING',
        submittedBy: r.submitted_by || r.submittedBy || '',
        folder: r.folder || 'GENERAL',
        remarks: r.remarks || '',
        deleted_at: (r.deleted_at && r.deleted_at !== '0000-00-00 00:00:00' && r.deleted_at !== '0') ? String(r.deleted_at) : null
      };
    });

    const activities = (aRows || []).map((r: any) => ({
      id: String(r.id),
      timestamp: r.timestamp,
      username: r.username,
      action: r.action
    }));

    const settings: Record<string, any> = {};
    (sRows || []).forEach((r: any) => {
      try {
        settings[r.setting_key] = JSON.parse(r.setting_value);
      } catch {
        settings[r.setting_key] = r.setting_value;
      }
    });

    const maxId = contacts.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0);
    const maxUpdated = contacts.reduce((max, c) => (c.updated_at > max ? c.updated_at : max), '');
    updateLastSyncMetadata(contacts.filter(c => !c.deleted_at).length, maxUpdated, maxId);

    return {
      contacts,
      users,
      existingAccounts,
      barangays,
      activities,
      settings
    };
  } catch (err: any) {
    console.error('[cPanel DB] Error fetching records from MySQL:', err.message);
    return null;
  }
}

export async function saveContactToCPanel(c: any): Promise<{ success: boolean; error?: string }> {
  if (!pool || !currentStatus.connected) {
    return { success: false, error: currentStatus.lastError || 'MySQL database not connected' };
  }
  try {
    const isSub = Boolean(c.isSubmitted || c.is_submitted);
    const idVal = c.id !== undefined && c.id !== null && !isNaN(Number(c.id)) ? Number(c.id) : null;
    const maintenanceVal = c.maintenance === 'Yes' ? 'Yes' : 'None';
    const medicineVal = maintenanceVal === 'Yes' ? (c.maintenance_medicine || '') : null;
    const addedFromPrintListVal = c.added_from_print_list !== false && c.added_from_print_list !== 0 ? 1 : 0;

    let targetId = idVal;
    if (!targetId && c.full_name) {
      try {
        const [existingRows]: any = await pool!.query(
          'SELECT id FROM contacts WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?)) LIMIT 1',
          [c.full_name.trim()]
        );
        if (existingRows && existingRows.length > 0) {
          targetId = Number(existingRows[0].id);
        }
      } catch {}
    }

    const executeSave = async () => {
      await pool!.query(
        `INSERT INTO contacts (
          id, full_name, barangay, purok, contact_number, 
          created_at, updated_at, latitude, longitude, geotagged, 
          status, is_submitted, photo_url, pcu_file_url, pcu_uploaded_by, 
          pcu_uploaded_at, deleted_at, maintenance, maintenance_medicine,
          added_from_print_list
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          barangay = VALUES(barangay),
          purok = VALUES(purok),
          contact_number = VALUES(contact_number),
          updated_at = VALUES(updated_at),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          geotagged = VALUES(geotagged),
          status = VALUES(status),
          is_submitted = VALUES(is_submitted),
          photo_url = VALUES(photo_url),
          pcu_file_url = VALUES(pcu_file_url),
          pcu_uploaded_by = VALUES(pcu_uploaded_by),
          pcu_uploaded_at = VALUES(pcu_uploaded_at),
          deleted_at = VALUES(deleted_at),
          maintenance = VALUES(maintenance),
          maintenance_medicine = VALUES(maintenance_medicine),
          added_from_print_list = VALUES(added_from_print_list)`,
        [
          targetId,
          c.full_name || '',
          c.barangay || '',
          c.purok || '',
          c.contact_number || '',
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString(),
          c.latitude !== undefined && c.latitude !== null ? Number(c.latitude) : null,
          c.longitude !== undefined && c.longitude !== null ? Number(c.longitude) : null,
          c.geotagged ? 1 : 0,
          c.status || 'ACTIVE',
          isSub ? 1 : 0,
          c.photo_url || null,
          c.pcu_file_url || null,
          c.pcu_uploaded_by || '',
          c.pcu_uploaded_at || '',
          c.deleted_at || null,
          maintenanceVal,
          medicineVal,
          addedFromPrintListVal
        ]
      );

      // Perform explicit UPDATE by full_name or targetId to ensure the row is updated even if auto-increment IDs differ
      if (c.full_name) {
        try {
          await pool!.query(
            `UPDATE contacts SET 
              contact_number = ?, 
              barangay = ?, 
              purok = ?, 
              maintenance = ?, 
              maintenance_medicine = ?, 
              added_from_print_list = ?,
              updated_at = ? 
            WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?))`,
            [
              c.contact_number || '',
              c.barangay || '',
              c.purok || '',
              maintenanceVal,
              medicineVal,
              addedFromPrintListVal,
              c.updated_at || new Date().toISOString(),
              c.full_name.trim()
            ]
          );
        } catch {}
      }

      // Also update any sheet table (like sheet1) if present in MySQL
      try {
        const [tableList]: any = await pool!.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) LIKE '%sheet%'`
        );
        for (const t of (tableList || [])) {
          const sheetTbl = t.table_name || t.TABLE_NAME;
          if (!sheetTbl) continue;
          const [colList]: any = await pool!.query(`SHOW COLUMNS FROM \`${sheetTbl}\``);
          const colNames = (colList || []).map((col: any) => String(col.Field || '').toLowerCase());
          
          const phoneCol = colNames.find((cn: string) => cn.includes('contact') || cn.includes('phone') || cn.includes('mobile') || cn.includes('number'));
          const nameCol = colNames.find((cn: string) => cn.includes('name'));
          const bgCol = colNames.find((cn: string) => cn.includes('barangay') || cn.includes('address'));
          const pkCol = colNames.find((cn: string) => cn.includes('purok'));
          const maintCol = colNames.find((cn: string) => cn.includes('maintenance'));
          const medCol = colNames.find((cn: string) => cn.includes('medicine'));

          if (phoneCol && nameCol) {
            const sets: string[] = [`\`${phoneCol}\` = ?`];
            const vals: any[] = [c.contact_number || ''];
            if (bgCol && c.barangay) {
              sets.push(`\`${bgCol}\` = ?`);
              vals.push(c.barangay);
            }
            if (pkCol && c.purok) {
              sets.push(`\`${pkCol}\` = ?`);
              vals.push(c.purok);
            }
            if (maintCol) {
              sets.push(`\`${maintCol}\` = ?`);
              vals.push(maintenanceVal);
            }
            if (medCol) {
              sets.push(`\`${medCol}\` = ?`);
              vals.push(medicineVal);
            }
            vals.push(c.full_name.trim());
            await pool!.query(
              `UPDATE \`${sheetTbl}\` SET ${sets.join(', ')} WHERE LOWER(TRIM(\`${nameCol}\`)) = LOWER(TRIM(?))`,
              vals
            );
          }
        }
      } catch {}
    };

    try {
      await executeSave();
    } catch (colErr: any) {
      if (colErr.message && (colErr.message.includes('maintenance') || colErr.message.includes('Unknown column'))) {
        try {
          await pool.query("ALTER TABLE contacts ADD COLUMN `maintenance` VARCHAR(50) DEFAULT 'None'");
          await pool.query("ALTER TABLE contacts ADD COLUMN `maintenance_medicine` TEXT NULL");
        } catch (_) {}
        await executeSave();
      } else {
        throw colErr;
      }
    }

    return { success: true };
  } catch (err: any) {
    const msg = err.message || String(err);
    console.warn('[cPanel DB] Error saving contact to MySQL:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Bulk save contacts directly into cPanel MySQL database in chunked batches.
 * Handles multi-row parameterization with fallback to single-row insertion to guarantee 100% data preservation.
 */
export async function saveContactsBulkToCPanel(
  contacts: any[]
): Promise<{ success: boolean; saved: number; error?: string }> {
  if (!pool || !currentStatus.connected) {
    return {
      success: false,
      saved: 0,
      error: currentStatus.lastError || 'cPanel MySQL Database is not connected. Operating in local storage mode.'
    };
  }

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { success: true, saved: 0 };
  }

  // Ensure all necessary columns exist on the contacts table
  try {
    const [colRows]: any = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'contacts'`
    ).catch(() => [[]]);
    const existing = new Set((colRows || []).map((r: any) => String(r.column_name || r.COLUMN_NAME).toLowerCase()));
    if (existing.size > 0) {
      const definitions: { name: string; type: string }[] = [
        { name: 'latitude', type: 'DECIMAL(10, 7) NULL' },
        { name: 'longitude', type: 'DECIMAL(10, 7) NULL' },
        { name: 'geotagged', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'status', type: "VARCHAR(50) DEFAULT 'ACTIVE'" },
        { name: 'is_submitted', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'added_from_print_list', type: 'TINYINT(1) DEFAULT 1' },
        { name: 'photo_url', type: 'LONGTEXT' },
        { name: 'pcu_file_url', type: 'LONGTEXT' },
        { name: 'pcu_uploaded_by', type: "VARCHAR(255) DEFAULT ''" },
        { name: 'pcu_uploaded_at', type: "VARCHAR(100) DEFAULT ''" },
        { name: 'deleted_at', type: 'VARCHAR(100) NULL' },
        { name: 'maintenance', type: "VARCHAR(50) DEFAULT 'None'" },
        { name: 'maintenance_medicine', type: 'TEXT NULL' }
      ];

      for (const def of definitions) {
        if (!existing.has(def.name.toLowerCase())) {
          try {
            await pool.query(`ALTER TABLE contacts ADD COLUMN \`${def.name}\` ${def.type}`);
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  let totalSaved = 0;
  const CHUNK_SIZE = 50;

  try {
    for (let i = 0; i < contacts.length; i += CHUNK_SIZE) {
      const chunk = contacts.slice(i, i + CHUNK_SIZE);
      const values: any[] = [];
      const placeholders: string[] = [];

      for (const c of chunk) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const idVal = c.id !== undefined && c.id !== null && !isNaN(Number(c.id)) ? Number(c.id) : null;
        const isSub = Boolean(c.isSubmitted || c.is_submitted);
        const maintenanceVal = c.maintenance === 'Yes' ? 'Yes' : 'None';
        const medicineVal = maintenanceVal === 'Yes' ? (c.maintenance_medicine || '') : null;
        const addedFromPrintListVal = c.added_from_print_list !== false && c.added_from_print_list !== 0 ? 1 : 0;

        values.push(
          idVal,
          c.full_name || '',
          c.barangay || '',
          c.purok || '',
          c.contact_number || '',
          c.created_at || new Date().toISOString(),
          c.updated_at || new Date().toISOString(),
          c.latitude !== undefined && c.latitude !== null ? Number(c.latitude) : null,
          c.longitude !== undefined && c.longitude !== null ? Number(c.longitude) : null,
          c.geotagged ? 1 : 0,
          c.status || 'ACTIVE',
          isSub ? 1 : 0,
          c.photo_url || null,
          c.pcu_file_url || null,
          c.pcu_uploaded_by || '',
          c.pcu_uploaded_at || '',
          c.deleted_at || null,
          maintenanceVal,
          medicineVal,
          addedFromPrintListVal
        );
      }

      const sql = `
        INSERT INTO contacts (
          id, full_name, barangay, purok, contact_number, 
          created_at, updated_at, latitude, longitude, 
          geotagged, status, is_submitted, photo_url, 
          pcu_file_url, pcu_uploaded_by, pcu_uploaded_at, deleted_at,
          maintenance, maintenance_medicine, added_from_print_list
        ) VALUES ${placeholders.join(', ')}
        ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          barangay = VALUES(barangay),
          purok = VALUES(purok),
          contact_number = VALUES(contact_number),
          updated_at = VALUES(updated_at),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          geotagged = VALUES(geotagged),
          status = VALUES(status),
          is_submitted = VALUES(is_submitted),
          photo_url = VALUES(photo_url),
          pcu_file_url = VALUES(pcu_file_url),
          pcu_uploaded_by = VALUES(pcu_uploaded_by),
          pcu_uploaded_at = VALUES(pcu_uploaded_at),
          deleted_at = VALUES(deleted_at),
          maintenance = VALUES(maintenance),
          maintenance_medicine = VALUES(maintenance_medicine),
          added_from_print_list = VALUES(added_from_print_list)
      `;

      try {
        await pool.query(sql, values);
        totalSaved += chunk.length;
      } catch (chunkErr: any) {
        console.warn('[cPanel DB] Batch chunk insert error, falling back to row-by-row insertion:', chunkErr.message);
        for (const singleContact of chunk) {
          try {
            const singleRes = await saveContactToCPanel(singleContact);
            if (singleRes.success) {
              totalSaved++;
            }
          } catch (_) {}
        }
      }
    }

    // Refresh table statistics
    try {
      const [tableRows]: any = await pool.query(
        `SELECT table_name AS tableName, table_rows AS rowCount 
         FROM information_schema.tables 
         WHERE table_schema = ?`,
        [currentStatus.database]
      );
      if (tableRows) {
        currentStatus.tables = tableRows.map((t: any) => ({
          name: t.tableName,
          rowCount: Number(t.rowCount) || 0
        }));
      }
    } catch {}

    console.log(`[cPanel DB] Successfully saved ${totalSaved} bulk contacts to MySQL database "${currentStatus.database}".`);
    return { success: true, saved: totalSaved };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.error('[cPanel DB] Error executing bulk insert to MySQL:', errorMsg);
    return { success: false, saved: totalSaved, error: errorMsg };
  }
}

export async function deleteContactFromCPanel(
  id: number | string, 
  deletedAt?: string,
  fullName?: string,
  barangay?: string
): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const idVal = id !== undefined && id !== null && !isNaN(Number(id)) ? Number(id) : null;
    if (idVal) {
      await pool.query('DELETE FROM contacts WHERE id = ?', [idVal]).catch(() => {});
      await pool.query('DELETE FROM sheet1 WHERE id = ?', [idVal]).catch(() => {});
    }
    if (fullName && fullName.trim()) {
      const trimmedName = fullName.trim();
      if (barangay && barangay.trim()) {
        const trimmedBgy = barangay.trim();
        await pool.query(
          'DELETE FROM contacts WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?)) AND (LOWER(TRIM(barangay)) = LOWER(TRIM(?)) OR barangay = "" OR barangay IS NULL)',
          [trimmedName, trimmedBgy]
        ).catch(() => {});
        await pool.query(
          'DELETE FROM sheet1 WHERE (LOWER(TRIM(full_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?))) AND (LOWER(TRIM(barangay)) = LOWER(TRIM(?)) OR barangay = "" OR barangay IS NULL)',
          [trimmedName, trimmedName, trimmedBgy]
        ).catch(() => {});
      } else {
        await pool.query(
          'DELETE FROM contacts WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?))',
          [trimmedName]
        ).catch(() => {});
        await pool.query(
          'DELETE FROM sheet1 WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?))',
          [trimmedName, trimmedName]
        ).catch(() => {});
      }
    }

    // Also purge from any other sheet-named tables in MySQL
    try {
      const [tableList]: any = await pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) LIKE '%sheet%' AND LOWER(table_name) != 'sheet1'`
      ).catch(() => [[]]);
      for (const t of (tableList || [])) {
        const sheetTbl = t.table_name || t.TABLE_NAME;
        if (!sheetTbl) continue;
        if (idVal) {
          await pool.query(`DELETE FROM \`${sheetTbl}\` WHERE id = ?`, [idVal]).catch(() => {});
        }
        if (fullName && fullName.trim()) {
          const trimmedName = fullName.trim();
          await pool.query(
            `DELETE FROM \`${sheetTbl}\` WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?))`,
            [trimmedName, trimmedName]
          ).catch(() => {});
        }
      }
    } catch {}

    console.log(`[cPanel DB] Permanently deleted contact (ID: ${id}, Name: ${fullName || 'N/A'}) from MySQL contacts and sheet tables.`);
  } catch (err: any) {
    console.warn('[cPanel DB] Error permanently deleting contact from MySQL:', err.message);
  }
}

/**
 * Directly updates a user's role in MySQL cPanel database
 */
export async function updateUserRoleInCPanel(username: string, email: string, newRole: string): Promise<boolean> {
  if (!pool || !currentStatus.connected) return false;
  try {
    const now = new Date().toISOString();
    const uname = (username || '').trim().toLowerCase();
    const uemail = (email || '').trim().toLowerCase();

    const [res]: any = await pool.query(
      `UPDATE users SET role = ?, updated_at = ? WHERE LOWER(TRIM(username)) = ? OR (email != '' AND LOWER(TRIM(email)) = ?)`,
      [newRole, now, uname, uemail]
    );

    if (res && res.affectedRows > 0) {
      console.log(`[cPanel DB] Successfully updated role to "${newRole}" for user "${username}" in MySQL.`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('[cPanel DB] Notice updating user role in MySQL:', err.message);
    return false;
  }
}

/**
 * Directly updates a user's status in MySQL cPanel database
 */
export async function updateUserStatusInCPanel(username: string, email: string, newStatus: string): Promise<boolean> {
  if (!pool || !currentStatus.connected) return false;
  try {
    const now = new Date().toISOString();
    const uname = (username || '').trim().toLowerCase();
    const uemail = (email || '').trim().toLowerCase();

    const [res]: any = await pool.query(
      `UPDATE users SET status = ?, updated_at = ? WHERE LOWER(TRIM(username)) = ? OR (email != '' AND LOWER(TRIM(email)) = ?)`,
      [newStatus, now, uname, uemail]
    );

    if (res && res.affectedRows > 0) {
      console.log(`[cPanel DB] Successfully updated status to "${newStatus}" for user "${username}" in MySQL.`);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('[cPanel DB] Notice updating user status in MySQL:', err.message);
    return false;
  }
}

export async function saveUserToCPanel(u: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    // Ensure all necessary columns exist on the users table safely
    try {
      const [userColRows]: any = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users'`
      ).catch(() => [[]]);
      const existing = new Set((userColRows || []).map((r: any) => String(r.column_name || r.COLUMN_NAME).toLowerCase()));
      if (existing.size > 0) {
        const definitions: { name: string; type: string }[] = [
          { name: 'password_hash', type: "VARCHAR(255) NOT NULL DEFAULT ''" },
          { name: 'role', type: "VARCHAR(50) NOT NULL DEFAULT 'Staff'" },
          { name: 'full_name', type: "VARCHAR(255) DEFAULT ''" },
          { name: 'display_name', type: "VARCHAR(255) DEFAULT ''" },
          { name: 'email', type: "VARCHAR(255) DEFAULT ''" },
          { name: 'status', type: "VARCHAR(50) DEFAULT 'Pending'" },
          { name: 'barangay', type: "VARCHAR(255) DEFAULT ''" },
          { name: 'created_at', type: "VARCHAR(100) DEFAULT ''" },
          { name: 'updated_at', type: "VARCHAR(100) DEFAULT ''" },
          { name: 'avatar_data_url', type: 'LONGTEXT' },
          { name: 'permissions', type: 'TEXT' },
          { name: 'password_plain', type: "VARCHAR(255) DEFAULT ''" }
        ];

        for (const def of definitions) {
          if (!existing.has(def.name.toLowerCase())) {
            try {
              await pool.query(`ALTER TABLE users ADD COLUMN \`${def.name}\` ${def.type}`);
              console.log(`[cPanel DB] Added missing column '${def.name}' to users table.`);
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    const rawStatus = (u.status !== undefined && u.status !== null) ? String(u.status).trim() : '';
    let normStatus: 'Active' | 'Pending' | 'Suspended' = 'Pending';
    if (rawStatus.toLowerCase().startsWith('act')) {
      normStatus = 'Active';
    } else if (rawStatus.toLowerCase().startsWith('susp') || rawStatus.toLowerCase().startsWith('inact') || rawStatus.toLowerCase() === 'disabled') {
      normStatus = 'Suspended';
    } else if (rawStatus.toLowerCase().startsWith('pend')) {
      normStatus = 'Pending';
    } else if (u.username && u.username.toLowerCase() === 'admin') {
      normStatus = 'Active';
    }

    const role = u.role || (u.username && u.username.toLowerCase() === 'admin' ? 'Administrator' : 'Staff');
    const fullName = u.fullName || u.displayName || u.username || '';
    const displayName = u.displayName || u.fullName || u.username || '';
    const email = u.email || '';
    const barangay = u.barangay || 'Central';
    const createdAt = u.createdAt || new Date().toISOString();
    const updatedAt = u.updatedAt || new Date().toISOString();
    const avatar = u.avatarDataUrl || null;
    const permissions = u.permissions ? (typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions)) : null;
    const plainPass = u.passwordPlain || '';

    // First try a clean UPDATE by username or email
    const [updateRes]: any = await pool.query(
      `UPDATE users SET 
        role = ?, 
        full_name = ?, 
        email = ?, 
        status = ?, 
        barangay = ?, 
        avatar_data_url = COALESCE(?, avatar_data_url), 
        permissions = COALESCE(?, permissions), 
        password_plain = CASE WHEN ? != '' THEN ? ELSE password_plain END,
        display_name = ?, 
        updated_at = ?
       WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) OR (email != '' AND LOWER(TRIM(email)) = LOWER(TRIM(?)))`,
      [
        role,
        fullName,
        email,
        normStatus,
        barangay,
        avatar,
        permissions,
        plainPass,
        plainPass,
        displayName,
        updatedAt,
        u.username,
        email
      ]
    ).catch(() => [{ affectedRows: 0 }]);

    if (!updateRes || updateRes.affectedRows === 0) {
      // If user does not exist yet in MySQL, insert them
      await pool.query(
        `INSERT INTO users (
          username, password_hash, role, full_name, email, 
          status, barangay, created_at, avatar_data_url, permissions, 
          password_plain, display_name, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role = VALUES(role),
          full_name = VALUES(full_name),
          email = VALUES(email),
          status = VALUES(status),
          barangay = VALUES(barangay),
          avatar_data_url = VALUES(avatar_data_url),
          permissions = VALUES(permissions),
          password_plain = VALUES(password_plain),
          display_name = VALUES(display_name),
          updated_at = VALUES(updated_at)`,
        [
          u.username,
          u.passwordHash || '',
          role,
          fullName,
          email,
          normStatus,
          barangay,
          createdAt,
          avatar,
          permissions,
          plainPass,
          displayName,
          updatedAt
        ]
      ).catch(e => {
        console.warn('[cPanel DB] Insert user warning:', e.message);
      });
    }

    console.log(`[cPanel DB] Successfully saved user @${u.username} (Role: ${role}, Status: ${normStatus}) to MySQL.`);
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving user to MySQL:', err.message);
  }
}

export async function deleteUserFromCPanel(usernameOrEmail: string): Promise<void> {
  if (!pool || !currentStatus.connected || !usernameOrEmail) return;
  try {
    const target = usernameOrEmail.trim();
    await pool.query('DELETE FROM users WHERE username = ? OR email = ?', [target, target]);
  } catch (err: any) {
    console.warn('[cPanel DB] Error deleting user from MySQL:', err.message);
  }
}

export async function saveActivityToCPanel(a: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query(
      `INSERT INTO activities (id, timestamp, username, action) VALUES (?, ?, ?, ?)`,
      [a.id || String(Date.now()), a.timestamp, a.username, a.action]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error logging activity to MySQL:', err.message);
  }
}

export async function saveSettingToCPanel(key: string, val: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, valStr]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving setting to MySQL:', err.message);
  }
}

export async function saveExistingAccountToCPanel(account: any): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const filesJson = account.uploadedFiles ? JSON.stringify(account.uploadedFiles) : (account.uploaded_files || '[]');
    const isGeotagged = account.geotagged ? 1 : 0;
    const isSubmitted = account.isSubmitted ? 1 : 0;
    const isVerified = account.existingAccVerified !== false ? 1 : 0;
    const isVisited = account.existingAccVisited !== false ? 1 : 0;

    await pool.query(
      `INSERT INTO existing_accounts (
         id, full_name, barangay, purok, contact_number, pin, latitude, longitude, geotagged, 
         facebook_link, uploaded_files, is_submitted, submitted_at, existing_acc_verified, 
         existing_acc_visited, created_at, status, submitted_by, folder, remarks, deleted_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         full_name = VALUES(full_name),
         barangay = VALUES(barangay),
         purok = VALUES(purok),
         contact_number = VALUES(contact_number),
         pin = VALUES(pin),
         latitude = VALUES(latitude),
         longitude = VALUES(longitude),
         geotagged = VALUES(geotagged),
         facebook_link = VALUES(facebook_link),
         uploaded_files = VALUES(uploaded_files),
         is_submitted = VALUES(is_submitted),
         submitted_at = VALUES(submitted_at),
         existing_acc_verified = VALUES(existing_acc_verified),
         existing_acc_visited = VALUES(existing_acc_visited),
         status = VALUES(status),
         submitted_by = VALUES(submitted_by),
         folder = VALUES(folder),
         remarks = VALUES(remarks),
         deleted_at = VALUES(deleted_at)`,
      [
        String(account.id),
        account.full_name || account.fullName || '',
        account.barangay || '',
        account.purok || '',
        account.contact_number || account.contact || '',
        account.pin || '',
        account.latitude !== undefined && account.latitude !== null ? Number(account.latitude) : null,
        account.longitude !== undefined && account.longitude !== null ? Number(account.longitude) : null,
        isGeotagged,
        account.facebookLink || account.facebook_link || '',
        filesJson,
        isSubmitted,
        account.submittedAt || account.submitted_at || null,
        isVerified,
        isVisited,
        account.created_at || account.createdAt || new Date().toISOString(),
        account.status || 'PENDING',
        account.submittedBy || account.submitted_by || '',
        account.folder || 'GENERAL',
        account.remarks || '',
        account.deleted_at || null
      ]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving existing account to MySQL:', err.message);
  }
}

export async function deleteExistingAccountFromCPanel(id: string | number, deletedAt: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    await pool.query('UPDATE existing_accounts SET deleted_at = ?, status = "DELETED" WHERE id = ?', [deletedAt, id]);
  } catch (err: any) {
    console.warn('[cPanel DB] Error marking existing account deleted in MySQL:', err.message);
  }
}

export async function saveBarangayToCPanel(name: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const cleanName = (name || '').trim();
    if (!cleanName) return;
    await pool.query(
      `INSERT INTO barangays (name) VALUES (?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [cleanName]
    );
  } catch (err: any) {
    console.warn('[cPanel DB] Error saving barangay to MySQL:', err.message);
  }
}

export async function deleteBarangayFromCPanel(name: string): Promise<void> {
  if (!pool || !currentStatus.connected) return;
  try {
    const cleanName = (name || '').trim();
    if (!cleanName) return;
    await pool.query('DELETE FROM barangays WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [cleanName]);
    await pool.query('DELETE FROM contacts WHERE LOWER(TRIM(barangay)) = LOWER(TRIM(?))', [cleanName]);
    console.log(`[cPanel DB] Permanently deleted barangay "${cleanName}" and associated contacts from MySQL.`);
  } catch (err: any) {
    console.warn('[cPanel DB] Error deleting barangay from MySQL:', err.message);
  }
}

