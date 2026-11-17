"""Curriculum Hierarchy and Degree Course - Subject Mapping Domain Models.
Supports full multi-year, multi-semester academic programs (e.g. B.Tech 4 Years, BCA 3 Years, MBA 2 Years)
and year-wise / semester-wise subject relationship mapping.
"""
from typing import List, Optional, Dict, Any, Set
from pydantic import BaseModel, Field
from acadence.domain.enums import NEPCategory, ProgramType
from acadence.domain.snapshot import (
    ConfigSnapshot,
    TimeGrid,
    TimeSlot,
    StudentGroup,
    Room,
    Faculty,
    SessionRequirement,
)


class AcademicProgram(BaseModel):
    """Academic Degree / Program Course definition (e.g. B.Tech, BCA, MBA)."""
    program_id: str
    name: str
    short_code: str
    department: str
    duration_years: int = 4
    semesters_per_year: int = 2
    total_semesters: int = 8
    description: str = ""


class CurriculumSubject(BaseModel):
    """Subject / Paper curriculum specification mapped to Course Program, Year, and Semester."""
    subject_code: str
    subject_name: str
    program_id: str
    year: int  # 1, 2, 3, 4, etc.
    semester: int  # 1, 2, 3, 4, ..., total_semesters
    subject_type: str = "THEORY"  # 'THEORY', 'PRACTICAL', 'TUTORIAL'
    credits: int = 4
    sessions_per_week: int = 3
    duration_slots: int = 1
    room_type_id: str = "LECTURE_HALL"
    faculty_ids: List[str] = Field(default_factory=list)
    cohort_name: Optional[str] = None


class CourseCohort(BaseModel):
    """Course Cohort entity (e.g. B.Tech 1st Year, B.Tech 2nd Year, etc.) with student strength and auto-room allocation."""
    course_id: str  # e.g. "BTECH_Y1"
    course_name: str  # e.g. "B.Tech 1st Year"
    program_id: str = "BTECH_CSE"
    year: int = 1
    semester: int = 1
    department: str = "Computer Science & Engineering"
    student_count: int = 120
    preferred_room_type: str = "LECTURE_HALL"
    rooms_required: int = 2
    allocated_room_ids: List[str] = Field(default_factory=list)
    allocated_room_names: List[str] = Field(default_factory=list)
    section_ids: List[str] = Field(default_factory=list)
    description: str = ""


def compute_rooms_for_student_count(student_count: int, room_type_id: str, rooms: List[Any]) -> Dict[str, Any]:
    """Calculates whether 1, 2, or more rooms are required based on student number and room capacity."""
    matching_rooms = [r for r in rooms if getattr(r, "room_type_id", "") == room_type_id]
    if not matching_rooms:
        matching_rooms = list(rooms)
    
    max_cap = max((getattr(r, "capacity", 60) for r in matching_rooms), default=60)
    import math
    rooms_needed = max(1, math.ceil(student_count / max_cap))
    
    allotted = matching_rooms[:rooms_needed]
    if len(allotted) < rooms_needed:
        extra = [r for r in rooms if r not in allotted][:rooms_needed - len(allotted)]
        allotted.extend(extra)
    
    per_section = math.ceil(student_count / rooms_needed)
    sections = []
    for i in range(rooms_needed):
        count = per_section if i < rooms_needed - 1 else (student_count - (per_section * (rooms_needed - 1)))
        rm = allotted[i] if i < len(allotted) else None
        sections.append({
            "section_name": f"Section {chr(65 + i)}",
            "students": count,
            "room_id": getattr(rm, "room_id", "OVERFLOW_ROOM") if rm else "OVERFLOW_ROOM",
            "room_name": getattr(rm, "name", "Overflow Hall") if rm else "Overflow Hall",
            "capacity": getattr(rm, "capacity", 60) if rm else 60,
        })
    
    return {
        "rooms_required": rooms_needed,
        "max_capacity_per_room": max_cap,
        "allocated_room_ids": [getattr(r, "room_id", "") for r in allotted],
        "allocated_room_names": [f"{getattr(r, 'name', 'Room')} ({getattr(r, 'capacity', 60)} seats)" for r in allotted],
        "sections": sections,
    }


