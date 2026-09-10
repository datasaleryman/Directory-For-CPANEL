import { useState, useEffect, useRef } from 'react';
import {
  Users,
  MapPin,
  FileSpreadsheet,
  Printer,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  Loader2,
  Lock,
  Menu,
  X,
  Settings,
  ChevronDown,
  User,
  UploadCloud,
  UserCheck,
  BadgeCheck,
  Database,
  Mail,
  Bell,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Contact, DashboardStats } from './types.js';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast.js';
import { Login } from './components/Login.js';
import { Dashboard } from './components/Dashboard.js';
import { ContactForm } from './components/ContactForm.js';
import { ContactTable } from './components/ContactTable.js';
import { BulkImport } from './components/BulkImport.js';
import { PrintPreview } from './components/PrintPreview.js';
import { AdminManagement } from './components/AdminManagement.js';
import { AccountManagement } from './components/AccountManagement.js';
import { SettingsPage } from './components/SettingsPage.js';
import { ProfileModal } from './components/ProfileModal.js';
import { ClinicMap } from './components/ClinicMap.js';
import { RecentUpload } from './components/RecentUpload.js';
import { ExistingAccount } from './components/ExistingAccount.js';
import { Inbox } from './components/Inbox.js';

export const DEFAULT_SITE_LOGO = 'https://www.image2url.com/r2/default/images/1785037750375-501bcf0e-4b15-4e0e-8be2-610bc89d072e.png';

