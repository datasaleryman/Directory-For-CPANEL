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

  // Stagger Container Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 14 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* 3D Visual Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Contacts Card */}
        <motion.div 
          variants={itemVariants}
          whileHover={{ y: -6, shadow: "0 20px 40px rgba(0,0,0,0.08)" }}
          className="bg-white border border-slate-100 rounded-3xl p-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group transition-shadow duration-300"
        >
          <div className="space-y-2.5 z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Total Contacts
            </p>
            <h3 className="text-4xl font-extrabold text-slate-800 font-display tracking-tight leading-none">
              {loading ? (
                <span className="inline-block w-20 h-9 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                stats?.totalContacts.toLocaleString() ?? '0'
              )}
            </h3>
            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50/50 w-fit px-2.5 py-1 rounded-full border border-emerald-100/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Secure Active Directory
            </p>
          </div>
          
          {/* Volumetric 3D Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shrink-0 z-10 shadow-[0_8px_20px_rgba(16,185,129,0.3),inset_0_-3px_0_rgba(0,0,0,0.2),inset_0_1.5px_1px_rgba(255,255,255,0.4)] border border-emerald-400/20 transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <Users className="w-6 h-6 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.25)]" />
          </div>
          
          {/* Corner Floating Emblem Backing */}
          <div className="absolute right-0 bottom-0 w-36 h-36 bg-gradient-to-br from-emerald-100/5 to-emerald-200/10 rounded-full translate-x-12 translate-y-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
        </motion.div>

        {/* Total Addresses Card */}
        <motion.div 
          variants={itemVariants}
          whileHover={{ y: -6, shadow: "0 20px 40px rgba(0,0,0,0.08)" }}
          className="bg-white border border-slate-100 rounded-3xl p-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group transition-shadow duration-300"
        >
          <div className="space-y-2.5 z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Total Addresses
            </p>
            <h3 className="text-4xl font-extrabold text-slate-800 font-display tracking-tight leading-none">
              {loading ? (
                <span className="inline-block w-20 h-9 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                stats?.totalAddresses.toLocaleString() ?? '0'
              )}
            </h3>
            <p className="text-xs text-teal-600 font-semibold flex items-center gap-1.5 bg-teal-50/50 w-fit px-2.5 py-1 rounded-full border border-teal-100/50">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
              Unique Classifications
            </p>
          </div>
          
          {/* Volumetric 3D Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white flex items-center justify-center shrink-0 z-10 shadow-[0_8px_20px_rgba(20,184,166,0.3),inset_0_-3px_0_rgba(0,0,0,0.2),inset_0_1.5px_1px_rgba(255,255,255,0.4)] border border-teal-400/20 transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <MapPin className="w-6 h-6 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.25)]" />
          </div>
          
          <div className="absolute right-0 bottom-0 w-36 h-36 bg-gradient-to-br from-teal-100/5 to-teal-200/10 rounded-full translate-x-12 translate-y-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
        </motion.div>

        {/* Contacts Added Today Card */}
        <motion.div 
          variants={itemVariants}
          whileHover={{ y: -6, shadow: "0 20px 40px rgba(0,0,0,0.08)" }}
          className="bg-white border border-slate-100 rounded-3xl p-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group transition-shadow duration-300"
        >
          <div className="space-y-2.5 z-10">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Added Today
            </p>
            <h3 className="text-4xl font-extrabold text-slate-800 font-display tracking-tight leading-none">
              {loading ? (
                <span className="inline-block w-20 h-9 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                stats?.contactsToday ?? '0'
              )}
            </h3>
            <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5 bg-amber-50/50 w-fit px-2.5 py-1 rounded-full border border-amber-100/50">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Since 12:00 AM
            </p>
          </div>
          
          {/* Volumetric 3D Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 z-10 shadow-[0_8px_20px_rgba(245,158,11,0.3),inset_0_-3px_0_rgba(0,0,0,0.2),inset_0_1.5px_1px_rgba(255,255,255,0.4)] border border-amber-400/20 transform group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
            <CalendarPlus className="w-6 h-6 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.25)]" />
          </div>
          
          <div className="absolute right-0 bottom-0 w-36 h-36 bg-gradient-to-br from-amber-100/5 to-amber-200/10 rounded-full translate-x-12 translate-y-12 group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
        </motion.div>
      </div>

      {/* Main Grid: Shortcuts & Directory Metrics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Shortcuts / Quick Actions Panel */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col justify-between space-y-6"
        >
          <div className="space-y-1.5">
            <h4 className="font-extrabold text-slate-800 font-display text-lg tracking-tight">
              Quick Shortcuts
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              One-click entry points to critical directory modules
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Add New Contact Shortcut */}
            <motion.button
              onClick={() => onQuickAction('add')}
              whileHover={{ scale: 1.025, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50/50 to-slate-50 border border-slate-200/60 rounded-2xl transition-all text-left cursor-pointer group hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/40 focus:outline-none"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* 3D Icon */}
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(99,102,241,0.25),inset_0_-2px_0_rgba(0,0,0,0.2)] border border-indigo-400/20 group-hover:rotate-6 transition-transform">
                  <UserPlus className="w-5 h-5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.2)]" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">Add New Contact</span>
                  <span className="text-xs text-slate-400 font-medium truncate block">Register single active user</span>
                </div>
              </div>
            </motion.button>

            {/* Bulk Entry Shortcut */}
            <motion.button
              onClick={() => onQuickAction('bulk')}
              whileHover={{ scale: 1.025, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50/50 to-slate-50 border border-slate-200/60 rounded-2xl transition-all text-left cursor-pointer group hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/40 focus:outline-none"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* 3D Icon */}
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(16,185,129,0.25),inset_0_-2px_0_rgba(0,0,0,0.2)] border border-emerald-400/20 group-hover:rotate-6 transition-transform">
                  <FileSpreadsheet className="w-5 h-5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.2)]" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">Bulk Entry</span>
                  <span className="text-xs text-slate-400 font-medium truncate block">Paste and import multiple lines</span>
                </div>
              </div>
            </motion.button>

            {/* Print List Shortcut */}
            <motion.button
              onClick={() => onQuickAction('print')}
              whileHover={{ scale: 1.025, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50/50 to-slate-50 border border-slate-200/60 rounded-2xl transition-all text-left cursor-pointer group hover:border-slate-300 hover:shadow-md hover:shadow-slate-100/40 focus:outline-none"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* 3D Icon */}
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(245,158,11,0.25),inset_0_-2px_0_rgba(0,0,0,0.2)] border border-amber-400/20 group-hover:rotate-6 transition-transform">
                  <Printer className="w-5 h-5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.2)]" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">Print List</span>
                  <span className="text-xs text-slate-400 font-medium truncate block">Print formatted contact book</span>
                </div>
              </div>
            </motion.button>
          </div>

          <div className="bg-emerald-50/20 border border-emerald-50 rounded-2xl p-4 text-center text-xs text-emerald-800/80 font-medium">
            Export tools are accessible in the Saint Francis Clinic Directory page.
          </div>
        </motion.div>

        {/* Directory Statistics Chart Section (Replaces Recent Admin Activities) */}
        <motion.div 
          variants={itemVariants}
          className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col min-h-[460px] justify-between"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 font-display tracking-tight text-base sm:text-lg">
                  Directory Overview Chart
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  Real-time visual comparison: Contacts, Addresses & Additions
                </p>
              </div>
            </div>

            {/* Chart type toggle */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl text-xs font-bold self-end sm:self-auto">
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'bar'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Bar
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartType === 'pie'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                Pie
              </button>
            </div>
          </div>

          {/* Chart Rendering Area */}
          <div className="my-2 flex-1 min-h-[280px] w-full flex items-center justify-center">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            ) : chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="shortName" 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} maxBarSize={60}>
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
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={6}
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
        </motion.div>
      </div>
    </motion.div>
  );
};

