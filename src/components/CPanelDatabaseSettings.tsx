import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  UploadCloud,
  Key,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  FileCode,
  Check,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { CPanelDbConfig, CPanelDbStatus } from '../types.js';

interface CPanelDatabaseSettingsProps {
  authToken: string | null;
  onSyncComplete?: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CPanelDatabaseSettings: React.FC<CPanelDatabaseSettingsProps> = ({
  authToken,
  onSyncComplete,
  showToast
}) => {
  const [status, setStatus] = useState<CPanelDbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [migrating, setMigrating] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'config' | 'guide'>('config');

  // Form state
  const [config, setConfig] = useState<CPanelDbConfig>({
    host: 'localhost',
    port: 3306,
    database: '',
    user: '',
    password: '',
    ssl: false,
    enabled: true
  });

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/cpanel-db/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err: any) {
      console.error('Failed to load cPanel DB status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/cpanel-db/config', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({
          ...prev,
          host: data.host || 'localhost',
          port: data.port || 3306,
          database: data.database || '',
          user: data.user || '',
          ssl: Boolean(data.ssl),
          enabled: data.enabled !== false
        }));
      }
    } catch (err: any) {
      console.error('Failed to load cPanel DB config:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    if (authToken) {
      fetchConfig();
    }
  }, [authToken]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/cpanel-db/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Connection to cPanel MySQL successful!', 'success');
      } else {
        showToast(data.error || 'Connection failed. Verify host, port, credentials, and database.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error testing connection.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/cpanel-db/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, data.status?.connected ? 'success' : 'warning');
        setStatus(data.status);
        if (onSyncComplete) onSyncComplete();
      } else {
        showToast(data.error || 'Failed to save database settings.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving database settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    if (!status?.connected) {
      showToast('Please establish and test the cPanel MySQL connection before migrating.', 'warning');
      return;
    }

    if (!confirm('Migrate all local contacts, users, and settings directly into your cPanel MySQL Database? Existing MySQL tables will be preserved or updated.')) {
      return;
    }

    setMigrating(true);
    try {
      const res = await fetch('/api/cpanel-db/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Migration to cPanel MySQL database completed successfully!', 'success');
        fetchStatus();
        if (onSyncComplete) onSyncComplete();
      } else {
        showToast(data.error || 'Migration encountered an error.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error executing migration.', 'error');
    } finally {
      setMigrating(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/cpanel-db/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Database synchronized live!', 'success');
        fetchStatus();
        if (onSyncComplete) onSyncComplete();
      } else {
        showToast(data.error || 'Failed to synchronize database.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Sync error.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="cpanel-db-settings-container">
      {/* Top Banner: Status and Live Mode */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${status?.connected ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' : 'bg-amber-50 text-amber-600 border border-amber-200/60'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight font-display">
                  cPanel MySQL Database (Main Database)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Primary Storage
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Google Sheets integration has been decommissioned. Your application runs natively on cPanel MySQL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              id="cpanel-db-sync-now-button"
              onClick={handleSync}
              disabled={syncing}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Database'}
            </button>
            <a
              href="/api/cpanel-db/schema.sql"
              download="cpanel_database.sql"
              id="cpanel-db-download-schema-link"
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Download SQL schema to import in cPanel phpMyAdmin"
            >
              <Download className="w-3.5 h-3.5" />
              Download SQL Schema
            </a>
          </div>
        </div>

        {/* Database Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Connection Status</span>
            <div className="mt-1.5 flex items-center gap-2">
              {loadingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              ) : status?.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Standby / Local Cache
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              {status?.connected ? 'MySQL pool active' : 'Waiting for connection'}
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">MySQL Host & Port</span>
            <span className="text-sm font-bold text-slate-800 mt-1 block font-mono">
              {status?.host || config.host || 'localhost'}:{status?.port || config.port || 3306}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Standard cPanel socket/TCP
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Database Name</span>
            <span className="text-sm font-bold text-indigo-700 mt-1 block font-mono truncate" title={status?.database || config.database || 'Not specified'}>
              {status?.database || config.database || 'Not specified'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              User: <span className="font-mono text-slate-700">{status?.user || config.user || 'None'}</span>
            </span>
          </div>

          <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Verified Tables</span>
            <span className="text-sm font-bold text-slate-800 mt-1 block">
              {status?.tablesVerified?.length || 0} Tables Active
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              {status?.connected ? 'Schema fully verified' : 'Import cpanel_database.sql'}
            </span>
          </div>
        </div>

        {/* Error message banner if any */}
        {status?.error && (
          <div className="mt-4 p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800">
              <span className="font-bold block">Connection Notice:</span>
              <span className="font-mono break-all">{status.error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'config'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          MySQL Database Credentials
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guide')}
          className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'guide'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          cPanel Deployment Instructions
        </button>
      </div>

      {activeTab === 'config' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Credentials Form */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-slate-800 font-display mb-1 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              cPanel MySQL Connection Parameters
            </h4>
            <p className="text-xs text-slate-500 mb-6">
              Enter your cPanel MySQL database details. When hosted on cPanel, the host is usually <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-700">localhost</code>.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    MySQL Host
                  </label>
                  <input
                    type="text"
                    required
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="localhost or your cPanel server IP"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Usually 'localhost' in cPanel environments</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Port
                  </label>
                  <input
                    type="number"
                    required
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 3306 })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Default: 3306</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Database Name
                  </label>
                  <input
                    type="text"
                    required
                    value={config.database}
                    onChange={(e) => setConfig({ ...config, database: e.target.value })}
                    placeholder="e.g., cpaneluser_sfc_db"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Full database name with cPanel prefix</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Database User
                  </label>
                  <input
                    type="text"
                    required
                    value={config.user}
                    onChange={(e) => setConfig({ ...config, user: e.target.value })}
                    placeholder="e.g., cpaneluser_admin"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">MySQL user created in cPanel</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Database Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={config.password || ''}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder="Enter MySQL user password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Stored securely in server configuration</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="mysql-ssl-checkbox"
                  checked={config.ssl}
                  onChange={(e) => setConfig({ ...config, ssl: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="mysql-ssl-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Require SSL Connection (leave unchecked if connecting to localhost)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-5 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  id="cpanel-db-test-connection-button"
                  onClick={handleTestConnection}
                  disabled={testing || saving}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                      Test Connection
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  id="cpanel-db-save-credentials-button"
                  disabled={saving || testing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving & Connecting...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save & Connect
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Migration & Operations Card */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-slate-800 font-display mb-2 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                Data Migration & Seeding
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Migrate all contacts, users, existing accounts, and website settings from local storage directly into your cPanel MySQL database.
              </p>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl mb-4 text-xs text-emerald-900 space-y-1">
                <span className="font-bold block">1-Click Migration Available</span>
                <span>Transfers all records safely without data loss.</span>
              </div>

              <button
                type="button"
                id="cpanel-db-migrate-now-button"
                onClick={handleMigrate}
                disabled={migrating || !status?.connected}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  status?.connected
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                {migrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Migrating Data...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Migrate Data to MySQL
                  </>
                )}
              </button>

              {!status?.connected && (
                <span className="text-[10px] text-slate-400 block text-center mt-2">
                  Connect MySQL first to unlock migration
                </span>
              )}
            </div>

            {/* Quick Summary Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-slate-800 font-display mb-2 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-600" />
                SQL Schema Import
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                If your database is new, import the official <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">cpanel_database.sql</code> file via phpMyAdmin.
              </p>

              <a
                href="/api/cpanel-db/schema.sql"
                download="cpanel_database.sql"
                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                Download cpanel_database.sql
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* Deployment Guide Tab */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h4 className="font-bold text-slate-800 font-display text-base">
                How to Host & Connect this App on cPanel
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Step-by-step instructions for running this application with MySQL on any cPanel hosting account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs">Create MySQL Database in cPanel</h5>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Log in to your cPanel dashboard, go to <strong>MySQL® Databases</strong>. Create a new database (e.g., <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">youruser_sfcdb</code>).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs">Create MySQL User & Assign Privileges</h5>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Under <strong>MySQL Users</strong>, create a new user and password. In <strong>Add User To Database</strong>, select the user and database, then check <strong>ALL PRIVILEGES</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs">Import Database Schema (phpMyAdmin)</h5>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Open <strong>phpMyAdmin</strong> from cPanel, select your database, click <strong>Import</strong>, and upload the <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">cpanel_database.sql</code> file.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">4</span>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs">Setup Node.js App in cPanel</h5>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Under <strong>Setup Node.js App</strong> in cPanel:
                    <br />• Node.js Version: <strong>18.x or 20.x</strong>
                    <br />• Application Root: <strong>/home/youruser/sfcdirectory</strong>
                    <br />• Application Startup File: <strong>app.js</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">5</span>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs">Configure Environment Variables</h5>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    In the Node.js App interface, add environment variables:
                    <br />• <code className="font-mono bg-white px-1 py-0.5 rounded border">MYSQL_HOST=localhost</code>
                    <br />• <code className="font-mono bg-white px-1 py-0.5 rounded border">MYSQL_DATABASE=youruser_sfcdb</code>
                    <br />• <code className="font-mono bg-white px-1 py-0.5 rounded border">MYSQL_USER=youruser_admin</code>
                    <br />• <code className="font-mono bg-white px-1 py-0.5 rounded border">MYSQL_PASSWORD=your_password</code>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-emerald-900 text-xs">All Google Sheets Removed</h5>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    The app now directly reads and writes to MySQL with zero Google Sheets dependencies or quota limits!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
