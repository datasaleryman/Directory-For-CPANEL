import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings, 
  FileSpreadsheet, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Upload, 
  Globe, 
  Image as ImageIcon,
  RotateCcw,
  Save,
  ShieldCheck,
  User,
  Lock,
  Menu,
  UserPlus,
  Mail,
  MapPin,
  Eye,
  EyeOff,
  Search,
  Key,
  Shield,
  Sparkles,
  Check,
  Copy,
  Database,
  Server
} from 'lucide-react';
import { SheetsStatus } from '../types.js';
import { DEFAULT_SITE_LOGO } from '../App.js';
import { BackupDataSettings } from './BackupDataSettings.js';
import { CPanelDatabaseSettings } from './CPanelDatabaseSettings.js';

interface SettingsPageProps {
  authToken: string | null;
  sheetsStatus?: SheetsStatus;
  loadingSheets: boolean;
  onSyncComplete: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  siteSettings: {
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
    navVerificationEntry?: string;
    rolePermissions?: Record<string, string[]>;
  };
  onSettingsSaved: (updated: any) => void;
  adminUser?: any;
  onAdminUserUpdated?: (user: any, newToken?: string) => void;
  onDataRestored?: () => void;
  onNavigateTab?: (tab: string) => void;
}

const DEFAULT_ROLES = [
  'MASTER ADMIN',
  'IT',
  'LEADER',
  'CO-LEADER',
  'ADMIN',
  'ENCODER',
  'STAFF'
];

const DEFAULT_BARANGAYS = [
  'BALINTAWAK',
  'BALOBO',
  'BANALE',
  'BOMBONA',
  'BUENAVISTA',
  'BULATOC',
  'CABILINAN',
  'DANGCALAN',
  'DUMAGOC',
  'GUTAS',
  'KAWAYAN',
  'KAUSWAGAN',
  'LOWER BALINTAWAK',
  'LUMBIA',
  'MAHAYAG',
  'MANGGUSU',
  'MONTE ALEGRE',
  'NAPOLAN',
  'NAVALAN',
  'PAGADIAN',
  'PEDRO COLOMBO',
  'POLOYAGAN',
  'SAN FRANCISCO',
  'SAN JOSE',
  'SAN PEDRO',
  'SANTA CRUZ',
  'SANTA LUCIA',
  'SANTA MARIA',
  'SANTIAGO',
  'SANTO NINO',
  'SFC',
  'TIGUMA',
  'TUBURAN',
  'TULAWAS'
];

