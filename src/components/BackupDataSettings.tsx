import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck,
  UploadCloud,
  AlertTriangle,
  FileUp,
  Info,
  ArrowRight,
  Trash2,
  MapPin,
  Search
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

interface UploadTableSummary {
  tableName: string;
  displayName: string;
  destination?: string;
  category?: string;
  count: number;
  sampleKeys: string[];
  sample: any[];
}

interface UploadPreviewData {
  format: 'sql' | 'json';
  fileName: string;
  totalTables: number;
  totalRecords: number;
  tableCounts: Record<string, number>;
  tableSummaries: UploadTableSummary[];
}

interface BackupDataSettingsProps {
  authToken: string | null;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onDataRestored?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const BackupDataSettings: React.FC<BackupDataSettingsProps> = ({
  authToken,
  showToast,
  onDataRestored,
  onNavigateTab
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

  // Upload & Restore State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadContent, setUploadContent] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [analyzingUpload, setAnalyzingUpload] = useState(false);
  const [uploadPreviewData, setUploadPreviewData] = useState<UploadPreviewData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoring, setRestoring] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [selectedInspectTable, setSelectedInspectTable] = useState<string | null>(null);
  const [inspectSearch, setInspectSearch] = useState('');
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const mimeType = format === 'json' ? 'application/json' : 'text/plain';
      const blob = new Blob([result.content], { type: `${mimeType};charset=utf-8;` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', result.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Backup ${result.filename} downloaded successfully!`, 'success');
    } catch (err: any) {
      console.error(`Download error for ${format}:`, err);
      showToast(err.message || `Failed to download ${format.toUpperCase()} backup`, 'error');
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
        throw new Error(errData.error || `Preview failed with status ${res.status}`);
      }

      const result = await res.json();
      setPreviewContent({
        format: result.format,
        content: result.content,
        filename: result.filename
      });
    } catch (err: any) {
      console.error(`Preview error for ${format}:`, err);
      showToast(err.message || `Failed to preview ${format.toUpperCase()} backup`, 'error');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyPreview = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent.content);
    setCopied(true);
    showToast('Backup content copied to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  // Process File Selection for Upload
  const processSelectedFile = (file: File) => {
    const name = file.name.toLowerCase();
    const isSql = name.endsWith('.sql');
    const isJson = name.endsWith('.json');

    if (!isSql && !isJson) {
      setUploadError('Unsupported file type. Please upload a .sql (MySQL dump) or .json backup file.');
      showToast('Please select a valid .sql or .json file.', 'warning');
      return;
    }

    setUploadFile(file);
    setUploadFileName(file.name);
    setUploadError(null);
    setUploadPreviewData(null);
    setRestoreResult(null);
    setAnalyzingUpload(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          throw new Error('The selected backup file is completely empty.');
        }
        setUploadContent(content);

        // Analyze via server API
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const res = await fetch('/api/backup/upload-preview', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fileContent: content,
            fileName: file.name
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}: Failed to parse backup file`);
        }

        const data = await res.json();
        if (data.preview) {
          setUploadPreviewData(data.preview);
          if (data.preview.tableSummaries && data.preview.tableSummaries.length > 0) {
            setSelectedInspectTable(data.preview.tableSummaries[0].tableName);
          }
          showToast(`Successfully analyzed ${file.name} (${data.preview.totalRecords.toLocaleString()} records detected)`, 'success');
        }
      } catch (err: any) {
        console.error('File parsing error:', err);
        setUploadError(err.message || 'Failed to inspect backup file format.');
        showToast(err.message || 'Failed to analyze backup file.', 'error');
      } finally {
        setAnalyzingUpload(false);
      }
    };

    reader.onerror = () => {
      setAnalyzingUpload(false);
      setUploadError('Failed to read the selected file from disk.');
      showToast('Error reading file from disk.', 'error');
    };

    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleClearUpload = () => {
    setUploadFile(null);
    setUploadContent(null);
    setUploadFileName(null);
    setUploadPreviewData(null);
    setUploadError(null);
    setRestoreResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!uploadContent || !uploadFileName) {
      showToast('No backup file content loaded.', 'error');
      return;
    }

    setRestoring(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileContent: uploadContent,
          fileName: uploadFileName,
          mode: restoreMode
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to restore database`);
      }

      const data = await res.json();
      setRestoreResult(data.details);
      setShowConfirmModal(false);
      showToast(data.message || 'Database restored successfully!', 'success');

      // Refresh database table metrics
      fetchBackupSummary(true);

      // Trigger app-level callback to update lastSyncTime, stats, site settings
      if (onDataRestored) {
        onDataRestored();
      }

      // Dispatch global window events so all mounted views (ContactTable, ExistingAccount, etc.) immediately refresh
      try {
        window.dispatchEvent(new CustomEvent('clinic-data-restored', { detail: data.details || data }));
        window.dispatchEvent(new CustomEvent('clinic-settings-updated', { detail: data.details?.counts?.settings }));
      } catch (evtErr) {
        console.warn('Event dispatch warning:', evtErr);
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      showToast(err.message || 'Failed to restore database from backup.', 'error');
    } finally {
      setRestoring(false);
    }
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
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">cPanel MySQL Database Backup & Restore</h2>
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
                Export and download an exact archive of all database tables, or upload a previously generated 
                <strong className="text-slate-700 font-semibold"> .sql (MySQL dump)</strong> or <strong className="text-slate-700 font-semibold">.json</strong> file 
                to seamlessly restore clinic records, directory contacts, accounts, and system configuration.
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
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Database Tables</span>
            <span className="text-xl font-bold text-slate-800 mt-0.5 block">
              {loadingSummary ? '...' : (metadata?.totalSheets ?? 0)} Tables
            </span>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Database Rows</span>
            <span className="text-xl font-bold text-indigo-600 mt-0.5 block">
              {loadingSummary ? '...' : (metadata?.totalRecords ?? 0).toLocaleString()} Rows
            </span>
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Target Database</span>
            <span className="text-xs font-mono font-medium text-slate-700 mt-1 block truncate" title={metadata?.source || 'cPanel MySQL'}>
              {loadingSummary ? '...' : (metadata?.source || 'cPanel MySQL')}
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

      {/* ========================================================================= */}
      {/* Upload & Restore Backup Section */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden" id="upload-backup-section">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Upload & Restore Backup</h3>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                  SQL & JSON Supported
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a <code className="font-mono text-indigo-600 font-bold">.sql</code> database dump or <code className="font-mono text-emerald-600 font-bold">.json</code> backup archive to restore or update your clinic data.
              </p>
            </div>
          </div>

          {uploadFile && (
            <button
              type="button"
              onClick={handleClearUpload}
              className="self-start md:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear & Upload Another
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* File Dropzone Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                : uploadFile
                ? 'border-emerald-300 bg-emerald-50/20'
                : 'border-slate-200 hover:border-indigo-300 bg-slate-50/40 hover:bg-slate-50/80'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.json,application/json,text/plain"
              onChange={handleFileInputChange}
              className="hidden"
              id="backup-file-picker-input"
            />

            {!uploadFile ? (
              <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                  <FileUp className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  Drag and drop your backup file here, or <span className="text-indigo-600 underline hover:text-indigo-700">browse file</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md">
                  Accepts <span className="font-semibold text-slate-700 font-mono">.sql</span> (standard MySQL / phpMyAdmin SQL dump) and <span className="font-semibold text-slate-700 font-mono">.json</span> (structured directory backup).
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600">
                    <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                    .sql dump
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    .json backup
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    uploadFileName?.endsWith('.sql') ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {uploadFileName?.endsWith('.sql') ? <FileCode className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{uploadFileName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        uploadPreviewData?.format === 'sql'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {uploadPreviewData?.format?.toUpperCase() || 'FILE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      File size: {(uploadFile.size / 1024).toFixed(1)} KB &bull; Loaded from disk
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={handleClearUpload}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove File"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Analysis Loading Indicator */}
          {analyzingUpload && (
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-center gap-3 text-indigo-700 text-xs font-semibold animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Analyzing backup structure, table schemas, and validating records...
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Invalid Backup File</span>
                <p className="mt-0.5 text-rose-700 leading-relaxed">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Analysis & Pre-Restore Preview Card */}
          {uploadPreviewData && !analyzingUpload && (
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Backup Verified: Ready for Database Restoration
                    </h4>
                    <span className="text-xs text-slate-500">
                      Detected {uploadPreviewData.totalTables} tables &bull; {uploadPreviewData.totalRecords.toLocaleString()} total records in {uploadPreviewData.format.toUpperCase()} format
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInspectModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  Inspect Parsed Records
                </button>
              </div>

              {/* Detected Tables Breakdown Grid */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Detected Tables in Backup & Target Destinations:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click any table to preview records
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {uploadPreviewData.tableSummaries.map((tbl, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedInspectTable(tbl.tableName);
                        setShowInspectModal(true);
                      }}
                      className="p-3 bg-white hover:bg-slate-50/90 transition-all rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer group hover:border-indigo-300"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors" title={tbl.displayName}>
                            {tbl.displayName}
                          </span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0 border border-indigo-100">
                            {tbl.count.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate font-medium text-slate-600" title={tbl.destination}>
                            {tbl.destination || 'Core Directory'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                        <span className="font-mono">{tbl.tableName}</span>
                        <span className="text-indigo-600 font-semibold group-hover:underline flex items-center gap-0.5">
                          Inspect <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Restore Mode Configuration */}
              <div className="pt-4 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Select Restoration Strategy:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Merge Mode Option */}
                  <label
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      restoreMode === 'merge'
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Merge & Update</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Preserves all current data. Updates existing records matching IDs or full names, and inserts new records.
                      </p>
                    </div>
                  </label>

                  {/* Replace Mode Option */}
                  <label
                    onClick={() => setRestoreMode('replace')}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      restoreMode === 'replace'
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'replace'}
                      onChange={() => setRestoreMode('replace')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Replace / Overwrite</span>
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                          Complete Reset
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Replaces directory tables with the backup contents. (Built-in safety safeguard preserves admin login access).
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Restoring will automatically sync with local storage and your live cPanel MySQL database.
                </div>

                <button
                  type="button"
                  id="confirm-restore-backup-button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={restoring}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {restoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restoring Database...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Restore Database Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Success Restore Report Banner */}
          {restoreResult && (
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-200/80">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  {restoreResult.message || 'Database Restoration Complete!'}
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                  {restoreResult.totalRecords !== undefined ? `${restoreResult.totalRecords.toLocaleString()} Records Synchronized` : 'Database Synchronized'}
                </span>
              </div>

              <p className="text-xs text-emerald-800 leading-relaxed">
                The database records have been successfully applied and immediately populated into their respective pages. You can navigate directly to the target sections below to inspect the imported data:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {restoreResult.counts?.contacts !== undefined && (
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px] font-bold uppercase">Contacts</span>
                        <span className="font-bold text-slate-800 text-sm">{restoreResult.counts.contacts.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>PCU Directory & Map View</span>
                      </div>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('directory')}
                        className="mt-3 w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        View in PCU Directory
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {restoreResult.counts?.existingAccounts !== undefined && (
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px] font-bold uppercase">Existing Accounts</span>
                        <span className="font-bold text-slate-800 text-sm">{restoreResult.counts.existingAccounts.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Existing Account Directory</span>
                      </div>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('existing-account')}
                        className="mt-3 w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        View in Accounts
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {restoreResult.counts?.users !== undefined && (
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px] font-bold uppercase">User Accounts</span>
                        <span className="font-bold text-slate-800 text-sm">{restoreResult.counts.users.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Admin Credentials & Staff</span>
                      </div>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('accounts')}
                        className="mt-3 w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        View User Accounts
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {restoreResult.counts?.barangays !== undefined && (
                  <div className="bg-white/95 p-3.5 rounded-xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px] font-bold uppercase">Barangays</span>
                        <span className="font-bold text-slate-800 text-sm">{restoreResult.counts.barangays.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Barangay Filters & Dropdowns</span>
                      </div>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('dashboard')}
                        className="mt-3 w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        View Dashboard
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-emerald-200/80">
                <span className="text-[11px] text-emerald-700">
                  Data views have been automatically refreshed without requiring a page reload.
                </span>
                <button
                  type="button"
                  onClick={handleClearUpload}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Export Format Action Cards */}
      {/* ========================================================================= */}
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
              Exports all database tables, directory records, existing accounts, users, barangays, and settings as 
              structured JSON. Recommended for web applications, REST APIs, TypeScript migrations, and cross-platform portability.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                All {metadata?.totalSheets || 11} Tables Included
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
              Universally compatible with cPanel phpMyAdmin, MySQL, MariaDB, and PostgreSQL.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                DDL & DML Included
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-lg">
                phpMyAdmin Compatible
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

      {/* Inspect Parsed Upload Records Modal */}
      {showInspectModal && uploadPreviewData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Table className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-sm text-slate-800">
                  Inspect Backup Contents: {uploadPreviewData.fileName}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold rounded bg-indigo-100 text-indigo-800">
                  {uploadPreviewData.format}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Table Selection Tabs */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-200 bg-slate-100/60 overflow-x-auto">
              {uploadPreviewData.tableSummaries.map((tbl) => (
                <button
                  key={tbl.tableName}
                  type="button"
                  onClick={() => setSelectedInspectTable(tbl.tableName)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedInspectTable === tbl.tableName
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <span>{tbl.displayName}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                    selectedInspectTable === tbl.tableName ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tbl.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>

            {/* Table View Body */}
            <div className="p-6 overflow-y-auto max-h-[55vh]">
              {(() => {
                const currentTbl = uploadPreviewData.tableSummaries.find(t => t.tableName === selectedInspectTable)
                  || uploadPreviewData.tableSummaries[0];

                if (!currentTbl) {
                  return <div className="text-center text-slate-400 py-8">No records in this table.</div>;
                }

                const filteredRows = currentTbl.sample.filter(row => {
                  if (!inspectSearch.trim()) return true;
                  const q = inspectSearch.toLowerCase();
                  return Object.values(row).some(v => String(v || '').toLowerCase().includes(q));
                });

                return (
                  <div className="space-y-4">
                    {/* Destination Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-700">Where this data will display:</span>{' '}
                          <span className="font-bold text-indigo-900">{currentTbl.destination || 'PCU Directory & Application Views'}</span>
                        </div>
                      </div>
                      {currentTbl.category && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase self-start sm:self-auto border border-indigo-200">
                          {currentTbl.category}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Showing sample of {filteredRows.length} of {currentTbl.count.toLocaleString()} records ({currentTbl.sampleKeys.length} columns)</span>
                      
                      {/* Search Filter */}
                      <div className="relative w-full sm:w-60">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={inspectSearch}
                          onChange={(e) => setInspectSearch(e.target.value)}
                          placeholder="Search in sample records..."
                          className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            {currentTbl.sampleKeys.map((col, idx) => (
                              <th key={idx} className="py-2.5 px-3 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRows.length > 0 ? (
                            filteredRows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50">
                                {currentTbl.sampleKeys.map((col, cIdx) => (
                                  <td key={cIdx} className="py-2 px-3 text-slate-700 whitespace-nowrap max-w-xs truncate font-mono text-[11px]">
                                    {row[col] !== null && row[col] !== undefined
                                      ? typeof row[col] === 'object'
                                        ? JSON.stringify(row[col])
                                        : String(row[col])
                                      : <span className="text-slate-300 italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={currentTbl.sampleKeys.length} className="py-6 text-center text-slate-400">
                                No records match search query.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showConfirmModal && uploadPreviewData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800">
                  Confirm Database Restoration
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  You are about to restore data from <strong className="text-slate-700">{uploadPreviewData.fileName}</strong>.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Detected Format:</span>
                  <span className="font-bold text-slate-800 uppercase">{uploadPreviewData.format}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Records:</span>
                  <span className="font-bold text-indigo-600">{uploadPreviewData.totalRecords.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tables Found:</span>
                  <span className="font-bold text-slate-800">{uploadPreviewData.totalTables}</span>
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Restoration Mode:</span>
                  <span className={`font-bold uppercase ${restoreMode === 'replace' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {restoreMode === 'replace' ? 'Replace / Overwrite' : 'Merge & Update'}
                  </span>
                </div>
              </div>

              {restoreMode === 'replace' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                  <span className="font-bold block">Notice:</span>
                  Replace mode will clean and replace affected tables. Master admin login credentials will be preserved.
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={restoring}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="execute-restore-confirm-button"
                  onClick={handleExecuteRestore}
                  disabled={restoring}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {restoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    'Confirm & Restore'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Snippet Export Preview Modal */}
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
