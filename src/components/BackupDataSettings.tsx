import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  FileCode,
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Table,
  Layers,
  HardDrive,
  Copy,
  Check,
  Eye,
  X,
  ShieldCheck
} from 'lucide-react';

interface SheetSummary {
  sheetName: string;
  tableName: string;
  rowCount: number;
  columnCount: number;
}

interface BackupMetadata {
  title: string;
  timestamp: string;
  source: string;
  spreadsheetId: string;
  exportedBy: string;
  totalSheets: number;
  totalRecords: number;
  isLiveSheetsData: boolean;
  sheetSummaries: SheetSummary[];
}

interface BackupDataSettingsProps {
  authToken: string | null;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const BackupDataSettings: React.FC<BackupDataSettingsProps> = ({
  authToken,
  showToast
}) => {
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [metadata, setMetadata] = useState<BackupMetadata | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'json' | 'sql' | null>(null);
  const [previewContent, setPreviewContent] = useState<{
    format: 'json' | 'sql';
    content: string;
    filename: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBackupSummary = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoadingSummary(true);

    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/backup/summary', { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to fetch backup metadata`);
      }

      const data = await res.json();
      if (data.metadata) {
        setMetadata(data.metadata);
        if (isManualRefresh) {
          showToast('Backup tables metadata refreshed from database.', 'success');
        }
      }
    } catch (err: any) {
      console.error('Failed to load backup summary:', err);
      showToast(err.message || 'Could not load backup database summary.', 'error');
    } finally {
      setLoadingSummary(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackupSummary();
  }, [authToken]);

