/**
 * cPanel Node.js Application Startup File
 * Compatible with cPanel "Setup Node.js App" (Phusion Passenger)
 */
const fs = require('fs');
const path = require('path');

const distServer = path.join(__dirname, 'dist', 'server.cjs');

if (fs.existsSync(distServer)) {
  console.log('[cPanel App] Starting production bundle from dist/server.cjs...');
  require(distServer);
} else {
  console.log('[cPanel App] Production bundle not found in dist/server.cjs.');
  console.log('[cPanel App] Please run "npm run build" in cPanel terminal or Node.js interface.');
  // Fallback: try loading server.ts with tsx if available
  try {
    require('tsx/cjs');
    require('./server.ts');
  } catch (err) {
    console.error('[cPanel App Error] Could not launch app:', err.message);
    process.exit(1);
  }
}
