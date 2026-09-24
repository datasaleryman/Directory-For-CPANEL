import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  ArrowLeft, 
  Plus, 
  Loader2, 
  Building2, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  FolderCheck, 
  X, 
  Search, 
  Eye, 
  ExternalLink, 
  ZoomIn, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Database,
  Folder,
  FolderOpen,
  FolderTree,
  BookOpen,
  ScrollText,
  FileSpreadsheet,
  Users,
  Lock,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  ArrowUpRight,
  Coins,
  Banknote,
  Receipt,
  Printer,
  Wallet,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StagedFile {
  fileName: string;
  fileData: string;
  size: number;
  fileType: string;
  previewUrl?: string;
}

interface UploadedFileItem {
  name: string;
  url: string;
  uploadedAt?: string;
  uploadedBy?: string;
  size?: number;
}

interface UploadedPcuRecord {
  id: string;
  fullName: string;
  barangay: string;
  purok: string;
  contactNumber?: string;
  fileName?: string;
  fileUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
  status?: string;
  filesCount: number;
  uploadedFiles: UploadedFileItem[];
}

interface DeleteTarget {
  record: UploadedPcuRecord;
  file?: UploadedFileItem;
  fileIndex?: number;
  isSingleFile: boolean;
}

interface SubmitPcuProps {
  authToken: string;
  currentUser?: {
    username: string;
    role: string;
    barangay?: string;
  } | null;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  onNavigateToDirectory?: () => void;
}

