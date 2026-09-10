import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Filter, ShieldCheck, Mail, MapPin, Trash2, CheckCircle2, AlertCircle, Clock, ShieldAlert, Loader2, User, UserCheck, RefreshCw, X, Edit3, Shield, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface UserAccount {
  username: string;
  email: string;
  fullName: string;
  barangay: string;
  role: string;
  status: 'Active' | 'Pending' | 'Suspended';
  createdAt: string;
  displayName?: string;
  avatarDataUrl?: string;
  passwordPlain?: string;
}

interface AccountManagementProps {
  authToken: string;
  currentUsername: string;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

const NON_BARANGAY_VALUES = new Set([
  'ALL',
  'ALL BARANGAYS',
  'ALL ADDRESSES',
  'ALL BARANGAY',
  'ALL ADDRESS',
  'SELECT',
  'SELECT BARANGAY',
  'SELECT ADDRESS',
  'UNKNOWN',
  'N/A',
  'NONE',
  'NULL',
  'UNDEFINED',
  'OTHER',
  'OTHERS',
  'PAGADIAN',
  'PAGADIAN CITY',
  'ZAMBOANGA DEL SUR'
]);

function isRealBarangay(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  if (NON_BARANGAY_VALUES.has(upper)) return false;
  if (upper.startsWith('ALL ') || upper.startsWith('SELECT ') || upper.startsWith('FILTER ')) return false;
  return true;
}

const UserAvatar: React.FC<{ user: UserAccount; size?: string; className?: string }> = ({
  user,
  size = "w-9 h-9",
  className = ""
}) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = user.avatarDataUrl;

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const displayName = user.fullName || user.displayName || user.username || '?';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        onError={() => setImgError(true)}
        className={`${size} rounded-full object-cover border border-emerald-300/80 shadow-2xs shrink-0 ${className}`}
      />
    );
  }

  return (
    <div className={`${size} rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-200 shrink-0 uppercase ${className}`}>
      {initial}
    </div>
  );
};

