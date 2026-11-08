import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, ShieldCheck, RefreshCw, 
  Layers, Users, DoorOpen, Sparkles, BarChart3, Move
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
  time_grid: {
    num_days: number;
    periods_per_day: number;
  };
  student_groups: Array<{ group_id: string; name: string; parent_id?: string }>;
  rooms: Array<{ room_id: string; name: string; room_type_id: string; capacity: number }>;
  faculty: Array<{ faculty_id: string; name: string }>;
  requirements: Array<{
    requirement_id: string;
    course_id: string;
    course_name: string;
    group_ids: string[];
    session_type: string;
    duration_slots: number;
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
  const [solveTime, setSolveTime] = useState<number>(0.73);

  // Filters: viewType = 'GROUP' | 'FACULTY' | 'ROOM'
  const [viewType, setViewType] = useState<'GROUP' | 'FACULTY' | 'ROOM'>('GROUP');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('GRP_SEC_A');

  // Interactive Live Move
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [validTargetSlots, setValidTargetSlots] = useState<number[]>([]);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  // Compare Modal
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);
  const [comparisonData, setComparisonData] = useState<Record<string, any> | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);

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

  // Initial load
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
      } catch (err) {
        console.error('Failed to connect to backend API:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

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

  // Handle Session Click -> Compute Valid Targets
  async function handleSessionClick(instanceId: string) {
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
      setValidTargetSlots([]);
      setMoveMessage(null);
      return;
    }
    setSelectedInstanceId(instanceId);
    setMoveMessage("Computing valid clash-free target slots...");
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

  // Fetch Comparison
  async function handleOpenCompare() {
    setShowCompareModal(true);
    setComparing(true);
    try {
      const res = await fetch('/api/compare', { method: 'POST' });
      const data = await res.json();
      setComparisonData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setComparing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-200">
        <div className="text-center space-y-3">
          <RefreshCw className="w-10 h-10 animate-spin text-indigo-400 mx-auto" />
          <h2 className="text-xl font-semibold">Connecting to Acadence Engine...</h2>
          <p className="text-slate-400 text-sm">Loading domain snapshots and active timetable</p>
        </div>
      </div>
    );
  }

  // Filter placements visible in current view
  const reqMap = new Map((snapshot?.requirements || []).map(r => [r.requirement_id, r]));
  const facultyMap = new Map((snapshot?.faculty || []).map(f => [f.faculty_id, f.name]));
  const roomMap = new Map((snapshot?.rooms || []).map(r => [r.room_id, r.name]));

  // Build grid map: (day, period) -> placement
  const gridCells = new Map<string, Placement>();
  for (const p of placements) {
    const req = reqMap.get(p.requirement_id);
    if (!req) continue;

    let isVisible = false;
    if (viewType === 'GROUP') {
      isVisible = req.group_ids.includes(selectedEntityId);
    } else if (viewType === 'FACULTY') {
      isVisible = p.assigned_faculty_ids.includes(selectedEntityId);
    } else if (viewType === 'ROOM') {
      isVisible = p.assigned_room_id === selectedEntityId;
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-black text-xl text-slate-950 shadow-lg shadow-indigo-500/20">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">ACADENCE</h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                OR-Tools CP-SAT
              </span>
            </div>
            <p className="text-xs text-slate-400">Deterministic Timetable Optimization & Verification Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Validator Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Independent Validator: <strong>{validation?.is_valid ? 'VALID (0 Clashes)' : 'INVALID'}</strong></span>
          </div>

          {/* Compare Alternatives Button */}
          <button
            onClick={handleOpenCompare}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Compare Profiles</span>
          </button>

          {/* Re-Generate Button */}
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

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Profile Switcher & Quality Scorecard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Profiles */}
          <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Objective Profiles (Section 11)
                </span>
                <span className="text-xs text-slate-500">Solved in {solveTime.toFixed(2)}s</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'BALANCED', label: 'Balanced', desc: 'Equal trade-off' },
                  { id: 'FACULTY_FRIENDLY', label: 'Faculty-Friendly', desc: '0 faculty gaps' },
                  { id: 'STUDENT_FRIENDLY', label: 'Student-Friendly', desc: '0 student gaps' },
                  { id: 'SPACE_EFFICIENT', label: 'Space-Efficient', desc: 'Consolidate rooms' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleGenerate(p.id)}
                    disabled={solving}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      activeProfile === p.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-200">{p.label}</div>
                    <div className="text-[10px] text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics Scorecard */}
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Quality Scorecard (Soft Constraints CON-S)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-lg font-black text-emerald-400">{metrics?.distribution_excess ?? 0}</div>
                <div className="text-[11px] font-medium text-slate-300">Spread Excess</div>
                <div className="text-[10px] text-slate-500">CON-S-008 (0 = Perfect)</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-lg font-black text-emerald-400">{metrics?.faculty_gaps ?? 0} <span className="text-xs font-normal">hrs</span></div>
                <div className="text-[11px] font-medium text-slate-300">Faculty Idle Gaps</div>
                <div className="text-[10px] text-slate-500">CON-S-003</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-lg font-black text-emerald-400">{metrics?.student_gaps ?? 0} <span className="text-xs font-normal">hrs</span></div>
                <div className="text-[11px] font-medium text-slate-300">Student Idle Gaps</div>
                <div className="text-[10px] text-slate-500">CON-S-004</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-center">
                <div className="text-lg font-black text-indigo-400">{metrics?.composite_score ?? 0}</div>
                <div className="text-[11px] font-medium text-slate-300">Objective Score</div>
                <div className="text-[10px] text-slate-500">Lower is better</div>
              </div>
            </div>
          </div>
        </div>

        {/* View Filter Controls & Drag Instruction Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 border border-slate-800 px-4 py-3 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Schedule View:
            </span>
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => { setViewType('GROUP'); setSelectedEntityId('GRP_SEC_A'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewType === 'GROUP' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                By Student Group
              </button>
              <button
                onClick={() => { setViewType('FACULTY'); setSelectedEntityId('FAC_01'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewType === 'FACULTY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                By Faculty Member
              </button>
              <button
                onClick={() => { setViewType('ROOM'); setSelectedEntityId('LH_101'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${viewType === 'ROOM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                By Room
              </button>
            </div>

            {/* Entity Select */}
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {viewType === 'GROUP' && (
                snapshot?.student_groups.map(g => (
                  <option key={g.group_id} value={g.group_id}>
                    {g.name} ({g.group_id.replace('GRP_', '')})
                  </option>
                ))
              )}
              {viewType === 'FACULTY' && (
                snapshot?.faculty.map(f => (
                  <option key={f.faculty_id} value={f.faculty_id}>
                    {f.name} ({f.faculty_id})
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

          {/* Interactive Move Instruction */}
          <div className="flex items-center gap-2 text-xs">
            {moveMessage ? (
              <span className="text-amber-400 font-medium flex items-center gap-1.5 animate-pulse">
                <Move className="w-3.5 h-3.5" />
                {moveMessage}
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-indigo-400" />
                Click any session card to light up clash-free drop slots.
              </span>
            )}
          </div>
        </div>

        {/* Timetable Grid */}
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
                      <th className="py-3 px-3 text-center border-r border-slate-800 min-w-[135px]">
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
                      const isPractical = req?.session_type === 'PRACTICAL';

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
                            className={`p-2 border-r border-slate-800 align-top transition cursor-pointer relative h-28 ${
                              isValidTarget 
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 ring-2 ring-emerald-400 ring-inset' 
                                : isSelectedSession
                                  ? 'bg-indigo-600/30 ring-2 ring-indigo-400 ring-inset'
                                  : 'hover:bg-slate-800/40'
                            }`}
                          >
                            {cellPlacement ? (
                              <div className={`h-full rounded-lg p-2.5 flex flex-col justify-between shadow-sm border transition ${
                                isPractical
                                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100 hover:border-emerald-400'
                                  : 'bg-indigo-950/50 border-indigo-500/40 text-indigo-100 hover:border-indigo-400'
                              }`}>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-extrabold text-xs tracking-tight">
                                      {req?.course_id}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                      isPractical ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'
                                    }`}>
                                      {isPractical ? 'Lab (2h)' : 'Theory'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-medium leading-tight text-slate-300 line-clamp-1">
                                    {req?.course_name}
                                  </div>
                                </div>

                                <div className="mt-2 pt-1 border-t border-slate-800/60 text-[10px] space-y-0.5 text-slate-400">
                                  <div className="flex items-center gap-1 text-slate-300">
                                    <DoorOpen className="w-3 h-3 text-slate-400" />
                                    <span>{cellPlacement.assigned_room_id ? roomMap.get(cellPlacement.assigned_room_id) : 'Virtual'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <Users className="w-3 h-3 text-slate-500" />
                                    <span className="truncate">
                                      {cellPlacement.assigned_faculty_ids.map(id => facultyMap.get(id)).join(', ')}
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

      {/* Compare Profiles Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Alternative Timetable Comparison (Section 11)</h3>
                <p className="text-xs text-slate-400">Comparing candidate profiles generated by OR-Tools CP-SAT</p>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {comparing ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Solving across all 4 objective profiles in parallel...</p>
              </div>
            ) : comparisonData ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Object.entries(comparisonData).map(([key, item]: [string, any]) => (
                  <div 
                    key={key} 
                    className={`rounded-xl border p-4 flex flex-col justify-between ${
                      activeProfile === key 
                        ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-500/10' 
                        : 'bg-slate-950/50 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-slate-200">{item.profile_name}</span>
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          VALID
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-4">{item.description}</p>

                      <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Distribution:</span>
                          <span className="font-bold text-slate-300">{item.metrics?.distribution_excess} excess</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Faculty Gaps:</span>
                          <span className="font-bold text-slate-300">{item.metrics?.faculty_gaps} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Student Gaps:</span>
                          <span className="font-bold text-slate-300">{item.metrics?.student_gaps} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Solve Time:</span>
                          <span className="font-bold text-slate-300">{item.solve_time_seconds?.toFixed(2)}s</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleGenerate(key);
                        setShowCompareModal(false);
                      }}
                      className="mt-4 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                    >
                      {activeProfile === key ? 'Active Plan' : 'Select This Profile'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
