import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, RefreshCw, 
  Layers, Users, DoorOpen, Sparkles, Move,
  FileSpreadsheet, Check,
  BookOpen, GraduationCap, GitFork, Cpu, Globe, Shield,
  Building2, Clock, Plus, Trash2, Settings, Upload, Database,
  UserCheck, Calendar, LayoutDashboard,
  Sliders
} from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { SettingsPage } from './components/SettingsPage';
import { DashboardView } from './components/DashboardView';
import { CurriculumStudio } from './components/CurriculumStudio';
import type { User, UserRole } from './types/auth';

interface MetricReport {
  faculty_gaps: number;
  student_gaps: number;
  room_capacity_waste: number;
  distribution_excess: number;
  rooms_used: number;
  composite_score: number;
}

interface ValidationReport {
  status: string;
  is_valid: boolean;
  violations: Array<{
    check_id: string;
    entity_type: string;
    entity_id: string;
    slot_index?: number;
    message: string;
  }>;
}

interface Placement {
  instance_id: string;
  requirement_id: string;
  start_slot: number;
  duration_slots: number;
  day: number;
  period: number;
  assigned_faculty_ids: string[];
  assigned_room_id: string | null;
}

interface SnapshotData {
  snapshot_id: string;
  institution_id: string;
  institution_name: string;
  state_or_ut: string;
  problem_statement_id: string;
  time_grid: {
    num_days: number;
    periods_per_day: number;
  };
  student_groups: Array<{
    group_id: string;
    name: string;
    parent_id?: string;
    expected_strength: number;
    program_type: string;
    semester: number;
  }>;
  rooms: Array<{
    room_id: string;
    name: string;
    room_type_id: string;
    capacity: number;
    features: string[];
  }>;
  faculty: Array<{
    faculty_id: string;
    name: string;
    department_id: string;
    designation: string;
    max_hours_week: number;
    max_hours_day: number;
    unavailable_slots: number[];
  }>;
  requirements: Array<{
    requirement_id: string;
    course_id: string;
    course_name: string;
    offering_id: string;
    group_ids: string[];
    session_type: string;
    nep_category: string;
    credits: number;
    program_type: string;
    sessions_per_week: number;
    duration_slots: number;
    room_type_id?: string;
    eligible_faculty_ids: string[];
  }>;
  elective_groups: Array<{
    elective_group_id: string;
    name: string;
    mode: string;
    nep_category: string;
    member_requirement_ids: string[];
    attached_group_ids: string[];
  }>;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [metrics, setMetrics] = useState<MetricReport | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [activeProfile, setActiveProfile] = useState<string>('BALANCED');
  const [loading, setLoading] = useState<boolean>(true);
  const [solving, setSolving] = useState<boolean>(false);
  const [solveTime, setSolveTime] = useState<number>(0.85);

  // User Authentication & Role State (supports hello@123.com / 123)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('acadence_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Dark & Light Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('acadence_theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('acadence_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const isDark = theme === 'dark';

  // Top Nav Main View: 'DASHBOARD' | 'TIMETABLE' | 'INPUT_STUDIO' | 'CURRICULUM' | 'SETTINGS'
  const [mainView, setMainView] = useState<'DASHBOARD' | 'TIMETABLE' | 'INPUT_STUDIO' | 'CURRICULUM' | 'SETTINGS'>('DASHBOARD');
  const [inputStudioTab, setInputStudioTab] = useState<'COURSES' | 'FACULTY' | 'ROOMS' | 'STUDENT_PATHWAY' | 'CSV'>('COURSES');

  // Academic Degree Programs Catalog for Filters (strictly derived from registered courses in Settings)
  const [availablePrograms, setAvailablePrograms] = useState<Array<{ id: string; label: string; badge: string }>>([
    { id: 'ALL', label: 'All Programs (Unified)', badge: 'Master' },
    { id: 'BTECH_CSE', label: 'B.Tech CSE', badge: '4 Years' },
  ]);

  // Timetable Filters
  const [selectedProgram, setSelectedProgram] = useState<string>('ALL');
  const [viewType, setViewType] = useState<'GROUP' | 'FACULTY' | 'ROOM'>('GROUP');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('GRP_FYUP_SEC_A');

  // Interactive Live Move
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [validTargetSlots, setValidTargetSlots] = useState<number[]>([]);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  // Modals
  const [showBasketModal, setShowBasketModal] = useState<boolean>(false);
  const [showWorkloadModal, setShowWorkloadModal] = useState<boolean>(false);

  // Add Course Modal State
  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [newCourseCode, setNewCourseCode] = useState<string>('SEC-AI-202');
  const [newCourseName, setNewCourseName] = useState<string>('Artificial Intelligence & Prompt Engineering Lab');
  const [newCourseProgram, setNewCourseProgram] = useState<string>('FYUP');
  const [newCourseCategory, setNewCourseCategory] = useState<string>('SEC');
  const [newCourseCredits, setNewCourseCredits] = useState<number>(2);
  const [newCourseDuration, setNewCourseDuration] = useState<number>(2);
  const [newCourseSessions, setNewCourseSessions] = useState<number>(1);
  const [newCourseGroup, setNewCourseGroup] = useState<string>('GRP_FYUP_SEC_A');
  const [newCourseFaculty, setNewCourseFaculty] = useState<string>('FAC_CS_01');
  const [newCourseRoomType, setNewCourseRoomType] = useState<string>('COMPUTER_LAB');

  // Add Faculty Modal State
  const [showAddFacultyModal, setShowAddFacultyModal] = useState<boolean>(false);
  const [newFacId, setNewFacId] = useState<string>('FAC_NEW_01');
  const [newFacName, setNewFacName] = useState<string>('Dr. Rajesh Sharma');
  const [newFacDept, setNewFacDept] = useState<string>('DATA_SCIENCE');
  const [newFacDesig, setNewFacDesig] = useState<string>('Assistant Professor');
  const [newFacMaxHours, setNewFacMaxHours] = useState<number>(16);

  // Student Pathway State
  const [pathwayGroup, setPathwayGroup] = useState<string>('GRP_FYUP_SEC_A');
  const [pathwayMinor, setPathwayMinor] = useState<string>('REQ_MINOR_ECO');
  const [pathwayPlacements, setPathwayPlacements] = useState<Placement[]>([]);

