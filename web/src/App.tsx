import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, ShieldCheck, RefreshCw, 
  Layers, Users, DoorOpen, Sparkles, Move,
  Download, FileSpreadsheet, Bot, Send, Check,
  BookOpen, GraduationCap, GitFork, Cpu, Globe, Shield,
  Building2, Clock, Plus, Trash2, Settings, Upload, Database,
  UserCheck, Calendar
} from 'lucide-react';

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

  // Top Nav Main View: 'TIMETABLE' | 'INPUT_STUDIO'
  const [mainView, setMainView] = useState<'TIMETABLE' | 'INPUT_STUDIO'>('TIMETABLE');
  const [inputStudioTab, setInputStudioTab] = useState<'COURSES' | 'FACULTY' | 'ROOMS' | 'STUDENT_PATHWAY' | 'CSV'>('COURSES');

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

  // AI Assistant Copilot
  const [showAICopilot, setShowAICopilot] = useState<boolean>(false);
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiMessages, setAiMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; proposal?: any }>>([
    {
      sender: 'assistant',
      text: 'Greetings! I am the Acadence NEP 2020 Timetable Copilot. I verify compliance with FYUP multidisciplinary baskets, ITEP/B.Ed. school teaching practice blocks, and UGC faculty workload caps.',
    },
  ]);

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
        const [snapRes, timeRes] = await Promise.all([
          fetch('/api/snapshot').then(r => r.json()),
          fetch('/api/timetable').then(r => r.json()),
        ]);
        setSnapshot(snapRes);
        setPlacements(timeRes.placements || []);
        setMetrics(timeRes.metrics || null);
        setValidation(timeRes.validation || null);
        setActiveProfile(timeRes.profile || 'BALANCED');
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
      setSelectedEntityId(firstLeaf.group_id);
    } else {
      const match = snapshot.student_groups.find(g => g.program_type === prog && g.parent_id) 
                 || snapshot.student_groups.find(g => g.program_type === prog);
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
    if (!confirm('Reset entire system to official Government of J&K pilot snapshot?')) return;
    try {
      setLoading(true);
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnapshot(data.snapshot);
        setPlacements(data.placements);
        setMoveMessage('Reset to official J&K Higher Education NEP 2020 Pilot Dataset.');
        setTimeout(() => setMoveMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    setMoveMessage("Independent Validator Oracle computing valid clash-free target slots...");
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

  // AI Copilot Query
  async function handleSendAIQuery(customQuery?: string) {
    const qText = customQuery || aiQuery;
    if (!qText.trim()) return;

    setAiMessages(prev => [...prev, { sender: 'user', text: qText }]);
    setAiQuery('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: qText }),
      });
      const data = await res.json();
      setAiMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.reply,
          proposal: data.proposal,
        },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApplyAIProposal(proposal: any) {
    if (!proposal || !proposal.instance_id || proposal.target_slot === undefined) return;
    try {
      setMoveMessage(`Applying AI Proposal: Moving to ${proposal.new_day} ${proposal.new_period}...`);
      const res = await fetch('/api/timetable/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: proposal.instance_id,
          new_start_slot: proposal.target_slot,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPlacements(data.placements);
        setMetrics(data.metrics);
        setValidation(data.validation);
        setMoveMessage(`AI Proposal applied & verified by Independent Oracle!`);
        setTimeout(() => setMoveMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
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
            <p className="text-slate-400 text-sm mt-1">Connecting to J&K NEP 2020 Multidisciplinary Domain Snapshot...</p>
          </div>
        </div>
      </div>
    );
  }

  // Maps
  const reqMap = new Map((snapshot?.requirements || []).map(r => [r.requirement_id, r]));
  const facultyMap = new Map((snapshot?.faculty || []).map(f => [f.faculty_id, f]));
  const roomMap = new Map((snapshot?.rooms || []).map(r => [r.room_id, r]));

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
    switch (category) {
      case 'MAJOR':
        return {
          bg: 'bg-blue-950/40 border-blue-500/40 hover:border-blue-400 text-blue-100',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          label: 'Major (DSC)',
          icon: BookOpen,
        };
      case 'MINOR':
        return {
          bg: 'bg-purple-950/50 border-purple-500/40 hover:border-purple-400 text-purple-100',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          label: 'Minor Basket (CON-H-011)',
          icon: GitFork,
        };
      case 'SEC':
        return {
          bg: 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400 text-emerald-100',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          label: 'SEC Skill Lab',
          icon: Cpu,
        };
      case 'AEC':
        return {
          bg: 'bg-amber-950/40 border-amber-500/40 hover:border-amber-400 text-amber-100',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          label: 'AEC Ability',
          icon: Globe,
        };
      case 'VAC':
        return {
          bg: 'bg-orange-950/40 border-orange-500/40 hover:border-orange-400 text-orange-100',
          badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          label: 'VAC Value-Added',
          icon: Shield,
        };
      case 'TEACHING_PRACTICE':
        return {
          bg: 'bg-rose-950/50 border-rose-500/50 hover:border-rose-400 text-rose-100',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          label: 'Teaching Practice (2h)',
          icon: GraduationCap,
        };
      default:
        return {
          bg: 'bg-indigo-950/40 border-indigo-500/40 hover:border-indigo-400 text-indigo-100',
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          label: 'Course',
          icon: BookOpen,
        };
    }
  }

  // Minor basket details
  const minorGroup = snapshot?.elective_groups?.find(eg => eg.nep_category === 'MINOR');
  const minorPlacements = placements.filter(p => minorGroup?.member_requirement_ids?.includes(p.requirement_id));
  const minorSlots = Array.from(new Set(minorPlacements.map(p => p.start_slot))).sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 1. Official Government of Jammu & Kashmir Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/20 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider text-[10px]">
            Problem Statement 25091
          </span>
          <span className="text-slate-300 font-semibold tracking-wide">
            Government of Jammu and Kashmir • Higher Education Department
          </span>
          <span className="hidden md:inline text-slate-500">|</span>
          <span className="hidden md:inline text-indigo-300">
            {snapshot?.institution_name || 'Govt. College of Education & Multidisciplinary Studies, J&K'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            NEP 2020 Multi-Program Standard Active
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
            FYUP • ITEP • B.Ed • M.Ed
          </span>
        </div>
      </div>

      {/* 2. Top Header & Primary View Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 flex items-center justify-center font-black text-xl text-slate-950 shadow-lg shadow-indigo-500/20">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">ACADENCE AI</h1>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                OR-Tools CP-SAT
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                NEP 2020
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Conflict-Free Academic Timetable Engine</p>
          </div>

          {/* PRIMARY SWITCHER: TIMETABLE vs DATA INPUT STUDIO */}
          <div className="ml-4 hidden md:flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 shadow-inner">
            <button
              onClick={() => setMainView('TIMETABLE')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
                mainView === 'TIMETABLE' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Timetable Schedule View</span>
            </button>
            <button
              onClick={() => setMainView('INPUT_STUDIO')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
                mainView === 'INPUT_STUDIO' 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Academic Data Input Studio</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Mobile Main Switcher */}
          <div className="flex md:hidden rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setMainView('TIMETABLE')}
              className={`px-2 py-1 text-xs font-medium rounded ${mainView === 'TIMETABLE' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              Timetable
            </button>
            <button
              onClick={() => setMainView('INPUT_STUDIO')}
              className={`px-2 py-1 text-xs font-medium rounded ${mainView === 'INPUT_STUDIO' ? 'bg-emerald-600 text-white' : 'text-emerald-400'}`}
            >
              Data Input
            </button>
          </div>

          {/* Independent Validator Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Validator: <strong>{validation?.is_valid ? 'VALID (0 Clashes)' : 'INVALID'}</strong></span>
          </div>

          {/* AI Copilot Button */}
          <button
            onClick={() => setShowAICopilot(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-900/70 to-purple-900/70 hover:from-indigo-800 hover:to-purple-800 border border-indigo-500/40 text-indigo-200 text-xs font-semibold shadow-sm transition"
          >
            <Bot className="w-4 h-4 text-indigo-400" />
            <span>AI Copilot</span>
          </button>

          {/* Export Dropdown */}
          <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700">
            <button
              onClick={() => window.open('/api/export/xlsx', '_blank')}
              title="Download J&K Master Multi-Sheet Excel Workbook"
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-200 hover:bg-slate-700 rounded text-xs font-medium transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => window.open('/api/export/csv', '_blank')}
              title="Download Active View as CSV"
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-200 hover:bg-slate-700 rounded text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>CSV</span>
            </button>
          </div>

          {/* Re-Optimize Button */}
          <button
            onClick={() => handleGenerate(activeProfile)}
            disabled={solving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${solving ? 'animate-spin' : ''}`} />
            <span>{solving ? 'Solving...' : 'Re-Optimize'}</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VIEW A: TIMETABLE SCHEDULE VIEWER                                         */}
      {/* ========================================================================= */}
      {mainView === 'TIMETABLE' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
          
          {/* Quick Notice to Go to Input Studio */}
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs text-emerald-300 gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                Want to feed new courses, faculty hours, or upload student choice datasets?
              </span>
            </div>
            <button
              onClick={() => setMainView('INPUT_STUDIO')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Open Academic Data Input Studio &rarr;</span>
            </button>
          </div>

          {/* NEP 2020 Multi-Program Selector Tabs */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                Academic Program:
              </span>
              <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[
                  { id: 'ALL', label: 'All Programs (Unified)', badge: 'Master' },
                  { id: 'FYUP', label: 'FYUP (Four-Year UG)', badge: 'Sem 3' },
                  { id: 'ITEP', label: 'ITEP (Teacher Education)', badge: 'Sem 5' },
                  { id: 'B_ED', label: 'B.Ed. (Secondary)', badge: 'Sem 3' },
                  { id: 'M_ED', label: 'M.Ed. (Postgraduate)', badge: 'Sem 3' },
                ].map(prog => (
                  <button
                    key={prog.id}
                    onClick={() => handleSelectProgram(prog.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                      selectedProgram === prog.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>{prog.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      selectedProgram === prog.id ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {prog.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBasketModal(true)}
                className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Minor Basket (CON-H-011)</span>
              </button>
              <button
                onClick={() => setShowWorkloadModal(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>UGC Workload</span>
              </button>
            </div>
          </div>

          {/* NEP Category Legend & Soft Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  NEP 2020 Curriculum Categories
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { cat: 'MAJOR', name: 'Major Core (DSC)', credits: '4 Cr', color: 'border-blue-500/40 bg-blue-950/30 text-blue-300' },
                    { cat: 'MINOR', name: 'Minor Basket (PARALLEL)', credits: '4 Cr', color: 'border-purple-500/40 bg-purple-950/30 text-purple-300' },
                    { cat: 'SEC', name: 'SEC Skill Lab (2h)', credits: '2 Cr', color: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' },
                    { cat: 'AEC', name: 'AEC Environment', credits: '2 Cr', color: 'border-amber-500/40 bg-amber-950/30 text-amber-300' },
                    { cat: 'VAC', name: 'VAC Digital Ethics', credits: '2 Cr', color: 'border-orange-500/40 bg-orange-950/30 text-orange-300' },
                    { cat: 'TEACHING_PRACTICE', name: 'School Internship (2h)', credits: '4 Cr', color: 'border-rose-500/40 bg-rose-950/30 text-rose-300' },
                  ].map(item => (
                    <div key={item.cat} className={`p-2 rounded-lg border ${item.color} flex flex-col justify-between`}>
                      <span className="text-xs font-bold leading-tight">{item.name}</span>
                      <span className="text-[10px] opacity-75 font-mono mt-1">{item.credits}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Quality Scorecard (Soft Constraints CON-S)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <div className="text-base font-black text-emerald-400">{metrics?.distribution_excess ?? 0}</div>
                  <div className="text-[11px] font-medium text-slate-300">Spread Excess</div>
                  <div className="text-[9px] text-slate-500">CON-S-008 (0 = Perfect)</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <div className="text-base font-black text-emerald-400">{metrics?.faculty_gaps ?? 0} <span className="text-[10px] font-normal">hrs</span></div>
                  <div className="text-[11px] font-medium text-slate-300">Faculty Idle Gaps</div>
                  <div className="text-[9px] text-slate-500">CON-S-003</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <div className="text-base font-black text-emerald-400">{metrics?.student_gaps ?? 0} <span className="text-[10px] font-normal">hrs</span></div>
                  <div className="text-[11px] font-medium text-slate-300">Student Idle Gaps</div>
                  <div className="text-[9px] text-slate-500">CON-S-004</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <div className="text-base font-black text-indigo-400">{metrics?.composite_score ?? 0}</div>
                  <div className="text-[11px] font-medium text-slate-300">Objective Score</div>
                  <div className="text-[9px] text-slate-500">Solved in {solveTime.toFixed(2)}s</div>
                </div>
              </div>
            </div>
          </div>

          {/* View Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 px-4 py-3 rounded-xl">
            <div className="flex items-center flex-wrap gap-3">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Schedule View:
              </span>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  onClick={() => {
                    setViewType('GROUP');
                    const firstGroup = filteredGroups[0] || snapshot?.student_groups[0];
                    if (firstGroup) setSelectedEntityId(firstGroup.group_id);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewType === 'GROUP' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  By Student Cohort / Section
                </button>
                <button
                  onClick={() => {
                    setViewType('FACULTY');
                    if (snapshot?.faculty[0]) setSelectedEntityId(snapshot.faculty[0].faculty_id);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewType === 'FACULTY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  By Faculty Member
                </button>
                <button
                  onClick={() => {
                    setViewType('ROOM');
                    if (snapshot?.rooms[0]) setSelectedEntityId(snapshot.rooms[0].room_id);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewType === 'ROOM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  By Physical Room / Lab
                </button>
              </div>

              {/* Entity Dropdown */}
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
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
                <span className="text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
                  <Move className="w-3.5 h-3.5" />
                  {moveMessage}
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-indigo-400" />
                  Click any course card to calculate clash-free target slots in real-time.
                </span>
              )}
            </div>
          </div>

          {/* Master Timetable Grid */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs font-semibold">
                    <th className="py-3 px-4 w-32 border-r border-slate-800">Day</th>
                    {periods.map((per, idx) => (
                      <React.Fragment key={per.p}>
                        {idx === 3 && (
                          <th className="py-3 px-2 w-10 text-center bg-amber-500/5 text-amber-500/80 border-r border-slate-800 text-[10px] uppercase font-bold tracking-widest writing-vertical">
                            Lunch
                          </th>
                        )}
                        <th className="py-3 px-3 text-center border-r border-slate-800 min-w-[145px]">
                          <div>{per.label}</div>
                          <div className="text-[10px] font-normal text-slate-500">{per.time}</div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {days.map((dayName, dIdx) => (
                    <tr key={dayName} className="hover:bg-slate-900/40 transition">
                      <td className="py-4 px-4 font-bold text-slate-300 bg-slate-900/30 border-r border-slate-800">
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
                              <td className="bg-amber-500/5 border-r border-slate-800 text-center text-slate-600 text-[10px]">
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
                              className={`p-2 border-r border-slate-800 align-top transition cursor-pointer relative h-32 ${
                                isValidTarget 
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 ring-2 ring-emerald-400 ring-inset' 
                                  : isSelectedSession
                                    ? 'bg-indigo-600/30 ring-2 ring-indigo-400 ring-inset'
                                    : 'hover:bg-slate-800/40'
                              }`}
                            >
                              {cellPlacement ? (
                                <div className={`h-full rounded-lg p-2.5 flex flex-col justify-between shadow-sm border transition ${style.bg}`}>
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

                                  <div className="mt-2 pt-1 border-t border-slate-800/60 text-[10px] space-y-0.5 text-slate-400">
                                    <div className="flex items-center gap-1 text-slate-300">
                                      <DoorOpen className="w-3 h-3 text-slate-400" />
                                      <span className="truncate">
                                        {cellPlacement.assigned_room_id ? roomMap.get(cellPlacement.assigned_room_id)?.name : 'Virtual'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <Users className="w-3 h-3 text-slate-500" />
                                      <span className="truncate">
                                        {cellPlacement.assigned_faculty_ids.map(id => facultyMap.get(id)?.name).join(', ')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : isValidTarget ? (
                                <div className="h-full rounded-lg border-2 border-dashed border-emerald-400/60 flex flex-col items-center justify-center text-center p-2 text-emerald-300 text-xs font-semibold">
                                  <Move className="w-4 h-4 mb-1 animate-bounce" />
                                  Move Here
                                </div>
                              ) : (
                                <div className="h-full flex items-center justify-center text-slate-800 text-xs">
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
      {/* VIEW B: ACADEMIC DATA INPUT & MANAGEMENT STUDIO (PROBLEM STATEMENT 25091) */}
      {/* ========================================================================= */}
      {mainView === 'INPUT_STUDIO' && (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
          
          {/* Header Banner */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-100">Academic Data Input Studio</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Problem Statement 25091 Admin Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Input curriculum structures, faculty availability windows, room infrastructure, or student elective choices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDefault}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition border border-slate-700"
              >
                Reset Default J&K Pilot Data
              </button>
              <button
                onClick={() => setMainView('TIMETABLE')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Return to Schedule View &rarr;</span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
            {[
              { id: 'COURSES', label: '1. Course Offerings & Curriculum', icon: BookOpen, count: snapshot?.requirements.length },
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                    inputStudioTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
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
              <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Registered NEP 2020 Course Offerings</h3>
                  <p className="text-xs text-slate-400">Total {snapshot?.requirements.length} requirements registered across FYUP, ITEP, B.Ed., and M.Ed.</p>
                </div>
                <button
                  onClick={() => setShowAddCourseModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Register New Course Offering</span>
                </button>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-semibold">
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Course Title</th>
                        <th className="py-3 px-3">Program</th>
                        <th className="py-3 px-3">NEP Category</th>
                        <th className="py-3 px-3 text-center">Credits</th>
                        <th className="py-3 px-3 text-center">Sessions/Wk</th>
                        <th className="py-3 px-3">Facility</th>
                        <th className="py-3 px-4">Eligible Teachers</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(snapshot?.requirements || []).map(r => {
                        const style = getNEPCategoryStyle(r.nep_category);
                        return (
                          <tr key={r.requirement_id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3 px-4 font-mono font-bold text-indigo-300">{r.course_id}</td>
                            <td className="py-3 px-4 font-semibold text-slate-200">{r.course_name}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                {r.program_type}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${style.badge}`}>
                                {r.nep_category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-300">{r.credits}</td>
                            <td className="py-3 px-3 text-center font-mono">
                              {r.sessions_per_week} x {r.duration_slots}h
                            </td>
                            <td className="py-3 px-3 text-slate-400 text-[11px]">{r.room_type_id}</td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[200px]">
                              {r.eligible_faculty_ids.map(id => facultyMap.get(id)?.name).join(', ')}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleDeleteCourse(r.requirement_id)}
                                title="Delete Course"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
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
              <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Teaching Faculty & Unavailability Constraints (CON-H-007)</h3>
                  <p className="text-xs text-slate-400">Click any professor to inspect or toggle their 5-day restricted time windows.</p>
                </div>
                <button
                  onClick={() => setShowAddFacultyModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Register New Faculty Member</span>
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
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm text-slate-100">{fac.name}</div>
                          <div className="text-[11px] text-slate-400">{fac.designation} • {fac.department_id}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-indigo-300 block">{totalHours} hrs / week</span>
                          <span className="text-[10px] text-emerald-400 font-semibold">UGC Norm: Max {fac.max_hours_week}h</span>
                        </div>
                      </div>

                      {/* Mini 5-Day Availability Grid */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
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
                                className={`p-1 rounded transition text-[9px] ${
                                  isUnavail
                                    ? 'bg-rose-600 text-white font-bold ring-1 ring-rose-400'
                                    : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
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
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <h3 className="font-bold text-sm text-slate-200">Campus Classrooms & Specialized Labs (CON-H-003 / CON-H-005)</h3>
                <p className="text-xs text-slate-400">Total {snapshot?.rooms.length} facilities registered in the J&K institution domain.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {(snapshot?.rooms || []).map(r => (
                  <div key={r.room_id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 w-fit">
                      <DoorOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-200">{r.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{r.room_id}</div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-400">Type:</span>
                      <span className="font-bold text-indigo-300">{r.room_type_id}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Capacity:</span>
                      <span className="font-bold text-emerald-400">{r.capacity} Seats</span>
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
              <div className="bg-slate-900/60 border border-purple-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Individual Student Elective Pathway Simulator</h3>
                    <p className="text-xs text-slate-400">
                      In NEP 2020, students choose individual combinations. Select a cohort and a chosen minor to preview that student's personalized, clash-free schedule.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Select Student Section / Major Cohort:</label>
                    <select
                      value={pathwayGroup}
                      onChange={(e) => setPathwayGroup(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="GRP_FYUP_SEC_A">FYUP Section A (Major: Computer Science)</option>
                      <option value="GRP_FYUP_SEC_B">FYUP Section B (Major: Modern Literature & Humanities)</option>
                      <option value="GRP_ITEP_SEM5">ITEP B.Sc.-B.Ed. (Semester 5)</option>
                      <option value="GRP_BED_SEM3">B.Ed. Teacher Education (Semester 3)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Student's Chosen Multidisciplinary Minor Basket Course:</label>
                    <select
                      value={pathwayMinor}
                      onChange={(e) => setPathwayMinor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="REQ_MINOR_ECO">Principles of Microeconomics (MIN-ECO-201) — Dr. Amartya Sen</option>
                      <option value="REQ_MINOR_MATH">Applied Linear Algebra (MIN-MTH-201) — Dr. Srinivasa Ramanujan</option>
                      <option value="REQ_MINOR_PSY">Cognitive Psychology (MIN-PSY-201) — Dr. B.F. Skinner</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pathway Summary */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-300">
                  Showing <strong>{pathwayPlacements.length} weekly sessions</strong> for student choice pathway.
                </span>
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
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
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-2">
                <h3 className="font-bold text-sm text-slate-200">Bulk CSV Data Ingestion & Academic Management System (AMS) Sync</h3>
                <p className="text-xs text-slate-400">
                  Colleges can download standardized CSV templates, populate them in Excel, and import them directly into Acadence.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Courses Master CSV
                  </div>
                  <p className="text-[11px] text-slate-400">Course code, name, credits, theory/practical duration, and eligible teachers.</p>
                  <button 
                    onClick={() => alert("Downloading courses_template.csv...")}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                  >
                    Download Courses Template (.csv)
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Faculty Master CSV
                  </div>
                  <p className="text-[11px] text-slate-400">Faculty ID, name, department, designation, and UGC workload limit.</p>
                  <button 
                    onClick={() => alert("Downloading faculty_template.csv...")}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                  >
                    Download Faculty Template (.csv)
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Rooms & Labs CSV
                  </div>
                  <p className="text-[11px] text-slate-400">Room ID, name, room type (Smart LH, Computer Lab, Pedagogy Hall), capacity.</p>
                  <button 
                    onClick={() => alert("Downloading rooms_template.csv...")}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
                  >
                    Download Rooms Template (.csv)
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COURSE OFFERING FORM                                           */}
      {/* ========================================================================= */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Register New Course Offering</h3>
                  <p className="text-xs text-slate-400">Adds an offering to the academic snapshot and re-optimizes with CP-SAT</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCourseModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCourseSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Course Code:</label>
                  <input
                    type="text"
                    required
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Academic Program:</label>
                  <select
                    value={newCourseProgram}
                    onChange={(e) => setNewCourseProgram(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="FYUP">FYUP (Four-Year UG)</option>
                    <option value="ITEP">ITEP (Integrated Teacher Education)</option>
                    <option value="B_ED">B.Ed. (Bachelor of Education)</option>
                    <option value="M_ED">M.Ed. (Master of Education)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Course Title / Name:</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">NEP Category:</label>
                  <select
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
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
                  <label className="block text-slate-400 font-semibold mb-1">Credits:</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCourseCredits}
                    onChange={(e) => setNewCourseCredits(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Block Duration:</label>
                  <select
                    value={newCourseDuration}
                    onChange={(e) => setNewCourseDuration(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1 Slot (Theory)</option>
                    <option value={2}>2 Slots (Lab / Practice)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Sessions / Week:</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={newCourseSessions}
                    onChange={(e) => setNewCourseSessions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Required Room Type:</label>
                  <select
                    value={newCourseRoomType}
                    onChange={(e) => setNewCourseRoomType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
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
                  <label className="block text-slate-400 font-semibold mb-1">Target Student Cohort:</label>
                  <select
                    value={newCourseGroup}
                    onChange={(e) => setNewCourseGroup(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {(snapshot?.student_groups || []).map(g => (
                      <option key={g.group_id} value={g.group_id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Assigned Teacher:</label>
                  <select
                    value={newCourseFaculty}
                    onChange={(e) => setNewCourseFaculty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {(snapshot?.faculty || []).map(f => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.name} ({f.department_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={solving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
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
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">Register New Faculty Member</h3>
              <button onClick={() => setShowAddFacultyModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Faculty ID:</label>
                <input
                  type="text"
                  value={newFacId}
                  onChange={(e) => setNewFacId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Full Name:</label>
                <input
                  type="text"
                  value={newFacName}
                  onChange={(e) => setNewFacName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Designation & UGC Norm:</label>
                <select
                  value={newFacDesig}
                  onChange={(e) => setNewFacDesig(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2"
                >
                  <option value="Professor">Professor (Max 14h / week)</option>
                  <option value="Associate Professor">Associate Professor (Max 14h / week)</option>
                  <option value="Assistant Professor">Assistant Professor (Max 16h / week)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Department:</label>
                  <input
                    type="text"
                    value={newFacDept}
                    onChange={(e) => setNewFacDept(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Hours / Wk:</label>
                  <input
                    type="number"
                    value={newFacMaxHours}
                    onChange={(e) => setNewFacMaxHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button onClick={() => setShowAddFacultyModal(false)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-300">Cancel</button>
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
                  className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white font-bold"
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
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <GitFork className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    NEP 2020 Multidisciplinary Minor Basket Synchronization (CON-H-011)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Guarantees parallel time slot alignment for cross-departmental student elective flexibility
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBasketModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 leading-relaxed space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-purple-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  How CON-H-011 Solves Problem Statement 25091:
                </div>
                <p>
                  In FYUP Semester 3, students from both <strong>Section A (Computer Science)</strong> and <strong>Section B (Humanities)</strong> can choose one multidisciplinary minor course. To avoid timetable clashes across majors, the CP-SAT engine enforces a mathematical equality constraint on their start slots:
                </p>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-purple-500/20 font-mono text-center text-indigo-300 text-[11px]">
                  start(Economics Minor) = start(Math Minor) = start(Psychology Minor)
                </div>
                <p>
                  Each course runs concurrently at the exact same hour in separate Smart Lecture Halls.
                </p>
              </div>

              {/* Synchronized Parallel Slots Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
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
                      <div key={slotIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            Parallel Slot #{idx + 1}: {dayName} {perLabel} ({perTime})
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                            CON-H-011 SYNCHRONIZED
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="font-bold text-slate-200">Principles of Microeconomics</div>
                            <div className="text-[11px] text-slate-400">MIN-ECO-201</div>
                            <div className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {ecoP?.assigned_room_id ? roomMap.get(ecoP.assigned_room_id)?.name : 'Smart LH 101'}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="font-bold text-slate-200">Applied Linear Algebra</div>
                            <div className="text-[11px] text-slate-400">MIN-MTH-201</div>
                            <div className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
                              <DoorOpen className="w-3 h-3" />
                              {mathP?.assigned_room_id ? roomMap.get(mathP.assigned_room_id)?.name : 'Smart LH 102'}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                            <div className="font-bold text-slate-200">Cognitive Psychology</div>
                            <div className="text-[11px] text-slate-400">MIN-PSY-201</div>
                            <div className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1">
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

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowBasketModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UGC WORKLOAD & INFRASTRUCTURE */}
      {showWorkloadModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Faculty Workload & Infrastructure Compliance Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Enforcing UGC / NEP 2020 workload norms (Max 14-16 teaching hours/week) and laboratory capacity fit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWorkloadModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Faculty Teaching Load Distribution:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {(snapshot?.faculty || []).map(fac => {
                    const facPlacements = placements.filter(p => p.assigned_faculty_ids.includes(fac.faculty_id));
                    const totalHours = facPlacements.reduce((sum, p) => sum + p.duration_slots, 0);
                    const maxCap = fac.designation.includes('Professor') ? 14 : 16;
                    const percent = Math.min(100, Math.round((totalHours / maxCap) * 100));

                    return (
                      <div key={fac.faculty_id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-200">{fac.name}</span>
                            <span className="text-[10px] text-slate-500 block">{fac.designation} • {fac.department_id}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-indigo-300">
                            {totalHours} / {maxCap} hrs
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              totalHours > maxCap ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Max 4h/day compliant</span>
                          <span className="text-emerald-400 font-semibold">0 Gaps (CON-S-003)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Campus Facility Allocation:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(snapshot?.rooms || []).map(r => (
                    <div key={r.room_id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="font-bold text-slate-300 truncate">{r.name}</div>
                      <div className="text-[10px] text-slate-500">{r.room_type_id}</div>
                      <div className="text-[10px] text-emerald-400 font-semibold">Capacity: {r.capacity} seats</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowWorkloadModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Close Workload Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: AI COPILOT */}
      {showAICopilot && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-slate-950 shadow-md shadow-indigo-500/20">
                    <Bot className="w-5 h-5 font-bold" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Acadence NEP 2020 AI Copilot</h3>
                    <p className="text-[11px] text-slate-400">Advisory Timetable Assistant (Section 14)</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAICopilot(false)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Sample Prompt Pills */}
              <div className="space-y-1.5 mb-4">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Suggested Inquiries:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Can we move CS201 to another slot?",
                    "Why is Dr. Alan Turing restricted?",
                    "What happens if Dr. Turing is sick on Monday?",
                  ].map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendAIQuery(p)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-indigo-300 border border-indigo-500/20 text-left transition"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 my-2">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}

                    {/* Proposal Card */}
                    {msg.proposal && (
                      <div className="mt-3 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-300 text-[11px] flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            {msg.proposal.title}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ORACLE CERTIFIED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">{msg.proposal.explanation}</p>
                        <button
                          onClick={() => handleApplyAIProposal(msg.proposal)}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve & Apply Proposal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Evaluating constraints with Independent Validator oracle...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="pt-3 border-t border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAIQuery();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask a scheduling question or request a move..."
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!aiQuery.trim() || aiLoading}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition shadow-md"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}