def get_default_course_cohorts() -> List[CourseCohort]:
    """Default course cohorts with student enrollment numbers and allocated collision-free rooms."""
    return [
        CourseCohort(
            course_id="BTECH_Y1",
            course_name="B.Tech 1st Year",
            program_id="BTECH_CSE",
            year=1,
            semester=1,
            department="Computer Science & Engineering",
            student_count=140,
            preferred_room_type="LECTURE_HALL",
            rooms_required=2,
            allocated_room_ids=["SMART_LH_101", "SMART_LH_102"],
            allocated_room_names=["Smart Lecture Hall 101 (75 seats)", "Smart Lecture Hall 102 (75 seats)"],
            section_ids=["GRP_BTECH_Y1_SECA", "GRP_BTECH_Y1_SECB"],
            description="First year engineering cohort. 140 students auto-divided into 2 lecture halls (70 students each) to prevent capacity overflow.",
        ),
        CourseCohort(
            course_id="BTECH_Y2",
            course_name="B.Tech 2nd Year",
            program_id="BTECH_CSE",
            year=2,
            semester=3,
            department="Computer Science & Engineering",
            student_count=120,
            preferred_room_type="LECTURE_HALL",
            rooms_required=2,
            allocated_room_ids=["SMART_LH_103", "SMART_LH_104"],
            allocated_room_names=["Smart Lecture Hall 103 (75 seats)", "Smart Lecture Hall 104 (75 seats)"],
            section_ids=["GRP_BTECH_Y2_SECA", "GRP_BTECH_Y2_SECB"],
            description="Second year computing core cohort. 120 students allotted 2 dedicated non-overlapping rooms.",
        ),
        CourseCohort(
            course_id="BTECH_Y3",
            course_name="B.Tech 3rd Year",
            program_id="BTECH_CSE",
            year=3,
            semester=5,
            department="Computer Science & Engineering",
            student_count=70,
            preferred_room_type="LECTURE_HALL",
            rooms_required=1,
            allocated_room_ids=["SMART_LH_101"],
            allocated_room_names=["Smart Lecture Hall 101 (75 seats)"],
            section_ids=["GRP_BTECH_Y3_SECA"],
            description="Third year specialized systems cohort. 70 students fitted into 1 lecture hall (75 capacity).",
        ),
        CourseCohort(
            course_id="BTECH_Y4",
            course_name="B.Tech 4th Year",
            program_id="BTECH_CSE",
            year=4,
            semester=7,
            department="Computer Science & Engineering",
            student_count=65,
            preferred_room_type="LECTURE_HALL",
            rooms_required=1,
            allocated_room_ids=["SMART_LH_102"],
            allocated_room_names=["Smart Lecture Hall 102 (75 seats)"],
            section_ids=["GRP_BTECH_Y4_SECA"],
            description="Final year AI, Deep Learning, and Capstone projects. 65 students allocated to dedicated hall.",
        ),
    ]


def get_default_programs() -> List[AcademicProgram]:
    """Pre-seeded degree courses / academic programs matching active registered courses in Settings."""
    return [
        AcademicProgram(
            program_id="BTECH_CSE",
            name="Bachelor of Technology in Computer Science & Engineering",
            short_code="B.Tech CSE",
            department="Computer Science & Engineering",
            duration_years=4,
            semesters_per_year=2,
            total_semesters=8,
            description="Four-year professional engineering degree focusing on computing algorithms, software architecture, and artificial intelligence.",
        ),
    ]


