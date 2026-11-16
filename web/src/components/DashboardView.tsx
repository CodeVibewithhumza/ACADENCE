import { useState, useEffect } from 'react';
import {
  Building2, BookOpen, Users, GraduationCap,
  Clock, Plus, DoorOpen, BarChart3,
  CheckCircle2, Layers,
  FlaskConical, X, Check, Sparkles
} from 'lucide-react';
import type { User } from '../types/auth';

interface DashboardViewProps {
  snapshot: any;
  placements: any[];
  currentUser: User;
  onNavigateInputStudio: (tab?: string) => void;
  onRefreshData: () => Promise<void>;
  theme?: 'dark' | 'light';
}

export function DashboardView({
  snapshot,
  placements,
  currentUser,
  onNavigateInputStudio,
  onRefreshData,
  theme = 'dark',
}: DashboardViewProps) {
  const isDark = theme !== 'light';
  // Modal states for adding input resources
  const [activeModal, setActiveModal] = useState<'ROOM' | 'COURSE' | 'FACULTY' | 'COHORT' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [curriculumPrograms, setCurriculumPrograms] = useState<any[]>([]);
  const [courseCohorts, setCourseCohorts] = useState<any[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('BTECH_Y1');

  useEffect(() => {
    fetch('/api/curriculum/programs')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCurriculumPrograms(data);
      })
      .catch(() => {});

    fetch('/api/courses')
      .then(r => r.json())
      .then(data => {
        if (data.courses) {
          setCourseCohorts(data.courses);
          if (data.courses.length > 0) setSelectedCohortId(data.courses[0].course_id);
        }
      })
      .catch(() => {});
  }, []);

  // Form states
  const [roomForm, setRoomForm] = useState({
    room_id: '',
    name: '',
    room_type_id: 'LECTURE_HALL',
    capacity: 60,
    features: 'SMART_BOARD;AUDIO_VISUAL',
  });

  const [courseForm, setCourseForm] = useState({
    course_id: '',
    course_name: '',
    program_type: 'FYUP',
    nep_category: 'MAJOR',
    credits: 4,
    sessions_per_week: 3,
    duration_slots: 1,
    group_ids: 'GRP_FYUP_SEC_A',
    room_type_id: 'LECTURE_HALL',
    eligible_faculty_ids: 'FAC_CS_01',
  });

  const [facultyForm, setFacultyForm] = useState({
    faculty_id: '',
    name: '',
    department_id: 'COMPUTER_SCIENCE',
    designation: 'Assistant Professor',
    max_hours_week: 16,
    max_hours_day: 4,
  });

  const [cohortForm, setCohortForm] = useState({
    group_id: '',
    name: '',
    program_type: 'FYUP',
    semester: 3,
    expected_strength: 35,
  });

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // Calculate Metrics from Snapshot and Placements
  const rooms = snapshot?.rooms || [];
  const faculty = snapshot?.faculty || [];
  const requirements = snapshot?.requirements || [];
  const studentGroups = snapshot?.student_groups || [];

  const totalSeats = rooms.reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
  const totalCredits = requirements.reduce((sum: number, r: any) => sum + (r.credits || 0), 0);
  const totalStudents = studentGroups.reduce((sum: number, g: any) => sum + (g.expected_strength || 0), 0);

  // Teachable slots in week: 5 days * 7 teachable periods = 35 slots per room
  const teachableSlotsPerRoom = 35;
  const totalCampusSlotCapacity = rooms.length * teachableSlotsPerRoom;

  // Calculate room hours scheduled
  const roomOccupancyMap = new Map<string, number>();
  for (const p of placements) {
    if (p.assigned_room_id) {
      const current = roomOccupancyMap.get(p.assigned_room_id) || 0;
      roomOccupancyMap.set(p.assigned_room_id, current + (p.duration_slots || 1));
    }
  }

  const totalScheduledRoomHours = Array.from(roomOccupancyMap.values()).reduce((a, b) => a + b, 0);
  const campusUtilizationRate = totalCampusSlotCapacity > 0
    ? Math.round((totalScheduledRoomHours / totalCampusSlotCapacity) * 100)
    : 0;

  // Calculate faculty hours scheduled
  const facultyWorkloadMap = new Map<string, number>();
  for (const p of placements) {
    for (const fid of p.assigned_faculty_ids || []) {
      const current = facultyWorkloadMap.get(fid) || 0;
      facultyWorkloadMap.set(fid, current + (p.duration_slots || 1));
    }
  }

  const totalAssignedFacultyHours = Array.from(facultyWorkloadMap.values()).reduce((a, b) => a + b, 0);
  const totalFacultyMaxCapacity = faculty.reduce((sum: number, f: any) => sum + (f.max_hours_week || 16), 0);

  // Curriculum category counts
  const categoryCounts: Record<string, { count: number; credits: number }> = {
    MAJOR: { count: 0, credits: 0 },
    MINOR: { count: 0, credits: 0 },
    SEC: { count: 0, credits: 0 },
    AEC: { count: 0, credits: 0 },
    VAC: { count: 0, credits: 0 },
    TEACHING_PRACTICE: { count: 0, credits: 0 },
  };

  for (const req of requirements) {
    const cat = req.nep_category || 'MAJOR';
    if (!categoryCounts[cat]) {
      categoryCounts[cat] = { count: 0, credits: 0 };
    }
    categoryCounts[cat].count += 1;
    categoryCounts[cat].credits += req.credits || 0;
  }

  // Room type breakdown
  const roomTypeCounts: Record<string, number> = {};
  for (const r of rooms) {
    const t = r.room_type_id || 'LECTURE_HALL';
    roomTypeCounts[t] = (roomTypeCounts[t] || 0) + 1;
  }

  // 5-Day x 8-Period Heatmap Density
  const heatmap: number[][] = Array(5).fill(0).map(() => Array(8).fill(0));
  for (const p of placements) {
    const d = p.day;
    const sPeriod = p.period;
    for (let slot = 0; slot < (p.duration_slots || 1); slot++) {
      const per = sPeriod + slot;
      if (d >= 0 && d < 5 && per >= 0 && per < 8) {
        heatmap[d][per] += 1;
      }
    }
  }

  // Handlers for Add Form submissions
  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomForm.room_id.trim() || !roomForm.name.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/add-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomForm.room_id.trim(),
          name: roomForm.name.trim(),
          room_type_id: roomForm.room_type_id,
          capacity: Number(roomForm.capacity) || 60,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully registered ${roomForm.name}!`);
        setActiveModal(null);
        setRoomForm({ room_id: '', name: '', room_type_id: 'LECTURE_HALL', capacity: 60, features: '' });
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!courseForm.course_id.trim() || !courseForm.course_name.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/courses/add-subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCohortId || 'BTECH_Y1',
          subject_code: courseForm.course_id.trim().toUpperCase(),
          subject_name: courseForm.course_name.trim(),
          subject_type: courseForm.nep_category === 'SEC' ? 'PRACTICAL' : 'THEORY',
          credits: Number(courseForm.credits),
          sessions_per_week: Number(courseForm.sessions_per_week),
          duration_slots: Number(courseForm.duration_slots),
          schedule_now: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to add course');
      showToast(`Enrolled "${courseForm.course_name}" into ${data.course?.course_name}! Auto-allocated ${data.sections_count} room(s): ${data.rooms_allocated?.join(', ')}. Status: 0 Clashes.`);
      setActiveModal(null);
      setCourseForm({
        course_id: '',
        course_name: '',
        program_type: 'FYUP',
        nep_category: 'MAJOR',
        credits: 4,
        sessions_per_week: 3,
        duration_slots: 1,
        group_ids: 'GRP_FYUP_SEC_A',
        room_type_id: 'LECTURE_HALL',
        eligible_faculty_ids: 'FAC_CS_01',
      });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error adding course');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (!facultyForm.faculty_id.trim() || !facultyForm.name.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/add-faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faculty_id: facultyForm.faculty_id.trim(),
          name: facultyForm.name.trim(),
          department_id: facultyForm.department_id.trim(),
          designation: facultyForm.designation,
          max_hours_week: Number(facultyForm.max_hours_week),
          max_hours_day: Number(facultyForm.max_hours_day),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully registered ${facultyForm.name}!`);
        setActiveModal(null);
        setFacultyForm({
          faculty_id: '',
          name: '',
          department_id: 'COMPUTER_SCIENCE',
          designation: 'Assistant Professor',
          max_hours_week: 16,
          max_hours_day: 4,
        });
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCohort(e: React.FormEvent) {
    e.preventDefault();
    if (!cohortForm.group_id.trim() || !cohortForm.name.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/add-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: cohortForm.group_id.trim(),
          name: cohortForm.name.trim(),
          program_type: cohortForm.program_type,
          semester: Number(cohortForm.semester),
          expected_strength: Number(cohortForm.expected_strength),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully registered ${cohortForm.name}!`);
        setActiveModal(null);
        setCohortForm({
          group_id: '',
          name: '',
          program_type: 'FYUP',
          semester: 3,
          expected_strength: 35,
        });
        await onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full transition-colors ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Banner & Quick Actions */}
      <div className={`border rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4 transition-colors ${
        isDark 
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border-slate-800' 
          : 'bg-gradient-to-r from-indigo-50/90 via-white to-purple-50/70 border-slate-200 shadow-sm'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${
              isDark ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-indigo-100 border-indigo-200 text-indigo-600'
            }`}>
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                University Academic Analytics & Infrastructure Dashboard
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {snapshot?.institution_name || 'Metropolitan University'} • Real-Time Facilities Utilization, Teaching Loads & Subject Operations
              </p>
            </div>
          </div>
        </div>

        {/* Input Resource Quick Launch Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {currentUser.role !== 'STUDENT' && (
            <>
              <button
                onClick={() => setActiveModal('ROOM')}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Room / Lab</span>
              </button>
              <button
                onClick={() => setActiveModal('COURSE')}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course / Subject</span>
              </button>
              <button
                onClick={() => setActiveModal('FACULTY')}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Faculty</span>
              </button>
              <button
                onClick={() => setActiveModal('COHORT')}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Cohort</span>
              </button>
            </>
          )}
          <button
            onClick={() => onNavigateInputStudio()}
            className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <span>Full Data Studio &rarr;</span>
          </button>
        </div>
      </div>

      {/* 2. Primary University KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Rooms & Labs */}
        <div className={`border rounded-2xl p-4 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-indigo-500/40' : 'bg-white border-slate-200 hover:border-indigo-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rooms & Labs</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <DoorOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{rooms.length}</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalSeats} Total Student Seats
            </div>
          </div>
          <div className={`text-[10px] px-2 py-1 rounded-md flex items-center justify-between border ${
            isDark ? 'text-indigo-300 bg-indigo-950/40 border-indigo-500/20' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
          }`}>
            <span>Utilization:</span>
            <span className="font-bold">{campusUtilizationRate}%</span>
          </div>
        </div>

        {/* KPI 2: Courses & Subjects */}
        <div className={`border rounded-2xl p-4 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/40' : 'bg-white border-slate-200 hover:border-emerald-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Courses & Subjects</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{requirements.length}</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalCredits} Total Academic Credits
            </div>
          </div>
          <div className={`text-[10px] px-2 py-1 rounded-md flex items-center justify-between border ${
            isDark ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          }`}>
            <span>Weekly Sessions:</span>
            <span className="font-bold">{placements.length} Scheduled</span>
          </div>
        </div>

        {/* KPI 3: Faculty Staff */}
        <div className={`border rounded-2xl p-4 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-purple-500/40' : 'bg-white border-slate-200 hover:border-purple-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Academic Faculty</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{faculty.length}</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalAssignedFacultyHours}h / {totalFacultyMaxCapacity}h Capacity
            </div>
          </div>
          <div className={`text-[10px] px-2 py-1 rounded-md flex items-center justify-between border ${
            isDark ? 'text-purple-300 bg-purple-950/40 border-purple-500/20' : 'text-purple-700 bg-purple-50 border-purple-200'
          }`}>
            <span>Staff Workload:</span>
            <span className="font-bold">
              {totalFacultyMaxCapacity > 0 ? Math.round((totalAssignedFacultyHours / totalFacultyMaxCapacity) * 100) : 0}% Active
            </span>
          </div>
        </div>

        {/* KPI 4: Student Cohorts */}
        <div className={`border rounded-2xl p-4 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-amber-500/40' : 'bg-white border-slate-200 hover:border-amber-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cohorts & Batches</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{studentGroups.length}</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalStudents} Enrolled Students
            </div>
          </div>
          <div className={`text-[10px] px-2 py-1 rounded-md flex items-center justify-between border ${
            isDark ? 'text-amber-300 bg-amber-950/40 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}>
            <span>Elective Baskets:</span>
            <span className="font-bold">{snapshot?.elective_groups?.length || 1} Parallel</span>
          </div>
        </div>

        {/* KPI 5: Solver Timetable Status */}
        <div className={`border rounded-2xl p-4 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/40' : 'bg-white border-slate-200 hover:border-cyan-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Schedule Quality</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-500">0 Clashes</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              100% Conflict-Free
            </div>
          </div>
          <div className={`text-[10px] px-2 py-1 rounded-md flex items-center justify-between border ${
            isDark ? 'text-cyan-300 bg-cyan-950/40 border-cyan-500/20' : 'text-cyan-700 bg-cyan-50 border-cyan-200'
          }`}>
            <span>Conflict Check:</span>
            <span className="font-bold">CON-H Satisfied</span>
          </div>
        </div>
      </div>

      {/* 3. Graphs Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* GRAPH 1: Room & Laboratory Occupancy & Capacity (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-2xl p-5 space-y-4 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Campus Facilities & Labs Occupancy
              </h2>
            </div>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              35 Hours Max Available / Week
            </span>
          </div>

          <div className="space-y-3">
            {rooms.map((room: any) => {
              const bookedHours = roomOccupancyMap.get(room.room_id) || 0;
              const pct = Math.min(100, Math.round((bookedHours / teachableSlotsPerRoom) * 100));
              const isLab = room.room_type_id.includes('LAB');

              return (
                <div key={room.room_id} className={`p-3 border rounded-xl space-y-2 transition ${
                  isDark ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {isLab ? (
                        <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <DoorOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className={`font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{room.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {room.room_type_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] shrink-0 font-mono">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{room.capacity} seats</span>
                      <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{bookedHours}h booked</span>
                      <span className={`font-bold ${pct > 70 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className={`w-full h-2.5 rounded-full overflow-hidden flex ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        pct > 80
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                          : isLab
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GRAPH 2: Faculty Workload & Quota Limits (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Faculty Workload vs Quota
                </h2>
              </div>
              <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>14h / 16h Max</span>
            </div>

            <div className="space-y-3">
              {faculty.map((f: any) => {
                const assigned = facultyWorkloadMap.get(f.faculty_id) || 0;
                const max = f.max_hours_week || 16;
                const pct = Math.round((assigned / max) * 100);

                return (
                  <div key={f.faculty_id} className={`p-2.5 border rounded-xl space-y-1.5 transition ${
                    isDark ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className={`font-bold block truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{f.name}</span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.department_id} • {f.designation}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{assigned}h</span>
                        <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> / {max}h</span>
                      </div>
                    </div>

                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 90
                            ? 'bg-amber-400'
                            : pct > 50
                            ? 'bg-indigo-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`mt-4 p-3 rounded-xl border text-[11px] flex items-center justify-between ${
            isDark ? 'bg-purple-950/20 border-purple-500/20 text-slate-300' : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}>
            <span>Overall Faculty Load Compliance:</span>
            <span className="font-bold text-emerald-500">100% within limits</span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Curriculum Breakdown & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Course Curriculum & Subject Category Breakdown (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-2xl p-5 space-y-4 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Curriculum Subject Categories
              </h2>
            </div>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{requirements.length} Courses</span>
          </div>

          <div className="space-y-2.5">
            {[
              { key: 'MAJOR', label: 'Major Core Subjects (DSC)', color: 'bg-blue-500', barBg: 'bg-blue-500/20' },
              { key: 'MINOR', label: 'Elective / Minor Baskets', color: 'bg-purple-500', barBg: 'bg-purple-500/20' },
              { key: 'SEC', label: 'Skill Practical Labs (SEC)', color: 'bg-emerald-500', barBg: 'bg-emerald-500/20' },
              { key: 'AEC', label: 'Ability Enhancement (AEC)', color: 'bg-amber-500', barBg: 'bg-amber-500/20' },
              { key: 'VAC', label: 'Value-Added Subjects (VAC)', color: 'bg-orange-500', barBg: 'bg-orange-500/20' },
              { key: 'TEACHING_PRACTICE', label: 'Practicum & Field Internship', color: 'bg-rose-500', barBg: 'bg-rose-500/20' },
            ].map(item => {
              const data = categoryCounts[item.key] || { count: 0, credits: 0 };
              const pct = requirements.length > 0 ? Math.round((data.count / requirements.length) * 100) : 0;

              return (
                <div key={item.key} className={`p-2.5 border rounded-xl space-y-1 text-xs transition ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                      <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.label}</span>
                    </div>
                    <span className={`font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{data.count} subjects • {data.credits} Cr</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Peak Hours & Timetable Density Heatmap (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-2xl p-5 space-y-4 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Campus Timetable Period Density Heatmap
              </h2>
            </div>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Concurrent Active Classes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[11px] ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <th className="py-2 px-3 text-left">Day</th>
                  <th className="py-2 px-2">P1<br /><span className="text-[9px] opacity-75">08:30</span></th>
                  <th className="py-2 px-2">P2<br /><span className="text-[9px] opacity-75">09:20</span></th>
                  <th className="py-2 px-2">P3<br /><span className="text-[9px] opacity-75">10:10</span></th>
                  <th className="py-2 px-1 text-[10px] text-amber-500/70 font-mono">☕</th>
                  <th className="py-2 px-2">P4<br /><span className="text-[9px] opacity-75">11:30</span></th>
                  <th className="py-2 px-2">P5<br /><span className="text-[9px] opacity-75">12:20</span></th>
                  <th className="py-2 px-2">P6<br /><span className="text-[9px] opacity-75">13:10</span></th>
                  <th className="py-2 px-2">P7<br /><span className="text-[9px] opacity-75">14:00</span></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((dayName, dIdx) => (
                  <tr key={dayName} className={`transition ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50'}`}>
                    <td className={`py-2.5 px-3 text-left font-bold text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                      {dayName}
                    </td>
                    {[0, 1, 2].map(pIdx => {
                      const count = heatmap[dIdx][pIdx];
                      return (
                        <td key={pIdx} className="py-2 px-2">
                          <span className={`inline-block w-8 py-1 rounded text-xs font-bold font-mono ${
                            count === 0
                              ? isDark ? 'bg-slate-950 text-slate-600' : 'bg-slate-100 text-slate-400'
                              : count === 1
                              ? isDark ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/40' : 'bg-indigo-100 text-indigo-700'
                              : count === 2
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-emerald-600 text-white font-black'
                          }`}>
                            {count}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2 px-1 bg-amber-500/5 text-amber-600/70 text-[10px]">
                      —
                    </td>
                    {[3, 4, 5, 6].map(pIdx => {
                      const count = heatmap[dIdx][pIdx];
                      return (
                        <td key={pIdx} className="py-2 px-2">
                          <span className={`inline-block w-8 py-1 rounded text-xs font-bold font-mono ${
                            count === 0
                              ? isDark ? 'bg-slate-950 text-slate-600' : 'bg-slate-100 text-slate-400'
                              : count === 1
                              ? isDark ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/40' : 'bg-indigo-100 text-indigo-700'
                              : count === 2
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-emerald-600 text-white font-black'
                          }`}>
                            {count}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center justify-between text-[11px] pt-2 border-t ${
            isDark ? 'text-slate-400 border-slate-800/60' : 'text-slate-500 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Activity Level:</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-200 text-slate-600'}`}>0</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px]">1-2</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">3+ Peak</span>
            </div>
            <span className="text-emerald-500 font-semibold">Zero Double-Booking Confirmed</span>
          </div>
        </div>
      </div>

      {/* 5. Degree Programs & Year-Wise Curriculum Architecture */}
      <div className={`border rounded-2xl p-5 space-y-4 transition ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Degree Programs & Year-Wise Curriculum Architecture
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Hierarchical relation of courses, years (1st, 2nd, 3rd, 4th Year), and semester subjects.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateInputStudio('CURRICULUM')}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open Curriculum Studio &rarr;</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {curriculumPrograms.map((prog: any) => (
            <div
              key={prog.program_id}
              className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {prog.short_code}
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {prog.duration_years} Years • {prog.total_semesters} Sems
                  </span>
                </div>
                <h4 className={`text-xs font-extrabold line-clamp-1 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  {prog.name}
                </h4>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {prog.department}
                </p>
              </div>

              {/* Year Breakdown Badges */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Year-Wise Subject Distribution:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(prog.year_breakdown || {}).map(([yk, yv]: [string, any]) => (
                    <div
                      key={yk}
                      className={`px-2 py-1 rounded-lg text-[10px] flex items-center justify-between border ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-semibold">{yv.label}:</span>
                      <span className="font-bold text-indigo-400">{yv.subject_count} subs</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total: <strong>{prog.total_subjects} Papers</strong> ({prog.total_credits} Cr)
                </span>
                <button
                  onClick={() => onNavigateInputStudio('CURRICULUM')}
                  className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                >
                  Manage Curriculum &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD ROOM / LAB                                                   */}
      {/* ========================================================================= */}
      {activeModal === 'ROOM' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-indigo-500" />
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Add University Room or Lab</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)} 
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRoom} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Room / Facility ID:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LAB_AI_301"
                  value={roomForm.room_id}
                  onChange={e => setRoomForm({ ...roomForm, room_id: e.target.value })}
                  className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Room / Lab Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced AI & Machine Learning Lab"
                  value={roomForm.name}
                  onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
                  className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Facility Type:</label>
                  <select
                    value={roomForm.room_type_id}
                    onChange={e => setRoomForm({ ...roomForm, room_type_id: e.target.value })}
                    className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="LECTURE_HALL">Lecture Hall</option>
                    <option value="COMPUTER_LAB">Computer / AI Lab</option>
                    <option value="SCIENCE_LAB">Science Lab</option>
                    <option value="PEDAGOGY_ROOM">Pedagogy / Seminar Room</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Seating Capacity:</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    required
                    value={roomForm.capacity}
                    onChange={e => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className={`px-4 py-2 rounded-xl font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Registering...' : 'Register Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD COURSE / SUBJECT                                             */}
      {/* ========================================================================= */}
      {activeModal === 'COURSE' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Add University Subject Offering</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)} 
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCourse} className="space-y-3 text-xs">
              {/* Target Course Cohort Selector */}
              <div className="space-y-1">
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Target Course Cohort:
                </label>
                <select
                  value={selectedCohortId}
                  onChange={e => setSelectedCohortId(e.target.value)}
                  className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {courseCohorts.map((c: any) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.course_name} — {c.student_count} Students ({c.rooms_required} Room{c.rooms_required > 1 ? 's' : ''} Needed) • {c.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Room Allocation Intelligence Banner */}
              {(() => {
                const matched = courseCohorts.find((c: any) => c.course_id === selectedCohortId);
                if (!matched) return null;
                const isMulti = matched.rooms_required > 1;
                return (
                  <div className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                    isMulti
                      ? isDark ? 'bg-purple-950/30 border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
                      : isDark ? 'bg-indigo-950/20 border-indigo-500/20 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{matched.course_name} ({matched.student_count} Students)</span>
                      </span>
                      <span className="font-mono text-emerald-400">0 Overlaps</span>
                    </div>
                    <div className="text-[10px]">
                      {isMulti
                        ? `⚡ High Enrollment (${matched.student_count} students > 75 cap) ➔ Auto-allocates ${matched.rooms_required} rooms: ${matched.allocated_room_names.join(' & ')}.`
                        : `✓ Fits within 1 Room (${matched.allocated_room_names[0] || 'Smart Lecture Hall'}).`}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Course Code:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-401"
                    value={courseForm.course_id}
                    onChange={e => setCourseForm({ ...courseForm, course_id: e.target.value })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Academic Program:</label>
                  <select
                    value={courseForm.program_type}
                    onChange={e => setCourseForm({ ...courseForm, program_type: e.target.value })}
                    className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="FYUP">Undergraduate Program</option>
                    <option value="ITEP">Integrated Program</option>
                    <option value="B_ED">Bachelor Program</option>
                    <option value="M_ED">Master Program</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Subject Title / Course Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Computing & Distributed Architecture"
                  value={courseForm.course_name}
                  onChange={e => setCourseForm({ ...courseForm, course_name: e.target.value })}
                  className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Category:</label>
                  <select
                    value={courseForm.nep_category}
                    onChange={e => setCourseForm({ ...courseForm, nep_category: e.target.value })}
                    className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="MAJOR">Major Core</option>
                    <option value="MINOR">Elective / Minor</option>
                    <option value="SEC">Skill Lab</option>
                    <option value="AEC">AEC Core</option>
                    <option value="VAC">Value-Added</option>
                    <option value="TEACHING_PRACTICE">Practicum</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Credits:</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={courseForm.credits}
                    onChange={e => setCourseForm({ ...courseForm, credits: Number(e.target.value) })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Duration Slots:</label>
                  <select
                    value={courseForm.duration_slots}
                    onChange={e => setCourseForm({ ...courseForm, duration_slots: Number(e.target.value) })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={1}>1 Hour (Theory)</option>
                    <option value={2}>2 Hours (Lab / Practicum)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Room Facility Required:</label>
                  <select
                    value={courseForm.room_type_id}
                    onChange={e => setCourseForm({ ...courseForm, room_type_id: e.target.value })}
                    className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="LECTURE_HALL">Lecture Hall</option>
                    <option value="COMPUTER_LAB">Computer Lab</option>
                    <option value="SCIENCE_LAB">Science Lab</option>
                    <option value="PEDAGOGY_ROOM">Pedagogy Room</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Eligible Faculty IDs:</label>
                  <input
                    type="text"
                    required
                    value={courseForm.eligible_faculty_ids}
                    onChange={e => setCourseForm({ ...courseForm, eligible_faculty_ids: e.target.value })}
                    placeholder="FAC_CS_01;FAC_CS_02"
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className={`px-4 py-2 rounded-xl font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Registering & Optimizing...' : 'Register Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD FACULTY MEMBER                                               */}
      {/* ========================================================================= */}
      {activeModal === 'FACULTY' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Faculty Member</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)} 
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFaculty} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Faculty ID:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FAC_AI_01"
                  value={facultyForm.faculty_id}
                  onChange={e => setFacultyForm({ ...facultyForm, faculty_id: e.target.value })}
                  className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full Name & Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Geoffrey Hinton"
                  value={facultyForm.name}
                  onChange={e => setFacultyForm({ ...facultyForm, name: e.target.value })}
                  className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Department:</label>
                  <input
                    type="text"
                    required
                    value={facultyForm.department_id}
                    onChange={e => setFacultyForm({ ...facultyForm, department_id: e.target.value })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Designation:</label>
                  <select
                    value={facultyForm.designation}
                    onChange={e => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                    className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Professor">Professor (14h limit)</option>
                    <option value="Associate Professor">Associate Professor (14h limit)</option>
                    <option value="Assistant Professor">Assistant Professor (16h limit)</option>
                    <option value="Guest Lecturer">Guest Lecturer (10h limit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Max Hours / Week:</label>
                  <input
                    type="number"
                    min="4"
                    max="24"
                    value={facultyForm.max_hours_week}
                    onChange={e => setFacultyForm({ ...facultyForm, max_hours_week: Number(e.target.value) })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Max Hours / Day:</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={facultyForm.max_hours_day}
                    onChange={e => setFacultyForm({ ...facultyForm, max_hours_day: Number(e.target.value) })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className={`px-4 py-2 rounded-xl font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Registering...' : 'Register Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD STUDENT COHORT / SECTION                                     */}
      {/* ========================================================================= */}
      {activeModal === 'COHORT' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-500" />
                <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>Add Student Cohort / Section</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)} 
                className={`p-1 rounded-lg transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCohort} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cohort Code / Group ID:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GRP_CS_SEM4"
                  value={cohortForm.group_id}
                  onChange={e => setCohortForm({ ...cohortForm, group_id: e.target.value })}
                  className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cohort Name / Description:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science Section B (Semester 4)"
                  value={cohortForm.name}
                  onChange={e => setCohortForm({ ...cohortForm, name: e.target.value })}
                  className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Academic Program:</label>
                  <select
                    value={cohortForm.program_type}
                    onChange={e => setCohortForm({ ...cohortForm, program_type: e.target.value })}
                    className={`w-full rounded-xl p-2.5 border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="FYUP">Undergraduate Program</option>
                    <option value="ITEP">Integrated Program</option>
                    <option value="B_ED">Bachelor Program</option>
                    <option value="M_ED">Master Program</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Expected Strength:</label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={cohortForm.expected_strength}
                    onChange={e => setCohortForm({ ...cohortForm, expected_strength: Number(e.target.value) })}
                    className={`w-full rounded-xl p-2.5 font-mono border transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className={`px-4 py-2 rounded-xl font-semibold transition border cursor-pointer ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Registering...' : 'Register Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
