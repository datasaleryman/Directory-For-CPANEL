import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  Save, 
  Undo2, 
  Upload, 
  Trash2, 
  Plus, 
  ArrowRight, 
  Folder, 
  Check, 
  RefreshCw,
  FileUp,
  Phone,
  User,
  MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ParseResult, BulkPreviewResponse } from '../types.js';

interface BulkImportProps {
  authToken: string;
  onImportComplete: () => void;
  onCancel: () => void;
  onGoToDirectory?: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

export const BulkImport: React.FC<BulkImportProps> = ({
  authToken,
  onImportComplete,
  onCancel,
  onGoToDirectory,
  showToast
}) => {
  const [inputText, setInputText] = useState('');
  const [defaultBarangay, setDefaultBarangay] = useState('Barangay Central');
  const [defaultPurok, setDefaultPurok] = useState('');
  const [availableBarangays, setAvailableBarangays] = useState<string[]>([
    'Barangay Central',
    'San Jose',
    'Poblacion',
    'Santa Cruz',
    'San Roque',
    'Bagong Silang',
    'Concepcion',
    'Maligaya'
  ]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<BulkPreviewResponse | null>(null);
  const [editableResults, setEditableResults] = useState<ParseResult[]>([]);
  
  // Conflict and Save States
  const [importOption, setImportOption] = useState<'save_all' | 'replace_duplicate' | 'add_as_new' | 'skip_invalid'>('save_all');
  const [savingRecords, setSavingRecords] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importSummary, setImportSummary] = useState<{
    total: number;
    saved: number;
    replaced: number;
    skipped: number;
  } | null>(null);

  // Fetch known barangays for the default selector
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await fetch('/api/public/barangays');
        if (res.ok) {
          const data = await res.json();
          if (data.barangays && Array.isArray(data.barangays) && data.barangays.length > 0) {
            setAvailableBarangays(Array.from(new Set(['Barangay Central', ...data.barangays])));
          }
        }
      } catch {
        // Fall back to default list
      }
    };
    fetchBarangays();
  }, []);

  // Handle File Input or Drag-and-Drop
  const handleProcessFile = (file: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    setFileLoading(true);

    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);

          if (!csvText.trim()) {
            showToast('Uploaded spreadsheet is empty.', 'warning');
          } else {
            setInputText(csvText);
            showToast(`Loaded ${file.name} with spreadsheet rows ready to save!`, 'success');
          }
        } catch (err: any) {
          showToast('Failed to read spreadsheet file: ' + err.message, 'error');
        } finally {
          setFileLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Plain text / TSV / formatted list
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          showToast('Uploaded file is empty.', 'warning');
        } else {
          setInputText(text);
          showToast(`Loaded ${file.name} successfully!`, 'success');
        }
        setFileLoading(false);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Direct 1-Click Save (Immediately processes and commits to directory)
  const handleDirectSave = async () => {
    if (!inputText.trim()) {
      showToast('Please type, paste, or upload contact records first.', 'warning');
      return;
    }

    setSavingRecords(true);
    try {
      const res = await fetch('/api/contacts/bulk-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          text: inputText,
          defaultBarangay,
          defaultPurok,
          option: importOption
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save bulk entries.');
      }

      setImportSummary(data);
      showToast(`Bulk Entry Complete! Saved ${data.saved} contact records.`, 'success');
      setInputText('');
      setPreviewData(null);
      onImportComplete();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingRecords(false);
    }
  };

  // Generate Preview & Validation
  const handleGeneratePreview = async () => {
    if (!inputText.trim()) {
      showToast('Please paste or write some contact records first.', 'warning');
      return;
    }

    setLoadingPreview(true);
    setPreviewData(null);
    setImportSummary(null);

    try {
      const res = await fetch('/api/contacts/bulk-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ 
          text: inputText,
          defaultBarangay,
          defaultPurok
        })
      });

      const data: BulkPreviewResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as any).error || 'Failed to analyze bulk list.');
      }

      setPreviewData(data);
      setEditableResults(data.results ? [...data.results] : []);
      showToast(`Analyzed ${data.results.length} rows. Review and save below!`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Commit from the Preview Table
  const handleCommitImport = async () => {
    if (!editableResults || editableResults.length === 0) {
      showToast('No preview records available to save.', 'warning');
      return;
    }

    setSavingRecords(true);
    try {
      const res = await fetch('/api/contacts/bulk-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          items: editableResults,
          option: importOption
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete bulk import.');
      }

      setImportSummary(data);
      showToast(`Bulk Entry Complete! Saved ${data.saved} contact records.`, 'success');
      setInputText('');
      onImportComplete();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingRecords(false);
    }
  };

  const handleUpdateRow = (index: number, field: keyof ParseResult, value: string) => {
    setEditableResults(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      // If user fixed the name, mark valid
      if (field === 'full_name' && value.trim().length >= 2 && updated[index].status === 'invalid') {
        updated[index].status = 'valid';
        updated[index].reason = undefined;
      }
      return updated;
    });
  };

  const handleDeleteRow = (index: number) => {
    setEditableResults(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddBlankRow = () => {
    setEditableResults(prev => [
      ...prev,
      {
        raw: '',
        full_name: '',
        barangay: defaultBarangay,
        purok: defaultPurok,
        contact_number: '',
        status: 'valid'
      }
    ]);
  };

  const handleReset = () => {
    setPreviewData(null);
    setEditableResults([]);
    setImportSummary(null);
    setInputText('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-sm shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl font-display tracking-tight">
              Bulk Entry &amp; Import
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Easily paste lists, upload Excel / CSV files, or enter batch records into the PCU / Barangay directory.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onGoToDirectory && (
            <button
              onClick={onGoToDirectory}
              className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-4 py-2.5 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Folder className="w-3.5 h-3.5 text-emerald-700" />
              View Directory
            </button>
          )}
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 hover:bg-slate-50 transition-all cursor-pointer text-center"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Input Screen */}
      {!previewData && !importSummary && (
        <div className="space-y-6">
          {/* Format Guide Pill */}
          <div className="bg-slate-50/80 border border-slate-200/80 p-4 sm:p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                Flexible Input Formats
              </h5>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Auto-detects: Excel, CSV, Pipe (|), Semicolon (;), Tab, or Names only
              </span>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              You can paste names directly (one per line) or copy-paste columns from Excel/Google Sheets. Only the <strong>Full Name</strong> is required. If Barangay or Purok is omitted, your default selections below will be assigned automatically!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-700">
                <span className="text-emerald-700 font-bold block font-sans text-xs mb-1">Single Names:</span>
                <code>Juan Dela Cruz<br/>Maria Santos<br/>Pedro Reyes</code>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-700">
                <span className="text-emerald-700 font-bold block font-sans text-xs mb-1">Pipe Delimited:</span>
                <code>Juan Dela Cruz | San Jose | Purok 1 | 09171234567<br/>Maria Santos | Central</code>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-700">
                <span className="text-emerald-700 font-bold block font-sans text-xs mb-1">CSV / Excel Copy:</span>
                <code>Juan Dela Cruz,San Jose,Purok 1,09171234567<br/>Maria Santos,Central,,09201112233</code>
              </div>
            </div>
          </div>

          {/* Default Assignment Options Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/70">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-emerald-600" />
                Default Barangay (For lines without one)
              </label>
              <select
                value={defaultBarangay}
                onChange={(e) => setDefaultBarangay(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                {availableBarangays.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Default Purok (Optional)
              </label>
              <input
                type="text"
                value={defaultPurok}
                onChange={(e) => setDefaultPurok(e.target.value)}
                placeholder="e.g. Purok 1 or leave blank"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Save &amp; Conflict Rule
              </label>
              <select
                value={importOption}
                onChange={(e) => setImportOption(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                <option value="save_all">Save &amp; Update All (Recommended)</option>
                <option value="replace_duplicate">Update Existing Records With New Details</option>
                <option value="add_as_new">Add All As New Contacts (Keep Duplicates)</option>
                <option value="skip_invalid">Skip Existing Duplicates</option>
              </select>
            </div>
          </div>

          {/* File Upload Drag & Drop Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all cursor-pointer ${
              isDragging 
                ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]' 
                : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/70'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                {fileLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Click to browse or drag and drop an Excel (.xlsx, .xls), CSV, or Text file
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  The spreadsheet contents will be automatically extracted into the text field below.
                </p>
              </div>
            </div>
          </div>

          {/* Textarea for Paste & Direct Typing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Delimited Contact Records (Paste or Type Below)
              </label>
              {inputText.trim() && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {inputText.split('\n').filter(l => l.trim()).length} rows detected
                </span>
              )}
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={9}
              className="w-full p-4 bg-slate-50/50 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-2xl transition-all text-slate-800 text-xs sm:text-sm font-mono outline-none placeholder:text-slate-400 leading-relaxed"
              placeholder="Paste or type lines here:&#10;Juan Dela Cruz | Barangay San Jose | Purok 4 | 09171234567&#10;Maria Santos | Barangay Central&#10;Pedro Reyes (Missing Barangay will automatically use Default Barangay)&#10;Lina Gomez | | Purok 2"
              disabled={savingRecords || loadingPreview}
            />
          </div>

          {/* Action Buttons: Direct Save vs Preview */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            {/* Direct Save Button */}
            <button
              onClick={handleDirectSave}
              disabled={savingRecords || loadingPreview || !inputText.trim()}
              className="flex-1 sm:flex-initial px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {savingRecords ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Directory Records...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save All Data Directly
                </>
              )}
            </button>

            {/* Preview Button */}
            <button
              onClick={handleGeneratePreview}
              disabled={savingRecords || loadingPreview || !inputText.trim()}
              className="flex-1 sm:flex-initial px-6 py-3.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {loadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Records...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Preview &amp; Review Records First
                </>
              )}
            </button>

            {inputText.trim() && (
              <button
                onClick={() => setInputText('')}
                disabled={savingRecords || loadingPreview}
                className="px-4 py-3 text-slate-500 hover:text-slate-800 font-semibold text-xs rounded-xl hover:bg-slate-100 transition-all text-center cursor-pointer"
              >
                Clear Text
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Preview & Verification Table */}
      {previewData && !importSummary && (
        <div className="space-y-6">
          {/* Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Format</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">{previewData.detectedSeparator}</span>
            </div>
            <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200/80 text-center">
              <span className="block text-[10px] font-bold text-blue-600 uppercase">Total Rows</span>
              <span className="text-base font-extrabold text-blue-800 mt-1 block">{editableResults.length}</span>
            </div>
            <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/80 text-center">
              <span className="block text-[10px] font-bold text-emerald-600 uppercase">✓ Ready</span>
              <span className="text-base font-extrabold text-emerald-800 mt-1 block">
                {editableResults.filter(r => r.status === 'valid').length}
              </span>
            </div>
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80 text-center">
              <span className="block text-[10px] font-bold text-amber-600 uppercase">⚠ Duplicates</span>
              <span className="text-base font-extrabold text-amber-800 mt-1 block">
                {editableResults.filter(r => r.status === 'duplicate').length}
              </span>
            </div>
            <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-200/80 text-center col-span-2 sm:col-span-1">
              <span className="block text-[10px] font-bold text-rose-600 uppercase">✖ Invalids</span>
              <span className="text-base font-extrabold text-rose-800 mt-1 block">
                {editableResults.filter(r => r.status === 'invalid').length}
              </span>
            </div>
          </div>

          {/* Conflict Behavior Switcher */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h5 className="font-extrabold text-slate-800 text-xs sm:text-sm">Conflict &amp; Duplicate Handling</h5>
              <p className="text-xs text-slate-500">Choose how duplicates and existing directory records will be stored.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImportOption('save_all')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  importOption === 'save_all'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Save &amp; Update All
              </button>
              <button
                type="button"
                onClick={() => setImportOption('replace_duplicate')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  importOption === 'replace_duplicate'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Update Duplicates Only
              </button>
              <button
                type="button"
                onClick={() => setImportOption('add_as_new')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  importOption === 'add_as_new'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Add As New Records
              </button>
              <button
                type="button"
                onClick={() => setImportOption('skip_invalid')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  importOption === 'skip_invalid'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Skip Duplicates
              </button>
            </div>
          </div>

          {/* Editable Preview Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Live Editable Preview ({editableResults.length} records)
              </span>
              <button
                onClick={handleAddBlankRow}
                className="text-xs font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200/80 px-2.5 py-1 rounded-lg border border-emerald-300/80 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50/90 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Full Name *</th>
                    <th className="py-2.5 px-3">Barangay</th>
                    <th className="py-2.5 px-3">Purok</th>
                    <th className="py-2.5 px-3">Contact Number</th>
                    <th className="py-2.5 px-3">Status / Action</th>
                    <th className="py-2.5 px-2 w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {editableResults.map((item, index) => {
                    const isDup = item.status === 'duplicate';
                    const isInv = item.status === 'invalid';
                    return (
                      <tr 
                        key={index}
                        className={isInv ? 'bg-rose-50/40' : isDup ? 'bg-amber-50/30' : 'hover:bg-slate-50/60'}
                      >
                        <td className="py-2.5 px-3 text-center text-[11px] font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.full_name || ''}
                            onChange={(e) => handleUpdateRow(index, 'full_name', e.target.value)}
                            placeholder="Enter Name"
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-xs font-bold text-slate-800 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.barangay || ''}
                            onChange={(e) => handleUpdateRow(index, 'barangay', e.target.value)}
                            placeholder={defaultBarangay}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-xs font-medium text-slate-700 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.purok || ''}
                            onChange={(e) => handleUpdateRow(index, 'purok', e.target.value)}
                            placeholder="e.g. Purok 1"
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-xs font-medium text-slate-700 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.contact_number || ''}
                            onChange={(e) => handleUpdateRow(index, 'contact_number', e.target.value)}
                            placeholder="09..."
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-lg text-xs font-mono text-slate-700 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          {isInv ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/80 border border-rose-300 px-2 py-0.5 rounded-md">
                              <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                              {item.reason || 'Invalid Name'}
                            </span>
                          ) : isDup ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              Ready to Save
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={handleCommitImport}
              disabled={savingRecords || editableResults.length === 0}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              {savingRecords ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Directory Records...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Commit &amp; Save All {editableResults.length} Records Now
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              disabled={savingRecords}
              className="px-5 py-3.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              <Undo2 className="w-4 h-4" />
              Reset &amp; Edit Text
            </button>
          </div>
        </div>
      )}

      {/* Success Summary Screen */}
      {importSummary && (
        <div className="bg-emerald-50/50 border border-emerald-200/90 p-6 sm:p-9 rounded-3xl flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 border-2 border-emerald-300 rounded-full flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h4 className="font-extrabold text-slate-900 text-xl sm:text-2xl font-display">
              Bulk Import Saved Successfully!
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Your contact records have been securely added and updated in the PCU / Barangay directory.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-emerald-200 rounded-2xl p-4 w-full max-w-xl shadow-sm text-center">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Processed</span>
              <span className="text-lg font-black text-slate-800 block mt-1">{importSummary.total}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-emerald-600 uppercase">Saved to DB</span>
              <span className="text-lg font-black text-emerald-700 block mt-1">{importSummary.saved}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-blue-600 uppercase">Updated</span>
              <span className="text-lg font-black text-blue-700 block mt-1">{importSummary.replaced}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Skipped</span>
              <span className="text-lg font-black text-slate-500 block mt-1">{importSummary.skipped}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full sm:w-auto">
            {onGoToDirectory && (
              <button
                onClick={onGoToDirectory}
                className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <Folder className="w-4 h-4" />
                Go to PCU / Barangay Directory
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            )}

            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
            >
              <RefreshCw className="w-4 h-4" />
              Import More Records
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