PROGRAM_CATALOG_TEMPLATES = [
    AcademicProgram(
        program_id="BTECH_ECE",
        name="Bachelor of Technology in Electronics & Communication",
        short_code="B.Tech ECE",
        department="Electronics & Communication Engineering",
        duration_years=4,
        semesters_per_year=2,
        total_semesters=8,
        description="Four-year engineering degree covering embedded systems, VLSI design, wireless signal processing, and IoT.",
    ),
    AcademicProgram(
        program_id="BCA",
        name="Bachelor of Computer Applications",
        short_code="BCA",
        department="Computer Applications",
        duration_years=3,
        semesters_per_year=2,
        total_semesters=6,
        description="Three-year undergraduate program in software engineering, database management, and web architectures.",
    ),
    AcademicProgram(
        program_id="MBA",
        name="Master of Business Administration",
        short_code="MBA",
        department="School of Management Studies",
        duration_years=2,
        semesters_per_year=2,
        total_semesters=4,
        description="Two-year postgraduate management program specializing in corporate strategy, finance, and analytics.",
    ),
    AcademicProgram(
        program_id="BED",
        name="Bachelor of Education (Teacher Training)",
        short_code="B.Ed",
        department="Teacher Education & Pedagogy",
        duration_years=2,
        semesters_per_year=2,
        total_semesters=4,
        description="Two-year professional teaching degree focusing on developmental psychology, educational technology, and school internships.",
    ),
]


def get_default_curriculum_subjects() -> List[CurriculumSubject]:
    """Pre-seeded year-wise and semester-wise subject catalog."""
    subjects: List[CurriculumSubject] = []

    # =========================================================================
    # 1. B.TECH CSE (Years 1 to 4, Semesters 1 to 8)
    # =========================================================================
    # --- Year 1: Semester 1 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-101",
            subject_name="Programming Fundamentals & Problem Solving in C",
            program_id="BTECH_CSE",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-101P",
            subject_name="C Programming & Linux Toolchain Lab",
            program_id="BTECH_CSE",
            year=1,
            semester=1,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="MTH-101",
            subject_name="Engineering Mathematics I: Calculus & Linear Algebra",
            program_id="BTECH_CSE",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_MATH_01"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="PHY-101",
            subject_name="Engineering Physics: Quantum & Semiconductor Physics",
            program_id="BTECH_CSE",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_PHY_01"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
    ])

    # --- Year 1: Semester 2 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-102",
            subject_name="Object-Oriented Programming with C++",
            program_id="BTECH_CSE",
            year=1,
            semester=2,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-102P",
            subject_name="OOP & Software Paradigms Laboratory",
            program_id="BTECH_CSE",
            year=1,
            semester=2,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="MTH-102",
            subject_name="Engineering Mathematics II: Differential Equations & Transforms",
            program_id="BTECH_CSE",
            year=1,
            semester=2,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_MATH_01"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="EEE-101",
            subject_name="Basic Electrical & Electronics Engineering",
            program_id="BTECH_CSE",
            year=1,
            semester=2,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ENG_01"],
            cohort_name="B.Tech CSE Year 1 (Sec A)",
        ),
    ])

    # --- Year 2: Semester 3 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-201",
            subject_name="Data Structures & Algorithms",
            program_id="BTECH_CSE",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-201P",
            subject_name="Data Structures & Algorithms Lab",
            program_id="BTECH_CSE",
            year=2,
            semester=3,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-202",
            subject_name="Digital Logic & Computer Organization",
            program_id="BTECH_CSE",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-203",
            subject_name="Discrete Mathematical Structures & Graph Theory",
            program_id="BTECH_CSE",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_MATH_01"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
    ])

    # --- Year 2: Semester 4 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-204",
            subject_name="Database Management Systems (DBMS)",
            program_id="BTECH_CSE",
            year=2,
            semester=4,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-204P",
            subject_name="Relational Database & SQL Laboratory",
            program_id="BTECH_CSE",
            year=2,
            semester=4,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-205",
            subject_name="Operating Systems Architecture",
            program_id="BTECH_CSE",
            year=2,
            semester=4,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-206",
            subject_name="Formal Languages & Automata Theory",
            program_id="BTECH_CSE",
            year=2,
            semester=4,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 2 (Sec A)",
        ),
    ])

    # --- Year 3: Semester 5 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-301",
            subject_name="Computer Networks & Distributed Systems",
            program_id="BTECH_CSE",
            year=3,
            semester=5,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-301P",
            subject_name="Networking Simulation & Socket Lab",
            program_id="BTECH_CSE",
            year=3,
            semester=5,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-302",
            subject_name="Software Engineering & Agile Methodologies",
            program_id="BTECH_CSE",
            year=3,
            semester=5,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-303",
            subject_name="Web Technologies & Microservices",
            program_id="BTECH_CSE",
            year=3,
            semester=5,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
    ])

    # --- Year 3: Semester 6 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-304",
            subject_name="Compiler Design & Code Optimization",
            program_id="BTECH_CSE",
            year=3,
            semester=6,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-305",
            subject_name="Artificial Intelligence & Knowledge Systems",
            program_id="BTECH_CSE",
            year=3,
            semester=6,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-305P",
            subject_name="AI & Heuristic Search Studio",
            program_id="BTECH_CSE",
            year=3,
            semester=6,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-306",
            subject_name="Information Security & Applied Cryptography",
            program_id="BTECH_CSE",
            year=3,
            semester=6,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 3 (Sec A)",
        ),
    ])

    # --- Year 4: Semester 7 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-401",
            subject_name="Machine Learning & Deep Neural Networks",
            program_id="BTECH_CSE",
            year=4,
            semester=7,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 4 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-401P",
            subject_name="Deep Learning & GPU Acceleration Lab",
            program_id="BTECH_CSE",
            year=4,
            semester=7,
            subject_type="PRACTICAL",
            credits=2,
            sessions_per_week=1,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 4 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-402",
            subject_name="Cloud Native Architecture & DevOps",
            program_id="BTECH_CSE",
            year=4,
            semester=7,
            subject_type="THEORY",
            credits=3,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="B.Tech CSE Year 4 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-403",
            subject_name="Major Capstone Engineering Project - Phase I",
            program_id="BTECH_CSE",
            year=4,
            semester=7,
            subject_type="PRACTICAL",
            credits=4,
            sessions_per_week=2,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 4 (Sec A)",
        ),
    ])

    # --- Year 4: Semester 8 ---
    subjects.extend([
        CurriculumSubject(
            subject_code="CS-404",
            subject_name="Distributed Systems, Consensus & Blockchain",
            program_id="BTECH_CSE",
            year=4,
            semester=8,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="B.Tech CSE Year 4 (Sec A)",
        ),
        CurriculumSubject(
            subject_code="CS-405",
            subject_name="Major Capstone Engineering Project - Phase II & Viva",
            program_id="BTECH_CSE",
            year=4,
            semester=8,
            subject_type="PRACTICAL",
            credits=8,
            sessions_per_week=2,
            duration_slots=2,
            room_type_id="COMPUTER_LAB",
            faculty_ids=["FAC_CS_01", "FAC_CS_02"],
            cohort_name="B.Tech CSE Year 4 (Sec A)",
        ),
    ])

    return subjects