  const handleDownload = async (format: 'json' | 'sql') => {
    setDownloadingFormat(format);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/backup/export', {
        method: 'POST',
        headers,
        body: JSON.stringify({ format })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed with status ${res.status}`);
      }

      const result = await res.json();
      if (!result.content || !result.filename) {
        throw new Error('Export returned empty content payload');
      }

      // Trigger client-side file download
      const mimeType = format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([result.content], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      showToast(`Successfully downloaded Google Sheet database backup (${result.filename})`, 'success');
    } catch (err: any) {
      console.error(`Backup ${format} download failed:`, err);
      showToast(err.message || `Failed to download ${format.toUpperCase()} backup file.`, 'error');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handlePreview = async (format: 'json' | 'sql') => {
    setDownloadingFormat(format);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/backup/export', {
        method: 'POST',
        headers,
        body: JSON.stringify({ format })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Preview failed`);
      }

      const result = await res.json();
      setPreviewContent({
        format,
        content: result.content,
        filename: result.filename
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to preview backup.', 'error');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyPreview = () => {
    if (!previewContent?.content) return;
    navigator.clipboard.writeText(previewContent.content);
    setCopied(true);
    showToast('Backup content copied to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="backup-data-tab-container">
      {/* Overview & Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">cPanel MySQL Database Backup</h2>
                {metadata && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    metadata.isLiveSheetsData
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {metadata.isLiveSheetsData ? 'Live cPanel MySQL Connected' : 'Synchronized Cache Connected'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Export and download an exact, full-fidelity archive of all tables, directory records, accounts, 
                and system logs from your cPanel MySQL database. Backups can be downloaded anytime as portable 
                <strong className="text-slate-700 font-semibold"> SQL dump</strong> (ready for phpMyAdmin) or standard <strong className="text-slate-700 font-semibold">JSON</strong> files.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchBackupSummary(true)}
            disabled={refreshing || loadingSummary}
            className="self-start md:self-auto px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh Tables
          </button>
        </div>

        {/* Database Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Tables / Sheets</span>
            <span className="text-xl font-bold text-slate-800 mt-0.5 block">
              {loadingSummary ? '...' : (metadata?.totalSheets ?? 0)} Sheets
            </span>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Database Rows</span>
            <span className="text-xl font-bold text-indigo-600 mt-0.5 block">
              {loadingSummary ? '...' : (metadata?.totalRecords ?? 0).toLocaleString()} Rows
            </span>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Target Spreadsheet</span>
            <span className="text-xs font-mono font-medium text-slate-700 mt-1 block truncate" title={metadata?.spreadsheetId || ''}>
              {loadingSummary ? '...' : (metadata?.spreadsheetId ? `${metadata.spreadsheetId.substring(0, 14)}...` : 'Configured')}
            </span>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Security & Access</span>
            <span className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Verified
            </span>
          </div>
        </div>
      </div>

      {/* Export Format Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* JSON Backup Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all group">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <FileCode className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200/60">
                JSON File (.json)
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2">Structured JSON Database Backup</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Exports the full Google Sheets database as structured JSON. Contains all sheet tables, row matrices, 
              column keys, and enriched patient records. Recommended for web applications, REST APIs, TypeScript/Node 
              migrations, or NoSQL databases.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                All {metadata?.totalSheets || 11} Sheets Included
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                Formatted & Indented
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                UTF-8 Encoded
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              id="download-backup-json-button"
              onClick={() => handleDownload('json')}
              disabled={downloadingFormat !== null}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingFormat === 'json' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating JSON...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download JSON File
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handlePreview('json')}
              disabled={downloadingFormat !== null}
              title="Preview JSON snippet"
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SQL Dump Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all group">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                <Database className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200/60">
                SQL Dump (.sql)
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2">Relational SQL Database Backup</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Generates a standard ANSI SQL script with typed <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">CREATE TABLE</code> schemas, 
              indexes, and batched <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">INSERT INTO</code> queries. 
              Universally compatible with PostgreSQL, MySQL, MariaDB, SQLite, and cloud SQL engines.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                DDL & DML Included
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                Transaction Safe (BEGIN/COMMIT)
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                Batched Inserts (200 rows)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              id="download-backup-sql-button"
              onClick={() => handleDownload('sql')}
              disabled={downloadingFormat !== null}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadingFormat === 'sql' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating SQL Dump...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download SQL File
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handlePreview('sql')}
              disabled={downloadingFormat !== null}
              title="Preview SQL snippet"
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sheets & Tables Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">cPanel MySQL Tables Included in Backup</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {metadata?.sheetSummaries?.length || 0} Tables Ready
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-5">Table Identifier</th>
                <th className="py-3 px-5">SQL Table Name</th>
                <th className="py-3 px-5">Columns</th>
                <th className="py-3 px-5">Row Count</th>
                <th className="py-3 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingSummary ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Inspecting database tables...
                  </td>
                </tr>
              ) : metadata?.sheetSummaries && metadata.sheetSummaries.length > 0 ? (
                metadata.sheetSummaries.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-slate-800 flex items-center gap-2">
                      <Table className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      {s.sheetName}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-600">
                      {s.tableName}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500">
                      {s.columnCount} cols
                    </td>
                    <td className="py-3.5 px-5 font-medium text-slate-700">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md font-semibold text-slate-800">
                        {s.rowCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        Synced
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No table data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Snippet Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <FileCode className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-sm tracking-wide text-white">
                  Backup Preview: {previewContent.filename}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {previewContent.format}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewContent(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed bg-slate-950/50">
              <pre className="whitespace-pre-wrap select-all">
                {previewContent.content.slice(0, 15000)}
                {previewContent.content.length > 15000 && (
                  <div className="mt-4 p-3 bg-slate-800/80 rounded border border-slate-700 text-indigo-300 font-sans text-xs">
                    ... ({((previewContent.content.length - 15000) / 1024).toFixed(1)} KB more content truncated for preview. Click "Download" to retrieve full file.)
                  </div>
                )}
              </pre>
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400">
              <span>Total File Size: {(previewContent.content.length / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                onClick={() => {
                  handleDownload(previewContent.format);
                  setPreviewContent(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download This File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
