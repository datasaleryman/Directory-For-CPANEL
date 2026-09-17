import React, { useState, useEffect, useMemo } from 'react';
import { Printer, X, Loader2, Activity, Search, Plus, Check, UserPlus, Save, ChevronLeft, ChevronRight, ArrowUpDown, ArrowDownAZ, ArrowUpZA, RotateCcw, Users, CheckCircle2, AlertCircle } from 'lucide-react';

export interface HouseholdItem {
  id: string | number;
  contactId?: string | number;
  full_name: string;
  barangay: string;
  purok?: string;
  contact_number?: string;
  created_at?: string;
  latitude?: number;
  longitude?: number;
  geotagged?: boolean;
  addedToDirectory?: boolean;
}

interface PrintPreviewProps {
  authToken: string;
  adminUser: string;
  onClose?: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  siteSettings: {
    title: string;
    faviconTitle: string;
    logoDataUrl: string;
    faviconDataUrl: string;
    navDashboard?: string;
    navDirectory?: string;
    navBulk?: string;
    navPrint?: string;
    navAdmins?: string;
    navSettings?: string;
  };
}

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

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  authToken,
  adminUser,
  onClose,
  showToast,
  siteSettings
}) => {
  const [households, setHouseholds] = useState<HouseholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | number | null>(null);
  const [datePrinted] = useState(() => new Date().toLocaleString());

  // Barangay selection list (used for manual contact addition)
  const [barangayList, setBarangayList] = useState<string[]>(DEFAULT_BARANGAYS);

  useEffect(() => {
    fetch('/api/public/barangays')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.barangays) && data.barangays.length > 0) {
          setBarangayList(data.barangays);
        }
      })
      .catch(() => {});
  }, []);

  // Search, Alphabetical Sort, and Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [alphabetSort, setAlphabetSort] = useState<'asc' | 'desc' | 'default'>('asc');
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(25);

  // Manual Add Contact Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newBarangay, setNewBarangay] = useState('Navalan');
  const [newPurok, setNewPurok] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [savingNewContact, setSavingNewContact] = useState(false);

  useEffect(() => {
    if (barangayList.length > 0 && (!newBarangay || newBarangay === 'Navalan')) {
      setNewBarangay(barangayList[0]);
    }
  }, [barangayList]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!newBarangay.trim()) {
      showToast('Barangay is required.', 'warning');
      return;
    }

    setSavingNewContact(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          barangay: newBarangay.trim(),
          purok: newPurok.trim(),
          contact_number: newContactNumber.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save new contact to database.');
      }

      // Add to local household list so it immediately appears in PRINT LIST
      const newHouseholdItem: HouseholdItem = {
        id: data.id || Date.now(),
        full_name: data.full_name,
        barangay: data.barangay,
        purok: data.purok,
        contact_number: data.contact_number,
        geotagged: true,
        addedToDirectory: true
      };

      setHouseholds(prev => [newHouseholdItem, ...prev]);

      showToast(`Contact "${data.full_name}" added to Print List & saved to database!`, 'success');

      // Reset & close modal
      setNewFullName('');
      setNewBarangay('');
      setNewPurok('');
      setNewContactNumber('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingNewContact(false);
    }
  };

  // Fetch Base44 Household Submissions for Print List page
  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/base44/households?_t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch household submissions for print list.');
      }
      setHouseholds(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouseholds();

    const handleRestore = () => {
      fetchHouseholds();
      setCurrentPage(1);
    };

    window.addEventListener('clinic-data-restored', handleRestore);
    return () => {
      window.removeEventListener('clinic-data-restored', handleRestore);
    };
  }, [authToken]);

  // Deduplicate households strictly by Full Name (case-insensitive)
  const uniqueHouseholds = useMemo(() => {
    const seenNames = new Set<string>();
    const result: HouseholdItem[] = [];
    for (const item of households || []) {
      const nameKey = (item.full_name || '').trim().toLowerCase();
      if (nameKey && !seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        result.push(item);
      }
    }
    return result;
  }, [households]);

  // Status filter: all, pending (not yet on PCU directory), or added (already on PCU directory)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'added'>('all');
  const [addingAll, setAddingAll] = useState(false);

  // Total count of records not yet added to PCU directory
  const unaddedCount = useMemo(() => {
    return uniqueHouseholds.filter(h => !h.addedToDirectory).length;
  }, [uniqueHouseholds]);

  // Filter household records based on status, search query and sort alphabetically
  const filteredHouseholds = useMemo(() => {
    let list = uniqueHouseholds.filter(item => {
      if (statusFilter === 'pending' && item.addedToDirectory) return false;
      if (statusFilter === 'added' && !item.addedToDirectory) return false;
      const q = searchQuery.toLowerCase();
      return (
        (item.full_name || '').toLowerCase().includes(q) ||
        (item.contact_number || '').toLowerCase().includes(q) ||
        (item.purok && item.purok.toLowerCase().includes(q)) ||
        (item.barangay && item.barangay.toLowerCase().includes(q))
      );
    });

    // Apply Full Name Alphabetical Sorting
    if (alphabetSort === 'asc') {
      list = [...list].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', undefined, { sensitivity: 'base' }));
    } else if (alphabetSort === 'desc') {
      list = [...list].sort((a, b) => (b.full_name || '').localeCompare(a.full_name || '', undefined, { sensitivity: 'base' }));
    }

    return list;
  }, [uniqueHouseholds, statusFilter, searchQuery, alphabetSort]);

  // Pagination calculation
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page to 1 whenever search query, sort, statusFilter, or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, alphabetSort, statusFilter, itemsPerPage]);

  const itemsPerPageNum = useMemo(() => {
    if (itemsPerPage === 'all') return Math.max(1, filteredHouseholds.length);
    return Number(itemsPerPage);
  }, [itemsPerPage, filteredHouseholds.length]);

  const totalPages = useMemo(() => {
    if (filteredHouseholds.length === 0) return 1;
    return Math.ceil(filteredHouseholds.length / itemsPerPageNum);
  }, [filteredHouseholds.length, itemsPerPageNum]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Reset active search & sort to default
  const handleResetFilters = () => {
    setSearchQuery('');
    setAlphabetSort('asc');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchQuery !== '' || alphabetSort !== 'asc' || statusFilter !== 'all';

  // Handle +Add List button click (promotes record to display on PCU / Barangay directory)
  const handleAddToList = async (item: HouseholdItem) => {
    setAddingId(item.id);
    try {
      const res = await fetch('/api/contacts/add-from-household', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: item.id,
          contactId: item.contactId,
          full_name: item.full_name,
          barangay: item.barangay,
          purok: item.purok,
          contact_number: item.contact_number,
          latitude: item.latitude,
          longitude: item.longitude,
          geotagged: item.geotagged
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add patient to directory.');
      }

      // Mark local item state as added
      setHouseholds(prev => prev.map(h => (h.id === item.id || h.full_name.trim().toLowerCase() === item.full_name.trim().toLowerCase()) ? { ...h, addedToDirectory: true } : h));

      showToast(
        `Added "${item.full_name}" to PCU / Barangay Directory under Barangay ${item.barangay}!`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingId(null);
    }
  };

  // Handle +Add All pending patients to PCU / Barangay directory
  const handleAddAllToList = async () => {
    if (addingAll || unaddedCount === 0) return;
    setAddingAll(true);
    try {
      const res = await fetch('/api/contacts/add-all-from-household', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add patients to directory.');
      }

      setHouseholds(prev => prev.map(h => ({ ...h, addedToDirectory: true })));
      showToast(
        `Successfully added ${data.addedCount || unaddedCount} patients to PCU / Barangay Directory!`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingAll(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
      
      {/* Interactive Toolbar - Hidden when printing */}
      <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 no-print">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-bold text-slate-800 text-lg font-display">Patient Data List & Directory Extractor</h4>
            <p className="text-xs text-slate-500">
              Sorted <strong className="text-emerald-700">Full Name Alphabetically (A-Z)</strong>. Click <strong className="text-emerald-700">+ Add List</strong> to display records on the PCU / Barangay page.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            {unaddedCount > 0 && (
              <button
                onClick={handleAddAllToList}
                disabled={addingAll}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                title="Add all pending patients to PCU / Barangay Directory"
              >
                {addingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                + Add All to PCU ({unaddedCount})
              </button>
            )}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              +Add Contact
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Trigger System Print
            </button>
          </div>
        </div>

        {/* Live Search & Alphabetical Controls */}
        {!loading && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap pb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Filter View:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Patients ({uniqueHouseholds.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Pending Action ({unaddedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('added')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'added'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                On PCU / Barangay ({uniqueHouseholds.length - unaddedCount})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Search Input */}
              <div className="relative sm:col-span-8">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search by full name, barangay, purok, or contact number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 placeholder-slate-400 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Full Name Alphabetical Sort */}
              <div className="relative sm:col-span-4">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-indigo-600">
                  {alphabetSort === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : alphabetSort === 'desc' ? <ArrowUpZA className="w-4 h-4" /> : <ArrowUpDown className="w-4 h-4" />}
                </span>
                <select
                  value={alphabetSort}
                  onChange={(e) => setAlphabetSort(e.target.value as 'asc' | 'desc' | 'default')}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 appearance-none cursor-pointer transition-all"
                >
                  <option value="asc">Name: Alphabetical (A → Z)</option>
                  <option value="desc">Name: Alphabetical (Z → A)</option>
                  <option value="default">Default (Database Order)</option>
                </select>
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-[10px]">
                  ▼
                </span>
              </div>
            </div>

            {/* Pagination Controls & Rows per page */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={15}>15 items per page</option>
                  <option value={20}>20 items per page</option>
                  <option value={25}>25 items per page</option>
                  <option value={50}>50 items per page</option>
                  <option value="all">All items ({filteredHouseholds.length})</option>
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer hover:underline mr-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Filters
                  </button>
                )}
                <span className="bg-emerald-100/70 text-emerald-900 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Total Patients: <strong className="text-emerald-800">{filteredHouseholds.length}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 no-print">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
          <p className="text-sm font-medium text-slate-600">Loading Patient Data List...</p>
        </div>
      ) : (
        /* Single Printable Document Sheet & Table */
        <div className="bg-white p-4 md:p-8 max-w-5xl mx-auto border border-slate-200/80 rounded-xl shadow-xs print:p-0 print:border-none print:shadow-none">
          {/* Print Letterhead Header */}
          <div className="border-b-4 border-emerald-700 pb-5 mb-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex items-center gap-4.5">
              <img 
                src={siteSettings.logoDataUrl || 'https://www.image2url.com/r2/default/images/1785037750375-501bcf0e-4b15-4e0e-8be2-610bc89d072e.png'} 
                alt="Clinic Logo" 
                className="w-16 h-16 object-contain rounded-xl bg-white border border-slate-200/50 p-1 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="text-center md:text-left">
                <h1 className="text-xl md:text-2xl font-extrabold uppercase tracking-wide text-slate-900 font-display">
                  {siteSettings.title ? siteSettings.title.toUpperCase() : 'SAINT FRANCIS CLINIC DIRECTORY'}
                </h1>
                <p className="text-[10px] md:text-xs font-bold text-emerald-700 uppercase tracking-widest mt-0.5">
                  Official Patient Data List & Directory Register
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                  Confidential Document • Internal Access Only
                </p>
              </div>
            </div>

            <div className="flex flex-row md:flex-col justify-between md:justify-start gap-4 md:gap-1.5 text-xs text-slate-500 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 w-full md:w-auto font-medium">
              <div className="space-y-0.5 text-left md:text-right">
                <p>Printed By: <strong className="text-slate-800 font-semibold">@{adminUser}</strong></p>
                <p>Date: <strong className="text-slate-800 font-semibold">{datePrinted}</strong></p>
              </div>
              <div className="space-y-0.5 text-right">
                <p>Selection: <strong className="text-slate-800 font-semibold">
                  {alphabetSort === 'asc' ? 'All Patients • Sorted A-Z' : alphabetSort === 'desc' ? 'All Patients • Sorted Z-A' : 'All Patients'}
                </strong></p>
                <p>Page: <strong className="text-slate-900 font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-200 text-xs">Page {currentPage} of {totalPages}</strong></p>
              </div>
            </div>
          </div>

          {/* Directory Single Print Table */}
          <div className="overflow-x-auto select-none print:overflow-visible">
            <table className="w-full text-left text-xs border-collapse min-w-[500px] print:min-w-0">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-800">
                  <th className="py-2.5 px-3 font-bold text-slate-800 w-12 text-center border border-slate-300">#</th>
                  <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300">
                    <div className="flex items-center gap-1">
                      <span>Full Name</span>
                      {alphabetSort === 'asc' && <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-600" />}
                      {alphabetSort === 'desc' && <ArrowUpZA className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300">Registered Address (Barangay)</th>
                  <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300 w-36">Contact Number</th>
                  <th className="py-2.5 px-3 font-bold text-slate-800 border border-slate-300 w-32 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredHouseholds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium border border-slate-300">
                      No patient records matched the specified search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHouseholds.map((item, index) => {
                    const isVisibleOnScreen = itemsPerPage === 'all' || (index >= (currentPage - 1) * itemsPerPageNum && index < currentPage * itemsPerPageNum);
                    
                    return (
                      <tr 
                        key={item.id} 
                        className={`${isVisibleOnScreen ? '' : 'hidden'} hover:bg-slate-50/50`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono border border-slate-300">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 border border-slate-300">
                          {item.full_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 border border-slate-300">
                          <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] mr-1.5 border border-emerald-200/60 no-print">
                            {item.barangay}
                          </span>
                          <span className="print:inline hidden">{item.barangay}</span>
                          {item.purok ? <span className="text-slate-500 text-[11px]">({item.purok})</span> : null}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800 border border-slate-300">
                          {item.contact_number || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-center border border-slate-300 no-print">
                          {item.addedToDirectory ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              On PCU List
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddToList(item)}
                              disabled={addingId === item.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] rounded-lg transition-all shadow-xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                              title={`Add ${item.full_name} to PCU / Barangay Directory under Barangay ${item.barangay}`}
                            >
                              {addingId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              + Add List
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Interactive Screen Pagination Controls (Next / Previous Page Numbers) */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <div className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filteredHouseholds.length === 0 ? 0 : (currentPage - 1) * itemsPerPageNum + 1}</strong> to <strong className="text-slate-800">{Math.min(currentPage * itemsPerPageNum, filteredHouseholds.length)}</strong> of <strong className="text-slate-800">{filteredHouseholds.length}</strong> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Page
              </button>

              <div className="flex items-center gap-1 px-2">
                <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200">
                  Page {currentPage} of {totalPages}
                </span>
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs"
              >
                Next Page
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Print Footer Page Number */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 font-medium">
            <p>Generated by Directory Management System • {siteSettings.title || 'Saint Francis Clinic Directory'}</p>
            <p className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded border border-slate-200 text-xs">
              Page {currentPage} of {totalPages}
            </p>
          </div>
        </div>
      )}

      {/* Manual +Add Contact Modal Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 font-display text-base">Add New Contact</h3>
                  <p className="text-[11px] text-slate-500">Will be displayed on Patient Data List and saved to database</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Juan De La Cruz"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Barangay <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newBarangay}
                    onChange={(e) => setNewBarangay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    {barangayList.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purok (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPurok}
                    onChange={(e) => setNewPurok(e.target.value)}
                    placeholder="e.g. Purok 3"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contact Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newContactNumber}
                  onChange={(e) => setNewContactNumber(e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={savingNewContact}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewContact}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-600/10 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {savingNewContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving to DB...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Contact & Add to List
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