def get_template_curriculum_subjects() -> List[CurriculumSubject]:
    """Catalog of template subjects for newly added degree programs (ECE, BCA, MBA, B.Ed)."""
    subjects: List[CurriculumSubject] = []

    # =========================================================================
    # 2. B.TECH ECE (Sample Semesters)
    # =========================================================================
    subjects.extend([
        CurriculumSubject(
            subject_code="ECE-101",
            subject_name="Network Analysis & Synthesis",
            program_id="BTECH_ECE",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ENG_01"],
            cohort_name="B.Tech ECE Year 1",
        ),
        CurriculumSubject(
            subject_code="ECE-201",
            subject_name="Analog Electronic Circuits",
            program_id="BTECH_ECE",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ENG_01"],
            cohort_name="B.Tech ECE Year 2",
        ),
        CurriculumSubject(
            subject_code="ECE-301",
            subject_name="Digital Signal Processing (DSP)",
            program_id="BTECH_ECE",
            year=3,
            semester=5,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ENG_01"],
            cohort_name="B.Tech ECE Year 3",
        ),
        CurriculumSubject(
            subject_code="ECE-401",
            subject_name="VLSI Design & CMOS Technologies",
            program_id="BTECH_ECE",
            year=4,
            semester=7,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ENG_01"],
            cohort_name="B.Tech ECE Year 4",
        ),
    ])

    # =========================================================================
    # 3. BCA (Bachelor of Computer Applications - 3 Years / 6 Semesters)
    # =========================================================================
    subjects.extend([
        # Year 1
        CurriculumSubject(
            subject_code="BCA-101",
            subject_name="Computer Fundamentals & Digital Office Tools",
            program_id="BCA",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="BCA Year 1",
        ),
        CurriculumSubject(
            subject_code="BCA-102",
            subject_name="Programming Principles in C",
            program_id="BCA",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="BCA Year 1",
        ),
        # Year 2
        CurriculumSubject(
            subject_code="BCA-201",
            subject_name="Java Programming & OOP Concepts",
            program_id="BCA",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="BCA Year 2",
        ),
        CurriculumSubject(
            subject_code="BCA-202",
            subject_name="Relational Database Systems",
            program_id="BCA",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="BCA Year 2",
        ),
        # Year 3
        CurriculumSubject(
            subject_code="BCA-301",
            subject_name="Full-Stack Web Development & Modern Frameworks",
            program_id="BCA",
            year=3,
            semester=5,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_02"],
            cohort_name="BCA Year 3",
        ),
        CurriculumSubject(
            subject_code="BCA-302",
            subject_name="Mobile Application Engineering (Android / iOS)",
            program_id="BCA",
            year=3,
            semester=5,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="BCA Year 3",
        ),
    ])

    # =========================================================================
    # 4. MBA (Master of Business Administration - 2 Years / 4 Semesters)
    # =========================================================================
    subjects.extend([
        # Year 1
        CurriculumSubject(
            subject_code="MBA-101",
            subject_name="Organizational Behavior & Human Dynamics",
            program_id="MBA",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ECO_01"],
            cohort_name="MBA Year 1",
        ),
        CurriculumSubject(
            subject_code="MBA-102",
            subject_name="Managerial Economics & Market Analysis",
            program_id="MBA",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ECO_02"],
            cohort_name="MBA Year 1",
        ),
        # Year 2
        CurriculumSubject(
            subject_code="MBA-201",
            subject_name="Strategic Management & Business Policy",
            program_id="MBA",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_ECO_01"],
            cohort_name="MBA Year 2",
        ),
        CurriculumSubject(
            subject_code="MBA-202",
            subject_name="Business Analytics & Data-Driven Decision Making",
            program_id="MBA",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            faculty_ids=["FAC_CS_01"],
            cohort_name="MBA Year 2",
        ),
    ])

    # =========================================================================
    # 5. B.ED (Bachelor of Education - 2 Years / 4 Semesters)
    # =========================================================================
    subjects.extend([
        # Year 1
        CurriculumSubject(
            subject_code="BED-101",
            subject_name="Childhood & Educational Psychology",
            program_id="BED",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="PEDAGOGY_ROOM",
            faculty_ids=["FAC_EDU_01"],
            cohort_name="B.Ed Year 1",
        ),
        CurriculumSubject(
            subject_code="BED-102",
            subject_name="Contemporary Indian Education & Policies",
            program_id="BED",
            year=1,
            semester=1,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="PEDAGOGY_ROOM",
            faculty_ids=["FAC_EDU_02"],
            cohort_name="B.Ed Year 1",
        ),
        # Year 2
        CurriculumSubject(
            subject_code="BED-201",
            subject_name="Pedagogy of Science & Mathematics Teaching",
            program_id="BED",
            year=2,
            semester=3,
            subject_type="THEORY",
            credits=4,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="PEDAGOGY_ROOM",
            faculty_ids=["FAC_EDU_02"],
            cohort_name="B.Ed Year 2",
        ),
        CurriculumSubject(
            subject_code="BED-202",
            subject_name="School Teaching Practice & Internship",
            program_id="BED",
            year=2,
            semester=3,
            subject_type="PRACTICAL",
            credits=6,
            sessions_per_week=2,
            duration_slots=2,
            room_type_id="PEDAGOGY_ROOM",
            faculty_ids=["FAC_EDU_01", "FAC_EDU_03"],
            cohort_name="B.Ed Year 2",
        ),
    ])

    return subjects


