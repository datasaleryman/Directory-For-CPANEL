import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  UploadCloud,
  HardDrive,
  Key,
  Eye,
  EyeOff,
  Layers,
  Table,
  Loader2,
  FileCode,
  Shield,
  HelpCircle,
  ExternalLink,
  Check,
  Copy
} from 'lucide-react';

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

export interface CPanelDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  hasPassword?: boolean;
  ssl?: boolean;
  enabled?: boolean;
}

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
  // Connection Configuration state
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(3306);
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ssl, setSsl] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  // Status & loading states
  const [status, setStatus] = useState<CPanelDbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [migratingData, setMigratingData] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const [copiedSchemaSnippet, setCopiedSchemaSnippet] = useState(false);

  // Fetch current database configuration and status
  const loadConfigAndStatus = async (isManualRefresh = false) => {
    if (isManualRefresh) setLoadingStatus(true);
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Fetch status
      const statusRes = await fetch('/api/cpanel-db/status', { headers });
      if (statusRes.ok) {
        const statusData: CPanelDbStatus = await statusRes.json();
        setStatus(statusData);
      }

      // Fetch config
      const configRes = await fetch('/api/cpanel-db/config', { headers });
      if (configRes.ok) {
        const configData: CPanelDbConfig = await configRes.json();
        setHost(configData.host || 'localhost');
        setPort(configData.port || 3306);
        setDatabase(configData.database || '');
        setUser(configData.user || '');
        setHasExistingPassword(Boolean(configData.hasPassword));
        setSsl(Boolean(configData.ssl));
        setEnabled(configData.enabled !== undefined ? configData.enabled : true);
      }

      if (isManualRefresh) {
        showToast('Database connection status refreshed.', 'info');
      }
    } catch (err: any) {
      console.warn('Failed to load cPanel DB status/config:', err);
      showToast('Could not load database status from server.', 'error');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadConfigAndStatus();
  }, [authToken]);

  // Test connection without saving
  const handleTestConnection = async () => {
    if (!database.trim()) {
      showToast('Please specify a Database Name to test connection.', 'warning');
      return;
    }
    setTestingConnection(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/cpanel-db/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port) || 3306,
          database: database.trim(),
          user: user.trim(),
          password: password ? password : undefined,
          ssl
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Database connection successful!', 'success');
      } else {
        showToast(data.message || data.error || 'Connection failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to test database connection.', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // Save database configuration
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const payload: Record<string, any> = {
        host: host.trim(),
        port: Number(port) || 3306,
        database: database.trim(),
        user: user.trim(),
        ssl,
        enabled
      };

      if (password) {
        payload.password = password;
      }

      const res = await fetch('/api/cpanel-db/config', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      if (data.status) {
        setStatus(data.status);
      }
      if (password) {
        setHasExistingPassword(true);
        setPassword('');
      }

      showToast(data.message || 'Database settings saved successfully!', data.status?.connected ? 'success' : 'info');
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save database settings.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Migrate all application data to cPanel MySQL
  const handleMigrateData = async () => {
    if (!window.confirm('Are you sure you want to migrate all local files and records to the cPanel MySQL database? Existing records in MySQL with matching IDs will be preserved or updated.')) {
      return;
    }

    setMigratingData(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/cpanel-db/migrate', {
        method: 'POST',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Migration failed');
      }

      showToast(data.message || 'Data migration completed successfully!', 'success');
      await loadConfigAndStatus();
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      showToast(err.message || 'Data migration failed.', 'error');
    } finally {
      setMigratingData(false);
    }
  };

  // Force sync from cPanel MySQL
  const handleForceSync = async () => {
    setSyncingData(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/cpanel-db/sync', {
        method: 'POST',
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      showToast(data.message || 'Synchronized with MySQL database successfully!', 'success');
      await loadConfigAndStatus();
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      showToast(err.message || 'Database synchronization failed.', 'error');
    } finally {
      setSyncingData(false);
    }
  };

  // Download SQL schema file
  const handleDownloadSchema = () => {
    const link = document.createElement('a');
    link.href = '/api/cpanel-db/schema.sql';
    link.download = 'cpanel_database.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded cpanel_database.sql schema file.', 'success');
  };

  const isConnected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      {/* Overview & Live Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-800 font-display">cPanel MySQL Database</h4>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Connected & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Local Storage Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isConnected
                  ? `Connected to MySQL database "${status?.database}" on ${status?.host}:${status?.port}`
                  : 'Operating via fast local JSON files in data/ directory. MySQL database is optional or ready to configure.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadConfigAndStatus(true)}
              disabled={loadingStatus}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleDownloadSchema}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Schema (.sql)
            </button>
          </div>
        </div>

        {/* Database Status Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Host & Port</div>
            <div className="text-sm font-bold text-slate-800 mt-1 font-mono">
              {status?.host || host || 'localhost'}:{status?.port || port || 3306}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Database</div>
            <div className="text-sm font-bold text-slate-800 mt-1 font-mono truncate">
              {status?.database || database || '(None configured)'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tables in MySQL</div>
            <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              <Table className="w-4 h-4 text-slate-400" />
              <span>{status?.tableCount ?? 0} Tables</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Connection Status</div>
            <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              {isConnected ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> MySQL Active
                </span>
              ) : (
                <span className="text-slate-600 flex items-center gap-1">
                  <HardDrive className="w-4 h-4" /> JSON Cache Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Show Table Details if connected */}
        {isConnected && status?.tables && status.tables.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Live Database Tables ({status.tables.length})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {status.tables.map((t) => (
                <div key={t.name} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <span className="font-mono text-slate-700">{t.name}</span>
                  <span className="font-bold text-slate-500">{t.rowCount} rows</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display last error if any */}
        {!isConnected && status?.lastError && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Status Notice:</div>
              <div className="mt-0.5 text-amber-800">{status.lastError}</div>
            </div>
          </div>
        )}
      </div>

      {/* Database Connection Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800 font-display">cPanel MySQL Credentials</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter credentials provided by your cPanel MySQL Database Wizard. When configured, data syncs seamlessly between cPanel and your clinic directory.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost or 127.0.0.1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <span className="text-[11px] text-slate-400">Usually &quot;localhost&quot; on standard cPanel hosting.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 3306)}
                placeholder="3306"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <span className="text-[11px] text-slate-400">Standard MySQL port is 3306.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Database Name</label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="cpuser_clinic_directory"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <span className="text-[11px] text-slate-400">Includes your cPanel username prefix.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Database User</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="cpuser_clinic_user"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <span className="text-[11px] text-slate-400">cPanel user with ALL PRIVILEGES granted.</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Password</span>
              {hasExistingPassword && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Password is saved on server
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasExistingPassword ? '•••••••••••• (leave blank to keep current)' : 'Enter database user password'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={ssl}
                  onChange={(e) => setSsl(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable SSL</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable cPanel Database</span>
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                Test Connection
              </button>

              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Actions & Synchronization Tools */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800 font-display">Data Migration & Database Tools</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Tools to migrate initial local JSON records into cPanel MySQL or reload database contents into memory.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Migrate Data Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
            <div>
              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-600" />
                <span>Migrate Local Data to MySQL</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Copies all contacts, user accounts, barangays, activities, and settings currently in local storage directly into your cPanel MySQL tables.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleMigrateData}
                disabled={migratingData || !isConnected}
                className="w-full px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {migratingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                {isConnected ? 'Migrate All Data to MySQL' : 'Connect Database to Migrate'}
              </button>
            </div>
          </div>

          {/* Force Reload Sync Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
            <div>
              <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <span>Force Sync from MySQL</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Re-queries the cPanel database and updates local in-memory caches. Useful after running direct SQL updates or phpMyAdmin operations.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleForceSync}
                disabled={syncingData || !isConnected}
                className="w-full px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {isConnected ? 'Sync / Reload from MySQL' : 'Connect Database to Sync'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Setup Reference Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-3">
        <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>cPanel Deployment Quick Reference</span>
        </div>
        <p className="leading-relaxed">
          To deploy to any cPanel host, use cPanel&apos;s <strong>Setup Node.js App</strong> feature:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-700">
          <li>Create MySQL database &amp; user in cPanel <strong>MySQL Database Wizard</strong> with ALL PRIVILEGES.</li>
          <li>In cPanel <strong>Setup Node.js App</strong>, set application startup file to <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-600">app.js</code> and Node.js version 20.x or 22.x.</li>
          <li>Add environment variables <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">DB_NAME</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">DB_USER</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">DB_PASSWORD</code>, and <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">NODE_ENV=production</code>.</li>
          <li>Run <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">npm install</code> and <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">npm run build</code> in the cPanel Terminal.</li>
        </ol>
      </div>
    </div>
  );
};
