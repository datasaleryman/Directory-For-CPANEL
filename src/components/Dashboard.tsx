import React, { useState } from 'react';
import { 
  Users, 
  MapPin, 
  CalendarPlus, 
  UserPlus, 
  FileSpreadsheet, 
  Printer, 
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { DashboardStats } from '../types.js';

interface DashboardProps {
  stats: DashboardStats | null;
  onQuickAction: (action: 'add' | 'bulk' | 'print') => void;
  loading: boolean;
  authToken?: string | null;
  onSyncComplete?: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  stats, 
  onQuickAction, 
  loading,
  authToken,
  onSyncComplete,
  showToast
}) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Format Date in local friendly format
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Chart dataset based on Total Contacts, Total Addresses, and Added Today
  const chartData = [
    {
      name: 'Total Contacts',
      shortName: 'Contacts',
      value: stats?.totalContacts ?? 0,
      fill: '#10b981', // Emerald-500
      bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Total active directory records'
    },
    {
      name: 'Total Addresses',
      shortName: 'Addresses',
      value: stats?.totalAddresses ?? 0,
      fill: '#14b8a6', // Teal-500
      bgClass: 'bg-teal-50 text-teal-700 border-teal-200',
      description: 'Unique barangay classifications'
    },
    {
      name: 'Added Today',
      shortName: 'Added Today',
      value: stats?.contactsToday ?? 0,
      fill: '#f59e0b', // Amber-500
      bgClass: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'New records created today'
    }
  ];

  // Custom Recharts Tooltip Component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1">
          <p className="font-extrabold text-slate-200">{data.name}</p>
          <p className="text-lg font-black" style={{ color: data.fill }}>
            {data.value.toLocaleString()} <span className="text-xs font-normal text-slate-400">records</span>
          </p>
          <p className="text-[11px] text-slate-400">{data.description}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Minimalist Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Total Contacts Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex items-center justify-between shadow-xs transition-colors hover:border-slate-300">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Contacts
            </p>
            <h3 className="text-3xl font-bold text-slate-900 font-display tracking-tight tabular-nums leading-none">
              {loading ? (
                <span className="inline-block w-20 h-8 bg-slate-100 animate-pulse rounded" />
              ) : (
                stats?.totalContacts.toLocaleString() ?? '0'
              )}
            </h3>
            <p className="text-xs text-emerald-600 font-medium pt-1">
              Active directory records
            </p>
          </div>
          
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/50">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Total Addresses Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex items-center justify-between shadow-xs transition-colors hover:border-slate-300">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Addresses
            </p>
            <h3 className="text-3xl font-bold text-slate-900 font-display tracking-tight tabular-nums leading-none">
              {loading ? (
                <span className="inline-block w-20 h-8 bg-slate-100 animate-pulse rounded" />
              ) : (
                stats?.totalAddresses.toLocaleString() ?? '0'
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium pt-1">
              Barangay classifications
            </p>
          </div>
          
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/50">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* Contacts Added Today Card */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 flex items-center justify-between shadow-xs transition-colors hover:border-slate-300">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Added Today
            </p>
            <h3 className="text-3xl font-bold text-slate-900 font-display tracking-tight tabular-nums leading-none">
              {loading ? (
                <span className="inline-block w-20 h-8 bg-slate-100 animate-pulse rounded" />
              ) : (
                stats?.contactsToday ?? '0'
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium pt-1">
              Registered today
            </p>
          </div>
          
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/50">
            <CalendarPlus className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Shortcuts & Directory Metrics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Shortcuts / Quick Actions Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 font-display text-base tracking-tight">
              Quick Actions
            </h4>
            <p className="text-xs text-slate-500">
              Direct access to directory workflows
            </p>
          </div>

          <div className="space-y-3">
            {/* Add New Contact Shortcut */}
            <button
              onClick={() => onQuickAction('add')}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50/60 hover:bg-slate-100/70 border border-slate-200/80 rounded-lg transition-colors text-left cursor-pointer group focus:outline-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-white text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800">Add New Contact</span>
                  <span className="text-[11px] text-slate-500 truncate block">Register single active user</span>
                </div>
              </div>
            </button>

            {/* Bulk Entry Shortcut */}
            <button
              onClick={() => onQuickAction('bulk')}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50/60 hover:bg-slate-100/70 border border-slate-200/80 rounded-lg transition-colors text-left cursor-pointer group focus:outline-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-white text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800">Bulk Entry</span>
                  <span className="text-[11px] text-slate-500 truncate block">Paste and import multiple lines</span>
                </div>
              </div>
            </button>

            {/* Print List Shortcut */}
            <button
              onClick={() => onQuickAction('print')}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50/60 hover:bg-slate-100/70 border border-slate-200/80 rounded-lg transition-colors text-left cursor-pointer group focus:outline-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-white text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 shadow-xs">
                  <Printer className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800">Print List</span>
                  <span className="text-[11px] text-slate-500 truncate block">Print formatted contact book</span>
                </div>
              </div>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-400">
            Export tools are accessible in the Patient List tab.
          </div>
        </div>

        {/* Directory Statistics Chart Section */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col min-h-[420px] justify-between">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 font-display tracking-tight text-sm sm:text-base">
                  Directory Overview
                </h4>
                <p className="text-xs text-slate-400">
                  Distribution of contacts, addresses, and daily records
                </p>
              </div>
            </div>

            {/* Chart type toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium self-end sm:self-auto border border-slate-200/60">
              <button
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'bar'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'pie'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                Pie
              </button>
            </div>
          </div>

          {/* Chart Rendering Area */}
          <div className="my-2 flex-1 min-h-[260px] w-full flex items-center justify-center">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            ) : chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="shortName" 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

