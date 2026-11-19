import { useState } from 'react';
import {
  LayoutDashboard, Calendar, Database, Settings,
  LogOut, ChevronLeft, ChevronRight,
  RefreshCw, FileSpreadsheet, Download,
  Printer, Sun, Moon, Lock, Sparkles, Zap, CheckCircle2,
  GraduationCap
} from 'lucide-react';
import type { User, UserRole } from '../types/auth';

interface SidebarProps {
  currentView: 'DASHBOARD' | 'TIMETABLE' | 'INPUT_STUDIO' | 'CURRICULUM' | 'SETTINGS';
  onSelectView: (view: 'DASHBOARD' | 'TIMETABLE' | 'INPUT_STUDIO' | 'CURRICULUM' | 'SETTINGS') => void;
  currentUser: User;
  onRoleSwitch?: (role: UserRole) => void;
  onLogout: () => void;
  validatorStatus: { isValid: boolean };
  // Optimization Profile & Actions
  activeProfile: string;
  onSelectProfile: (profile: string) => void;
  onReoptimize: () => void;
  isSolving: boolean;
  // Theme Toggle
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  // Active Filter for Context-Aware Export
  activeEntityId?: string;
  viewType?: 'GROUP' | 'FACULTY' | 'ROOM';
  onOpenPrintModal?: () => void;
}

