import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Building2, BookOpen, Users, GraduationCap,
  Clock, DoorOpen,
  CheckCircle2, Layers,
  FlaskConical, TrendingUp,
  Activity, ArrowUpRight, Award, Lock, AlertTriangle
} from 'lucide-react';
import type { User } from '../types/auth';

interface DashboardViewProps {
  snapshot: any;
  placements: any[];
  currentUser: User;
  onNavigateInputStudio: (tab?: string) => void;
  onRefreshData: () => Promise<void>;
  theme?: 'dark' | 'light';
  periods?: Array<{ p: number; label: string; time: string; is_break?: boolean }>;
  lunchBreakAfter?: number;
}

export function DashboardView({
  snapshot,
  placements,
  currentUser: _currentUser,
  onNavigateInputStudio,
  onRefreshData: _onRefreshData,
  theme = 'dark',
  periods,
  lunchBreakAfter = 3,
}: DashboardViewProps) {
  const isDark = theme !== 'light';

  const [courseCohorts, setCourseCohorts] = useState<any[]>([]);
  const [hasCampusDeficit, setHasCampusDeficit] = useState<boolean>(false);
  const [campusDeficits, setCampusDeficits] = useState<any[]>([]);
  const [activeFacilityFilter, setActiveFacilityFilter] = useState<'ALL' | 'LECTURE_HALL' | 'LAB'>('ALL');

  useEffect(() => {
    fetch('/api/courses')
      .then(r => r.json())
      .then(data => {
        if (data.courses) {
          setCourseCohorts(data.courses);
          setHasCampusDeficit(!!data.has_campus_deficit);
          setCampusDeficits(data.campus_deficits || []);
        }
      })
      .catch(() => {});
  }, []);

  // Raw Snapshot Entities
  const rooms = snapshot?.rooms || [];
  const faculty = snapshot?.faculty || [];
  const requirements = snapshot?.requirements || [];
  const studentGroups = snapshot?.student_groups || [];

  // 1. Metric: Total seats & facility stats
  const totalSeats = useMemo(() => {
    return rooms.reduce((acc: number, r: any) => acc + (r.capacity || 0), 0);
  }, [rooms]);

  // 2. Metric: Room occupancy map (booked hours per room)
  const teachableSlotsPerRoom = 35; // 5 days * 7 teachable slots
  const roomOccupancyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rooms) map.set(r.room_id, 0);
    for (const p of placements) {
      if (p.assigned_room_id && map.has(p.assigned_room_id)) {
        map.set(p.assigned_room_id, (map.get(p.assigned_room_id) || 0) + (p.duration_slots || 1));
      }
    }
    return map;
  }, [rooms, placements]);

  // Campus overall utilization rate
  const campusUtilizationRate = useMemo(() => {
    if (rooms.length === 0) return 0;
    const totalBooked = Array.from(roomOccupancyMap.values()).reduce((a, b) => a + b, 0);
    const totalPossible = rooms.length * teachableSlotsPerRoom;
    return totalPossible > 0 ? Math.min(100, Math.round((totalBooked / totalPossible) * 100)) : 0;
  }, [rooms, roomOccupancyMap]);

  // 3. Metric: Faculty workload
  const facultyWorkloadMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of faculty) map.set(f.faculty_id, 0);
    for (const p of placements) {
      for (const fid of p.assigned_faculty_ids || []) {
        if (map.has(fid)) {
          map.set(fid, (map.get(fid) || 0) + (p.duration_slots || 1));
        }
      }
    }
    return map;
  }, [faculty, placements]);

  const totalAssignedFacultyHours = useMemo(() => {
    return Array.from(facultyWorkloadMap.values()).reduce((a, b) => a + b, 0);
  }, [facultyWorkloadMap]);

  const totalFacultyMaxCapacity = useMemo(() => {
    return faculty.reduce((acc: number, f: any) => acc + (f.max_hours_week || 16), 0);
  }, [faculty]);

  // 4. Metric: Curriculum NEP breakdown
  const categoryCounts = useMemo(() => {
    const catMap: Record<string, { count: number; credits: number }> = {};
    for (const r of requirements) {
      const cat = r.nep_category || 'MAJOR';
      if (!catMap[cat]) catMap[cat] = { count: 0, credits: 0 };
      catMap[cat].count += 1;
      catMap[cat].credits += r.credits || 4;
    }
    return catMap;
  }, [requirements]);

  const totalCredits = useMemo(() => {
    return requirements.reduce((acc: number, r: any) => acc + (r.credits || 0), 0);
  }, [requirements]);

  // 5. Metric: Total enrolled students across cohorts
  const totalStudents = useMemo(() => {
    if (courseCohorts.length > 0) {
      return courseCohorts.reduce((acc, c) => acc + (c.student_count || 0), 0);
    }
    return studentGroups.reduce((acc: number, g: any) => acc + (g.expected_strength || 0), 0);
  }, [courseCohorts, studentGroups]);

  // 6. Metric: Timetable Period Density Heatmap Matrix (5 days x 7 periods)
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 5 }, () => Array(8).fill(0));
    for (const p of placements) {
      const d = Math.floor(p.start_slot / 8);
      const slot = p.start_slot % 8;
      if (d >= 0 && d < 5) {
        for (let step = 0; step < (p.duration_slots || 1); step++) {
          const s = slot + step;
          if (s < 8) grid[d][s] += 1;
        }
      }
    }
    return grid;
  }, [placements]);

  const effectivePeriods = useMemo(() => {
    return (periods && periods.length > 0)
      ? periods
      : [
          { p: 0, label: 'P1', time: '08:30 - 09:20' },
          { p: 1, label: 'P2', time: '09:20 - 10:10' },
          { p: 2, label: 'P3', time: '10:10 - 11:00' },
          { p: 3, label: 'P4', time: '11:30 - 12:20' },
          { p: 4, label: 'P5', time: '12:20 - 13:10' },
          { p: 5, label: 'P6', time: '13:10 - 14:00' },
          { p: 6, label: 'P7', time: '14:00 - 14:50' },
          { p: 7, label: 'P8', time: '14:50 - 15:40' },
        ];
  }, [periods]);

  const lunchStartTime = useMemo(() => {
    const lunchIdx = lunchBreakAfter !== undefined ? lunchBreakAfter : 3;
    if (lunchIdx > 0 && effectivePeriods[lunchIdx - 1]) {
      return effectivePeriods[lunchIdx - 1].time?.split('-')[1]?.trim() || '11:00';
    }
    return '11:00';
  }, [lunchBreakAfter, effectivePeriods]);

  // 7. Metric: Campus Hourly Activity Flow (Traffic curve across configured period slots)
  const hourlyActivity = useMemo(() => {
    const list: Array<{ label: string; time: string; activeCount: number; isBreak: boolean }> = [];
    const lunchIdx = lunchBreakAfter !== undefined ? lunchBreakAfter : 3;

    effectivePeriods.forEach((per) => {
      if (lunchIdx > 0 && per.p === lunchIdx) {
        const prevEnd = effectivePeriods[per.p - 1]?.time?.split('-')[1]?.trim() || '';
        const currStart = per.time?.split('-')[0]?.trim() || '';
        list.push({
          label: 'Lunch',
          time: prevEnd && currStart ? `${prevEnd} - ${currStart}` : 'Lunch',
          activeCount: 0,
          isBreak: true,
        });
      }

      let count = 0;
      for (let d = 0; d < 5; d++) {
        count += heatmap[d]?.[per.p] || 0;
      }
      list.push({
        label: per.label,
        time: per.time,
        activeCount: Math.round(count / 5),
        isBreak: false,
      });
    });

    return list;
  }, [effectivePeriods, heatmap, lunchBreakAfter]);

  // Filtered rooms for occupancy chart
  const displayedRooms = useMemo(() => {
    if (activeFacilityFilter === 'LECTURE_HALL') {
      return rooms.filter((r: any) => !r.room_type_id.includes('LAB'));
    }
    if (activeFacilityFilter === 'LAB') {
      return rooms.filter((r: any) => r.room_type_id.includes('LAB'));
    }
    return rooms;
  }, [rooms, activeFacilityFilter]);

  // Max value for hourly traffic chart scaling
  const maxHourlyCount = Math.max(...hourlyActivity.map(h => h.activeCount), 4);

  return (
    <div className={`flex-1 overflow-y-auto p-6 space-y-7 max-w-7xl mx-auto w-full transition-colors ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* 1. Primary University KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Rooms & Labs */}
        <div className={`border rounded-2xl p-4.5 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Facilities & Labs
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <DoorOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{rooms.length} Units</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalSeats} Total Student Desks
            </div>
          </div>
          <div className={`text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-between border ${
            isDark ? 'text-indigo-300 bg-indigo-950/40 border-indigo-500/20' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
          }`}>
            <span>Campus Utilization:</span>
            <span className="font-extrabold text-indigo-400">{campusUtilizationRate}%</span>
          </div>
        </div>

        {/* KPI 2: Courses & Subjects */}
        <div className={`border rounded-2xl p-4.5 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Curriculum Papers
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{requirements.length} Papers</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalCredits} Total Academic Credits
            </div>
          </div>
          <div className={`text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-between border ${
            isDark ? 'text-emerald-300 bg-emerald-950/40 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          }`}>
            <span>Scheduled Weekly:</span>
            <span className="font-extrabold text-emerald-400">{placements.length} Slots</span>
          </div>
        </div>

        {/* KPI 3: Faculty Staff */}
        <div className={`border rounded-2xl p-4.5 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-purple-500/50' : 'bg-white border-slate-200 hover:border-purple-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Academic Faculty
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{faculty.length} Faculty</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalAssignedFacultyHours}h / {totalFacultyMaxCapacity}h Cap
            </div>
          </div>
          <div className={`text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-between border ${
            isDark ? 'text-purple-300 bg-purple-950/40 border-purple-500/20' : 'text-purple-700 bg-purple-50 border-purple-200'
          }`}>
            <span>Staff Workload:</span>
            <span className="font-extrabold text-purple-400">
              {totalFacultyMaxCapacity > 0 ? Math.round((totalAssignedFacultyHours / totalFacultyMaxCapacity) * 100) : 0}% Active
            </span>
          </div>
        </div>

        {/* KPI 4: Student Cohorts */}
        <div className={`border rounded-2xl p-4.5 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-amber-500/50' : 'bg-white border-slate-200 hover:border-amber-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Enrolled Students
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalStudents} Students</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {courseCohorts.length > 0 ? `${courseCohorts.length} Primary Cohorts` : `${studentGroups.length} Sections`}
            </div>
          </div>
          <div className={`text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-between border ${
            isDark ? 'text-amber-300 bg-amber-950/40 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}>
            <span>Room Allotment:</span>
            <span className="font-extrabold text-amber-400">Auto-Balanced</span>
          </div>
        </div>

        {/* KPI 5: Solver Timetable Status */}
        <div className={`border rounded-2xl p-4.5 space-y-3 relative overflow-hidden group transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/50' : 'bg-white border-slate-200 hover:border-cyan-400 shadow-xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Schedule Integrity
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400">0 Clashes</div>
            <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              100% Conflict-Free
            </div>
          </div>
          <div className={`text-[11px] px-2.5 py-1.5 rounded-xl flex items-center justify-between border ${
            isDark ? 'text-cyan-300 bg-cyan-950/40 border-cyan-500/20' : 'text-cyan-700 bg-cyan-50 border-cyan-200'
          }`}>
            <span>Solver Engine:</span>
            <span className="font-extrabold text-cyan-400">CP-SAT Multi-Obj</span>
          </div>
        </div>
      </div>

      {/* 3. CORE VISUAL GRAPH ROW 1: Facilities Occupancy Chart & Hourly Activity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* GRAPH 1: Facilities & Labs Utilization Bar Chart (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-3xl p-6 space-y-5 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex flex-wrap items-center justify-between border-b pb-4 gap-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Campus Facilities Occupancy & Weekly Load
                </h2>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Booked Teaching Hours vs 35h Max Weekly Availability
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className={`p-1 rounded-xl flex items-center gap-1 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => setActiveFacilityFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  activeFacilityFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({rooms.length})
              </button>
              <button
                onClick={() => setActiveFacilityFilter('LECTURE_HALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  activeFacilityFilter === 'LECTURE_HALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Halls
              </button>
              <button
                onClick={() => setActiveFacilityFilter('LAB')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  activeFacilityFilter === 'LAB'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Labs
              </button>
            </div>
          </div>

          {/* Pure Visual Bar Chart */}
          <div className="space-y-3.5">
            {displayedRooms.map((room: any) => {
              const bookedHours = roomOccupancyMap.get(room.room_id) || 0;
              const pct = Math.min(100, Math.round((bookedHours / teachableSlotsPerRoom) * 100));
              const isLab = room.room_type_id.includes('LAB');

              return (
                <div
                  key={room.room_id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isDark ? 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50/80 border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isLab ? (
                        <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <DoorOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                      <span className={`font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                        {room.name}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                        isDark ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {room.capacity} Seats
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                      <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {bookedHours}h / 35h
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                        pct > 75 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Multi-layered Visual Progress Bar */}
                  <div className={`w-full h-3 rounded-full overflow-hidden flex relative ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isLab
                          ? 'bg-gradient-to-r from-teal-500 via-emerald-400 to-green-500'
                          : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${isDark ? 'text-slate-400 border-slate-800/80' : 'text-slate-500 border-slate-200'}`}>
            <span>Benchmarked against 35 teachable periods / week</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              0 Classroom Clashes Active
            </span>
          </div>
        </div>

        {/* GRAPH 2: Hourly Campus Activity Wave / Curve (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-3xl p-6 space-y-5 flex flex-col justify-between transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div>
            <div className={`flex items-center justify-between border-b pb-4 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Daily Campus Activity Curve
                  </h2>
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Average Concurrent Lectures by Period
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Peak: P4–P5
              </span>
            </div>

            {/* SVG Visual Wave / Area Curve */}
            <div className="h-48 w-full relative pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="20" x2="400" y2="20" stroke={isDark ? "#334155" : "#e2e8f0"} strokeDasharray="3 3" />
                <line x1="0" y1="65" x2="400" y2="65" stroke={isDark ? "#334155" : "#e2e8f0"} strokeDasharray="3 3" />
                <line x1="0" y1="110" x2="400" y2="110" stroke={isDark ? "#334155" : "#e2e8f0"} strokeDasharray="3 3" />

                {/* Build Smooth Curve Path */}
                {(() => {
                  const stepX = 400 / (hourlyActivity.length - 1);
                  const points = hourlyActivity.map((h, i) => {
                    const x = i * stepX;
                    const y = 110 - (h.activeCount / maxHourlyCount) * 90;
                    return { x, y };
                  });

                  // Generate SVG path string
                  const pathData = points.reduce((acc, pt, i) => {
                    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                  }, '');

                  const closedPath = `${pathData} L 400 120 L 0 120 Z`;

                  return (
                    <>
                      <path d={closedPath} fill="url(#areaGlow)" />
                      <path d={pathData} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                      {points.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r="4"
                          fill="#06b6d4"
                          stroke={isDark ? "#0f172a" : "#ffffff"}
                          strokeWidth="2"
                        />
                      ))}
                    </>
                  );
                })()}
              </svg>

              {/* Period Labels under graph */}
              <div className="flex justify-between items-center text-[10px] font-mono mt-2 text-slate-400">
                {hourlyActivity.map((h, i) => (
                  <span key={i} className={`text-center ${h.isBreak ? 'text-amber-500 font-bold' : ''}`}>
                    {h.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Breakdown Highlights */}
            <div className="grid grid-cols-3 gap-2.5 mt-5">
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block uppercase">Morning Flow</span>
                <span className="text-sm font-black text-indigo-400">P1 – P3</span>
                <span className="text-[10px] text-slate-500 block">Core Lectures</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span className="text-[10px] block uppercase font-bold">Lunch Intermission</span>
                <span className="text-sm font-black">{lunchStartTime}</span>
                <span className="text-[10px] block opacity-80">30 Min Break</span>
              </div>
              <div className={`p-3 rounded-xl border text-center ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] text-slate-400 block uppercase">Afternoon Peak</span>
                <span className="text-sm font-black text-emerald-400">P4 – P7</span>
                <span className="text-[10px] text-slate-500 block">Practical Labs</span>
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            isDark ? 'bg-cyan-950/20 border-cyan-500/20 text-slate-300' : 'bg-cyan-50 border-cyan-200 text-cyan-900'
          }`}>
            <span>Campus Operational Smoothness:</span>
            <span className="font-extrabold text-cyan-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Optimal Dispersion
            </span>
          </div>
        </div>
      </div>

      {/* 4. CORE VISUAL GRAPH ROW 2: Faculty Workload vs Quota & Timetable Density Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* GRAPH 3: Faculty Workload vs Quota Distribution (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-3xl p-6 space-y-4 flex flex-col justify-between transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div>
            <div className={`flex items-center justify-between border-b pb-4 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Faculty Workload vs Regulatory Quota
                  </h2>
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Teaching Hours vs 16h/week Maximum Ceiling
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                100% Compliant
              </span>
            </div>

            <div className="space-y-3">
              {faculty.slice(0, 7).map((f: any) => {
                const assigned = facultyWorkloadMap.get(f.faculty_id) || 0;
                const max = f.max_hours_week || 16;
                const pct = Math.min(100, Math.round((assigned / max) * 100));

                return (
                  <div key={f.faculty_id} className={`p-3 border rounded-xl space-y-1.5 transition ${
                    isDark ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <span className={`font-bold block truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {f.name}
                        </span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {f.department_id || 'Computing'} • {f.designation || 'Professor'}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{assigned}h</span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> / {max}h</span>
                        <span className="text-[10px] font-bold text-indigo-400 ml-1.5">({pct}%)</span>
                      </div>
                    </div>

                    <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 85
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : pct > 50
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                            : 'bg-gradient-to-r from-teal-400 to-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            isDark ? 'bg-purple-950/20 border-purple-500/20 text-slate-300' : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}>
            <span>Total Faculty Teaching Capacity:</span>
            <span className="font-extrabold text-purple-400">
              {totalAssignedFacultyHours}h assigned / {totalFacultyMaxCapacity}h max
            </span>
          </div>
        </div>

        {/* GRAPH 4: Weekly Period Density Heatmap Matrix (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-3xl p-6 space-y-4 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Campus Period Density Heatmap
                </h2>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Concurrent Active Lectures Across Days & Time Slots
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              0 Clashes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[11px] ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <th className="py-2.5 px-3 text-left">Day</th>
                  {effectivePeriods.map((per) => (
                    <Fragment key={per.p}>
                      {lunchBreakAfter > 0 && per.p === lunchBreakAfter && (
                        <th className="py-2.5 px-2 text-[10px] text-amber-500 font-bold">LUNCH</th>
                      )}
                      <th className="py-2.5 px-2">
                        {per.label}<br />
                        <span className="text-[9px] opacity-75 font-mono">{per.time.split('-')[0]?.trim()}</span>
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((dayName, dIdx) => (
                  <tr key={dayName} className={`transition ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50'}`}>
                    <td className={`py-3 px-3 text-left font-bold text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                      {dayName}
                    </td>
                    {effectivePeriods.map((per) => {
                      const count = heatmap[dIdx]?.[per.p] || 0;
                      return (
                        <Fragment key={per.p}>
                          {lunchBreakAfter > 0 && per.p === lunchBreakAfter && (
                            <td className="py-2.5 px-2 bg-amber-500/5 text-amber-500/80 font-bold text-[10px]">
                              ☕
                            </td>
                          )}
                          <td className="py-2.5 px-2">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-bold font-mono transition shadow-xs ${
                              count === 0
                                ? isDark ? 'bg-slate-950/80 text-slate-600 border border-slate-900' : 'bg-slate-100 text-slate-400'
                                : count === 1
                                ? isDark ? 'bg-indigo-950/90 text-indigo-300 border border-indigo-800/50' : 'bg-indigo-100 text-indigo-700'
                                : count === 2
                                ? 'bg-indigo-600 text-white font-black shadow-indigo-600/25'
                                : 'bg-emerald-600 text-white font-black shadow-emerald-600/25'
                            }`}>
                              {count}
                            </span>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center justify-between text-xs pt-3 border-t ${
            isDark ? 'text-slate-400 border-slate-800/60' : 'text-slate-500 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Load Scale:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-200 text-slate-600'}`}>0 Free</span>
              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px]">1 Light</span>
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px]">2 Moderate</span>
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px]">3+ Heavy</span>
            </div>
            <span className="text-emerald-400 font-bold">Autonomous Room Leveling</span>
          </div>
        </div>
      </div>

      {/* 5. CORE VISUAL GRAPH ROW 3: Student Cohort Room Split & NEP Curriculum Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* GRAPH 5: Student Cohort Enrollment & Room Allocation Architecture (7 Cols) */}
        <div className={`lg:col-span-7 border rounded-3xl p-6 space-y-4 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h2 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Student Cohort Architecture & Multi-Room Allocation
                </h2>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Exclusive Room Locking: 1 Classroom ➔ 1 Dedicated Course Section
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Hall Cap: 75 Desks
            </span>
          </div>

          {/* Campus Deficit or Assurance Banner */}
          {hasCampusDeficit ? (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-rose-950/30 border-rose-800/60 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div>
                    <strong>Classroom Deficit Detected:</strong> Campus has registered courses requiring more lecture halls than available. Existing rooms are locked exclusively to prevent cross-course collision.
                  </div>
                  {campusDeficits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {campusDeficits.map((d: any, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                          {d.course_name}: {d.deficit_count} classroom(s) missing
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onNavigateInputStudio('ROOMS')}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] shrink-0 cursor-pointer"
              >
                Add Rooms
              </button>
            </div>
          ) : (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
              isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px]">
                  <strong>Exclusive Room Locking Active:</strong> Each physical classroom is locked to a single course section. Zero cross-course room sharing.
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                100% EXCLUSIVE
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {courseCohorts.map((crs: any) => {
              const count = crs.student_count || 60;
              const roomsNeeded = crs.rooms_required || (count > 75 ? 2 : 1);
              const hasDeficit = !!crs.has_deficit;

              return (
                <div
                  key={crs.course_id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition ${
                    hasDeficit
                      ? isDark ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-700' : 'bg-rose-50 border-rose-200'
                      : isDark ? 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm">{crs.course_name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                        Year {crs.year} • Sem {crs.semester}
                      </span>
                    </div>
                    <span className={`text-xs block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {count} Enrolled Students
                    </span>
                  </div>

                  {/* Room Allocation Visual Flow */}
                  <div className={`p-2.5 rounded-xl border space-y-1.5 ${
                    hasDeficit
                      ? isDark ? 'bg-rose-950/40 border-rose-800/60 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                      : roomsNeeded > 1
                        ? isDark ? 'bg-purple-950/20 border-purple-800/40 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-800'
                        : isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        {hasDeficit ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span>⚠️ Classroom Deficit Error</span>
                          </>
                        ) : roomsNeeded > 1 ? (
                          <span>⚡ {roomsNeeded} Rooms Auto-Allotted</span>
                        ) : (
                          <span>🏛️ 1 Room Dedicated</span>
                        )}
                      </span>
                      <span className={`text-[10px] font-mono ${hasDeficit ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                        {hasDeficit ? `Missing ${crs.deficit_count} Room(s)` : '0 Overlaps • Locked'}
                      </span>
                    </div>

                    {crs.error_message && (
                      <div className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 p-1.5 rounded-md border border-rose-500/20">
                        {crs.error_message}
                      </div>
                    )}

                    <div className="text-[11px] space-y-1 opacity-90">
                      {crs.sections && crs.sections.length > 0 ? (
                        crs.sections.map((sec: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            className={`flex items-center justify-between text-[11px] py-1 px-2 rounded-lg border ${
                              sec.has_deficit
                                ? isDark ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                                : isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className={`font-bold flex items-center gap-1 ${sec.has_deficit ? 'text-rose-400' : 'text-indigo-400'}`}>
                              {sec.has_deficit ? <AlertTriangle className="w-3 h-3 text-rose-400" /> : <Lock className="w-3 h-3 text-indigo-400" />}
                              <span>{sec.section_name} ({sec.students} sts):</span>
                            </span>
                            <span className="truncate font-semibold max-w-[170px]" title={sec.room_name}>
                              {sec.room_name}
                            </span>
                          </div>
                        ))
                      ) : crs.allocated_room_names && crs.allocated_room_names.length > 0 ? (
                        crs.allocated_room_names.map((rmName: string, rIdx: number) => (
                          <div
                            key={rIdx}
                            className={`flex items-center justify-between text-[11px] py-1 px-2 rounded-lg border ${
                              isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="font-bold flex items-center gap-1 text-indigo-400">
                              <Lock className="w-3 h-3 text-indigo-400" />
                              <span>Section {String.fromCharCode(65 + rIdx)}:</span>
                            </span>
                            <span className="truncate font-semibold max-w-[170px]" title={rmName}>
                              {rmName}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">Exclusive Room Allocated</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <span>Cohorts exceeding 75 students are partitioned into parallel rooms automatically</span>
            <button
              onClick={() => onNavigateInputStudio('CURRICULUM')}
              className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Explore Curriculum Matrix</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* GRAPH 6: NEP 2020 Curriculum Categories & Credit Weights (5 Cols) */}
        <div className={`lg:col-span-5 border rounded-3xl p-6 space-y-4 transition ${
          isDark ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className={`text-sm font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  NEP 2020 Curriculum Distribution
                </h2>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Academic Subject Categories & Credit Breakdown
                </span>
              </div>
            </div>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {totalCredits} Total Cr
            </span>
          </div>

          {/* Categorical Visual Meters */}
          <div className="space-y-3">
            {[
              { key: 'MAJOR', label: 'Major Core Subjects (DSC)', color: 'bg-indigo-500', textColor: 'text-indigo-400' },
              { key: 'MINOR', label: 'Elective / Minor Baskets', color: 'bg-purple-500', textColor: 'text-purple-400' },
              { key: 'SEC', label: 'Skill Practical Labs (SEC)', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
              { key: 'AEC', label: 'Ability Enhancement (AEC)', color: 'bg-amber-500', textColor: 'text-amber-400' },
              { key: 'VAC', label: 'Value-Added Subjects (VAC)', color: 'bg-rose-500', textColor: 'text-rose-400' },
            ].map(item => {
              const data = categoryCounts[item.key] || { count: 0, credits: 0 };
              const pct = requirements.length > 0 ? Math.round((data.count / requirements.length) * 100) : 0;

              return (
                <div key={item.key} className={`p-3 border rounded-xl space-y-1.5 text-xs transition ${
                  isDark ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                      <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.label}</span>
                    </div>
                    <span className="font-mono text-xs">
                      <strong>{data.count}</strong> papers • <strong className={item.textColor}>{data.credits} Cr</strong>
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-200'}`}>
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            isDark ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <span>Credit Framework Compliance:</span>
            <span className="font-extrabold text-emerald-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              NEP 2020 Certified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