export default function App() {
  // Authentication & Session States
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('dir_auth_token'));
  const [adminUser, setAdminUser] = useState<{ username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null>(() => {
    const saved = localStorage.getItem('dir_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation Panel Routing
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inbox' | 'map' | 'directory' | 'recent-upload' | 'accounts' | 'bulk' | 'print' | 'existing-account' | 'exist-acc-files' | 'admins' | 'settings'>('dashboard');
  
  // Mobile Navigation Drawer Open State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Profile Header Dropdown Menu State
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Data Entry Dropdown State
  const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);

  // Auto-expand "DATA ENTRY" if a sub-tab is active
  useEffect(() => {
    if (['bulk', 'print', 'existing-account'].includes(activeTab)) {
      setIsDataEntryOpen(true);
    }
  }, [activeTab]);

  const handleTabChange = (tab: 'dashboard' | 'inbox' | 'map' | 'directory' | 'recent-upload' | 'accounts' | 'bulk' | 'print' | 'existing-account' | 'exist-acc-files' | 'admins' | 'settings') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Branding Customization & Role Permissions States
  const [siteSettings, setSiteSettings] = useState<{
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
    navDashboard?: string;
    navMap?: string;
    navDirectory?: string;
    navRecentUpload?: string;
    navAccounts?: string;
    navBulk?: string;
    navPrint?: string;
    navAdmins?: string;
    navSettings?: string;
    navExistingAccount?: string;
    navExistAccFiles?: string;
    rolePermissions?: Record<string, string[]>;
  }>({
    title: 'PCU Uploader',
    faviconTitle: 'PCU Uploader',
    logoDataUrl: DEFAULT_SITE_LOGO,
    faviconDataUrl: DEFAULT_SITE_LOGO,
    navDashboard: 'Dashboard',
    navMap: 'Clinic Map',
    navDirectory: 'Clinic Directory',
    navRecentUpload: 'Recent Upload',
    navAccounts: 'Account Management',
    navBulk: 'Bulk Entry',
    navPrint: 'Print List',
    navAdmins: 'Admin Credentials',
    navSettings: 'Website Settings',
    navExistingAccount: 'Existing Account',
    navExistAccFiles: 'Exist. Acc. Files'
  });

  const userRole = adminUser?.role || 'STAFF';
  const isSuperUser = ['MASTER ADMIN', 'IT', 'ADMIN', 'Administrator', 'Master Admin'].includes(userRole);

  const hasTabPermission = (tabId: string) => {
    let targetTabId = tabId === 'exist-acc-files' ? 'existing-account' : tabId;
    if (targetTabId === 'inbox') {
      targetTabId = 'dashboard';
    }
    // Safety check: Prevent lockouts for administrative roles
    const usernameLower = adminUser?.username?.toLowerCase() || '';
    const roleUpper = userRole.toUpperCase();
    const isAdminAccount = usernameLower === 'admin' || 
                           roleUpper === 'MASTER ADMIN' || 
                           roleUpper === 'ADMINISTRATOR';

    if (isAdminAccount && (targetTabId === 'settings' || targetTabId === 'accounts')) {
      return true;
    }

    // Check custom role permissions case-insensitively
    if (siteSettings?.rolePermissions) {
      const matchingKey = Object.keys(siteSettings.rolePermissions).find(
        (key) => key.toUpperCase() === roleUpper
      );
      if (matchingKey) {
        const rolePerms = siteSettings.rolePermissions[matchingKey];
        if (Array.isArray(rolePerms)) {
          return rolePerms.includes(targetTabId);
        }
      }
    }

    // Default fallbacks if no customized permissions are configured
    if (isSuperUser) return true;
    if (targetTabId === 'settings' || targetTabId === 'accounts') return false;
    return true;
  };

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const fetchSettings = () => {
    if (activeTabRef.current === 'settings') {
      return;
    }
    fetch('/api/site/settings')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Received non-JSON content');
        }
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object') {
          const logo = data.logoDataUrl || DEFAULT_SITE_LOGO;
          const favicon = data.faviconDataUrl || DEFAULT_SITE_LOGO;
          setSiteSettings({
            ...data,
            logoDataUrl: logo,
            faviconDataUrl: favicon
          });
          if (data.title) {
            document.title = data.title;
          }
          // Update favicon link
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = favicon;
        }
      })
      .catch(err => {
        // Prevent console error noise for transient network errors / dev restarts / non-JSON fallbacks
        const errMsg = err?.message || '';
        if (
          err && (
            err.name === 'TypeError' ||
            err.name === 'AbortError' ||
            err.name === 'SyntaxError' ||
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('Network') ||
            errMsg.includes('load') ||
            errMsg.includes('Unexpected token') ||
            errMsg.includes('is not valid JSON') ||
            errMsg.includes('non-JSON') ||
            errMsg.includes('HTTP')
          )
        ) {
          console.warn('Site settings fetch suspended (server starting/restarting).');
        } else {
          console.error('Error fetching site settings:', err);
        }
      });
  };

  // Fetch settings on load, focus, and via polling
  useEffect(() => {
    fetchSettings();

    const handleFocus = () => {
      fetchSettings();
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(fetchSettings, 15000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Redirect if current active tab is not permitted for user's role
  useEffect(() => {
    if (adminUser && !hasTabPermission(activeTab)) {
      const allTabs = ['dashboard', 'inbox', 'map', 'directory', 'exist-acc-files', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account'];
      const allowed = allTabs.find(t => hasTabPermission(t));
      if (allowed) {
        setActiveTab(allowed as any);
      }
    }
  }, [adminUser, siteSettings.rolePermissions, activeTab]);

  // Directory Table Action Triggers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | Partial<Contact> | null>(null);
  const [mapNavigateContact, setMapNavigateContact] = useState<Contact | null>(null);

  // Stats State
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(() => ({
    totalContacts: 0,
    totalAddresses: 0,
    contactsToday: 0,
    recentActivities: [],
    sheetsStatus: {
      connected: true,
      autoConnected: true,
      lastAttempt: null,
      lastSuccess: null,
      error: null,
      config: {
        authType: 'serviceAccount',
        spreadsheetId: '1cgkalsSO_iY14v...',
        sheetName: 'Sheet1',
        clientEmail: 'sfc-contact-data@sfcpayroll.iam.gserviceaccount.com'
      }
    }
  }));
  const [loadingStats, setLoadingStats] = useState(false);

  // Animated Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType, duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Inbox & SubmissionMessage State & Polling
  const [messagesList, setMessagesList] = useState<any[]>([]);
  const [seenMessageIds, setSeenMessageIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seen_message_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [activePopupMessage, setActivePopupMessage] = useState<any | null>(null);

  // Ref to track if it is indeed the first fetch of messages to avoid spamming alerts on login
  const isFirstFetchRef = useRef(true);

  // Reset first fetch flag on auth changes
  useEffect(() => {
    isFirstFetchRef.current = true;
  }, [authToken, adminUser]);

  // Poll for messages to trigger notifications and badge updates
  useEffect(() => {
    if (!authToken) return;

    const checkNewMessages = async () => {
      try {
        const res = await fetch('/api/messages', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          let filteredData = data;
          if (adminUser && adminUser.username.toLowerCase() !== 'admin') {
            const usernameLower = adminUser.username.toLowerCase();
            const displayNameLower = (adminUser.displayName || '').toLowerCase().trim();
            const fullNameLower = (adminUser.fullName || '').toLowerCase().trim();
            const emailLower = (adminUser.email || '').toLowerCase().trim();
            const userBarangayLower = (adminUser.barangay || '').toLowerCase().trim();

            filteredData = data.filter((msg: any) => {
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
          }
          setMessagesList(filteredData);

          if (isFirstFetchRef.current) {
            isFirstFetchRef.current = false;
            // Initially mark all existing messages as "seen" so we don't spam popups, 
            // unless the user has never loaded them before.
            if (seenMessageIds.length === 0 && filteredData.length > 0) {
              const ids = filteredData.map((m: any) => m.id);
              setSeenMessageIds(ids);
              localStorage.setItem('seen_message_ids', JSON.stringify(ids));
            }
          } else {
            // Find newly arrived messages (not in our seen list)
            const unseen = filteredData.filter((m: any) => !seenMessageIds.includes(m.id));
            if (unseen.length > 0) {
              // Show popup for latest unseen message
              const sortedUnseen = unseen.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
                const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
                return dateB - dateA;
              });

              const latestUnseen = sortedUnseen[0];
              setActivePopupMessage(latestUnseen);
              
              // Show a nice desktop toast notification as well
              showToast(`New Message from ${latestUnseen.sender || 'System'}: "${latestUnseen.message || 'No content'}"`, 'info', 10000);
              
              // Automatically append all unseen messages to seen list
              const updatedSeen = [...seenMessageIds, ...unseen.map((m: any) => m.id)];
              setSeenMessageIds(updatedSeen);
              localStorage.setItem('seen_message_ids', JSON.stringify(updatedSeen));
            }
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || '';
        if (
          err?.name === 'TypeError' ||
          err?.name === 'AbortError' ||
          err?.name === 'SyntaxError' ||
          errMsg.includes('fetch') ||
          errMsg.includes('Network') ||
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('load') ||
          errMsg.includes('JSON') ||
          errMsg.includes('Unexpected token') ||
          errMsg.includes('is not valid JSON') ||
          errMsg.includes('non-JSON')
        ) {
          console.warn('Messages polling suspended (network/server starting/restarting).');
        } else {
          console.error('Error polling messages in App.tsx:', err);
        }
      }
    };

    checkNewMessages();
    const interval = setInterval(checkNewMessages, 15000); // 15-second polling interval for real-time response!
    return () => clearInterval(interval);
  }, [authToken, seenMessageIds, adminUser, isSuperUser]);

  // Fetch Dashboard Summary Stats
  const fetchStats = async () => {
    if (!authToken) return;
    setLoadingStats(true);
    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(data.error || 'Failed to refresh statistics.');
      }
      setDashboardStats(data);
    } catch (err: any) {
      if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        console.warn('Dashboard statistics fetch suspended (server starting/restarting).');
      } else {
        showToast(err.message || 'Failed to fetch statistics.', 'error');
      }
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchCurrentUser = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setAdminUser(data.user);
        localStorage.setItem('dir_admin_user', JSON.stringify(data.user));
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err: any) {
      if (err && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        console.warn('Current user details fetch suspended (server starting/restarting).');
      } else {
        console.error('Error fetching current user:', err);
      }
    }
  };

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    if (authToken) {
      fetchStats();
      fetchCurrentUser();
    }
  }, [authToken]);

  // Initial load and stats update
  useEffect(() => {
    if (!authToken) return;
    fetchStats();
  }, [authToken]);

  const handleLoginSuccess = (token: string, user: { username: string; role: string }) => {
    localStorage.setItem('dir_auth_token', token);
    localStorage.setItem('dir_admin_user', JSON.stringify(user));
    setAuthToken(token);
    setAdminUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('dir_auth_token');
    localStorage.removeItem('dir_admin_user');
    setAuthToken(null);
    setAdminUser(null);
    setIsMobileMenuOpen(false);
    showToast('Admin session logged out successfully.', 'success');
  };

  // Handles Quick Shortcut Actions from Dashboard Card Links
  const handleQuickAction = (action: 'add' | 'bulk' | 'print') => {
    setIsMobileMenuOpen(false);
    if (action === 'add') {
      setActiveTab('directory');
      setEditTarget(null);
      setIsFormOpen(true);
    } else if (action === 'bulk') {
      setActiveTab('bulk');
    } else if (action === 'print') {
      setActiveTab('print');
    }
  };

  // Triggers Single Contact Form Saves (Add or Edit update commits)
  const handleSaveContact = async (contact: {
    full_name: string;
    barangay?: string;
    purok?: string;
    address?: string;
    contact_number: string;
    latitude?: number | null;
    longitude?: number | null;
    geotagged?: boolean;
  }): Promise<boolean> => {
    if (!authToken) return false;

    try {
      const isEdit = Boolean(editTarget && 'id' in editTarget && (editTarget as Contact).id);
      const url = isEdit ? `/api/contacts/${(editTarget as Contact).id}` : '/api/contacts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(contact)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action failed.');
      }

      showToast(
        isEdit
          ? `Successfully updated contact record details for "${data.full_name}".`
          : `Contact record "${data.full_name}" registered successfully.`,
        'success'
      );

      // Reset and trigger stats reload
      setIsFormOpen(false);
      setEditTarget(null);
      fetchStats();
      return true;
    } catch (err: any) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const handleAddNewContact = (prefillName?: string) => {
    if (prefillName) {
      setEditTarget({ full_name: prefillName } as Partial<Contact>);
    } else {
      setEditTarget(null);
    }
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditTrigger = (contact: Contact) => {
    setEditTarget(contact);
    setIsFormOpen(true);
    // Smooth scroll to form view on small devices
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authToken || !adminUser) {
    return (
      <div className="font-sans antialiased bg-slate-50">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <Login onLoginSuccess={handleLoginSuccess} showToast={showToast} siteSettings={siteSettings} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex flex-col md:flex-row font-sans antialiased print:h-auto print:overflow-visible">
      {/* Toast Overlay notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        authToken={authToken}
        adminUser={adminUser}
        onAdminUserUpdated={(user, newToken) => {
          setAdminUser(user);
          localStorage.setItem('dir_admin_user', JSON.stringify(user));
          if (newToken) {
            setAuthToken(newToken);
            localStorage.setItem('dir_auth_token', newToken);
          }
        }}
        showToast={showToast}
      />

      {/* Backdrop overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden no-print"
        />
      )}

      {/* Primary Sidebar Control Panel - Hides when printing */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-950 text-slate-100 flex flex-col shrink-0 no-print border-r border-emerald-900/40 shadow-2xl transition-transform duration-300 ease-in-out
        md:static md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-emerald-900/40 bg-gradient-to-r from-emerald-900/40 via-emerald-800/20 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={siteSettings.logoDataUrl || DEFAULT_SITE_LOGO} 
              alt="Logo" 
              className="w-9 h-9 rounded-xl object-contain bg-white border border-emerald-800/40 shadow-sm" 
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="font-bold text-white font-display text-sm tracking-wide leading-tight">
                {siteSettings.faviconTitle || 'Saint Francis Clinic'}
              </h1>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mt-0.5">
                Clinic Directory
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Navigation Sidebar List */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {([
            { id: 'dashboard', label: siteSettings.navDashboard || 'Dashboard', icon: LayoutDashboard },
            { id: 'inbox', label: 'Inbox', icon: Mail },
            { id: 'map', label: siteSettings.navMap || 'Clinic Map', icon: MapPin },
            { id: 'directory', label: siteSettings.navDirectory || 'Patient List', icon: Users },
            { id: 'exist-acc-files', label: siteSettings.navExistAccFiles || 'Exist. Acc. Files', icon: UserCheck },
            { id: 'recent-upload', label: siteSettings.navRecentUpload || 'Recent Upload', icon: UploadCloud },
            { id: 'accounts', label: siteSettings.navAccounts || 'Account Management', icon: ShieldCheck },
          ] as const)
            .filter((item) => hasTabPermission(item.id))
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative overflow-hidden group focus:outline-none ${
                    isActive
                      ? 'text-white'
                      : 'text-emerald-100/70 hover:text-white hover:bg-emerald-900/30 border border-transparent hover:border-emerald-800/30'
                  }`}
                >
                  {/* Slidable active tab background capsule */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.35)] -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  {/* Pulsing indicator/border on hover (Framer Motion) */}
                  <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                    {isActive ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-100"></span>
                      </>
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-emerald-700/40 group-hover:bg-emerald-400 group-hover:scale-125 transition-all duration-300"></span>
                    )}
                  </span>

                  <div className="relative flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-all duration-300 ${
                      isActive 
                        ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.2)]' 
                        : 'text-emerald-300/60 group-hover:text-emerald-200 group-hover:rotate-6'
                    }`} />
                    <span className="truncate tracking-widest">{item.label}</span>
                    {item.id === 'inbox' && messagesList.filter(m => !seenMessageIds.includes(m.id)).length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded-full shadow-[0_2px_8px_rgba(244,63,94,0.4)] animate-pulse shrink-0">
                        {messagesList.filter(m => !seenMessageIds.includes(m.id)).length}
                      </span>
                    )}
                  </div>

                  {/* Elegant subtle hover overlay ripple/pulse animation */}
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </motion.button>
              );
            })}

          {/* Collapsible DATA ENTRY Dropdown */}
          {(() => {
            const dataEntryItems = [
              { id: 'bulk', label: siteSettings.navBulk || 'Bulk Entry', icon: FileSpreadsheet },
              { id: 'print', label: siteSettings.navPrint || 'Patient Data List', icon: Printer },
              { id: 'existing-account', label: siteSettings.navExistingAccount || 'Existing Account', icon: UserCheck },
            ] as const;

            const visibleDataEntryItems = dataEntryItems.filter((item) => hasTabPermission(item.id));
            if (visibleDataEntryItems.length === 0) return null;

            const isSubTabActive = visibleDataEntryItems.some((item) => activeTab === item.id);

            return (
              <div className="space-y-1">
                <button
                  onClick={() => setIsDataEntryOpen(!isDataEntryOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative group focus:outline-none ${
                    isSubTabActive 
                      ? 'text-white bg-emerald-950/40 border border-emerald-800/30' 
                      : 'text-emerald-100/70 hover:text-white hover:bg-emerald-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className={`w-4 h-4 shrink-0 transition-all duration-300 ${
                      isSubTabActive ? 'text-emerald-400' : 'text-emerald-300/60 group-hover:text-emerald-200'
                    }`} />
                    <span className="truncate tracking-widest">Data Entry</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-emerald-300/60 group-hover:text-emerald-200 transition-transform duration-200 ${
                    isDataEntryOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {isDataEntryOpen && (
                  <div className="pl-4 ml-3 border-l border-emerald-800/20 space-y-1.5 mt-1">
                    {visibleDataEntryItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => handleTabChange(item.id)}
                          whileHover={{ scale: 1.01, x: 2 }}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer relative overflow-hidden group focus:outline-none ${
                            isActive
                              ? 'text-white font-extrabold'
                              : 'text-emerald-200/60 hover:text-white hover:bg-emerald-900/20'
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeSubTabGlow"
                              className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 rounded-lg shadow-[0_2px_10px_rgba(16,185,129,0.25)] -z-10"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}

                          <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                            {isActive ? (
                              <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-100"></span>
                            ) : (
                              <span className="h-1 w-1 rounded-full bg-emerald-800/40 group-hover:bg-emerald-400 transition-all"></span>
                            )}
                          </span>

                          <div className="relative flex items-center gap-2 min-w-0">
                            <Icon className={`w-3.5 h-3.5 shrink-0 transition-all duration-300 ${
                              isActive 
                                ? 'text-white' 
                                : 'text-emerald-400/50 group-hover:text-emerald-300'
                            }`} />
                            <span className="truncate tracking-widest">{item.label}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </nav>

        {/* Sidebar Navigation Footer */}
        <div className="p-4 border-t border-emerald-900/40 bg-slate-950/40 text-center text-[10px] text-emerald-400/80 font-bold tracking-widest uppercase shrink-0">
          © 2026 {siteSettings.faviconTitle || 'Saint Francis Clinic'}
        </div>

      </aside>

      {/* Main Panel Content Window */}
      <main className="flex-1 min-w-0 overflow-y-auto print:overflow-visible print:h-auto">
        {/* Header - Single unified header for both desktop & mobile */}
        <header className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 border-b border-emerald-900/40 py-3.5 sm:py-4 px-4 sm:px-6 md:px-8 flex items-center justify-between no-print sticky top-0 z-40 text-white shadow-lg shadow-black/20 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-emerald-200 hover:text-white bg-emerald-900/50 hover:bg-emerald-900 rounded-xl transition-all cursor-pointer border border-emerald-800/40 shrink-0 shadow-xs"
              title="Open navigation menu"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img 
              src={siteSettings.logoDataUrl || DEFAULT_SITE_LOGO} 
              alt="Logo" 
              className="md:hidden w-8 h-8 rounded-lg object-contain bg-white border border-emerald-800/30 shrink-0" 
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg md:text-xl font-bold text-white font-display capitalize truncate">
                {activeTab === 'bulk' 
                  ? (siteSettings.navBulk || 'Bulk Entry Import') 
                  : activeTab === 'print' 
                    ? (siteSettings.navPrint || 'Formatted Print Directory') 
                    : activeTab === 'directory' 
                      ? 'PCU / Barangay' 
                      : activeTab === 'recent-upload'
                        ? (siteSettings.navRecentUpload || 'Recent Upload')
                        : activeTab === 'accounts'
                          ? (siteSettings.navAccounts || 'Account Management')
                          : activeTab === 'existing-account'
                            ? (siteSettings.navExistingAccount || 'Existing Account')
                          : activeTab === 'exist-acc-files'
                            ? (siteSettings.navExistAccFiles || 'Exist. Acc. Files')
                          : activeTab === 'admins' 
                            ? (siteSettings.navAdmins || 'Admin Credentials') 
                            : activeTab === 'settings'
                              ? (siteSettings.navSettings || 'Website Settings')
                              : activeTab === 'map'
                                ? (siteSettings.navMap || 'Clinic Map')
                                : (siteSettings.navDashboard || 'Dashboard Overview')}
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-300/80 mt-0.5 truncate hidden sm:block">
                Secure directory workspace • {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live System Status Pill */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-800/60 text-[11px] text-emerald-300 font-semibold shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span>System Online</span>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
                title="View administrator details & options"
              >
                {adminUser.avatarDataUrl ? (
                  <img
                    src={adminUser.avatarDataUrl}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover shadow-md shadow-emerald-900/30 border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold shadow-md shadow-emerald-900/30">
                    {adminUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold leading-tight">
                    {adminUser.displayName || `@${adminUser.username}`}
                  </p>
                  <p className="text-[10px] text-emerald-300/80 leading-tight capitalize">{adminUser.role}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-emerald-300/80 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    {/* Invisible backdrop layer to dismiss dropdown when clicking away */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProfileDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-slate-800"
                    >
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
                        {adminUser.avatarDataUrl ? (
                          <img
                            src={adminUser.avatarDataUrl}
                            alt="avatar"
                            className="w-10 h-10 rounded-full object-cover border border-slate-100"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                            {adminUser.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {adminUser.displayName || `@${adminUser.username}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate">
                            {adminUser.displayName ? `@${adminUser.username}` : adminUser.role}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setIsProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 font-semibold text-xs text-left transition-colors cursor-pointer border-b border-slate-100"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        Profile Settings
                      </button>
                      
                      {hasTabPermission('settings') && (
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            handleTabChange('settings');
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-emerald-700 font-semibold text-xs text-left transition-colors cursor-pointer border-b border-slate-100"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          {siteSettings.navSettings || 'Website Settings'}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-semibold text-xs text-left transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Log Out Session
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Tab Router Panels */}
        <div className="p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  stats={dashboardStats}
                  onQuickAction={handleQuickAction}
                  loading={loadingStats}
                  authToken={authToken}
                  onSyncComplete={fetchStats}
                  showToast={showToast}
                />
              )}

              {activeTab === 'inbox' && (
                <Inbox
                  authToken={authToken || ''}
                  showToast={showToast}
                  currentUser={adminUser}
                  onNewMessageReceived={(msg) => {
                    setActivePopupMessage(msg);
                  }}
                />
              )}

              {activeTab === 'map' && (
                <ClinicMap
                  authToken={authToken}
                  showToast={showToast}
                  initialNavigateContact={mapNavigateContact}
                  onClearInitialNavigateContact={() => setMapNavigateContact(null)}
                  lastSyncTime={lastSyncTime}
                  onBack={() => setActiveTab('directory')}
                />
              )}

              <div className={activeTab === 'directory' ? "space-y-6" : "hidden"}>
                {/* Single Contact Registration / Edit Slide Drawer Form */}
                {isFormOpen && (
                  <ContactForm
                    editTarget={editTarget}
                    onSave={handleSaveContact}
                    onCancel={() => {
                      setIsFormOpen(false);
                      setEditTarget(null);
                    }}
                    showToast={showToast}
                  />
                )}

                {/* Main Database Grid View */}
                <ContactTable
                  authToken={authToken}
                  lastSyncTime={lastSyncTime}
                  onEdit={handleEditTrigger}
                  onAddNewContact={handleAddNewContact}
                  onDeleted={fetchStats}
                  showToast={showToast}
                  siteSettings={siteSettings}
                  currentUser={adminUser}
                  onNavigateToMap={(contact) => {
                    setMapNavigateContact(contact);
                    setActiveTab('map');
                  }}
                  backNavigateContact={mapNavigateContact}
                  onClearBackNavigateContact={() => setMapNavigateContact(null)}
                />
              </div>

              {activeTab === 'recent-upload' && (
                <RecentUpload
                  authToken={authToken}
                  currentUsername={adminUser.username}
                  isAdmin={isSuperUser || userRole.toUpperCase().includes('ADMIN')}
                  showToast={showToast}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountManagement
                  authToken={authToken}
                  currentUsername={adminUser.username}
                  showToast={showToast}
                />
              )}

              {activeTab === 'bulk' && (
                <BulkImport
                  authToken={authToken}
                  onImportComplete={fetchStats}
                  onCancel={() => setActiveTab('dashboard')}
                  onGoToDirectory={() => setActiveTab('contacts')}
                  showToast={showToast}
                />
              )}

              {activeTab === 'print' && (
                <PrintPreview
                  authToken={authToken}
                  adminUser={adminUser.username}
                  onClose={() => setActiveTab('dashboard')}
                  showToast={showToast}
                  siteSettings={siteSettings}
                />
              )}

              {(activeTab === 'existing-account' || activeTab === 'exist-acc-files') && (
                <ExistingAccount
                  authToken={authToken}
                  showToast={showToast}
                  activeTab={activeTab}
                  currentUser={adminUser}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage
                  authToken={authToken}
                  sheetsStatus={dashboardStats?.sheetsStatus}
                  loadingSheets={loadingStats}
                  onSyncComplete={fetchStats}
                  showToast={showToast}
                  siteSettings={siteSettings}
                  onSettingsSaved={(updated) => {
                    setSiteSettings(updated);
                    if (updated.title) {
                      document.title = updated.title;
                    }
                    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
                    if (!link) {
                      link = document.createElement('link');
                      link.rel = 'icon';
                      document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    if (updated.faviconDataUrl) {
                      link.href = updated.faviconDataUrl;
                    } else {
                      link.href = '/favicon.ico';
                    }
                  }}
                  adminUser={adminUser}
                  onAdminUserUpdated={(user, newToken) => {
                    setAdminUser(user);
                    localStorage.setItem('dir_admin_user', JSON.stringify(user));
                    if (newToken) {
                      setAuthToken(newToken);
                      localStorage.setItem('dir_auth_token', newToken);
                    }
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Automation Popup for New Message */}
      <AnimatePresence>
        {activePopupMessage && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs no-print">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center animate-bounce">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    New Submission Message!
                  </h3>
                  <p className="text-[10px] text-teal-100 font-bold">
                    Automation Alert
                  </p>
                </div>
                <button
                  onClick={() => setActivePopupMessage(null)}
                  className="ml-auto text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4.5 space-y-2.5">
                  <div className="text-xs">
                    <span className="font-black text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">
                      Sender:
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      {activePopupMessage.sender || activePopupMessage.senderName || activePopupMessage.fullName || activePopupMessage.from || 'Anonymous Sender'}
                    </span>
                  </div>
                  
                  <div className="text-xs border-t border-slate-200/50 pt-2.5">
                    <span className="font-black text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">
                      Message:
                    </span>
                    <span className="font-semibold text-slate-600 italic block leading-relaxed">
                      "{activePopupMessage.message || activePopupMessage.content || activePopupMessage.body || 'No content'}"
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      setActivePopupMessage(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => {
                      setActivePopupMessage(null);
                      setActiveTab('inbox');
                    }}
                    className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    View Inbox
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
