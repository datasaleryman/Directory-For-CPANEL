import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import {
  initDb,
  getContacts,
  getAllFilteredContacts,
  addContact,
  editContact,
  deleteContact,
  deleteBarangayFolderContacts,
  previewBulkImport,
  saveBulkImport,
  getDashboardStats,
  getDashboardStatsAsync,
  findUser,
  findUserByEmail,
  hashPassword,
  addActivity,
  getUsers,
  getBarangayList,
  registerUser,
  addUserAccountByAdmin,
  updateUserRole,
  updateUserStatus,
  designateBarangayForUsers,
  createAdminUser,
  deleteAdminUser,
  requestPasswordResetPIN,
  verifyAndResetPassword,
  getSheetsConfig,
  getSheetsStatus,
  saveSheetsConfig,
  syncWithGoogleSheets,
  getSiteSettings,
  saveSiteSettings,
  pullSiteSettingsOnce,
  pullAdminsOnce,
  pullBarangaysOnce,
  pullSiteSettingsFromGoogleSheets,
  pullAdminsFromGoogleSheets,
  pullBarangaysFromGoogleSheets,
  updateUserProfile,
  syncBase44Contacts,
  getBase44Roles,
  editUserAccount,
  fetchHouseholdSubmissionsFromBase44,
  fetchExistingAccountsFromBase44,
  getLocalExistingAccounts,
  addLocalExistingAccount,
  addLocalExistingAccountsBulk,
  updateLocalExistingAccount,
  uploadFilesForExistingAccount,
  addHouseholdToDirectory,
  addAllHouseholdsToDirectory,
  clearAllDirectoryContacts,
  isBarangayMatch,
  uploadContactPhoto,
  addPCUUpdate,
  addPCUUpdatesMultiple,
  getPCUUpdates,
  getRecentUploads,
  removePCUFileFromContact,
  restoreExistingAccountFiles,
  deleteExistingAccountFolder,
  deleteLocalExistingAccount,
  clearAllExistingAccounts,
  ensureContactsSynced,
  syncPCUUpdatesFromBase44,
  resetGoogleSheetsCooldown,
  getCachedSubmissionMessages,
  createSubmissionMessage,
  getMatchingAnalysis,
  mergeAccountToContact,
  createContactFromAccount,
  autoMergeAllPerfectMatches,
  isQuotaOrRateLimitError,
  getAllContactsRaw,
  getAllExistingAccountsRaw,
  getAllBarangaysRaw,
  getAllActivitiesRaw,
  syncWithCPanelDb,
  syncUsersFromCPanel,
  submitContactToBase44,
  transferContactToSubmitPcu,
  permanentlyDeletePcuSubmission,
  updatePcuSubmissionStatus,
  getPcuBaseRate,
  getPcuPendingBaseRate,
  setPcuBaseRate,
  getPcuHistory,
  getPcuSettlements,
  recordPcuSettlement,
  deletePcuSettlement
} from './server/db.js';
import {
  loadCPanelDbConfig,
  saveCPanelDbConfig,
  getCPanelDbStatus,
  testCPanelDbConnection,
  migrateAllDataToCPanelDb,
  generateCPanelSchemaSql,
  reinitializePool,
  fetchAllFromCPanelDb,
  isCPanelDbConnected,
  checkCPanelDbNeedsSync
} from './server/cpanel_db.js';
import {
  createToken,
  requireAuth,
  requireAdmin,
  sanitizeInput,
  AuthenticatedRequest
} from './server/auth.js';
import {
  getFullGoogleSheetsBackupData,
  getFullCPanelDbBackupData,
  formatBackupAsJson,
  formatBackupAsSql,
  parseBackupContent,
  restoreBackupFromContent
} from './server/backup.js';

