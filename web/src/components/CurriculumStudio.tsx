import React, { useState, useEffect } from 'react';
import {
  GraduationCap, BookOpen, Plus, Trash2, Calendar, Layers,
  CheckCircle2, DoorOpen, Users, AlertCircle,
  Search, RefreshCw
} from 'lucide-react';

interface ProgramSummary {
  program_id: string;
  name: string;
  short_code: string;
  department: string;
  duration_years: number;
  semesters_per_year: number;
  total_semesters: number;
  description: string;
  total_subjects: number;
  total_credits: number;
  year_breakdown: Record<string, {
    year: number;
    label: string;
    subject_count: number;
    total_credits: number;
  }>;
}

interface Subject {
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

interface SemesterData {
  semester: number;
  sem_label: string;
  term_type: string;
  subjects: Subject[];
  total_credits: number;
  total_sessions: number;
}

interface YearData {
  year: number;
  year_label: string;
  semesters: SemesterData[];
  total_subjects: number;
  total_credits: number;
}

interface CurriculumTree {
  program: ProgramSummary;
  years: YearData[];
  total_subjects: number;
  total_credits: number;
}

interface FacultyMember {
  faculty_id: string;
  name: string;
  department_id: string;
  designation: string;
}

interface CurriculumStudioProps {
  theme: 'dark' | 'light';
  onNavigateTimetable?: (programId?: string, groupId?: string, semester?: number, year?: number) => void;
  onRefreshData?: () => void;
}

export function CurriculumStudio({
  theme,
  onNavigateTimetable,
  onRefreshData,
}: CurriculumStudioProps) {
  const isDark = theme === 'dark';

  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('BTECH_CSE');
  const [curriculumTree, setCurriculumTree] = useState<CurriculumTree | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [showAddProgramModal, setShowAddProgramModal] = useState<boolean>(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState<boolean>(false);
  const [targetSemesterForAdd, setTargetSemesterForAdd] = useState<number>(1);

  // Add Program Form State
  const [newProgId, setNewProgId] = useState<string>('BTECH_MECH');
  const [newProgName, setNewProgName] = useState<string>('Bachelor of Technology in Mechanical Engineering');
  const [newProgShort, setNewProgShort] = useState<string>('B.Tech ME');
  const [newProgDept, setNewProgDept] = useState<string>('Mechanical Engineering');
  const [newProgDuration, setNewProgDuration] = useState<number>(4);
  const [newProgDesc, setNewProgDesc] = useState<string>('Engineering design, thermodynamics, fluid mechanics, and automation.');

  // Add Subject Form State
  const [newSubCode, setNewSubCode] = useState<string>('');
  const [newSubName, setNewSubName] = useState<string>('');
  const [newSubType, setNewSubType] = useState<string>('THEORY');
  const [newSubCredits, setNewSubCredits] = useState<number>(4);
  const [newSubSessions, setNewSubSessions] = useState<number>(3);
  const [newSubDuration, setNewSubDuration] = useState<number>(1);
  const [newSubRoomType, setNewSubRoomType] = useState<string>('LECTURE_HALL');
  const [newSubFaculty, setNewSubFaculty] = useState<string>('FAC_CS_01');
  const [newSubScheduleNow, setNewSubScheduleNow] = useState<boolean>(true);

  // Load programs & faculty
  useEffect(() => {
    async function fetchInitial() {
      try {
        setLoading(true);
        const [progRes, snapRes] = await Promise.all([
          fetch('/api/curriculum/programs').then(r => r.json()),
          fetch('/api/snapshot').then(r => r.json()),
        ]);
        setPrograms(progRes || []);
        if (snapRes && snapRes.faculty) {
          setFacultyList(snapRes.faculty);
        }
        if (progRes && progRes.length > 0 && !selectedProgramId) {
          setSelectedProgramId(progRes[0].program_id);
        }
      } catch (err) {
        console.error('Failed to load curriculum programs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitial();
  }, []);

  // Load selected program's curriculum tree
  const loadProgramTree = async (programId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/curriculum/programs/${programId}`);
      if (res.ok) {
        const data: CurriculumTree = await res.json();
        setCurriculumTree(data);
      }
    } catch (err) {
      console.error('Failed to load program tree:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProgramId) {
      loadProgramTree(selectedProgramId);
    }
  }, [selectedProgramId]);

  // Adjust selectedYear if exceeds duration
  useEffect(() => {
    if (curriculumTree && curriculumTree.program) {
      if (selectedYear > curriculumTree.program.duration_years) {
        setSelectedYear(1);
      }
    }
  }, [curriculumTree]);

  // Notification auto-dismiss
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle Add Academic Program
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/curriculum/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: newProgId.trim().toUpperCase(),
          name: newProgName.trim(),
          short_code: newProgShort.trim(),
          department: newProgDept.trim(),
          duration_years: newProgDuration,
          semesters_per_year: 2,
          description: newProgDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create program');

      setNotification({ message: `Created degree program "${newProgShort}" successfully!`, type: 'success' });
      setShowAddProgramModal(false);

      // Refresh programs list
      const updatedProgs = await fetch('/api/curriculum/programs').then(r => r.json());
      setPrograms(updatedProgs);
      setSelectedProgramId(newProgId.trim().toUpperCase());
      setSelectedYear(1);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error creating program', type: 'error' });
    }
  };

  // Handle Open Add Subject Modal for a specific semester
  const handleOpenAddSubjectModal = (semesterNum: number) => {
    setTargetSemesterForAdd(semesterNum);
    // Suggest code based on semester and program
    const prefix = selectedProgramId.startsWith('BTECH') ? 'CS' : selectedProgramId;
    setNewSubCode(`${prefix}-${semesterNum}0${Math.floor(Math.random() * 8) + 1}`);
    setNewSubName('');
    setNewSubType('THEORY');
    setNewSubCredits(4);
    setNewSubSessions(3);
    setNewSubDuration(1);
    setNewSubRoomType('LECTURE_HALL');
    setNewSubScheduleNow(true);
    setShowAddSubjectModal(true);
  };

  // Handle Submit Add Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCode || !newSubName) {
      setNotification({ message: 'Subject Code and Name are required.', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/curriculum/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_code: newSubCode.trim().toUpperCase(),
          subject_name: newSubName.trim(),
          program_id: selectedProgramId,
          year: selectedYear,
          semester: targetSemesterForAdd,
          subject_type: newSubType,
          credits: Number(newSubCredits),
          sessions_per_week: Number(newSubSessions),
          duration_slots: Number(newSubDuration),
          room_type_id: newSubRoomType,
          faculty_ids: [newSubFaculty],
          schedule_now: newSubScheduleNow,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to register subject');

      setNotification({
        message: `Registered ${newSubCode} in ${curriculumTree?.program.short_code} Year ${selectedYear} (Sem ${targetSemesterForAdd})!`,
        type: 'success',
      });
      setShowAddSubjectModal(false);

      // Refresh curriculum tree and parent data
      await loadProgramTree(selectedProgramId);
      const updatedProgs = await fetch('/api/curriculum/programs').then(r => r.json());
      setPrograms(updatedProgs);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error adding subject', type: 'error' });
    }
  };

  // Handle Delete Subject
  const handleDeleteSubject = async (subjectCode: string) => {
    if (!confirm(`Are you sure you want to remove ${subjectCode} from this semester's curriculum?`)) return;

    try {
      const res = await fetch(`/api/curriculum/subjects/${selectedProgramId}/${subjectCode}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete subject');

      setNotification({ message: `Subject ${subjectCode} removed.`, type: 'success' });
      await loadProgramTree(selectedProgramId);
      const updatedProgs = await fetch('/api/curriculum/programs').then(r => r.json());
      setPrograms(updatedProgs);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error removing subject', type: 'error' });
    }
  };

  // Find active year data
  const currentYearData = curriculumTree?.years.find(y => y.year === selectedYear);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-lg transition animate-in slide-in-from-top-2 ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-xs hover:underline cursor-pointer opacity-80">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP DEGREE COURSES / PROGRAM SELECTOR                                   */}
      {/* ========================================================================= */}
      <div className={`border rounded-2xl p-5 transition ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl border ${
                isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200'
              }`}>
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-lg font-extrabold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  Course & Subject Curriculum Studio
                </h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Manage degree programs, hierarchical year-wise structures (1st, 2nd, 3rd, 4th Year), and semester-wise subject mappings.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Syncing Curriculum...</span>
              </div>
            )}
            <button
              onClick={() => setShowAddProgramModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Degree Course / Academic Program</span>
            </button>
          </div>
        </div>

        {/* Horizontal Program Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {programs.map(prog => {
            const isSelected = selectedProgramId === prog.program_id;
            return (
              <button
                key={prog.program_id}
                onClick={() => setSelectedProgramId(prog.program_id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2.5 shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                    : isDark
                      ? 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 opacity-80" />
                <span className="font-semibold">{prog.short_code}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                }`}>
                  {prog.duration_years} Years • {prog.total_subjects} Subs
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SELECTED PROGRAM BANNER & STATS                                        */}
      {/* ========================================================================= */}
      {curriculumTree && (
        <div className={`border rounded-2xl p-5 relative overflow-hidden transition ${
          isDark 
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-500/20' 
            : 'bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/40 border-indigo-100 shadow-xs'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {curriculumTree.program.department}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  • {curriculumTree.program.duration_years} Academic Years • {curriculumTree.program.total_semesters} Total Semesters
                </span>
              </div>
              <h3 className={`text-xl font-black tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {curriculumTree.program.name}
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {curriculumTree.program.description || 'Comprehensive university degree curriculum curriculum structure with year-wise syllabus mapping.'}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl border text-center ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="text-xl font-black text-indigo-500">{curriculumTree.total_subjects}</div>
                <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Papers
                </div>
              </div>
              <div className={`p-3 rounded-xl border text-center ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="text-xl font-black text-emerald-500">{curriculumTree.total_credits}</div>
                <div className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Credits
                </div>
              </div>
              {onNavigateTimetable && (
                <button
                  onClick={() => onNavigateTimetable(selectedProgramId)}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
                  }`}
                  title="View Timetable Schedule for this Course"
                >
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>View Timetable &rarr;</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. YEAR-WISE TABS (1st Year, 2nd Year, 3rd Year, 4th Year)                 */}
      {/* ========================================================================= */}
      {curriculumTree && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-extrabold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Select Year:
              </span>
              <div className="flex items-center gap-1.5">
                {curriculumTree.years.map(y => {
                  const isSelected = selectedYear === y.year;
                  return (
                    <button
                      key={y.year}
                      onClick={() => setSelectedYear(y.year)}
                      className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                          : isDark
                            ? 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 opacity-80" />
                      <span>{y.year_label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isSelected ? 'bg-white/20 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {y.total_subjects} Subjects • {y.total_credits} Cr
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter subjects in this year..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1.5 text-xs rounded-xl border outline-none transition w-60 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 4. SEMESTERS FOR SELECTED YEAR                                        */}
          {/* ===================================================================== */}
          {currentYearData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {currentYearData.semesters.map(sem => {
                const filteredSubjects = sem.subjects.filter(s => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return s.subject_code.toLowerCase().includes(q) || s.subject_name.toLowerCase().includes(q);
                });

                return (
                  <div
                    key={sem.semester}
                    className={`border rounded-2xl p-5 flex flex-col justify-between transition ${
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Semester Header */}
                      <div className="flex items-center justify-between gap-3 border-b pb-3 mb-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h4 className={`text-base font-extrabold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {sem.sem_label}
                            </h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              sem.semester % 2 === 1
                                ? isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
                                : isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-200'
                            }`}>
                              {sem.term_type}
                            </span>
                          </div>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {sem.subjects.length} Subjects Registered • {sem.total_credits} Credits • {sem.total_sessions} Weekly Hours
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {onNavigateTimetable && (
                            <button
                              onClick={() => onNavigateTimetable(selectedProgramId, undefined, sem.semester, selectedYear)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                                isDark
                                  ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title={`View Timetable Schedule for ${sem.sem_label}`}
                            >
                              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                              <span>View Timetable &rarr;</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAddSubjectModal(sem.semester)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Subject</span>
                          </button>
                        </div>
                      </div>

                      {/* Subject Cards */}
                      {filteredSubjects.length === 0 ? (
                        <div className={`p-8 text-center rounded-xl border border-dashed ${
                          isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
                        }`}>
                          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs font-semibold">No subjects registered for {sem.sem_label} yet.</p>
                          <button
                            onClick={() => handleOpenAddSubjectModal(sem.semester)}
                            className="mt-3 text-xs text-indigo-500 hover:underline font-bold"
                          >
                            + Add first subject to {sem.sem_label}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredSubjects.map(sub => {
                            const isPractical = sub.subject_type === 'PRACTICAL';
                            const faculty = facultyList.find(f => sub.faculty_ids.includes(f.faculty_id));
                            return (
                              <div
                                key={sub.subject_code}
                                className={`p-3.5 rounded-xl border transition flex flex-col gap-2 ${
                                  isDark ? 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                                        {sub.subject_code}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        isPractical
                                          ? isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : isDark ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}>
                                        {isPractical ? 'Practical Lab' : 'Theory Lecture'}
                                      </span>
                                      <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        • {sub.credits} Credits • {sub.sessions_per_week} sess/wk ({sub.duration_slots} hr)
                                      </span>
                                    </div>
                                    <div className={`font-bold text-xs leading-snug ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                                      {sub.subject_name}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleDeleteSubject(sub.subject_code)}
                                    className={`p-1.5 rounded-lg transition hover:bg-rose-500/10 text-rose-500 opacity-60 hover:opacity-100 cursor-pointer`}
                                    title="Delete Subject"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className={`flex flex-wrap items-center justify-between text-[11px] pt-1.5 border-t ${
                                  isDark ? 'border-slate-900 text-slate-400' : 'border-slate-200 text-slate-500'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <Users className="w-3 h-3 opacity-70" />
                                    <span>Faculty: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>{faculty ? faculty.name : (sub.faculty_ids[0] || 'Unassigned')}</strong></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <DoorOpen className="w-3 h-3 opacity-70" />
                                    <span>Room: <strong className={isDark ? 'text-slate-300' : 'text-slate-700'}>{sub.room_type_id}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
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
      {/* MODAL 1: ADD DEGREE COURSE / ACADEMIC PROGRAM                              */}
      {/* ========================================================================= */}
      {showAddProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-500" />
                <h3 className="font-extrabold text-base">Add New Degree Course / Academic Program</h3>
              </div>
              <button
                onClick={() => setShowAddProgramModal(false)}
                className="text-xs hover:underline text-slate-400 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">Program Code / ID *</label>
                  <input
                    type="text"
                    required
                    value={newProgId}
                    onChange={e => setNewProgId(e.target.value.toUpperCase())}
                    placeholder="e.g. BTECH_MECH, MCA, BSC_DS"
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-mono ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold">Short Code / Badge *</label>
                  <input
                    type="text"
                    required
                    value={newProgShort}
                    onChange={e => setNewProgShort(e.target.value)}
                    placeholder="e.g. B.Tech ME, MCA, B.Sc DS"
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold">Full Degree Name *</label>
                <input
                  type="text"
                  required
                  value={newProgName}
                  onChange={e => setNewProgName(e.target.value)}
                  placeholder="e.g. Bachelor of Technology in Mechanical Engineering"
                  className={`w-full px-3 py-2 rounded-xl border outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">Academic Department *</label>
                  <input
                    type="text"
                    required
                    value={newProgDept}
                    onChange={e => setNewProgDept(e.target.value)}
                    placeholder="e.g. Mechanical Engineering"
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold">Duration (Years) *</label>
                  <select
                    value={newProgDuration}
                    onChange={e => setNewProgDuration(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value={1}>1 Year (2 Semesters)</option>
                    <option value={2}>2 Years (4 Semesters) [e.g. MBA / B.Ed / M.Tech]</option>
                    <option value={3}>3 Years (6 Semesters) [e.g. BCA / B.Sc / B.Com]</option>
                    <option value={4}>4 Years (8 Semesters) [e.g. B.Tech / BE / FYUP]</option>
                    <option value={5}>5 Years (10 Semesters) [e.g. Integrated M.Tech]</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold">Curriculum Description</label>
                <textarea
                  rows={2}
                  value={newProgDesc}
                  onChange={e => setNewProgDesc(e.target.value)}
                  placeholder="Overview of curriculum aims, specializations, and competencies..."
                  className={`w-full px-3 py-2 rounded-xl border outline-none resize-none ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddProgramModal(false)}
                  className={`px-4 py-2 rounded-xl font-bold cursor-pointer border ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-md cursor-pointer"
                >
                  Create Degree Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD SUBJECT TO SEMESTER                                           */}
      {/* ========================================================================= */}
      {showAddSubjectModal && curriculumTree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="font-extrabold text-base">Add Subject to {curriculumTree.program.short_code}</h3>
                  <p className="text-[11px] text-slate-400">
                    Mapped to: <strong>Year {selectedYear} • Semester {targetSemesterForAdd}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddSubjectModal(false)}
                className="text-xs hover:underline text-slate-400 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">Subject Code *</label>
                  <input
                    type="text"
                    required
                    value={newSubCode}
                    onChange={e => setNewSubCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CS-406"
                    className={`w-full px-3 py-2 rounded-xl border outline-none font-mono ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="font-bold">Subject Title *</label>
                  <input
                    type="text"
                    required
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    placeholder="e.g. Quantum Computing & Complexity"
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">Pedagogy Type *</label>
                  <select
                    value={newSubType}
                    onChange={e => {
                      const val = e.target.value;
                      setNewSubType(val);
                      if (val === 'PRACTICAL') {
                        setNewSubDuration(2);
                        setNewSubSessions(1);
                        setNewSubRoomType('COMPUTER_LAB');
                      } else {
                        setNewSubDuration(1);
                        setNewSubSessions(3);
                        setNewSubRoomType('LECTURE_HALL');
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="THEORY">Theory Lecture</option>
                    <option value="PRACTICAL">Practical / Lab</option>
                    <option value="TUTORIAL">Tutorial / Seminar</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold">Credits *</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newSubCredits}
                    onChange={e => setNewSubCredits(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold">Sessions / Week *</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newSubSessions}
                    onChange={e => setNewSubSessions(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold">Required Facility / Room Type *</label>
                  <select
                    value={newSubRoomType}
                    onChange={e => setNewSubRoomType(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="LECTURE_HALL">Smart Lecture Hall</option>
                    <option value="COMPUTER_LAB">Computer & AI Lab</option>
                    <option value="SCIENCE_LAB">Science Laboratory</option>
                    <option value="PEDAGOGY_ROOM">Pedagogy Room</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold">Primary Faculty Member *</label>
                  <select
                    value={newSubFaculty}
                    onChange={e => setNewSubFaculty(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {facultyList.map(f => (
                      <option key={f.faculty_id} value={f.faculty_id}>
                        {f.name} ({f.designation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <div className="font-bold">Instant Timetable Scheduling</div>
                  <div className="text-[11px] text-slate-400">
                    Immediately solve and allocate conflict-free slots on the master timetable.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={newSubScheduleNow}
                  onChange={e => setNewSubScheduleNow(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className={`px-4 py-2 rounded-xl font-bold cursor-pointer border ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-md cursor-pointer"
                >
                  Register Subject to Semester
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
