import React, { useState, useEffect } from 'react';
import {
  Users, Building2, Database, History, Plus,
  Check, Trash2, RefreshCw,
  Sliders, Server, CheckCircle2, Lock, X,
  Clock, Sparkles
} from 'lucide-react';
import type { User, UserRole, SystemSettings, AuditLogEntry, PeriodScheduleItem } from '../types/auth';

interface SettingsPageProps {
  currentUser: User;
  theme?: 'dark' | 'light';
  onNavigateTimetable?: (programId?: string, courseId?: string) => void;
  onSettingsSaved?: (newSettings: SystemSettings) => void;
}

export function SettingsPage({ currentUser, theme = 'dark', onSettingsSaved }: SettingsPageProps) {
  const isDark = theme !== 'light';
  const [activeTab, setActiveTab] = useState<'USERS' | 'INSTITUTION' | 'SUPABASE' | 'AUDIT'>('USERS');

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('FACULTY');
  const [newUserDept, setNewUserDept] = useState('');
  const [newUserPass, setNewUserPass] = useState('123');
  const [userActionMessage, setUserActionMessage] = useState<string | null>(null);

  // Settings State with customizable lecture times & period schedule
  const [settings, setSettings] = useState<SystemSettings>({
    institution_name: 'Metropolitan University',
    academic_session: 'Fall Semester 2026',
    nep_framework: 'Semester & Credit-Based Curriculum',
    working_days_per_week: 5,
    periods_per_day: 8,
    teaching_practice_weeks: 4,
    campus_start_time: '08:30',
    campus_end_time: '15:40',
    default_period_duration_minutes: 50,
    break_duration_minutes: 30,
    lunch_break_after: 3,
    periods_schedule: [
      { p: 0, label: 'P1', start_time: '08:30', end_time: '09:20', is_break: false },
      { p: 1, label: 'P2', start_time: '09:20', end_time: '10:10', is_break: false },
      { p: 2, label: 'P3', start_time: '10:10', end_time: '11:00', is_break: false },
      { p: 3, label: 'P4', start_time: '11:30', end_time: '12:20', is_break: false },
      { p: 4, label: 'P5', start_time: '12:20', end_time: '13:10', is_break: false },
      { p: 5, label: 'P6', start_time: '13:10', end_time: '14:00', is_break: false },
      { p: 6, label: 'P7', start_time: '14:00', end_time: '14:50', is_break: false },
      { p: 7, label: 'P8', start_time: '14:50', end_time: '15:40', is_break: false },
    ],
    supabase_url: 'https://gmukjwmwerbjwxbujsuy.supabase.co',
    supabase_anon_key: 'sb_publishable_GTEjmmgPM683f21WSOGkFw_GR7iDULn',
    auto_validate: true,
    audit_logging: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchAuditLogs();
  }, []);

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setUsersLoading(false);
    }
  }

  async function fetchSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) {
        setSettings(prev => ({
          ...prev,
          ...data,
          lunch_break_after: data.lunch_break_after !== undefined ? data.lunch_break_after : prev.lunch_break_after,
          periods_schedule: data.periods_schedule && data.periods_schedule.length > 0
            ? data.periods_schedule
            : prev.periods_schedule,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function fetchAuditLogs() {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setAuditLoading(false);
    }
  }

  function getSlotDurationMin(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const s = (sh || 0) * 60 + (sm || 0);
    const e = (eh || 0) * 60 + (em || 0);
    return e >= s ? e - s : (1440 - s + e);
  }

  function handleAutoGeneratePeriods(
    startStr?: string,
    durationMinVal?: number,
    periodCountVal?: number,
    breakAfterVal?: number,
    breakMinVal?: number
  ) {
    const start = startStr || settings.campus_start_time || '08:30';
    const dur = Number(durationMinVal !== undefined ? durationMinVal : settings.default_period_duration_minutes) || 50;
    const count = Number(periodCountVal !== undefined ? periodCountVal : settings.periods_per_day) || 8;
    const brkAfter = breakAfterVal !== undefined
      ? breakAfterVal
      : (settings.lunch_break_after !== undefined ? settings.lunch_break_after : 3);
    const brkMin = Number(breakMinVal !== undefined ? breakMinVal : settings.break_duration_minutes) || 30;

    const [startH, startM] = start.split(':').map(Number);
    let currentMin = (startH || 8) * 60 + (startM || 30);
    const schedule: PeriodScheduleItem[] = [];

    for (let i = 0; i < count; i++) {
      if (i === brkAfter && brkMin > 0) {
        currentMin += brkMin;
      }

      const sH = String(Math.floor(currentMin / 60) % 24).padStart(2, '0');
      const sM = String(currentMin % 60).padStart(2, '0');

      const endMin = currentMin + dur;
      const eH = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
      const eM = String(endMin % 60).padStart(2, '0');

      schedule.push({
        p: i,
        label: `P${i + 1}`,
        start_time: `${sH}:${sM}`,
        end_time: `${eH}:${eM}`,
        is_break: false,
      });

      currentMin = endMin;
    }

    const lastEnd = schedule.length > 0 ? schedule[schedule.length - 1].end_time : settings.campus_end_time;
    setSettings(prev => ({
      ...prev,
      campus_start_time: start,
      campus_end_time: lastEnd,
      default_period_duration_minutes: dur,
      periods_per_day: count,
      break_duration_minutes: brkMin,
      lunch_break_after: brkAfter,
      periods_schedule: schedule,
    }));
  }

  function handleUpdatePeriod(index: number, field: keyof PeriodScheduleItem, val: any) {
    const current = [...(settings.periods_schedule || [])];
    if (!current[index]) return;
    current[index] = { ...current[index], [field]: val };
    setSettings(prev => ({ ...prev, periods_schedule: current }));
  }

  function handleAddPeriod() {
    const current = [...(settings.periods_schedule || [])];
    const nextIdx = current.length;
    let newStart = '15:40';
    if (current.length > 0) {
      newStart = current[current.length - 1].end_time || '15:40';
    }
    const [sH, sM] = newStart.split(':').map(Number);
    const dur = Number(settings.default_period_duration_minutes) || 50;
    const endMinutes = (sH || 15) * 60 + (sM || 0) + dur;
    const eH = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
    const eM = String(endMinutes % 60).padStart(2, '0');

    current.push({
      p: nextIdx,
      label: `P${nextIdx + 1}`,
      start_time: newStart,
      end_time: `${eH}:${eM}`,
      is_break: false,
    });

    setSettings(prev => ({
      ...prev,
      periods_per_day: current.length,
      campus_end_time: `${eH}:${eM}`,
      periods_schedule: current,
    }));
  }

  function handleDeletePeriod(index: number) {
    if ((settings.periods_schedule || []).length <= 2) {
      alert('The institution must have at least 2 lecture periods scheduled.');
      return;
    }
    const current = [...(settings.periods_schedule || [])];
    current.splice(index, 1);
    const reindexed = current.map((p, idx) => ({ ...p, p: idx }));
    setSettings(prev => ({
      ...prev,
      periods_per_day: reindexed.length,
      periods_schedule: reindexed,
    }));
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          department: newUserDept,
          password: newUserPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create user');

      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserDept('');
      setUserActionMessage(`User ${newUserName} added successfully.`);
      setTimeout(() => setUserActionMessage(null), 3000);
      await fetchUsers();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUpdateUserRole(userId: string, newRole: UserRole) {
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update user role');
      setUserActionMessage(`Role updated to ${newRole}`);
      setTimeout(() => setUserActionMessage(null), 2500);
      await fetchUsers();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleToggleUserStatus(user: User) {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/auth/users/${user.user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      await fetchUsers();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`Are you sure you want to delete user ${name}?`)) return;
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete user');
      setUserActionMessage(`User ${name} removed.`);
      setTimeout(() => setUserActionMessage(null), 2500);
      await fetchUsers();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSaveSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Failed to save settings');
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
      if (onSettingsSaved) {
        onSettingsSaved(settings);
      }
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function getRoleBadgeStyle(role: UserRole) {
    if (!isDark) {
      switch (role) {
        case 'ADMIN': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'COORDINATOR': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'FACULTY': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      }
    } else {
      switch (role) {
        case 'ADMIN': return 'bg-purple-950/70 text-purple-300 border-purple-500/40';
        case 'COORDINATOR': return 'bg-blue-950/70 text-blue-300 border-blue-500/40';
        case 'FACULTY': return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
      }
    }
  }

  if (currentUser.role !== 'ADMIN') {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 ${
        isDark ? 'text-slate-300' : 'text-slate-700'
      }`}>
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Administrator Authorization Required
          </h2>
          <p className="text-xs text-slate-400">
            System Settings, User Management, and Cloud Database Configurations are restricted exclusively to Super Administrators. Timetable Coordinators manage schedule operations in Curriculum and Input Studio.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
          Your Role: {currentUser.role}
        </div>
      </div>
    );
  }

  const isRestricted = false;

  return (
    <div className={`flex-1 overflow-y-auto p-6 md:p-8 space-y-6 transition-colors ${
      isDark ? 'text-slate-200' : 'text-slate-800'
    }`}>
      {/* Page Title & Breadcrumb Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 ${
        isDark ? 'border-slate-800/80' : 'border-slate-200/90'
      }`}>
        <div>
          <h2 className={`text-xl md:text-2xl font-black tracking-tight flex items-center gap-2.5 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Sliders className="w-5 h-5" />
            </div>
            <span>Administration & System Settings</span>
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Manage users, institutional parameters, customizable lecture timings, and database synchronization.
          </p>
        </div>

        {isRestricted && (
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            isDark ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <Lock className="w-4 h-4 text-amber-500" />
            <span>Role: {currentUser.role} (Read-Only Preview Mode)</span>
          </div>
        )}
      </div>

      {userActionMessage && (
        <div className={`p-3 border text-xs rounded-xl flex items-center gap-2 animate-in fade-in ${
          isDark ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{userActionMessage}</span>
        </div>
      )}

      {/* Tabs Header - ROLES removed, strictly configured in codebase */}
      <div className={`flex items-center gap-2 overflow-x-auto pb-2 border-b ${
        isDark ? 'border-slate-800/80' : 'border-slate-200'
      }`}>
        {[
          { id: 'USERS', label: 'Users & Accounts', icon: Users },
          { id: 'INSTITUTION', label: 'Institution & Term', icon: Building2 },
          { id: 'SUPABASE', label: 'Supabase Cloud Sync', icon: Database },
          { id: 'AUDIT', label: 'System Audit Trail', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : isDark
                    ? 'bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800/80'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USERS & ACCOUNTS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Registered Users & Assigned Roles</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Academic institution verified accounts and access tiers</p>
            </div>
            {!isRestricted && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            )}
          </div>

          <div className={`border rounded-2xl overflow-hidden shadow-xl transition ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b uppercase text-[10px] font-bold ${
                  isDark ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Assigned Role</th>
                    <th className="p-3.5">Department / Division</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Created</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-400 mb-2" />
                        <span>Loading user accounts...</span>
                      </td>
                    </tr>
                  ) : users.map((u) => (
                    <tr key={u.user_id} className={`transition ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}`}>
                      <td className="p-3.5">
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.name}</div>
                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</div>
                      </td>
                      <td className="p-3.5">
                        {!isRestricted ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.user_id, e.target.value as UserRole)}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                              isDark ? 'bg-slate-950' : 'bg-white'
                            } ${getRoleBadgeStyle(u.role)}`}
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="COORDINATOR">COORDINATOR</option>
                            <option value="FACULTY">FACULTY</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getRoleBadgeStyle(u.role)}`}>
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className={`p-3.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{u.department}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isDark ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className={`p-3.5 font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {u.created_at || '2026-11-01'}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {!isRestricted && (
                          <>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              title={u.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition border cursor-pointer ${
                                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                            {u.email !== 'hello@123.com' && (
                              <button
                                onClick={() => handleDeleteUser(u.user_id, u.name)}
                                title="Delete User Account"
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  isDark ? 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-500/30 text-rose-300' : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INSTITUTION & CUSTOMIZABLE LECTURE TIMES MATRIX                    */}
      {/* ========================================================================= */}
      {activeTab === 'INSTITUTION' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
          {/* Card 1: Institution Profile & Framework */}
          <div className={`border rounded-2xl p-6 shadow-xl space-y-5 transition ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}>
            <h3 className={`text-sm font-bold border-b pb-3 flex items-center gap-2 ${
              isDark ? 'text-white border-slate-800' : 'text-slate-900 border-slate-200'
            }`}>
              <Building2 className="w-4 h-4 text-indigo-500" />
              <span>Institution Profile & Academic Term</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settingsLoading && (
                <div className="col-span-full py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Loading parameters...</span>
                </div>
              )}

              <div className="space-y-1.5 md:col-span-2">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Institution Name</label>
                <input
                  type="text"
                  value={settings.institution_name}
                  onChange={(e) => setSettings({ ...settings, institution_name: e.target.value })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Academic Session</label>
                <input
                  type="text"
                  value={settings.academic_session}
                  onChange={(e) => setSettings({ ...settings, academic_session: e.target.value })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Curriculum Framework Model</label>
                <input
                  type="text"
                  value={settings.nep_framework}
                  onChange={(e) => setSettings({ ...settings, nep_framework: e.target.value })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Working Days Per Week</label>
                <select
                  value={settings.working_days_per_week}
                  onChange={(e) => setSettings({ ...settings, working_days_per_week: parseInt(e.target.value) })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={5}>5 Days (Monday - Friday)</option>
                  <option value={6}>6 Days (Monday - Saturday)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Practicum & Internship Duration (weeks)
                </label>
                <input
                  type="number"
                  value={settings.teaching_practice_weeks}
                  onChange={(e) => setSettings({ ...settings, teaching_practice_weeks: parseInt(e.target.value) || 0 })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Customizable Lecture Schedule & Period Generator */}
          <div className={`border rounded-2xl p-6 shadow-xl space-y-6 transition ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}>
            <div className={`border-b pb-3 flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Customizable Lecture Timetable Schedule & Hours
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Configure institution-wide lecture start times, durations, recess intervals, and period slots.
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoGeneratePeriods('08:30', 50, 8, 3, 30)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Preset 8-Slot (50m)
                </button>
                <button
                  type="button"
                  onClick={() => handleAutoGeneratePeriods('09:00', 60, 6, 3, 45)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Preset 6-Slot (60m)
                </button>
              </div>
            </div>

            {/* Quick Generator Parameters */}
            <div className={`p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1.5`}>
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Campus Day Starts At</span>
                </label>
                <input
                  type="time"
                  value={settings.campus_start_time || '08:30'}
                  onChange={(e) => setSettings({ ...settings, campus_start_time: e.target.value })}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1.5`}>
                  <span>Lecture Duration (mins)</span>
                </label>
                <input
                  type="number"
                  min={30}
                  max={120}
                  step={5}
                  value={settings.default_period_duration_minutes || 50}
                  onChange={(e) => setSettings({ ...settings, default_period_duration_minutes: parseInt(e.target.value) || 50 })}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1.5`}>
                  <span>Recess After Period</span>
                </label>
                <select
                  value={settings.lunch_break_after ?? 3}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSettings(prev => ({ ...prev, lunch_break_after: val }));
                    handleAutoGeneratePeriods(undefined, undefined, undefined, val, undefined);
                  }}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs font-bold transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={2}>After P2 (Morning Recess)</option>
                  <option value={3}>After P3 (Standard Lunch)</option>
                  <option value={4}>After P4 (Late Lunch)</option>
                  <option value={-1}>No Mid-Day Break</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-1.5`}>
                  <span>Recess Duration (mins)</span>
                </label>
                <input
                  type="number"
                  min={10}
                  max={90}
                  step={5}
                  value={settings.break_duration_minutes || 30}
                  onChange={(e) => setSettings({ ...settings, break_duration_minutes: parseInt(e.target.value) || 30 })}
                  className={`w-full rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="col-span-full pt-1 flex items-center justify-between">
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Auto-calculation computes sequential slot intervals based on start time, lecture duration, and recess buffer.
                </span>
                <button
                  type="button"
                  onClick={() => handleAutoGeneratePeriods()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Calculate Periods</span>
                </button>
              </div>
            </div>

            {/* Granular Period Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Configured Daily Period Slots ({(settings.periods_schedule || []).length} Slots)
                </h4>
                <button
                  type="button"
                  onClick={handleAddPeriod}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lecture Slot</span>
                </button>
              </div>

              <div className={`border rounded-xl overflow-hidden ${
                isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
              }`}>
                <table className="w-full text-left text-xs">
                  <thead className={`border-b uppercase text-[10px] font-bold ${
                    isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    <tr>
                      <th className="p-3 w-16 text-center">Slot</th>
                      <th className="p-3">Period Label</th>
                      <th className="p-3">Start Time</th>
                      <th className="p-3">End Time</th>
                      <th className="p-3 text-center">Duration</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                    {(settings.periods_schedule || []).map((period, idx) => {
                      const dur = getSlotDurationMin(period.start_time, period.end_time);
                      return (
                        <tr key={idx} className={`transition ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-100/50'}`}>
                          <td className="p-3 text-center font-mono font-bold text-indigo-400">
                            P{period.p + 1}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={period.label}
                              onChange={(e) => handleUpdatePeriod(idx, 'label', e.target.value)}
                              placeholder={`Period ${period.p + 1}`}
                              className={`w-32 rounded-lg px-2.5 py-1 text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="time"
                              value={period.start_time}
                              onChange={(e) => handleUpdatePeriod(idx, 'start_time', e.target.value)}
                              className={`rounded-lg px-2 py-1 text-xs font-mono font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="time"
                              value={period.end_time}
                              onChange={(e) => handleUpdatePeriod(idx, 'end_time', e.target.value)}
                              className={`rounded-lg px-2 py-1 text-xs font-mono font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                              dur === (settings.default_period_duration_minutes || 50)
                                ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                              {dur} min
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleUpdatePeriod(idx, 'is_break', !period.is_break)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition border cursor-pointer ${
                                period.is_break
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-200 border-slate-300 text-slate-700'
                              }`}
                            >
                              {period.is_break ? 'Recess / Break' : 'Class Lecture'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeletePeriod(idx)}
                              title="Delete Period"
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isDark ? 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-500/30 text-rose-300' : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                              }`}
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

            {/* Save Action Footer */}
            {!isRestricted && (
              <div className={`pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                {settingsSaveSuccess ? (
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lecture timetable timings & institution settings saved successfully!</span>
                  </span>
                ) : (
                  <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Timetable schedule matrix dynamically reflects your configured lecture start and end times.
                  </span>
                )}
                <button
                  type="submit"
                  className="ml-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Academic & Lecture Configuration</span>
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SUPABASE CLOUD SYNC                                                */}
      {/* ========================================================================= */}
      {activeTab === 'SUPABASE' && (
        <div className="space-y-5 max-w-3xl">
          <div className={`border rounded-2xl p-6 shadow-xl space-y-5 transition ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Supabase PostgreSQL Integration</span>
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Connect cloud authentication and relational snapshot sync
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                SUPABASE READY
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Supabase Project URL</label>
                <input
                  type="url"
                  placeholder="https://xyzabcdefg.supabase.co"
                  value={settings.supabase_url}
                  onChange={(e) => setSettings({ ...settings, supabase_url: e.target.value })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Supabase Anon Public API Key</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={settings.supabase_anon_key}
                  onChange={(e) => setSettings({ ...settings, supabase_anon_key: e.target.value })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className={`p-4 rounded-xl text-xs space-y-1.5 border transition ${
                isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <div className={`font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  <Server className="w-4 h-4 text-indigo-500" />
                  <span>Cloud Persistence Schema</span>
                </div>
                <p>
                  When connected, Acadence synchronizes academic courses, faculty unavailability matrices, rooms, and committed version timetables directly to your Supabase PostgreSQL cluster.
                </p>
              </div>
            </div>

            {!isRestricted && (
              <div className={`pt-3 border-t flex justify-end ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Save Supabase Credentials
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SYSTEM AUDIT TRAIL                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>System Audit Log</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tamper-evident record of logins, optimizations, edits, and administrative actions</p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className={`p-2 rounded-xl text-xs transition border cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className={`border rounded-2xl overflow-hidden shadow-xl transition ${
            isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b uppercase text-[10px] font-bold ${
                  isDark ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Action Code</th>
                    <th className="p-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/80 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                  {auditLogs.map((log, idx) => (
                    <tr key={idx} className={`transition ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}`}>
                      <td className={`p-3.5 font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{log.timestamp}</td>
                      <td className={`p-3.5 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{log.user_email}</td>
                      <td className="p-3.5">
                        <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                          isDark ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className={`p-3.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md border rounded-2xl p-6 shadow-2xl space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add New Institutional User</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Smith"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Institutional Email</label>
                <input
                  type="email"
                  required
                  placeholder="jane.smith@institution.edu"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Department / Academic Unit</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Eng."
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Assigned Institutional Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className={`w-full rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="FACULTY">FACULTY (View-Only Timetable & Dashboard Access)</option>
                  <option value="COORDINATOR">COORDINATOR (Timetable, Curriculum & Academic Operations)</option>
                  <option value="ADMIN">ADMIN (Super Admin with System Settings & User Provisioning)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-2 rounded-xl border text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
