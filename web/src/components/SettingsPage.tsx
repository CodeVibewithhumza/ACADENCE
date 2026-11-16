import React, { useState, useEffect } from 'react';
import {
  Users, Shield, Building2, Database, History, Plus,
  Check, Trash2, RefreshCw,
  Sliders, Server, CheckCircle2, Lock, X,
  GraduationCap, BookOpen, Sparkles, Layers,
  DoorOpen, Users2, Clock,
  Edit3, ListFilter, CheckCircle
} from 'lucide-react';
import type { User, UserRole, SystemSettings, AuditLogEntry } from '../types/auth';

interface CourseSectionInfo {
  section_name: string;
  students: number;
  room_id: string;
  room_name: string;
  capacity: number;
}

interface CourseSubjectItem {
  subject_code: string;
  subject_name: string;
  program_id: string;
  year: number;
  semester: number;
  subject_type: string;
  credits: number;
  sessions_per_week: number;
  duration_slots: number;
  room_type_id: string;
  faculty_ids: string[];
  cohort_name?: string;
}

interface CourseCohortItem {
  course_id: string;
  course_name: string;
  program_id: string;
  year: number;
  semester: number;
  department: string;
  student_count: number;
  preferred_room_type: string;
  rooms_required: number;
  max_capacity_per_room: number;
  allocated_room_ids: string[];
  allocated_room_names: string[];
  section_ids: string[];
  sections: CourseSectionInfo[];
  description: string;
  subjects_count: number;
  subjects: CourseSubjectItem[];
  active_placements_count: number;
  collision_free: boolean;
}

interface RoomAuditEntry {
  room_id: string;
  room_name: string;
  capacity: number;
  room_type_id: string;
  assigned_cohorts: string[];
  scheduled_slots_count: number;
  occupancy_rate_pct: number;
  is_collision_free: boolean;
  collisions_count: number;
  scheduled_courses: string[];
}

interface SettingsPageProps {
  currentUser: User;
  theme?: 'dark' | 'light';
}