export async function getApp(httpServer?: http.Server) {
  // Initialize the fast file-backed database cache
  await initDb();

  const app = express();
  const PORT = 3000;

  // Security: Max payload limit (set to 250mb to preserve original high-quality uploads and allow 20+ files) & XSS sanitization
  app.use(express.json({ limit: '250mb' }));
  app.use(express.urlencoded({ limit: '250mb', extended: true }));
  app.use(sanitizeInput);

  // Middleware to ensure contacts are loaded/synchronized from Google Sheets before accessing contact routes
  const ensureSyncedMiddleware = async (req: Request, res: Response, next: any) => {
    try {
      // Only trigger explicit sync if sync=true query is passed; routine queries read fast local cache
      if (req.query.sync === 'true') {
        ensureContactsSynced(true).catch((err: any) => {
          console.error('[Sync Middleware] Sync notice:', err.message);
        });
      }
      next();
    } catch (err: any) {
      console.error('[Sync Middleware] Failed to ensure contacts are synced:', err.message);
      next(); // Continue anyway to avoid blocking the app in case Google Sheets is temporarily down
    }
  };

  app.use('/api/contacts', ensureSyncedMiddleware);
  app.use('/api/base44/households', ensureSyncedMiddleware);

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Public endpoint for barangay list
  app.get('/api/public/barangays', (req: Request, res: Response) => {
    try {
      const barangays = getBarangayList();
      res.json({ barangays });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Registration
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { fullName, email, password, barangay } = req.body;
      const registered = await registerUser({ fullName, email, password, barangay });
      res.json({
        message: 'Registration successful! Your account is currently pending administrator approval before you can log in.',
        user: registered
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Forgot Password - Request Verification PIN
  app.post('/api/auth/forgot-password/request', async (req: Request, res: Response) => {
    try {
      const { emailOrUsername } = req.body;
      const result = await requestPasswordResetPIN(emailOrUsername);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to request password reset PIN.' });
    }
  });

  // Forgot Password - Verify PIN & Reset Password
  app.post('/api/auth/forgot-password/reset', async (req: Request, res: Response) => {
    try {
      const { emailOrUsername, pin, newPassword } = req.body;
      const result = await verifyAndResetPassword(emailOrUsername, pin, newPassword);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to reset password.' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      console.log(`[Login Attempt] Email/Username: ${username}`);
      const sheetsConfig = getSheetsConfig();
      if (sheetsConfig.syncEnabled) {
        try {
          await pullAdminsOnce();
        } catch (err: any) {
          if (!isQuotaOrRateLimitError(err)) {
            console.warn('Could not pull administrators on login request (using local cache):', err.message);
          }
        }
      }

      let user: any = undefined;
      const target = username.trim().toLowerCase();
      if (target === 'admin') {
        user = findUser('admin');
      } else {
        user = findUserByEmail(target) || findUser(target);
      }

      if (!user && isCPanelDbConnected()) {
        try {
          await syncUsersFromCPanel();
          user = (target === 'admin') ? findUser('admin') : (findUserByEmail(target) || findUser(target));
        } catch (_) {}
      }

      if (!user) {
        console.warn(`[Login Failed] User not found by email or username: ${username}`);
        return res.status(401).json({ error: 'Invalid email address or password.' });
      }

      const inputHash = hashPassword(password);
      if (user.passwordHash !== inputHash) {
        console.warn(`[Login Failed] Password mismatch for: ${username}`);
        return res.status(401).json({ error: 'Invalid email address or password.' });
      }

      if (user.status === 'Pending') {
        console.warn(`[Login Failed] User pending approval: ${username}`);
        return res.status(403).json({ error: 'Your account registration is pending administrator approval before you can log in.' });
      }

      if (user.status === 'Suspended') {
        console.warn(`[Login Failed] User suspended: ${username}`);
        return res.status(403).json({ error: 'Your account has been suspended. Please contact the administrator.' });
      }

      if (user.status && user.status !== 'Active') {
        console.warn(`[Login Failed] User not active: ${username} (${user.status})`);
        return res.status(403).json({ error: `Your account status is ${user.status}. Please contact the administrator.` });
      }

      // Success - create cryptographic session token
      const token = createToken(user.username, user.role as any);

      addActivity(user.username, 'Logged in to dashboard successfully.').catch(err => {
        console.error('Failed to log login activity:', err);
      });

      console.log(`[Login Success] User ${user.username} logged in successfully.`);
      res.json({
        token,
        user: {
          username: user.username,
          email: user.email || user.username,
          fullName: user.fullName || user.displayName || user.username,
          barangay: user.barangay || 'Central',
          role: user.role,
          status: user.status || 'Active'
        }
      });
    } catch (err: any) {
      console.error('[Login Error]', err);
      res.status(500).json({ error: err.message || 'Internal server error during login.' });
    }
  });

  // Current session details
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      const userObj = findUser(req.user.username);
      res.json({
        user: {
          username: userObj?.username || req.user.username,
          role: userObj?.role || req.user.role,
          displayName: userObj?.displayName || userObj?.fullName || '',
          avatarDataUrl: userObj?.avatarDataUrl || '',
          barangay: userObj?.barangay || '',
          email: userObj?.email || req.user.username,
          status: userObj?.status || 'Active'
        }
      });
    } else {
      res.status(401).json({ error: 'Unauthorized.' });
    }
  });

  // Update profile details
  app.post('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { username, displayName, avatarDataUrl, password, barangay } = req.body;
      const currentUsername = req.user.username;

      const updatedUser = await updateUserProfile(currentUsername, {
        username,
        displayName,
        avatarDataUrl,
        password,
        barangay
      });

      // If username has changed, generate a new token for the user so they stay logged in
      let token: string | undefined;
      if (updatedUser.username !== currentUsername.toLowerCase()) {
        token = createToken(updatedUser.username, updatedUser.role);
      }

      res.json({
        user: updatedUser,
        token
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Designate Barangay Folder to User Accounts (Admin action)
  app.post('/api/admin/designate-barangay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || '').toUpperCase();
      const isAdminRole = userRole === 'ADMINISTRATOR' || userRole === 'ADMIN' || userRole === 'MASTER ADMIN' || req.user?.username.toLowerCase() === 'admin';

      if (!isAdminRole) {
        return res.status(403).json({ error: 'Only administrators can designate barangay folders to accounts.' });
      }

      const { barangay, sourceBarangay, usernames } = req.body;
      const result = await designateBarangayForUsers(barangay, sourceBarangay, usernames, req.user!.username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to designate barangay folder to accounts.' });
    }
  });

  // Get contacts list (paginated, sorted, searched, filtered)
  app.get('/api/contacts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || '').toUpperCase();
      const userBarangay = userObj?.barangay || '';
      const isAdminRole = userRole === 'ADMINISTRATOR' || userRole === 'ADMIN' || userRole === 'MASTER ADMIN' || req.user?.username.toLowerCase() === 'admin' || userRole === 'IT';

      let address = req.query.address as string | undefined;
      // For non-admin accounts assigned to a barangay, restrict/default address filter to their designated barangay
      if (!isAdminRole && userBarangay) {
        if (!address || address === 'All Barangays' || address === 'All Addresses') {
          address = userBarangay;
        }
      }

      const search = req.query.search as string | undefined;
      const purok = req.query.purok as string | undefined;
      const sortBy = req.query.sortBy as 'name' | 'barangay' | 'purok' | 'date' | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const forceSync = req.query.sync === 'true' || req.query.refresh === 'true';

      const results = await getContacts({
        search,
        barangay: address, // Map legacy address filter parameter to barangay
        purok,
        sortBy,
        sortOrder,
        page,
        limit,
        forceSync
      });

      // If non-admin user with assigned barangay, filter returned folders so their designated barangay folder is available
      if (!isAdminRole && userBarangay && Array.isArray(results.barangayFolders)) {
        const assignedLower = userBarangay.trim().toLowerCase();
        const filtered = results.barangayFolders.filter(
          (f) => f.barangay.trim().toLowerCase() === assignedLower
        );

        if (filtered.length > 0) {
          results.barangayFolders = filtered;
        } else {
          // If no records exist yet for this designated barangay, return a folder entry so the folder is available
          results.barangayFolders = [{
            barangay: userBarangay,
            count: 0,
            availableCount: 0,
            submittedCount: 0,
            purokCount: 0,
            geotaggedCount: 0
          }];
        }
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all filtered contacts without pagination (for CSV/Excel/PDF print and exports)
  app.get('/api/contacts/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (isCPanelDbConnected() && (await checkCPanelDbNeedsSync())) {
        try {
          await syncWithCPanelDb();
        } catch (syncErr: any) {
          console.warn('[cPanel DB] Export sync warning:', syncErr.message);
        }
      }

      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || '').toUpperCase();
      const userBarangay = userObj?.barangay || '';
      const isLeaderRole = userRole === 'LEADER' || userRole === 'CO-LEADER' || userRole.includes('LEADER');

      let address = req.query.address as string | undefined;
      if (isLeaderRole && userBarangay) {
        address = userBarangay;
      }

      const search = req.query.search as string | undefined;
      const purok = req.query.purok as string | undefined;
      const sortBy = req.query.sortBy as 'name' | 'barangay' | 'purok' | 'date' | undefined;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

      const contacts = getAllFilteredContacts({
        search,
        barangay: address, // Map legacy address filter parameter to barangay
        purok,
        sortBy,
        sortOrder
      });

      res.json(contacts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get raw Base44 Household Submissions list for Print List page
  app.get('/api/base44/households', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (isCPanelDbConnected() && (await checkCPanelDbNeedsSync())) {
        try {
          await syncWithCPanelDb();
        } catch (syncErr: any) {
          console.warn('[cPanel DB] Base44 households sync warning:', syncErr.message);
        }
      }
      const households = await fetchHouseholdSubmissionsFromBase44();
      res.json(households);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Household Submissions marked as existing accounts (Local directory)
  app.get('/api/base44/existing-accounts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = getLocalExistingAccounts();
      res.json(existing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Existing Accounts (Redesigned local offline-first database)
  app.get('/api/existing-accounts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = getLocalExistingAccounts();
      
      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || 'Staff').toUpperCase();
      const userBarangay = userObj?.barangay || '';
      const isAdminRole = ['MASTER ADMIN', 'IT', 'ADMIN', 'ADMINISTRATOR'].includes(userRole) || req.user?.username.toLowerCase() === 'admin';
      
      let filtered = [...existing];
      if (!isAdminRole && userBarangay) {
        filtered = filtered.filter(item => {
          return isBarangayMatch(item.barangay, userBarangay);
        });
      }
      
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET messages from SubmissionMessage table
  app.get('/api/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const force = req.query.force === 'true';
      const messages = await getCachedSubmissionMessages(force);
      
      const isMasterAdmin = req.user?.username.toLowerCase() === 'admin';
      
      if (!isMasterAdmin && req.user?.username) {
        const usernameLower = req.user.username.toLowerCase();
        const userObj = findUser(req.user.username);
        
        const displayNameLower = (userObj?.displayName || '').toLowerCase().trim();
        const fullNameLower = (userObj?.fullName || '').toLowerCase().trim();
        const emailLower = (userObj?.email || '').toLowerCase().trim();
        const userBarangayLower = (userObj?.barangay || '').toLowerCase().trim();

        const filtered = messages.filter((msg: any) => {
          const senderLower = (msg.sender || msg.senderName || msg.fullName || msg.from || msg.sentBy || '').toLowerCase().trim();
          const recipientLower = (msg.recipient || msg.to || '').toLowerCase().trim();
          const msgBarangayLower = (msg.barangay || '').toLowerCase().trim();
          const submittedByLower = (msg.submittedBy || msg.submitted_by || '').toLowerCase().trim();
          const msgMemberName = (msg.memberName || '').toLowerCase().trim();
          const msgSentByEmail = (msg.sentByEmail || '').toLowerCase().trim();

          const isSender = 
            senderLower === usernameLower ||
            (displayNameLower && senderLower === displayNameLower) ||
            (fullNameLower && senderLower === fullNameLower) ||
            (emailLower && senderLower === emailLower) ||
            (emailLower && msgSentByEmail === emailLower);

          const isTarget = 
            recipientLower === usernameLower ||
            (displayNameLower && recipientLower === displayNameLower) ||
            (fullNameLower && recipientLower === fullNameLower) ||
            (emailLower && recipientLower === emailLower) ||
            submittedByLower === usernameLower ||
            (displayNameLower && submittedByLower === displayNameLower) ||
            (fullNameLower && submittedByLower === fullNameLower) ||
            (emailLower && submittedByLower === emailLower) ||
            msgMemberName === usernameLower ||
            (displayNameLower && msgMemberName === displayNameLower) ||
            (fullNameLower && msgMemberName === fullNameLower) ||
            (emailLower && msgMemberName === emailLower) ||
            (userBarangayLower && msgBarangayLower === userBarangayLower);

          return isSender || isTarget;
        });
        return res.json(filtered);
      }
      
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST a new message to SubmissionMessage table
  app.post('/api/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sender, message, recipient, barangay } = req.body;
      if (!sender || !message) {
        return res.status(400).json({ error: 'Sender and message content are required.' });
      }
      const newMsg = await createSubmissionMessage(sender, message, recipient, barangay);
      res.json(newMsg);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add manually registered Existing Account
  app.post('/api/existing-accounts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const newAccount = await addLocalExistingAccount(req.body, username);
      res.status(201).json(newAccount);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk add manually registered Existing Accounts
  app.post('/api/existing-accounts/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const accounts = req.body.accounts;
      if (!Array.isArray(accounts)) {
        return res.status(400).json({ error: 'Invalid payload: accounts must be an array' });
      }
      const newAccounts = await addLocalExistingAccountsBulk(accounts, username);
      res.status(201).json({ success: true, count: newAccounts.length, data: newAccounts });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update a manually registered Existing Account
  app.put('/api/existing-accounts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const id = req.params.id;

      // Access control: only superusers or the original submitter can update
      const userRole = (req.user?.role || 'Staff').toUpperCase();
      const isSuperUser = ['MASTER ADMIN', 'IT', 'ADMIN', 'ADMINISTRATOR'].includes(userRole) || req.user?.username.toLowerCase() === 'admin';
      
      if (!isSuperUser && req.user?.username) {
        const existing = getLocalExistingAccounts();
        const record = existing.find(item => item.id === id);
        if (record && (record.submittedBy || '').toLowerCase() !== req.user.username.toLowerCase()) {
          return res.status(403).json({ error: 'Permission denied: You can only update records you submitted.' });
        }
      }

      const updated = await updateLocalExistingAccount(id, req.body, username);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete a single existing account (requires admin/IT role or permission check)
  app.delete('/api/existing-accounts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const role = (req.user?.role || '').toUpperCase().trim();
      
      const allowedRoles = ['MASTER ADMIN', 'ADMINISTRATOR', 'ADMIN', 'IT', 'LEADER', 'ENCODER', 'USER', 'STAFF', 'CLERK', 'MEMBER'];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'Permission denied: Only administrators can delete records.' });
      }

      const id = req.params.id;

      // Access control: only superusers or original submitter can delete
      const isSuperUser = ['MASTER ADMIN', 'IT', 'ADMIN', 'ADMINISTRATOR'].includes(role) || req.user?.username.toLowerCase() === 'admin';
      if (!isSuperUser && req.user?.username) {
        const existing = getLocalExistingAccounts();
        const record = existing.find(item => item.id === id);
        if (record && (record.submittedBy || '').toLowerCase() !== req.user.username.toLowerCase()) {
          return res.status(403).json({ error: 'Permission denied: You can only delete records you submitted.' });
        }
      }

      const updatedAccounts = await deleteLocalExistingAccount(id, username);
      res.json({ success: true, message: 'Record successfully deleted.', data: updatedAccounts });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete/Clear a specific Barangay folder (requires admin role)
  app.delete('/api/existing-accounts/folder/:barangay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const role = (req.user?.role || '').toUpperCase().trim();
      
      const allowedRoles = ['MASTER ADMIN', 'ADMINISTRATOR', 'ADMIN', 'IT', 'LEADER', 'ENCODER', 'USER', 'STAFF', 'CLERK', 'MEMBER'];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'Permission denied: Only administrators can delete Barangay folders.' });
      }

      const barangay = req.params.barangay;
      const { updatedAccounts, deletedAccounts } = await deleteExistingAccountFolder(barangay, username);
      res.json({ success: true, message: `Barangay folder "${barangay}" has been deleted.`, data: updatedAccounts, deletedAccounts: deletedAccounts });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Clear/Delete ALL Existing Accounts
  app.delete('/api/existing-accounts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const role = (req.user?.role || '').toUpperCase().trim();
      
      const isMaster = role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || (req.user?.username || '').toLowerCase() === 'admin';
      if (!isMaster) {
        return res.status(403).json({ error: 'Permission denied: Only Master Admin can clear all existing accounts.' });
      }

      const updatedAccounts = await clearAllExistingAccounts(username);
      res.json({ success: true, message: 'All existing account records have been permanently cleared.', data: updatedAccounts });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Upload multiple files for an Existing Account
  app.post('/api/existing-accounts/:id/files', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const id = req.params.id;
      const { files, facebookLink, submitToBase44 } = req.body;
      if (files !== undefined && !Array.isArray(files)) {
        return res.status(400).json({ error: 'files must be an array of objects with fileName and fileData' });
      }
      const updated = await uploadFilesForExistingAccount(id, files || [], facebookLink, username, submitToBase44 === true);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Add household from Print List to Saint Francis Clinic Directory
  app.post('/api/contacts/add-from-household', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const contact = await addHouseholdToDirectory(req.body, username);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Add all pending households from Patient Data List to Clinic Directory (PCU / Barangay)
  app.post('/api/contacts/add-all-from-household', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const result = await addAllHouseholdsToDirectory(username);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clear all contacts in directory
  app.delete('/api/contacts/clear-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      await clearAllDirectoryContacts(username);
      res.json({ message: 'All contacts removed from Saint Francis Clinic Directory.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manual trigger to sync from Base44 Database
  app.post('/api/contacts/sync-base44', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const success = await syncBase44Contacts();
      if (success) {
        await addActivity(username, 'Manually synchronized clinic directory with Base44 Database.');
        res.json({ success: true, message: 'Contacts successfully synced from Base44 Database.' });
      } else {
        res.status(500).json({ error: 'Failed to sync with Base44 Database. Please check server logs.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add single contact
  app.post('/api/contacts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const full_name = req.body.full_name || req.body.fullName || '';
      const contact_number = req.body.contact_number || req.body.contactNumber || '';
      const barangay = req.body.barangay || req.body.address || '';
      const purok = req.body.purok || '';
      const latitude = req.body.latitude;
      const longitude = req.body.longitude;
      const geotagged = req.body.geotagged;
      const maintenance = req.body.maintenance;
      const maintenance_medicine = req.body.maintenance_medicine || req.body.maintenanceMedicine || '';
      const username = req.user?.username || 'Admin';

      const contact = await addContact({
        full_name,
        barangay,
        purok,
        contact_number,
        latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : undefined,
        geotagged: geotagged !== undefined ? Boolean(geotagged) : undefined,
        maintenance: maintenance !== undefined ? maintenance : 'None',
        maintenance_medicine: maintenance_medicine !== undefined ? maintenance_medicine : ''
      }, username);
      res.status(201).json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Edit contact
  app.put('/api/contacts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idRaw = req.params.id;
      const idNum = parseInt(idRaw, 10);
      const id = !isNaN(idNum) && String(idNum) === idRaw ? idNum : idRaw;
      const { full_name, barangay, purok, address, contact_number, latitude, longitude, geotagged, maintenance, maintenance_medicine } = req.body;
      const username = req.user?.username || 'Admin';

      const contact = await editContact(id, {
        full_name,
        barangay: barangay || address || '',
        purok,
        contact_number,
        latitude: latitude !== undefined ? (latitude === null ? null : parseFloat(latitude)) : undefined,
        longitude: longitude !== undefined ? (longitude === null ? null : parseFloat(longitude)) : undefined,
        geotagged: geotagged !== undefined ? !!geotagged : undefined,
        maintenance: maintenance !== undefined ? maintenance : undefined,
        maintenance_medicine: maintenance_medicine !== undefined ? maintenance_medicine : undefined
      }, username);
      res.json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Transfer contact directly from PCU Directory to Submit PCU under its Barangay folder (Files section)
  app.post('/api/contacts/:id/transfer-to-pcu', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idRaw = req.params.id;
      const idNum = parseInt(idRaw, 10);
      const id = !isNaN(idNum) && String(idNum) === idRaw ? idNum : idRaw;
      const username = req.user?.username || 'Admin';

      const result = await transferContactToSubmitPcu(id, username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Backward compatibility: forwards legacy submit-base44 to the new Submit PCU transfer workflow
  app.post('/api/contacts/:id/submit-base44', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idRaw = req.params.id;
      const idNum = parseInt(idRaw, 10);
      const id = !isNaN(idNum) && String(idNum) === idRaw ? idNum : idRaw;
      const username = req.user?.username || 'Admin';

      const result = await transferContactToSubmitPcu(id, username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Soft delete contact
  app.delete('/api/contacts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idRaw = req.params.id;
      const idNum = parseInt(idRaw, 10);
      const id = !isNaN(idNum) && String(idNum) === idRaw ? idNum : idRaw;
      const username = req.user?.username || 'Admin';

      await deleteContact(id, username);
      res.json({ success: true, message: 'Contact successfully soft-deleted.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk soft delete a Barangay folder (Admin only)
  app.delete('/api/contacts/folder/:barangay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const barangay = req.params.barangay;
      const username = req.user?.username || 'Admin';

      const userObj = req.user ? findUser(req.user.username) : null;
      const userRole = (userObj?.role || req.user?.role || '').toUpperCase();
      const isAdminRole = userRole === 'ADMINISTRATOR' || userRole === 'ADMIN' || userRole === 'MASTER ADMIN' || req.user?.username.toLowerCase() === 'admin' || userRole === 'IT';

      // Check permission - only Administrators are allowed to delete whole folders
      if (!isAdminRole) {
        return res.status(403).json({ error: 'Permission denied. Only Administrators can delete folders.' });
      }

      const result = await deleteBarangayFolderContacts(barangay, username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Upload photo for contact
  app.post('/api/contacts/:id/photo', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idRaw = req.params.id;
      const idNum = parseInt(idRaw, 10);
      const id = !isNaN(idNum) && String(idNum) === idRaw ? idNum : idRaw;
      const { photoDataUrl } = req.body;
      const username = req.user?.username || 'Admin';

      if (!photoDataUrl) {
        return res.status(400).json({ error: 'photoDataUrl is required.' });
      }

      const contact = await uploadContactPhoto(id, photoDataUrl, username);
      res.json(contact);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Upload PCU File for contact (supports single or multiple files)
  app.post('/api/contacts/:id/pcu', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idRaw = req.params.id;
      const idNum = parseInt(idRaw, 10);
      const id = !isNaN(idNum) && String(idNum) === idRaw ? idNum : idRaw;
      const { fullName, fileName, fileData, files, barangay, purok, contact_number, latitude, longitude, geotagged, isLastBatch, totalFilesCount, maintenance, maintenance_medicine } = req.body;
      const username = req.user?.username || 'Admin';

      const commonOptions = {
        barangay: typeof barangay === 'string' && barangay.trim() !== '' ? barangay.trim() : undefined,
        purok: typeof purok === 'string' ? purok : undefined,
        contact_number: typeof contact_number === 'string' ? contact_number : undefined,
        latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : undefined,
        geotagged: geotagged !== undefined ? Boolean(geotagged) : undefined,
        isLastBatch: isLastBatch !== undefined ? Boolean(isLastBatch) : true,
        totalFilesCount: typeof totalFilesCount === 'number' ? totalFilesCount : undefined,
        maintenance: typeof maintenance === 'string' ? maintenance : undefined,
        maintenance_medicine: typeof maintenance_medicine === 'string' ? maintenance_medicine : undefined
      };

      if (files && Array.isArray(files) && files.length > 0) {
        const contact = await addPCUUpdatesMultiple(id, fullName || 'Unknown Contact', files, username, commonOptions);
        return res.json(contact);
      }

      if (!fileName || !fileData) {
        return res.status(400).json({ error: 'fileName and fileData are required (or a non-empty files array).' });
      }

      const update = await addPCUUpdate(id, fullName || 'Unknown Contact', fileName, fileData, username, commonOptions);
      res.json(update);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dedicated Submit PCU Endpoint for Submit PCU page
  app.post('/api/pcu/submit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fullName, barangay, purok, contact_number, files, fileName, fileData, latitude, longitude, geotagged } = req.body;
      const username = req.user?.username || 'Admin';

      if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
        return res.status(400).json({ error: 'Full Name is required.' });
      }

      if (!barangay || typeof barangay !== 'string' || !barangay.trim()) {
        return res.status(400).json({ error: 'Barangay selection is required.' });
      }

      const fileList = Array.isArray(files) && files.length > 0
        ? files
        : (fileName && fileData ? [{ fileName, fileData }] : []);

      if (fileList.length === 0) {
        return res.status(400).json({ error: 'At least one PCU image or document file is required.' });
      }

      const options = {
        barangay: barangay.trim(),
        purok: typeof purok === 'string' ? purok.trim() : '',
        contact_number: typeof contact_number === 'string' ? contact_number.trim() : '',
        latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : undefined,
        longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : undefined,
        geotagged: geotagged !== undefined ? Boolean(geotagged) : undefined,
        isLastBatch: true,
        totalFilesCount: fileList.length
      };

      const result = await addPCUUpdatesMultiple('new', fullName.trim(), fileList, username, options);
      res.json({ success: true, message: 'PCU submitted successfully.', data: result });
    } catch (err: any) {
      console.error('[Submit PCU API Error]:', err);
      res.status(400).json({ error: err.message || 'Failed to submit PCU.' });
    }
  });

  // Permanently delete a PCU submission or individual file from Submit PCU page (Master Admin only)
  app.post('/api/pcu/submissions/delete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const role = (req.user?.role || '').toUpperCase().trim();
      const isMasterAdmin = role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || username.toLowerCase() === 'admin';

      if (!isMasterAdmin) {
        return res.status(403).json({ error: 'Access Denied: Only Master Admin can delete PCU files and submissions.' });
      }

      const { id, fullName, fileName, fileUrl, deleteAll } = req.body;

      if (!id && !fullName && !fileName && !fileUrl) {
        return res.status(400).json({ error: 'Identification (id, fullName, or file information) is required to delete.' });
      }

      const result = await permanentlyDeletePcuSubmission({
        id,
        fullName,
        fileName,
        fileUrl,
        deleteAll: Boolean(deleteAll),
        username
      });

      res.json(result);
    } catch (err: any) {
      console.error('[Delete PCU Submission API Error]:', err);
      res.status(400).json({ error: err.message || 'Failed to permanently delete PCU record.' });
    }
  });

  // Verify or update status of a PCU Submission (Files -> Verified / Pending -> Updated)
  app.post('/api/pcu/verify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const role = (req.user?.role || '').toUpperCase().trim();
      const isMasterAdmin = role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || username.toLowerCase() === 'admin';

      if (!isMasterAdmin) {
        return res.status(403).json({ error: 'Access Denied: Only Master Admin can modify PCU statuses or verification.' });
      }

      const { id, fullName, status = 'VERIFIED' } = req.body;

      if (!id && !fullName) {
        return res.status(400).json({ error: 'Identification (id or fullName) is required to update status.' });
      }

      const result = await updatePcuSubmissionStatus({
        id,
        fullName,
        status,
        username
      });

      res.json(result);
    } catch (err: any) {
      console.error('[Update PCU Submission API Error]:', err);
      res.status(400).json({ error: err.message || 'Failed to update PCU status.' });
    }
  });

  // Get current PCU Submission Base Rates (Verified & Pending rates saved in MySQL)
  app.get('/api/pcu/base-rate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const baseRate = getPcuBaseRate();
      const pendingBaseRate = getPcuPendingBaseRate();
      res.json({ baseRate, pendingBaseRate });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch base rates.' });
    }
  });

  // Update PCU Submission Base Rates (saved permanently to MySQL)
  app.post('/api/pcu/base-rate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const { baseRate, pendingBaseRate } = req.body;

      const rateNum = baseRate !== undefined ? Number(baseRate) : undefined;
      const pendingNum = pendingBaseRate !== undefined ? Number(pendingBaseRate) : undefined;

      const updatedRates = await setPcuBaseRate(rateNum as any, pendingNum as any);
      addActivity(username, `Updated PCU base rates: Verified=₱${updatedRates.baseRate.toFixed(2)}, Pending=₱${updatedRates.pendingBaseRate.toFixed(2)} (saved permanently to MySQL).`);

      res.json({
        success: true,
        baseRate: updatedRates.baseRate,
        pendingBaseRate: updatedRates.pendingBaseRate,
        message: `Base rates updated (Verified: ₱${updatedRates.baseRate.toFixed(2)}, Pending: ₱${updatedRates.pendingBaseRate.toFixed(2)}) and saved permanently to MySQL.`
      });
    } catch (err: any) {
      console.error('[PCU Base Rate Update Error]:', err);
      res.status(400).json({ error: err.message || 'Failed to update base rate.' });
    }
  });

  // Get PCU History and action logs (Files Section Clickable History)
  app.get('/api/pcu/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const history = getPcuHistory();
      res.json({ history });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch PCU history.' });
    }
  });

  // Get all PCU Submissions Settlements
  app.get('/api/pcu/settlements', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const settlements = getPcuSettlements();
      res.json({ settlements });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch settlements.' });
    }
  });

  // Record or update a salary settlement for a submitter (saved to MySQL)
  app.post('/api/pcu/settlements', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const { submitter, totalSubmissions, baseRate, totalSalary, amountPaid, paymentStatus, paymentMethod, referenceNotes } = req.body;

      if (!submitter || typeof submitter !== 'string' || !submitter.trim()) {
        return res.status(400).json({ error: 'Submitter name is required for settlement.' });
      }

      const settlement = await recordPcuSettlement({
        id: req.body.id,
        submitter: submitter.trim(),
        totalSubmissions: Number(totalSubmissions) || 0,
        baseRate: Number(baseRate) || getPcuBaseRate(),
        totalSalary: Number(totalSalary) || 0,
        amountPaid: amountPaid !== undefined ? Number(amountPaid) : (Number(totalSalary) || 0),
        paymentStatus: paymentStatus || 'SETTLED',
        paymentMethod: paymentMethod || 'CASH',
        referenceNotes: referenceNotes || '',
        settledBy: username,
        settledAt: req.body.settledAt || new Date().toISOString()
      });

      addActivity(username, `Recorded salary settlement for ${submitter}: ₱${(settlement.amountPaid || settlement.totalSalary).toFixed(2)} (${settlement.paymentStatus})`);

      res.json({ success: true, settlement, message: `Settlement for ${submitter} saved permanently to MySQL.` });
    } catch (err: any) {
      console.error('[PCU Settlement Record Error]:', err);
      res.status(400).json({ error: err.message || 'Failed to record settlement.' });
    }
  });

  // Delete a settlement record (Master Admin only)
  app.delete('/api/pcu/settlements/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'Admin';
      const role = (req.user?.role || '').toUpperCase().trim();
      const isMasterAdmin = role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || username.toLowerCase() === 'admin';

      if (!isMasterAdmin) {
        return res.status(403).json({ error: 'Access Denied: Only Master Admin can remove settlement records.' });
      }

      const { id } = req.params;
      await deletePcuSettlement(id);
      addActivity(username, `Deleted salary settlement record #${id}`);

      res.json({ success: true, message: 'Settlement record removed successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete settlement.' });
    }
  });

  // Authenticated route for barangays
  app.get('/api/barangays', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const barangays = getBarangayList();
      res.json({ barangays });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch barangays' });
    }
  });

  // Get all PCU Updates
  app.get('/api/contacts/pcu-updates', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await syncPCUUpdatesFromBase44(true);
      const updates = getPCUUpdates();
      res.json(updates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Recent Uploads for current uploader
  app.get('/api/contacts/recent-uploads', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await syncPCUUpdatesFromBase44(true);
      const username = req.user?.username || 'Admin';
      const { search, barangay, purok, sortBy, sortOrder, page, limit } = req.query;
      const data = getRecentUploads({
        username,
        search: search as string,
        barangay: barangay as string,
        purok: purok as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete/Remove PCU File from contact (restores household to Saint Francis Clinic Directory)
  app.delete('/api/contacts/:id/pcu', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idStr = req.params.id;
      const username = req.user?.username || 'Admin';
      
      const isExt = idStr.startsWith('ext_');
      if (isExt) {
        const updated = await restoreExistingAccountFiles(idStr, username);
        res.json(updated);
      } else {
        const idNum = parseInt(idStr, 10);
        const id = !isNaN(idNum) && String(idNum) === idStr ? idNum : idStr;
        const updatedContact = await removePCUFileFromContact(id, username);
        res.json(updatedContact);
      }
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk entries - step 1: Parse and generate validation preview
  app.post('/api/contacts/bulk-preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text, defaultBarangay, defaultPurok } = req.body;
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text content cannot be empty.' });
      }

      const preview = previewBulkImport(text, defaultBarangay, defaultPurok);
      res.json(preview);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bulk entries - step 2: Save bulk entries under a specified action
  app.post('/api/contacts/bulk-save', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      let { items, text, option = 'save_all', defaultBarangay, defaultPurok } = req.body;
      const username = req.user?.username || 'Admin';

      // Support direct saving from raw text if items array is not provided
      if ((!items || !Array.isArray(items) || items.length === 0) && text && typeof text === 'string' && text.trim().length > 0) {
        const preview = previewBulkImport(text, defaultBarangay, defaultPurok);
        items = preview.results;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No contact items or text provided to import.' });
      }

      const validOptions = ['save_all', 'add_as_new', 'skip_invalid', 'replace_duplicate'];
      const chosenOption = validOptions.includes(option) ? option : 'save_all';

      const summary = await saveBulkImport(items, chosenOption as any, username);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Dashboard Metrics & logs
  app.get('/api/dashboard/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (isCPanelDbConnected()) {
        try {
          const needsSync = await checkCPanelDbNeedsSync(true);
          if (needsSync) {
            await syncWithCPanelDb();
          }
        } catch (syncErr: any) {
          console.warn('[cPanel DB] Dashboard stats sync warning:', syncErr.message);
        }
      }
      const clientDate = req.query.date as string | undefined;
      const clientTz = req.query.tz as string | undefined;
      const stats = await getDashboardStatsAsync(clientDate, clientTz);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- cPanel MySQL Database Integration Endpoints (Main Database) ---

  // Get cPanel MySQL Database Status
  app.get(['/api/cpanel-db/status', '/api/sheets/status'], (req: Request, res: Response) => {
    try {
      const status = getCPanelDbStatus();
      res.json({
        ...status,
        // Legacy fallback fields so older client components don't crash
        sheetsStatus: {
          connected: false,
          autoConnected: false,
          error: 'Migrated to cPanel MySQL Database'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get cPanel MySQL Database Configuration (password masked for security)
  app.get(['/api/cpanel-db/config', '/api/sheets/config'], requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const config = loadCPanelDbConfig();
      res.json({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        hasPassword: Boolean(config.password),
        ssl: config.ssl,
        enabled: config.enabled
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save cPanel MySQL Database Configuration and test connection
  app.post(['/api/cpanel-db/config', '/api/sheets/config'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const existing = loadCPanelDbConfig();
      const newConfig = {
        host: req.body.host ? String(req.body.host).trim() : existing.host,
        port: req.body.port ? parseInt(req.body.port, 10) : existing.port,
        database: req.body.database ? String(req.body.database).trim() : existing.database,
        user: req.body.user ? String(req.body.user).trim() : existing.user,
        password: req.body.password !== undefined ? String(req.body.password) : existing.password,
        ssl: req.body.ssl !== undefined ? Boolean(req.body.ssl) : existing.ssl,
        enabled: req.body.enabled !== undefined ? Boolean(req.body.enabled) : true
      };

      await saveCPanelDbConfig(newConfig);
      const status = getCPanelDbStatus();
      if (status.connected) {
        try {
          await syncWithCPanelDb(username);
        } catch (syncErr: any) {
          console.warn('[cPanel DB] Initial sync warning:', syncErr.message);
        }
      }
      await addActivity(username, `Updated cPanel MySQL database connection settings (${newConfig.database || 'default'})`);

      res.json({
        success: true,
        message: status.connected
          ? 'cPanel MySQL Database connected and verified successfully!'
          : 'Database settings saved. Note: Connection could not be established immediately. Check host and credentials.',
        status
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Test cPanel MySQL Database connection without saving
  app.post('/api/cpanel-db/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = loadCPanelDbConfig();
      const testConfig = {
        host: req.body.host ? String(req.body.host).trim() : existing.host,
        port: req.body.port ? parseInt(req.body.port, 10) : existing.port,
        database: req.body.database ? String(req.body.database).trim() : existing.database,
        user: req.body.user ? String(req.body.user).trim() : existing.user,
        password: req.body.password !== undefined ? String(req.body.password) : existing.password,
        ssl: req.body.ssl !== undefined ? Boolean(req.body.ssl) : existing.ssl
      };

      const testResult = await testCPanelDbConnection(testConfig);
      res.json(testResult);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Migrate all application data to cPanel MySQL Database
  app.post('/api/cpanel-db/migrate', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const contacts = getAllContactsRaw();
      const users = getUsers();
      const existingAccounts = getAllExistingAccountsRaw();
      const barangays = getAllBarangaysRaw();
      const activities = getAllActivitiesRaw();
      const settings = getSiteSettings();

      const result = await migrateAllDataToCPanelDb({
        contacts,
        users,
        existingAccounts,
        barangays,
        activities,
        settings
      });

      await addActivity(username, `Performed full data migration to cPanel MySQL Database: ${result.message}`);
      res.json(result);
    } catch (err: any) {
      console.error('[cPanel DB Migration Error]', err);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Force sync / reload from cPanel MySQL Database
  app.post(['/api/cpanel-db/sync', '/api/sheets/sync'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      await reinitializePool();
      const result = await syncWithCPanelDb(username);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Download phpMyAdmin ready MySQL schema file
  app.get('/api/cpanel-db/schema.sql', (req: Request, res: Response) => {
    const sql = generateCPanelSchemaSql();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cpanel_database.sql"');
    res.send(sql);
  });

  // --- Database Backup Endpoints (Admin Only) ---

  // Get backup summary / statistics for cPanel MySQL database
  app.get('/api/backup/summary', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
      const backupData = await getFullCPanelDbBackupData(username, forceRefresh);
      res.json({
        success: true,
        metadata: backupData.metadata
      });
    } catch (err: any) {
      console.error('[Backup] Error getting backup summary:', err);
      res.status(500).json({ error: err.message || 'Failed to retrieve backup summary.' });
    }
  });

  // Download complete cPanel MySQL backup (as JSON or SQL file)
  app.get('/api/backup/download', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const format = (String(req.query.format || 'sql')).toLowerCase();
      const backupData = await getFullCPanelDbBackupData(username);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (format === 'json') {
        const jsonContent = formatBackupAsJson(backupData);
        const filename = `cpanel_database_backup_${timestamp}.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(jsonContent);
      } else {
        const sqlContent = formatBackupAsSql(backupData);
        const filename = `cpanel_database_backup_${timestamp}.sql`;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(sqlContent);
      }
    } catch (err: any) {
      console.error('[Backup] Error downloading backup:', err);
      res.status(500).json({ error: err.message || 'Failed to generate backup download.' });
    }
  });

  // Generate backup content for in-browser client preview/download
  app.post('/api/backup/export', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const format = (String(req.body?.format || 'sql')).toLowerCase();
      const backupData = await getFullCPanelDbBackupData(username);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (format === 'json') {
        const content = formatBackupAsJson(backupData);
        const filename = `cpanel_database_backup_${timestamp}.json`;
        return res.json({
          success: true,
          format: 'json',
          filename,
          content,
          metadata: backupData.metadata
        });
      } else {
        const content = formatBackupAsSql(backupData);
        const filename = `cpanel_database_backup_${timestamp}.sql`;
        return res.json({
          success: true,
          format: 'sql',
          filename,
          content,
          metadata: backupData.metadata
        });
      }
    } catch (err: any) {
      console.error('[Backup] Error generating backup export:', err);
      res.status(500).json({ error: err.message || 'Failed to export backup data.' });
    }
  });

  // Inspect and parse an uploaded backup file (.sql or .json) without applying changes
  app.post('/api/backup/upload-preview', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileContent, fileName } = req.body || {};
      if (!fileContent || typeof fileContent !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid fileContent in request body.' });
      }

      const parsed = parseBackupContent(fileContent, fileName || 'backup');
      res.json({
        success: true,
        preview: {
          format: parsed.format,
          fileName: parsed.fileName,
          totalTables: parsed.totalTables,
          totalRecords: parsed.totalRecords,
          tableCounts: parsed.tableCounts,
          tableSummaries: parsed.tableSummaries
        }
      });
    } catch (err: any) {
      console.error('[Backup] Error previewing uploaded backup:', err);
      res.status(400).json({ error: err.message || 'Failed to parse backup file.' });
    }
  });

  // Restore database from an uploaded backup file (.sql or .json)
  app.post('/api/backup/restore', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const { fileContent, fileName, mode } = req.body || {};
      if (!fileContent || typeof fileContent !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid fileContent in request body.' });
      }

      const restoreMode: 'merge' | 'replace' = mode === 'replace' ? 'replace' : 'merge';
      const result = await restoreBackupFromContent(fileContent, fileName || 'backup', restoreMode, username);

      res.json({
        success: true,
        message: result.message,
        details: result
      });
    } catch (err: any) {
      console.error('[Backup] Error restoring uploaded backup:', err);
      res.status(400).json({ error: err.message || 'Failed to restore database from backup.' });
    }
  });

  // --- Site Settings Endpoints ---

  // Support both /api/site/settings and /api/settings
  app.get(['/api/site/settings', '/api/settings'], async (req: Request, res: Response) => {
    try {
      const settings = getSiteSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save site settings (admin only)
  app.post(['/api/site/settings', '/api/settings'], requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const updated = saveSiteSettings(req.body);
      addActivity(username, 'Updated website customization and settings.');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Account Management Endpoints ---

  // Get Base44 database roles list
  app.get('/api/base44/roles', async (req: Request, res: Response) => {
    try {
      const roles = await getBase44Roles();
      res.json({ roles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all registered user accounts
  app.get('/api/users', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      try {
        await syncUsersFromCPanel();
      } catch (err: any) {
        console.warn('Could not sync users on getUsers request:', err.message);
      }
      const sheetsConfig = getSheetsConfig();
      if (sheetsConfig.syncEnabled) {
        try {
          await pullAdminsOnce();
        } catch (err: any) {
          if (!isQuotaOrRateLimitError(err)) {
            console.warn('Could not pull administrators on getUsers request (using local cache):', err.message);
          }
        }
      }
      const users = getUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create new user account by Admin (Auto-Approved)
  app.post(['/api/users/add', '/api/users'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = req.user?.username || 'admin';
      const newAccount = await addUserAccountByAdmin(req.body, actor);
      res.json({
        success: true,
        message: `Account for "${newAccount.fullName || newAccount.username}" successfully created and automatically approved!`,
        user: newAccount
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Edit user account
  app.put('/api/users/:username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username } = req.params;
      const actor = req.user?.username || 'admin';
      const updated = await editUserAccount(username, req.body, actor);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update user role
  app.put('/api/users/:username/role', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username } = req.params;
      const { role } = req.body;
      const actor = req.user?.username || 'admin';
      const updated = await updateUserRole(username, role, actor);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update user status
  app.put('/api/users/:username/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username } = req.params;
      const { status } = req.body;
      const actor = req.user?.username || 'admin';
      const updated = await updateUserStatus(username, status, actor);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete user account
  app.delete('/api/users/:username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUsername = req.params.username;
      const actor = req.user?.username || 'admin';
      await deleteAdminUser(targetUsername, actor);
      res.json({ success: true, message: `Account "${targetUsername}" successfully deleted.` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Administrator Management Endpoints ---

  // List all registered admins
  app.get('/api/admins', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      try {
        await syncUsersFromCPanel();
      } catch (err: any) {
        console.warn('Could not sync users on getAdmins request:', err.message);
      }
      const sheetsConfig = getSheetsConfig();
      if (sheetsConfig.syncEnabled) {
        try {
          await pullAdminsOnce();
        } catch (err: any) {
          if (!isQuotaOrRateLimitError(err)) {
            console.warn('Could not pull administrators on getAdmins request (using local cache):', err.message);
          }
        }
      }
      const admins = getUsers();
      res.json(admins);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new admin
  app.post('/api/admins', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, password } = req.body;
      const creator = req.user?.username || 'admin';
      const newAdmin = await createAdminUser(username, password, creator);
      res.json(newAdmin);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete an admin
  app.delete('/api/admins/:username', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUsername = req.params.username;
      const creator = req.user?.username || 'admin';
      await deleteAdminUser(targetUsername, creator);
      res.json({ success: true, message: `Administrator "${targetUsername}" deleted.` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- DATA MATCHING ENDPOINTS ---

  app.get('/api/matching/analysis', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const analysis = getMatchingAnalysis();
      res.json(analysis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/matching/merge', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contactId, accountId } = req.body;
      const username = req.user?.username || 'admin';
      
      if (!contactId || !accountId) {
        return res.status(400).json({ error: 'Both contactId and accountId are required' });
      }

      const result = await mergeAccountToContact(contactId, accountId, username);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/matching/create', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { accountId } = req.body;
      const username = req.user?.username || 'admin';

      if (!accountId) {
        return res.status(400).json({ error: 'accountId is required' });
      }

      const result = await createContactFromAccount(accountId, username);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/matching/auto', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const username = req.user?.username || 'admin';
      const result = await autoMergeAllPerfectMatches(username);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Serve Static Uploads Directory with byte integrity and caching ---
  const publicUploads = path.join(process.cwd(), 'public', 'uploads');
  const distUploads = path.join(process.cwd(), 'dist', 'uploads');
  const dataUploads = path.join(process.cwd(), 'data', 'uploads');

  for (const dir of [publicUploads, distUploads, dataUploads]) {
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
  }

  app.use('/uploads', express.static(publicUploads, { maxAge: '30d' }));
  app.use('/uploads', express.static(distUploads, { maxAge: '30d' }));
  app.use('/uploads', express.static(dataUploads, { maxAge: '30d' }));

  // Explicit route for uploaded files to guarantee reliable delivery across all runtimes
  app.get('/uploads/files/:filename', (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename);
    for (const dir of [publicUploads, distUploads, dataUploads]) {
      const filePath = path.join(dir, 'files', filename);
      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.sendFile(filePath);
      }
    }
    res.status(404).json({ error: 'Uploaded file not found.' });
  });

  // Dedicated file download endpoint
  app.get('/api/files/download/:filename', (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename);
    for (const dir of [publicUploads, distUploads, dataUploads]) {
      const filePath = path.join(dir, 'files', filename);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, filename);
      }
    }
    res.status(404).json({ error: 'File not found.' });
  });

  // --- Catch-all 404 for unmatched /api/* routes to prevent serving HTML ---
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
  });

  // --- Serve Frontend Application ---

  if (process.env.NODE_ENV !== 'production' && process.env.NETLIFY !== 'true' && !process.env.LAMBDA_TASK_ROOT) {
    // Integrate Vite development server middleware dynamically
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Share the Express HTTP server for the HMR WebSocket so live reload works behind a single-port proxy
        hmr: httpServer ? { server: httpServer } : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production serving of built client-side static bundle
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

if (process.env.NETLIFY !== 'true' && !process.env.LAMBDA_TASK_ROOT) {
  const httpServer = http.createServer();
  getApp(httpServer).then((app) => {
    const PORT = 3000;
    httpServer.on('request', app);
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[FULLSTACK SERVER] Running on http://0.0.0.0:${PORT} under environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }).catch((err) => {
    console.error('[FULLSTACK SERVER] Failed to start:', err);
  });
}
