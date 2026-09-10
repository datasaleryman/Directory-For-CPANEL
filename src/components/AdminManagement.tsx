import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserPlus, Trash2, Key, Loader2, User } from 'lucide-react';

interface AdminUser {
  username: string;
  role: string;
}

interface AdminManagementProps {
  authToken: string;
  currentUsername: string;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export const AdminManagement: React.FC<AdminManagementProps> = ({
  authToken,
  currentUsername,
  showToast
}) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  // Fetch the list of administrators
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admins', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch administrator accounts.');
      }
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchAdmins();
    }
  }, [authToken]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUser = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const trimmedPass = passwordInput.trim();

    if (!trimmedUser) {
      showToast('Username is required (alphanumeric and underscores only).', 'warning');
      return;
    }
    if (trimmedUser.length < 3) {
      showToast('Username must be at least 3 characters.', 'warning');
      return;
    }
    if (!trimmedPass) {
      showToast('Password is required.', 'warning');
      return;
    }
    if (trimmedPass.length < 4) {
      showToast('Password must be at least 4 characters long.', 'warning');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ username: trimmedUser, password: trimmedPass })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create administrator account.');
      }

      showToast(`Administrator account "@${data.username}" registered successfully!`, 'success');
      setUsernameInput('');
      setPasswordInput('');
      fetchAdmins();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAdmin = async (targetUsername: string) => {
    if (targetUsername.toLowerCase() === 'admin') {
      showToast('The master administrator account cannot be deleted.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the administrator account "@${targetUsername}"?`)) {
      return;
    }

    setDeletingUser(targetUsername);
    try {
      const res = await fetch(`/api/admins/${targetUsername}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete administrator account.');
      }

      showToast(`Administrator account "@${targetUsername}" deleted successfully.`, 'success');
      fetchAdmins();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeletingUser(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Intro Banner Card */}
      <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold font-display">Administrator Accounts</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-xl">
                Add and manage secure login credentials. Users registered here possess full administrative access to register, modify, export, or bulk import contact records.
              </p>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl px-4 py-2.5 self-start md:self-auto shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Current Session</span>
            <span className="text-xs font-mono font-semibold text-emerald-300">@{currentUsername}</span>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Grid-driven and fully mobile responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Create Administrator Card (Form) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-24">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 font-display">Register Admin</h4>
                <p className="text-[11px] text-slate-500">Create new secure admin credentials</p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Admin Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">@</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. administrator_02"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Lowercase letters, numbers, and underscores only</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Minimum 4 characters</p>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-100 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Registering Admin...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Register Account
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Existing Accounts List Card */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h4 className="font-bold text-slate-800 font-display">Active Admin Credentials</h4>
                <p className="text-[11px] text-slate-500">Currently registered system accounts</p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold font-mono text-[10px] rounded-lg">
                {(admins || []).length} Total
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xs font-medium">Fetching accounts...</span>
              </div>
            ) : !admins || admins.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p className="text-xs">No administrative accounts found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(admins || []).map((u) => {
                  const isMaster = u.username.toLowerCase() === 'admin';
                  const isSelf = u.username.toLowerCase() === currentUsername.toLowerCase();
                  
                  return (
                    <div
                      key={u.username}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-150 rounded-xl hover:border-slate-300 transition-all group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isMaster 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isMaster ? <ShieldCheck className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">@{u.username}</span>
                            {isMaster && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[8px] tracking-wide uppercase rounded">
                                Master
                              </span>
                            )}
                            {isSelf && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[8px] tracking-wide uppercase rounded">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
                            {u.role}
                          </span>
                        </div>
                      </div>

                      {/* Delete actions, disabling master admin or self deletion */}
                      {!isMaster ? (
                        <button
                          onClick={() => handleDeleteAdmin(u.username)}
                          disabled={deletingUser === u.username}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Revoke access"
                        >
                          {deletingUser === u.username ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 font-mono select-none px-2.5">
                          Protected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