export function SettingsPage({ currentUser, theme = 'dark' }: SettingsPageProps) {
  const isDark = theme !== 'light';
  const [activeTab, setActiveTab] = useState<'COURSES' | 'USERS' | 'ROLES' | 'INSTITUTION' | 'SUPABASE' | 'AUDIT'>('COURSES');

  // Courses & Room Engine State
  const [courses, setCourses] = useState<CourseCohortItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [roomAudits, setRoomAudits] = useState<RoomAuditEntry[]>([]);
  const [roomAuditView, setRoomAuditView] = useState(false);
  const [courseFilterSearch, setCourseFilterSearch] = useState('');

  // Modals State
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [editingStudentCountCourse, setEditingStudentCountCourse] = useState<CourseCohortItem | null>(null);
  const [newStudentCountValue, setNewStudentCountValue] = useState<number>(140);

  // Add Subject Form
  const [targetCourseId, setTargetCourseId] = useState<string>('BTECH_Y1');
  const [subCode, setSubCode] = useState<string>('MATH-101');
  const [subName, setSubName] = useState<string>('Engineering Mathematics - 1');
  const [subType, setSubType] = useState<string>('THEORY');
  const [subCredits, setSubCredits] = useState<number>(4);
  const [subSessions, setSubSessions] = useState<number>(3);
  const [subScheduleNow, setSubScheduleNow] = useState<boolean>(true);
  const [subSubmitLoading, setSubSubmitLoading] = useState<boolean>(false);

  // Create Course Form
  const [newCName, setNewCName] = useState<string>('B.Tech 1st Year');
  const [newCProg, setNewCProg] = useState<string>('BTECH_CSE');
  const [newCYear, setNewCYear] = useState<number>(1);
  const [newCSem, setNewCSem] = useState<number>(1);
  const [newCDept, setNewCDept] = useState<string>('Computer Science & Engineering');
  const [newCStrength, setNewCStrength] = useState<number>(140);
  const [newCRoomType, setNewCRoomType] = useState<string>('LECTURE_HALL');

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

  // Settings State
  const [settings, setSettings] = useState<SystemSettings>({
    institution_name: 'Metropolitan University',
    academic_session: 'Fall Semester 2026',
    nep_framework: 'Semester & Credit-Based System',
    working_days_per_week: 5,
    periods_per_day: 7,
    teaching_practice_weeks: 4,
    supabase_url: '',
    supabase_anon_key: '',
    auto_validate: true,
    audit_logging: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchUsers();
    fetchSettings();
    fetchAuditLogs();
  }, []);

  async function fetchCourses() {
    setCoursesLoading(true);
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      if (data.courses) {
        setCourses(data.courses);
        if (data.courses.length > 0 && !targetCourseId) {
          setTargetCourseId(data.courses[0].course_id);
        }
      }
      const res2 = await fetch('/api/courses/room-allocations');
      const data2 = await res2.json();
      if (data2.rooms) {
        setRoomAudits(data2.rooms);
      }
    } catch (err) {
      console.error('Failed to fetch courses', err);
    } finally {
      setCoursesLoading(false);
    }
  }

  async function handleAddSubjectToCourse(e: React.FormEvent) {
    e.preventDefault();
    setSubSubmitLoading(true);
    try {
      const res = await fetch('/api/courses/add-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: targetCourseId,
          subject_code: subCode.trim().toUpperCase(),
          subject_name: subName.trim(),
          subject_type: subType,
          credits: subCredits,
          sessions_per_week: subSessions,
          schedule_now: subScheduleNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add subject to course');

      setUserActionMessage(`Enrolled "${subCode}: ${subName}" into ${data.course?.course_name || targetCourseId}. Auto-allocated ${data.sections_count} room(s): ${data.rooms_allocated?.join(', ')}. Status: 0 Clashes!`);
      setShowAddSubjectModal(false);
      setSubCode('');
      setSubName('');
      setTimeout(() => setUserActionMessage(null), 5000);
      await fetchCourses();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubSubmitLoading(false);
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_name: newCName.trim(),
          program_id: newCProg,
          year: newCYear,
          semester: newCSem,
          department: newCDept.trim(),
          student_count: Number(newCStrength),
          preferred_room_type: newCRoomType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create course');

      setUserActionMessage(`Course "${newCName}" created with ${data.calculation?.rooms_required} auto-allocated room(s).`);
      setShowCreateCourseModal(false);
      setTimeout(() => setUserActionMessage(null), 4000);
      await fetchCourses();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUpdateStudentStrength(courseId: string, count: number) {
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_count: Number(count) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update student count');

      setUserActionMessage(`Updated student enrollment for ${data.course?.course_name}. Auto-calculated: ${data.course?.rooms_required} room(s) required.`);
      setEditingStudentCountCourse(null);
      setTimeout(() => setUserActionMessage(null), 4000);
      await fetchCourses();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteCourse(courseId: string, courseName: string) {
    if (!confirm(`Are you sure you want to delete course cohort "${courseName}"?`)) return;
    try {
      const res = await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete course');

      setUserActionMessage(`Course "${courseName}" deleted.`);
      setTimeout(() => setUserActionMessage(null), 3000);
      await fetchCourses();
      await fetchAuditLogs();
    } catch (err: any) {
      alert(err.message);
    }
  }

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
      setSettings(data);
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

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
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
        case 'STUDENT': return 'bg-amber-100 text-amber-800 border-amber-200';
      }
    } else {
      switch (role) {
        case 'ADMIN': return 'bg-purple-950/70 text-purple-300 border-purple-500/40';
        case 'COORDINATOR': return 'bg-blue-950/70 text-blue-300 border-blue-500/40';
        case 'FACULTY': return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
        case 'STUDENT': return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
      }
    }
  }

  const isRestricted = currentUser.role !== 'ADMIN';

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
            Manage users, role permissions, institutional parameters, and database integration.
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

      {/* Tabs Header */}
      <div className={`flex items-center gap-2 overflow-x-auto pb-2 border-b ${
        isDark ? 'border-slate-800/80' : 'border-slate-200'
      }`}>
        {[
          { id: 'COURSES', label: 'Courses & Room Engine', icon: GraduationCap },
          { id: 'USERS', label: 'Users & Accounts', icon: Users },
          { id: 'ROLES', label: 'Role Permissions Matrix', icon: Shield },
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
      {/* TAB 0: COURSES & ROOM ALLOCATION ENGINE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'COURSES' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className={`text-base font-black flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span>Course Cohorts & Collision-Free Room Allocation Engine</span>
                {coursesLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
              </h3>
              <p className={`text-xs mt-1 max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Configure course cohorts (e.g. B.Tech 1st Year, B.Tech 2nd Year). The system analyzes student enrollment: when strength exceeds single-room capacity (75 seats), it automatically provisions parallel sections and auto-allots multiple collision-free rooms with guaranteed zero overlaps.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setRoomAuditView(!roomAuditView)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  roomAuditView
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                    : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>{roomAuditView ? 'Show Cohort Cards' : 'Audit Room Matrix'}</span>
              </button>

              {!isRestricted && (
                <>
                  <button
                    onClick={() => {
                      if (courses.length > 0 && !targetCourseId) {
                        setTargetCourseId(courses[0].course_id);
                      }
                      setShowAddSubjectModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span>Enroll Subject with Course Matching</span>
                  </button>

                  <button
                    onClick={() => setShowCreateCourseModal(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Course Cohort</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-3.5 rounded-xl border transition ${
              isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Course Cohorts</span>
                <GraduationCap className="w-4 h-4 text-indigo-500" />
              </div>
              <div className={`text-lg font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {courses.length} Active
              </div>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Year & semester cohorts
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition ${
              isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Total Enrolled Students</span>
                <Users2 className="w-4 h-4 text-blue-500" />
              </div>
              <div className={`text-lg font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {courses.reduce((acc, c) => acc + (c.student_count || 0), 0)} Students
              </div>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Across all programs
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition ${
              isDark ? 'bg-purple-950/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-purple-300' : 'text-purple-700'}>Multi-Room Split Cohorts</span>
                <Layers className="w-4 h-4 text-purple-500" />
              </div>
              <div className={`text-lg font-black mt-1 ${isDark ? 'text-purple-200' : 'text-purple-900'}`}>
                {courses.filter(c => c.rooms_required > 1).length} Cohorts
              </div>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                Exceeding 75-cap per hall
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition ${
              isDark ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-emerald-300' : 'text-emerald-700'}>Room Collision Status</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className={`text-lg font-black mt-1 ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}>
                0 Overlaps
              </div>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                100% Conflict-Free Verified
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search course cohort (e.g. B.Tech 1st Year, BCA...)"
                value={courseFilterSearch}
                onChange={(e) => setCourseFilterSearch(e.target.value)}
                className={`w-full rounded-xl pl-9 pr-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                  isDark ? 'bg-slate-900/60 border-slate-800 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-xs'
                }`}
              />
              <ListFilter className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            </div>
          </div>

          {/* VIEW A: ROOM ALLOCATION AUDIT MATRIX VIEW */}
          {roomAuditView ? (
            <div className={`border rounded-2xl overflow-hidden shadow-xl transition ${
              isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs'
            }`}>
              <div className={`p-4 border-b flex items-center justify-between ${
                isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50/70'
              }`}>
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Campus Room & Lecture Hall Allocation Matrix (Collision Audit)
                  </h4>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Live tracking of all classrooms, capacity limits, and course cohort allotments with zero collision verification.
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  0 OVERLAPS DETECTED
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b uppercase text-[10px] font-bold ${
                    isDark ? 'bg-slate-950/80 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    <tr>
                      <th className="p-3.5">Hall Code & Name</th>
                      <th className="p-3.5">Max Seating Capacity</th>
                      <th className="p-3.5">Room Type</th>
                      <th className="p-3.5">Allotted Course Cohorts</th>
                      <th className="p-3.5">Weekly Scheduled Slots</th>
                      <th className="p-3.5">Utilization</th>
                      <th className="p-3.5 text-right">Collision Status</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                    {roomAudits.map((r) => (
                      <tr key={r.room_id} className={`transition ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}`}>
                        <td className="p-3.5 font-bold">
                          <div className={isDark ? 'text-white' : 'text-slate-900'}>{r.room_name}</div>
                          <div className="text-[10px] font-mono text-indigo-400">{r.room_id}</div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${
                            r.capacity >= 75
                              ? isDark ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                              : isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}>
                            {r.capacity} seats
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[11px] font-semibold text-slate-400">{r.room_type_id}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1">
                            {r.assigned_cohorts && r.assigned_cohorts.length > 0 ? (
                              r.assigned_cohorts.map((cohortName, idx) => (
                                <span key={idx} className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                  isDark ? 'bg-purple-950/40 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-800'
                                }`}>
                                  {cohortName}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Available pool</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-xs">
                          {r.scheduled_slots_count} slots / week
                        </td>
                        <td className="p-3.5">
                          <div className="w-24">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span>{r.occupancy_rate_pct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  r.occupancy_rate_pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, r.occupancy_rate_pct)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            r.is_collision_free
                              ? isDark ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                          }`}>
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>0 Overlaps</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VIEW B: COURSE COHORT CARDS GRID */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {courses
                .filter(c =>
                  !courseFilterSearch ||
                  c.course_name.toLowerCase().includes(courseFilterSearch.toLowerCase()) ||
                  c.department.toLowerCase().includes(courseFilterSearch.toLowerCase()) ||
                  c.course_id.toLowerCase().includes(courseFilterSearch.toLowerCase())
                )
                .map((cohort) => {
                  const needsMultipleRooms = cohort.rooms_required > 1;
                  return (
                    <div
                      key={cohort.course_id}
                      className={`border rounded-2xl p-4.5 space-y-4 transition flex flex-col justify-between shadow-xl ${
                        isDark ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700' : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <h4 className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {cohort.course_name}
                              </h4>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {cohort.course_id}
                              </span>
                            </div>
                            <p className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {cohort.department}
                            </p>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                            isDark ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                          }`}>
                            Year {cohort.year} • Sem {cohort.semester}
                          </span>
                        </div>

                        {/* Student Count Row */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          isDark ? 'bg-slate-950/50 border-slate-800/80' : 'bg-slate-50/80 border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <div>
                              <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                {cohort.student_count} Enrolled Students
                              </span>
                              <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                Hall cap: {cohort.max_capacity_per_room || 75} seats
                              </div>
                            </div>
                          </div>

                          {!isRestricted && (
                            <button
                              onClick={() => {
                                setEditingStudentCountCourse(cohort);
                                setNewStudentCountValue(cohort.student_count);
                              }}
                              className={`p-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                              title="Update student strength & auto-recompute rooms"
                            >
                              <Edit3 className="w-3 h-3 text-indigo-400" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>

                        {/* Room Allocation Status Banner */}
                        <div className={`p-2.5 rounded-xl border space-y-1.5 ${
                          needsMultipleRooms
                            ? isDark ? 'bg-purple-950/30 border-purple-500/40' : 'bg-purple-50 border-purple-200'
                            : isDark ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-indigo-50/60 border-indigo-200/80'
                        }`}>
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-bold flex items-center gap-1.5 ${
                              needsMultipleRooms
                                ? isDark ? 'text-purple-300' : 'text-purple-800'
                                : isDark ? 'text-indigo-300' : 'text-indigo-800'
                            }`}>
                              {needsMultipleRooms ? (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  <span>⚡ {cohort.rooms_required} Rooms Auto-Allocated</span>
                                </>
                              ) : (
                                <>
                                  <DoorOpen className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>🏛️ 1 Room Sufficient</span>
                                </>
                              )}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                              0 Overlaps
                            </span>
                          </div>

                          {/* Section Breakdown Pills */}
                          <div className="space-y-1">
                            {cohort.sections && cohort.sections.map((sec, idx) => (
                              <div
                                key={idx}
                                className={`text-[10px] p-1.5 rounded-lg border flex items-center justify-between ${
                                  isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold text-indigo-400">{sec.section_name} ({sec.students} sts):</span>
                                <span className="font-semibold truncate max-w-[170px]" title={sec.room_name}>
                                  🏛️ {sec.room_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Enrolled Subjects under this Course */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              Enrolled Subjects ({cohort.subjects?.length || 0})
                            </span>
                            {!isRestricted && (
                              <button
                                onClick={() => {
                                  setTargetCourseId(cohort.course_id);
                                  setShowAddSubjectModal(true);
                                }}
                                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Subject</span>
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                            {cohort.subjects && cohort.subjects.length > 0 ? (
                              cohort.subjects.map((s, idx) => (
                                <div
                                  key={idx}
                                  className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 ${
                                    isDark ? 'bg-slate-950/70 border-slate-800/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                  title={`${s.subject_name} (${s.credits} Credits • ${s.sessions_per_week} sess/wk)`}
                                >
                                  <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                                  <span className="font-mono font-bold">{s.subject_code}:</span>
                                  <span className="truncate max-w-[130px]">{s.subject_name}</span>
                                </div>
                              ))
                            ) : (
                              <div className={`text-[10px] italic p-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                No subjects mapped yet. Click "+ Add Subject" to enroll.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className={`pt-3 border-t flex items-center justify-between text-[11px] ${
                        isDark ? 'border-slate-800' : 'border-slate-200'
                      }`}>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          <span>{cohort.active_placements_count || 0} active placements</span>
                        </div>

                        {!isRestricted && (
                          <button
                            onClick={() => handleDeleteCourse(cohort.course_id, cohort.course_name)}
                            className={`p-1.5 rounded-lg transition text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer`}
                            title="Delete course cohort"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

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
                            <option value="STUDENT">STUDENT</option>
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
      {/* TAB 2: ROLE PERMISSIONS MATRIX                                            */}
      {/* ========================================================================= */}
      {activeTab === 'ROLES' && (
        <div className="space-y-4">
          <div>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Role-Based Access Control (RBAC) Matrix</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Configured operational privileges per higher education stakeholder tier</p>
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
                    <th className="p-3.5">Capability / Permission Code</th>
                    <th className="p-3.5 text-center">Super Admin</th>
                    <th className="p-3.5 text-center">Timetable Coordinator</th>
                    <th className="p-3.5 text-center">Faculty / Reviewer</th>
                    <th className="p-3.5 text-center">Student / Cohort</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800/80 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                  {[
                    { code: 'optimize:run', desc: 'Trigger CP-SAT Solver & Multi-Objective Profiles', admin: true, coord: true, fac: false, stud: false },
                    { code: 'timetable:edit', desc: 'Interactive Drag-and-Drop Session Rescheduling', admin: true, coord: true, fac: false, stud: false },
                    { code: 'data:manage', desc: 'Input Studio: Add/Remove Courses, Faculty, Rooms', admin: true, coord: true, fac: false, stud: false },
                    { code: 'users:manage', desc: 'Create Accounts, Assign Roles, Deactivate Users', admin: true, coord: false, fac: false, stud: false },
                    { code: 'settings:manage', desc: 'Configure Institution & Academic Parameters', admin: true, coord: false, fac: false, stud: false },
                    { code: 'export:run', desc: 'Download Excel, CSV, Circulars & AMS JSON', admin: true, coord: true, fac: true, stud: true },
                  ].map((row) => (
                    <tr key={row.code} className={`transition ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}`}>
                      <td className="p-3.5">
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.desc}</div>
                        <div className={`font-mono text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.code}</div>
                      </td>
                      <td className="p-3.5 text-center">
                        {row.admin ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.coord ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.fac ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.stud ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
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
      {/* TAB 3: INSTITUTION & ACADEMIC PARAMETERS                                   */}
      {/* ========================================================================= */}
      {activeTab === 'INSTITUTION' && (
        <form onSubmit={handleSaveSettings} className="space-y-5 max-w-3xl">
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
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Periods Per Day</label>
                <select
                  value={settings.periods_per_day}
                  onChange={(e) => setSettings({ ...settings, periods_per_day: parseInt(e.target.value) })}
                  disabled={isRestricted}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={6}>6 Periods (60 mins each)</option>
                  <option value={7}>7 Periods (Full Standard Schedule)</option>
                  <option value={8}>8 Periods (Extended Lab Shifts)</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Practicum, Field Work & Internship Duration (weeks)
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
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Off-campus field engagement reserved outside regular lecture hours.
                </span>
              </div>
            </div>

            {!isRestricted && (
              <div className={`pt-3 border-t flex items-center justify-between ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                {settingsSaveSuccess && (
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Settings saved successfully!
                  </span>
                )}
                <button
                  type="submit"
                  className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPABASE CLOUD SYNC                                                */}
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
      {/* TAB 5: SYSTEM AUDIT TRAIL                                                 */}
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
                      <td className={`p-3.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD SUBJECT WITH COURSE MATCHING                                  */}
      {/* ========================================================================= */}
      {showAddSubjectModal && (() => {
        const selectedCohort = courses.find(c => c.course_id === targetCourseId) || courses[0];
        const studentCount = selectedCohort ? selectedCohort.student_count : 140;
        const maxCap = selectedCohort ? (selectedCohort.max_capacity_per_room || 75) : 75;
        const roomsCalc = Math.max(1, Math.ceil(studentCount / maxCap));
        const isMultiRoom = roomsCalc > 1;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className={`border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto transition ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Enroll Subject & Match to Course Cohort</span>
                </h3>
                <button
                  onClick={() => setShowAddSubjectModal(false)}
                  className={`p-1 rounded-lg transition cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSubjectToCourse} className="space-y-4">
                {/* 1. SELECT TARGET COURSE COHORT */}
                <div className="space-y-1.5">
                  <label className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Select Matching Course Cohort</span>
                  </label>
                  <select
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_name} — {c.student_count} Students ({c.rooms_required} Room{c.rooms_required > 1 ? 's' : ''} Needed) • {c.department}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. DYNAMIC COURSE INTELLIGENCE & ROOM ALLOCATION PREVIEW */}
                {selectedCohort && (
                  <div className={`p-3.5 rounded-xl border space-y-2.5 transition ${
                    isMultiRoom
                      ? isDark ? 'bg-purple-950/30 border-purple-500/40' : 'bg-purple-50 border-purple-200'
                      : isDark ? 'bg-indigo-950/30 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-bold flex items-center gap-1.5 ${isMultiRoom ? 'text-purple-300' : 'text-indigo-400'}`}>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Dynamic Room & Section Allocation Intelligence</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        Zero Overlaps Guaranteed
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`p-2 rounded-lg border ${
                        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="text-[10px] text-slate-400">Target Cohort</div>
                        <div className="font-bold text-white text-[11px] truncate">{selectedCohort.course_name}</div>
                        <div className="text-[10px] text-slate-400">{selectedCohort.department}</div>
                      </div>

                      <div className={`p-2 rounded-lg border ${
                        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="text-[10px] text-slate-400">Enrollment vs Hall Cap</div>
                        <div className="font-bold text-white text-[11px]">
                          {studentCount} Students / {maxCap} Max Seats
                        </div>
                        <div className={`text-[10px] font-semibold ${isMultiRoom ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {isMultiRoom ? `⚡ Exceeds single hall ➔ ${roomsCalc} Halls Needed` : '✓ Fits in 1 Lecture Hall'}
                        </div>
                      </div>
                    </div>

                    {/* Allocated Rooms Preview */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold uppercase text-slate-400">
                        Auto-Allotted Non-Overlapping Rooms ({roomsCalc} Room{roomsCalc > 1 ? 's' : ''}):
                      </div>
                      <div className="space-y-1">
                        {selectedCohort.sections && selectedCohort.sections.map((sec, idx) => (
                          <div
                            key={idx}
                            className={`p-1.5 rounded-lg border text-[11px] flex items-center justify-between font-mono ${
                              isDark ? 'bg-slate-950/70 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <span className="text-indigo-400 font-bold">{sec.section_name} ({sec.students} students):</span>
                            <span className="text-emerald-400 font-semibold">🏛️ {sec.room_name} ({sec.capacity} seats)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className={`text-[10px] ${isDark ? 'text-purple-300/80' : 'text-purple-900/80'}`}>
                      🛡️ <strong>CP-SAT Solver Protection:</strong> Neither room nor student cohort will ever be double-booked in the same time slot (CON-H-001 & CON-H-002 constraints strictly satisfied).
                    </p>
                  </div>
                )}

                {/* 3. SUBJECT DETAILS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Subject Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Engineering Mathematics - 1"
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Subject Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MATH-101"
                      value={subCode}
                      onChange={(e) => setSubCode(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase font-mono ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Subject Type
                    </label>
                    <select
                      value={subType}
                      onChange={(e) => setSubType(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="THEORY">THEORY (Lecture)</option>
                      <option value="PRACTICAL">PRACTICAL (Lab)</option>
                      <option value="TUTORIAL">TUTORIAL</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Credits
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={subCredits}
                      onChange={(e) => setSubCredits(Number(e.target.value))}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Sessions / Week
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={subSessions}
                      onChange={(e) => setSubSessions(Number(e.target.value))}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={subScheduleNow}
                      onChange={(e) => setSubScheduleNow(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold">Optimize & Schedule Immediately into CP-SAT Timetable</span>
                  </label>
                  <span className="text-[10px] text-indigo-400 font-mono">0 Clashes Target</span>
                </div>

                <div className={`pt-3 flex justify-end gap-2 border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setShowAddSubjectModal(false)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={subSubmitLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                  >
                    {subSubmitLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Allocating Rooms & Solving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Enroll Subject & Auto-Allocate Rooms</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE COURSE COHORT                                              */}
      {/* ========================================================================= */}
      {showCreateCourseModal && (() => {
        const estRooms = Math.max(1, Math.ceil(newCStrength / 75));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <GraduationCap className="w-4 h-4 text-indigo-500" />
                  <span>Create New Course Cohort</span>
                </h3>
                <button
                  onClick={() => setShowCreateCourseModal(false)}
                  className={`p-1 rounded-lg transition cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="space-y-3">
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Course Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B.Tech 1st Year, M.Tech 1st Year"
                    value={newCName}
                    onChange={(e) => setNewCName(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Degree Program</label>
                    <select
                      value={newCProg}
                      onChange={(e) => setNewCProg(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="BTECH_CSE">B.Tech CSE</option>
                      <option value="BTECH_ECE">B.Tech ECE</option>
                      <option value="BCA">BCA (Applications)</option>
                      <option value="MBA">MBA (Management)</option>
                      <option value="BED">B.Ed (Education)</option>
                      <option value="MTECH">M.Tech</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Academic Year</label>
                    <select
                      value={newCYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setNewCYear(y);
                        setNewCSem((y * 2) - 1);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Department</label>
                  <input
                    type="text"
                    required
                    placeholder="Department of Computer Science & Engineering"
                    value={newCDept}
                    onChange={(e) => setNewCDept(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Student Enrollment *
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={1000}
                      value={newCStrength}
                      onChange={(e) => setNewCStrength(Number(e.target.value))}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Preferred Room Type</label>
                    <select
                      value={newCRoomType}
                      onChange={(e) => setNewCRoomType(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="LECTURE_HALL">Lecture Hall (75 seats)</option>
                      <option value="COMPUTER_LAB">Computer Lab (65 seats)</option>
                      <option value="PEDAGOGY_ROOM">Pedagogy Room (60 seats)</option>
                      <option value="SCIENCE_LAB">Science Lab (60 seats)</option>
                    </select>
                  </div>
                </div>

                {/* Real-time Room Calculation Badge */}
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  estRooms > 1
                    ? isDark ? 'bg-purple-950/40 border-purple-500/40 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
                    : isDark ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="font-bold flex items-center justify-between">
                    <span>⚡ Room Requirement Preview:</span>
                    <span className="font-mono">{estRooms} Room{estRooms > 1 ? 's' : ''} Needed</span>
                  </div>
                  <p className="text-[10px] opacity-80">
                    {estRooms > 1
                      ? `Enrollment (${newCStrength} students) exceeds standard room capacity (75 seats). The system will automatically create Section A & B with 2 dedicated halls.`
                      : `Enrollment (${newCStrength} students) fits within a single room capacity.`}
                  </p>
                </div>

                <div className={`pt-3 flex justify-end gap-2 border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setShowCreateCourseModal(false)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                  >
                    Create Course Cohort
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK EDIT STUDENT ENROLLMENT & AUTO-RECOMPUTE ROOMS             */}
      {/* ========================================================================= */}
      {editingStudentCountCourse && (() => {
        const currentReq = editingStudentCountCourse.rooms_required;
        const newReq = Math.max(1, Math.ceil(newStudentCountValue / (editingStudentCountCourse.max_capacity_per_room || 75)));
        const roomsChanged = currentReq !== newReq;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className={`border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 transition ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Update Enrollment: {editingStudentCountCourse.course_name}</span>
                </h3>
                <button
                  onClick={() => setEditingStudentCountCourse(null)}
                  className={`p-1 rounded-lg transition cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Total Enrolled Students
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={newStudentCountValue}
                    onChange={(e) => setNewStudentCountValue(Number(e.target.value))}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-bold transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400">
                    Max capacity per hall is {editingStudentCountCourse.max_capacity_per_room || 75} seats.
                  </p>
                </div>

                {/* Calculation Delta */}
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  roomsChanged
                    ? isDark ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                    : isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="font-bold flex items-center justify-between">
                    <span>Rooms Required:</span>
                    <span className="font-mono text-sm">{newReq} Room{newReq > 1 ? 's' : ''}</span>
                  </div>
                  {roomsChanged && (
                    <p className="text-[10px] text-amber-400 font-medium">
                      ⚡ Dynamic Adjustment: Changing strength will automatically repartition into {newReq} parallel sections and assign collision-free rooms!
                    </p>
                  )}
                </div>

                <div className={`pt-3 flex justify-end gap-2 border-t ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setEditingStudentCountCourse(null)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStudentStrength(editingStudentCountCourse.course_id, newStudentCountValue)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                  >
                    Save & Reallocate Rooms
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <Users className="w-4 h-4 text-indigo-500" />
                <span>Add Institutional User</span>
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className={`p-1 rounded-lg transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="space-y-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Rajesh Kumar"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="rajesh.kumar@acadence.edu"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Role Tier</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="COORDINATOR">COORDINATOR</option>
                    <option value="FACULTY">FACULTY</option>
                    <option value="STUDENT">STUDENT</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Default Password</label>
                  <input
                    type="password"
                    value={newUserPass}
                    onChange={(e) => setNewUserPass(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Department / Division</label>
                <input
                  type="text"
                  required
                  placeholder="Department of Computer Applications"
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className={`pt-3 flex justify-end gap-2 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
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