  // CSV Ingestion State
  const [csvType, setCsvType] = useState<string>('COURSES');
  const [csvText, setCsvText] = useState<string>('');
  const [csvUploading, setCsvUploading] = useState<boolean>(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = [
    { p: 0, label: 'P1', time: '08:30 - 09:20' },
    { p: 1, label: 'P2', time: '09:20 - 10:10' },
    { p: 2, label: 'P3', time: '10:10 - 11:00' },
    { p: 3, label: 'P4', time: '11:30 - 12:20' }, // Lunch break after P3
    { p: 4, label: 'P5', time: '12:20 - 13:10' },
    { p: 5, label: 'P6', time: '13:10 - 14:00' },
    { p: 6, label: 'P7', time: '14:00 - 14:50' },
    { p: 7, label: 'P8', time: '14:50 - 15:40' },
  ];

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [snapRes, timeRes, progRes] = await Promise.all([
          fetch('/api/snapshot').then(r => r.json()),
          fetch('/api/timetable').then(r => r.json()),
          fetch('/api/curriculum/programs').then(r => r.json()).catch(() => []),
        ]);
        setSnapshot(snapRes);
        setPlacements(timeRes.placements || []);
        setMetrics(timeRes.metrics || null);
        setValidation(timeRes.validation || null);
        setActiveProfile(timeRes.profile || 'BALANCED');
        if (progRes && Array.isArray(progRes) && progRes.length > 0) {
          setAvailablePrograms([
            { id: 'ALL', label: 'All Programs (Unified)', badge: 'Master' },
            ...progRes.map((p: any) => ({
              id: p.program_id,
              label: p.short_code || p.name,
              badge: `${p.duration_years} Years`,
            })),
          ]);
        }
        if (snapRes.student_groups && snapRes.student_groups.length > 0) {
          const firstLeaf = snapRes.student_groups.find((g: any) => g.parent_id) || snapRes.student_groups[0];
          setSelectedEntityId(firstLeaf.group_id);
          setPathwayGroup(firstLeaf.group_id);
        }
      } catch (err) {
        console.error('Failed to connect to Acadence API:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Update pathway timetable when choices change
  useEffect(() => {
    async function fetchPathway() {
      if (!pathwayGroup) return;
      try {
        const res = await fetch('/api/student/pathway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_id: pathwayGroup,
            chosen_minor_req_id: pathwayMinor,
          }),
        });
        const data = await res.json();
        setPathwayPlacements(data.placements || []);
      } catch (err) {
        console.error(err);
      }
    }
    fetchPathway();
  }, [pathwayGroup, pathwayMinor, placements]);

  // Program selection
  function handleSelectProgram(prog: string) {
    setSelectedProgram(prog);
    if (!snapshot) return;
    if (prog === 'ALL') {
      const firstLeaf = snapshot.student_groups.find(g => g.parent_id) || snapshot.student_groups[0];
      if (firstLeaf) setSelectedEntityId(firstLeaf.group_id);
    } else {
      const match = snapshot.student_groups.find(g => (g.program_type === prog || g.group_id.includes(prog) || g.name.toLowerCase().includes(prog.toLowerCase())) && g.parent_id) 
                 || snapshot.student_groups.find(g => g.program_type === prog || g.group_id.includes(prog) || g.name.toLowerCase().includes(prog.toLowerCase()));
      if (match) setSelectedEntityId(match.group_id);
    }
  }

  // Generate / Re-optimize
  async function handleGenerate(profileName: string) {
    try {
      setSolving(true);
      setSelectedInstanceId(null);
      setValidTargetSlots([]);
      setMoveMessage(null);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_name: profileName, time_limit_seconds: 15.0 }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlacements(data.placements);
        setMetrics(data.metrics);
        setValidation(data.validation);
        setActiveProfile(data.profile);
        setSolveTime(data.solve_time_seconds);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSolving(false);
    }
  }

  // Handle Add Course Submit
  async function handleAddCourseSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSolving(true);
      const res = await fetch('/api/admin/add-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: newCourseCode,
          course_name: newCourseName,
          program_type: newCourseProgram,
          nep_category: newCourseCategory,
          group_ids: [newCourseGroup],
          session_type: newCourseDuration > 1 ? 'PRACTICAL' : 'LECTURE',
          credits: Number(newCourseCredits),
          sessions_per_week: Number(newCourseSessions),
          duration_slots: Number(newCourseDuration),
          room_type_id: newCourseRoomType,
          eligible_faculty_ids: [newCourseFaculty],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlacements(data.placements);
        setValidation(data.validation);
        setShowAddCourseModal(false);
        // Refresh snapshot
        const snapRes = await fetch('/api/snapshot').then(r => r.json());
        setSnapshot(snapRes);
        setMoveMessage(`Successfully registered ${newCourseCode} & generated optimal conflict-free schedule!`);
        setTimeout(() => setMoveMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSolving(false);
    }
  }

  // Handle Delete Course
  async function handleDeleteCourse(reqId: string) {
    if (!confirm(`Are you sure you want to delete course requirement ${reqId}?`)) return;
    try {
      setSolving(true);
      const res = await fetch(`/api/admin/course/${reqId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPlacements(data.placements);
        setValidation(data.validation);
        const snapRes = await fetch('/api/snapshot').then(r => r.json());
        setSnapshot(snapRes);
        setMoveMessage(`Deleted ${reqId} and re-optimized timetable.`);
        setTimeout(() => setMoveMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSolving(false);
    }
  }

  // Toggle Faculty Availability
  async function handleToggleFacultySlot(facId: string, slotIdx: number) {
    try {
      setSolving(true);
      const res = await fetch('/api/admin/toggle-faculty-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty_id: facId, slot_index: slotIdx }),
      });
      const data = await res.json();
      if (data.success) {
        setPlacements(data.placements);
        setValidation(data.validation);
        const snapRes = await fetch('/api/snapshot').then(r => r.json());
        setSnapshot(snapRes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSolving(false);
    }
  }

  // Reset to default pilot
  async function handleResetDefault() {
    if (!confirm('Reset entire system to standard baseline academic dataset?')) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnapshot(data.snapshot);
        setPlacements(data.placements);
        setMoveMessage('Reset to baseline academic dataset.');
        setTimeout(() => setMoveMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Refresh all snapshot and timetable state
  async function handleRefreshAllData() {
    try {
      const [snapRes, timeRes, progRes] = await Promise.all([
        fetch('/api/snapshot').then(r => r.json()),
        fetch('/api/timetable').then(r => r.json()),
        fetch('/api/curriculum/programs').then(r => r.json()).catch(() => []),
      ]);
      setSnapshot(snapRes);
      setPlacements(timeRes.placements || []);
      setMetrics(timeRes.metrics || null);
      setValidation(timeRes.validation || null);
      if (progRes && Array.isArray(progRes) && progRes.length > 0) {
        setAvailablePrograms([
          { id: 'ALL', label: 'All Programs (Unified)', badge: 'Master' },
          ...progRes.map((p: any) => ({
            id: p.program_id,
            label: p.short_code || p.name,
            badge: `${p.duration_years} Years`,
          })),
        ]);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }

  // Session Click -> Compute Valid Targets
  async function handleSessionClick(instanceId: string) {
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
      setValidTargetSlots([]);
      setMoveMessage(null);
      return;
    }
    setSelectedInstanceId(instanceId);
    setMoveMessage("Conflict Check Engine computing valid clash-free target slots...");
    try {
      const res = await fetch(`/api/timetable/valid-targets/${instanceId}`);
      const data = await res.json();
      setValidTargetSlots(data.valid_target_slots || []);
      setMoveMessage(`Found ${data.valid_target_slots.length} clash-free target slots! Click any glowing slot to move.`);
    } catch (err) {
      console.error(err);
    }
  }

  // Execute Move
  async function handleSlotClick(slotIdx: number) {
    if (!selectedInstanceId || !validTargetSlots.includes(slotIdx)) return;
    try {
      setMoveMessage("Applying move with Independent Validator verification...");
      const res = await fetch('/api/timetable/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: selectedInstanceId,
          new_start_slot: slotIdx,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlacements(data.placements);
        setMetrics(data.metrics);
        setValidation(data.validation);
        setSelectedInstanceId(null);
        setValidTargetSlots([]);
        setMoveMessage("Move independently validated & applied with zero clashes!");
        setTimeout(() => setMoveMessage(null), 3000);
      } else {
        setMoveMessage(`Move rejected by validator: ${data.violations?.[0]?.message || 'Clash'}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Handle CSV Ingestion
  async function handleCsvUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!csvText.trim()) return;
    try {
      setCsvUploading(true);
      setCsvMessage(null);
      const res = await fetch('/api/admin/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_type: csvType,
          csv_content: csvText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCsvMessage(data.message);
        setCsvText('');
        const [snapRes, timeRes] = await Promise.all([
          fetch('/api/snapshot').then(r => r.json()),
          fetch('/api/timetable').then(r => r.json()),
        ]);
        setSnapshot(snapRes);
        setPlacements(timeRes.placements || []);
      } else {
        setCsvMessage(`Error: ${data.message}`);
      }
    } catch (err: any) {
      setCsvMessage(`Upload failed: ${err.message}`);
    } finally {
      setCsvUploading(false);
    }
  }

  function handleLoadSampleCsv() {
    if (csvType === 'COURSES') {
      setCsvText(
        "course_id,course_name,program_type,nep_category,credits,sessions_per_week,duration_slots,group_ids,room_type_id,eligible_faculty_ids\n" +
        "VAC-ENV-101,Environmental Studies & Sustainability,FYUP,VAC,2,2,1,GRP_FYUP_SEC_A;GRP_FYUP_SEC_B,LECTURE_HALL,FAC_BIO_01\n" +
        "SEC-DS-201,Data Visualization Lab with Python,FYUP,SEC,2,1,2,GRP_FYUP_SEC_A,COMPUTER_LAB,FAC_CS_02\n" +
        "B_ED-PED-301,Pedagogy of Biological Sciences,B_ED,MAJOR,4,3,1,GRP_BED_SEM3,PEDAGOGY_ROOM,FAC_EDU_02"
      );
    } else if (csvType === 'FACULTY') {
      setCsvText(
        "faculty_id,name,department_id,designation,max_hours_week,max_hours_day\n" +
        "FAC_BIO_01,Dr. Salim Ali,BIOLOGY,Professor,14,4\n" +
        "FAC_STAT_01,Dr. P.C. Mahalanobis,STATISTICS,Professor,14,4\n" +
        "FAC_EDU_05,Dr. Maria Montessori,EDUCATION,Assistant Professor,16,4"
      );
    } else {
      setCsvText(
        "room_id,name,room_type_id,capacity,features\n" +
        "SMART_LH_104,Multidisciplinary Lecture Hall 104,LECTURE_HALL,80,SMART_BOARD;AUDIO_VISUAL\n" +
        "BIO_LAB_1,Cell Biology & Genetics Lab,SCIENCE_LAB,40,LAB_EQUIPMENT\n" +
        "AI_RESEARCH_LAB,Advanced AI & Robotics Center,COMPUTER_LAB,50,HIGH_PERF_COMPUTING"
      );
    }
  }

  function handleRoleSwitch(role: UserRole) {
    if (!currentUser) return;
    const updated: User = { ...currentUser, role };
    setCurrentUser(updated);
    localStorage.setItem('acadence_auth_user', JSON.stringify(updated));
  }

  function handleLogout() {
    localStorage.removeItem('acadence_auth_user');
    setCurrentUser(null);
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-200 font-sans">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-xl">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Initializing Acadence Engine</h2>
            <p className="text-slate-400 text-sm mt-1">Connecting to Academic Domain Snapshot...</p>
          </div>
        </div>
      </div>
    );
  }

  // Maps
  const reqMap = new Map((snapshot?.requirements || []).map(r => [r.requirement_id, r]));
  const facultyMap = new Map((snapshot?.faculty || []).map(f => [f.faculty_id, f]));
  const facMap = facultyMap;
  const roomMap = new Map((snapshot?.rooms || []).map(r => [r.room_id, r]));
  const groupMap = new Map((snapshot?.student_groups || []).map(g => [g.group_id, g]));

  // Groups
  const filteredGroups = (snapshot?.student_groups || []).filter(g => {
    if (selectedProgram === 'ALL') return true;
    return g.program_type === selectedProgram;
  });

  // Build grid map for active view
  const activeGridPlacements = mainView === 'TIMETABLE' ? placements : pathwayPlacements;
  const gridCells = new Map<string, Placement>();
  for (const p of activeGridPlacements) {
    const req = reqMap.get(p.requirement_id);
    if (!req) continue;

    let isVisible = false;
    if (mainView === 'TIMETABLE') {
      if (viewType === 'GROUP') {
        isVisible = req.group_ids.includes(selectedEntityId);
      } else if (viewType === 'FACULTY') {
        isVisible = p.assigned_faculty_ids.includes(selectedEntityId);
      } else if (viewType === 'ROOM') {
        isVisible = p.assigned_room_id === selectedEntityId;
      }
    } else {
      // Pathway view
      isVisible = true;
    }

    if (isVisible) {
      for (let step = 0; step < p.duration_slots; step++) {
        const slotIdx = p.start_slot + step;
        const d = Math.floor(slotIdx / 8);
        const per = slotIdx % 8;
        gridCells.set(`${d}-${per}`, p);
      }
    }
  }

  function getNEPCategoryStyle(category?: string) {
    if (!isDark) {
      // Premium Light Mode Palette (Clean pastel cards with deep readable contrast)
      switch (category) {
        case 'MAJOR':
          return {
            bg: 'bg-blue-50/95 border-blue-200 hover:border-blue-400 text-blue-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-blue-100 text-blue-800 border-blue-300/80',
            label: 'Major Core',
            icon: BookOpen,
          };
        case 'MINOR':
          return {
            bg: 'bg-purple-50/95 border-purple-200 hover:border-purple-400 text-purple-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-purple-100 text-purple-800 border-purple-300/80',
            label: 'Minor Basket',
            icon: GitFork,
          };
        case 'SEC':
          return {
            bg: 'bg-emerald-50/95 border-emerald-200 hover:border-emerald-400 text-emerald-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-emerald-100 text-emerald-800 border-emerald-300/80',
            label: 'SEC Skill Lab',
            icon: Cpu,
          };
        case 'AEC':
          return {
            bg: 'bg-amber-50/95 border-amber-200 hover:border-amber-400 text-amber-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-amber-100 text-amber-800 border-amber-300/80',
            label: 'AEC Core',
            icon: Globe,
          };
        case 'VAC':
          return {
            bg: 'bg-orange-50/95 border-orange-200 hover:border-orange-400 text-orange-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-orange-100 text-orange-800 border-orange-300/80',
            label: 'VAC Ethics',
            icon: Shield,
          };
        case 'TEACHING_PRACTICE':
          return {
            bg: 'bg-rose-50/95 border-rose-200 hover:border-rose-400 text-rose-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-rose-100 text-rose-800 border-rose-300/80',
            label: 'Practicum (2h)',
            icon: GraduationCap,
          };
        default:
          return {
            bg: 'bg-indigo-50/95 border-indigo-200 hover:border-indigo-400 text-indigo-950 shadow-xs hover:shadow-md transition-all',
            badge: 'bg-indigo-100 text-indigo-800 border-indigo-300/80',
            label: 'Course',
            icon: BookOpen,
          };
      }
    } else {
      // Cosmic Dark Mode Palette (Neon accents with subtle glow)
      switch (category) {
        case 'MAJOR':
          return {
            bg: 'bg-blue-950/40 border-blue-500/30 hover:border-blue-400 text-blue-100 shadow-sm hover:shadow-indigo-500/10 transition-all',
            badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            label: 'Major Core',
            icon: BookOpen,
          };
        case 'MINOR':
          return {
            bg: 'bg-purple-950/45 border-purple-500/30 hover:border-purple-400 text-purple-100 shadow-sm hover:shadow-purple-500/10 transition-all',
            badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            label: 'Minor Basket',
            icon: GitFork,
          };
        case 'SEC':
          return {
            bg: 'bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-400 text-emerald-100 shadow-sm hover:shadow-emerald-500/10 transition-all',
            badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            label: 'SEC Skill Lab',
            icon: Cpu,
          };
        case 'AEC':
          return {
            bg: 'bg-amber-950/40 border-amber-500/30 hover:border-amber-400 text-amber-100 shadow-sm hover:shadow-amber-500/10 transition-all',
            badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            label: 'AEC Core',
            icon: Globe,
          };
        case 'VAC':
          return {
            bg: 'bg-orange-950/40 border-orange-500/30 hover:border-orange-400 text-orange-100 shadow-sm hover:shadow-orange-500/10 transition-all',
            badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            label: 'VAC Ethics',
            icon: Shield,
          };
        case 'TEACHING_PRACTICE':
          return {
            bg: 'bg-rose-950/45 border-rose-500/30 hover:border-rose-400 text-rose-100 shadow-sm hover:shadow-rose-500/10 transition-all',
            badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
            label: 'Practicum (2h)',
            icon: GraduationCap,
          };
        default:
          return {
            bg: 'bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-400 text-indigo-100 shadow-sm hover:shadow-indigo-500/10 transition-all',
            badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
            label: 'Course',
            icon: BookOpen,
          };
      }
    }
  }

  // Minor basket details
  const minorGroup = snapshot?.elective_groups?.find(eg => eg.nep_category === 'MINOR');
  const minorPlacements = placements.filter(p => minorGroup?.member_requirement_ids?.includes(p.requirement_id));
  const minorSlots = Array.from(new Set(minorPlacements.map(p => p.start_slot))).sort((a, b) => a - b);

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* 0. Collapsible Sidebar Navigation, Profile, Solver, Exports & Role Switcher */}
      <Sidebar
        currentView={mainView}
        onSelectView={setMainView}
        currentUser={currentUser}
        onRoleSwitch={handleRoleSwitch}
        onLogout={handleLogout}
        validatorStatus={{ isValid: validation?.is_valid ?? false }}
        activeProfile={activeProfile}
        onSelectProfile={(p) => {
          setActiveProfile(p);
          handleGenerate(p);
        }}
        onReoptimize={() => handleGenerate(activeProfile)}
        isSolving={solving}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Sleek Minimalist Breadcrumb & Status Bar */}
        <header className={`no-print shrink-0 border-b px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-2xl transition-colors ${
          isDark 
            ? 'border-slate-800/80 bg-slate-950/80 text-slate-100 shadow-sm' 
            : 'border-slate-200/90 bg-white/90 text-slate-900 shadow-xs'
        }`}>
          {/* Left: Breadcrumbs & Current Section Title */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shadow-xs border transition ${
              mainView === 'DASHBOARD' 
                ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25' 
                : mainView === 'TIMETABLE' 
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/25'
                  : mainView === 'CURRICULUM'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/25'
                    : mainView === 'INPUT_STUDIO'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                      : 'bg-purple-500/10 text-purple-500 border-purple-500/25'
            }`}>
              {mainView === 'DASHBOARD' && <LayoutDashboard className="w-4 h-4" />}
              {mainView === 'TIMETABLE' && <Calendar className="w-4 h-4" />}
              {mainView === 'CURRICULUM' && <GraduationCap className="w-4 h-4" />}
              {mainView === 'INPUT_STUDIO' && <Database className="w-4 h-4" />}
              {mainView === 'SETTINGS' && <Sliders className="w-4 h-4" />}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`font-bold tracking-wider uppercase text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ACADENCE</span>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>/</span>
              <span className="font-extrabold text-sm tracking-tight">
                {mainView === 'DASHBOARD' && 'Campus Dashboard'}
                {mainView === 'TIMETABLE' && 'Timetable Schedule Matrix'}
                {mainView === 'CURRICULUM' && 'Course & Subject Curriculum Studio'}
                {mainView === 'INPUT_STUDIO' && 'Academic Data Studio'}
                {mainView === 'SETTINGS' && 'Administration & RBAC'}
              </span>
              <span className={`hidden sm:inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                {snapshot?.institution_name || 'Metropolitan University'} • Fall 2026
              </span>
            </div>
          </div>

          {/* Right: Live Engine Indicator & User Profile Pill */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition ${
              validation?.is_valid
                ? isDark
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : isDark
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-400'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  validation?.is_valid ? 'bg-emerald-400' : 'bg-rose-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  validation?.is_valid ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
              </span>
              <span>{validation?.is_valid ? 'CP-SAT Engine 0 Clashes' : 'Clash Detected'}</span>
            </div>

            <div className={`hidden md:flex items-center gap-2.5 pl-3 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-xs">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <div className={`text-xs font-bold leading-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{currentUser.name}</div>
                <div className="text-[10px] font-medium text-indigo-500">{currentUser.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Role Access Banners */}
        {currentUser.role === 'STUDENT' && (
          <div className={`no-print shrink-0 border-b px-6 py-2 text-xs flex items-center justify-between ${
            isDark ? 'bg-amber-950/60 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <span>Student Cohort Mode — Viewing FYUP / B.Ed. Multidisciplinary Schedule. Editing & solver runs are locked.</span>
            </span>
            <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
              isDark ? 'bg-amber-900 border-amber-500/40' : 'bg-amber-100 border-amber-300 text-amber-800'
            }`}>
              STUDENT READ-ONLY
            </span>
          </div>
        )}

        {currentUser.role === 'FACULTY' && (
          <div className={`no-print shrink-0 border-b px-6 py-2 text-xs flex items-center justify-between ${
            isDark ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <span className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-500" />
              <span>Faculty Portal ({currentUser.name}) — Viewing personal teaching load & weekly timetable.</span>
            </span>
            <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
              isDark ? 'bg-emerald-900 border-emerald-500/40' : 'bg-emerald-100 border-emerald-300 text-emerald-800'
            }`}>
              FACULTY VIEW
            </span>
          </div>
        )}

      {/* Scrollable Viewport Container */}
      <div className="flex-1 overflow-y-auto app-bg-mesh">

        {/* ========================================================================= */}
        {/* VIEW 0: UNIVERSITY ANALYTICS DASHBOARD & KPI OVERVIEW                     */}
        {/* ========================================================================= */}
        {mainView === 'DASHBOARD' && (
          <DashboardView
            snapshot={snapshot}
            placements={placements}
            currentUser={currentUser}
            onNavigateInputStudio={(tab) => {
              if (tab === 'CURRICULUM') {
                setMainView('CURRICULUM');
              } else {
                setMainView('INPUT_STUDIO');
                if (tab) setInputStudioTab(tab as any);
              }
            }}
            onRefreshData={handleRefreshAllData}
            theme={theme}
          />
        )}

      {/* ========================================================================= */}
      {/* VIEW A: TIMETABLE SCHEDULE VIEWER                                         */}
      {/* ========================================================================= */}
      {mainView === 'TIMETABLE' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
          
          {/* Quick Notice to Go to Input Studio */}
          <div className={`no-print border rounded-xl p-3 flex flex-wrap items-center justify-between text-xs gap-2 transition ${
            isDark 
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-800 shadow-xs'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                Want to feed new courses, faculty hours, or upload student choice datasets?
              </span>
            </div>
            <button
              onClick={() => setMainView('INPUT_STUDIO')}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Open Academic Data Input Studio &rarr;</span>
            </button>
          </div>

          {/* Academic Program Selector Tabs */}
          <div className={`no-print border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 transition ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                Academic Program:
              </span>
              <div className={`flex flex-wrap gap-1 p-1 rounded-lg border max-w-3xl overflow-x-auto ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
              }`}>
                {availablePrograms.map(prog => (
                  <button
                    key={prog.id}
                    onClick={() => handleSelectProgram(prog.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      selectedProgram === prog.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isDark
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <span>{prog.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      selectedProgram === prog.id ? 'bg-indigo-700 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {prog.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setMainView('CURRICULUM')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isDark
                    ? 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Curriculum Studio &rarr;</span>
              </button>
              <button
                onClick={() => setShowBasketModal(true)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  isDark 
                    ? 'bg-purple-950/60 hover:bg-purple-900/60 border-purple-500/40 text-purple-300' 
                    : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700'
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Elective Basket (CON-H-011)</span>
              </button>
              <button
                onClick={() => setShowWorkloadModal(true)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' 
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Faculty Workload</span>
              </button>
            </div>
          </div>

          {/* Curriculum Category Legend & Soft Metrics */}
          <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-6 border rounded-xl p-4 flex flex-col justify-between transition ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Curriculum & Course Categories
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { cat: 'MAJOR', name: 'Major Core (DSC)', credits: '4 Cr', color: isDark ? 'border-blue-500/40 bg-blue-950/30 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700' },
                    { cat: 'MINOR', name: 'Minor Basket (PARALLEL)', credits: '4 Cr', color: isDark ? 'border-purple-500/40 bg-purple-950/30 text-purple-300' : 'border-purple-200 bg-purple-50 text-purple-700' },
                    { cat: 'SEC', name: 'SEC Skill Lab (2h)', credits: '2 Cr', color: isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                    { cat: 'AEC', name: 'AEC Environment', credits: '2 Cr', color: isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700' },
                    { cat: 'VAC', name: 'VAC Digital Ethics', credits: '2 Cr', color: isDark ? 'border-orange-500/40 bg-orange-950/30 text-orange-300' : 'border-orange-200 bg-orange-50 text-orange-700' },
                    { cat: 'TEACHING_PRACTICE', name: 'School Internship (2h)', credits: '4 Cr', color: isDark ? 'border-rose-500/40 bg-rose-950/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700' },
                  ].map(item => (
                    <div key={item.cat} className={`p-2 rounded-lg border ${item.color} flex flex-col justify-between`}>
                      <span className="text-xs font-bold leading-tight">{item.name}</span>
                      <span className="text-[10px] opacity-75 font-mono mt-1">{item.credits}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`lg:col-span-6 border rounded-xl p-4 flex flex-col justify-between transition ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Quality Scorecard (Soft Constraints CON-S)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className={`rounded-lg p-2.5 text-center border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-base font-black text-emerald-500">{metrics?.distribution_excess ?? 0}</div>
                  <div className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Spread Excess</div>
                  <div className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CON-S-008 (0 = Perfect)</div>
                </div>
                <div className={`rounded-lg p-2.5 text-center border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-base font-black text-emerald-500">{metrics?.faculty_gaps ?? 0} <span className="text-[10px] font-normal">hrs</span></div>
                  <div className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Faculty Idle Gaps</div>
                  <div className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CON-S-003</div>
                </div>
                <div className={`rounded-lg p-2.5 text-center border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-base font-black text-emerald-500">{metrics?.student_gaps ?? 0} <span className="text-[10px] font-normal">hrs</span></div>
                  <div className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Student Idle Gaps</div>
                  <div className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CON-S-004</div>
                </div>
                <div className={`rounded-lg p-2.5 text-center border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-base font-black text-indigo-500">{metrics?.composite_score ?? 0}</div>
                  <div className={`text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Objective Score</div>
                  <div className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Solved in {solveTime.toFixed(2)}s</div>
                </div>
              </div>
            </div>
          </div>

          {/* View Filter Controls */}
          <div className={`no-print flex flex-wrap items-center justify-between gap-4 border px-4 py-3 rounded-xl transition ${
            isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex items-center flex-wrap gap-3">
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Schedule View:
              </span>
              <div className={`flex rounded-lg p-1 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <button
                  onClick={() => {
                    setViewType('GROUP');
                    const firstGroup = filteredGroups[0] || snapshot?.student_groups[0];
                    if (firstGroup) setSelectedEntityId(firstGroup.group_id);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                    viewType === 'GROUP' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Student Cohort / Section
                </button>
                <button
                  onClick={() => {
                    setViewType('FACULTY');
                    if (snapshot?.faculty[0]) setSelectedEntityId(snapshot.faculty[0].faculty_id);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                    viewType === 'FACULTY' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Faculty Member
                </button>
                <button
                  onClick={() => {
                    setViewType('ROOM');
                    if (snapshot?.rooms[0]) setSelectedEntityId(snapshot.rooms[0].room_id);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                    viewType === 'ROOM' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Physical Room / Lab
                </button>
              </div>

              {/* Entity Dropdown */}
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className={`text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 border cursor-pointer ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {viewType === 'GROUP' && (
                  filteredGroups.map(g => (
                    <option key={g.group_id} value={g.group_id}>
                      {g.name} ({g.expected_strength} Students)
                    </option>
                  ))
                )}
                {viewType === 'FACULTY' && (
                  snapshot?.faculty.map(f => (
                    <option key={f.faculty_id} value={f.faculty_id}>
                      {f.name} — {f.designation} ({f.department_id})
                    </option>
                  ))
                )}
                {viewType === 'ROOM' && (
                  snapshot?.rooms.map(r => (
                    <option key={r.room_id} value={r.room_id}>
                      {r.name} ({r.room_type_id}, Cap: {r.capacity})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Move Instruction */}
            <div className="flex items-center gap-2 text-xs">
              {moveMessage ? (
                <span className="text-amber-500 font-medium flex items-center gap-1.5 animate-pulse">
                  <Move className="w-3.5 h-3.5" />
                  {moveMessage}
                </span>
              ) : (
                <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Move className="w-3.5 h-3.5 text-indigo-500" />
                  Click any course card to calculate clash-free target slots in real-time.
                </span>
              )}
            </div>
          </div>

          {/* Official Printable Circular Header (Appears only on Print / PDF export) */}
          <div className="print-only mb-6 border-b-2 border-slate-700 pb-3 text-center">
            <div className="text-xl font-black uppercase tracking-wider text-slate-900">Academic Affairs & Course Scheduling</div>
            <div className="text-sm font-bold text-slate-800">Master Institutional Timetable</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{snapshot?.institution_name || 'Metropolitan University'}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">
              Autonomous Conflict-Free Academic Timetable & Scheduling System
            </div>
            <div className="text-xs font-bold text-indigo-950 mt-1 uppercase tracking-wide">
              OFFICIAL TIMETABLE CIRCULAR • {viewType === 'GROUP' ? `STUDENT COHORT: ${groupMap.get(selectedEntityId)?.name || selectedEntityId}` : viewType === 'FACULTY' ? `FACULTY MEMBER: ${facMap.get(selectedEntityId)?.name || selectedEntityId}` : `CAMPUS FACILITY: ${roomMap.get(selectedEntityId)?.name || selectedEntityId}`}
            </div>
          </div>

          {/* Master Timetable Grid */}
          <div className={`border rounded-xl overflow-hidden shadow-2xl transition ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-xs font-semibold ${
                    isDark ? 'border-slate-800 bg-slate-900/90 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-700'
                  }`}>
                    <th className={`py-3 px-4 w-32 border-r ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>Day</th>
                    {periods.map((per, idx) => (
                      <React.Fragment key={per.p}>
                        {idx === 3 && (
                          <th className={`py-3 px-2 w-10 text-center bg-amber-500/5 text-amber-500/80 border-r text-[10px] uppercase font-bold tracking-widest writing-vertical ${
                            isDark ? 'border-slate-800' : 'border-slate-200'
                          }`}>
                            Lunch
                          </th>
                        )}
                        <th className={`py-3 px-3 text-center border-r min-w-[145px] ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                          <div>{per.label}</div>
                          <div className={`text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{per.time}</div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y text-xs ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {days.map((dayName, dIdx) => (
                    <tr key={dayName} className={`transition ${isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50'}`}>
                      <td className={`py-4 px-4 font-bold border-r ${
                        isDark ? 'text-slate-300 bg-slate-900/30 border-slate-800' : 'text-slate-800 bg-slate-50 border-slate-200'
                      }`}>
                        {dayName}
                      </td>
                      {periods.map((per, pIdx) => {
                        const globalSlotIdx = dIdx * 8 + pIdx;
                        const cellPlacement = gridCells.get(`${dIdx}-${pIdx}`);
                        const isValidTarget = validTargetSlots.includes(globalSlotIdx);
                        const isSelectedSession = selectedInstanceId && cellPlacement?.instance_id === selectedInstanceId;

                        const req = cellPlacement ? reqMap.get(cellPlacement.requirement_id) : null;
                        const style = getNEPCategoryStyle(req?.nep_category);
                        const CategoryIcon = style.icon;

                        return (
                          <React.Fragment key={per.p}>
                            {pIdx === 3 && (
                              <td className={`border-r text-center text-slate-500 text-[10px] ${
                                isDark ? 'bg-amber-500/5 border-slate-800' : 'bg-amber-500/10 border-slate-200'
                              }`}>
                                ☕
                              </td>
                            )}
                            <td 
                              onClick={() => {
                                if (isValidTarget) {
                                  handleSlotClick(globalSlotIdx);
                                } else if (cellPlacement) {
                                  handleSessionClick(cellPlacement.instance_id);
                                }
                              }}
                              className={`p-2 border-r align-top transition cursor-pointer relative h-32 ${
                                isDark ? 'border-slate-800' : 'border-slate-200'
                              } ${
                                isValidTarget 
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 ring-2 ring-emerald-400 ring-inset' 
                                  : isSelectedSession
                                    ? 'bg-indigo-600/30 ring-2 ring-indigo-400 ring-inset'
                                    : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                              }`}
                            >
                              {cellPlacement ? (
                                <div className={`h-full rounded-lg p-2.5 flex flex-col justify-between shadow-xs border transition ${style.bg}`}>
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-extrabold text-xs tracking-tight">
                                        {req?.course_id}
                                      </span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase flex items-center gap-1 ${style.badge}`}>
                                        <CategoryIcon className="w-2.5 h-2.5" />
                                        {style.label}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-semibold leading-tight line-clamp-1">
                                      {req?.course_name}
                                    </div>
                                  </div>

                                  <div className={`mt-2 pt-1 border-t text-[10px] space-y-0.5 ${
                                    isDark ? 'border-slate-800/60 text-slate-400' : 'border-slate-200 text-slate-600'
                                  }`}>
                                    <div className={`flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                      <DoorOpen className="w-3 h-3 opacity-70" />
                                      <span className="truncate">
                                        {cellPlacement.assigned_room_id ? roomMap.get(cellPlacement.assigned_room_id)?.name : 'Virtual'}
                                      </span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                      <Users className="w-3 h-3 opacity-70" />
                                      <span className="truncate">
                                        {cellPlacement.assigned_faculty_ids.map(id => facultyMap.get(id)?.name).join(', ')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : isValidTarget ? (
                                <div className="h-full rounded-lg border-2 border-dashed border-emerald-400/60 flex flex-col items-center justify-center text-center p-2 text-emerald-400 text-xs font-semibold">
                                  <Move className="w-4 h-4 mb-1 animate-bounce" />
                                  Move Here
                                </div>
                              ) : (
                                <div className={`h-full flex items-center justify-center text-xs ${
                                  isDark ? 'text-slate-800' : 'text-slate-300'
                                }`}>
                                  ---
                                </div>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW C: COURSE & SUBJECT CURRICULUM HIERARCHY STUDIO                     */}
      {/* ========================================================================= */}
      {mainView === 'CURRICULUM' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
          <CurriculumStudio
            theme={theme}
            onNavigateTimetable={(progId) => {
              setMainView('TIMETABLE');
              if (progId) handleSelectProgram(progId);
            }}
            onRefreshData={handleRefreshAllData}
          />
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: ACADEMIC DATA INPUT & MANAGEMENT STUDIO                            */}
      {/* ========================================================================= */}
      {mainView === 'INPUT_STUDIO' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
          
          {/* Header Banner */}
          <div className={`border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 transition ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${
                  isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <h2 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Academic Data Input Studio</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/30">
                  Academic Data Portal
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Input curriculum structures, faculty availability windows, room infrastructure, or student elective choices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDefault}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                Reset Default Baseline Data
              </button>
              <button
                onClick={() => setMainView('TIMETABLE')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Return to Schedule View &rarr;</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className={`flex flex-wrap items-center gap-2 border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            {[
              { id: 'COURSES', label: '1. Course Offerings Master List', icon: BookOpen, count: snapshot?.requirements.length },
              { id: 'FACULTY', label: '2. Faculty & Availability Constraints', icon: Users, count: snapshot?.faculty.length },
              { id: 'ROOMS', label: '3. Classrooms & Specialized Labs', icon: DoorOpen, count: snapshot?.rooms.length },
              { id: 'STUDENT_PATHWAY', label: '4. Student Elective Pathway Simulator', icon: UserCheck },
              { id: 'CSV', label: '5. Bulk CSV Ingestion & Templates', icon: Upload },
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setInputStudioTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
                    inputStudioTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : isDark
                        ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                        : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* TAB 1: COURSES & CURRICULUM INPUT                             */}
          {/* ------------------------------------------------------------- */}
          {inputStudioTab === 'COURSES' && (
            <div className="space-y-4">
              {/* Quick Link to Curriculum Studio Banner */}
              <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isDark ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-indigo-50/70 border-indigo-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-900'}`}>
                      Looking for Degree Programs, Year-Wise Semesters & Subject Trees?
                    </h4>
                    <p className={`text-[11px] ${isDark ? 'text-indigo-300/80' : 'text-indigo-700/80'}`}>
                      Manage hierarchical degree programs (1st, 2nd, 3rd, 4th Year) and semester-wise mappings in the dedicated Curriculum Studio.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMainView('CURRICULUM')}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open Curriculum Studio</span>
                  <span>&rarr;</span>
                </button>
              </div>

              <div className={`flex justify-between items-center p-4 rounded-xl border transition ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div>
                  <h3 className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Registered Course Offerings</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total {snapshot?.requirements.length} requirements registered across academic programs.</p>
                </div>
                <button
                  onClick={() => setShowAddCourseModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Course Offering</span>
                </button>
              </div>

              <div className={`border rounded-xl overflow-hidden shadow-lg transition ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b font-semibold ${
                        isDark ? 'border-slate-800 bg-slate-900/90 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Course Title</th>
                        <th className="py-3 px-3">Program</th>
                        <th className="py-3 px-3">Curriculum Category</th>
                        <th className="py-3 px-3 text-center">Credits</th>
                        <th className="py-3 px-3 text-center">Sessions/Wk</th>
                        <th className="py-3 px-3">Facility</th>
                        <th className="py-3 px-4">Eligible Teachers</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {(snapshot?.requirements || []).map(r => {
                        const style = getNEPCategoryStyle(r.nep_category);
                        return (
                          <tr key={r.requirement_id} className={`transition ${isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50'}`}>
                            <td className={`py-3 px-4 font-mono font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{r.course_id}</td>
                            <td className={`py-3 px-4 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{r.course_name}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {r.program_type}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${style.badge}`}>
                                {r.nep_category}
                              </span>
                            </td>
                            <td className={`py-3 px-3 text-center font-mono font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.credits}</td>
                            <td className="py-3 px-3 text-center font-mono">
                              {r.sessions_per_week} x {r.duration_slots}h
                            </td>
                            <td className={`py-3 px-3 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.room_type_id}</td>
                            <td className={`py-3 px-4 text-[11px] truncate max-w-[200px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {r.eligible_faculty_ids.map(id => facultyMap.get(id)?.name).join(', ')}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleDeleteCourse(r.requirement_id)}
                                title="Delete Course"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
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
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: FACULTY & AVAILABILITY CONSTRAINTS                      */}
          {/* ------------------------------------------------------------- */}
          {inputStudioTab === 'FACULTY' && (
            <div className="space-y-4">
              <div className={`flex justify-between items-center p-4 rounded-xl border transition ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div>
                  <h3 className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Teaching Faculty & Unavailability Constraints (CON-H-007)</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Click any professor to inspect or toggle their 5-day restricted time windows.</p>
                </div>
                <button
                  onClick={() => setShowAddFacultyModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Faculty Member</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(snapshot?.faculty || []).map(fac => {
                  const unavailSet = new Set(fac.unavailable_slots || []);
                  const facPlacements = placements.filter(p => p.assigned_faculty_ids.includes(fac.faculty_id));
                  const totalHours = facPlacements.reduce((sum, p) => sum + p.duration_slots, 0);

                  return (
                    <div 
                      key={fac.faculty_id}
                      className={`p-4 rounded-xl border space-y-3 transition ${
                        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{fac.name}</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fac.designation} • {fac.department_id}</div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-mono font-bold block ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{totalHours} hrs / week</span>
                          <span className="text-[10px] text-emerald-500 font-semibold">UGC Norm: Max {fac.max_hours_week}h</span>
                        </div>
                      </div>

                      {/* Mini 5-Day Availability Grid */}
                      <div className="space-y-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          Click slot to toggle Availability / Leave (Red = Unavailable):
                        </span>
                        <div className="grid grid-cols-8 gap-1 text-[9px] font-mono text-center">
                          {Array.from({ length: 40 }).map((_, slotIdx) => {
                            const isUnavail = unavailSet.has(slotIdx);
                            const day = Math.floor(slotIdx / 8);
                            const per = slotIdx % 8;
                            return (
                              <button
                                key={slotIdx}
                                onClick={() => handleToggleFacultySlot(fac.faculty_id, slotIdx)}
                                title={`${days[day]} P${per + 1}: ${isUnavail ? 'UNAVAILABLE (Click to make Available)' : 'Available (Click to restrict)'}`}
                                className={`p-1 rounded transition text-[9px] cursor-pointer ${
                                  isUnavail
                                    ? 'bg-rose-600 text-white font-bold ring-1 ring-rose-400'
                                    : isDark ? 'bg-slate-950 text-slate-400 hover:bg-slate-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {per === 3 ? '☕' : `P${per + 1}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: ROOMS & SPECIALIZED LABS                               */}
          {/* ------------------------------------------------------------- */}
          {inputStudioTab === 'ROOMS' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border transition ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <h3 className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Campus Classrooms & Specialized Labs (CON-H-003 / CON-H-005)</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total {snapshot?.rooms.length} facilities registered in the institution domain.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {(snapshot?.rooms || []).map(r => (
                  <div key={r.room_id} className={`p-4 rounded-xl border space-y-2 transition ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500 w-fit">
                      <DoorOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{r.name}</div>
                      <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.room_id}</div>
                    </div>
                    <div className={`pt-2 border-t flex justify-between items-center text-xs ${
                      isDark ? 'border-slate-800' : 'border-slate-200'
                    }`}>
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Type:</span>
                      <span className="font-bold text-indigo-500">{r.room_type_id}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Capacity:</span>
                      <span className="font-bold text-emerald-500">{r.capacity} Seats</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 4: STUDENT ELECTIVE PATHWAY SIMULATOR                      */}
          {/* ------------------------------------------------------------- */}
          {inputStudioTab === 'STUDENT_PATHWAY' && (
            <div className="space-y-4">
              <div className={`border rounded-2xl p-5 space-y-3 transition ${
                isDark ? 'bg-slate-900/60 border-purple-500/30' : 'bg-white border-purple-200 shadow-xs'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-600'}`}>
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Individual Student Elective Pathway Simulator</h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Students select individual elective and minor courses from multidisciplinary baskets. Select a cohort and a chosen minor to preview that student's personalized, clash-free schedule.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Select Student Section / Major Cohort:</label>
                    <select
                      value={pathwayGroup}
                      onChange={(e) => setPathwayGroup(e.target.value)}
                      className={`w-full text-xs rounded-xl p-2.5 transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="GRP_FYUP_SEC_A">FYUP Section A (Major: Computer Science)</option>
                      <option value="GRP_FYUP_SEC_B">FYUP Section B (Major: Modern Literature & Humanities)</option>
                      <option value="GRP_ITEP_SEM5">ITEP B.Sc.-B.Ed. (Semester 5)</option>
                      <option value="GRP_BED_SEM3">B.Ed. Teacher Education (Semester 3)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Student's Chosen Multidisciplinary Minor Basket Course:</label>
                    <select
                      value={pathwayMinor}
                      onChange={(e) => setPathwayMinor(e.target.value)}
                      className={`w-full text-xs rounded-xl p-2.5 transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="REQ_MINOR_ECO">Principles of Microeconomics (MIN-ECO-201) — Dr. Amartya Sen</option>
                      <option value="REQ_MINOR_MATH">Applied Linear Algebra (MIN-MTH-201) — Dr. Srinivasa Ramanujan</option>
                      <option value="REQ_MINOR_PSY">Cognitive Psychology (MIN-PSY-201) — Dr. B.F. Skinner</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pathway Summary */}
              <div className={`p-4 rounded-xl border flex justify-between items-center text-xs transition ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  Showing <strong>{pathwayPlacements.length} weekly sessions</strong> for student choice pathway.
                </span>
                <span className={`px-2.5 py-1 rounded font-bold border ${
                  isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  0 Clashes Guaranteed (VAL-004 & CON-H-011)
                </span>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 5: CSV INGESTION & TEMPLATES                              */}
          {/* ------------------------------------------------------------- */}
          {inputStudioTab === 'CSV' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border space-y-2 transition ${
                isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <h3 className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Bulk CSV Data Ingestion & Academic Management System (AMS) Sync</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Colleges can download standardized CSV templates, populate them in Excel, and import them directly into Acadence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border space-y-3 transition ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}>
                  <div className={`font-bold text-sm flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Courses Master CSV
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Course code, name, credits, theory/practical duration, and eligible teachers.</p>
                  <button 
                    onClick={() => window.open('/api/export/template/courses', '_blank')}
                    className={`w-full py-2 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    Download Courses Template (.csv)
                  </button>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 transition ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}>
                  <div className={`font-bold text-sm flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Faculty Master CSV
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Faculty ID, name, department, designation, and UGC workload limit.</p>
                  <button 
                    onClick={() => window.open('/api/export/template/faculty', '_blank')}
                    className={`w-full py-2 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    Download Faculty Template (.csv)
                  </button>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 transition ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}>
                  <div className={`font-bold text-sm flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Rooms & Labs CSV
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Room ID, name, room type (Smart LH, Computer Lab, Pedagogy Hall), capacity.</p>
                  <button 
                    onClick={() => window.open('/api/export/template/rooms', '_blank')}
                    className={`w-full py-2 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    Download Rooms Template (.csv)
                  </button>
                </div>
              </div>

              {/* Interactive Ingestion Form */}
              <div className={`p-5 rounded-2xl border space-y-4 transition ${
                isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className={`flex flex-wrap items-center justify-between border-b pb-3 gap-3 ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Import CSV Data into Institutional Snapshot</h4>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Paste CSV rows below or load sample data with 1 click</p>
                    </div>
                  </div>

                  {/* DataType Selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Target Entity:</span>
                    <select
                      value={csvType}
                      onChange={(e) => setCsvType(e.target.value)}
                      className={`text-xs rounded-lg px-3 py-1.5 transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="COURSES">Courses Catalog</option>
                      <option value="FACULTY">Faculty Members</option>
                      <option value="ROOMS">Rooms & Specialized Labs</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleLoadSampleCsv}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      Load Sample CSV
                    </button>
                  </div>
                </div>

                <form onSubmit={handleCsvUpload} className="space-y-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      CSV Content (Comma-separated with headers):
                    </label>
                    <textarea
                      rows={6}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder="Paste CSV data here or click 'Load Sample CSV' above..."
                      className={`w-full text-xs font-mono rounded-xl p-3 transition border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  {csvMessage && (
                    <div className={`p-3 rounded-xl border text-xs font-medium ${
                      csvMessage.startsWith('Error') || csvMessage.startsWith('Upload failed')
                        ? isDark ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
                        : isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      {csvMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center pt-2 gap-2">
                    <span className="text-[11px] text-slate-500">
                      Changes are merged into current academic snapshot and verified by the CP-SAT engine.
                    </span>
                    <button
                      type="submit"
                      disabled={csvUploading || !csvText.trim()}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{csvUploading ? 'Ingesting...' : 'Ingest CSV to Snapshot'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW C: SETTINGS & ROLE MANAGEMENT                                        */}
      {/* ========================================================================= */}
      {mainView === 'SETTINGS' && (
        <SettingsPage currentUser={currentUser} theme={theme} />
      )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD COURSE OFFERING FORM                                           */}
      {/* ========================================================================= */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Register New Course Offering</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Adds an offering to the academic snapshot and re-optimizes with CP-SAT</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCourseSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Course Code:</label>
                  <input
                    type="text"
                    required
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className={`w-full rounded-lg p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Academic Program:</label>
                  <select
                    value={newCourseProgram}
                    onChange={(e) => setNewCourseProgram(e.target.value)}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="FYUP">FYUP (Four-Year UG)</option>
                    <option value="ITEP">ITEP (Integrated Teacher Education)</option>
                    <option value="B_ED">B.Ed. (Bachelor of Education)</option>
                    <option value="M_ED">M.Ed. (Master of Education)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Course Title / Name:</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Course Category:</label>
                  <select
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="MAJOR">Major (DSC)</option>
                    <option value="MINOR">Minor (Basket)</option>
                    <option value="SEC">SEC Skill Lab</option>
                    <option value="AEC">AEC Core</option>
                    <option value="VAC">VAC Value-Added</option>
                    <option value="TEACHING_PRACTICE">Teaching Practice</option>
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Credits:</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCourseCredits}
                    onChange={(e) => setNewCourseCredits(Number(e.target.value))}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Block Duration:</label>
                  <select
                    value={newCourseDuration}
                    onChange={(e) => setNewCourseDuration(Number(e.target.value))}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={1}>1 Slot (Theory)</option>
                    <option value={2}>2 Slots (Lab / Practice)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Sessions / Week:</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCourseSessions}
                    onChange={(e) => setNewCourseSessions(Number(e.target.value))}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Required Room Type:</label>
                  <select
                    value={newCourseRoomType}
                    onChange={(e) => setNewCourseRoomType(e.target.value)}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="LECTURE_HALL">Smart Lecture Hall</option>
                    <option value="COMPUTER_LAB">Computer & AI Lab</option>
                    <option value="PEDAGOGY_ROOM">Pedagogy Room</option>
                    <option value="SCIENCE_LAB">Science Lab</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Target Student Cohort:</label>
                  <select
                    value={newCourseGroup}
                    onChange={(e) => setNewCourseGroup(e.target.value)}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {(snapshot?.student_groups || []).map(g => (
                      <option key={g.group_id} value={g.group_id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Assigned Teacher:</label>
                  <select
                    value={newCourseFaculty}
                    onChange={(e) => setNewCourseFaculty(e.target.value)}
                    className={`w-full rounded-lg p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {(snapshot?.faculty || []).map(f => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.name} ({f.department_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`pt-3 border-t flex justify-end gap-2 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className={`px-4 py-2 rounded-xl font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={solving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{solving ? 'Solving CP-SAT...' : 'Save & Re-Generate Timetable'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD FACULTY MEMBER */}
      {showAddFacultyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <h3 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Register New Faculty Member</h3>
              <button 
                onClick={() => setShowAddFacultyModal(false)} 
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Faculty ID:</label>
                <input
                  type="text"
                  value={newFacId}
                  onChange={(e) => setNewFacId(e.target.value)}
                  className={`w-full rounded-lg p-2 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Full Name:</label>
                <input
                  type="text"
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  className={`w-full rounded-lg p-2 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Designation & UGC Norm:</label>
                <select
                  value={newFacDesig}
                  onChange={(e) => setNewFacDesig(e.target.value)}
                  className={`w-full rounded-lg p-2 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Professor">Professor (Max 14h / week)</option>
                  <option value="Associate Professor">Associate Professor (Max 14h / week)</option>
                  <option value="Assistant Professor">Assistant Professor (Max 16h / week)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Department:</label>
                  <input
                    type="text"
                    value={newFacDept}
                    onChange={(e) => setNewFacDept(e.target.value)}
                    className={`w-full rounded-lg p-2 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Max Hours / Wk:</label>
                  <input
                    type="number"
                    value={newFacMaxHours}
                    onChange={(e) => setNewFacMaxHours(Number(e.target.value))}
                    className={`w-full rounded-lg p-2 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
              <div className={`pt-2 flex justify-end gap-2 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <button 
                  onClick={() => setShowAddFacultyModal(false)} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    await fetch('/api/admin/add-faculty', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                        faculty_id: newFacId,
                        name: newFacName,
                        department_id: newFacDept,
                        designation: newFacDesig,
                        max_hours_week: newFacMaxHours,
                      }),
                    });
                    const snapRes = await fetch('/api/snapshot').then(r => r.json());
                    setSnapshot(snapRes);
                    setShowAddFacultyModal(false);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold transition shadow-md cursor-pointer"
                >
                  Save Faculty
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MINOR BASKET INSPECTOR (CON-H-011) */}
      {showBasketModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <GitFork className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    Concurrent Elective Basket Synchronization (CON-H-011)
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Guarantees parallel time slot alignment for cross-departmental student elective flexibility
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBasketModal(false)}
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 transition ${
                isDark ? 'bg-purple-950/30 border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-800'
              }`}>
                <div className="font-bold flex items-center gap-1.5 text-purple-500">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  How CON-H-011 Solves Multidisciplinary Minor Alignment:
                </div>
                <p>
                  In FYUP Semester 3, students from both <strong>Section A (Computer Science)</strong> and <strong>Section B (Humanities)</strong> can choose one multidisciplinary minor course. To avoid timetable clashes across majors, the CP-SAT engine enforces a mathematical equality constraint on their start slots:
                </p>
                <div className={`p-2.5 rounded-lg border font-mono text-center text-[11px] ${
                  isDark ? 'bg-slate-950/70 border-purple-500/20 text-indigo-300' : 'bg-white border-purple-200 text-indigo-700'
                }`}>
                  start(Economics Minor) = start(Math Minor) = start(Psychology Minor)
                </div>
                <p>
                  Each course runs concurrently at the exact same hour in separate Smart Lecture Halls.
                </p>
              </div>

              {/* Synchronized Parallel Slots Table */}
              <div className="space-y-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Active Synchronized Minor Sessions (3 Hours/Week):
                </h4>
                <div className="space-y-2">
                  {minorSlots.map((slotIdx, idx) => {
                    const dayIdx = Math.floor(slotIdx / 8);
                    const perIdx = slotIdx % 8;
                    const dayName = days[dayIdx];
                    const perLabel = periods[perIdx].label;
                    const perTime = periods[perIdx].time;

                    const ecoP = minorPlacements.find(p => p.requirement_id === 'REQ_MINOR_ECO' && p.start_slot === slotIdx);
                    const mathP = minorPlacements.find(p => p.requirement_id === 'REQ_MINOR_MATH' && p.start_slot === slotIdx);
                    const psyP = minorPlacements.find(p => p.requirement_id === 'REQ_MINOR_PSY' && p.start_slot === slotIdx);

                    return (
                      <div key={slotIdx} className={`p-3 rounded-xl border space-y-2 transition ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold flex items-center gap-1.5 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            Parallel Slot #{idx + 1}: {dayName} {perLabel} ({perTime})
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            CON-H-011 SYNCHRONIZED
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className={`p-2.5 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                          }`}>
                            <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Principles of Microeconomics</div>
                            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MIN-ECO-201</div>
                            <div className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {ecoP?.assigned_room_id ? roomMap.get(ecoP.assigned_room_id)?.name : 'Smart LH 101'}
                            </div>
                          </div>
                          <div className={`p-2.5 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                          }`}>
                            <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Applied Linear Algebra</div>
                            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MIN-MTH-201</div>
                            <div className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {mathP?.assigned_room_id ? roomMap.get(mathP.assigned_room_id)?.name : 'Smart LH 102'}
                            </div>
                          </div>
                          <div className={`p-2.5 rounded-lg border ${
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                          }`}>
                            <div className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Cognitive Psychology</div>
                            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MIN-PSY-201</div>
                            <div className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {psyP?.assigned_room_id ? roomMap.get(psyP.assigned_room_id)?.name : 'Smart LH 103'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`flex justify-end pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                onClick={() => setShowBasketModal(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UGC WORKLOAD & INFRASTRUCTURE */}
      {showWorkloadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    Faculty Workload & Infrastructure Compliance Matrix
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Enforcing standard academic workload norms (Max 14-16 teaching hours/week) and laboratory capacity fit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWorkloadModal(false)}
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Faculty Teaching Load Distribution:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {(snapshot?.faculty || []).map(fac => {
                    const facPlacements = placements.filter(p => p.assigned_faculty_ids.includes(fac.faculty_id));
                    const totalHours = facPlacements.reduce((sum, p) => sum + p.duration_slots, 0);
                    const maxCap = fac.designation.includes('Professor') ? 14 : 16;
                    const percent = Math.min(100, Math.round((totalHours / maxCap) * 100));

                    return (
                      <div key={fac.faculty_id} className={`p-3 rounded-xl border space-y-1.5 transition ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{fac.name}</span>
                            <span className={`text-[10px] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fac.designation} • {fac.department_id}</span>
                          </div>
                          <span className={`text-xs font-mono font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                            {totalHours} / {maxCap} hrs
                          </span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div 
                            className={`h-full rounded-full transition-all ${
                              totalHours > maxCap ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className={`flex justify-between text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          <span>Max 4h/day compliant</span>
                          <span className="text-emerald-500 font-semibold">0 Gaps (CON-S-003)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Campus Facility Allocation:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(snapshot?.rooms || []).map(r => (
                    <div key={r.room_id} className={`p-2.5 rounded-lg border space-y-1 transition ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className={`font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{r.name}</div>
                      <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.room_type_id}</div>
                      <div className="text-[10px] text-emerald-500 font-semibold">Capacity: {r.capacity} seats</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`flex justify-end pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                onClick={() => setShowWorkloadModal(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Close Workload Matrix
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}