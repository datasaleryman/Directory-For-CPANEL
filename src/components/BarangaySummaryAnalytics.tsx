import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { ExistingAccountItem } from '../types.js';

interface BarangayFolderData {
  barangay: string;
  count: number;
  verifiedCount: number;
  list: ExistingAccountItem[];
}

interface BarangaySummaryAnalyticsProps {
  barangayFolders: BarangayFolderData[];
  totalBarangaysInSystem?: number;
  onSelectBarangay: (barangay: string) => void;
  onSelectPurok?: (barangay: string, purok: string) => void;
  activeFolder?: string | null;
  activePurokFolder?: string | null;
}

function formatBarangayName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word === 'sta.' || word === 'sta') return 'Sta.';
      if (word === 'sto.' || word === 'sto') return 'Sto.';
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export const BarangaySummaryAnalytics: React.FC<BarangaySummaryAnalyticsProps> = ({
  barangayFolders,
  totalBarangaysInSystem = 296,
  onSelectBarangay,
  onSelectPurok,
  activeFolder,
  activePurokFolder
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'members' | 'puroks'>('all');

  // Compute detailed analytics metrics per barangay
  const barangayAnalytics = useMemo(() => {
    return barangayFolders.map(folder => {
      const totalMembers = folder.count;

      // Group puroks in this barangay
      const purokSet = new Set<string>();
      folder.list.forEach(item => {
        const rawP = (item.purok || '').trim();
        if (rawP) {
          purokSet.add(rawP.toUpperCase());
        }
      });

      const purokCount = Math.max(1, purokSet.size);

      return {
        rawName: folder.barangay,
        displayName: formatBarangayName(folder.barangay),
        totalMembers,
        purokCount,
        list: folder.list
      };
    });
  }, [barangayFolders]);

  // Overall totals
  const overallMetrics = useMemo(() => {
    const totalMembers = barangayAnalytics.reduce((sum, b) => sum + b.totalMembers, 0);
    const activeBarangaysCount = barangayAnalytics.length;
    const totalBarangaysDenom = Math.max(totalBarangaysInSystem, activeBarangaysCount, 296);

    return {
      totalMembers,
      activeBarangaysCount,
      totalBarangaysDenom
    };
  }, [barangayAnalytics, totalBarangaysInSystem]);

  // Sort based on active filter
  const sortedBarangays = useMemo(() => {
    const list = [...barangayAnalytics];
    if (filterMode === 'puroks') {
      list.sort((a, b) => b.purokCount - a.purokCount || b.totalMembers - a.totalMembers);
    } else {
      list.sort((a, b) => b.totalMembers - a.totalMembers || b.purokCount - a.purokCount);
    }
    return list;
  }, [barangayAnalytics, filterMode]);

  // Do not render if no folders exist
  if (barangayFolders.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
              Barangay Summary Analytics
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Overview of members and puroks across all folders
            </p>
          </div>
        </div>

        {/* Filter Pills & Collapse Toggle */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="bg-slate-100/90 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-white text-emerald-800 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Metrics
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('members')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'members'
                  ? 'bg-white text-emerald-800 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Members
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('puroks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === 'puroks'
                  ? 'bg-white text-emerald-800 shadow-xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Puroks
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 rounded-xl transition-all cursor-pointer"
            title={isExpanded ? 'Collapse Analytics' : 'Expand Analytics'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5 overflow-hidden"
          >
            {/* 2 Top Metric Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TOTAL BARANGAYS */}
              <div className="bg-slate-50/70 border border-slate-100/90 rounded-2xl p-5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  TOTAL BARANGAYS
                </p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
                    {overallMetrics.activeBarangaysCount}
                  </span>
                  <span className="text-lg font-bold text-slate-400">
                    /{overallMetrics.totalBarangaysDenom}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Active folders &amp; puroks
                </p>
              </div>

              {/* TOTAL MEMBERS */}
              <div className="bg-slate-50/70 border border-slate-100/90 rounded-2xl p-5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  TOTAL MEMBERS
                </p>
                <div className="mt-1.5">
                  <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
                    {overallMetrics.totalMembers.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Across all folders
                </p>
              </div>
            </div>

            {/* Barangay Grid Box */}
            <div className="border border-slate-100/90 rounded-2xl p-4 bg-white">
              <div className="max-h-[380px] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
                  {sortedBarangays.map(item => (
                    <div
                      key={item.rawName}
                      onClick={() => onSelectBarangay(item.rawName)}
                      className="bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-xs rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group select-none min-h-[72px]"
                      title={`Open Barangay ${item.displayName} (${item.totalMembers} Members, ${item.purokCount} Puroks)`}
                    >
                      <div className="font-bold text-slate-800 text-xs sm:text-sm truncate group-hover:text-emerald-700 transition-colors">
                        {item.displayName}
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(filterMode === 'all' || filterMode === 'members') && (
                          <span className="bg-emerald-50 text-emerald-600 border border-emerald-200/80 font-bold px-1.5 py-0.5 rounded text-[11px] leading-none whitespace-nowrap">
                            {item.totalMembers} M
                          </span>
                        )}
                        {(filterMode === 'all' || filterMode === 'puroks') && (
                          <span className="bg-amber-50 text-amber-600 border border-amber-200/80 font-bold px-1.5 py-0.5 rounded text-[11px] leading-none whitespace-nowrap">
                            {item.purokCount} P
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
