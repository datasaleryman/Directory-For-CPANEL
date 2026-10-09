import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Plus,
  Search,
  Trash2,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileUp,
  RefreshCw,
  ExternalLink,
  Edit3,
  Save,
  Layers,
  BookOpen,
  Filter,
  Sparkles,
  Printer,
  Pill,
  Stethoscope,
  ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { MaintenanceRecord } from '../types.js';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch (e) {
  console.warn('Could not configure pdfjs worker URL:', e);
}

interface MaintenanceProps {
  authToken: string;
  currentUser?: {
    username: string;
    role: string;
    displayName?: string;
    barangay?: string;
  } | null;
  showToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

interface StagedPdfFile {
  fileName: string;
  fileData: string; // base64 data URL
  size: number;
  pagesCount: number;
  entriesCount: number;
}

interface DraftMaintenanceEntry {
  tempId: string;
  primaryText: string;
  fullName: string;
  columns: string[];
  columnHeaders?: string[];
  rawData?: Record<string, string>;
  rawText: string;
  pdfFileName: string;
  pdfPageNumber: number;
}

const ALPHABET_LETTERS = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];

export const Maintenance: React.FC<MaintenanceProps> = ({
  authToken,
  currentUser,
  showToast
}) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Active Section Tab: 'maintenance' (unconsulted list) vs 'consulted' (Consulted tab)
  const [activeSectionTab, setActiveSectionTab] = useState<'maintenance' | 'consulted'>('maintenance');

  // Search, Filter, Alphabetical Sort & Pagination States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPdfFilter, setSelectedPdfFilter] = useState<string>('ALL');
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortColumnIndex, setSortColumnIndex] = useState<number>(-1); // -1 = primaryText (smart alphabetical)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Add Bulk Entry Modal States
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [isSavingBulk, setIsSavingBulk] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [stagedPdfFiles, setStagedPdfFiles] = useState<StagedPdfFile[]>([]);
  const [draftEntries, setDraftEntries] = useState<DraftMaintenanceEntry[]>([]);
  const [manualBulkText, setManualBulkText] = useState<string>('');
  const [showManualTextPanel, setShowManualTextPanel] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const PREVIEW_PER_PAGE = 15;

  // Detail / Edit / Add Maintenance Modal States
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [isEditingRecord, setIsEditingRecord] = useState<boolean>(false);
  const [editColumns, setEditColumns] = useState<string[]>([]);
  const [editPrimaryText, setEditPrimaryText] = useState<string>('');
  const [savingRecordEdit, setSavingRecordEdit] = useState<boolean>(false);

  // "Add Maintenance" Form States (Maintain Medicine text box, Disease text box)
  const [isAddingMaintenance, setIsAddingMaintenance] = useState<boolean>(false);
  const [maintainMedicineInput, setMaintainMedicineInput] = useState<string>('');
  const [diseaseInput, setDiseaseInput] = useState<string>('');
  const [savingMaintenanceForm, setSavingMaintenanceForm] = useState<boolean>(false);

  // Delete Confirmation States
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [clearingAll, setClearingAll] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMaintenanceRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/maintenance?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to load Maintenance records.');
      }
      const data = await res.json();
      if (Array.isArray(data.records)) {
        setRecords(data.records);
      }
    } catch (err: any) {
      showToast(err.message || 'Could not load maintenance records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceRecords();
    const handleRestore = () => fetchMaintenanceRecords();
    window.addEventListener('clinic-data-restored', handleRestore);
    return () => window.removeEventListener('clinic-data-restored', handleRestore);
  }, [authToken]);

  // Reset to page 1 when filters, tab, or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSectionTab, searchQuery, selectedPdfFilter, selectedLetter, sortOrder, sortColumnIndex, itemsPerPage]);

  // Helper to check if a record has been transferred to "Consulted"
  const isRecordConsulted = (rec: MaintenanceRecord): boolean => {
    return Boolean(
      rec.isConsulted ||
      (rec.maintenanceMedicine && rec.maintenanceMedicine.trim().length > 0) ||
      (rec.disease && rec.disease.trim().length > 0)
    );
  };

  // Helper to get clean alphabetical sort key from a string
  const getCleanSortKey = (val: string): string => {
    if (!val) return '';
    // Strip leading row numbers like "1.", "01)", "#12", "1 - " so alphabetical sort compares the actual name/data
    return val
      .replace(/^\s*(?:\d+[\.\)\-:]|\#\d+)\s*/, '')
      .trim();
  };

  // Extract rows and columns from a PDF file in the browser using pdfjs-dist
  const extractPdfInBrowser = async (arrayBuffer: ArrayBuffer, fileName: string): Promise<{
    pagesCount: number;
    entries: DraftMaintenanceEntry[];
  }> => {
    const uint8 = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: true,
      disableFontFace: true
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages || 1;
    const extracted: DraftMaintenanceEntry[] = [];
    let detectedHeaders: string[] | undefined = undefined;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || []).filter(
        (it: any) => it && typeof it.str === 'string' && it.str.trim().length > 0
      );

      // Group text items into horizontal lines using Y coordinate tolerance
      const rowGroups: { y: number; items: { x: number; width: number; text: string }[] }[] = [];
      const rowTolerance = 4.5;

      for (const it of rawItems as any[]) {
        const tx = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0];
        const x = Number(tx[4]) || 0;
        const y = Number(tx[5]) || 0;
        const width = Number(it.width) || it.str.length * 5;
        const text = String(it.str).trim();

        let matchedRow = rowGroups.find(rg => Math.abs(rg.y - y) <= rowTolerance);
        if (!matchedRow) {
          matchedRow = { y, items: [] };
          rowGroups.push(matchedRow);
        }
        matchedRow.items.push({ x, width, text });
      }

      // Sort rows from top of page to bottom (descending Y in PDF coordinate space)
      rowGroups.sort((a, b) => b.y - a.y);

      for (const rg of rowGroups) {
        rg.items.sort((a, b) => a.x - b.x);
        const cols: string[] = [];
        let currentCell = '';
        let prevRight = -99999;

        for (const cellItem of rg.items) {
          if (currentCell === '') {
            currentCell = cellItem.text;
            prevRight = cellItem.x + cellItem.width;
          } else {
            const gap = cellItem.x - prevRight;
            if (gap > 11) {
              cols.push(currentCell.trim());
              currentCell = cellItem.text;
            } else if (gap > 1.2) {
              currentCell += ' ' + cellItem.text;
            } else {
              currentCell += cellItem.text;
            }
            prevRight = Math.max(prevRight, cellItem.x + cellItem.width);
          }
        }
        if (currentCell.trim()) {
          cols.push(currentCell.trim());
        }

        // If only 1 column was formed, check for tab, pipe, or multi-space column separators
        let finalCols = cols;
        if (finalCols.length === 1) {
          const single = finalCols[0];
          if (single.includes('\t')) {
            finalCols = single.split('\t').map(s => s.trim()).filter(Boolean);
          } else if (single.includes('|')) {
            finalCols = single.split('|').map(s => s.trim()).filter(Boolean);
          } else if (/\s{3,}/.test(single)) {
            finalCols = single.split(/\s{3,}/).map(s => s.trim()).filter(Boolean);
          }
        }

        if (finalCols.length === 0) continue;
        const rawText = finalCols.join(' | ');

        // Ignore pure "Page X of Y" footer lines if there are other data lines on the page
        if (rowGroups.length > 1 && /^page\s+\d+\s*(of\s+\d+)?$/i.test(rawText.trim())) {
          continue;
        }

        // Check if this row is a table header row
        const upperJoined = finalCols.join(' ').toUpperCase();
        const isHeaderRow =
          finalCols.length >= 2 &&
          /^(NO\.?|#|ID|FULL\s*NAME|PATIENT\s*NAME|NAME|LAST\s*NAME|BARANGAY|ADDRESS|PUROK|CONTACT|MEDICINE|MAINTENANCE)$/i.test(finalCols[0].trim()) &&
          (upperJoined.includes('NAME') ||
            upperJoined.includes('BARANGAY') ||
            upperJoined.includes('MEDICINE') ||
            upperJoined.includes('MAINTENANCE') ||
            upperJoined.includes('CONTACT') ||
            upperJoined.includes('ADDRESS'));

        if (isHeaderRow && !detectedHeaders) {
          detectedHeaders = finalCols;
          continue;
        }
        if (
          isHeaderRow &&
          detectedHeaders &&
          finalCols.join('|').toUpperCase() === detectedHeaders.join('|').toUpperCase()
        ) {
          continue;
        }

        // Pick primary text for alphabetical sorting (first column that isn't just a row index number)
        const nonIndexCol = finalCols.find(c => c && !/^\s*(?:\d+[\.\)\-:]?|\#\d+)\s*$/.test(c));
        const rawPrimary = nonIndexCol || finalCols[0] || rawText;
        const primaryText = getCleanSortKey(rawPrimary) || rawPrimary;

        const rawData: Record<string, string> = {};
        finalCols.forEach((colVal, cIdx) => {
          const headerKey =
            detectedHeaders && detectedHeaders[cIdx] ? detectedHeaders[cIdx] : `Column ${cIdx + 1}`;
          rawData[headerKey] = colVal;
        });

        extracted.push({
          tempId: `${Date.now()}-${pageNum}-${extracted.length}-${Math.random().toString(36).slice(2, 7)}`,
          primaryText,
          fullName: primaryText,
          columns: finalCols,
          columnHeaders: detectedHeaders,
          rawData,
          rawText,
          pdfFileName: fileName,
          pdfPageNumber: pageNum
        });
      }
    }

    return { pagesCount: numPages, entries: extracted };
  };

  // Handle uploading one or multiple PDF (or spreadsheet/text) files in Add Bulk Entry
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    setIsParsingPdf(true);
    let totalExtractedCount = 0;
    const newStagedFiles: StagedPdfFile[] = [];
    const newDraftEntries: DraftMaintenanceEntry[] = [];

    try {
      for (const file of filesArray) {
        const lowerName = file.name.toLowerCase();

        // Read file as DataURL (for server fallback & PDF storage) and ArrayBuffer (for client parser)
        const fileDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsDataURL(file);
        });

        const arrayBuffer = await file.arrayBuffer();

        if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
          let pagesCount = 1;
          let fileEntries: DraftMaintenanceEntry[] = [];

          // 1. Try client-side PDF extraction first
          try {
            const parsedClient = await extractPdfInBrowser(arrayBuffer, file.name);
            pagesCount = parsedClient.pagesCount;
            fileEntries = parsedClient.entries;
          } catch (clientErr) {
            console.warn('Client PDF parse fallback to server:', clientErr);
          }

          // 2. If client-side yielded 0 entries (or worker blocked), use server-side PDF extraction
          if (fileEntries.length === 0) {
            try {
              const res = await fetch('/api/maintenance/parse-pdf', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({
                  files: [{ fileName: file.name, fileData: fileDataUrl }]
                })
              });
              if (res.ok) {
                const srvData = await res.json();
                if (Array.isArray(srvData.entries) && srvData.entries.length > 0) {
                  fileEntries = srvData.entries.map((e: any, i: number) => ({
                    tempId: `${Date.now()}-srv-${i}-${Math.random().toString(36).slice(2, 7)}`,
                    primaryText: e.primaryText || e.fullName || e.rawText || '',
                    fullName: e.fullName || e.primaryText || e.rawText || '',
                    columns: Array.isArray(e.columns) ? e.columns : [String(e.rawText || '')],
                    columnHeaders: e.columnHeaders,
                    rawData: e.rawData,
                    rawText: e.rawText || '',
                    pdfFileName: file.name,
                    pdfPageNumber: Number(e.pdfPageNumber) || 1
                  }));
                }
                if (Array.isArray(srvData.files) && srvData.files[0]?.pages) {
                  pagesCount = srvData.files[0].pages;
                }
              }
            } catch (srvErr) {
              console.warn('Server PDF parse error:', srvErr);
            }
          }

          // 3. If the PDF is a scanned image PDF with no selectable text layer, still add a record for each page so it is never lost
          if (fileEntries.length === 0) {
            for (let p = 1; p <= pagesCount; p++) {
              const label = pagesCount > 1 ? `${file.name} (Page ${p})` : file.name;
              fileEntries.push({
                tempId: `${Date.now()}-img-${p}-${Math.random().toString(36).slice(2, 7)}`,
                primaryText: label,
                fullName: label,
                columns: [label, `PDF Document Page ${p}`, `${(file.size / 1024).toFixed(1)} KB`],
                columnHeaders: ['Document Name', 'Page Info', 'File Size'],
                rawData: {
                  'Document Name': label,
                  'Page Info': `PDF Document Page ${p}`,
                  'File Size': `${(file.size / 1024).toFixed(1)} KB`
                },
                rawText: `${label} | PDF Document Page ${p}`,
                pdfFileName: file.name,
                pdfPageNumber: p
              });
            }
          }

          newStagedFiles.push({
            fileName: file.name,
            fileData: fileDataUrl,
            size: file.size,
            pagesCount,
            entriesCount: fileEntries.length
          });
          newDraftEntries.push(...fileEntries);
          totalExtractedCount += fileEntries.length;
        } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
          // Also support spreadsheet files if uploaded
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          let headers: string[] | undefined = undefined;
          let sheetEntriesCount = 0;

          rows.forEach((r, idx) => {
            const cols = (r || []).map(c => String(c ?? '').trim()).filter((_, i, arr) => arr.some(Boolean));
            if (cols.length === 0 || cols.every(c => !c)) return;
            if (idx === 0 && cols.some(c => /name|barangay|medicine|maintenance|contact|address/i.test(c))) {
              headers = cols;
              return;
            }
            const nonIndexCol = cols.find(c => c && !/^\s*(?:\d+[\.\)\-:]?|\#\d+)\s*$/.test(c));
            const primaryText = getCleanSortKey(nonIndexCol || cols[0]) || cols[0];
            newDraftEntries.push({
              tempId: `${Date.now()}-xl-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              primaryText,
              fullName: primaryText,
              columns: cols,
              columnHeaders: headers,
              rawText: cols.join(' | '),
              pdfFileName: file.name,
              pdfPageNumber: 1
            });
            sheetEntriesCount++;
            totalExtractedCount++;
          });

          newStagedFiles.push({
            fileName: file.name,
            fileData: fileDataUrl,
            size: file.size,
            pagesCount: 1,
            entriesCount: sheetEntriesCount
          });
        } else {
          // Plain text file fallback
          const text = new TextDecoder().decode(arrayBuffer);
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          lines.forEach((line, idx) => {
            const cols = line.includes('\t')
              ? line.split('\t').map(s => s.trim())
              : line.includes('|')
                ? line.split('|').map(s => s.trim())
                : [line];
            const nonIndexCol = cols.find(c => c && !/^\s*(?:\d+[\.\)\-:]?|\#\d+)\s*$/.test(c));
            const primaryText = getCleanSortKey(nonIndexCol || cols[0]) || cols[0];
            newDraftEntries.push({
              tempId: `${Date.now()}-txt-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              primaryText,
              fullName: primaryText,
              columns: cols,
              rawText: cols.join(' | '),
              pdfFileName: file.name,
              pdfPageNumber: 1
            });
            totalExtractedCount++;
          });
          newStagedFiles.push({
            fileName: file.name,
            fileData: fileDataUrl,
            size: file.size,
            pagesCount: 1,
            entriesCount: lines.length
          });
        }
      }

      if (newStagedFiles.length > 0) {
        setStagedPdfFiles(prev => [...prev, ...newStagedFiles]);
      }
      if (newDraftEntries.length > 0) {
        setDraftEntries(prev => [...prev, ...newDraftEntries]);
        showToast(
          `Extracted ${totalExtractedCount} entries from ${newStagedFiles.length} PDF file(s)!`,
          'success'
        );
      } else {
        showToast('No entries could be found in the selected file(s).', 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'Error reading PDF file.', 'error');
    } finally {
      setIsParsingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Append manual bulk lines into draftEntries
  const handleAddManualLinesToDraft = () => {
    if (!manualBulkText.trim()) {
      showToast('Please paste or type lines to add.', 'warning');
      return;
    }
    const lines = manualBulkText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const addedDrafts: DraftMaintenanceEntry[] = lines.map((line, idx) => {
      let cols: string[] = [];
      if (line.includes('\t')) {
        cols = line.split('\t').map(s => s.trim()).filter(Boolean);
      } else if (line.includes('|')) {
        cols = line.split('|').map(s => s.trim()).filter(Boolean);
      } else if (line.includes(';')) {
        cols = line.split(';').map(s => s.trim()).filter(Boolean);
      } else if (line.includes(',')) {
        cols = line.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        cols = [line];
      }
      const nonIndexCol = cols.find(c => c && !/^\s*(?:\d+[\.\)\-:]?|\#\d+)\s*$/.test(c));
      const primaryText = getCleanSortKey(nonIndexCol || cols[0]) || cols[0];
      return {
        tempId: `${Date.now()}-man-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        primaryText,
        fullName: primaryText,
        columns: cols,
        rawText: cols.join(' | '),
        pdfFileName: stagedPdfFiles[0]?.fileName || 'Manual_Bulk_Entry.pdf',
        pdfPageNumber: 1
      };
    });

    setDraftEntries(prev => [...prev, ...addedDrafts]);
    setManualBulkText('');
    showToast(`Added ${addedDrafts.length} entries to staging preview!`, 'success');
  };

  // Save all draft entries to backend (/api/maintenance/bulk)
  const handleSaveBulkEntries = async () => {
    // If the user typed manual text without clicking "Add Lines", include those too
    let finalEntries = [...draftEntries];
    if (manualBulkText.trim()) {
      const extraLines = manualBulkText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map((line, idx) => {
          const cols = line.includes('\t')
            ? line.split('\t').map(s => s.trim()).filter(Boolean)
            : line.includes('|')
              ? line.split('|').map(s => s.trim()).filter(Boolean)
              : [line];
          const nonIndexCol = cols.find(c => c && !/^\s*(?:\d+[\.\)\-:]?|\#\d+)\s*$/.test(c));
          const primaryText = getCleanSortKey(nonIndexCol || cols[0]) || cols[0];
          return {
            tempId: `${Date.now()}-auto-${idx}`,
            primaryText,
            fullName: primaryText,
            columns: cols,
            rawText: cols.join(' | '),
            pdfFileName: stagedPdfFiles[0]?.fileName || 'Bulk_Entry.pdf',
            pdfPageNumber: 1
          };
        });
      finalEntries = [...finalEntries, ...extraLines];
    }

    if (finalEntries.length === 0) {
      showToast('Please select a PDF file with data first.', 'warning');
      return;
    }

    setIsSavingBulk(true);
    try {
      const res = await fetch('/api/maintenance/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          entries: finalEntries,
          pdfFiles: stagedPdfFiles.map(pf => ({
            fileName: pf.fileName,
            fileData: pf.fileData
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save bulk entries.');
      }

      if (Array.isArray(data.records)) {
        setRecords(data.records);
      } else {
        await fetchMaintenanceRecords();
      }

      showToast(
        `Successfully added ${data.addedCount || finalEntries.length} entries from PDF to Maintenance page!`,
        'success'
      );
      setStagedPdfFiles([]);
      setDraftEntries([]);
      setManualBulkText('');
      setIsBulkModalOpen(false);
      setCurrentPage(1);
    } catch (err: any) {
      showToast(err.message || 'Error saving bulk entries.', 'error');
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Remove a staged PDF file and its associated draft entries
  const handleRemoveStagedPdf = (fileName: string) => {
    setStagedPdfFiles(prev => prev.filter(f => f.fileName !== fileName));
    setDraftEntries(prev => prev.filter(e => e.pdfFileName !== fileName));
  };

  // Delete single record
  const handleConfirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    setDeletingRecord(true);
    try {
      const res = await fetch(`/api/maintenance/${encodeURIComponent(recordToDelete.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete entry.');
      }
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
      if (selectedRecord?.id === recordToDelete.id) {
        setSelectedRecord(null);
      }
      setRecordToDelete(null);
      showToast('Maintenance entry deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete entry.', 'error');
    } finally {
      setDeletingRecord(false);
    }
  };

  // Clear all or filtered PDF entries
  const handleConfirmClearAll = async () => {
    setClearingAll(true);
    try {
      const query =
        selectedPdfFilter !== 'ALL' ? `?pdfFileName=${encodeURIComponent(selectedPdfFilter)}` : '';
      const res = await fetch(`/api/maintenance${query}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to clear entries.');
      }
      if (selectedPdfFilter !== 'ALL') {
        setRecords(prev => prev.filter(r => r.pdfFileName !== selectedPdfFilter));
        showToast(`Cleared all entries from "${selectedPdfFilter}".`, 'success');
        setSelectedPdfFilter('ALL');
      } else {
        setRecords([]);
        showToast('Cleared all Maintenance entries.', 'success');
      }
      setShowClearConfirm(false);
    } catch (err: any) {
      showToast(err.message || 'Error clearing entries.', 'error');
    } finally {
      setClearingAll(false);
    }
  };

  // Save edited record
  const handleSaveRecordEdit = async () => {
    if (!selectedRecord) return;
    setSavingRecordEdit(true);
    try {
      const cleanedCols = editColumns.map(c => c.trim());
      const nonIndexCol = cleanedCols.find(c => c && !/^\s*(?:\d+[\.\)\-:]?|\#\d+)\s*$/.test(c));
      const newPrimary =
        editPrimaryText.trim() ||
        getCleanSortKey(nonIndexCol || cleanedCols[0] || '') ||
        selectedRecord.primaryText;

      const res = await fetch(`/api/maintenance/${encodeURIComponent(selectedRecord.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          primaryText: newPrimary,
          fullName: newPrimary,
          columns: cleanedCols,
          rawText: cleanedCols.join(' | ')
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update entry.');
      }
      const updatedRec: MaintenanceRecord = data.record;
      setRecords(prev => prev.map(r => (r.id === updatedRec.id ? updatedRec : r)));
      setSelectedRecord(updatedRec);
      setIsEditingRecord(false);
      showToast('Entry updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update entry.', 'error');
    } finally {
      setSavingRecordEdit(false);
    }
  };

  // Save "Add Maintenance" (Maintain Medicine + Disease) and transfer record to Consulted tab
  const handleSaveAddMaintenance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRecord) return;

    const trimmedMed = maintainMedicineInput.trim();
    const trimmedDisease = diseaseInput.trim();

    if (!trimmedMed && !trimmedDisease) {
      showToast('Please enter Maintain Medicine or Disease before saving.', 'warning');
      return;
    }

    setSavingMaintenanceForm(true);
    try {
      const res = await fetch(`/api/maintenance/${encodeURIComponent(selectedRecord.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          maintenanceMedicine: trimmedMed,
          disease: trimmedDisease,
          isConsulted: true,
          consultedAt: new Date().toISOString()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save maintenance details.');
      }
      const updatedRec: MaintenanceRecord = data.record;
      setRecords(prev => prev.map(r => (r.id === updatedRec.id ? updatedRec : r)));
      setIsAddingMaintenance(false);
      setSelectedRecord(null);
      showToast(
        `"${updatedRec.primaryText}" updated with Maintain Medicine & Disease and transferred to Consulted!`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to save maintenance details.', 'error');
    } finally {
      setSavingMaintenanceForm(false);
    }
  };

  // Counts for Maintenance (Unconsulted) vs Consulted tabs
  const unconsultedRecords = useMemo(
    () => records.filter(r => !isRecordConsulted(r)),
    [records]
  );
  const consultedRecords = useMemo(
    () => records.filter(r => isRecordConsulted(r)),
    [records]
  );
  const activeTabRecords = activeSectionTab === 'consulted' ? consultedRecords : unconsultedRecords;

  // Unique PDF file names for filter dropdown
  const uniquePdfFiles = useMemo(() => {
    const set = new Set<string>();
    activeTabRecords.forEach(r => {
      if (r.pdfFileName) set.add(r.pdfFileName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeTabRecords]);

  // Filter and Alphabetically Sort records for the active tab ('maintenance' vs 'consulted')
  const filteredAndSortedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = activeTabRecords.filter(rec => {
      // 1. PDF File Filter
      if (selectedPdfFilter !== 'ALL' && rec.pdfFileName !== selectedPdfFilter) {
        return false;
      }

      // 2. Alphabetical Letter Filter
      if (selectedLetter !== 'ALL') {
        const sortTarget =
          sortColumnIndex >= 0 && rec.columns[sortColumnIndex]
            ? getCleanSortKey(rec.columns[sortColumnIndex])
            : getCleanSortKey(rec.primaryText || rec.fullName || rec.rawText || '');
        const firstChar = (sortTarget.charAt(0) || '').toUpperCase();
        if (selectedLetter === '#') {
          if (/[A-Z]/.test(firstChar)) return false;
        } else if (firstChar !== selectedLetter) {
          return false;
        }
      }

      // 3. Search Query across ALL PDF columns, Maintain Medicine, Disease, and metadata
      if (q) {
        const inPrimary = (rec.primaryText || '').toLowerCase().includes(q);
        const inRaw = (rec.rawText || '').toLowerCase().includes(q);
        const inPdf = (rec.pdfFileName || '').toLowerCase().includes(q);
        const inMed = (rec.maintenanceMedicine || '').toLowerCase().includes(q);
        const inDisease = (rec.disease || '').toLowerCase().includes(q);
        const inCols = Array.isArray(rec.columns) && rec.columns.some(c => String(c).toLowerCase().includes(q));
        if (!inPrimary && !inRaw && !inPdf && !inMed && !inDisease && !inCols) {
          return false;
        }
      }

      return true;
    });

    // Sort Alphabetically (A -> Z or Z -> A)
    return [...filtered].sort((a, b) => {
      const valA =
        sortColumnIndex >= 0
          ? getCleanSortKey(String(a.columns?.[sortColumnIndex] || ''))
          : getCleanSortKey(a.primaryText || a.fullName || a.rawText || '');
      const valB =
        sortColumnIndex >= 0
          ? getCleanSortKey(String(b.columns?.[sortColumnIndex] || ''))
          : getCleanSortKey(b.primaryText || b.fullName || b.rawText || '');

      // Push empty values to the end
      if (!valA && valB) return 1;
      if (valA && !valB) return -1;

      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [activeTabRecords, searchQuery, selectedPdfFilter, selectedLetter, sortOrder, sortColumnIndex]);

  // Dynamic columns discovery so WHATEVER data/columns the PDF files have are all displayed
  const dynamicColumnsMeta = useMemo(() => {
    const sourceList = filteredAndSortedRecords.length > 0 ? filteredAndSortedRecords : records;
    let maxCols = 1;
    let detectedHeaders: string[] | undefined = undefined;

    for (const r of sourceList) {
      if (Array.isArray(r.columns) && r.columns.length > maxCols) {
        maxCols = r.columns.length;
      }
      if (!detectedHeaders && Array.isArray(r.columnHeaders) && r.columnHeaders.length > 0) {
        detectedHeaders = r.columnHeaders;
      }
    }

    // Cap table columns at 12 for horizontal readability (full columns always visible in row & modal)
    const displayColCount = Math.min(Math.max(maxCols, 1), 12);
    const headers: string[] = [];
    for (let i = 0; i < displayColCount; i++) {
      if (detectedHeaders && detectedHeaders[i]) {
        headers.push(detectedHeaders[i]);
      } else if (i === 0 && displayColCount === 1) {
        headers.push('PDF Entry Data (A–Z)');
      } else {
        headers.push(`PDF Data Column ${i + 1}`);
      }
    }
    return { count: displayColCount, maxCols, headers };
  }, [filteredAndSortedRecords, records]);

  // Numbered Pages (Pagination) calculations
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRecords = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredAndSortedRecords.slice(start, start + itemsPerPage);
  }, [filteredAndSortedRecords, safeCurrentPage, itemsPerPage]);

  // Compute visible page numbers for numbered pagination bar
  const visiblePageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 4) {
        pages.push('ellipsis-start');
      }
      const startPage = Math.max(2, Math.min(safeCurrentPage - 1, totalPages - 4));
      const endPage = Math.min(totalPages - 1, Math.max(safeCurrentPage + 1, 5));
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      if (safeCurrentPage < totalPages - 3) {
        pages.push('ellipsis-end');
      }
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  // Preview pagination inside the Add Bulk Entry modal
  const sortedDraftEntries = useMemo(() => {
    return [...draftEntries].sort((a, b) =>
      getCleanSortKey(a.primaryText).localeCompare(getCleanSortKey(b.primaryText), undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );
  }, [draftEntries]);

  const totalPreviewPages = Math.max(1, Math.ceil(sortedDraftEntries.length / PREVIEW_PER_PAGE));
  const safePreviewPage = Math.min(Math.max(1, previewPage), totalPreviewPages);
  const paginatedDraftEntries = useMemo(() => {
    const start = (safePreviewPage - 1) * PREVIEW_PER_PAGE;
    return sortedDraftEntries.slice(start, start + PREVIEW_PER_PAGE);
  }, [sortedDraftEntries, safePreviewPage]);

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpPageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      setCurrentPage(num);
      setJumpPageInput('');
    } else {
      showToast(`Please enter a page number between 1 and ${totalPages}.`, 'warning');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & "Add Bulk Entry" Action Header */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#064e3b] to-[#047857] text-white flex items-center justify-center shadow-md shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Maintenance
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  PDF Data Directory
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Upload PDF files via <span className="font-bold text-slate-700">Add Bulk Entry</span> to extract and display all PDF data sorted alphabetically with numbered pages.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setIsBulkModalOpen(true);
                setPreviewPage(1);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#064e3b] to-[#047857] hover:from-[#047857] hover:to-[#059669] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Bulk Entry</span>
            </button>

            <button
              onClick={() => fetchMaintenanceRecords()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Maintenance Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {records.length > 0 && (
              <>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer no-print"
                  title="Print Current Page"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer no-print"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {selectedPdfFilter !== 'ALL' ? 'Clear Selected PDF' : 'Clear All'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          <div
            onClick={() => setActiveSectionTab('maintenance')}
            className={`rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all border ${
              activeSectionTab === 'maintenance'
                ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs'
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Maintenance List
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-0.5 block">
                {unconsultedRecords.length.toLocaleString()}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveSectionTab('consulted')}
            className={`rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all border ${
              activeSectionTab === 'consulted'
                ? 'bg-teal-50/90 border-teal-300 shadow-2xs'
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 block">
                Consulted
              </span>
              <span className="text-xl sm:text-2xl font-black text-teal-900 tabular-nums mt-0.5 block">
                {consultedRecords.length.toLocaleString()}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Sort Order
              </span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-800 mt-1 block">
                {sortOrder === 'asc' ? 'Alphabetical (A → Z)' : 'Alphabetical (Z → A)'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center">
              {sortOrder === 'asc' ? <ArrowDownAZ className="w-5 h-5" /> : <ArrowUpAZ className="w-5 h-5" />}
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Numbered Pages
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-0.5 block">
                Page {safeCurrentPage} <span className="text-xs font-semibold text-slate-400">of {totalPages}</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Section Tabs: Maintenance List vs Consulted */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-100 no-print">
          <button
            type="button"
            onClick={() => setActiveSectionTab('maintenance')}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeSectionTab === 'maintenance'
                ? 'bg-gradient-to-r from-[#064e3b] to-[#047857] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Maintenance List</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums ${
                activeSectionTab === 'maintenance'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {unconsultedRecords.length.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSectionTab('consulted')}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeSectionTab === 'consulted'
                ? 'bg-gradient-to-r from-[#064e3b] to-[#047857] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Consulted</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums ${
                activeSectionTab === 'consulted'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {consultedRecords.length.toLocaleString()}
            </span>
          </button>
        </div>
      </div>

      {/* Search, PDF Filter, Alphabetical Sort & Letter Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search any name, medicine, barangay, or data from PDF..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by PDF File */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={selectedPdfFilter}
              onChange={e => setSelectedPdfFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:bg-white focus:border-emerald-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All PDF Files ({uniquePdfFiles.length})</option>
              {uniquePdfFiles.map(fn => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Column Selector */}
          <div className="md:col-span-2">
            <select
              value={sortColumnIndex}
              onChange={e => setSortColumnIndex(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:bg-white focus:border-emerald-600 focus:outline-none cursor-pointer"
              title="Choose which column to sort alphabetically"
            >
              <option value={-1}>Sort by: Primary Name / Data</option>
              {dynamicColumnsMeta.headers.map((h, i) => (
                <option key={i} value={i}>
                  Sort by: {h}
                </option>
              ))}
            </select>
          </div>

          {/* Alphabetical A-Z / Z-A Toggle Button */}
          <div className="md:col-span-2">
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              title="Toggle Alphabetical Sort Order (A to Z / Z to A)"
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowDownAZ className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Sort: A → Z</span>
                </>
              ) : (
                <>
                  <ArrowUpAZ className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Sort: Z → A</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Alphabetical A-Z Letter Quick-Jump Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1.5 shrink-0">
            A–Z Filter:
          </span>
          {ALPHABET_LETTERS.map(letter => {
            const active = selectedLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                className={`px-2.5 py-1 min-w-[28px] rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#064e3b] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Data Table Card with Top & Bottom Numbered Pages */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Top Pagination & Status Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-slate-700">
              Showing{' '}
              <span className="text-emerald-800 font-black">
                {filteredAndSortedRecords.length === 0
                  ? 0
                  : (safeCurrentPage - 1) * itemsPerPage + 1}
                –
                {Math.min(safeCurrentPage * itemsPerPage, filteredAndSortedRecords.length)}
              </span>{' '}
              of{' '}
              <span className="text-slate-900 font-black">
                {filteredAndSortedRecords.length.toLocaleString()}
              </span>{' '}
              entries
            </span>
            <span className="px-2 py-0.5 bg-emerald-100/80 text-emerald-800 rounded-md text-[11px] font-bold">
              Sorted Alphabetically ({sortOrder === 'asc' ? 'A → Z' : 'Z → A'})
            </span>
          </div>

          {/* Top Numbered Page Indicator & Rows Per Page */}
          <div className="flex items-center gap-2.5 flex-wrap no-print">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-medium">Rows:</span>
              <select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 cursor-pointer"
              >
                {[10, 20, 30, 50, 100].map(size => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 tabular-nums">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold">Loading PDF Maintenance data...</p>
          </div>
        ) : filteredAndSortedRecords.length === 0 ? (
          <div className="py-16 px-4 text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200/60">
              {activeSectionTab === 'consulted' ? (
                <ClipboardCheck className="w-8 h-8" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-800">
                {activeSectionTab === 'consulted'
                  ? consultedRecords.length === 0
                    ? 'No Consulted Records Yet'
                    : 'No Matching Consulted Entries Found'
                  : unconsultedRecords.length === 0
                    ? 'No PDF Data in Maintenance List'
                    : 'No Matching Maintenance Entries Found'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {activeSectionTab === 'consulted'
                  ? consultedRecords.length === 0
                    ? 'Click any entry in the Maintenance List to view its details, click "Add Maintenance", and enter Maintain Medicine & Disease. It will automatically be transferred here to the Consulted section.'
                    : 'Try clearing your search filter or selecting "ALL" on the alphabetical filter bar.'
                  : unconsultedRecords.length === 0
                    ? 'Click the "Add Bulk Entry" button above and select one or more PDF files. All data inside your PDF files will be automatically extracted, displayed here, and sorted alphabetically with numbered pages.'
                    : 'Try clearing your search filter or selecting "ALL" on the alphabetical filter bar.'}
              </p>
            </div>
            {activeSectionTab === 'maintenance' && unconsultedRecords.length === 0 && (
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#064e3b] to-[#047857] hover:from-[#047857] hover:to-[#059669] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bulk Entry from PDF</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#051f15] text-emerald-100 text-[11px] font-bold uppercase tracking-wider border-b border-emerald-900">
                  <th className="py-3.5 px-4 w-16 text-center">#</th>
                  {dynamicColumnsMeta.headers.map((headerLabel, colIdx) => {
                    const isSortedCol =
                      (sortColumnIndex === -1 && colIdx === 0) || sortColumnIndex === colIdx;
                    return (
                      <th
                        key={colIdx}
                        onClick={() => {
                          if (sortColumnIndex === colIdx) {
                            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSortColumnIndex(colIdx);
                            setSortOrder('asc');
                          }
                        }}
                        className="py-3.5 px-4 cursor-pointer hover:bg-emerald-900/50 transition-colors select-none"
                        title={`Click to sort alphabetically by ${headerLabel}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{headerLabel}</span>
                          {isSortedCol ? (
                            sortOrder === 'asc' ? (
                              <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            ) : (
                              <ArrowUpAZ className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-emerald-400/50 shrink-0" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {activeSectionTab === 'consulted' && (
                    <>
                      <th className="py-3.5 px-4">Maintain Medicine</th>
                      <th className="py-3.5 px-4">Disease</th>
                    </>
                  )}
                  <th className="py-3.5 px-4 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {paginatedRecords.map((rec, idx) => {
                  const rowNumber = (safeCurrentPage - 1) * itemsPerPage + idx + 1;
                  const cols =
                    Array.isArray(rec.columns) && rec.columns.length > 0
                      ? rec.columns
                      : [rec.rawText || rec.primaryText];

                  const openRecordModal = (openAddMaintForm: boolean = false) => {
                    setSelectedRecord(rec);
                    setIsEditingRecord(false);
                    setIsAddingMaintenance(openAddMaintForm);
                    setMaintainMedicineInput(rec.maintenanceMedicine || '');
                    setDiseaseInput(rec.disease || '');
                    setEditColumns(cols);
                    setEditPrimaryText(rec.primaryText);
                  };

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => openRecordModal(false)}
                      className="hover:bg-emerald-50/50 transition-colors cursor-pointer group"
                    >
                      {/* Sequential Number */}
                      <td className="py-3 px-4 text-center font-bold text-slate-400 tabular-nums">
                        {rowNumber}
                      </td>

                      {/* Dynamic PDF Data Columns */}
                      {dynamicColumnsMeta.headers.map((_, colIdx) => {
                        const cellVal = cols[colIdx] !== undefined ? cols[colIdx] : '';
                        const isPrimaryCol = colIdx === 0;
                        // If a row has more columns than displayColCount, append remaining columns in the last cell so zero data is hidden
                        const extraCols =
                          colIdx === dynamicColumnsMeta.count - 1 && cols.length > dynamicColumnsMeta.count
                            ? ' | ' + cols.slice(dynamicColumnsMeta.count).join(' | ')
                            : '';

                        return (
                          <td
                            key={colIdx}
                            className={`py-3 px-4 align-top ${
                              isPrimaryCol ? 'font-bold text-slate-900' : 'text-slate-700 font-medium'
                            }`}
                          >
                            <div className="break-words max-w-md">
                              {cellVal || <span className="text-slate-300">—</span>}
                              {extraCols && (
                                <span className="text-slate-600 font-normal">{extraCols}</span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Consulted Tab: Maintain Medicine & Disease Columns */}
                      {activeSectionTab === 'consulted' && (
                        <>
                          <td className="py-3 px-4 align-top">
                            {rec.maintenanceMedicine ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                                <Pill className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{rec.maintenanceMedicine}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            {rec.disease ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs">
                                <Stethoscope className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{rec.disease}</span>
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right align-top no-print"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openRecordModal(false)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
                            title="View Complete Entry Data"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRecordToDelete(rec)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Numbered Pages (Pagination Footer) */}
        {filteredAndSortedRecords.length > 0 && (
          <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
            <div className="text-xs text-slate-600 font-medium">
              Page <span className="font-bold text-slate-900">{safeCurrentPage}</span> of{' '}
              <span className="font-bold text-slate-900">{totalPages}</span> · Total{' '}
              <span className="font-bold text-slate-900">
                {filteredAndSortedRecords.length.toLocaleString()}
              </span>{' '}
              PDF entries
            </div>

            {/* Numbered Page Buttons */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              {visiblePageNumbers.map((item, idx) => {
                if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                  return (
                    <span key={`${item}-${idx}`} className="px-2 text-slate-400 font-bold text-xs">
                      ...
                    </span>
                  );
                }
                const isCurrent = item === safeCurrentPage;
                return (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`min-w-[38px] h-[38px] px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer tabular-nums ${
                      isCurrent
                        ? 'bg-gradient-to-r from-[#064e3b] to-[#047857] text-white shadow-sm border border-emerald-500/30'
                        : 'bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Go to Page Number Form */}
            <form onSubmit={handleJumpPage} className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Go to page:
              </label>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={e => setJumpPageInput(e.target.value)}
                placeholder={String(safeCurrentPage)}
                className="w-16 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Go
              </button>
            </form>
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL 1: ADD BULK ENTRY (Upload PDF Files & Extract All PDF Data)
      ===================================================================== */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-[#051f15] to-[#064e3b] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-emerald-400/30">
                    <FileUp className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                      Add Bulk Entry from PDF File(s)
                    </h3>
                    <p className="text-xs text-emerald-200/90">
                      Upload one or multiple PDF files — whatever data is inside the PDF files will be extracted and added to Maintenance.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                {/* Drag & Drop PDF File Uploader */}
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFilesSelected(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-emerald-600 bg-emerald-50/70'
                      : 'border-emerald-300/80 hover:border-emerald-600 bg-emerald-50/30 hover:bg-emerald-50/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,application/pdf,.xlsx,.xls,.csv,.txt"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesSelected(e.target.files);
                      }
                    }}
                  />
                  {isParsingPdf ? (
                    <div className="flex flex-col items-center justify-center gap-2.5 py-2">
                      <Loader2 className="w-10 h-10 text-emerald-700 animate-spin" />
                      <p className="text-sm font-extrabold text-emerald-950">
                        Extracting all data & pages from PDF file(s)...
                      </p>
                      <p className="text-xs text-slate-500">
                        Scanning rows, columns, and text across all PDF pages
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md mb-1">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-slate-900">
                        Click to Select PDF File(s) or Drag & Drop Here
                      </p>
                      <p className="text-xs text-slate-500 max-w-xl">
                        Supports single or multiple <span className="font-bold text-emerald-800">.PDF</span> files (as well as .XLSX, .CSV, .TXT). Every row and column inside your PDF file will be automatically extracted as bulk entries.
                      </p>
                    </div>
                  )}
                </div>

                {/* Staged PDF Files Summary Badges */}
                {stagedPdfFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        Loaded PDF Files ({stagedPdfFiles.length})
                      </span>
                      <button
                        onClick={() => {
                          setStagedPdfFiles([]);
                          setDraftEntries([]);
                        }}
                        className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Clear Staged Files
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {stagedPdfFiles.map(pf => (
                        <div
                          key={pf.fileName}
                          className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {pf.fileName}
                              </p>
                              <p className="text-[11px] text-emerald-800 font-semibold">
                                {pf.pagesCount} page(s) · {pf.entriesCount} entries extracted
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveStagedPdf(pf.fileName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                            title="Remove PDF file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Manual Text / Paste Bulk Entry Toggle */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowManualTextPanel(!showManualTextPanel)}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Optional: Paste or Type Additional Bulk Entries Manually</span>
                    </span>
                    <span className="text-emerald-700">
                      {showManualTextPanel ? 'Hide' : 'Expand'}
                    </span>
                  </button>
                  {showManualTextPanel && (
                    <div className="p-4 space-y-3 bg-white border-t border-slate-200">
                      <textarea
                        rows={4}
                        value={manualBulkText}
                        onChange={e => setManualBulkText(e.target.value)}
                        placeholder="Paste lines from a PDF or document here (one entry per line)..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddManualLinesToDraft}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                        >
                          + Add Pasted Lines to Preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Extracted PDF Data Preview Table */}
                {sortedDraftEntries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                          Extracted PDF Data Preview ({sortedDraftEntries.length.toLocaleString()} Entries — Sorted Alphabetically A–Z)
                        </h4>
                      </div>

                      {/* Preview Pagination */}
                      {totalPreviewPages > 1 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                            disabled={safePreviewPage <= 1}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold disabled:opacity-40 cursor-pointer"
                          >
                            Prev
                          </button>
                          <span className="font-bold text-slate-700 px-2">
                            Page {safePreviewPage} of {totalPreviewPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                            disabled={safePreviewPage >= totalPreviewPages}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold disabled:opacity-40 cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3 w-12 text-center">#</th>
                            <th className="py-2.5 px-3">Primary Name / Text (A–Z)</th>
                            <th className="py-2.5 px-3">All Extracted PDF Data Columns</th>
                            <th className="py-2.5 px-3 w-36">PDF & Page</th>
                            <th className="py-2.5 px-3 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedDraftEntries.map((item, idx) => {
                            const num = (safePreviewPage - 1) * PREVIEW_PER_PAGE + idx + 1;
                            return (
                              <tr key={item.tempId} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center font-bold text-slate-400">
                                  {num}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {item.primaryText}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.columns.map((col, cIdx) => (
                                      <span
                                        key={cIdx}
                                        className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px] font-medium text-slate-800"
                                      >
                                        {item.columnHeaders?.[cIdx] ? (
                                          <strong className="text-slate-500 mr-1">
                                            {item.columnHeaders[cIdx]}:
                                          </strong>
                                        ) : null}
                                        {col}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-slate-500 font-semibold">
                                  {item.pdfFileName} (p.{item.pdfPageNumber})
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftEntries(prev =>
                                        prev.filter(d => d.tempId !== item.tempId)
                                      )
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="Remove row"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-500 font-medium">
                  {draftEntries.length > 0 ? (
                    <span>
                      Ready to add{' '}
                      <strong className="text-emerald-800">{draftEntries.length.toLocaleString()}</strong>{' '}
                      entries from{' '}
                      <strong className="text-slate-800">{stagedPdfFiles.length}</strong> PDF file(s).
                    </span>
                  ) : (
                    <span>Select one or more PDF files above to extract all data.</span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBulkEntries}
                    disabled={isSavingBulk || (draftEntries.length === 0 && !manualBulkText.trim())}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#064e3b] to-[#047857] hover:from-[#047857] hover:to-[#059669] text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingBulk ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Bulk Entries...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Add Bulk Entry ({draftEntries.length.toLocaleString()} Entries)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODAL 2: VIEW / EDIT COMPLETE PDF ENTRY DATA
      ===================================================================== */}
      <AnimatePresence>
        {selectedRecord && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-[#051f15] to-[#064e3b] text-white flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-extrabold truncate">
                      {selectedRecord.primaryText}
                    </h3>
                    <p className="text-[11px] text-emerald-200 truncate">
                      {selectedRecord.pdfFileName} · Page {selectedRecord.pdfPageNumber || 1}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {!isEditingRecord ? (
                  <>
                    {/* Top Action Bar inside View Modal with "Add Maintenance" Button */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                          <Pill className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-emerald-950">
                            {isRecordConsulted(selectedRecord)
                              ? 'Consulted Maintenance Record'
                              : 'Add Maintenance Details'}
                          </p>
                          <p className="text-[11px] text-emerald-800/80">
                            {isRecordConsulted(selectedRecord)
                              ? 'This entry has Maintain Medicine / Disease and is in the Consulted section.'
                              : 'Click "Add Maintenance" to enter Maintain Medicine & Disease and transfer to Consulted.'}
                          </p>
                        </div>
                      </div>

                      {!isAddingMaintenance && (
                        <button
                          type="button"
                          onClick={() => {
                            setMaintainMedicineInput(selectedRecord.maintenanceMedicine || '');
                            setDiseaseInput(selectedRecord.disease || '');
                            setIsAddingMaintenance(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#064e3b] to-[#047857] hover:from-[#047857] hover:to-[#059669] text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                          <span>Add Maintenance</span>
                        </button>
                      )}
                    </div>

                    {/* "Add Maintenance" Form (Maintain Medicine text box, Disease text box) */}
                    {isAddingMaintenance && (
                      <form
                        onSubmit={handleSaveAddMaintenance}
                        className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-emerald-600/80 shadow-md space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-emerald-700" />
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                              Add Maintenance Form
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAddingMaintenance(false)}
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                              Maintain Medicine
                            </label>
                            <input
                              type="text"
                              value={maintainMedicineInput}
                              onChange={e => setMaintainMedicineInput(e.target.value)}
                              placeholder="Enter Maintain Medicine (e.g. Amlodipine 5mg, Losartan)..."
                              autoFocus
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                              Disease
                            </label>
                            <input
                              type="text"
                              value={diseaseInput}
                              onChange={e => setDiseaseInput(e.target.value)}
                              placeholder="Enter Disease (e.g. Hypertension, Diabetes)..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingMaintenance(false)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingMaintenanceForm}
                            className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-[#064e3b] to-[#047857] hover:from-[#047857] hover:to-[#059669] text-white rounded-xl text-xs font-extrabold shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {savingMaintenanceForm ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Save & Transfer to Consulted</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Display current Maintain Medicine & Disease if already set */}
                    {(selectedRecord.maintenanceMedicine || selectedRecord.disease) && !isAddingMaintenance && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block mb-1">
                            Maintain Medicine
                          </span>
                          <span className="text-xs sm:text-sm font-extrabold text-emerald-950 break-words">
                            {selectedRecord.maintenanceMedicine || '—'}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block mb-1">
                            Disease
                          </span>
                          <span className="text-xs sm:text-sm font-extrabold text-amber-950 break-words">
                            {selectedRecord.disease || '—'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        All Extracted Data Columns from PDF
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(selectedRecord.columns || [selectedRecord.rawText]).map((colVal, i) => {
                          const label =
                            selectedRecord.columnHeaders?.[i] || `PDF Data Column ${i + 1}`;
                          return (
                            <div
                              key={i}
                              className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
                                {label}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                                {colVal || '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-1.5">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                        Complete Raw PDF Entry Line
                      </span>
                      <p className="text-xs sm:text-sm font-mono text-slate-800 break-words bg-white p-3 rounded-lg border border-slate-200">
                        {selectedRecord.rawText}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Source PDF File
                        </span>
                        <span className="font-bold text-slate-800 truncate block mt-0.5">
                          {selectedRecord.pdfFileName}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          PDF Page Number
                        </span>
                        <span className="font-bold text-slate-800 block mt-0.5">
                          Page {selectedRecord.pdfPageNumber || 1}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Uploaded By
                        </span>
                        <span className="font-bold text-slate-800 block mt-0.5">
                          {selectedRecord.uploadedBy || currentUser?.username || 'Admin'}
                        </span>
                      </div>
                    </div>

                    {selectedRecord.pdfFileUrl && (
                      <div className="pt-1">
                        <a
                          href={selectedRecord.pdfFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open Original Uploaded PDF File</span>
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase block mb-1">
                        Primary Name / Sort Key (A–Z)
                      </label>
                      <input
                        type="text"
                        value={editPrimaryText}
                        onChange={e => setEditPrimaryText(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold text-slate-700 uppercase block">
                        PDF Data Columns
                      </label>
                      {editColumns.map((colVal, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 w-28 shrink-0">
                            {selectedRecord.columnHeaders?.[idx] || `Column ${idx + 1}`}:
                          </span>
                          <input
                            type="text"
                            value={colVal}
                            onChange={e => {
                              const next = [...editColumns];
                              next[idx] = e.target.value;
                              setEditColumns(next);
                            }}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditColumns(prev => [...prev, ''])}
                        className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        + Add Another Data Column
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setRecordToDelete(selectedRecord);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  {!isEditingRecord ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMaintainMedicineInput(selectedRecord.maintenanceMedicine || '');
                          setDiseaseInput(selectedRecord.disease || '');
                          setIsAddingMaintenance(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add Maintenance</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingRecord(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Data</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(null)}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditingRecord(false)}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRecordEdit}
                        disabled={savingRecordEdit}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {savingRecordEdit ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save Changes</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODAL 3: DELETE SINGLE RECORD CONFIRMATION
      ===================================================================== */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4"
            >
              <h3 className="text-base font-extrabold text-slate-900">
                Delete Maintenance Entry?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900">"{recordToDelete.primaryText}"</strong> from the
                Maintenance directory?
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setRecordToDelete(null)}
                  disabled={deletingRecord}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteRecord}
                  disabled={deletingRecord}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {deletingRecord && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODAL 4: CLEAR ALL CONFIRMATION
      ===================================================================== */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4"
            >
              <h3 className="text-base font-extrabold text-slate-900">
                {selectedPdfFilter !== 'ALL'
                  ? `Clear Entries from "${selectedPdfFilter}"?`
                  : 'Clear All Maintenance Entries?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                This action will permanently remove{' '}
                {selectedPdfFilter !== 'ALL'
                  ? `all entries extracted from "${selectedPdfFilter}"`
                  : `all ${records.length.toLocaleString()} entries on the Maintenance page`}
                .
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearingAll}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmClearAll}
                  disabled={clearingAll}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {clearingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Clear</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