const APP_PAGES = [
  { id: 'dashboard', name: 'Dashboard', desc: 'Main overview & statistics' },
  { id: 'map', name: 'Clinic Map', desc: 'Geotagged patient map' },
  { id: 'directory', name: 'Clinic Directory', desc: 'Patient records & search' },
  { id: 'exist-acc-files', name: 'Exist. Acc. Files', desc: 'Patient uploaded archives and records list' },
  { id: 'member-verification', name: 'Member verification', desc: 'Search and verify clinical or community membership accounts' },
  { id: 'verification-entry', name: 'Verification Entry', desc: 'Sleek interface to search patients and submit a verification entry record' },
  { id: 'recent-upload', name: 'Recent Upload', desc: 'Private PCU upload archives' },
  { id: 'accounts', name: 'Account Management', desc: 'User accounts & roles' },
  { id: 'bulk', name: 'Bulk Entry', desc: 'CSV & batch patient imports' },
  { id: 'print', name: 'Print List', desc: 'Formatted printable directory' },
  { id: 'existing-account', name: 'Existing Account', desc: 'Directory of patient records flagged as existing accounts' },
  { id: 'admins', name: 'Admin Credentials', desc: 'Administrator username and credentials management' },
  { id: 'settings', name: 'Website Settings', desc: 'Branding & access rules' }
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  authToken,
  sheetsStatus,
  loadingSheets,
  onSyncComplete,
  showToast,
  siteSettings,
  onSettingsSaved,
  adminUser,
  onDataRestored,
  onNavigateTab
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'branding' | 'cpanelDb' | 'nav' | 'roles' | 'addAccount' | 'backup'>('branding');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form States
  const [title, setTitle] = useState(siteSettings.title);
  const [faviconTitle, setFaviconTitle] = useState(siteSettings.faviconTitle);
  const [logoDataUrl, setLogoDataUrl] = useState(siteSettings.logoDataUrl);
  const [faviconDataUrl, setFaviconDataUrl] = useState(siteSettings.faviconDataUrl);
  const [navDashboard, setNavDashboard] = useState(siteSettings.navDashboard || 'Dashboard');
  const [navMap, setNavMap] = useState(siteSettings.navMap || 'Clinic Map');
  const [navDirectory, setNavDirectory] = useState(siteSettings.navDirectory || 'Clinic Directory');
  const [navRecentUpload, setNavRecentUpload] = useState(siteSettings.navRecentUpload || 'Recent Upload');
  const [navAccounts, setNavAccounts] = useState(siteSettings.navAccounts || 'Account Management');
  const [navBulk, setNavBulk] = useState(siteSettings.navBulk || 'Bulk Entry');
  const [navPrint, setNavPrint] = useState(siteSettings.navPrint || 'Print List');
  const [navAdmins, setNavAdmins] = useState(siteSettings.navAdmins || 'Admin Credentials');
  const [navSettings, setNavSettings] = useState(siteSettings.navSettings || 'Website Settings');
  const [navExistingAccount, setNavExistingAccount] = useState(siteSettings.navExistingAccount || 'Existing Account');
  const [navExistAccFiles, setNavExistAccFiles] = useState(siteSettings.navExistAccFiles || 'Exist. Acc. Files');
  const [navVerificationEntry, setNavVerificationEntry] = useState(siteSettings.navVerificationEntry || 'Verification Entry');

  // Roles & Permissions States
  const [rolesList, setRolesList] = useState<string[]>(DEFAULT_ROLES);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(() => {
    return siteSettings.rolePermissions || {
      'MASTER ADMIN': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'IT': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'ADMIN': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'Administrator': ['dashboard', 'map', 'directory', 'recent-upload', 'accounts', 'bulk', 'print', 'existing-account', 'verification-entry', 'settings'],
      'LEADER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry'],
      'CO-LEADER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry'],
      'ENCODER': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry'],
      'STAFF': ['dashboard', 'map', 'directory', 'recent-upload', 'bulk', 'print', 'existing-account', 'verification-entry']
    };
  });

  // Add Account Form States
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBarangay, setNewBarangay] = useState('BALINTAWAK');
  const [newRole, setNewRole] = useState('STAFF');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [createdAccountDetails, setCreatedAccountDetails] = useState<any | null>(null);
  const [barangayList, setBarangayList] = useState<string[]>(DEFAULT_BARANGAYS);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [loadingAccountsList, setLoadingAccountsList] = useState(false);
  const [accountsSearchQuery, setAccountsSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Fetch barangays from Google Sheet database
  const fetchBarangays = async () => {
    try {
      const res = await fetch('/api/public/barangays');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.barangays) && data.barangays.length > 0) {
          setBarangayList(data.barangays);
          setNewBarangay(prev => prev || data.barangays[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch barangays:', err);
    }
  };

  // Fetch registered user accounts for live verification
  const fetchAccounts = async () => {
    if (!authToken) return;
    setLoadingAccountsList(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAccountsList(data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch accounts list:', err);
    } finally {
      setLoadingAccountsList(false);
    }
  };

  useEffect(() => {
    fetchBarangays();
    if (authToken) {
      fetchAccounts();
    }
  }, [authToken]);

  useEffect(() => {
    if (activeSettingsTab === 'addAccount' && authToken) {
      fetchAccounts();
    }
  }, [activeSettingsTab, authToken]);

  // Handle Add Account submit
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      showToast('Please enter the Full Name.', 'warning');
      return;
    }
    if (!newEmail.trim()) {
      showToast('Please enter the Email Address.', 'warning');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      showToast('Please enter a valid email address format (e.g. name@domain.com).', 'warning');
      return;
    }
    if (!newPassword.trim()) {
      showToast('Please enter the Password.', 'warning');
      return;
    }
    if (newPassword.trim().length < 4) {
      showToast('Password must be at least 4 characters long.', 'warning');
      return;
    }
    if (!newBarangay) {
      showToast('Please select a Barangay from the database.', 'warning');
      return;
    }
    if (!newRole) {
      showToast('Please select a Role Permission from the database.', 'warning');
      return;
    }

    setIsSubmittingAccount(true);
    try {
      const res = await fetch('/api/users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fullName: newFullName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword.trim(),
          barangay: newBarangay.trim(),
          role: newRole.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create new account.');
      }

      showToast(data.message || `Account for "${newFullName}" successfully created and automatically approved!`, 'success');
      setCreatedAccountDetails({
        ...data.user,
        plainPassword: newPassword.trim()
      });

      // Optimistically add to accountsList immediately to guarantee it is displayed permanently
      if (data.user) {
        setAccountsList(prev => {
          const filtered = prev.filter(
            acc => (acc.email && data.user.email && acc.email.toLowerCase() !== data.user.email.toLowerCase()) &&
                   (acc.username && data.user.username && acc.username.toLowerCase() !== data.user.username.toLowerCase())
          );
          return [data.user, ...filtered];
        });
      }

      // Clear input fields
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');

      // Refresh accounts list & sync state
      await fetchAccounts();
      onSyncComplete();
    } catch (err: any) {
      showToast(err.message || 'An error occurred while creating the account.', 'error');
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  // Toggle page access for a specific role
  const togglePageForRole = (roleName: string, pageId: string) => {
    setRolePermissions(prev => {
      const roleUpper = roleName.toUpperCase();
      const actualKey = Object.keys(prev).find(k => k.toUpperCase() === roleUpper) || roleName;
      const current = prev[actualKey] || [];
      const updated = current.includes(pageId)
        ? current.filter(p => p !== pageId)
        : [...current, pageId];
      return { ...prev, [actualKey]: updated };
    });
  };

  const grantAllPages = (roleName: string) => {
    setRolePermissions(prev => {
      const roleUpper = roleName.toUpperCase();
      const actualKey = Object.keys(prev).find(k => k.toUpperCase() === roleUpper) || roleName;
      return {
        ...prev,
        [actualKey]: APP_PAGES.map(p => p.id)
      };
    });
  };

  const clearAllPages = (roleName: string) => {
    setRolePermissions(prev => {
      const roleUpper = roleName.toUpperCase();
      const actualKey = Object.keys(prev).find(k => k.toUpperCase() === roleUpper) || roleName;
      return {
        ...prev,
        [actualKey]: []
      };
    });
  };

  // Fetch Base44 roles on mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('/api/base44/roles');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.roles) && data.roles.length > 0) {
            setRolesList(data.roles);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch roles:', err);
      }
    };
    fetchRoles();
  }, []);

  // Sync state if initial siteSettings changes
  useEffect(() => {
    setTitle(siteSettings.title);
    setFaviconTitle(siteSettings.faviconTitle);
    if (siteSettings.logoDataUrl !== undefined) {
      setLogoDataUrl(siteSettings.logoDataUrl);
    }
    if (siteSettings.faviconDataUrl !== undefined) {
      setFaviconDataUrl(siteSettings.faviconDataUrl);
    }
    setNavDashboard(siteSettings.navDashboard || 'Dashboard');
    setNavMap(siteSettings.navMap || 'Clinic Map');
    setNavDirectory(siteSettings.navDirectory || 'Clinic Directory');
    setNavRecentUpload(siteSettings.navRecentUpload || 'Recent Upload');
    setNavAccounts(siteSettings.navAccounts || 'Account Management');
    setNavBulk(siteSettings.navBulk || 'Bulk Entry');
    setNavPrint(siteSettings.navPrint || 'Print List');
    setNavAdmins(siteSettings.navAdmins || 'Admin Credentials');
    setNavSettings(siteSettings.navSettings || 'Website Settings');
    setNavExistingAccount(siteSettings.navExistingAccount || 'Existing Account');
    setNavExistAccFiles(siteSettings.navExistAccFiles || 'Exist. Acc. Files');
    setNavVerificationEntry(siteSettings.navVerificationEntry || 'Verification Entry');
    if (siteSettings.rolePermissions) {
      setRolePermissions(siteSettings.rolePermissions);
    }
  }, [siteSettings]);

  // Convert Date in local friendly format
  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Trigger Google Sheet database synchronization
  const handleSync = async () => {
    if (!authToken) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync with Database.');
      }
      showToast(data.message || 'Successfully synchronized with Database!', 'success');
      onSyncComplete();
    } catch (err: any) {
      showToast(err.message, 'error');
      onSyncComplete();
    } finally {
      setSyncing(false);
    }
  };

  // Convert file upload to base64 data URL with client-side optimization and resizing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast('Image size should be less than 50MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;

      // Optimize and resize the image client-side to standard logo/favicon size (max 256x256).
      // This ensures excellent visual quality while maintaining extremely compact base64 strings
      // that sync reliably to Google Sheets.
      const img = new Image();
      img.src = base64String;
      img.onload = () => {
        const maxWidth = 256;
        const maxHeight = 256;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Try to export as PNG first to preserve transparency for brand layouts
          let finalBase64 = canvas.toDataURL('image/png');
          // If PNG exceeds 40,000 chars, compress as JPEG to stay safely within limits
          if (finalBase64.length > 40000) {
            finalBase64 = canvas.toDataURL('image/jpeg', 0.85);
          }

          if (type === 'logo') {
            setLogoDataUrl(finalBase64);
            showToast('Website Logo uploaded and optimized! Click Save to persist changes.', 'info');
          } else if (type === 'favicon') {
            setFaviconDataUrl(finalBase64);
            showToast('Favicon uploaded and optimized! Click Save to persist changes.', 'info');
          }
        } else {
          // Fallback if canvas fails
          if (type === 'logo') {
            setLogoDataUrl(base64String);
            showToast('Website Logo updated! Click Save to persist.', 'info');
          } else if (type === 'favicon') {
            setFaviconDataUrl(base64String);
            showToast('Favicon updated! Click Save to persist.', 'info');
          }
        }
      };
      img.onerror = () => {
        if (type === 'logo') {
          setLogoDataUrl(base64String);
        } else if (type === 'favicon') {
          setFaviconDataUrl(base64String);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  // Save branding customizations to the backend
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    if (!title.trim()) {
      showToast('Website title cannot be empty.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/site/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: title.trim(),
          faviconTitle: faviconTitle.trim() || 'Saint Francis Clinic',
          logoDataUrl,
          faviconDataUrl,
          navDashboard: navDashboard.trim() || 'Dashboard',
          navMap: navMap.trim() || 'Clinic Map',
          navDirectory: navDirectory.trim() || 'Clinic Directory',
          navRecentUpload: navRecentUpload.trim() || 'Recent Upload',
          navAccounts: navAccounts.trim() || 'Account Management',
          navBulk: navBulk.trim() || 'Bulk Entry',
          navPrint: navPrint.trim() || 'Print List',
          navAdmins: navAdmins.trim() || 'Admin Credentials',
          navSettings: navSettings.trim() || 'Website Settings',
          navExistingAccount: navExistingAccount.trim() || 'Existing Account',
          navExistAccFiles: navExistAccFiles.trim() || 'Exist. Acc. Files',
          navVerificationEntry: navVerificationEntry.trim() || 'Verification Entry',
          rolePermissions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save branding settings.');
      }

      showToast('Website branding and titles successfully updated!', 'success');
      onSettingsSaved(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to original default clinic layout branding
  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all branding settings to defaults?')) {
      setTitle('Saint Francis Clinic Directory');
      setFaviconTitle('Saint Francis Clinic');
      setLogoDataUrl('');
      setFaviconDataUrl('');
      setNavDashboard('Dashboard');
      setNavMap('Clinic Map');
      setNavDirectory('Clinic Directory');
      setNavRecentUpload('Recent Upload');
      setNavAccounts('Account Management');
      setNavBulk('Bulk Entry');
      setNavPrint('Print List');
      setNavAdmins('Admin Credentials');
      setNavSettings('Website Settings');
      setNavExistingAccount('Existing Account');
      setNavExistAccFiles('Exist. Acc. Files');
      setNavVerificationEntry('Verification Entry');
      showToast('Form reset to default presets. Make sure to click Save to persist!', 'info');
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 md:p-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Settings className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold font-display">Website Settings & Branding</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-xl">
                Configure clinic identity, browser titles, custom logos, dynamic favicons, and manage real-time synchronization with your cPanel MySQL Database.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tab Bar */}
      <div className="flex items-center gap-2 sm:gap-3 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('branding')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'branding'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          General & Branding
        </button>
        <button
          type="button"
          id="cpanel-db-tab-button"
          onClick={() => setActiveSettingsTab('cpanelDb')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'cpanelDb'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Server className="w-4 h-4" />
          cPanel Database
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab('nav')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'nav'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Menu className="w-4 h-4" />
          Navigation Link Titles
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab('roles')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'roles'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Role Page Access Control
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSettingsTab('addAccount');
            fetchBarangays();
            if (authToken) fetchAccounts();
          }}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'addAccount'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Add Account
        </button>
        <button
          type="button"
          id="backup-data-tab-button"
          onClick={() => setActiveSettingsTab('backup')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeSettingsTab === 'backup'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          Backup Data
        </button>
      </div>

      {activeSettingsTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Side: Branding Form */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 font-display">Branding & Metadata</h4>
                  <p className="text-[11px] text-slate-500">Customize the look and name of your clinic portal</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Titles Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Website Title (Browser Tab)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all font-medium text-slate-800 text-sm outline-none"
                      placeholder="e.g. Saint Francis Clinic Directory"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Short Title (Sidebar & Header)
                    </label>
                    <input
                      type="text"
                      value={faviconTitle}
                      onChange={(e) => setFaviconTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all font-medium text-slate-800 text-sm outline-none"
                      placeholder="e.g. Saint Francis Clinic"
                    />
                  </div>
                </div>

                {/* Uploads Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                  {/* Logo Upload Card */}
                  <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-start mb-3">
                      Website Logo (Sidebar)
                    </span>
                    
                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 mb-4 shadow-xs">
                      <img src={logoDataUrl || DEFAULT_SITE_LOGO} alt="Logo preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>

                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={(e) => handleFileUpload(e, 'logo')}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Logo
                    </button>
                    {logoDataUrl && logoDataUrl !== DEFAULT_SITE_LOGO && (
                      <button
                        type="button"
                        onClick={() => setLogoDataUrl(DEFAULT_SITE_LOGO)}
                        className="text-[10px] text-rose-500 hover:underline mt-2 font-semibold cursor-pointer"
                      >
                        Reset to default logo
                      </button>
                    )}
                  </div>

                  {/* Favicon Upload Card */}
                  <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 flex flex-col items-center text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-start mb-3">
                      Favicon Icon (Browser Tab)
                    </span>

                    <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 mb-4 shadow-xs">
                      <img src={faviconDataUrl || DEFAULT_SITE_LOGO} alt="Favicon preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    </div>

                    <input
                      type="file"
                      ref={faviconInputRef}
                      onChange={(e) => handleFileUpload(e, 'favicon')}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => faviconInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Favicon
                    </button>
                    {faviconDataUrl && faviconDataUrl !== DEFAULT_SITE_LOGO && (
                      <button
                        type="button"
                        onClick={() => setFaviconDataUrl(DEFAULT_SITE_LOGO)}
                        className="text-[10px] text-rose-500 hover:underline mt-2 font-semibold cursor-pointer"
                      >
                        Reset to default favicon
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    disabled={saving}
                    className="px-3.5 py-2 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Defaults
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Branding Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Side: cPanel MySQL Database Connection summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 font-display">cPanel MySQL Database</h4>
                  <p className="text-[11px] text-slate-500">Main Relational Database • Zero Google Sheets Quotas</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Storage Engine</span>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          MySQL Primary
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('cpanelDb')}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all inline-flex items-center gap-1.5 border bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200/50 cursor-pointer"
                  >
                    <Server className="w-3 h-3" />
                    Manage DB
                  </button>
                </div>

                {/* Technical Details */}
                <div className="space-y-2 text-xs font-mono bg-slate-50/50 border border-slate-100 rounded-xl p-4">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Database Type:</span>
                    <span className="text-slate-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      cPanel MySQL
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Driver:</span>
                    <span className="text-slate-700 font-semibold">mysql2 (Connection Pool)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Google Sheets:</span>
                    <span className="text-rose-600 font-semibold">Decommissioned / Removed</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">phpMyAdmin Schema:</span>
                    <a
                      href="/api/cpanel-db/schema.sql"
                      download="cpanel_database.sql"
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      cpanel_database.sql ↓
                    </a>
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-950">
                  <span className="font-bold block flex items-center gap-1.5 text-indigo-900">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Ready for cPanel Hosting
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Full deployment files (<code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200/60">app.js</code>, <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200/60">.htaccess</code>, and <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200/60">cpanel_database.sql</code>) are configured in the codebase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CPANEL DATABASE CONFIGURATION & MANAGEMENT */}
      {activeSettingsTab === 'cpanelDb' && (
        <CPanelDatabaseSettings
          authToken={authToken}
          onSyncComplete={onSyncComplete}
          showToast={showToast}
        />
      )}

      {/* TAB 2: CUSTOMIZE NAVIGATION LINK TITLES */}
      {activeSettingsTab === 'nav' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Menu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 font-display">Customize Navigation Link Titles</h4>
                <p className="text-[11px] text-slate-500">Rename the sidebar menu link titles to match your clinic's terminology</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer self-start sm:self-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Link Titles
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dashboard Link Title
                </label>
                <input
                  type="text"
                  value={navDashboard}
                  onChange={(e) => setNavDashboard(e.target.value)}
                  placeholder="e.g. Dashboard"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Clinic Map Link Title
                </label>
                <input
                  type="text"
                  value={navMap}
                  onChange={(e) => setNavMap(e.target.value)}
                  placeholder="e.g. Clinic Map"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Clinic Directory Link Title
                </label>
                <input
                  type="text"
                  value={navDirectory}
                  onChange={(e) => setNavDirectory(e.target.value)}
                  placeholder="e.g. Clinic Directory"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Recent Upload Link Title
                </label>
                <input
                  type="text"
                  value={navRecentUpload}
                  onChange={(e) => setNavRecentUpload(e.target.value)}
                  placeholder="e.g. Recent Upload"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Account Management Link Title
                </label>
                <input
                  type="text"
                  value={navAccounts}
                  onChange={(e) => setNavAccounts(e.target.value)}
                  placeholder="e.g. Account Management"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Bulk Entry Link Title
                </label>
                <input
                  type="text"
                  value={navBulk}
                  onChange={(e) => setNavBulk(e.target.value)}
                  placeholder="e.g. Bulk Entry"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Print List Link Title
                </label>
                <input
                  type="text"
                  value={navPrint}
                  onChange={(e) => setNavPrint(e.target.value)}
                  placeholder="e.g. Print List"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Website Settings Link Title
                </label>
                <input
                  type="text"
                  value={navSettings}
                  onChange={(e) => setNavSettings(e.target.value)}
                  placeholder="e.g. Website Settings"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Existing Account Link Title
                </label>
                <input
                  type="text"
                  value={navExistingAccount}
                  onChange={(e) => setNavExistingAccount(e.target.value)}
                  placeholder="e.g. Existing Account"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Exist. Acc. Files Link Title
                </label>
                <input
                  type="text"
                  value={navExistAccFiles}
                  onChange={(e) => setNavExistAccFiles(e.target.value)}
                  placeholder="e.g. Exist. Acc. Files"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Verification Entry Link Title
                </label>
                <input
                  type="text"
                  value={navVerificationEntry}
                  onChange={(e) => setNavVerificationEntry(e.target.value)}
                  placeholder="e.g. Verification Entry"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Admin Credentials Link Title
                </label>
                <input
                  type="text"
                  value={navAdmins}
                  onChange={(e) => setNavAdmins(e.target.value)}
                  placeholder="e.g. Admin Credentials"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleResetSettings}
                disabled={saving}
                className="px-3.5 py-2 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Link Titles
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ROLE PAGE ACCESS CONTROL */}
      {activeSettingsTab === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 font-display">Role Page Access Control</h4>
                <p className="text-[11px] text-slate-500">Configure permitted application pages/tabs for each Base44 database role</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Permissions
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {rolesList.map((roleName) => {
              const roleUpper = roleName.toUpperCase();
              const actualKey = Object.keys(rolePermissions).find(k => k.toUpperCase() === roleUpper) || roleName;
              const allowedPages = rolePermissions[actualKey] || [];
              
              let roleBadgeColor = "bg-slate-100 text-slate-700 border-slate-200";
              if (roleName === 'MASTER ADMIN') roleBadgeColor = "bg-purple-100 text-purple-800 border-purple-200";
              else if (roleName === 'IT') roleBadgeColor = "bg-blue-100 text-blue-800 border-blue-200";
              else if (roleName === 'ADMIN' || roleName === 'Administrator') roleBadgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
              else if (roleName === 'LEADER') roleBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
              else if (roleName === 'CO-LEADER') roleBadgeColor = "bg-teal-100 text-teal-800 border-teal-200";
              else if (roleName === 'ENCODER') roleBadgeColor = "bg-amber-100 text-amber-800 border-amber-200";
              else if (roleName === 'STAFF') roleBadgeColor = "bg-slate-100 text-slate-800 border-slate-200";

              return (
                <div key={roleName} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase border ${roleBadgeColor}`}>
                        {roleName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ({allowedPages.length} / {APP_PAGES.length} pages enabled)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => grantAllPages(roleName)}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAllPages(roleName)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Page access toggles */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                    {APP_PAGES.map((page) => {
                      const isChecked = allowedPages.includes(page.id);
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => togglePageForRole(roleName, page.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <p className="text-xs font-bold truncate leading-tight">{page.name}</p>
                            <p className={`text-[9px] truncate ${isChecked ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {page.desc}
                            </p>
                          </div>
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isChecked ? 'bg-white text-emerald-700' : 'bg-slate-100 text-slate-300'
                          }`}>
                            {isChecked ? '✓' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Role Permissions
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ADD ACCOUNT (MASTER ADMIN) */}
      {activeSettingsTab === 'addAccount' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 font-display text-base sm:text-lg flex items-center gap-2">
                    Add New Account
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                      Auto-Approved
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Master Admin account creation portal with direct activation and real-time database synchronization.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    fetchBarangays();
                    fetchAccounts();
                  }}
                  disabled={loadingAccountsList}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAccountsList ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Notification Information Banner */}
            <div className="mt-4 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <p className="font-bold">Instant Account Activation & Real-Time Database Sync</p>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Accounts created by the Master Admin are <strong>automatically approved</strong> with active status and can log in immediately. The account record will also be synced directly to your database.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                  <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    Account Registration Form
                  </h5>
                  <span className="text-[11px] text-slate-400 font-medium">All fields required</span>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-4">
                  {/* Field 1: Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Full Name</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="e.g. Juan Dela Cruz / Maria Santos"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Field 2: Email Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="e.g. juandelacruz@clinic.gov.ph"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Field 3: Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Password</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Account password (min. 4 characters)"
                        required
                        minLength={4}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Field 4: Barangay */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        Barangay
                      </span>
                      <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                        Available ({barangayList.length})
                      </span>
                    </label>
                    <select
                      value={newBarangay}
                      onChange={(e) => setNewBarangay(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none cursor-pointer"
                    >
                      {barangayList.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Assigned barangay territory loaded directly from your database.
                    </p>
                  </div>

                  {/* Field 5: Role Permission */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Role Permission
                      </span>
                      <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                        System Roles ({rolesList.length})
                      </span>
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none cursor-pointer"
                    >
                      {rolesList.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Role controls which tabs and pages this user is permitted to view.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmittingAccount}
                      className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingAccount ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating & Auto-Approving...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Add Account (Auto-Approved)
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewFullName('');
                        setNewEmail('');
                        setNewPassword('');
                      }}
                      className="px-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Clear inputs"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>

              {/* Newly Created Account Info Card */}
              {createdAccountDetails && (
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Account Successfully Created & Auto-Approved!
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreatedAccountDetails(null)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Full Name</p>
                      <p className="font-bold text-slate-800 truncate">{createdAccountDetails.fullName || createdAccountDetails.username}</p>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Email</p>
                      <p className="font-bold text-slate-800 truncate">{createdAccountDetails.email || 'N/A'}</p>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Barangay</p>
                      <p className="font-bold text-emerald-700 truncate">{createdAccountDetails.barangay}</p>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Role Permission</p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold text-[10px] rounded">
                        {createdAccountDetails.role}
                      </span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 col-span-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Account Status</p>
                        <p className="font-bold text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Active (Automatically Approved)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const text = `Account Credentials:\nName: ${createdAccountDetails.fullName}\nEmail: ${createdAccountDetails.email}\nBarangay: ${createdAccountDetails.barangay}\nRole: ${createdAccountDetails.role}\nStatus: Active`;
                          navigator.clipboard.writeText(text);
                          setCopiedKey(true);
                          setTimeout(() => setCopiedKey(false), 2000);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedKey ? 'Copied!' : 'Copy Info'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Accounts List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h5 className="font-bold text-slate-800 font-display text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      Active System Accounts ({accountsList.length})
                    </h5>
                    <p className="text-[11px] text-slate-500">Live directory of registered clinic staff and administrator accounts</p>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      value={accountsSearchQuery}
                      onChange={(e) => setAccountsSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Accounts Table */}
                <div className="max-h-[460px] overflow-y-auto space-y-2.5 pr-1">
                  {loadingAccountsList ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <p className="text-xs">Loading active accounts...</p>
                    </div>
                  ) : accountsList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No accounts registered yet. Use the form to add the first account.
                    </div>
                  ) : (
                    accountsList
                      .filter((acc: any) => {
                        if (!accountsSearchQuery) return true;
                        const q = accountsSearchQuery.toLowerCase();
                        return (
                          (acc.fullName && acc.fullName.toLowerCase().includes(q)) ||
                          (acc.username && acc.username.toLowerCase().includes(q)) ||
                          (acc.email && acc.email.toLowerCase().includes(q)) ||
                          (acc.barangay && acc.barangay.toLowerCase().includes(q)) ||
                          (acc.role && acc.role.toLowerCase().includes(q))
                        );
                      })
                      .map((acc: any) => {
                        let roleBadgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                        const r = (acc.role || '').toUpperCase();
                        if (r === 'MASTER ADMIN') roleBadgeColor = "bg-purple-100 text-purple-800 border-purple-200";
                        else if (r === 'IT') roleBadgeColor = "bg-blue-100 text-blue-800 border-blue-200";
                        else if (r === 'ADMIN' || r === 'ADMINISTRATOR') roleBadgeColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
                        else if (r === 'LEADER') roleBadgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                        else if (r === 'CO-LEADER') roleBadgeColor = "bg-teal-100 text-teal-800 border-teal-200";
                        else if (r === 'ENCODER') roleBadgeColor = "bg-amber-100 text-amber-800 border-amber-200";
                        else if (r === 'STAFF') roleBadgeColor = "bg-slate-100 text-slate-800 border-slate-200";

                        const isActive = (acc.status || 'Active').toLowerCase() === 'active';

                        return (
                          <div
                            key={acc.username || acc.email}
                            className="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {(acc.fullName || acc.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-slate-800 truncate">
                                    {acc.fullName || acc.username}
                                  </p>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${roleBadgeColor}`}>
                                    {acc.role || 'Staff'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                  {acc.email && (
                                    <span className="flex items-center gap-1 text-slate-500 truncate">
                                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                      {acc.email}
                                    </span>
                                  )}
                                  {acc.barangay && (
                                    <span className="flex items-center gap-1 text-emerald-700 font-semibold truncate">
                                      <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                      {acc.barangay}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {isActive ? 'Active' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSettingsTab === 'backup' && (
        <BackupDataSettings
          authToken={authToken}
          showToast={showToast}
          onDataRestored={onDataRestored}
          onNavigateTab={onNavigateTab}
        />
      )}
    </div>
  );
};
