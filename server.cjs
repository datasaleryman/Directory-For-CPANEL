/**
 * Application startup file for cPanel Node.js Selector
 * File: server.cjs
 * 
 * In cPanel -> "Setup Node.js App":
 * Application root: (e.g. /home/username/public_html or your app folder)
 * Application startup file: server.cjs
 */
const fs = require('fs');
const path = require('path');

// Auto-load environment variables from .env file if present
try {
  require('dotenv').config();
} catch (e) {
  // dotenv optional
}

const distServer = path.join(__dirname, 'dist', 'server.cjs');

if (fs.existsSync(distServer)) {
  console.log('[cPanel Node.js] Starting production server from dist/server.cjs...');
  require(distServer);
} else {
  console.log('[cPanel Node.js] dist/server.cjs not found, running server.ts directly via tsx...');
  try {
    require('tsx/cjs');
    require('./server.ts');
  } catch (err) {
    console.error('[cPanel Startup Error] Could not start application:', err.message);
    console.error('[cPanel Startup Error] Please run "npm run build" to generate dist/server.cjs');
    process.exit(1);
  }
}
