import { useState } from 'react';
import {
  X, Printer, Download, CheckSquare, Square,
  GraduationCap, Users, Building2, Search,
  Sparkles, FileText
} from 'lucide-react';

interface PrintPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  courses: any[];
  snapshot: any | null;
  activeEntityId?: string;
  viewType?: 'GROUP' | 'FACULTY' | 'ROOM';
}

export function PrintPdfModal({
  isOpen,
  onClose,
  theme,
  courses,
  snapshot,
  activeEntityId,
  viewType,
}: PrintPdfModalProps) {
  const isDark = theme === 'dark';

  // Active Category Tab: 'COHORTS' | 'FACULTY' | 'ROOMS'
  const [activeTab, setActiveTab] = useState<'COHORTS' | 'FACULTY' | 'ROOMS'>('COHORTS');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected IDs
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() => {
    if (activeEntityId && (viewType === 'GROUP' || !viewType)) {
      return [activeEntityId];
    }
    // Default to the 4 B.Tech registered courses
    if (courses && courses.length > 0) {
      return courses.map(c => c.course_id);
    }
    return ['BTECH_Y1', 'BTECH_Y2', 'BTECH_Y3', 'BTECH_Y4'];
  });

  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>(() => {
    if (activeEntityId && viewType === 'FACULTY') {
      return [activeEntityId];
    }
    return [];
  });

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() => {
    if (activeEntityId && viewType === 'ROOM') {
      return [activeEntityId];
    }
    return [];
  });

  if (!isOpen) return null;

  // Toggle helpers
  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleFaculty = (id: string) => {
    setSelectedFacultyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleRoom = (id: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Quick Presets
  const selectAllCohorts = () => {
    const allIds = courses.map(c => c.course_id);
    setSelectedGroupIds(allIds.length > 0 ? allIds : ['BTECH_Y1', 'BTECH_Y2', 'BTECH_Y3', 'BTECH_Y4']);
  };

  const selectAllFaculty = () => {
    if (snapshot?.faculty) {
      setSelectedFacultyIds(snapshot.faculty.map((f: any) => f.faculty_id));
    }
  };

  const selectMasterSet = () => {
    selectAllCohorts();
    selectAllFaculty();
  };

  const clearAll = () => {
    setSelectedGroupIds([]);
    setSelectedFacultyIds([]);
    setSelectedRoomIds([]);
  };

  // Filtered lists based on search
  const filteredCourses = (courses || []).filter(c =>
    c.course_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.course_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.department && c.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFaculty = (snapshot?.faculty || []).filter((f: any) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.faculty_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.department_id && f.department_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredRooms = (snapshot?.rooms || []).filter((r: any) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.room_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.room_type_id && r.room_type_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalSelectedCount = selectedGroupIds.length + selectedFacultyIds.length + selectedRoomIds.length;

  // Build Export URL
  const buildExportUrl = (download: boolean) => {
    const params = new URLSearchParams();
    if (selectedGroupIds.length > 0) {
      params.append('group_ids', selectedGroupIds.join(','));
    }
    if (selectedFacultyIds.length > 0) {
      params.append('faculty_ids', selectedFacultyIds.join(','));
    }
    if (selectedRoomIds.length > 0) {
      params.append('room_ids', selectedRoomIds.join(','));
    }
    if (download) {
      params.append('download', 'true');
    }
    const query = params.toString();
    return query ? `/api/export/pdf?${query}` : '/api/export/pdf';
  };

  const handleOpenPdf = () => {
    if (totalSelectedCount === 0) return;
    const url = buildExportUrl(false);
    window.open(url, '_blank');
  };

  const handleDownloadPdf = () => {
    if (totalSelectedCount === 0) return;
    const url = buildExportUrl(true);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'acadence_timetable_circular.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-indigo-950/40'
            : 'bg-white border-slate-200 text-slate-800 shadow-slate-300'
        }`}
      >
        {/* Header */}
        <div className={`p-6 border-b flex items-start justify-between gap-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/70'}`}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Print & Export Timetable Circular (PDF)</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                  Single Multi-Page PDF
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Choose any combination of classes, faculty, or rooms. All selections will be compiled into <b>one single PDF circular</b> with <b>each timetable on its own page</b>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200/60 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Preset Buttons & Search Bar */}
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-100 bg-slate-100/40'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Presets:
            </span>
            <button
              onClick={selectAllCohorts}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                isDark
                  ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300 hover:bg-indigo-900/60'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Select All 4 B.Tech Classes</span>
            </button>
            <button
              onClick={selectAllFaculty}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                isDark
                  ? 'bg-purple-950/40 border-purple-800/60 text-purple-300 hover:bg-purple-900/60'
                  : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Select All Faculty</span>
            </button>
            <button
              onClick={selectMasterSet}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                isDark
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Master University Set</span>
            </button>
            <button
              onClick={clearAll}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                isDark
                  ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Clear All
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600'
                  : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Tabs for Category Selection */}
        <div className={`flex border-b px-6 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <button
            onClick={() => setActiveTab('COHORTS')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition cursor-pointer ${
              activeTab === 'COHORTS'
                ? 'border-indigo-600 text-indigo-500'
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Classes & Cohorts</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              selectedGroupIds.length > 0 ? 'bg-indigo-500 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
            }`}>
              {selectedGroupIds.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('FACULTY')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition cursor-pointer ${
              activeTab === 'FACULTY'
                ? 'border-indigo-600 text-indigo-500'
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty Members</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              selectedFacultyIds.length > 0 ? 'bg-indigo-500 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
            }`}>
              {selectedFacultyIds.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ROOMS')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition cursor-pointer ${
              activeTab === 'ROOMS'
                ? 'border-indigo-600 text-indigo-500'
                : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Rooms & Laboratories</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              selectedRoomIds.length > 0 ? 'bg-indigo-500 text-white' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
            }`}>
              {selectedRoomIds.length}
            </span>
          </button>
        </div>

        {/* Tab Content Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeTab === 'COHORTS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCourses.map(crs => {
                const isSelected = selectedGroupIds.includes(crs.course_id);
                return (
                  <div
                    key={crs.course_id}
                    onClick={() => toggleGroup(crs.course_id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500'
                          : 'bg-indigo-50/80 border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500'
                        : isDark
                          ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-600 text-white" />
                      ) : (
                        <Square className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{crs.course_name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          Year {crs.year} • Sem {crs.semester}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {crs.department || 'Computer Science & Engineering'} • {crs.student_count || 60} Enrolled Students
                      </p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          crs.rooms_required > 1
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {crs.rooms_required > 1 ? `${crs.rooms_required} Rooms Auto-Allotted` : '1 Room Sufficient'}
                        </span>
                        {crs.section_ids && crs.section_ids.length > 0 && (
                          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Sections: {crs.section_ids.map((s: string) => s.replace('GRP_BTECH_', '').replace('SEC', 'Sec ')).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'FACULTY' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredFaculty.map((fac: any) => {
                const isSelected = selectedFacultyIds.includes(fac.faculty_id);
                return (
                  <div
                    key={fac.faculty_id}
                    onClick={() => toggleFaculty(fac.faculty_id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500'
                          : 'bg-indigo-50/80 border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500'
                        : isDark
                          ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-600 text-white" />
                      ) : (
                        <Square className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{fac.name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {fac.faculty_id}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {fac.designation || 'Professor'} • {fac.department_id || 'Academic Faculty'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-semibold text-indigo-400">
                          Max Load: {fac.max_hours_week || 16} hrs/week
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'ROOMS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredRooms.map((rm: any) => {
                const isSelected = selectedRoomIds.includes(rm.room_id);
                return (
                  <div
                    key={rm.room_id}
                    onClick={() => toggleRoom(rm.room_id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500'
                          : 'bg-indigo-50/80 border-indigo-500 shadow-md shadow-indigo-100 ring-1 ring-indigo-500'
                        : isDark
                          ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-600 text-white" />
                      ) : (
                        <Square className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{rm.name}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rm.capacity} Seats
                        </span>
                      </div>
                      <p className={`text-xs mt-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Type: {rm.room_type_id} • Status: Active Facility
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Live Count & Compilation Actions */}
        <div className={`p-5 border-t flex flex-wrap items-center justify-between gap-4 ${
          isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              {totalSelectedCount > 0 ? (
                <div>
                  <span className="text-xs font-bold text-indigo-400 block">
                    Combined Single PDF: {totalSelectedCount} {totalSelectedCount === 1 ? 'Page' : 'Pages'} Total
                  </span>
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Includes: {selectedGroupIds.length} Classes, {selectedFacultyIds.length} Faculty, {selectedRoomIds.length} Rooms (1 timetable per page)
                  </span>
                </div>
              ) : (
                <span className="text-xs font-semibold text-amber-500 block">
                  Please select at least one class, faculty, or room to export.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                isDark
                  ? 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white'
                  : 'border-slate-300 hover:bg-slate-200/50 text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancel
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={totalSelectedCount === 0}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download (.pdf)</span>
            </button>

            <button
              onClick={handleOpenPdf}
              disabled={totalSelectedCount === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Open & Print PDF Circular &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
