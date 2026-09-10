import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BadgeCheck,
  Search,
  MapPin,
  Phone,
  Calendar,
  X,
  User,
  CheckCircle,
  Clock,
  Printer,
  Shield,
  Filter,
  UserCheck,
  Check,
  Loader2,
  FileText,
  AlertCircle,
  Folder,
  FolderOpen,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  Upload,
  Paperclip,
  Plus,
  Grid,
  List
} from 'lucide-react';
import { ExistingAccountItem } from '../types.js';

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

interface MemberVerificationProps {
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: { username: string; role: string; displayName?: string; avatarDataUrl?: string; barangay?: string } | null;
}

export const MemberVerification: React.FC<MemberVerificationProps> = ({
  authToken,
  showToast,
  currentUser = null
}) => {
  const [items, setItems] = useState<ExistingAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'verified' | 'unverified'>('all');
  const [selectedItem, setSelectedItem] = useState<ExistingAccountItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add New File Popup States
  const [showAddNewFileModal, setShowAddNewFileModal] = useState(false);
  const [newFileBarangay, setNewFileBarangay] = useState('Kalingayan');
  const [newFileAttachments, setNewFileAttachments] = useState<{ fileName: string; fileData: string }[]>([]);
  const [newFileSaving, setNewFileSaving] = useState(false);

  // Folder-specific States
  const [activeBarangayFolder, setActiveBarangayFolder] = useState<string | null>(null);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [folderToDeleteTotal, setFolderToDeleteTotal] = useState<number>(0);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // Member-specific Delete States
  const [memberToDelete, setMemberToDelete] = useState<ExistingAccountItem | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Auto-set the barangay select box if we are currently inside an active folder
  useEffect(() => {
    if (showAddNewFileModal) {
      setNewFileBarangay(activeBarangayFolder || 'Kalingayan');
      setNewFileAttachments([]);
    }
  }, [showAddNewFileModal, activeBarangayFolder]);

  // Verification Form States
  const [formVerified, setFormVerified] = useState(false);
  const [formVisited, setFormVisited] = useState(false);
  const [verificationCategory, setVerificationCategory] = useState('Residency Check');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Fetch Existing Accounts data
  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/existing-accounts', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to retrieve existing accounts.');
      }
      const data = await res.json();
      setItems(data || []);
    } catch (err: any) {
      showToast(err.message || 'Error loading verification records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [authToken]);

  // Delete a complete Barangay Folder
  const handleConfirmDeleteFolder = async (barangay: string | null) => {
    if (!barangay) return;
    setDeletingFolder(true);
    try {
      const res = await fetch(`/api/existing-accounts/folder/${encodeURIComponent(barangay)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete folder.');
      }

      // Save deleted accounts back as drafts to VerificationEntry
      if (Array.isArray(data.deletedAccounts)) {
        try {
          const savedDraftsRaw = localStorage.getItem('sfc_verification_drafts');
          const currentDrafts = savedDraftsRaw ? JSON.parse(savedDraftsRaw) : [];
          
          const newDrafts = data.deletedAccounts.map((item: any) => ({
            id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${item.id}`,
            full_name: item.full_name || '',
            barangay: item.barangay || '',
            purok: item.purok || '',
            contact_number: item.contact_number || '',
            created_at: new Date().toISOString(),
            status: item.status || 'Residency Check'
          }));
          
          const updatedDrafts = [...currentDrafts, ...newDrafts];
          localStorage.setItem('sfc_verification_drafts', JSON.stringify(updatedDrafts));
          console.log(`[Drafts Restore] Restored ${newDrafts.length} deleted folder members back to VerificationEntry drafts.`);
        } catch (storageErr) {
          console.error('Failed to restore deleted folder members to drafts storage:', storageErr);
        }
      }

      showToast(`Barangay folder "${barangay}" has been successfully deleted. The data is now available again as drafts in Verification Entry.`, 'success');
      await fetchAccounts();
      setFolderToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Error deleting folder', 'error');
    } finally {
      setDeletingFolder(false);
    }
  };

  // Confirm deletion of individual member record
  const handleConfirmDeleteMember = async (id: string | number) => {
    if (!id) return;
    setDeletingMember(true);
    try {
      const res = await fetch(`/api/existing-accounts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete member.');
      }

      // Restore deleted account back as draft to VerificationEntry
      if (memberToDelete) {
        try {
          const savedDraftsRaw = localStorage.getItem('sfc_verification_drafts');
          const currentDrafts = savedDraftsRaw ? JSON.parse(savedDraftsRaw) : [];
          
          const newDrafts = [{
            id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${memberToDelete.id}`,
            full_name: memberToDelete.full_name || '',
            barangay: memberToDelete.barangay || '',
            purok: memberToDelete.purok || '',
            contact_number: memberToDelete.contact_number || '',
            created_at: new Date().toISOString(),
            status: memberToDelete.status || 'Residency Check'
          }];
          
          const updatedDrafts = [...currentDrafts, ...newDrafts];
          localStorage.setItem('sfc_verification_drafts', JSON.stringify(updatedDrafts));
          console.log(`[Drafts Restore] Restored deleted member back to VerificationEntry drafts.`);
        } catch (storageErr) {
          console.error('Failed to restore deleted member to drafts storage:', storageErr);
        }
      }

      showToast(`Member "${memberToDelete?.full_name}" has been successfully deleted and restored as draft in Verification Entry.`, 'success');
      setSelectedItem(null); // Close details modal if open
      setMemberToDelete(null);
      await fetchAccounts();
    } catch (err: any) {
      showToast(err.message || 'Error deleting member', 'error');
    } finally {
      setDeletingMember(false);
    }
  };

  // Open verification side-panel
  const handleOpenVerifier = (item: ExistingAccountItem) => {
    setSelectedItem(item);
    setFormVerified(item.existingAccVerified || false);
    setFormVisited(item.existingAccVisited || false);
    setVerificationCategory(item.status && item.status !== 'pending' && item.status !== 'approved' ? item.status : 'Residency Check');
    setVerificationNotes(item.pin || '');
  };

  // Save verification changes
  const handleSaveVerification = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const updatePayload = {
        ...selectedItem,
        existingAccVerified: true,
        existingAccVisited: true,
        status: verificationCategory,
        pin: verificationNotes.trim()
      };

      const res = await fetch(`/api/existing-accounts/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updatePayload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update member status.');
      }

      const updatedData = await res.json();
      showToast(`Successfully saved verification records for ${selectedItem.full_name}!`, 'success');
      
      // Update local cache
      setItems(prev => prev.map(item => item.id === selectedItem.id ? updatedData : item));
      setSelectedItem(null); // Close popup/panel automatically on save
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Upload PCU/Case document
  const handleFileUpload = async (file: File) => {
    if (!selectedItem) return;
    
    // Check file size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File is too large. Maximum size is 10MB.', 'error');
      return;
    }

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      
      const fileUploadPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });

      const base64DataUrl = await fileUploadPromise;

      const payload = {
        files: [
          {
            fileName: file.name,
            fileData: base64DataUrl
          }
        ]
      };

      const res = await fetch(`/api/existing-accounts/${selectedItem.id}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload document.');
      }

      const updatedAccount = await res.json();
      
      // Sync local states
      setItems(prev => prev.map(item => item.id === selectedItem.id ? updatedAccount : item));
      setSelectedItem(updatedAccount);
      showToast(`Document "${file.name}" uploaded successfully!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload document.', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // Delete attached document
  const handleDeleteFile = async (indexToDelete: number) => {
    if (!selectedItem) return;
    try {
      const remainingFiles = (selectedItem.uploadedFiles || []).filter((_, idx) => idx !== indexToDelete);
      
      const updatePayload = {
        ...selectedItem,
        uploadedFiles: remainingFiles
      };

      const res = await fetch(`/api/existing-accounts/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updatePayload)
      });

      if (!res.ok) {
        throw new Error('Failed to update files list.');
      }

      const updatedData = await res.json();
      setItems(prev => prev.map(item => item.id === selectedItem.id ? updatedData : item));
      setSelectedItem(updatedData);
      showToast('Document deleted successfully.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete document.', 'error');
    }
  };

  // Quick verify toggle from row
  const handleQuickVerify = async (e: React.MouseEvent, item: ExistingAccountItem) => {
    e.stopPropagation();
    try {
      const updatePayload = {
        ...item,
        existingAccVerified: !item.existingAccVerified
      };

      const res = await fetch(`/api/existing-accounts/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updatePayload)
      });

      if (!res.ok) {
        throw new Error('Quick verification update failed.');
      }

      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      showToast(
        updated.existingAccVerified 
          ? `Verified ${item.full_name} successfully!` 
          : `Removed verification flag for ${item.full_name}`, 
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const isSuperUser = useMemo(() => {
    if (!currentUser) return false;
    const roleUpper = (currentUser.role || '').toUpperCase();
    return ['MASTER ADMIN', 'IT', 'ADMIN', 'ADMINISTRATOR'].includes(roleUpper) || currentUser.username.toLowerCase() === 'admin';
  }, [currentUser]);

  // Only display the data added from the Add New File button, that has been saved to base44 database.
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const nameUpper = (item.full_name || '').toUpperCase();
      const isDoc = nameUpper.startsWith('VERIFICATION DOC');
      if (!isDoc) return false;

      // Filter by account if user is not superadmin
      if (currentUser && !isSuperUser) {
        const itemUser = (item.submittedBy || '').toLowerCase();
        const loggedInUser = currentUser.username.toLowerCase();
        return itemUser === loggedInUser;
      }
      return true;
    });
  }, [items, currentUser, isSuperUser]);

  // Dynamically group items into Barangay Folders
  const barangayFolders = useMemo(() => {
    const foldersMap: Record<string, { total: number; verified: number; visited: number }> = {};
    
    // Group existing accounts from the database
    filteredItems.forEach(item => {
      const bName = (item.barangay || 'UNSPECIFIED').toUpperCase().trim();
      if (!foldersMap[bName]) {
        foldersMap[bName] = { total: 0, verified: 0, visited: 0 };
      }
      foldersMap[bName].total += 1;
      if (item.existingAccVerified) foldersMap[bName].verified += 1;
      if (item.existingAccVisited) foldersMap[bName].visited += 1;
    });

    return Object.entries(foldersMap)
      .filter(([_, stats]) => stats.total > 0)
      .map(([name, stats]) => {
        const rate = stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;
        return {
          name,
          total: stats.total,
          verified: stats.verified,
          visited: stats.visited,
          rate
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredItems]);

  // Filter Barangay Folders based on folder search
  const filteredFolders = useMemo(() => {
    const query = folderSearchQuery.toUpperCase().trim();
    if (!query) return barangayFolders;
    return barangayFolders.filter(f => f.name.includes(query));
  }, [barangayFolders, folderSearchQuery]);

  // Global Statistics (Tracks all members inside directories)
  const globalStats = useMemo(() => {
    const total = filteredItems.length;
    const verified = filteredItems.filter(i => i.existingAccVerified).length;
    const unverified = total - verified;
    const visited = filteredItems.filter(i => i.existingAccVisited).length;
    const rate = total > 0 ? Math.round((verified / total) * 100) : 0;
    
    return { total, verified, unverified, visited, rate };
  }, [filteredItems]);

  // Active folder members (Includes all accounts in active folder)
  const folderMembers = useMemo(() => {
    if (!activeBarangayFolder) return [];
    return filteredItems.filter(item => {
      const bName = (item.barangay || 'UNSPECIFIED').toUpperCase().trim();
      return bName === activeBarangayFolder;
    });
  }, [filteredItems, activeBarangayFolder]);

  // Active folder filtered and searched members
  const filteredFolderMembers = useMemo(() => {
    return folderMembers.filter(item => {
      // Search matches
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        item.full_name.toLowerCase().includes(query) ||
        (item.contact_number && item.contact_number.includes(query)) ||
        (item.purok && item.purok.toLowerCase().includes(query));

      // Status matches
      let matchesStatus = true;
      if (selectedStatus === 'verified') {
        matchesStatus = !!item.existingAccVerified;
      } else if (selectedStatus === 'unverified') {
        matchesStatus = !item.existingAccVerified;
      }

      return matchesSearch && matchesStatus;
    });
  }, [folderMembers, searchQuery, selectedStatus]);

  // Active folder specific stats
  const activeFolderStats = useMemo(() => {
    const total = folderMembers.length;
    const verified = folderMembers.filter(i => i.existingAccVerified).length;
    const unverified = total - verified;
    const visited = folderMembers.filter(i => i.existingAccVisited).length;
    const rate = total > 0 ? Math.round((verified / total) * 100) : 0;
    
    return { total, verified, unverified, visited, rate };
  }, [folderMembers]);

  // Print Verification Badge Pass
  const handlePrintBadge = () => {
    if (!selectedItem) return;
    const win = window.open('', '_blank');
    if (!win) {
      showToast('Popup blocked! Please allow popups to print member passes.', 'error');
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>Member Verification Pass - Saint Francis Clinic</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f8fafc;
            }
            .badge-card {
              width: 380px;
              border: 2px solid #0d9488;
              border-radius: 16px;
              padding: 24px;
              background: white;
              box-shadow: 0 4px 15px rgba(0,0,0,0.08);
              position: relative;
              text-align: center;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .title {
              font-size: 18px;
              font-weight: 800;
              color: #115e59;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 11px;
              color: #0d9488;
              font-weight: 700;
              text-transform: uppercase;
              margin-top: 4px;
            }
            .avatar-placeholder {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: #f0fdfa;
              border: 2px solid #0d9488;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 16px auto;
              color: #115e59;
              font-size: 32px;
              font-weight: bold;
            }
            .member-name {
              font-size: 20px;
              font-weight: 800;
              color: #1e293b;
              margin: 0 0 8px 0;
            }
            .field-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 13px;
              border-bottom: 1px dashed #f1f5f9;
              padding-bottom: 4px;
            }
            .field-label {
              color: #64748b;
              font-weight: 600;
            }
            .field-val {
              color: #0f172a;
              font-weight: 700;
            }
            .verified-seal {
              display: inline-block;
              background: #ccfbf1;
              color: #115e59;
              padding: 6px 16px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 16px;
              border: 1px solid #99f6e4;
            }
            .footer-info {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 20px;
            }
            @media print {
              body { background: white; }
              .badge-card { box-shadow: none; border: 2px solid #0d9488; }
            }
          </style>
        </head>
        <body>
          <div class="badge-card">
            <div class="header">
              <div class="title">Saint Francis Clinic</div>
              <div class="subtitle">Official Verification Pass</div>
            </div>
            <div class="avatar-placeholder">
              ${selectedItem?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div class="member-name">${selectedItem?.full_name}</div>
            
            <div class="field-row">
              <span class="field-label">Barangay</span>
              <span class="field-val">${selectedItem?.barangay}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Purok</span>
              <span class="field-val">${selectedItem?.purok || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Contact No.</span>
              <span class="field-val">${selectedItem?.contact_number || 'N/A'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Verification Mode</span>
              <span class="field-val">${verificationCategory}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Verification Date</span>
              <span class="field-val">${new Date().toLocaleDateString()}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Unique Pass ID</span>
              <span class="field-val">SFC-VER-${selectedItem?.id || '0000'}</span>
            </div>

            <div class="verified-seal">✓ Verified Active Member</div>
            <div class="footer-info">Saint Francis Medical Directory System &bull; Secure Digital Archive</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {/* VIEW 1: Barangay Folders Grid View */}
        {activeBarangayFolder === null ? (
          <motion.div
            key="folders-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Barangay Folder Directory Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-950 font-display">Member Verification Folders</h3>
                  <p className="text-xs text-slate-500 mt-1">Select a folder to view and verify members in that specific directory.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={() => setShowAddNewFileModal(true)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-550 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add New File
                  </button>

                  <div className="relative min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Member folders..."
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                    />
                    {folderSearchQuery && (
                      <button
                        onClick={() => setFolderSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full"
                      >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                  <p className="text-xs font-semibold">Loading Member directory folder structures...</p>
                </div>
              ) : filteredFolders.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl max-w-md mx-auto p-6 space-y-3">
                  <Folder className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">No Member Folders Found</h4>
                    <p className="text-xs text-slate-500">
                      {folderSearchQuery 
                        ? 'Adjust your keyword to look for other folder names.'
                        : 'No member data has been registered to create member directories. Add members via Verification Entry first!'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredFolders.map((folder) => {
                    return (
                      <div
                        key={folder.name}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button') || target.closest('svg') || target.closest('path')) {
                            return;
                          }
                          setActiveBarangayFolder(folder.name);
                          setSearchQuery('');
                          setSelectedStatus('all');
                          setSelectedItem(null);
                        }}
                        className="group bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-200/60 hover:border-teal-500 p-5 text-left transition-all hover:shadow-md duration-200 flex flex-col justify-between h-44 cursor-pointer relative overflow-hidden"
                      >
                        {/* Interactive glow */}
                        <div className="absolute right-0 top-0 w-24 h-24 bg-teal-50 rounded-full blur-2xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex items-start justify-between">
                          <div className="p-3 bg-teal-50 group-hover:bg-teal-600 rounded-xl text-teal-600 group-hover:text-white transition-colors duration-200 border border-teal-100/50 group-hover:border-teal-600">
                            <Folder className="w-5 h-5 fill-current" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-teal-100/60 text-teal-800 border border-teal-200/40 px-2.5 py-0.5 rounded-full font-extrabold group-hover:scale-105 transition-transform">
                              {folder.rate}% Verified
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToDelete(folder.name);
                                setFolderToDeleteTotal(folder.total);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 border border-slate-250 hover:border-red-200 text-slate-500 rounded-lg transition-all cursor-pointer z-10"
                              title={`Delete Barangay ${folder.name} folder`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-xs font-extrabold text-slate-900 truncate group-hover:text-teal-700 transition-colors uppercase tracking-wide">
                            {folder.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-semibold">
                            {folder.total} {folder.total === 1 ? 'Patient Record' : 'Patient Records'}
                          </p>
                        </div>

                        <div className="w-full pt-2 border-t border-slate-200/50 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {folder.verified} Verified &bull; {folder.total - folder.verified} Pending
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* VIEW 2: Inside Active Barangay Folder View */
          <motion.div
            key="inside-folder-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Folder Header Breadcrumb */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveBarangayFolder(null)}
                  className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer"
                  title="Go back to Member folders"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Members</span>
                    <span>/</span>
                    <span className="text-teal-600">Folder</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-0.5 flex items-center gap-2 uppercase tracking-wide">
                    <FolderOpen className="w-5 h-5 text-teal-600 shrink-0 fill-teal-50" />
                    Barangay {activeBarangayFolder}
                  </h3>
                </div>
              </div>

              {/* Folder Progress Info */}
              <div className="flex items-center gap-4 bg-slate-50/70 border border-slate-100 px-4 py-2.5 rounded-xl self-start sm:self-auto text-xs">
                <div className="text-left font-semibold text-slate-600">
                  <span>Folder Progress: </span>
                  <span className="text-slate-900 font-extrabold">{activeFolderStats.verified}/{activeFolderStats.total} Verified</span>
                </div>
                <div className="w-20 bg-slate-200 rounded-full h-1.5">
                  <div className="bg-teal-600 h-1.5 rounded-full" style={{ width: `${activeFolderStats.rate}%` }} />
                </div>
                <span className="text-teal-700 font-extrabold text-[10px] bg-teal-100/50 px-2 py-0.5 rounded-md">{activeFolderStats.rate}%</span>
              </div>
            </div>

            {/* Folder Patient List */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Search & Status Filters */}
              <div className="p-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Folder Records</h4>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">Filter and click any member inside {activeBarangayFolder} to view complete details and verify.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1 flex items-center justify-center rounded-lg cursor-pointer transition-all ${
                          viewMode === 'grid' 
                            ? 'bg-teal-600 text-white font-bold' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                        title="Grid View"
                      >
                        <Grid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-1 flex items-center justify-center rounded-lg cursor-pointer transition-all ${
                          viewMode === 'table' 
                            ? 'bg-teal-600 text-white font-bold' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                        title="List View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => setShowAddNewFileModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-550 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add New File
                    </button>

                    <button 
                      onClick={fetchAccounts}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh List
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search patients in this folder by name, contact, purok..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl transition-all text-xs outline-none text-slate-800 font-semibold"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Status Pills inside folder */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {([
                    { id: 'all', label: 'All records', count: activeFolderStats.total },
                    { id: 'verified', label: 'Verified', count: activeFolderStats.verified },
                    { id: 'unverified', label: 'Pending', count: activeFolderStats.unverified }
                  ] as const).map((tab) => {
                    const isActive = selectedStatus === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedStatus(tab.id as any)}
                        className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase transition-all cursor-pointer border ${
                          isActive 
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                      >
                        {tab.label}
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          isActive ? 'bg-teal-850 text-teal-100' : 'bg-slate-200/80 text-slate-600'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Patient List Content */}
              <div className="overflow-x-auto">
                {filteredFolderMembers.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3 px-6 text-center max-w-sm mx-auto">
                    <AlertCircle className="w-8 h-8 text-slate-300 animate-pulse" />
                    <p className="text-xs font-bold text-slate-700">No Patient Records Found</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      No matches found for your search query. Try typing another keyword or selecting a different status filter.
                    </p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-5 bg-slate-50/30">
                    {filteredFolderMembers.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const hasFiles = item.uploadedFiles && item.uploadedFiles.length > 0;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleOpenVerifier(item)}
                          className={`bg-white rounded-2xl border border-slate-200 hover:border-teal-500 p-5 transition-all hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 relative ${
                            isSelected ? 'ring-2 ring-teal-500 bg-teal-50/10' : ''
                          }`}
                        >
                          {/* Top Card Info: Avatar and Name */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm border border-slate-200/50">
                                {item.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-left">
                                <h4 className="font-extrabold text-slate-900 text-sm tracking-wide line-clamp-1">{item.full_name}</h4>
                              </div>
                            </div>
                          </div>

                          {/* Three Main Grid-Style Blocks: Attachment, Barangay, Submitted by */}
                          <div className="space-y-2.5 pt-3 border-t border-slate-100">
                            {/* 1. Attachment section with Visual Image/Thumb Grid */}
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2 block">
                                <Paperclip className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                Attachments
                              </span>
                              {hasFiles ? (
                                <div className="grid grid-cols-3 gap-1.5 mt-1">
                                  {item.uploadedFiles!.map((file, fIdx) => {
                                    const isImg = file.url && (
                                      /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name || '') ||
                                      file.url.startsWith('data:image/') ||
                                      file.url.includes('images') ||
                                      file.url.startsWith('blob:')
                                    );
                                    return (
                                      <div key={fIdx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group/thumb shrink-0">
                                        {isImg ? (
                                          <img
                                            src={file.url}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-150">
                                            <FileText className="w-4 h-4 text-slate-500" />
                                            <span className="text-[8px] font-bold">PDF</span>
                                          </div>
                                        )}
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="absolute inset-0 bg-teal-900/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white text-[8px] font-bold transition-opacity duration-155"
                                        >
                                          View
                                        </a>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 font-semibold mt-1 italic">No attachments</p>
                              )}
                            </div>

                            {/* 2 & 3: Barangay and Submitted by Side-by-Side Grid columns */}
                            <div className="grid grid-cols-2 gap-2.5">
                              {/* Barangay Section */}
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                  Barangay
                                </span>
                                <p className="text-[11px] font-extrabold text-slate-800 mt-1.5 uppercase truncate" title={item.barangay}>
                                  {item.barangay}
                                </p>
                              </div>

                              {/* Submitted by Section */}
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                  Submitted by
                                </span>
                                <p className="text-[11px] font-extrabold text-slate-800 mt-1.5 truncate" title={item.submittedBy || 'System Encoder'}>
                                  {item.submittedBy || 'System Encoder'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Footer Actions row */}
                          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenVerifier(item)}
                              className="flex-1 py-2 bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 font-extrabold text-[10px] rounded-xl transition-all cursor-pointer text-center"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => setMemberToDelete(item)}
                              className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-650 border border-slate-200/50 hover:border-red-200 text-slate-500 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3 px-5">Member / File</th>
                        <th className="py-3 px-5">Attachment</th>
                        <th className="py-3 px-5">Barangay</th>
                        <th className="py-3 px-5">Submitted By</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredFolderMembers.map((item) => {
                        const isSelected = selectedItem?.id === item.id;
                        const hasFiles = item.uploadedFiles && item.uploadedFiles.length > 0;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => handleOpenVerifier(item)}
                            className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                              isSelected ? 'bg-teal-50/30 font-bold' : ''
                            }`}
                          >
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                                  {item.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="truncate max-w-[180px]">
                                  <p className="font-extrabold text-slate-900 truncate" title={item.full_name}>
                                    {item.full_name}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-5">
                              {hasFiles ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.uploadedFiles!.map((file, fIdx) => {
                                    const isImg = file.url && (
                                      /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name || '') ||
                                      file.url.startsWith('data:image/') ||
                                      file.url.includes('images') ||
                                      file.url.startsWith('blob:')
                                    );
                                    return (
                                      <div key={fIdx} className="relative w-8 h-8 rounded border border-slate-200 overflow-hidden bg-slate-100 group/table-thumb shrink-0">
                                        {isImg ? (
                                          <img
                                            src={file.url}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-150">
                                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                                          </div>
                                        )}
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="absolute inset-0 bg-teal-900/60 opacity-0 group-hover/table-thumb:opacity-100 flex items-center justify-center text-white text-[7px] font-bold transition-opacity duration-150"
                                        >
                                          View
                                        </a>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold italic">No attachment</span>
                              )}
                            </td>

                            <td className="py-3.5 px-5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                {item.barangay}
                              </span>
                            </td>

                            <td className="py-3.5 px-5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 truncate max-w-[150px]">
                                <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                {item.submittedBy || 'System Encoder'}
                              </span>
                            </td>

                            <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenVerifier(item)}
                                  className="px-2.5 py-1.5 bg-slate-150 hover:bg-teal-600 hover:text-white text-slate-700 font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => setMemberToDelete(item)}
                                  className="p-1.5 bg-slate-150 hover:bg-red-50 hover:text-red-650 border border-transparent hover:border-red-100 text-slate-500 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Centered Popup Card Details Modal */}
            <AnimatePresence>
              {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedItem(null)}
                    className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
                  />

                  {/* Modal Card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="relative w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-lg border border-teal-100">
                          <FileText className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 leading-none">
                            Member Verification Details
                          </h3>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Submission Details: 2 columns in 1 row */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                          Submission Metadata
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Barangay Details Card */}
                          <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-100 flex items-start gap-3">
                            <div className="p-2 bg-white border border-slate-150 rounded-lg text-teal-600 shadow-xs">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Barangay</span>
                              <span className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">
                                {selectedItem.barangay}
                              </span>
                            </div>
                          </div>

                          {/* Submitted By Details Card */}
                          <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-100 flex items-start gap-3">
                            <div className="p-2 bg-white border border-slate-150 rounded-lg text-teal-600 shadow-xs">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Submitted By</span>
                              <span className="text-sm font-extrabold text-slate-800 block truncate">
                                {selectedItem.submittedBy || 'System Encoder'}
                              </span>
                              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                Uploaded on: {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Attachments Section Below */}
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Attachments
                          </h4>
                          <div>
                            <input
                              type="file"
                              id="member-detail-file-upload-instant"
                              className="hidden"
                              multiple
                              disabled={uploadingFile}
                              onChange={async (e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  for (const file of Array.from(e.target.files)) {
                                    await handleFileUpload(file as any);
                                  }
                                  e.target.value = '';
                                }
                              }}
                            />
                            <label
                              htmlFor="member-detail-file-upload-instant"
                              className={`flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-extrabold text-[11px] rounded-xl transition-colors cursor-pointer border border-teal-200/40 shadow-2xs ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              {uploadingFile ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                              ) : (
                                <Upload className="w-3.5 h-3.5 text-teal-600" />
                              )}
                              Upload File
                            </label>
                          </div>
                        </div>
                        {selectedItem.uploadedFiles && selectedItem.uploadedFiles.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[480px] overflow-y-auto pr-1">
                            {selectedItem.uploadedFiles.map((file, idx) => {
                              const isImage = file.url && (
                                /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name || '') ||
                                file.url.startsWith('data:image/') ||
                                file.url.includes('images') ||
                                file.url.startsWith('blob:')
                              );
                              return (
                                <div
                                  key={idx}
                                  className="flex flex-col justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-2xl hover:border-teal-200 hover:bg-teal-50/10 transition-all text-xs space-y-3 shadow-2xs overflow-hidden"
                                >
                                  {isImage ? (
                                    <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/50 group/img">
                                      <img
                                        src={file.url}
                                        alt={file.name}
                                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-36 rounded-xl bg-slate-150 text-slate-400 border border-slate-200/50">
                                      <FileText className="w-8 h-8 text-slate-300 mb-1" />
                                      <span className="text-[10px] font-bold text-slate-400">PDF Document</span>
                                    </div>
                                  )}

                                  <div className="flex items-start gap-2.5">
                                    <div className="p-1.5 bg-white border border-slate-150 rounded-xl text-teal-600 shrink-0 shadow-2xs">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="truncate text-left flex-1 min-w-0">
                                      <span className="font-extrabold text-slate-800 block truncate text-xs" title={file.name}>
                                        {file.name}
                                      </span>
                                      {file.uploadedAt && (
                                        <span className="text-[9px] text-slate-400 block font-bold mt-0.5">
                                          {new Date(file.uploadedAt).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/40">
                                    <a
                                      href={file.url}
                                      download
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 py-1.5 bg-white hover:bg-teal-50 border border-teal-200 text-teal-700 hover:text-teal-800 font-extrabold text-center rounded-lg transition-colors shadow-2xs text-[10px]"
                                    >
                                      View
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteFile(idx)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                      title="Delete file"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 bg-slate-50/50">
                            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                            <p className="text-xs font-bold text-slate-500">No attached files</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Modal Action Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                      <button
                        onClick={() => setMemberToDelete(selectedItem)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-700 border border-red-100 hover:border-red-200 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Member
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handlePrintBadge}
                          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-250 hover:border-slate-300 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                          Print Pass
                        </button>
                        <button
                          onClick={() => setSelectedItem(null)}
                          className="px-5 py-2 bg-teal-600 hover:bg-teal-550 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Folder Confirmation Modal */}
      <AnimatePresence>
        {folderToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="delete-folder-modal-container">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFolderToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              id="delete-folder-modal-backdrop"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-6"
              id="delete-folder-modal-card"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-none">
                    Delete Barangay Folder?
                  </h3>
                  <p className="text-[11px] text-red-600 font-bold mt-1 uppercase tracking-wider">
                    Irreversible Action
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Are you sure you want to delete the <span className="font-extrabold text-slate-950 uppercase">Barangay {folderToDelete}</span> folder?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will permanently delete the folder along with all <span className="font-bold text-slate-800">{folderToDeleteTotal} patient records</span> and verification logs associated with it. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setFolderToDelete(null)}
                  disabled={deletingFolder}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  id="cancel-delete-folder-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmDeleteFolder(folderToDelete)}
                  disabled={deletingFolder}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  id="confirm-delete-folder-btn"
                >
                  {deletingFolder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Folder
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Member Confirmation Modal */}
      <AnimatePresence>
        {memberToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="delete-member-modal-container">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMemberToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              id="delete-member-modal-backdrop"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-6"
              id="delete-member-modal-card"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-none">
                    Delete Member Record?
                  </h3>
                  <p className="text-[11px] text-red-600 font-bold mt-1 uppercase tracking-wider">
                    Irreversible Action
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Are you sure you want to delete the record for <span className="font-extrabold text-slate-950 uppercase">{memberToDelete.full_name}</span>?
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will permanently delete this member record, any uploaded files, and verification logs. The member will be removed from the Barangay folder. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setMemberToDelete(null)}
                  disabled={deletingMember}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  id="cancel-delete-member-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmDeleteMember(memberToDelete.id)}
                  disabled={deletingMember}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  id="confirm-delete-member-btn"
                >
                  {deletingMember ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Record
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New File Modal */}
      <AnimatePresence>
        {showAddNewFileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="add-new-file-modal-container">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!newFileSaving) setShowAddNewFileModal(false);
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
              id="add-new-file-modal-backdrop"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10 space-y-6 flex flex-col"
              id="add-new-file-modal-card"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl border border-teal-100">
                    <Plus className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 leading-none">
                      Add New File
                    </h3>
                    <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-wider">
                      Upload Barangay Member Attachments
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddNewFileModal(false)}
                  disabled={newFileSaving}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  id="add-new-file-close-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <div className="space-y-4">
                {/* Barangay Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Barangay Selection
                  </label>
                  <select
                    value={newFileBarangay}
                    onChange={(e) => setNewFileBarangay(e.target.value)}
                    disabled={newFileSaving}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl text-xs outline-none text-slate-700 font-semibold"
                    id="add-new-file-barangay-select"
                  >
                    {DEFAULT_BARANGAYS.map((brgy) => (
                      <option key={brgy} value={brgy}>
                        {brgy}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attachment Upload Box */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Attachment (Multiple Files)
                  </label>
                  
                  <label
                    htmlFor="add-new-file-input"
                    className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center ${
                      newFileSaving
                        ? 'opacity-50 pointer-events-none'
                        : 'border-slate-200 hover:border-teal-400 bg-slate-50/40 hover:bg-slate-50'
                    }`}
                    id="add-new-file-upload-label"
                  >
                    <input
                      type="file"
                      id="add-new-file-input"
                      className="hidden"
                      multiple
                      onChange={async (e) => {
                        if (e.target.files) {
                          const fileList = Array.from(e.target.files);
                          const loadedFiles: { fileName: string; fileData: string }[] = [];
                          for (const f of fileList) {
                            try {
                              const reader = new FileReader();
                              const fileData = await new Promise<string>((resolve, reject) => {
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.onerror = () => reject(reader.error);
                                reader.readAsDataURL(f as any);
                              });
                              loadedFiles.push({ fileName: (f as any).name, fileData });
                            } catch (err) {
                              console.error('File reading failed:', err);
                            }
                          }
                          setNewFileAttachments(prev => [...prev, ...loadedFiles]);
                        }
                      }}
                      disabled={newFileSaving}
                    />
                    <div className="flex flex-col items-center space-y-1">
                      <div className="p-1.5 bg-white shadow-xs rounded-lg border border-slate-150 text-slate-400">
                        <Upload className="w-5 h-5 text-teal-600" />
                      </div>
                      <p className="text-[11px] font-bold text-slate-700">
                        Click to select or drag files to upload
                      </p>
                      <p className="text-[9px] text-slate-400">
                        Select multiple attachments (images, PDFs)
                      </p>
                    </div>
                  </label>
                </div>

                {/* List of currently attached files */}
                {newFileAttachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Staged Attachments ({newFileAttachments.length})
                    </span>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1" id="add-new-file-staged-list">
                      {newFileAttachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span className="font-semibold text-slate-700 truncate" title={att.fileName}>
                              {att.fileName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewFileAttachments(prev => prev.filter((_, i) => i !== idx));
                            }}
                            disabled={newFileSaving}
                            className="p-1 text-slate-400 hover:text-rose-650 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddNewFileModal(false)}
                  disabled={newFileSaving}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-150 disabled:opacity-50 text-slate-700 font-extrabold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  id="add-new-file-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newFileBarangay) {
                      showToast('Please select a Barangay.', 'error');
                      return;
                    }
                    if (newFileAttachments.length === 0) {
                      showToast('Please attach at least one document.', 'error');
                      return;
                    }

                    setNewFileSaving(true);
                    try {
                      const payload = {
                        full_name: `Verification Doc - ${new Date().toLocaleDateString()}`,
                        barangay: newFileBarangay,
                        purok: '',
                        contact_number: '',
                        existingAccVerified: true,
                        status: 'approved',
                        files: newFileAttachments
                      };

                      const res = await fetch('/api/existing-accounts', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify(payload)
                      });

                      if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error || 'Failed to save attachments.');
                      }

                      showToast('Attachments saved permanently to Base44 and stored successfully!', 'success');
                      setShowAddNewFileModal(false);
                      await fetchAccounts();
                    } catch (err: any) {
                      showToast(err.message || 'Error saving new file attachments.', 'error');
                    } finally {
                      setNewFileSaving(false);
                    }
                  }}
                  disabled={newFileSaving}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-400 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-500/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  id="add-new-file-save-btn"
                >
                  {newFileSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving permanently...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Save File
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
