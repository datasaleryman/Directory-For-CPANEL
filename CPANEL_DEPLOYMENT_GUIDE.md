# cPanel Deployment & MySQL Database Setup Guide

This guide walks you through deploying the **Saint Francis Clinic Directory** to any cPanel hosting environment using cPanel's native MySQL database and Node.js App manager.

---

## Part 1: Setting Up the cPanel MySQL Database

1. Log into your **cPanel**.
2. Go to **Databases** > **MySQL® Database Wizard** (or **MySQL® Databases**).
3. **Step 1: Create a Database**
   - Enter a database name (e.g. `clinic_directory`).
   - Click **Next Step**. Note your full database name (e.g., `cpuser_clinic_directory`).
4. **Step 2: Create Database User**
   - Enter a username (e.g. `clinic_user`).
   - Generate or create a strong password. Save this password.
   - Click **Create User**. Note your full username (e.g., `cpuser_clinic_user`).
5. **Step 3: Add User to Database**
   - Check the box **ALL PRIVILEGES**.
   - Click **Make Changes**.

### Importing the Database Schema via phpMyAdmin:
1. In cPanel, open **phpMyAdmin**.
2. Click on your newly created database in the left sidebar.
3. Click the **Import** tab at the top.
4. Click **Choose File** and select `cpanel_database.sql` from this repository.
5. Scroll to the bottom and click **Import** (or **Go**).
6. All 8 tables (`contacts`, `users`, `existing_accounts`, `barangays`, `activities`, `site_settings`, `inbox_messages`, `deleted_records`) are created immediately with default master administrator credentials seeded (`admin` / `2026`).

*(Note: If you skip phpMyAdmin, the application also automatically creates all missing tables on startup when connected!)*

---

## Part 2: Setting Up the Node.js Application in cPanel

1. In cPanel, click **Setup Node.js App** (under the **Software** section).
2. Click **Create Application**.
3. Fill in the fields:
   - **Node.js version**: Select `20.x` or `22.x` (recommended) or `18.x`.
   - **Application mode**: `Production`.
   - **Application root**: Path to your application folder (e.g. `clinic-directory` or `public_html`).
   - **Application URL**: Select your domain or subdomain (e.g. `clinic.yourdomain.com`).
   - **Application startup file**: Enter `app.js`.
4. Under **Environment variables**, add:
   - `NODE_ENV` = `production`
   - `DB_HOST` = `localhost` (or `127.0.0.1`)
   - `DB_PORT` = `3306`
   - `DB_NAME` = `cpuser_clinic_directory` (your actual cPanel database name)
   - `DB_USER` = `cpuser_clinic_user` (your cPanel database username)
   - `DB_PASSWORD` = (your database password)
   - `SESSION_SECRET` = (any random string for session security)
5. Click **Create**.

---

## Part 3: Installing Dependencies & Building

1. Copy the command shown at the top of the Node.js App screen in cPanel to enter your virtual environment (or click **Terminal** in cPanel).
2. Run:
   ```bash
   npm install
   npm run build
   ```
3. Back in the **Setup Node.js App** interface, click **Restart Application**.

---

## Part 4: Configuring & Testing Database in the Web Interface

Once your app is loaded:
1. Log in with:
   - **Username**: `admin`
   - **Password**: `2026`
2. Navigate to **Website Settings** > **cPanel Database Connection (MySQL / MariaDB)**.
3. You can review connection status, test the MySQL connection, save updated credentials, and click **Migrate Data to cPanel Database** to transfer any existing local records to MySQL.