export function Sidebar({
  currentView,
  onSelectView,
  currentUser,
  onRoleSwitch: _onRoleSwitch,
  onLogout,
  validatorStatus: _validatorStatus,
  activeProfile,
  onSelectProfile,
  onReoptimize,
  isSolving,
  theme,
  onToggleTheme,
  activeEntityId,
  viewType,
  onOpenPrintModal,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isDark = theme === 'dark';

  const handleDownload = (endpoint: string, filename: string) => {
    let url = endpoint;
    if (endpoint.includes('/api/export/csv') && activeEntityId) {
      if (viewType === 'GROUP') {
        url += `?group_id=${encodeURIComponent(activeEntityId)}`;
      } else if (viewType === 'FACULTY') {
        url += `?faculty_id=${encodeURIComponent(activeEntityId)}`;
      } else if (viewType === 'ROOM') {
        url += `?room_id=${encodeURIComponent(activeEntityId)}`;
      }
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPdf = () => {
    let url = '/api/export/pdf';
    const params = new URLSearchParams();
    if (activeEntityId) {
      if (viewType === 'GROUP') {
        params.append('group_id', activeEntityId);
      } else if (viewType === 'FACULTY') {
        params.append('faculty_id', activeEntityId);
      } else if (viewType === 'ROOM') {
        params.append('room_id', activeEntityId);
      }
    }
    const qs = params.toString();
    if (qs) {
      url += `?${qs}`;
    }
    window.open(url, '_blank');
  };

  const roleColors: Record<UserRole, { badge: string; text: string; gradient: string }> = {
    ADMIN: { 
      badge: isDark ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200', 
      text: 'text-purple-500', 
      gradient: 'from-purple-600 via-indigo-600 to-indigo-700' 
    },
    COORDINATOR: { 
      badge: isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200', 
      text: 'text-blue-500', 
      gradient: 'from-blue-600 via-sky-600 to-cyan-600' 
    },
    FACULTY: { 
      badge: isDark ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200', 
      text: 'text-emerald-500', 
      gradient: 'from-emerald-600 via-teal-600 to-cyan-600' 
    },
  };

  const navItems = [
    {
      id: 'DASHBOARD',
      label: 'Campus Dashboard',
      badge: 'Live',
      icon: LayoutDashboard,
      desc: 'Overview, Capacity & Analytics',
    },
    {
      id: 'TIMETABLE',
      label: 'Timetable Matrix',
      badge: 'Interactive',
      icon: Calendar,
      desc: 'Institution Schedule Grid',
    },
    {
      id: 'CURRICULUM',
      label: 'Curriculum Studio',
      badge: 'Year / Sem',
      icon: GraduationCap,
      desc: 'Course & Subject Hierarchy',
    },
    {
      id: 'INPUT_STUDIO',
      label: 'Academic Data Studio',
      badge: 'Entities',
      icon: Database,
      desc: 'Faculty, Rooms & Cohorts',
    },
    {
      id: 'SETTINGS',
      label: 'Settings & Administration',
      badge: 'Admin Only',
      icon: Settings,
      desc: 'Users, Roles & Supabase Integration',
    },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (currentUser.role === 'FACULTY') {
      return item.id === 'DASHBOARD' || item.id === 'TIMETABLE';
    }
    if (currentUser.role === 'COORDINATOR') {
      return item.id !== 'SETTINGS';
    }
    return true; // ADMIN
  });

  return (
    <aside
      className={`flex flex-col justify-between transition-all duration-300 shrink-0 z-30 select-none no-print ${
        collapsed ? 'w-20' : 'w-72'
      } ${
        isDark 
          ? 'bg-slate-950/90 border-r border-slate-800/80 text-slate-100 backdrop-blur-2xl' 
          : 'bg-white/95 border-r border-slate-200/90 text-slate-800 shadow-lg backdrop-blur-2xl'
      }`}
    >
      {/* 1. Header / Branding */}
      <div className={`p-4 border-b space-y-3 ${isDark ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${roleColors[currentUser.role].gradient} flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 shrink-0 ring-2 ring-white/10`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-black text-base tracking-tight block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    ACADENCE
                  </span>
                  <span className="text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 uppercase">
                    PRO
                  </span>
                </div>
                <span className={`text-[11px] font-medium block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Conflict-Free Timetable Engine
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className={`p-1.5 rounded-xl transition cursor-pointer ${
              isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/80' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Navigation & Actions Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-6">
        
        {/* Main Workspaces */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 flex items-center justify-between">
              <span className={`text-[10px] font-black tracking-wider uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Workspaces
              </span>
              <span className="text-[10px] font-mono text-slate-400">{visibleNavItems.length} Views</span>
            </div>
          )}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id as any)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition group cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                    : isDark
                      ? 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                    active ? 'text-white' : isDark ? 'text-slate-400 group-hover:text-indigo-400' : 'text-slate-500 group-hover:text-indigo-600'
                  }`} />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </div>
                {!collapsed && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                    active 
                      ? 'bg-white/20 text-white font-bold' 
                      : isDark ? 'text-slate-500 bg-slate-900' : 'text-slate-400 bg-slate-100'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Solver Engine & Optimization Panel */}
        {!collapsed ? (
          <div className={`p-3.5 rounded-2xl border space-y-3 transition ${
            isDark ? 'bg-slate-900/50 border-slate-800/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  CP-SAT Solver
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Auto-Tuned
              </span>
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] font-semibold block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Optimization Target Profile:
              </label>
              <select
                value={activeProfile}
                onChange={(e) => onSelectProfile(e.target.value)}
                disabled={isSolving || currentUser.role === 'FACULTY'}
                aria-label="Solver Profile Selection"
                className={`w-full text-xs font-bold rounded-xl px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-slate-200' 
                    : 'bg-white border-slate-200 text-slate-800 shadow-xs'
                }`}
              >
                <option value="BALANCED">Balanced Multi-Objective</option>
                <option value="FACULTY_FRIENDLY">Faculty-Friendly (Min Gaps)</option>
                <option value="SPACE_EFFICIENT">Space-Efficient (Room Load)</option>
              </select>
            </div>

            {currentUser.role !== 'FACULTY' ? (
              <button
                onClick={onReoptimize}
                disabled={isSolving}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer active:scale-98"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSolving ? 'animate-spin' : ''}`} />
                <span>{isSolving ? 'Solving Timetable...' : 'Re-Optimize Matrix'}</span>
              </button>
            ) : (
              <div className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border ${
                isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Faculty View (Read-Only)</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={onReoptimize}
              disabled={isSolving || currentUser.role === 'FACULTY'}
              title="Re-Optimize Schedule"
              className="p-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSolving ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* Export & Publication Hub */}
        {!collapsed && (
          <div className="space-y-2">
            <div className="px-1 flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Export Center
              </span>
              <span className="text-[10px] font-mono text-slate-400">Official</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownload('/api/export/xlsx', 'acadence_timetable.xlsx')}
                title="Download Master Excel Workbook (.xlsx)"
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  isDark 
                    ? 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 hover:border-emerald-500/40 text-slate-200' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                }`}
              >
                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">Excel</span>
              </button>

              <button
                onClick={() => handleDownload('/api/export/csv', 'acadence_timetable.csv')}
                title="Download Active View as CSV (.csv)"
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  isDark 
                    ? 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 hover:border-sky-500/40 text-slate-200' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                }`}
              >
                <div className="p-1 rounded-lg bg-sky-500/10 text-sky-500">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">CSV</span>
              </button>

              <button
                onClick={() => handleDownload('/api/export/ams-json', 'acadence_ams_erp_schedule.json')}
                title="Download Academic Management System ERP JSON"
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  isDark 
                    ? 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 hover:border-purple-500/40 text-slate-200' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                }`}
              >
                <div className="p-1 rounded-lg bg-purple-500/10 text-purple-500">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">AMS ERP</span>
              </button>

              <button
                onClick={onOpenPrintModal || handlePrintPdf}
                title="Print & Export Timetable Circular (PDF)"
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  isDark 
                    ? 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/80 hover:border-amber-500/40 text-slate-200' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-xs'
                }`}
              >
                <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500">
                  <Printer className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">Print PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Theme Segmented Switcher */}
        {!collapsed && (
          <div className="space-y-1.5 pt-1">
            <span className={`px-1 text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Theme Mode
            </span>
            <div className={`p-1 rounded-xl flex items-center gap-1 border ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                onClick={() => isDark && onToggleTheme()}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  !isDark 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                onClick={() => !isDark && onToggleTheme()}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 3. Bottom User & Perspective Profile */}
      <div className={`p-3.5 border-t space-y-3 ${
        isDark ? 'border-slate-800/80 bg-slate-950/60' : 'border-slate-200/80 bg-slate-50/70'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ring-2 ring-white/10 ${
            isDark ? 'bg-slate-800 text-white border border-slate-700' : 'bg-slate-200 text-slate-900 border border-slate-300'
          }`}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`block text-xs font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser.name}
                </span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <span className={`block text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentUser.email}
              </span>
            </div>
          )}
        </div>

        {/* Assigned Role Badge */}
        {!collapsed && (
          <div className={`pt-2 border-t flex items-center justify-between text-xs ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
            <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Assigned Role:
            </span>
            <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide ${roleColors[currentUser.role].badge}`}>
              {currentUser.role === 'ADMIN' ? 'SUPER ADMIN' : currentUser.role}
            </span>
          </div>
        )}

        {/* Sign Out Button */}
        <button
          onClick={onLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
            isDark 
              ? 'bg-slate-900/60 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border-slate-800 hover:border-rose-500/40' 
              : 'bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 border-slate-200 hover:border-rose-200 shadow-xs'
          }`}
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