def build_curriculum_institution_snapshot(
    programs: Optional[List[AcademicProgram]] = None,
    cohorts: Optional[List[CourseCohort]] = None,
    curriculum_subjects: Optional[List[CurriculumSubject]] = None,
) -> ConfigSnapshot:
    """Builds a complete, solvable institutional snapshot directly from registered course cohorts and curriculum subjects."""
    if programs is None:
        programs = get_default_programs()
    if cohorts is None:
        cohorts = get_default_course_cohorts()
    if curriculum_subjects is None:
        curriculum_subjects = get_default_curriculum_subjects()

    num_days = 5
    periods_per_day = 8
    slots: List[TimeSlot] = []
    for d in range(num_days):
        for p in range(periods_per_day):
            g_idx = d * periods_per_day + p
            is_break = (p == 3)
            slots.append(
                TimeSlot(
                    slot_id=f"SLOT_{d}_{p}",
                    day=d,
                    period=p,
                    global_index=g_idx,
                    is_teachable=True,
                    break_after=is_break,
                )
            )

    grid = TimeGrid(
        grid_id="GRID_NEP_2020",
        name="Master Time Grid",
        num_days=num_days,
        periods_per_day=periods_per_day,
        slots=slots,
    )

    rooms = [
        Room(room_id="SMART_LH_101", name="Smart Lecture Hall 101", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD", "AUDIO_VISUAL"}),
        Room(room_id="SMART_LH_102", name="Smart Lecture Hall 102", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD", "AUDIO_VISUAL"}),
        Room(room_id="SMART_LH_103", name="Smart Lecture Hall 103", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD"}),
        Room(room_id="SMART_LH_104", name="Smart Lecture Hall 104", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD"}),
        Room(room_id="COMP_LAB_1", name="Computer & AI Laboratory", room_type_id="COMPUTER_LAB", capacity=75, features={"COMPUTERS", "INTERNET"}),
        Room(room_id="COMP_LAB_2", name="Digital Skills & Analytics Lab", room_type_id="COMPUTER_LAB", capacity=75, features={"COMPUTERS", "INTERNET"}),
        Room(room_id="PEDAGOGY_LAB_1", name="Teacher Education Pedagogy Hall", room_type_id="PEDAGOGY_ROOM", capacity=60, features={"MICRO_TEACHING"}),
        Room(room_id="SCIENCE_LAB_1", name="Multidisciplinary Science Lab", room_type_id="SCIENCE_LAB", capacity=60, features={"LAB_EQUIPMENT"}),
    ]

    faculty = [
        Faculty(faculty_id="FAC_CS_01", name="Dr. Alan Turing", department_id="COMPUTER_SCIENCE", designation="Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_CS_02", name="Dr. Ada Lovelace", department_id="COMPUTER_SCIENCE", designation="Assistant Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_CS_03", name="Dr. Grace Hopper", department_id="COMPUTER_SCIENCE", designation="Associate Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_CS_04", name="Dr. Tim Berners-Lee", department_id="COMPUTER_SCIENCE", designation="Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_CS_05", name="Dr. Geoffrey Hinton", department_id="COMPUTER_SCIENCE", designation="Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_MATH_01", name="Dr. Srinivasa Ramanujan", department_id="MATHEMATICS", designation="Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_MATH_02", name="Dr. Katherine Johnson", department_id="MATHEMATICS", designation="Assistant Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_PHY_01", name="Dr. Salim Ali", department_id="PHYSICS", designation="Associate Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_ENG_01", name="Dr. Rabindranath Tagore", department_id="ENGINEERING", designation="Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_EDU_01", name="Prof. S. Radhakrishnan", department_id="EDUCATION", designation="Professor", max_hours_week=16),
        Faculty(faculty_id="FAC_ECO_01", name="Dr. Amartya Sen", department_id="ECONOMICS", designation="Professor", max_hours_week=16),
    ]

    # Distributed faculty assignment to keep individual loads well below 16 hours
    sub_faculty_map: Dict[str, List[str]] = {
        # Year 1 (Sem 1)
        "CS-101": ["FAC_CS_01"],
        "CS-101P": ["FAC_CS_02"],
        "MTH-101": ["FAC_MATH_01"],
        "PHY-101": ["FAC_PHY_01"],
        # Year 1 (Sem 2)
        "CS-102": ["FAC_CS_02"],
        "CS-102P": ["FAC_CS_01"],
        "MTH-102": ["FAC_MATH_01"],
        "EEE-101": ["FAC_ENG_01"],
        # Year 2 (Sem 3)
        "CS-201": ["FAC_CS_03"],
        "CS-201P": ["FAC_CS_02"],
        "CS-202": ["FAC_CS_01"],
        "CS-203": ["FAC_MATH_02"],
        # Year 3 (Sem 5)
        "CS-301": ["FAC_CS_04"],
        "CS-301P": ["FAC_CS_03"],
        "CS-302": ["FAC_CS_02"],
        "CS-303": ["FAC_CS_04"],
        # Year 4 (Sem 7)
        "CS-401": ["FAC_CS_05"],
        "CS-401P": ["FAC_CS_05"],
        "CS-402": ["FAC_CS_04"],
        "CS-403": ["FAC_CS_05"],
    }

    student_groups: List[StudentGroup] = []
    requirements: List[SessionRequirement] = []

    for cohort in cohorts:
        parent_gid = f"GRP_{cohort.course_id}"
        student_groups.append(
            StudentGroup(
                group_id=parent_gid,
                name=cohort.course_name,
                expected_strength=cohort.student_count,
                program_type=cohort.program_id,
                semester=cohort.semester,
            )
        )

        section_gids: List[str] = []
        for i in range(cohort.rooms_required):
            sec_letter = chr(65 + i)
            sec_gid = f"GRP_{cohort.course_id}_SEC{sec_letter}"
            section_gids.append(sec_gid)
            student_groups.append(
                StudentGroup(
                    group_id=sec_gid,
                    name=f"{cohort.course_name} (Section {sec_letter})",
                    parent_id=parent_gid,
                    expected_strength=cohort.student_count // cohort.rooms_required,
                    program_type=cohort.program_id,
                    semester=cohort.semester,
                )
            )

        # Match enrolled subjects for this cohort's year and semester
        cohort_subs = [
            s for s in curriculum_subjects
            if s.program_id == cohort.program_id and s.year == cohort.year and s.semester == cohort.semester
        ]
        if not cohort_subs:
            cohort_subs = [
                s for s in curriculum_subjects
                if s.program_id == cohort.program_id and s.year == cohort.year
            ][:4]

        for sub in cohort_subs:
            fac_ids = sub_faculty_map.get(sub.subject_code)
            if not fac_ids:
                fac_ids = [fid for fid in sub.faculty_ids if any(f.faculty_id == fid for f in faculty)]
            if not fac_ids:
                fac_ids = ["FAC_CS_01"] if sub.room_type_id == "LECTURE_HALL" else ["FAC_CS_02"]

            for i, sec_gid in enumerate(section_gids):
                sec_letter = chr(65 + i)
                req_id = f"REQ_{sub.subject_code.replace('-', '_')}_{cohort.course_id}_{sec_letter}"
                requirements.append(
                    SessionRequirement(
                        requirement_id=req_id,
                        course_id=sub.subject_code,
                        course_name=f"{sub.subject_name} ({sec_letter})" if len(section_gids) > 1 else sub.subject_name,
                        offering_id=f"OFF_{req_id}",
                        group_ids=[sec_gid],
                        session_type="PRACTICAL" if sub.subject_type == "PRACTICAL" else "LECTURE",
                        nep_category=NEPCategory.MAJOR if sub.subject_type == "THEORY" else NEPCategory.SEC,
                        credits=sub.credits,
                        sessions_per_week=sub.sessions_per_week,
                        duration_slots=sub.duration_slots,
                        room_type_id=sub.room_type_id,
                        eligible_faculty_ids=fac_ids,
                    )
                )

    return ConfigSnapshot(
        snapshot_id="SNAP_CURRICULUM_LIVE",
        institution_id="INST_NEP2020_001",
        term_id="FALL_2026",
        version="2.0",
        time_grid=grid,
        student_groups=student_groups,
        rooms=rooms,
        faculty=faculty,
        requirements=requirements,
    )