export const AccountManagement: React.FC<AccountManagementProps> = ({
  authToken,
  currentUsername,
  showToast
}) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (username: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('All Barangays');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [recentlyApprovedUsernames, setRecentlyApprovedUsernames] = useState<string[]>([]);

  const normalizeStatus = (status?: string): 'Active' | 'Pending' | 'Suspended' => {
    if (!status) return 'Active';
    const s = status.trim().toLowerCase();
    if (s.startsWith('pend')) return 'Pending';
    if (s.startsWith('susp') || s.startsWith('inact') || s.startsWith('block') || s === 'disabled') return 'Suspended';
    return 'Active';
  };

  // Base44 roles state
  const [base44Roles, setBase44Roles] = useState<string[]>([
    'Administrator',
    'Admin',
    'Master Admin',
    'Leader',
    'Co-Leader',
    'IT',
    'Encoder',
    'Data Encoder',
    'Staff',
    'User',
    'Barangay Health Worker',
    'Clinic Doctor',
    'Clinic Nurse',
    'Barangay Official'
  ]);

  // Modal State for Adding New User
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBarangay, setRegBarangay] = useState('');
  const [regRole, setRegRole] = useState('Staff');
  const [creating, setCreating] = useState(false);

  // Modal State for Editing User
  const [editTarget, setEditTarget] = useState<UserAccount | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editRole, setEditRole] = useState('Staff');
  const [editStatus, setEditStatus] = useState<'Active' | 'Pending' | 'Suspended'>('Active');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Barangay selection list
  const DEFAULT_BARANGAYS = [
    'Navalan',
    'Kalingayan',
    'Dampalan',
    'SAN JOSE',
    'SAN FRANCISCO',
    'SANTA MARIA',
    'Dumalinao',
    'NAPOLAN',
    'Balangasan',
    'Tuburan',
    'Lumbia',
    'Banale',
    'Bulatok',
    'Dumagoc',
    'Kawit',
    'Muricay',
    'Santiago',
    'Santo Niño',
    'Sta. Lucia',
    'Tawagan Sur',
    'Tiguma',
    'White Beach',
    'Dao',
    'SAN PEDRO',
    'Buenavista',
    'SFC'
  ];

  const [barangayList, setBarangayList] = useState<string[]>(DEFAULT_BARANGAYS);
  const [fetchingBarangays, setFetchingBarangays] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch registered accounts
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch registered user accounts.');
      }
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles from Base44 database
  const fetchBase44Roles = async () => {
    try {
      const res = await fetch('/api/base44/roles');
      const data = await res.json();
      if (res.ok && Array.isArray(data.roles) && data.roles.length > 0) {
        setBase44Roles(data.roles);
      }
    } catch (err) {
      console.warn('Failed to fetch Base44 roles:', err);
    }
  };

  // Fetch barangays dropdown
  const fetchBarangays = async () => {
    setFetchingBarangays(true);
    try {
      const res = await fetch('/api/public/barangays');
      const data = await res.json();
      if (res.ok && Array.isArray(data.barangays)) {
        const filtered = data.barangays.filter((b: string) => isRealBarangay(b));
        setBarangayList(filtered);
        if (filtered.length > 0 && (!regBarangay || !isRealBarangay(regBarangay))) {
          setRegBarangay(filtered[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load barangay list:', err);
    } finally {
      setFetchingBarangays(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchAccounts();
      fetchBarangays();
      fetchBase44Roles();
    }
  }, [authToken]);

  // Handle Add Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regPassword.trim() || !regBarangay.trim()) {
      showToast('All fields are required.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const endpoint = authToken ? '/api/users/add' : '/api/auth/register';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: regFullName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword.trim(),
          barangay: regBarangay.trim(),
          role: regRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register account.');
      }

      showToast(data.message || `User account for "${regFullName}" successfully created and saved permanently to database!`, 'success');
      setRegFullName('');
      setRegEmail('');
      setRegPassword('');
      setIsAddModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Open edit modal
  const openEditModal = (acc: UserAccount) => {
    setEditTarget(acc);
    setEditFullName(acc.fullName || acc.displayName || '');
    setEditEmail(acc.email || '');
    let bg = (acc.barangay || '').trim();
    if (!isRealBarangay(bg)) {
      bg = barangayList.find(isRealBarangay) || 'BARANGAY CENTRAL';
    }
    setEditBarangay(bg);
    setEditRole(acc.role || 'Staff');
    setEditStatus(acc.status || 'Active');
    setEditPassword('');
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    if (!editFullName.trim() || !editBarangay.trim()) {
      showToast('Full Name and Barangay are required.', 'warning');
      return;
    }

    if (editEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editEmail.trim())) {
        showToast('Please enter a valid email address.', 'warning');
        return;
      }
    }

    if (editPassword.trim()) {
      if (editPassword.trim().length < 4) {
        showToast('Password must be at least 4 characters long.', 'warning');
        return;
      }
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(editTarget.username)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          email: editEmail.trim(),
          barangay: editBarangay.trim(),
          role: editRole,
          status: editStatus,
          password: editPassword.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account.');
      }

      showToast(`Account @${editTarget.username} updated successfully!`, 'success');
      setEditTarget(null);
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Role Change inline
  const handleRoleChange = async (username: string, newRole: string) => {
    // Optimistic update
    setAccounts(prev => prev.map(a => a.username.toLowerCase() === username.toLowerCase() ? { ...a, role: newRole } : a));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user role.');
      }
      showToast(`Role for @${username} updated to ${newRole}.`, 'success');
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
      fetchAccounts();
    }
  };

  // Handle Status Toggle (Active <-> Suspended)
  const handleStatusToggle = async (username: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    // Optimistic update
    setAccounts(prev => prev.map(a => a.username.toLowerCase() === username.toLowerCase() ? { ...a, status: nextStatus } : a));
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user status.');
      }
      showToast(`Account @${username} status is now ${nextStatus}.`, 'success');
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
      fetchAccounts();
    }
  };

  // Handle Approve Pending Account
  const handleApproveAccount = async (username: string) => {
    // Optimistic update
    setAccounts(prev => prev.map(a => a.username.toLowerCase() === username.toLowerCase() ? { ...a, status: 'Active' as const } : a));
    
    // Auto-reset filters so the approved account is guaranteed to be in view immediately
    setStatusFilter('All Statuses');
    setBarangayFilter('All Barangays');
    setRoleFilter('All Roles');
    setSearch('');

    // Highlight the approved account so the admin can clearly see where it is
    const lowerUser = username.toLowerCase();
    setRecentlyApprovedUsernames(prev => [...prev.filter(u => u !== lowerUser), lowerUser]);
    setTimeout(() => {
      setRecentlyApprovedUsernames(prev => prev.filter(u => u !== lowerUser));
    }, 15000);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ status: 'Active' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve account.');
      }
      showToast(`Account @${username} approved successfully! Account is now Active and listed in the directory.`, 'success');
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
      fetchAccounts();
    }
  };

  // Handle Account Deletion
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetUsername = deleteTarget.username;
    setAccounts(prev => prev.filter(a => a.username.toLowerCase() !== targetUsername.toLowerCase()));
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(targetUsername)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user account.');
      }
      showToast(`Account "@${targetUsername}" permanently deleted.`, 'success');
      setDeleteTarget(null);
      fetchAccounts();
    } catch (err: any) {
      showToast(err.message, 'error');
      fetchAccounts();
    } finally {
      setDeleting(false);
    }
  };

  // Unique Barangays for filter dropdown
  const uniqueBarangaysInAccounts = Array.from(
    new Set([...barangayList, ...accounts.map(a => a.barangay).filter(Boolean)])
  ).sort();

  // Filtered accounts list
  const filteredAccounts = accounts.filter(acc => {
    const isRecentlyApproved = recentlyApprovedUsernames.includes(acc.username.toLowerCase());
    if (isRecentlyApproved) return true;

    const normStatus = normalizeStatus(acc.status);
    const matchesSearch =
      search === '' ||
      acc.username.toLowerCase().includes(search.toLowerCase()) ||
      (acc.fullName && acc.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (acc.email && acc.email.toLowerCase().includes(search.toLowerCase()));

    const matchesBarangay =
      barangayFilter === 'All Barangays' || acc.barangay === barangayFilter;

    const matchesRole = roleFilter === 'All Roles' || acc.role === roleFilter;

    const matchesStatus =
      statusFilter === 'All Statuses' ||
      normStatus === statusFilter;

    return matchesSearch && matchesBarangay && matchesRole && matchesStatus;
  }).sort((a, b) => {
    const aApproved = recentlyApprovedUsernames.includes(a.username.toLowerCase()) ? 1 : 0;
    const bApproved = recentlyApprovedUsernames.includes(b.username.toLowerCase()) ? 1 : 0;
    if (aApproved !== bApproved) return bApproved - aApproved;
    return (a.fullName || a.username).localeCompare(b.fullName || b.username);
  });

  const activeCount = accounts.filter(a => normalizeStatus(a.status) === 'Active').length;
  const pendingAccounts = accounts.filter(a => normalizeStatus(a.status) === 'Pending');
  const pendingCount = pendingAccounts.length;
  const adminCount = accounts.filter(a => a.role === 'Administrator').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xs border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              Administrative Directory
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight font-display">Account Management</h2>
            <p className="text-xs text-slate-500 mt-1">
              Manage user accounts, edit profiles, assign Base44 roles, approve new registrations, and control access permissions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                fetchAccounts();
                fetchBase44Roles();
              }}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 min-h-[42px]"
              title="Refresh directory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 min-h-[42px]"
            >
              <UserPlus className="w-4 h-4" />
              Register New Account
            </button>
          </div>
        </div>

        {/* Quick Summary Widgets (Clickable Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-5 sm:pt-6">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('All Statuses');
              setRoleFilter('All Roles');
            }}
            className={`text-left rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer ${
              statusFilter === 'All Statuses' && roleFilter === 'All Roles'
                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/30'
                : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/80'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Total Users</div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 mt-1 font-display">{accounts.length}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Active')}
            className={`text-left rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer ${
              statusFilter === 'Active'
                ? 'bg-emerald-100/70 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-emerald-50/60 border-emerald-200/60 hover:bg-emerald-100/50'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">Active Accounts</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-1 font-display">{activeCount}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Pending')}
            className={`text-left rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer ${
              statusFilter === 'Pending'
                ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500/30'
                : pendingCount > 0
                ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/70'
                : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/80'
            }`}
          >
            <div className={`text-[10px] font-extrabold uppercase tracking-widest ${pendingCount > 0 ? 'text-amber-850 flex items-center gap-1' : 'text-slate-500'}`}>
              {pendingCount > 0 && <Clock className="w-3 h-3 text-amber-600 animate-pulse shrink-0" />}
              <span className="truncate">Pending Approval</span>
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 font-display ${pendingCount > 0 ? 'text-amber-900' : 'text-slate-800'}`}>{pendingCount}</div>
          </button>

          <button
            type="button"
            onClick={() => setRoleFilter('Administrator')}
            className={`text-left rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer ${
              roleFilter === 'Administrator'
                ? 'bg-purple-100/80 border-purple-500 ring-2 ring-purple-500/30'
                : 'bg-purple-50/60 border-purple-200/60 hover:bg-purple-100/50'
            }`}
          >
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-purple-800">Administrators</div>
            <div className="text-xl sm:text-2xl font-black text-purple-800 mt-1 font-display">{adminCount}</div>
          </button>
        </div>
      </div>

      {/* Pending Account Requests Approval Banner */}
      {pendingAccounts.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-300/60 text-amber-800 flex items-center justify-center font-bold shrink-0">
                <Clock className="w-5 h-5 text-amber-700 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-amber-950 font-display">
                  Pending Registration Approvals ({pendingAccounts.length})
                </h3>
                <p className="text-xs text-amber-800 font-medium">
                  The following user accounts have registered and require administrator approval before they can log in.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingAccounts.map((acc) => (
              <div key={acc.username} className="bg-white rounded-2xl p-4 border border-amber-200/60 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-3">
                    <UserAvatar user={acc} size="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-slate-800 text-sm truncate">
                          {acc.fullName || acc.displayName || `@${acc.username}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-200/80 shrink-0">
                          Pending
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">@{acc.username} • {acc.email || `${acc.username}@clinic.gov.ph`}</div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-teal-700 mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" /> {acc.barangay || 'Central'} • {acc.role || 'Staff'}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleApproveAccount(acc.username)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs min-h-[38px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => setDeleteTarget(acc)}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[38px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Table Controls */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, or email address..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all min-h-[42px]"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs font-bold text-slate-600 min-h-[42px]">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer w-full text-xs"
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending Approval</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            {/* Barangay Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs font-bold text-slate-600 min-h-[42px]">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer w-full text-xs"
              >
                <option value="All Barangays">All Barangays</option>
                {uniqueBarangaysInAccounts.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs font-bold text-slate-600 min-h-[42px]">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent outline-none cursor-pointer w-full text-xs"
              >
                <option value="All Roles">All Roles</option>
                {base44Roles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* User Table */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading user accounts directory...</p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No matching user accounts found</h4>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or register a new account.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">User / Account</th>
                  <th className="py-3.5 px-4">Contact Email</th>
                  <th className="py-3.5 px-4">Assigned Barangay</th>
                  <th className="py-3.5 px-4">Role Permission</th>
                  <th className="py-3.5 px-4">Account Password</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredAccounts.map((acc) => {
                  const isMasterAdmin = acc.username.toLowerCase() === 'admin';
                  const isCurrent = acc.username.toLowerCase() === currentUsername.toLowerCase();
                  const currentNormStatus = normalizeStatus(acc.status);
                  const isRecentlyApproved = recentlyApprovedUsernames.includes(acc.username.toLowerCase());

                  return (
                    <tr
                      key={acc.username}
                      className={`transition-all ${
                        isRecentlyApproved
                          ? 'bg-emerald-50/80 ring-2 ring-emerald-500/40'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={acc} size="w-9 h-9" />
                          <div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              <span>{acc.fullName || acc.displayName || `@${acc.username}`}</span>
                              {isMasterAdmin && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase shrink-0">
                                  Master Admin
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase shrink-0">
                                  You
                                </span>
                              )}
                              {isRecentlyApproved && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5 shadow-xs shrink-0">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Just Approved
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">@{acc.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{acc.email || `${acc.username}@clinic.gov.ph`}</span>
                        </div>
                      </td>

                      {/* Barangay Badge */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-bold">
                          <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                          {acc.barangay || 'Central'}
                        </span>
                      </td>

                      {/* Role Selector */}
                      <td className="py-4 px-4">
                        {isMasterAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 text-xs font-extrabold">
                            <ShieldCheck className="w-3.5 h-3.5" /> Administrator
                          </span>
                        ) : (
                          <select
                            value={acc.role}
                            onChange={(e) => handleRoleChange(acc.username, e.target.value)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer transition-all"
                          >
                            {!base44Roles.includes(acc.role) && (
                              <option value={acc.role}>{acc.role}</option>
                            )}
                            {base44Roles.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Password */}
                      <td className="py-4 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg max-w-[120px] truncate block font-bold">
                            {visiblePasswords[acc.username] 
                              ? (acc.passwordPlain || '(Encrypted)') 
                              : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(acc.username)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                            title={visiblePasswords[acc.username] ? "Hide password" : "Show password"}
                          >
                            {visiblePasswords[acc.username] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        {currentNormStatus === 'Pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 text-xs font-extrabold border border-amber-200 shadow-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Pending
                          </span>
                        ) : (
                          <button
                            onClick={() => !isMasterAdmin && handleStatusToggle(acc.username, currentNormStatus)}
                            disabled={isMasterAdmin}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                              currentNormStatus === 'Active'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            } ${isMasterAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                            title={isMasterAdmin ? 'Master admin status cannot be changed' : 'Click to toggle active status'}
                          >
                            {currentNormStatus === 'Active' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Suspended
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Registration Date */}
                      <td className="py-4 px-4 text-xs text-slate-400 font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-300" />
                          {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Initial Seed'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentNormStatus === 'Pending' && (
                            <button
                              onClick={() => handleApproveAccount(acc.username)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-extrabold shadow-xs"
                              title="Approve user registration"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(acc)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                            title="Edit user account"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>

                          {!isMasterAdmin && !isCurrent ? (
                            <button
                              onClick={() => setDeleteTarget(acc)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
                              title="Delete user account"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-semibold italic pl-1">Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile User Cards View for full responsiveness */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredAccounts.map((acc) => {
              const isMasterAdmin = acc.username.toLowerCase() === 'admin';
              const isCurrent = acc.username.toLowerCase() === currentUsername.toLowerCase();
              const currentNormStatus = normalizeStatus(acc.status);
              const isRecentlyApproved = recentlyApprovedUsernames.includes(acc.username.toLowerCase());

              return (
                <div
                  key={acc.username}
                  className={`p-3.5 sm:p-4 space-y-3 transition-colors min-w-0 ${
                    isRecentlyApproved
                      ? 'bg-emerald-50/80 ring-2 ring-emerald-500/40 rounded-2xl'
                      : 'hover:bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <UserAvatar user={acc} size="w-9 h-9" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 text-sm flex flex-wrap items-center gap-1.5 leading-tight">
                          <span className="truncate">{acc.fullName || acc.displayName || `@${acc.username}`}</span>
                          {isMasterAdmin && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase shrink-0">
                              Master Admin
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase shrink-0">
                              You
                            </span>
                          )}
                          {isRecentlyApproved && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-medium truncate">@{acc.username}</div>
                      </div>
                    </div>

                    {currentNormStatus === 'Pending' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 text-xs font-extrabold border border-amber-200 shrink-0 shadow-xs">
                        <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Pending
                      </span>
                    ) : (
                      <button
                        onClick={() => !isMasterAdmin && handleStatusToggle(acc.username, currentNormStatus)}
                        disabled={isMasterAdmin}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all shrink-0 ${
                          currentNormStatus === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        } ${isMasterAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {currentNormStatus === 'Active' ? 'Active' : 'Suspended'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 border border-teal-200/60 text-teal-800 font-bold">
                      <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                      <span className="truncate max-w-[120px]">{acc.barangay || 'Central'}</span>
                    </span>
                    {isMasterAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 border border-purple-200 text-purple-800 font-bold">
                        <ShieldCheck className="w-3 h-3 text-purple-600 shrink-0" />
                        <span>Administrator</span>
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-1.5 py-0.5 transition-all">
                        <Shield className="w-3 h-3 text-slate-500 shrink-0" />
                        <select
                          value={acc.role}
                          onChange={(e) => handleRoleChange(acc.username, e.target.value)}
                          className="bg-transparent text-slate-800 text-xs font-bold outline-none cursor-pointer pr-1"
                        >
                          {!base44Roles.some(r => r.toUpperCase() === acc.role.toUpperCase()) && (
                            <option value={acc.role}>{acc.role}</option>
                          )}
                          {base44Roles.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                      <span className="font-mono text-[11px]">
                        PW: {visiblePasswords[acc.username] ? (acc.passwordPlain || '(Encrypted)') : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(acc.username)}
                        className="text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer shrink-0"
                      >
                        {visiblePasswords[acc.username] ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </button>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 min-w-0">
                    <div className="text-slate-500 text-xs flex items-center gap-1.5 min-w-0 flex-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{acc.email || `${acc.username}@clinic.gov.ph`}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-slate-50">
                      {currentNormStatus === 'Pending' && (
                        <button
                          onClick={() => handleApproveAccount(acc.username)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold shadow-xs shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(acc)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold border border-emerald-200/60 shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      {!isMasterAdmin && !isCurrent ? (
                        <button
                          onClick={() => setDeleteTarget(acc)}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-bold border border-rose-200/60 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold italic px-2 py-1 bg-slate-100 rounded-lg shrink-0">Protected</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* Modal: Register New Account */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto my-auto"
            >
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">Register New Account</h3>
                  <p className="text-xs text-slate-400">Saves directly to database.</p>
                </div>
              </div>

              <form onSubmit={handleAddAccount} className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">
                    <p className="font-extrabold text-amber-950">Notice on Account Approval</p>
                    <p className="text-[11px] text-amber-800/90 mt-0.5">Newly registered accounts will require administrator approval before access is granted.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Full Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Email Address <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="juan.delacruz@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Password <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={visiblePasswords['reg'] ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Password (min 4 chars)"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('reg')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      {visiblePasswords['reg'] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Barangay <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    required
                    value={regBarangay}
                    onChange={(e) => setRegBarangay(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {fetchingBarangays ? (
                      <option value="">Loading Barangays...</option>
                    ) : (
                      barangayList.filter(isRealBarangay).map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Role Permission (Base44 DB Roles) <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    required
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {base44Roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit Account Details */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto my-auto"
            >
              <button
                onClick={() => setEditTarget(null)}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <UserAvatar user={editTarget} size="w-11 h-11" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display">Edit User Account</h3>
                  <p className="text-xs text-slate-400">Update account for @{editTarget.username}</p>
                </div>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Full Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    Assigned Barangay <span className="text-emerald-600">*</span>
                  </label>
                  <select
                    required
                    value={editBarangay}
                    onChange={(e) => setEditBarangay(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {fetchingBarangays ? (
                      <option value="">Loading Barangays...</option>
                    ) : (
                      Array.from(new Set([...barangayList, editBarangay]))
                        .filter(isRealBarangay)
                        .sort()
                        .map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      Role Permission <span className="text-emerald-600">*</span>
                    </label>
                    <select
                      disabled={editTarget.username.toLowerCase() === 'admin'}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {!base44Roles.some(r => r.toUpperCase() === editRole.toUpperCase()) && (
                        <option value={editRole}>{editRole}</option>
                      )}
                      {base44Roles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                      Account Status
                    </label>
                    <select
                      disabled={editTarget.username.toLowerCase() === 'admin'}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="Active">Active</option>
                      <option value="Pending">Pending</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100/60 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Current Account Password</span>
                    <span className="font-mono font-black text-emerald-800 text-sm tracking-wide">
                      {visiblePasswords[editTarget.username + '_edit'] ? (editTarget.passwordPlain || '(Encrypted)') : '••••••••'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(editTarget.username + '_edit')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl border border-slate-100 transition-all cursor-pointer shadow-xs shrink-0"
                    title={visiblePasswords[editTarget.username + '_edit'] ? "Hide password" : "Show password"}
                  >
                    {visiblePasswords[editTarget.username + '_edit'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                    New Password <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={visiblePasswords['new_edit'] ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="New password (optional)"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('new_edit')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      {visiblePasswords['new_edit'] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditTarget(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-800 font-display">Delete Registered Account?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete the account for <strong className="text-slate-700">{deleteTarget.fullName || deleteTarget.username}</strong> (@{deleteTarget.username})?
              </p>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Account'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
