-- ============================================================================
-- ACADENCE MASTER SUPABASE SCHEMA MIGRATION
-- Project: Autonomous Conflict-Free Academic Timetable Engine
-- Compatible with PostgreSQL 15+ / Supabase PostgREST v12+
-- ============================================================================

-- 1. Academic Programs Catalog (Degrees)
CREATE TABLE IF NOT EXISTS public.academic_programs (
    program_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_code TEXT NOT NULL,
    department TEXT NOT NULL,
    duration_years INTEGER NOT NULL DEFAULT 4,
    semesters_per_year INTEGER NOT NULL DEFAULT 2,
    total_semesters INTEGER NOT NULL DEFAULT 8,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Physical Rooms & Laboratories
CREATE TABLE IF NOT EXISTS public.campus_rooms (
    room_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    room_type_id TEXT NOT NULL DEFAULT 'LECTURE_HALL', -- 'LECTURE_HALL', 'COMPUTER_LAB', 'SEMINAR_HALL'
    capacity INTEGER NOT NULL DEFAULT 60,
    features TEXT[] DEFAULT ARRAY['SMART_BOARD', 'AUDIO_VISUAL']::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Faculty Members Roster
CREATE TABLE IF NOT EXISTS public.faculty_members (
    faculty_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department_id TEXT NOT NULL,
    designation TEXT NOT NULL DEFAULT 'Assistant Professor',
    max_hours_week INTEGER NOT NULL DEFAULT 16,
    max_hours_day INTEGER NOT NULL DEFAULT 4,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Course Cohorts (Year-wise Student Batches)
CREATE TABLE IF NOT EXISTS public.course_cohorts (
    course_id TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    program_id TEXT REFERENCES public.academic_programs(program_id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    department TEXT NOT NULL,
    student_count INTEGER NOT NULL,
    preferred_room_type TEXT NOT NULL DEFAULT 'LECTURE_HALL',
    rooms_required INTEGER NOT NULL DEFAULT 1,
    allocated_room_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    allocated_room_names TEXT[] DEFAULT ARRAY[]::TEXT[],
    section_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Student Groups & Sections (Hierarchical)
CREATE TABLE IF NOT EXISTS public.student_groups (
    group_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    program_type TEXT NOT NULL,
    expected_strength INTEGER NOT NULL,
    parent_id TEXT REFERENCES public.student_groups(group_id) ON DELETE SET NULL,
    course_id TEXT REFERENCES public.course_cohorts(course_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Curriculum Subjects (Year-wise and Semester-wise Papers)
CREATE TABLE IF NOT EXISTS public.curriculum_subjects (
    subject_code TEXT PRIMARY KEY,
    subject_name TEXT NOT NULL,
    program_id TEXT REFERENCES public.academic_programs(program_id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    subject_type TEXT NOT NULL DEFAULT 'THEORY', -- 'THEORY', 'LAB', 'PRACTICAL', 'SEMINAR'
    credits INTEGER NOT NULL DEFAULT 4,
    weekly_sessions INTEGER NOT NULL DEFAULT 3,
    duration_slots INTEGER NOT NULL DEFAULT 1,
    nep_category TEXT NOT NULL DEFAULT 'MAJOR', -- 'MAJOR', 'MINOR', 'SEC', 'AEC', 'VAC'
    eligible_faculty_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_room_type TEXT NOT NULL DEFAULT 'LECTURE_HALL',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Timetable Placements (Solved Clash-Free Sessions)
CREATE TABLE IF NOT EXISTS public.timetable_placements (
    instance_id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    start_slot INTEGER NOT NULL,
    duration_slots INTEGER NOT NULL DEFAULT 1,
    day_index INTEGER NOT NULL, -- 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
    period_index INTEGER NOT NULL, -- 0=P1, 1=P2, 2=P3, 3=P4, etc.
    assigned_room_id TEXT REFERENCES public.campus_rooms(room_id) ON DELETE SET NULL,
    assigned_faculty_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    group_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Institutional Settings
CREATE TABLE IF NOT EXISTS public.institution_settings (
    id TEXT PRIMARY KEY DEFAULT 'INST_CONFIG',
    institution_name TEXT NOT NULL DEFAULT 'Metropolitan University',
    academic_session TEXT NOT NULL DEFAULT 'Autumn Semester 2026-27',
    nep_framework TEXT NOT NULL DEFAULT 'Semester & Credit-Based Curriculum',
    working_days_per_week INTEGER NOT NULL DEFAULT 5,
    periods_per_day INTEGER NOT NULL DEFAULT 7,
    teaching_practice_weeks INTEGER NOT NULL DEFAULT 4,
    auto_validate BOOLEAN NOT NULL DEFAULT TRUE,
    audit_logging BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enables direct synchronization using Publishable Key / Anon Key
-- ============================================================================

ALTER TABLE public.academic_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted read & write for synchronized academic operations
DROP POLICY IF EXISTS "Public access on academic_programs" ON public.academic_programs;
CREATE POLICY "Public access on academic_programs" ON public.academic_programs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on campus_rooms" ON public.campus_rooms;
CREATE POLICY "Public access on campus_rooms" ON public.campus_rooms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on faculty_members" ON public.faculty_members;
CREATE POLICY "Public access on faculty_members" ON public.faculty_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on course_cohorts" ON public.course_cohorts;
CREATE POLICY "Public access on course_cohorts" ON public.course_cohorts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on student_groups" ON public.student_groups;
CREATE POLICY "Public access on student_groups" ON public.student_groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on curriculum_subjects" ON public.curriculum_subjects;
CREATE POLICY "Public access on curriculum_subjects" ON public.curriculum_subjects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on timetable_placements" ON public.timetable_placements;
CREATE POLICY "Public access on timetable_placements" ON public.timetable_placements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on institution_settings" ON public.institution_settings;
CREATE POLICY "Public access on institution_settings" ON public.institution_settings FOR ALL USING (true) WITH CHECK (true);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_curriculum_program_year ON public.curriculum_subjects(program_id, year, semester);
CREATE INDEX IF NOT EXISTS idx_placements_start_slot ON public.timetable_placements(start_slot);
CREATE INDEX IF NOT EXISTS idx_placements_room ON public.timetable_placements(assigned_room_id);