export const SubmitPcu: React.FC<SubmitPcuProps> = ({
  authToken,
  currentUser,
  showToast
}) => {
  // Mode state: false = Grid display of uploaded data; true = Upload PCU Form
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [barangay, setBarangay] = useState(currentUser?.barangay || '');
  const [purok, setPurok] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Database Barangays list from server
  const [barangaysList, setBarangaysList] = useState<string[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Uploaded records list
  const [uploadedRecords, setUploadedRecords] = useState<UploadedPcuRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Search & Filter state for Grid
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('ALL');

  // Detail Modal state (Whole data uploaded view)
  const [selectedRecord, setSelectedRecord] = useState<UploadedPcuRecord | null>(null);

  // Full-screen Image Lightbox state
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  // Permanent Delete Confirmation Popup Card state (centered on screen)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Verification Confirmation Popup Card state (centered on screen)
  const [verifyTarget, setVerifyTarget] = useState<UploadedPcuRecord | null>(null);

  // Check if current user is Master Admin (only Master Admin can delete PCU files and view Ledger)
  const isMasterAdmin = React.useMemo(() => {
    if (!currentUser) return false;
    const username = (currentUser.username || '').toLowerCase().trim();
    const role = (currentUser.role || '').toUpperCase().trim();
    return role === 'MASTER ADMIN' || role === 'MASTER_ADMIN' || role === 'MASTERADMIN' || username === 'admin';
  }, [currentUser]);

  // Tab state: 'pending' (Pending PCU Uploads) | 'verified' (Verified PCU Uploads) | 'ledger' (Master Admin Ledger)
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'ledger'>('pending');

  // Currently opened Barangay folder: null = showing all folder cards; string = inside that folder
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Folder sub-view mode: 'folders' (browse by folder) | 'all' (flattened grid of all records)
  const [folderViewMode, setFolderViewMode] = useState<'folders' | 'all'>('folders');

  // Folder search filter
  const [folderSearch, setFolderSearch] = useState('');

  // Pagination states: 6 rows x 5 columns = 30 items per page
  const [folderPage, setFolderPage] = useState<number>(1);
  const [allGridPage, setAllGridPage] = useState<number>(1);
  const [inFolderPage, setInFolderPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 30; // 6 rows x 5 columns = 30 items per page

  // Verification in progress tracking
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Reset pagination and folder when active tab changes
  useEffect(() => {
    setSelectedFolder(null);
    setFolderPage(1);
    setAllGridPage(1);
    setInFolderPage(1);
  }, [activeTab]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setFolderPage(1);
  }, [folderSearch]);

  useEffect(() => {
    setAllGridPage(1);
  }, [searchQuery, filterBarangay]);

  useEffect(() => {
    setInFolderPage(1);
  }, [selectedFolder, searchQuery]);

  // Ledger Base Rate & Settlements State (Master Admin Only)
  const [baseRate, setBaseRate] = useState<number>(50);
  const [baseRateInput, setBaseRateInput] = useState<string>('50');
  const [savingBaseRate, setSavingBaseRate] = useState<boolean>(false);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState<boolean>(false);
  const [settlingSubmitter, setSettlingSubmitter] = useState<{
    name: string;
    submissionsCount: number;
    totalSalary: number;
  } | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [settlementMethod, setSettlementMethod] = useState<string>('Cash');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [submittingSettlement, setSubmittingSettlement] = useState<boolean>(false);

  // Security guard: If a non-master admin somehow has activeTab === 'ledger', force back to 'pending'
  useEffect(() => {
    if (!isMasterAdmin && activeTab === 'ledger') {
      setActiveTab('pending');
    }
  }, [isMasterAdmin, activeTab]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch verified Barangays from database
  const fetchBarangays = async () => {
    setLoadingBarangays(true);
    try {
      const res = await fetch('/api/public/barangays', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (!res.ok) throw new Error('Failed to load database barangays');
      const data = await res.json();
      if (Array.isArray(data.barangays) && data.barangays.length > 0) {
        setBarangaysList(data.barangays);
        if (!barangay && !currentUser?.barangay) {
          setBarangay(data.barangays[0]);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching barangays:', err.message);
    } finally {
      setLoadingBarangays(false);
    }
  };

  // Fetch Uploaded PCU records from server
  const fetchUploadedRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch('/api/contacts/recent-uploads?limit=5000', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        const contactsList = Array.isArray(data.contacts) ? data.contacts : [];
        
        const formatted: UploadedPcuRecord[] = contactsList.map((item: any, idx: number) => {
          let files: UploadedFileItem[] = [];
          if (Array.isArray(item.uploadedFiles) && item.uploadedFiles.length > 0) {
            files = item.uploadedFiles.map((f: any) => ({
              name: f.name || f.fileName || 'PCU Attachment',
              url: f.url || f.fileData || '',
              uploadedAt: f.uploadedAt || item.pcu_uploaded_at || item.created_at || new Date().toISOString(),
              uploadedBy: f.uploadedBy || item.pcu_uploaded_by || 'Staff'
            }));
          } else if (item.pcu_file_url) {
            files = [{
              name: 'PCU Document',
              url: item.pcu_file_url,
              uploadedAt: item.pcu_uploaded_at || item.created_at || new Date().toISOString(),
              uploadedBy: item.pcu_uploaded_by || 'Staff'
            }];
          }

          const uniqueId = String(item.id || item.contactId || `pcu_rec_${idx}_${Date.now()}`);

          return {
            id: uniqueId,
            fullName: item.full_name || item.fullName || 'Patient',
            barangay: item.barangay || 'Central',
            purok: item.purok || '',
            contactNumber: item.contact_number || item.contact || '',
            fileName: files[0]?.name || 'PCU Document',
            fileUrl: files[0]?.url || item.pcu_file_url || '',
            uploadedAt: item.pcu_uploaded_at || item.updated_at || item.created_at || new Date().toISOString(),
            uploadedBy: item.pcu_uploaded_by || 'Staff',
            status: (item.status || '').toUpperCase() === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
            filesCount: files.length,
            uploadedFiles: files
          };
        });

        setUploadedRecords(formatted);
      } else {
        const fallbackRes = await fetch('/api/contacts/pcu-updates', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const rawList = Array.isArray(fallbackData) ? fallbackData : (fallbackData.updates || []);
          const formatted: UploadedPcuRecord[] = rawList.map((item: any, idx: number) => {
            const fileItem: UploadedFileItem = {
              name: item.fileName || 'PCU Document',
              url: item.fileData || '',
              uploadedAt: item.uploadedAt || new Date().toISOString(),
              uploadedBy: item.uploadedBy || 'Staff'
            };
            return {
              id: String(item.id || item.contactId || `pcu_upd_${idx}_${Date.now()}`),
              fullName: item.fullName || 'Patient',
              barangay: item.barangay || 'Central',
              purok: item.purok || '',
              contactNumber: item.contact || item.contact_number || '',
              fileName: item.fileName || 'PCU Document',
              fileUrl: item.fileData || '',
              uploadedAt: item.uploadedAt || new Date().toISOString(),
              uploadedBy: item.uploadedBy || 'Staff',
              status: (item.status || '').toUpperCase() === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
              filesCount: 1,
              uploadedFiles: [fileItem]
            };
          });
          setUploadedRecords(formatted);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching uploaded records:', err.message);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Fetch PCU Base Rate from MySQL
  const fetchBaseRate = async () => {
    try {
      const res = await fetch('/api/pcu/base-rate', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.baseRate === 'number') {
          setBaseRate(data.baseRate);
          setBaseRateInput(String(data.baseRate));
        }
      }
    } catch (err: any) {
      console.warn('Error fetching base rate:', err.message);
    }
  };

  // Fetch PCU Settlements from MySQL
  const fetchSettlements = async () => {
    setLoadingSettlements(true);
    try {
      const res = await fetch('/api/pcu/settlements', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.settlements)) {
          setSettlements(data.settlements);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching settlements:', err.message);
    } finally {
      setLoadingSettlements(false);
    }
  };

  // Save Base Rate permanently to MySQL
  const handleSaveBaseRate = async (rateToSave?: number) => {
    const val = rateToSave !== undefined ? rateToSave : parseFloat(baseRateInput);
    if (isNaN(val) || val < 0) {
      showToast('Please enter a valid base rate (0 or greater).', 'error');
      return;
    }
    setSavingBaseRate(true);
    try {
      const res = await fetch('/api/pcu/base-rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ baseRate: val })
      });
      if (res.ok) {
        const data = await res.json();
        setBaseRate(data.baseRate);
        setBaseRateInput(String(data.baseRate));
        showToast(`Base rate ₱${data.baseRate.toFixed(2)} saved permanently to MySQL!`, 'success');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update base rate.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating base rate.', 'error');
    } finally {
      setSavingBaseRate(false);
    }
  };

  // Open Settlement Modal for a Submitter
  const openSettlementModal = (sub: { name: string; submissionsCount: number }) => {
    const existing = settlements.find(s => s.submitter && s.submitter.toLowerCase() === sub.name.toLowerCase());
    const computedSalary = sub.submissionsCount * baseRate;
    setSettlingSubmitter({
      name: sub.name,
      totalSubmissions: sub.submissionsCount,
      totalSalary: computedSalary
    });
    setSettlementAmount(existing ? String(existing.amountPaid ?? existing.totalSalary) : String(computedSalary));
    setSettlementMethod(existing ? (existing.paymentMethod || 'Cash') : 'Cash');
    setSettlementNotes(existing ? (existing.referenceNotes || '') : '');
  };

  // Confirm Settlement and Save to MySQL
  const handleConfirmSettlement = async () => {
    if (!settlingSubmitter) return;
    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount < 0) {
      showToast('Please enter a valid payout amount.', 'error');
      return;
    }
    setSubmittingSettlement(true);
    try {
      const existing = settlements.find(s => s.submitter && s.submitter.toLowerCase() === settlingSubmitter.name.toLowerCase());
      const res = await fetch('/api/pcu/settlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          id: existing?.id,
          submitter: settlingSubmitter.name,
          totalSubmissions: settlingSubmitter.totalSubmissions,
          baseRate: baseRate,
          totalSalary: settlingSubmitter.totalSalary,
          amountPaid: amount,
          paymentStatus: 'SETTLED',
          paymentMethod: settlementMethod,
          referenceNotes: settlementNotes
        })
      });
      if (res.ok) {
        await fetchSettlements();
        showToast(`Settlement for "${settlingSubmitter.name}" saved permanently to MySQL!`, 'success');
        setSettlingSubmitter(null);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save settlement.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving settlement.', 'error');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  // Reset / Delete Settlement
  const handleResetSettlement = async (submitterName: string) => {
    const existing = settlements.find(s => s.submitter && s.submitter.toLowerCase() === submitterName.toLowerCase());
    if (!existing) return;
    if (!confirm(`Are you sure you want to reset settlement for "${submitterName}"? Status will revert to Pending.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/pcu/settlements/${existing.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        await fetchSettlements();
        showToast(`Settlement for "${submitterName}" has been reset.`, 'info');
        setSettlingSubmitter(null);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to reset settlement.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error resetting settlement.', 'error');
    }
  };

  // Print Official Settlement Voucher
  const handlePrintVoucher = (subName: string, submissionsCount: number, salary: number, amount: number, method: string, notes: string, settledAt?: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=750');
    if (!printWindow) {
      showToast('Please allow popups to print the settlement voucher.', 'warning');
      return;
    }
    const dateFormatted = settledAt
      ? new Date(settledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const voucherHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>PCU Settlement Voucher - ${subName}</title>
        <style>
          @page { margin: 15mm; size: auto; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; margin: 0; background: #fff; }
          .voucher-container { border: 2px solid #0f172a; padding: 32px; border-radius: 12px; max-width: 680px; margin: 0 auto; box-sizing: border-box; }
          .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 18px; margin-bottom: 24px; }
          .clinic-name { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; color: #047857; margin-bottom: 4px; }
          .doc-title { font-size: 15px; font-weight: 800; letter-spacing: 1px; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
          .meta-info { font-size: 12px; color: #64748b; font-weight: 500; }
          .table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
          .table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
          .table td.label { font-weight: 600; color: #334155; width: 45%; }
          .table td.value { font-weight: 700; color: #0f172a; text-align: right; }
          .highlight-row td { background-color: #ecfdf5; font-size: 15px; color: #065f46; font-weight: 900; border-top: 1px solid #a7f3d0; border-bottom: 1px solid #a7f3d0; }
          .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; color: #475569; margin-bottom: 28px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; }
          .sig-block { text-align: center; width: 42%; }
          .sig-line { border-bottom: 1px solid #0f172a; margin-top: 48px; margin-bottom: 6px; }
          .sig-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; }
          .sig-name { font-size: 13px; font-weight: 800; color: #0f172a; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="voucher-container">
          <div class="header">
            <div class="clinic-name">SAINT FRANCIS CLINIC</div>
            <div class="doc-title">PCU SUBMISSION SALARY SETTLEMENT VOUCHER</div>
            <div class="meta-info">Date Issued: ${dateFormatted} &bull; Official Payroll Record</div>
          </div>

          <table class="table">
            <tr>
              <td class="label">Submitter / Recipient</td>
              <td class="value">${subName}</td>
            </tr>
            <tr>
              <td class="label">Total Verified Submissions</td>
              <td class="value">${submissionsCount} submissions</td>
            </tr>
            <tr>
              <td class="label">Approved Base Rate</td>
              <td class="value">₱${baseRate.toFixed(2)} / submission</td>
            </tr>
            <tr>
              <td class="label">Computed Total Salary</td>
              <td class="value">₱${salary.toFixed(2)}</td>
            </tr>
            <tr class="highlight-row">
              <td class="label">Amount Settled & Disbursed</td>
              <td class="value">₱${amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="label">Disbursement Method</td>
              <td class="value">${method.toUpperCase()}</td>
            </tr>
            <tr>
              <td class="label">Settlement Status</td>
              <td class="value" style="color: #047857; font-weight: 800;">PAID & SETTLED</td>
            </tr>
          </table>

          ${notes ? `<div class="notes-box"><strong>Remarks / Memo:</strong> ${notes}</div>` : ''}

          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-name">${currentUser?.fullName || currentUser?.username || 'Master Admin'}</div>
              <div class="sig-title">Disbursing Officer / Master Admin</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-name">${subName}</div>
              <div class="sig-title">Received By (Submitter)</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(voucherHtml);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchBarangays();
    fetchUploadedRecords();
    fetchBaseRate();
    fetchSettlements();
  }, [authToken]);

  // Multiple File Selection Handler
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files) as File[];
    if (filesArray.length === 0) return;

    const validFiles: File[] = [];
    for (const f of filesArray) {
      if (f.size > 25 * 1024 * 1024) {
        showToast(`File "${f.name}" exceeds 25MB limit.`, 'error');
        continue;
      }
      validFiles.push(f);
    }

    try {
      const loaded = await Promise.all(
        validFiles.map(file => {
          return new Promise<StagedFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve({
                  fileName: file.name,
                  fileData: reader.result,
                  size: file.size,
                  fileType: file.type || 'application/octet-stream',
                  previewUrl: file.type.startsWith('image/') ? reader.result : undefined
                });
              } else {
                reject(new Error(`Failed to read file "${file.name}"`));
              }
            };
            reader.onerror = () => reject(reader.error || new Error(`Error reading file "${file.name}"`));
            reader.readAsDataURL(file);
          });
        })
      );

      setStagedFiles(prev => [...prev, ...loaded]);
      showToast(`${loaded.length} image(s) selected and ready for PCU upload.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error loading files', 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCapitalize = (str: string) => {
    return str
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = fullName.trim();
    const cleanBarangay = barangay.trim();
    const cleanPurok = purok.trim();
    const cleanNumber = contactNumber.trim();

    if (!cleanName) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!cleanBarangay) {
      showToast('Barangay selection is required.', 'warning');
      return;
    }
    if (stagedFiles.length === 0) {
      showToast('Please upload at least one PCU image or document.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const formattedName = handleCapitalize(cleanName);
      const formattedPurok = cleanPurok ? handleCapitalize(cleanPurok) : '';

      const payload = {
        fullName: formattedName,
        barangay: cleanBarangay,
        purok: formattedPurok,
        contact_number: cleanNumber,
        files: stagedFiles.map(f => ({
          fileName: f.fileName,
          fileData: f.fileData,
          fileType: f.fileType,
          size: f.size
        }))
      };

      const res = await fetch('/api/pcu/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit PCU documentation.');
      }

      showToast(`PCU documentation for "${formattedName}" submitted successfully!`, 'success');
      setSubmitSuccess(`PCU record and ${stagedFiles.length} file(s) for "${formattedName}" have been submitted and saved in cPanel MySQL.`);
      
      // Reset form fields
      setFullName('');
      setPurok('');
      setContactNumber('');
      setStagedFiles([]);

      // Return to Grid view to see uploaded record
      setIsFormOpen(false);

      // Refresh uploaded records list
      fetchUploadedRecords();
    } catch (err: any) {
      showToast(err.message || 'Error submitting PCU documentation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Prompt Deletion of an Entire PCU Record (Master Admin only)
  const promptDeleteRecord = (e: React.MouseEvent, record: UploadedPcuRecord) => {
    e.stopPropagation();
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can delete PCU submissions.', 'error');
      return;
    }
    setDeleteTarget({
      record,
      isSingleFile: false
    });
  };

  // Prompt Deletion of a Specific Single File (Master Admin only)
  const promptDeleteFile = (e: React.MouseEvent, record: UploadedPcuRecord, file: UploadedFileItem, fileIndex: number) => {
    e.stopPropagation();
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can delete PCU files.', 'error');
      return;
    }
    setDeleteTarget({
      record,
      file,
      fileIndex,
      isSingleFile: true
    });
  };

  // Execute Permanent Delete (Sends request to MySQL backend - Master Admin only)
  const executePermanentDelete = async () => {
    if (!deleteTarget) return;
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can delete PCU records.', 'error');
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      const { record, file, fileIndex, isSingleFile } = deleteTarget;

      const payload = {
        id: record.id,
        fullName: record.fullName,
        fileName: isSingleFile && file ? file.name : undefined,
        fileUrl: isSingleFile && file ? file.url : undefined,
        deleteAll: !isSingleFile || (record.uploadedFiles.length <= 1)
      };

      const res = await fetch('/api/pcu/submissions/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to permanently delete from MySQL database.');
      }

      showToast(data.message || 'Permanently deleted from cPanel MySQL.', 'success');

      // Update detail modal state if currently open
      if (isSingleFile && record.uploadedFiles.length > 1 && fileIndex !== undefined) {
        if (selectedRecord && selectedRecord.id === record.id) {
          const updatedFiles = selectedRecord.uploadedFiles.filter((_, idx) => idx !== fileIndex);
          setSelectedRecord({
            ...selectedRecord,
            uploadedFiles: updatedFiles,
            filesCount: updatedFiles.length,
            fileUrl: updatedFiles[0]?.url || '',
            fileName: updatedFiles[0]?.name || ''
          });
        }
      } else {
        // Entire record deleted
        if (selectedRecord && selectedRecord.id === record.id) {
          setSelectedRecord(null);
        }
      }

      setDeleteTarget(null);
      fetchUploadedRecords();
    } catch (err: any) {
      showToast(err.message || 'Error deleting record from MySQL.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const isImageFile = (url?: string, name?: string) => {
    if (!url && !name) return false;
    const str = ((url || '') + ' ' + (name || '')).toLowerCase();
    return str.includes('.jpg') || str.includes('.jpeg') || str.includes('.png') || str.includes('.webp') || str.includes('data:image/');
  };

  // =========================================================================
  // BARANGAY NAME NORMALIZATION & CANONICAL MATCHING
  // =========================================================================
  const normalizeBarangayNameKey = (name?: string | null): string => {
    if (!name) return 'unassigned';
    const clean = name
      .trim()
      .toLowerCase()
      .replace(/^(barangay|brgy\.?)\s+/i, '')
      .trim();
    return clean || 'unassigned';
  };

  const getCanonicalBarangayName = (bgName: string, list: string[]): string => {
    if (!bgName || !bgName.trim()) return 'General / Unassigned';
    const key = normalizeBarangayNameKey(bgName);
    const found = list.find(b => normalizeBarangayNameKey(b) === key);
    if (found) return found;
    return bgName
      .trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  // =========================================================================
  // VERIFICATION WORKFLOW: MOVE BETWEEN PENDING AND VERIFIED (Master Admin Only)
  // =========================================================================
  const handleVerifyRecord = async (record: UploadedPcuRecord) => {
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can verify PCU submissions.', 'error');
      return;
    }
    setVerifyingId(record.id);
    try {
      const res = await fetch('/api/pcu/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          id: record.id,
          fullName: record.fullName,
          status: 'VERIFIED'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify PCU submission.');
      }

      // Update state locally so record instantly transfers to Verified section
      setUploadedRecords(prev => prev.map(item => {
        const isMatch = (item.id && record.id && item.id === record.id) ||
          (item.fullName && record.fullName && item.fullName.toLowerCase().trim() === record.fullName.toLowerCase().trim());
        if (isMatch) {
          return { ...item, status: 'VERIFIED' };
        }
        return item;
      }));

      if (selectedRecord && (selectedRecord.id === record.id || selectedRecord.fullName.toLowerCase().trim() === record.fullName.toLowerCase().trim())) {
        setSelectedRecord(prev => prev ? { ...prev, status: 'VERIFIED' } : null);
      }

      showToast(`PCU submission for "${record.fullName}" has been verified! Moved to Verified section and 1 credit added to submitter.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error verifying PCU submission', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const executeConfirmVerification = async () => {
    if (!verifyTarget) return;
    const target = verifyTarget;
    await handleVerifyRecord(target);
    setVerifyTarget(null);
  };

  const handleUnverifyRecord = async (record: UploadedPcuRecord) => {
    if (!isMasterAdmin) {
      showToast('Access Denied: Only Master Admin can modify verification status.', 'error');
      return;
    }
    setVerifyingId(record.id);
    try {
      const res = await fetch('/api/pcu/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          id: record.id,
          fullName: record.fullName,
          status: 'PENDING'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update PCU status.');
      }

      // Update state locally so record transfers back to Pending section
      setUploadedRecords(prev => prev.map(item => {
        const isMatch = (item.id && record.id && item.id === record.id) ||
          (item.fullName && record.fullName && item.fullName.toLowerCase().trim() === record.fullName.toLowerCase().trim());
        if (isMatch) {
          return { ...item, status: 'PENDING' };
        }
        return item;
      }));

      if (selectedRecord && (selectedRecord.id === record.id || selectedRecord.fullName.toLowerCase().trim() === record.fullName.toLowerCase().trim())) {
        setSelectedRecord(prev => prev ? { ...prev, status: 'PENDING' } : null);
      }

      showToast(`PCU submission for "${record.fullName}" has been moved back to Pending.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Error moving PCU back to pending', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  // Separate uploaded records into Pending and Verified groups
  const pendingRecords = React.useMemo(() => {
    return uploadedRecords.filter(r => (r.status || '').toUpperCase() !== 'VERIFIED');
  }, [uploadedRecords]);

  const verifiedRecords = React.useMemo(() => {
    return uploadedRecords.filter(r => (r.status || '').toUpperCase() === 'VERIFIED');
  }, [uploadedRecords]);

  // Current tab records: 'verified' uses verifiedRecords, otherwise pendingRecords
  const currentTabRecords = activeTab === 'verified' ? verifiedRecords : pendingRecords;

  // =========================================================================
  // BARANGAY FOLDERS COMPUTATION (ACCURATELY DISPLAYED BASE ON BARANGAY)
  // =========================================================================
  const barangayFolders = React.useMemo(() => {
    const map = new Map<string, {
      name: string;
      normalizedKey: string;
      records: UploadedPcuRecord[];
      totalSubmissions: number;
      totalFiles: number;
      latestUploadedAt: string | null;
      submitters: Set<string>;
    }>();

    // 1. Seed from database verified barangays
    barangaysList.forEach((bg) => {
      const trimmed = bg.trim();
      if (!trimmed) return;
      const key = normalizeBarangayNameKey(trimmed);
      if (!map.has(key)) {
        map.set(key, {
          name: trimmed,
          normalizedKey: key,
          records: [],
          totalSubmissions: 0,
          totalFiles: 0,
          latestUploadedAt: null,
          submitters: new Set<string>()
        });
      }
    });

    // 2. Distribute records for the current active tab into their respective Barangay folders
    currentTabRecords.forEach((rec) => {
      const bgName = (rec.barangay || 'General / Unassigned').trim();
      const key = normalizeBarangayNameKey(bgName);
      if (!map.has(key)) {
        const canonical = getCanonicalBarangayName(bgName, barangaysList);
        map.set(key, {
          name: canonical,
          normalizedKey: key,
          records: [],
          totalSubmissions: 0,
          totalFiles: 0,
          latestUploadedAt: null,
          submitters: new Set<string>()
        });
      }

      const folder = map.get(key)!;
      folder.records.push(rec);
      folder.totalSubmissions += 1;
      const count = rec.filesCount || (rec.uploadedFiles ? rec.uploadedFiles.length : 1);
      folder.totalFiles += count;
      if (rec.uploadedBy) folder.submitters.add(rec.uploadedBy);
      if (!folder.latestUploadedAt || new Date(rec.uploadedAt).getTime() > new Date(folder.latestUploadedAt).getTime()) {
        folder.latestUploadedAt = rec.uploadedAt;
      }
    });

    // Sort: folders with submissions first, then alphabetically
    return Array.from(map.values()).sort((a, b) => {
      if (b.totalSubmissions !== a.totalSubmissions) {
        return b.totalSubmissions - a.totalSubmissions;
      }
      return a.name.localeCompare(b.name);
    });
  }, [barangaysList, currentTabRecords]);

  // Filtered Barangay Folders list based on folder search
  const filteredBarangayFolders = React.useMemo(() => {
    if (!folderSearch.trim()) return barangayFolders;
    const q = folderSearch.toLowerCase().trim();
    return barangayFolders.filter((f) => 
      f.name.toLowerCase().includes(q) ||
      f.records.some(r => r.fullName.toLowerCase().includes(q) || r.purok.toLowerCase().includes(q))
    );
  }, [barangayFolders, folderSearch]);

  // =========================================================================
  // LEDGER: ALL NAMES WHO SUBMITTED PCU FILES WITH THEIR COUNT OF SUBMISSION
  // RULE: Only verified submissions count as 1 credit in the Ledger.
  // If the submission is not verified, it is NOT counted towards the ledger.
  // =========================================================================
  const submittersLedger = React.useMemo(() => {
    const map = new Map<string, {
      name: string;
      submissionsCount: number; // ONLY VERIFIED COUNT = CREDITS
      pendingCount: number;     // UNVERIFIED
      totalUploaded: number;
      filesCount: number;
      barangays: Set<string>;
      latestSubmission: string | null;
      records: UploadedPcuRecord[];
    }>();

    uploadedRecords.forEach((rec) => {
      const submitter = (rec.uploadedBy || 'Staff').trim();
      const key = submitter.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: submitter,
          submissionsCount: 0,
          pendingCount: 0,
          totalUploaded: 0,
          filesCount: 0,
          barangays: new Set<string>(),
          latestSubmission: null,
          records: []
        });
      }

      const item = map.get(key)!;
      item.records.push(rec);
      item.totalUploaded += 1;

      const isVerified = (rec.status || '').toUpperCase() === 'VERIFIED';
      if (isVerified) {
        // Only verified submitted will be count as 1 credit to the submitter in the Ledger!
        item.submissionsCount += 1;
        const fCount = rec.filesCount || (rec.uploadedFiles ? rec.uploadedFiles.length : 1);
        item.filesCount += fCount;
      } else {
        item.pendingCount += 1;
      }

      if (rec.barangay) item.barangays.add(rec.barangay);
      if (!item.latestSubmission || new Date(rec.uploadedAt).getTime() > new Date(item.latestSubmission).getTime()) {
        item.latestSubmission = rec.uploadedAt;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.submissionsCount - a.submissionsCount);
  }, [uploadedRecords]);

  // Export Submitters Tallies & Payroll Ledger to CSV Function
  const exportLedgerToCsv = () => {
    if (submittersLedger.length === 0) {
      showToast('No submitters available to export', 'warning');
      return;
    }
    const headers = [
      'Submitter Name',
      'Total Verified Submissions (Credits)',
      'Pending Submissions (Uncredited)',
      'Approved Base Rate (PHP)',
      'Total Computed Salary (PHP)',
      'Settlement Status',
      'Amount Settled / Paid (PHP)',
      'Disbursement Method',
      'Settlement Date',
      'Settled By',
      'Reference Notes'
    ];
    const rows = submittersLedger.map((sub) => {
      const setRec = settlements.find(s => s.submitter && s.submitter.toLowerCase() === sub.name.toLowerCase());
      const computedSalary = sub.submissionsCount * baseRate;
      return [
        `"${sub.name.replace(/"/g, '""')}"`,
        sub.submissionsCount,
        sub.pendingCount,
        baseRate.toFixed(2),
        computedSalary.toFixed(2),
        `"${(setRec?.paymentStatus || 'PENDING').replace(/"/g, '""')}"`,
        setRec ? (setRec.amountPaid ?? setRec.totalSalary).toFixed(2) : '0.00',
        `"${(setRec?.paymentMethod || 'N/A').replace(/"/g, '""')}"`,
        setRec?.settledAt ? `"${formatTimestamp(setRec.settledAt).replace(/"/g, '""')}"` : '""',
        `"${(setRec?.settledBy || '').replace(/"/g, '""')}"`,
        `"${(setRec?.referenceNotes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pcu_submitters_payroll_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Submitters Tallies & Payroll Ledger exported to CSV successfully', 'success');
  };

  // Filtered records for Grid when inside a folder or in all-grid mode
  const currentFolderData = React.useMemo(() => {
    if (!selectedFolder) return null;
    const targetKey = normalizeBarangayNameKey(selectedFolder);
    return barangayFolders.find(f => 
      f.normalizedKey === targetKey || 
      f.name.toLowerCase().trim() === selectedFolder.toLowerCase().trim() ||
      normalizeBarangayNameKey(f.name) === targetKey
    ) || null;
  }, [barangayFolders, selectedFolder]);

  // Records belonging to the currently selected folder (or all current tab records if no folder selected)
  const folderRecords = React.useMemo(() => {
    if (!selectedFolder) return currentTabRecords;
    if (currentFolderData && currentFolderData.records && currentFolderData.records.length > 0) {
      return currentFolderData.records;
    }
    const targetKey = normalizeBarangayNameKey(selectedFolder);
    return currentTabRecords.filter(r => 
      normalizeBarangayNameKey(r.barangay) === targetKey ||
      (r.barangay && r.barangay.toLowerCase().trim() === selectedFolder.toLowerCase().trim())
    );
  }, [selectedFolder, currentFolderData, currentTabRecords]);

  // Filtered records for Grid (search and barangay filters)
  const filteredRecords = React.useMemo(() => {
    const sourceRecords = selectedFolder ? folderRecords : currentTabRecords;
    const q = searchQuery.toLowerCase().trim();

    return sourceRecords.filter((rec) => {
      const matchesSearch = !q || 
        Boolean(
          (rec.fullName && rec.fullName.toLowerCase().includes(q)) ||
          (rec.barangay && rec.barangay.toLowerCase().includes(q)) ||
          (rec.purok && rec.purok.toLowerCase().includes(q)) ||
          (rec.contactNumber && rec.contactNumber.toLowerCase().includes(q)) ||
          (rec.uploadedBy && rec.uploadedBy.toLowerCase().includes(q)) ||
          (rec.fileName && rec.fileName.toLowerCase().includes(q))
        );

      // If inside a folder, barangay filtering is already handled by folderRecords.
      // If in all-grid mode (!selectedFolder), apply filterBarangay if not 'ALL'
      const matchesBarangay = selectedFolder 
        ? true 
        : (filterBarangay === 'ALL' || normalizeBarangayNameKey(rec.barangay) === normalizeBarangayNameKey(filterBarangay));

      return Boolean(matchesSearch && matchesBarangay);
    });
  }, [selectedFolder, folderRecords, currentTabRecords, searchQuery, filterBarangay]);

  // Paginated Slices (6 rows x 5 columns = 30 items per page)
  const paginatedBarangayFolders = React.useMemo(() => {
    const start = (folderPage - 1) * ITEMS_PER_PAGE;
    return filteredBarangayFolders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBarangayFolders, folderPage]);

  const paginatedAllGridRecords = React.useMemo(() => {
    const start = (allGridPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, allGridPage]);

  const paginatedInFolderRecords = React.useMemo(() => {
    const start = (inFolderPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, inFolderPage]);

  // Reusable Pagination component (Display 6 rows, 5 columns = 30 items per page)
  const renderPaginationControls = (
    currentPage: number,
    totalItems: number,
    pageSize: number,
    onPageChange: (page: number) => void,
    itemName: string = 'records'
  ) => {
    if (totalItems === 0) return null;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (currentPage <= 4) {
          pages.push(1, 2, 3, 4, 5, '...', totalPages);
        } else if (currentPage >= totalPages - 3) {
          pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
          pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
        }
      }
      return pages;
    };

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
          <span>
            Showing <strong className="font-black text-slate-900">{startItem}–{endItem}</strong> of{' '}
            <strong className="font-black text-slate-900">{totalItems}</strong> {itemName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] shadow-xs">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Page {currentPage} of {totalPages}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-semibold">Display: 6 rows &times; 5 columns (30/page)</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (currentPage > 1) {
                onPageChange(currentPage - 1);
                window.scrollTo({ top: 380, behavior: 'smooth' });
              }
            }}
            disabled={currentPage <= 1}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 text-xs font-bold">
                    ...
                  </span>
                );
              }
              const isCurrent = page === currentPage;
              return (
                <button
                  key={`page-${page}`}
                  type="button"
                  onClick={() => {
                    onPageChange(Number(page));
                    window.scrollTo({ top: 380, behavior: 'smooth' });
                  }}
                  className={`min-w-[36px] h-9 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-black'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentPage < totalPages) {
                onPageChange(currentPage + 1);
                window.scrollTo({ top: 380, behavior: 'smooth' });
              }
            }}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto pb-16">
      {/* ========================================================================= */}
      {/* SECTION HEADER WITH MOVED "UPLOAD PCU" BUTTON                             */}
      {/* ========================================================================= */}
      <div className="neu-dark-green rounded-3xl p-4 sm:p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          {/* Header Title & Subtitle */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] sm:text-xs font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              Patient Care Unit (PCU)
            </div>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black font-display tracking-tight text-white flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <span>Submit PCU</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-emerald-200 border border-white/10">
                {uploadedRecords.length} Records
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
              Official portal for submitting Patient Care Unit documentation and multiple image attachments. Click any card in the grid to view whole data uploaded.
            </p>
          </div>

          {/* RIGHT SIDE OF HEADER: THE MOVED "UPLOAD PCU" BUTTON & USER BADGES */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0 w-full sm:w-auto">
            {/* User Info Badges */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <div className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/15 text-left sm:text-right">
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Logged In</span>
                <span className="text-xs font-black text-white">{currentUser?.username || 'Staff'}</span>
              </div>
              {currentUser?.barangay && (
                <div className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-800/50 backdrop-blur-md rounded-xl sm:rounded-2xl border border-emerald-500/30 text-right">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Barangay</span>
                  <span className="text-xs font-black text-white">{currentUser.barangay}</span>
                </div>
              )}
            </div>

            {/* THE REQUESTED "UPLOAD PCU" BUTTON ON THE HEADER OF THE SECTION */}
            {!isFormOpen ? (
              <button
                type="button"
                name="Upload PCU"
                onClick={() => {
                  setSubmitSuccess(null);
                  setIsFormOpen(true);
                }}
                className="neu-btn-green inline-flex items-center justify-center gap-2.5 px-5 sm:px-6 py-3 sm:py-3.5 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl sm:rounded-2xl cursor-pointer focus:outline-none w-full sm:w-auto min-h-[44px]"
              >
                <UploadCloud className="w-5 h-5 text-white stroke-[2.5]" />
                <span>Upload PCU</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="neu-btn-white inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 text-emerald-900 font-bold text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all cursor-pointer w-full sm:w-auto min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Grid</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Toast / Success Message */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 text-xs font-semibold shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* TABS NAVIGATION BAR BELOW THE HEADER                                       */}
      {/* Tab 1: Pending (Renamed from Barangay Folders)                             */}
      {/* Tab 2: Verified (New tab beside Pending for verified PCU submissions)       */}
      {/* Tab 3: Ledger (Master Admin Only - submitter credits & payroll)           */}
      {/* ========================================================================= */}
      {!isFormOpen && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 neu-raised p-2 sm:p-3 rounded-2xl">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {/* Tab 1: Pending (Renamed from Barangay Folders) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('pending');
              }}
              className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[40px] ${
                activeTab === 'pending'
                  ? 'neu-btn-white text-emerald-950 border border-emerald-500/30'
                  : 'neu-tab-inactive'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Pending</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'pending' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {pendingRecords.length}
              </span>
            </button>

            {/* Tab 2: Verified (New tab beside Pending) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('verified');
              }}
              className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[40px] ${
                activeTab === 'verified'
                  ? 'neu-tab-active-green'
                  : 'neu-tab-inactive'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Verified</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'verified' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {verifiedRecords.length}
              </span>
            </button>

            {/* Tab 3: Ledger (Only Master Admin can view) */}
            {isMasterAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ledger');
                }}
                className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer min-h-[40px] ${
                  activeTab === 'ledger'
                    ? 'neu-black text-white'
                    : 'neu-tab-inactive'
                }`}
              >
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ledger</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Master Admin
                </span>
              </button>
            )}
          </div>

          {/* Quick Info & Refresh */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 px-1 sm:px-0 shrink-0">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              <span className="text-emerald-700 font-bold">{verifiedRecords.length} Verified</span> • <span className="text-slate-700 font-bold">{pendingRecords.length} Pending</span>
            </span>
            <button
              type="button"
              onClick={fetchUploadedRecords}
              disabled={loadingRecords}
              className="p-2 neu-btn-white rounded-xl transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRecords ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic View: Toggle between Grid View of Uploaded Data and Upload PCU Form */}
      <AnimatePresence mode="wait">
        {!isFormOpen ? (
          activeTab === 'pending' || activeTab === 'verified' ? (
            /* ========================================================================= */
            /* VIEW: PENDING / VERIFIED BARANGAY FOLDERS & ALL GRID                      */
            /* ========================================================================= */
            <motion.div
              key={`${activeTab}-view`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* If no specific folder is selected, show ALL BARANGAY FOLDERS */}
              {selectedFolder === null ? (
                <div className="space-y-6">
                  {/* Folder Sub-Bar: Search & View Mode Switcher */}
                  <div className="neu-raised rounded-2xl p-3 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                      {/* Search Folders or Patients */}
                      <div className="relative flex-1 min-w-0">
                        <Search className="w-4 h-4 text-emerald-800 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={folderSearch}
                          onChange={(e) => setFolderSearch(e.target.value)}
                          placeholder="Search Barangay folders, patient names, or purok..."
                          className="w-full pl-10 pr-8 py-2.5 neu-inset rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                        />
                        {folderSearch && (
                          <button
                            type="button"
                            onClick={() => setFolderSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* View Switcher: Browse by Folders vs Flattened All Grid */}
                      <div className="inline-flex rounded-xl p-1 neu-flat w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setFolderViewMode('folders')}
                          className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                            folderViewMode === 'folders'
                              ? 'neu-tab-active-green'
                              : 'text-slate-600 hover:text-emerald-900'
                          }`}
                        >
                          <Folder className="w-3.5 h-3.5" />
                          <span>Folders</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFolderViewMode('all')}
                          className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                            folderViewMode === 'all'
                              ? 'neu-tab-active-green'
                              : 'text-slate-600 hover:text-emerald-900'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>All Grid ({currentTabRecords.length})</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 text-xs font-bold text-slate-500">
                      <span>{barangayFolders.length} Folders</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-black">
                        {currentTabRecords.length} {activeTab === 'verified' ? 'Verified' : 'Pending'} PCUs
                      </span>
                    </div>
                  </div>

                  {/* Mode 1: Display as BARANGAY FOLDERS */}
                  {folderViewMode === 'folders' ? (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {paginatedBarangayFolders.map((folder) => {
                          const hasFiles = folder.totalSubmissions > 0;

                          return (
                            <div
                              key={folder.name}
                              onClick={() => setSelectedFolder(folder.name)}
                              className="group relative neu-raised rounded-3xl cursor-pointer overflow-hidden flex flex-col justify-between"
                            >
                              {/* Top Folder Tab Decoration */}
                              <div className={`h-2 bg-gradient-to-r ${activeTab === 'verified' ? 'from-emerald-500 via-teal-500 to-slate-800' : 'from-amber-500 via-orange-500 to-slate-800'} group-hover:h-2.5 transition-all`} />

                              <div className="p-5 space-y-4">
                                {/* Header: Folder Icon & Files Badge */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                    hasFiles
                                      ? activeTab === 'verified' 
                                        ? 'bg-emerald-100 text-emerald-700 shadow-md shadow-emerald-500/10 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white'
                                        : 'bg-amber-100 text-amber-700 shadow-md shadow-amber-500/10 group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white'
                                      : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    <Folder className="w-6 h-6" />
                                  </div>

                                  <div className="text-right space-y-1">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
                                      hasFiles 
                                        ? activeTab === 'verified'
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                          : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}>
                                      <ImageIcon className="w-3 h-3" />
                                      <span>{folder.totalFiles} {folder.totalFiles === 1 ? 'file' : 'files'}</span>
                                    </span>
                                    <span className="block text-[11px] font-bold text-slate-400">
                                      {folder.totalSubmissions} {folder.totalSubmissions === 1 ? 'patient' : 'patients'}
                                    </span>
                                  </div>
                                </div>

                                {/* Barangay Name & Info */}
                                <div className="space-y-1">
                                  <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                                    <span>{folder.name}</span>
                                  </h3>
                                  <p className="text-[11px] text-slate-400 line-clamp-1">
                                    {hasFiles 
                                      ? `Staff: ${Array.from(folder.submitters).slice(0, 2).join(', ')}${folder.submitters.size > 2 ? '...' : ''}` 
                                      : `No ${activeTab === 'verified' ? 'verified' : 'pending'} PCU files`}
                                  </p>
                                </div>
                              </div>

                              {/* Card Footer: Last Uploaded & Action */}
                              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-400">
                                  {folder.latestUploadedAt ? `Updated ${formatTimestamp(folder.latestUploadedAt).split(',')[0]}` : 'Empty Folder'}
                                </span>

                                <div className="flex items-center gap-1.5 font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                                  <span>Open Folder</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {renderPaginationControls(
                        folderPage,
                        filteredBarangayFolders.length,
                        ITEMS_PER_PAGE,
                        setFolderPage,
                        'folders'
                      )}
                    </div>
                  ) : (
                    /* Mode 2: Flattened All Grid View */
                    <div className="space-y-4">
                      {/* Search & Filter Bar for All Grid */}
                      <div className="neu-raised rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-emerald-800 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search by patient name, purok, or contact #..."
                              className="w-full pl-10 pr-4 py-2.5 neu-inset rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                            />
                            {searchQuery && (
                              <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="sm:w-56 shrink-0 relative">
                            <select
                              value={filterBarangay}
                              onChange={(e) => setFilterBarangay(e.target.value)}
                              className="w-full px-3.5 py-2.5 neu-inset rounded-xl text-xs font-bold text-slate-800 focus:outline-none transition-all cursor-pointer"
                            >
                              <option value="ALL">All Barangays ({currentTabRecords.length})</option>
                              {barangaysList.map((bg) => {
                                const count = currentTabRecords.filter(r => normalizeBarangayNameKey(r.barangay) === normalizeBarangayNameKey(bg)).length;
                                return (
                                  <option key={bg} value={bg}>
                                    {bg} {count > 0 ? `(${count})` : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        <div className="text-xs font-bold text-slate-500">
                          Showing <span className="text-slate-900 font-black">{filteredRecords.length}</span> of {currentTabRecords.length}
                        </div>
                      </div>

                      {/* Grid of All Cards */}
                      {filteredRecords.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-slate-200">
                          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
                          <h4 className="text-base font-bold text-slate-700">
                            {activeTab === 'verified' ? 'No verified submissions found' : 'No pending submissions found'}
                          </h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            {activeTab === 'verified'
                              ? 'Click the Verify button on pending submissions to verify them and credit them to submitters in the Ledger.'
                              : 'No pending PCU submissions match your current search criteria.'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {paginatedAllGridRecords.map((record, index) => {
                              const firstFile = record.uploadedFiles[0];
                              const hasImage = firstFile && isImageFile(firstFile.url, firstFile.name);
                              const isVerified = (record.status || '').toUpperCase() === 'VERIFIED';

                              return (
                                <div
                                  key={`${record.id}-${record.fullName}-${index}`}
                                  onClick={() => setSelectedRecord(record)}
                                  className="group neu-raised rounded-2xl overflow-hidden flex flex-col cursor-pointer relative"
                                >
                                  <div className="relative h-36 sm:h-40 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                                    {hasImage && firstFile.url ? (
                                      <img
                                        src={firstFile.url}
                                        alt={record.fullName}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 p-4 space-y-2">
                                        <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                                          <FileText className="w-6 h-6" />
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-500 text-center line-clamp-1">
                                          {firstFile?.name || 'PCU Document'}
                                        </span>
                                      </div>
                                    )}

                                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1">
                                      <div className="flex items-center gap-1.5 pointer-events-auto min-w-0">
                                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-950/80 backdrop-blur-md text-emerald-200 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 shadow-xs truncate max-w-[100px] sm:max-w-none">
                                          {record.barangay}
                                        </span>
                                        {isVerified ? (
                                          <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shrink-0">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                            Verified
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shrink-0">
                                            <Clock className="w-3 h-3 text-white" />
                                            Pending
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 pointer-events-auto shrink-0">
                                        <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 border border-white/10 shadow-xs">
                                          <ImageIcon className="w-3 h-3 text-emerald-400" />
                                          <span>{record.filesCount}</span>
                                        </span>

                                        {isMasterAdmin && (
                                          <button
                                            type="button"
                                            onClick={(e) => promptDeleteRecord(e, record)}
                                            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-rose-600/90 hover:bg-rose-600 active:bg-rose-700 text-white shadow-md transition-all cursor-pointer hover:scale-110"
                                            title="Permanently Delete PCU Record from MySQL (Master Admin Only)"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-emerald-900 text-xs font-black shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                                        <Eye className="w-4 h-4 text-emerald-600" />
                                        View Whole Data
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                                    <div className="space-y-1.5">
                                      <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors line-clamp-1" title={record.fullName}>
                                        {record.fullName}
                                      </h3>

                                      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">
                                          {record.purok ? `${record.purok}, ` : ''}{record.barangay}
                                        </span>
                                      </div>

                                      {record.contactNumber && (
                                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                                          <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                          <span className="truncate">{record.contactNumber}</span>
                                        </div>
                                      )}

                                      {/* Mobile Tap Affordance */}
                                      <div className="flex items-center justify-between text-[11px] text-emerald-700 font-semibold sm:hidden pt-0.5">
                                        <span className="flex items-center gap-1">
                                          <Eye className="w-3.5 h-3.5 text-emerald-600" /> Tap to view whole data
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action row: Verify Button */}
                                    <div className="pt-2">
                                      {!isVerified ? (
                                        isMasterAdmin ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setVerifyTarget(record);
                                            }}
                                            disabled={verifyingId === record.id}
                                            className="w-full py-2.5 px-3 min-h-[42px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                            title="Verify submission: opens confirmation popup (Master Admin Only)"
                                          >
                                            {verifyingId === record.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                            )}
                                            <span>Verify</span>
                                          </button>
                                        ) : (
                                          <div className="w-full py-2 px-2 min-h-[38px] bg-amber-50 border border-amber-200/70 text-amber-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs">
                                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            <span className="truncate">Pending Verification</span>
                                          </div>
                                        )
                                      ) : (
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex-1 py-2 px-2 min-h-[38px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] font-black flex items-center justify-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Verified</span>
                                          </span>
                                          {isMasterAdmin && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnverifyRecord(record);
                                              }}
                                              disabled={verifyingId === record.id}
                                              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                                              title="Move back to Pending (Master Admin Only)"
                                            >
                                              <Clock className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                      <div className="flex items-center gap-1 truncate" title={`Uploaded by ${record.uploadedBy}`}>
                                        <User className="w-3 h-3 text-slate-400" />
                                        <span className="truncate font-medium">{record.uploadedBy}</span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 shrink-0 font-medium text-slate-400">
                                          <Clock className="w-3 h-3 text-slate-400" />
                                          <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                                        </div>

                                        {isMasterAdmin && (
                                          <button
                                            type="button"
                                            onClick={(e) => promptDeleteRecord(e, record)}
                                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                            title="Permanently Delete from MySQL (Master Admin Only)"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {renderPaginationControls(
                            allGridPage,
                            filteredRecords.length,
                            ITEMS_PER_PAGE,
                            setAllGridPage,
                            'submissions'
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* INSIDE A SPECIFIC BARANGAY FOLDER */
                <div className="space-y-6">
                  {/* Folder Breadcrumbs & Controls Banner */}
                  <div className="neu-raised rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFolder(null)}
                        className="p-2.5 rounded-xl neu-btn-white text-emerald-950 transition-colors cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                        title="Back to All Barangay Folders"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <span 
                            onClick={() => setSelectedFolder(null)}
                            className="hover:text-emerald-700 cursor-pointer flex items-center gap-1"
                          >
                            <Folder className="w-3.5 h-3.5 text-emerald-600" />
                            All Folders
                          </span>
                          <span>/</span>
                          <span className="text-emerald-700">Barangay Folder</span>
                        </div>
                        <h2 className="text-lg sm:text-2xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                          <span>{selectedFolder}</span>
                          <span className="text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {currentFolderData?.totalFiles || folderRecords.reduce((sum, r) => sum + (r.filesCount || (r.uploadedFiles ? r.uploadedFiles.length : 1)), 0)} Files
                          </span>
                          <span className="text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {folderRecords.length} {folderRecords.length === 1 ? 'Record' : 'Records'}
                          </span>
                        </h2>
                      </div>
                    </div>

                    {/* Right side: Switch folder dropdown & Upload shortcut */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                      {/* Jump to Another Barangay Folder Dropdown */}
                      <div className="relative w-full sm:w-auto">
                        <select
                          value={selectedFolder}
                          onChange={(e) => setSelectedFolder(e.target.value)}
                          className="w-full sm:w-auto px-3.5 py-2.5 neu-inset rounded-xl text-xs font-bold text-slate-800 focus:outline-none transition-all cursor-pointer min-h-[42px]"
                        >
                          {barangayFolders.map((f) => (
                            <option key={f.name} value={f.name}>
                              Folder: {f.name} ({f.totalFiles} files)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Upload Button specifically for this Barangay Folder */}
                      <button
                        type="button"
                        onClick={() => {
                          setBarangay(selectedFolder);
                          setFullName('');
                          setPurok('');
                          setContactNumber('');
                          setStagedFiles([]);
                          setIsFormOpen(true);
                        }}
                        className="neu-btn-green inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-black text-xs uppercase tracking-wider cursor-pointer transition-all min-h-[42px] w-full sm:w-auto"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Upload to {selectedFolder}</span>
                      </button>
                    </div>
                  </div>

                  {/* Search within this folder */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-emerald-800 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search patient records within ${selectedFolder}...`}
                      className="w-full pl-10 pr-4 py-3 neu-inset rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Submissions Grid for this folder */}
                  {filteredRecords.length === 0 ? (
                    folderRecords.length > 0 && searchQuery ? (
                      <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-slate-200">
                        <Search className="w-12 h-12 text-slate-300 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-slate-800">
                            No records match &quot;{searchQuery}&quot;
                          </h4>
                          <p className="text-xs text-slate-400 max-w-md mx-auto">
                            There are {folderRecords.length} records in this folder, but none match your search keyword.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Clear Search Filter</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-dashed border-slate-200">
                        <FolderOpen className="w-14 h-14 text-emerald-400/60 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-slate-800">
                            No PCU files in {selectedFolder} yet
                          </h4>
                          <p className="text-xs text-slate-400 max-w-md mx-auto">
                            Be the first to submit Patient Care Unit documentation for this Barangay. All submitted files will be securely organized in this folder.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBarangay(selectedFolder);
                            setFullName('');
                            setPurok('');
                            setContactNumber('');
                            setStagedFiles([]);
                            setIsFormOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Upload PCU for {selectedFolder}</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {paginatedInFolderRecords.map((record, index) => {
                          const firstFile = record.uploadedFiles[0];
                          const hasImage = firstFile && isImageFile(firstFile.url, firstFile.name);

                          return (
                            <div
                              key={`${record.id}-${record.fullName}-${index}`}
                              onClick={() => setSelectedRecord(record)}
                              className="group neu-raised rounded-2xl overflow-hidden flex flex-col cursor-pointer relative"
                            >
                              <div className="relative h-36 sm:h-40 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                                {hasImage && firstFile.url ? (
                                  <img
                                    src={firstFile.url}
                                    alt={record.fullName}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 p-4 space-y-2">
                                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600">
                                      <FileText className="w-6 h-6" />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-500 text-center line-clamp-1">
                                      {firstFile?.name || 'PCU Document'}
                                    </span>
                                  </div>
                                )}

                                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1">
                                  <div className="flex items-center gap-1.5 pointer-events-auto min-w-0">
                                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-950/80 backdrop-blur-md text-emerald-200 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 shadow-xs truncate max-w-[100px] sm:max-w-none">
                                      {record.barangay}
                                    </span>
                                    {(record.status || '').toUpperCase() === 'VERIFIED' ? (
                                      <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shrink-0">
                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                        Verified
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs shrink-0">
                                        <Clock className="w-3 h-3 text-white" />
                                        Pending
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 pointer-events-auto shrink-0">
                                    <span className="px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 border border-white/10 shadow-xs">
                                      <ImageIcon className="w-3 h-3 text-emerald-400" />
                                      <span>{record.filesCount}</span>
                                    </span>

                                    {isMasterAdmin && (
                                      <button
                                        type="button"
                                        onClick={(e) => promptDeleteRecord(e, record)}
                                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-rose-600/90 hover:bg-rose-600 active:bg-rose-700 text-white shadow-md transition-all cursor-pointer hover:scale-110"
                                        title="Permanently Delete PCU Record from MySQL (Master Admin Only)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-emerald-900 text-xs font-black shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                                    <Eye className="w-4 h-4 text-emerald-600" />
                                    View Whole Data
                                  </span>
                                </div>
                              </div>

                              <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                                <div className="space-y-1.5">
                                  <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors line-clamp-1" title={record.fullName}>
                                    {record.fullName}
                                  </h3>

                                  <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate">
                                      {record.purok ? `${record.purok}, ` : ''}{record.barangay}
                                    </span>
                                  </div>

                                  {record.contactNumber && (
                                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                                      <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                      <span className="truncate">{record.contactNumber}</span>
                                    </div>
                                  )}

                                  {/* Mobile Tap Affordance */}
                                  <div className="flex items-center justify-between text-[11px] text-emerald-700 font-semibold sm:hidden pt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Eye className="w-3.5 h-3.5 text-emerald-600" /> Tap to view whole data
                                    </span>
                                  </div>
                                </div>

                                {/* Action row: Verify Button */}
                                <div className="pt-2">
                                  {(record.status || '').toUpperCase() !== 'VERIFIED' ? (
                                    isMasterAdmin ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setVerifyTarget(record);
                                        }}
                                        disabled={verifyingId === record.id}
                                        className="w-full py-2.5 px-3 min-h-[42px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                        title="Verify submission: opens confirmation popup (Master Admin Only)"
                                      >
                                        {verifyingId === record.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                        )}
                                        <span>Verify</span>
                                      </button>
                                    ) : (
                                      <div className="w-full py-2 px-2 min-h-[38px] bg-amber-50 border border-amber-200/70 text-amber-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs">
                                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span className="truncate">Pending Verification</span>
                                      </div>
                                    )
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="flex-1 py-2 px-2 min-h-[38px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] font-black flex items-center justify-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Verified</span>
                                      </span>
                                      {isMasterAdmin && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnverifyRecord(record);
                                          }}
                                          disabled={verifyingId === record.id}
                                          className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                                          title="Move back to Pending (Master Admin Only)"
                                        >
                                          <Clock className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                  <div className="flex items-center gap-1 truncate" title={`Uploaded by ${record.uploadedBy}`}>
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span className="truncate font-medium">{record.uploadedBy}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 shrink-0 font-medium text-slate-400">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{new Date(record.uploadedAt).toLocaleDateString()}</span>
                                    </div>

                                    {isMasterAdmin && (
                                      <button
                                        type="button"
                                        onClick={(e) => promptDeleteRecord(e, record)}
                                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                        title="Permanently Delete from MySQL (Master Admin Only)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {renderPaginationControls(
                        inFolderPage,
                        filteredRecords.length,
                        ITEMS_PER_PAGE,
                        setInFolderPage,
                        'records'
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            /* ========================================================================= */
            /* VIEW B: LEDGER (MASTER ADMIN ONLY)                                        */
            /* Lists all the names who submitted PCU Files with their count of submission*/
            /* ========================================================================= */
            <motion.div
              key="ledger-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Ledger Header & Export Controls */}
              <div className="neu-black text-white rounded-3xl p-5 sm:p-8 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Master Admin Audit & Payroll Portal</span>
                    </div>
                    <h2 className="text-xl sm:text-3xl font-black font-display tracking-tight text-white flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <span>PCU Submissions & Payroll Ledger</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-emerald-300">
                        {submittersLedger.length} Contributors
                      </span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                      Official submitter tallies, dynamic salary calculation powered by MySQL base rate, and permanent settlement records.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={exportLedgerToCsv}
                      className="w-full sm:w-auto neu-btn-green inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl sm:rounded-2xl text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Payroll CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Base Rate Configuration Card (Saved Permanently to MySQL) */}
              <div className="neu-raised rounded-3xl p-4 sm:p-6 md:p-8 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 text-[11px] font-black border border-emerald-300">
                      <Database className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Saved Permanently in MySQL (`site_settings`)</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2.5">
                      <Banknote className="w-5 h-5 text-emerald-700" />
                      <span>PCU Submission Base Rate</span>
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Set the approved salary or stipend rate per verified submission. Changing this rate automatically recalculates all submitters' Total Salary tallies below and persists permanently to the MySQL database.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 sm:w-48">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">
                        ₱
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={baseRateInput}
                        onChange={(e) => setBaseRateInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveBaseRate();
                          }
                        }}
                        placeholder="50.00"
                        className="w-full pl-8 pr-4 py-2.5 neu-inset rounded-xl text-sm font-black text-slate-900 focus:outline-none transition-all font-mono min-h-[42px]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveBaseRate()}
                      disabled={savingBaseRate}
                      className="neu-btn-green inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 min-h-[42px] w-full sm:w-auto"
                    >
                      {savingBaseRate ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving to MySQL...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save Base Rate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Preset Buttons & Active Rate Indicator */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Quick Rates:</span>
                    {[25, 50, 75, 100, 150].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setBaseRateInput(String(rate));
                          handleSaveBaseRate(rate);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[36px] ${
                          baseRate === rate
                            ? 'neu-btn-green'
                            : 'neu-btn-white'
                        }`}
                      >
                        ₱{rate}.00
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white/70 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto">
                    <span>Active Rate:</span>
                    <span className="font-mono text-emerald-950 font-black">₱{baseRate.toFixed(2)}</span>
                    <span className="text-slate-400 font-normal">/ verified submission</span>
                  </div>
                </div>
              </div>

              {/* 4 KPI Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Verified Credits */}
                <div className="neu-raised rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified Credits</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{verifiedRecords.length}</div>
                  <span className="text-[11px] text-emerald-700 font-bold block">
                    {pendingRecords.length} pending (uncredited)
                  </span>
                </div>

                {/* 2. Active Submitters */}
                <div className="neu-raised rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Submitters</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{submittersLedger.length}</div>
                  <span className="text-[11px] text-slate-400 block">Registered staff accounts</span>
                </div>

                {/* 3. Current Base Rate */}
                <div className="neu-raised rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Base Rate</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">₱{baseRate.toFixed(2)}</div>
                  <span className="text-[11px] text-emerald-600 font-semibold block">Per verified submission</span>
                </div>

                {/* 4. Total Payroll Pool */}
                <div className="neu-raised rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Salary Pool</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ₱{(verifiedRecords.length * baseRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[11px] text-slate-400 block">
                    {verifiedRecords.length} verified &times; ₱{baseRate.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* SUBMITTERS & CONTRIBUTOR TALLIES TABLE */}
              {/* Displays only: Submitter, Verified Credits, Pending, Total Salary, Action (Settlement) */}
              <div className="neu-raised rounded-3xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        Submitters & Contributor Tallies
                      </h3>
                      <p className="text-xs text-slate-400">
                        Only verified PCU submissions earn 1 credit (₱{baseRate.toFixed(2)}) towards submitter salary.
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-slate-500 self-start sm:self-auto">
                    {submittersLedger.length} Registered Submitters
                  </span>
                </div>

                {/* Mobile Cards View (sm/xs screens) */}
                <div className="block md:hidden space-y-3">
                  {submittersLedger.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 font-medium text-xs">
                      No submitters recorded yet.
                    </div>
                  ) : (
                    submittersLedger.map((sub, idx) => {
                      const computedSalary = sub.submissionsCount * baseRate;
                      const settlementRec = settlements.find(
                        s => s.submitter && s.submitter.toLowerCase() === sub.name.toLowerCase()
                      );
                      const isSettled = settlementRec && (settlementRec.paymentStatus === 'SETTLED' || settlementRec.paymentStatus === 'PAID');

                      return (
                        <div key={`m-${sub.name}`} className="neu-inset p-4 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shrink-0">
                                {sub.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-slate-900 text-sm truncate">{sub.name}</h4>
                                <span className="text-[11px] font-semibold text-slate-400">Rank #{idx + 1} Contributor</span>
                              </div>
                            </div>

                            {isSettled ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Settled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Verified Credits</span>
                              <span className="text-sm font-black text-emerald-950">{sub.submissionsCount} Credits</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Salary</span>
                              <span className="text-sm font-black text-emerald-700 font-mono">
                                ₱{computedSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <div className="pt-1">
                            {isSettled ? (
                              <button
                                type="button"
                                onClick={() => openSettlementModal(sub)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition-all cursor-pointer min-h-[42px]"
                              >
                                <Receipt className="w-4 h-4 text-emerald-600" />
                                <span>Settled (₱{(settlementRec.amountPaid ?? settlementRec.totalSalary).toFixed(2)})</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openSettlementModal(sub)}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer min-h-[42px]"
                              >
                                <Wallet className="w-4 h-4" />
                                <span>Process Settlement</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Tallies Table */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3.5 px-6">Submitter</th>
                        <th className="py-3.5 px-6 text-center">Verified Submissions (1 Credit Each)</th>
                        <th className="py-3.5 px-6 text-center">Pending (0 Credits)</th>
                        <th className="py-3.5 px-6 text-right">Total Salary</th>
                        <th className="py-3.5 px-6 text-center">Action (Settlement)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submittersLedger.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                            No submitters recorded yet.
                          </td>
                        </tr>
                      ) : (
                        submittersLedger.map((sub, idx) => {
                          const computedSalary = sub.submissionsCount * baseRate;
                          const settlementRec = settlements.find(
                            s => s.submitter && s.submitter.toLowerCase() === sub.name.toLowerCase()
                          );
                          const isSettled = settlementRec && (settlementRec.paymentStatus === 'SETTLED' || settlementRec.paymentStatus === 'PAID');

                          return (
                            <tr key={sub.name} className="hover:bg-slate-50/70 transition-colors">
                              {/* 1. Submitter */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                                    {sub.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                                      <span>{sub.name}</span>
                                      {isSettled ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          Settled
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                          <Clock className="w-3 h-3 text-amber-600" />
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-400 block">
                                      Rank #{idx + 1} Contributor
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Verified Submissions (1 Credit Each) */}
                              <td className="py-4 px-6 text-center">
                                <span className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-black text-sm border border-emerald-200 shadow-xs">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>{sub.submissionsCount} Credits</span>
                                </span>
                              </td>

                              {/* 3. Pending Submissions (0 Credits) */}
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center justify-center gap-1 px-3 py-1 rounded-xl text-xs font-bold ${
                                  (sub.pendingCount || 0) > 0 
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                    : 'bg-slate-50 text-slate-400'
                                }`}>
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{sub.pendingCount || 0} Pending</span>
                                </span>
                              </td>

                              {/* 4. Total Salary */}
                              <td className="py-4 px-6 text-right">
                                <div className="font-black text-base text-emerald-700 font-mono">
                                  ₱{computedSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[11px] font-medium text-slate-400">
                                  {sub.submissionsCount} verified &times; ₱{baseRate.toFixed(2)}
                                </div>
                              </td>

                              {/* 5. Action (Settlement) */}
                              <td className="py-4 px-6 text-center">
                                <div className="inline-flex items-center gap-2 justify-center">
                                  {isSettled ? (
                                    <button
                                      type="button"
                                      onClick={() => openSettlementModal(sub)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition-all cursor-pointer shadow-xs min-h-[38px]"
                                      title="View or update settlement voucher"
                                    >
                                      <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Settled (₱{(settlementRec.amountPaid ?? settlementRec.totalSalary).toFixed(2)})</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openSettlementModal(sub)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer min-h-[38px]"
                                      title="Process salary settlement for submitter"
                                    >
                                      <Wallet className="w-3.5 h-3.5" />
                                      <span>Settlement</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Settlement Modal Dialog */}
              {settlingSubmitter && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-6"
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">
                            Submitter Salary Settlement
                          </h3>
                          <p className="text-xs text-slate-500">
                            Official PCU submission payout & settlement record
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettlingSubmitter(null)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Submitter & Computation Summary Box */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Submitter:</span>
                        <span className="font-black text-slate-900 text-sm">{settlingSubmitter.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Total Submissions:</span>
                        <span className="font-bold text-slate-900">{settlingSubmitter.totalSubmissions}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Current Base Rate:</span>
                        <span className="font-bold text-slate-900">₱{baseRate.toFixed(2)} / record</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                        <span className="font-black text-slate-700 text-xs uppercase tracking-wider">Computed Total Salary:</span>
                        <span className="font-mono font-black text-emerald-700 text-base">
                          ₱{settlingSubmitter.totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Settlement Form Fields */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Settlement Payout Amount (₱)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={settlementAmount}
                            onChange={(e) => setSettlementAmount(e.target.value)}
                            className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Disbursement Method
                        </label>
                        <select
                          value={settlementMethod}
                          onChange={(e) => setSettlementMethod(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all cursor-pointer"
                        >
                          <option value="Cash">Cash (Petty Cash Fund)</option>
                          <option value="GCash">GCash / Digital Wallet</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Check">Check Payout</option>
                          <option value="Clinic Payroll">Clinic Payroll Batch</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Voucher Reference / Memo (Optional)
                        </label>
                        <input
                          type="text"
                          value={settlementNotes}
                          onChange={(e) => setSettlementNotes(e.target.value)}
                          placeholder="e.g. Voucher #104, Paid on 2026-09-22"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                        />
                      </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePrintVoucher(
                            settlingSubmitter.name,
                            settlingSubmitter.totalSubmissions,
                            settlingSubmitter.totalSalary,
                            parseFloat(settlementAmount) || settlingSubmitter.totalSalary,
                            settlementMethod,
                            settlementNotes
                          )}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                          title="Print official voucher"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Voucher</span>
                        </button>

                        {settlements.some(s => s.submitter && s.submitter.toLowerCase() === settlingSubmitter.name.toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => handleResetSettlement(settlingSubmitter.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
                            title="Reset settlement status"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSettlingSubmitter(null)}
                          className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmSettlement}
                          disabled={submittingSettlement}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                        >
                          {submittingSettlement ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Confirm Settlement</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )
        ) : (
          /* ========================================================================= */
          /* SECTION 2: THE FORM (DISPLAYED WHEN "Upload PCU" BUTTON IS CLICKED)        */
          /* ========================================================================= */
          <motion.div
            key="upload-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="neu-raised rounded-3xl p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8">
              {/* Form Navigation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 sm:pb-6 border-b border-slate-100 gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="p-2.5 neu-btn-white text-emerald-950 rounded-xl transition-colors cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Back to Grid"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-black text-slate-800 font-display">
                      PCU Upload & Submission Form
                    </h2>
                    <p className="text-xs text-slate-500">
                      Fill in patient information and select multiple PCU images to submit.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="neu-btn-white text-xs font-bold text-slate-700 px-4 py-2.5 rounded-xl self-stretch sm:self-auto cursor-pointer min-h-[40px] text-center"
                >
                  Cancel & Return
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 1. Full Name */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      required
                      className="w-full px-4 py-3 neu-inset rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Enter the patient's complete name (First, Middle, Last).
                    </span>
                  </div>

                  {/* 2. Barangay (selection from database Barangay) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        Barangay <span className="text-rose-500">*</span>
                      </span>
                      {loadingBarangays && (
                        <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading list...
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <select
                        value={barangay}
                        onChange={(e) => setBarangay(e.target.value)}
                        required
                        className="w-full px-4 py-3 neu-inset rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none transition-all cursor-pointer"
                      >
                        {barangaysList.length === 0 ? (
                          <option value="">No Barangays Loaded</option>
                        ) : (
                          barangaysList.map((bg) => (
                            <option key={bg} value={bg}>
                              {bg}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      Selected from verified clinic database barangays.
                    </span>
                  </div>

                  {/* 3. Purok */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      Purok
                    </label>
                    <input
                      type="text"
                      value={purok}
                      onChange={(e) => setPurok(e.target.value)}
                      placeholder="e.g. Purok 1, Purok Rosal, Sitio Centro"
                      className="w-full px-4 py-3 neu-inset rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Sub-village or purok location within the barangay.
                    </span>
                  </div>

                  {/* 4. Contact # */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      Contact #
                    </label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. 0912-345-6789"
                      className="w-full px-4 py-3 neu-inset rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all font-mono"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      Mobile number or phone contact for patient follow-up.
                    </span>
                  </div>
                </div>

                {/* 5. Upload PCU (Multiple Image Upload Support) */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Upload PCU (Multiple Images Supported) <span className="text-rose-500">*</span>
                    </label>
                    {stagedFiles.length > 0 && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {stagedFiles.length} image(s) selected
                      </span>
                    )}
                  </div>

                  {/* Dropzone Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="neu-flat border-2 border-dashed border-emerald-400/60 rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleFilesSelected}
                      className="hidden"
                    />

                    <div className="space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          Click to select multiple PCU images or drag & drop files here
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Supports PNG, JPG, JPEG, WEBP, and PDF documents (up to 25MB each)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preview Grid for Staged Files */}
                  {stagedFiles.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                        <span>Selected Attachments:</span>
                        <button
                          type="button"
                          onClick={() => setStagedFiles([])}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {stagedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 relative group overflow-hidden flex flex-col justify-between"
                          >
                            <div className="w-full h-24 rounded-lg bg-slate-200/70 overflow-hidden flex items-center justify-center mb-2">
                              {file.previewUrl ? (
                                <img
                                  src={file.previewUrl}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-8 h-8 text-slate-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-800 truncate" title={file.fileName}>
                                {file.fileName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {formatFileSize(file.size)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStagedFile(idx);
                              }}
                              className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg shadow-sm border border-slate-200 transition-colors cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-full min-h-[130px] border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-emerald-700 transition-all cursor-pointer p-3"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-[11px] font-bold">Add More</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Action Buttons */}
                <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={submitting}
                    className="w-full sm:w-auto px-6 py-3 neu-btn-white text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || stagedFiles.length === 0}
                    className="w-full sm:w-auto neu-btn-green inline-flex items-center justify-center gap-2 px-8 py-3.5 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer focus:outline-none"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting PCU Record...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit PCU</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CLICKABLE TO VIEW WHOLE DATA UPLOADED                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">
                      <ShieldCheck className="w-3 h-3" />
                      Whole Data Uploaded
                    </div>
                    {(selectedRecord.status || '').toUpperCase() === 'VERIFIED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black font-display tracking-tight text-white line-clamp-1">
                    {selectedRecord.fullName}
                  </h2>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  {/* Verify / Unverify Button (Master Admin Only) */}
                  {isMasterAdmin && (
                    (selectedRecord.status || '').toUpperCase() !== 'VERIFIED' ? (
                      <button
                        type="button"
                        onClick={() => setVerifyTarget(selectedRecord)}
                        disabled={verifyingId === selectedRecord.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
                        title="Verify submission: opens confirmation popup (Master Admin Only)"
                      >
                        {verifyingId === selectedRecord.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Verify Submission</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUnverifyRecord(selectedRecord)}
                        disabled={verifyingId === selectedRecord.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 cursor-pointer"
                        title="Move back to Pending (Master Admin Only)"
                      >
                        {verifyingId === selectedRecord.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>Move to Pending</span>
                      </button>
                    )
                  )}

                  {/* Delete Entire Submission Button (Master Admin only) */}
                  {isMasterAdmin && (
                    <button
                      type="button"
                      onClick={(e) => promptDeleteRecord(e, selectedRecord)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      title="Permanently Delete Entire Submission from MySQL (Master Admin Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    title="Close Details"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Status Notice Banner */}
              {(selectedRecord.status || '').toUpperCase() === 'VERIFIED' ? (
                <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900 font-bold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>This PCU record is <strong>VERIFIED</strong>. It counts as <strong>1 Credit</strong> for <u>{selectedRecord.uploadedBy}</u> in the Ledger.</span>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Verified
                  </span>
                </div>
              ) : (
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between text-xs text-amber-900 font-bold">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>This submission is <strong>PENDING</strong>. It is <strong>NOT counted</strong> in the Ledger until verified.</span>
                  </div>
                  {isMasterAdmin ? (
                    <button
                      type="button"
                      onClick={() => setVerifyTarget(selectedRecord)}
                      disabled={verifyingId === selectedRecord.id}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg cursor-pointer transition-all shadow-xs"
                    >
                      Verify Now
                    </button>
                  ) : (
                    <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      Pending Master Admin Review
                    </span>
                  )}
                </div>
              )}

              {/* Modal Content - Scrollable */}
              <div className="p-4 sm:p-6 md:p-8 overflow-y-auto space-y-5 sm:space-y-6 flex-1 overscroll-contain">
                {/* 1. Patient & Upload Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {/* Barangay */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Barangay
                    </span>
                    <p className="text-sm font-black text-slate-800">{selectedRecord.barangay}</p>
                  </div>

                  {/* Purok */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Purok / Address
                    </span>
                    <p className="text-sm font-bold text-slate-800">{selectedRecord.purok || '—'}</p>
                  </div>

                  {/* Contact Number */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Contact #
                    </span>
                    <p className="text-sm font-bold font-mono text-slate-800">{selectedRecord.contactNumber || '—'}</p>
                  </div>

                  {/* Upload Date & Staff */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> Uploaded At
                    </span>
                    <p className="text-xs font-bold text-slate-800">{formatTimestamp(selectedRecord.uploadedAt)}</p>
                    <span className="text-[10px] text-slate-400 block">By: {selectedRecord.uploadedBy}</span>
                  </div>
                </div>

                {/* 2. Gallery of Whole Data Uploaded (All files & images) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          All Uploaded PCU Files ({selectedRecord.uploadedFiles.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Click any image to enlarge or click the delete button to permanently remove it from MySQL
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Files Gallery Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedRecord.uploadedFiles.map((file, idx) => {
                      const isImg = isImageFile(file.url, file.name);

                      return (
                        <div
                          key={idx}
                          className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between group hover:border-emerald-500/60 hover:shadow-md transition-all"
                        >
                          {/* File Preview */}
                          <div
                            onClick={() => {
                              if (isImg && file.url) {
                                setActiveLightboxIndex(idx);
                              } else if (file.url) {
                                window.open(file.url, '_blank');
                              }
                            }}
                            className="relative h-44 w-full bg-slate-200 cursor-pointer overflow-hidden flex items-center justify-center"
                          >
                            {isImg && file.url ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="text-center p-4 space-y-2">
                                <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                                <span className="text-xs font-bold text-slate-600 block">PDF / Document</span>
                              </div>
                            )}

                            {/* Top right delete button on file card (Master Admin only) */}
                            {isMasterAdmin && (
                              <button
                                type="button"
                                onClick={(e) => promptDeleteFile(e, selectedRecord, file, idx)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer z-10"
                                title="Permanently Delete This File from MySQL (Master Admin Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Overlay zoom indicator */}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="p-2 rounded-xl bg-white text-slate-900 shadow-md">
                                <ZoomIn className="w-4 h-4 text-emerald-700" />
                              </span>
                            </div>
                          </div>

                          {/* File Description Footer */}
                          <div className="p-3.5 bg-white space-y-2">
                            <p className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </p>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                              {/* DELETE BUTTON ON EACH SUBMITTED FILE (Master Admin only) */}
                              {isMasterAdmin ? (
                                <button
                                  type="button"
                                  onClick={(e) => promptDeleteFile(e, selectedRecord, file, idx)}
                                  className="inline-flex items-center gap-1 font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                                  title="Permanently Delete This File from MySQL (Master Admin Only)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete File</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 font-medium">Uploaded File</span>
                              )}

                              {file.url && (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={file.name}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                {isMasterAdmin ? (
                  <button
                    type="button"
                    onClick={(e) => promptDeleteRecord(e, selectedRecord)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Whole Submission</span>
                  </button>
                ) : (
                  <div className="text-xs text-slate-400 font-medium">
                    Contact Master Admin to delete or modify verified submissions
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* VERIFICATION CONFIRMATION POPUP CARD IN THE CENTER OF THE SCREEN          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {verifyTarget && (
          <div 
            className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => !verifyingId && setVerifyTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Center Verify Icon Badge with pulsing ring */}
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/15 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              {/* Title & Description Text */}
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Verify PCU Submission?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to verify this PCU record? It will be moved from{' '}
                  <strong className="text-amber-700">Pending</strong> to{' '}
                  <strong className="text-emerald-700">Verified</strong> and recorded in{' '}
                  <strong className="text-slate-800">cPanel MySQL</strong>.
                </p>
              </div>

              {/* Information Summary Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Patient:</span>
                  <span className="font-bold text-slate-800">{verifyTarget.fullName}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Barangay:</span>
                  <span className="font-semibold text-slate-700">{verifyTarget.barangay}</span>
                </div>
                {verifyTarget.purok && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                    <span className="text-slate-400 font-semibold">Purok / Address:</span>
                    <span className="font-semibold text-slate-700">{verifyTarget.purok}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Submitted By:</span>
                  <span className="font-bold text-slate-800">{verifyTarget.uploadedBy}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Attached Files:</span>
                  <span className="font-semibold text-slate-700">
                    {verifyTarget.filesCount || (verifyTarget.uploadedFiles ? verifyTarget.uploadedFiles.length : 1)} file(s)
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" /> Target Database:
                  </span>
                  <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md text-[11px]">
                    cPanel MySQL (pcu_submissions)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyTarget(null)}
                  disabled={verifyingId !== null}
                  className="w-1/2 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmVerification}
                  disabled={verifyingId !== null}
                  className="w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 active:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {verifyingId === verifyTarget.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Verify</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* CONFIRMATION POPUP CARD ON THE CENTER OF THE SCREEN                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deleteTarget && (
          <div 
            className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => !isDeleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Center Warning Icon Badge */}
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/15 ring-8 ring-rose-50">
                <AlertTriangle className="w-8 h-8" />
              </div>

              {/* Title & Warning Text */}
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {deleteTarget.isSingleFile ? 'Permanently Delete File?' : 'Permanently Delete Submission?'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are about to permanently remove this record from the clinic system and{' '}
                  <strong className="text-rose-700">cPanel MySQL database</strong>. This action cannot be undone.
                </p>
              </div>

              {/* Information Summary Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Patient:</span>
                  <span className="font-bold text-slate-800">{deleteTarget.record.fullName}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                  <span className="text-slate-400 font-semibold">Barangay:</span>
                  <span className="font-semibold text-slate-700">{deleteTarget.record.barangay}</span>
                </div>
                {deleteTarget.isSingleFile && deleteTarget.file && (
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60">
                    <span className="text-slate-400 font-semibold">Target File:</span>
                    <span className="font-bold text-rose-700 truncate max-w-[200px]" title={deleteTarget.file.name}>
                      {deleteTarget.file.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" /> Database:
                  </span>
                  <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md text-[11px]">
                    cPanel MySQL (pcu_submissions)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="w-1/2 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executePermanentDelete}
                  disabled={isDeleting}
                  className="w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:from-rose-800 active:to-red-800 text-white font-black text-xs shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* FULL SCREEN LIGHTBOX PREVIEW                                              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedRecord && activeLightboxIndex !== null && (
          <div
            className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setActiveLightboxIndex(null)}
          >
            {/* Lightbox Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10 pointer-events-auto">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-white">
                  {selectedRecord.uploadedFiles[activeLightboxIndex]?.name || 'PCU Document'}
                </h4>
                <p className="text-[11px] text-emerald-400 font-medium">
                  Image {activeLightboxIndex + 1} of {selectedRecord.uploadedFiles.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedRecord.uploadedFiles[activeLightboxIndex]?.url && (
                  <a
                    href={selectedRecord.uploadedFiles[activeLightboxIndex].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Open Full Resolution"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActiveLightboxIndex(null)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition-colors cursor-pointer"
                  title="Close Lightbox"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prev/Next buttons if multiple images */}
            {selectedRecord.uploadedFiles.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLightboxIndex(prev => 
                      prev! > 0 ? prev! - 1 : selectedRecord.uploadedFiles.length - 1
                    );
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveLightboxIndex(prev => 
                      prev! < selectedRecord.uploadedFiles.length - 1 ? prev! + 1 : 0
                    );
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Main Lightbox Image View */}
            <div className="max-w-5xl max-h-[85vh] p-2 flex items-center justify-center">
              <img
                src={selectedRecord.uploadedFiles[activeLightboxIndex]?.url}
                alt={selectedRecord.uploadedFiles[activeLightboxIndex]?.name}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
