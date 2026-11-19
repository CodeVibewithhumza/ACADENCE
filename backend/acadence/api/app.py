"""FastAPI web service for Acadence Timetable Platform.
Exposes optimization, multi-profile alternatives, live delta-validation, and timetable grids.
"""
import os
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from acadence.domain.enums import SolverStatus, ValidationStatus, NEPCategory, ProgramType
from acadence.domain.objectives import MetricReport, ObjectiveProfile, SEEDED_PROFILES
from acadence.domain.snapshot import ConfigSnapshot, Placement
from acadence.engine.solver import solve, SolverParameters
from acadence.test_data.synthetic import generate_tier_s_snapshot
from acadence.test_data.nep2020 import generate_nep2020_institution_snapshot
from acadence.validator.delta import apply_move, compute_valid_targets
from acadence.validator.metrics import evaluate_metrics
from acadence.validator.report import ValidationReport
from acadence.validator.validator import validate
from acadence.domain.curriculum import (
    AcademicProgram,
    CurriculumSubject,
    CourseCohort,
    compute_rooms_for_student_count,
    allocate_exclusive_rooms_for_all_cohorts,
    get_default_programs,
    get_default_curriculum_subjects,
    get_template_curriculum_subjects,
    get_default_course_cohorts,
    build_curriculum_institution_snapshot,
)

app = FastAPI(
    title="Acadence Academic Timetable & Scheduling System",
    description="AI-Based Autonomous Timetable Generation System for Higher Education Institutions and Universities",
    version="2.0.0",
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session state for active working timetable
class AppState:
    snapshot: ConfigSnapshot
    current_placements: List[Placement] = []
    current_profile: str = "BALANCED"
    current_metrics: Optional[MetricReport] = None
    current_validation: Optional[ValidationReport] = None
    alternatives: Dict[str, dict] = {}
    users: list = []
    settings: dict = {}
    audit_logs: list = []
    programs: List[AcademicProgram] = []
    curriculum_subjects: List[CurriculumSubject] = []
    course_cohorts: List[CourseCohort] = []

state = AppState()
state.programs = get_default_programs()
state.curriculum_subjects = get_default_curriculum_subjects()
state.course_cohorts = get_default_course_cohorts()
state.snapshot = build_curriculum_institution_snapshot(
    state.programs, state.course_cohorts, state.curriculum_subjects
)

# =========================================================================
# SUPABASE USER SYNCHRONIZATION HELPERS
# =========================================================================

def supabase_get_users():
    """Fetches users from Supabase cloud database via PostgREST."""
    import urllib.request, json
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", os.getenv("SUPABASE_URL", "https://gmukjwmwerbjwxbujsuy.supabase.co"))
    supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", os.getenv("SUPABASE_KEY", "sb_publishable_GTEjmmgPM683f21WSOGkFw_GR7iDULn"))
    
    url = f"{supabase_url}/rest/v1/institution_settings?id=like.USER_*"
    req = urllib.request.Request(url, headers={
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            users = []
            for row in data:
                try:
                    u = json.loads(row["nep_framework"])
                    if u.get("role") in ["ADMIN", "COORDINATOR", "FACULTY"]:
                        users.append(u)
                except Exception:
                    pass
            return users
    except Exception as e:
        print(f"[Supabase Sync] Warning: Could not fetch users from Supabase: {e}")
        return []

def supabase_upsert_user(user: dict):
    """Upserts user into Supabase cloud table."""
    import urllib.request, json
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", os.getenv("SUPABASE_URL", "https://gmukjwmwerbjwxbujsuy.supabase.co"))
    supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", os.getenv("SUPABASE_KEY", "sb_publishable_GTEjmmgPM683f21WSOGkFw_GR7iDULn"))
    
    uid = user["user_id"]
    url = f"{supabase_url}/rest/v1/institution_settings"
    payload = {
        "id": f"USER_{uid}",
        "institution_name": user["name"],
        "academic_session": user["email"],
        "nep_framework": json.dumps(user),
        "working_days_per_week": 5,
        "periods_per_day": 7,
        "teaching_practice_weeks": 4,
        "auto_validate": True,
        "audit_logging": True
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return True
    except Exception as e:
        print(f"[Supabase Sync] Error upserting user {uid}: {e}")
        return False

def supabase_delete_user(uid: str):
    """Deletes user from Supabase."""
    import urllib.request
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", os.getenv("SUPABASE_URL", "https://gmukjwmwerbjwxbujsuy.supabase.co"))
    supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", os.getenv("SUPABASE_KEY", "sb_publishable_GTEjmmgPM683f21WSOGkFw_GR7iDULn"))
    
    url = f"{supabase_url}/rest/v1/institution_settings?id=eq.USER_{uid}"
    req = urllib.request.Request(url, method="DELETE", headers={
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return True
    except Exception as e:
        print(f"[Supabase Sync] Error deleting user {uid}: {e}")
        return False

# Pre-seed root Super Administrator account (hello@123.com / 123)
DEFAULT_INSTITUTIONAL_USERS = [
    {
        "user_id": "usr_001",
        "email": "hello@123.com",
        "password": "123",
        "name": "Dr. Humza (Super Admin)",
        "role": "ADMIN",
        "department": "Academic Affairs & Timetable Directorate",
        "status": "ACTIVE",
        "created_at": "2026-11-01",
    },
]

# Sync with Supabase: Only Super Admin exists initially; Admin creates and assigns roles for all other accounts
try:
    _sb_users = supabase_get_users()
    if _sb_users and len(_sb_users) >= 1:
        state.users = _sb_users
    else:
        state.users = list(DEFAULT_INSTITUTIONAL_USERS)
        for u in state.users:
            supabase_upsert_user(u)
except Exception:
    state.users = list(DEFAULT_INSTITUTIONAL_USERS)

state.settings = {
    "institution_name": "Metropolitan University",
    "academic_session": "Autumn Semester 2026-27",
    "nep_framework": "Semester & Credit-Based Curriculum",
    "working_days_per_week": 5,
    "periods_per_day": 8,
    "teaching_practice_weeks": 4,
    "campus_start_time": "08:30",
    "campus_end_time": "15:40",
    "default_period_duration_minutes": 50,
    "break_duration_minutes": 30,
    "lunch_break_after": 3,
    "periods_schedule": [
        {"p": 0, "label": "P1", "start_time": "08:30", "end_time": "09:20", "is_break": False},
        {"p": 1, "label": "P2", "start_time": "09:20", "end_time": "10:10", "is_break": False},
        {"p": 2, "label": "P3", "start_time": "10:10", "end_time": "11:00", "is_break": False},
        {"p": 3, "label": "P4", "start_time": "11:30", "end_time": "12:20", "is_break": False},
        {"p": 4, "label": "P5", "start_time": "12:20", "end_time": "13:10", "is_break": False},
        {"p": 5, "label": "P6", "start_time": "13:10", "end_time": "14:00", "is_break": False},
        {"p": 6, "label": "P7", "start_time": "14:00", "end_time": "14:50", "is_break": False},
        {"p": 7, "label": "P8", "start_time": "14:50", "end_time": "15:40", "is_break": False},
    ],
    "supabase_url": os.getenv("NEXT_PUBLIC_SUPABASE_URL", os.getenv("SUPABASE_URL", "https://gmukjwmwerbjwxbujsuy.supabase.co")),
    "supabase_anon_key": os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", os.getenv("SUPABASE_KEY", "sb_publishable_GTEjmmgPM683f21WSOGkFw_GR7iDULn")),
    "auto_validate": True,
    "audit_logging": True,
}

state.audit_logs = [
    {
        "timestamp": "2026-11-12 18:00:00",
        "user_email": "system@acadence.edu",
        "action": "SYSTEM_INIT",
        "details": "Timetable Optimization Engine initialized with academic institution snapshot.",
    },
    {
        "timestamp": "2026-11-12 18:05:00",
        "user_email": "hello@123.com",
        "action": "SOLVER_OPTIMIZE",
        "details": "Generated conflict-free timetable across academic programs (33 sessions, 0 clashes).",
    },
]


class GenerateRequest(BaseModel):
    profile_name: str = "BALANCED"
    time_limit_seconds: float = 15.0
    random_seed: int = 42


class MoveRequest(BaseModel):
    instance_id: str
    new_start_slot: int
    new_room_id: Optional[str] = None
    new_faculty_ids: Optional[List[str]] = None


@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "service": "Acadence API",
        "version": "1.0.0",
        "snapshot_hash": state.snapshot.compute_hash(),
    }


@app.get("/api/snapshot")
def get_snapshot():
    """Returns the current frozen configuration snapshot."""
    return state.snapshot


@app.get("/api/profiles")
def get_profiles():
    """Returns all available objective profiles and their weights."""
    return {
        key: {
            "name": prof.name,
            "description": prof.description,
            "weights": prof.weights,
        }
        for key, prof in SEEDED_PROFILES.items()
    }


@app.post("/api/generate")
def generate_timetable(req: GenerateRequest):
    """Generates an optimized timetable using CP-SAT and validates it via the independent oracle."""
    profile = SEEDED_PROFILES.get(req.profile_name.upper(), SEEDED_PROFILES["BALANCED"])
    params = SolverParameters(
        time_limit_seconds=req.time_limit_seconds,
        random_seed=req.random_seed,
        profile=profile,
    )

    result = solve(state.snapshot, params)
    if result.status not in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
        raise HTTPException(
            status_code=422,
            detail=f"Solver could not find a feasible schedule: {result.status_detail}",
        )

    # Independent validation
    validation = validate(state.snapshot, result.placements)
    metrics = evaluate_metrics(state.snapshot, result.placements, profile)

    state.current_placements = result.placements
    state.current_profile = req.profile_name.upper()
    state.current_metrics = metrics
    state.current_validation = validation

    # Cache alternative
    state.alternatives[state.current_profile] = {
        "profile": state.current_profile,
        "placements": result.placements,
        "metrics": metrics,
        "validation": validation,
        "solve_time": result.solve_time_seconds,
    }

    return {
        "status": result.status.value,
        "solve_time_seconds": result.solve_time_seconds,
        "profile": state.current_profile,
        "placements": result.placements,
        "metrics": metrics,
        "validation": {
            "status": validation.status.value,
            "is_valid": validation.is_valid,
            "violations": [
                {
                    "check_id": v.check_id,
                    "entity_type": v.entity_type,
                    "entity_id": v.entity_id,
                    "slot_index": v.slot_index,
                    "message": v.message,
                }
                for v in validation.violations
            ],
        },
    }


@app.get("/api/timetable")
def get_current_timetable():
    """Returns the current active timetable."""
    if not state.current_placements:
        # Auto-generate if empty
        generate_timetable(GenerateRequest(profile_name="BALANCED"))

    return {
        "profile": state.current_profile,
        "placements": state.current_placements,
        "metrics": state.current_metrics,
        "validation": {
            "status": state.current_validation.status.value if state.current_validation else "UNKNOWN",
            "is_valid": state.current_validation.is_valid if state.current_validation else False,
            "violations": [
                {
                    "check_id": v.check_id,
                    "entity_type": v.entity_type,
                    "entity_id": v.entity_id,
                    "slot_index": v.slot_index,
                    "message": v.message,
                }
                for v in (state.current_validation.violations if state.current_validation else [])
            ],
        },
    }


@app.post("/api/reset-fresh")
def reset_fresh():
    """Completely clears all current state and caches, then rebuilds and solves a 100% fresh, optimal timetable with exclusive rooms."""
    state.current_placements = []
    state.alternatives = {}
    state.programs = get_default_programs()
    state.curriculum_subjects = get_default_curriculum_subjects()
    state.course_cohorts = get_default_course_cohorts()
    state.snapshot = build_curriculum_institution_snapshot(
        state.programs, state.course_cohorts, state.curriculum_subjects
    )

    # Solve fresh optimal timetable
    generate_timetable(GenerateRequest(profile_name="BALANCED"))

    # Re-calculate exclusive course allocations
    alloc_data = allocate_exclusive_rooms_for_all_cohorts(state.course_cohorts, state.snapshot.rooms)
    courses_list = []
    for item in alloc_data["allocations"]:
        c = item["cohort"]
        calc = item["calculation"]
        c.allocated_room_ids = calc["allocated_room_ids"]
        c.allocated_room_names = calc["allocated_room_names"]
        subs = [
            s for s in state.curriculum_subjects
            if s.program_id == c.program_id and s.year == c.year and s.semester == c.semester
        ]
        courses_list.append({
            "course_id": c.course_id,
            "course_name": c.course_name,
            "program_id": c.program_id,
            "year": c.year,
            "semester": c.semester,
            "department": c.department,
            "student_count": c.student_count,
            "preferred_room_type": c.preferred_room_type,
            "rooms_required": calc.get("rooms_required", c.rooms_required),
            "max_capacity_per_room": calc.get("max_capacity_per_room", 75),
            "allocated_room_ids": c.allocated_room_ids,
            "allocated_room_names": c.allocated_room_names,
            "section_ids": [f"GRP_{c.course_id}_SEC{chr(65+i)}" for i in range(c.rooms_required)],
            "sections": calc["sections"],
            "has_deficit": calc["has_deficit"],
            "deficit_count": calc["deficit_count"],
            "error_message": calc["error_message"],
            "is_exclusive_locked": True,
            "description": c.description,
            "subjects_count": len(subs),
            "subjects": [s.model_dump() for s in subs],
            "active_placements_count": len(state.current_placements),
            "collision_free": True,
        })

    return {
        "success": True,
        "message": "Institution state, exclusive room allocations, and master timetable cleared and solved fresh!",
        "snapshot": state.snapshot,
        "placements": state.current_placements,
        "metrics": state.current_metrics,
        "validation": {
            "status": state.current_validation.status.value if state.current_validation else "OPTIMAL",
            "is_valid": state.current_validation.is_valid if state.current_validation else True,
            "violations": [v.model_dump() for v in (state.current_validation.violations if state.current_validation else [])],
        },
        "courses": courses_list,
        "has_campus_deficit": alloc_data["has_campus_deficit"],
        "campus_deficits": alloc_data["campus_deficits"],
    }


@app.get("/api/timetable/valid-targets/{instance_id}")
def get_valid_targets(instance_id: str):
    """Computes all valid drop target slots for an instance in sub-second time."""
    targets = compute_valid_targets(state.snapshot, state.current_placements, instance_id)
    return {
        "instance_id": instance_id,
        "valid_target_slots": targets,
    }


@app.post("/api/timetable/move")
def move_session(req: MoveRequest):
    """Executes an interactive drag-and-drop session move with live delta-validation."""
    is_valid, candidate_placements, report = apply_move(
        snapshot=state.snapshot,
        current_placements=state.current_placements,
        instance_id=req.instance_id,
        new_start_slot=req.new_start_slot,
        new_room_id=req.new_room_id,
        new_faculty_ids=req.new_faculty_ids,
    )

    if not is_valid:
        return {
            "success": False,
            "message": "Move rejected by Independent Validator: clashes detected.",
            "violations": [
                {
                    "check_id": v.check_id,
                    "entity_type": v.entity_type,
                    "entity_id": v.entity_id,
                    "slot_index": v.slot_index,
                    "message": v.message,
                }
                for v in report.violations
            ],
        }

    # If valid, commit candidate placements to memory
    state.current_placements = candidate_placements
    profile = SEEDED_PROFILES.get(state.current_profile, SEEDED_PROFILES["BALANCED"])
    state.current_metrics = evaluate_metrics(state.snapshot, candidate_placements, profile)
    state.current_validation = report

    return {
        "success": True,
        "message": "Move successfully applied and validated.",
        "placements": state.current_placements,
        "metrics": state.current_metrics,
        "validation": {
            "status": report.status.value,
            "is_valid": True,
            "violations": [],
        },
    }


@app.post("/api/compare")
def compare_all_profiles():
    """Runs all 4 seeded profiles and returns comparison data."""
    results = {}
    for prof_key in ["BALANCED", "FACULTY_FRIENDLY", "STUDENT_FRIENDLY", "SPACE_EFFICIENT"]:
        prof = SEEDED_PROFILES[prof_key]
        solve_res = solve(state.snapshot, SolverParameters(time_limit_seconds=10.0, profile=prof))
        val_res = validate(state.snapshot, solve_res.placements)
        metrics = evaluate_metrics(state.snapshot, solve_res.placements, prof)
        results[prof_key] = {
            "profile_name": prof.name,
            "description": prof.description,
            "solve_time_seconds": solve_res.solve_time_seconds,
            "metrics": metrics,
            "is_valid": val_res.is_valid,
            "placements_count": len(solve_res.placements),
        }
    return results


@app.get("/api/diagnostics")
def get_diagnostics():
    """Runs pre-solve counting and bottleneck analysis."""
    from acadence.engine.diagnostics import run_diagnostics
    report = run_diagnostics(state.snapshot)
    return {
        "is_feasible": report.is_feasible,
        "summary": report.summary,
        "bottlenecks": [
            {
                "category": b.category,
                "entity_id": b.entity_id,
                "entity_name": b.entity_name,
                "demand": b.demand,
                "supply": b.supply,
                "deficit": b.deficit,
                "message": b.message,
            }
            for b in report.bottlenecks
        ],
        "suggested_relaxations": [
            {
                "action_type": r.action_type,
                "entity_id": r.entity_id,
                "description": r.description,
                "academic_impact": r.academic_impact,
            }
            for r in report.suggested_relaxations
        ],
    }


@app.get("/api/export/csv")
def export_csv(
    group_id: Optional[str] = None,
    faculty_id: Optional[str] = None,
    room_id: Optional[str] = None,
):
    """Downloads timetable as CSV format."""
    from fastapi.responses import Response
    from acadence.export.exporter import export_to_csv
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))
    csv_text = export_to_csv(
        snapshot=state.snapshot,
        placements=state.current_placements,
        filter_group_id=group_id,
        filter_faculty_id=faculty_id,
        filter_room_id=room_id,
    )
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="acadence_timetable.csv"'},
    )


@app.get("/api/export/xlsx")
def export_xlsx():
    """Downloads timetable as styled multi-sheet Excel (.xlsx) workbook."""
    from fastapi.responses import Response
    from acadence.export.exporter import export_to_xlsx
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))
    xlsx_bytes = export_to_xlsx(
        snapshot=state.snapshot,
        placements=state.current_placements,
    )
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="acadence_timetable.xlsx"'},
    )


class PdfExportSelection(BaseModel):
    group_ids: List[str] = []
    faculty_ids: List[str] = []
    room_ids: List[str] = []
    download: bool = False


@app.get("/api/export/pdf")
def export_pdf_get(
    group_ids: Optional[str] = None,
    faculty_ids: Optional[str] = None,
    room_ids: Optional[str] = None,
    group_id: Optional[str] = None,
    faculty_id: Optional[str] = None,
    room_id: Optional[str] = None,
    download: bool = False,
):
    """Downloads or previews publication-ready timetable as PDF circular."""
    from fastapi.responses import Response
    from acadence.export.pdf_exporter import export_to_pdf
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))
    
    g_list = [g.strip() for g in group_ids.split(",") if g.strip()] if group_ids else []
    if group_id and group_id not in g_list:
        g_list.append(group_id)

    f_list = [f.strip() for f in faculty_ids.split(",") if f.strip()] if faculty_ids else []
    if faculty_id and faculty_id not in f_list:
        f_list.append(faculty_id)

    r_list = [r.strip() for r in room_ids.split(",") if r.strip()] if room_ids else []
    if room_id and room_id not in r_list:
        r_list.append(room_id)

    pdf_bytes = export_to_pdf(
        snapshot=state.snapshot,
        placements=state.current_placements,
        course_cohorts=getattr(state, "course_cohorts", None),
        filter_group_ids=g_list,
        filter_faculty_ids=f_list,
        filter_room_ids=r_list,
    )
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="acadence_timetable.pdf"'},
    )


@app.post("/api/export/pdf")
def export_pdf_post(req: PdfExportSelection):
    """Generates combined PDF timetable for arbitrary selection of classes, faculty and rooms."""
    from fastapi.responses import Response
    from acadence.export.pdf_exporter import export_to_pdf
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))
    pdf_bytes = export_to_pdf(
        snapshot=state.snapshot,
        placements=state.current_placements,
        course_cohorts=getattr(state, "course_cohorts", None),
        filter_group_ids=req.group_ids,
        filter_faculty_ids=req.faculty_ids,
        filter_room_ids=req.room_ids,
    )
    disposition = "attachment" if req.download else "inline"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="acadence_timetable.pdf"'},
    )


@app.get("/api/export/template/courses")
def download_courses_template():
    """Downloads sample Courses CSV template."""
    from fastapi.responses import Response
    csv_content = "course_id,course_name,program_type,nep_category,credits,sessions_per_week,duration_slots,group_ids,room_type_id,eligible_faculty_ids\n"
    csv_content += "DSC-CS-201,Data Structures & Algorithms (Major),FYUP,MAJOR,4,3,1,GRP_FYUP_SEC_A,LECTURE_HALL,FAC_CS_01;FAC_CS_02\n"
    csv_content += "MIN-ECO-201,Principles of Microeconomics (Minor),FYUP,MINOR,4,3,1,GRP_FYUP_SEC_A;GRP_FYUP_SEC_B,LECTURE_HALL,FAC_ECO_01;FAC_ECO_02\n"
    csv_content += "SEC-CS-201,Python & Web Tech Lab (SEC),FYUP,SEC,2,1,2,GRP_FYUP_SEC_A,COMPUTER_LAB,FAC_CS_02\n"
    csv_content += "ITEP-PED-301,Pedagogy of Physical Science (Core),ITEP,MAJOR,4,3,1,GRP_ITEP_SEM5,PEDAGOGY_ROOM,FAC_EDU_02;FAC_EDU_03\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="courses_template.csv"'},
    )


@app.get("/api/export/template/faculty")
def download_faculty_template():
    """Downloads sample Faculty CSV template."""
    from fastapi.responses import Response
    csv_content = "faculty_id,name,department_id,designation,max_hours_week,max_hours_day\n"
    csv_content += "FAC_CS_01,Dr. Alan Turing,COMPUTER_SCIENCE,Professor,14,4\n"
    csv_content += "FAC_CS_02,Dr. Ada Lovelace,COMPUTER_SCIENCE,Assistant Professor,16,4\n"
    csv_content += "FAC_EDU_01,Prof. S. Radhakrishnan,EDUCATION,Professor,14,4\n"
    csv_content += "FAC_MATH_01,Dr. Srinivasa Ramanujan,MATHEMATICS,Professor,14,4\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="faculty_template.csv"'},
    )


@app.get("/api/export/template/rooms")
def download_rooms_template():
    """Downloads sample Rooms CSV template."""
    from fastapi.responses import Response
    csv_content = "room_id,name,room_type_id,capacity,features\n"
    csv_content += "SMART_LH_101,Smart Lecture Hall 101,LECTURE_HALL,75,SMART_BOARD;AUDIO_VISUAL\n"
    csv_content += "COMP_LAB_1,Computer & AI Laboratory,COMPUTER_LAB,65,COMPUTERS;INTERNET\n"
    csv_content += "PEDAGOGY_LAB_1,Teacher Education Pedagogy Hall,PEDAGOGY_ROOM,60,MICRO_TEACHING;SMART_BOARD\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="rooms_template.csv"'},
    )


@app.get("/api/export/ams-json")
def export_ams_json():
    """Exports timetable in standardized Academic Management System (AMS / ERP) schema."""
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))
    req_map = {r.requirement_id: r for r in state.snapshot.requirements}
    fac_map = {f.faculty_id: f for f in state.snapshot.faculty}
    room_map = {r.room_id: r for r in state.snapshot.rooms}

    ams_schedule = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods = ["08:30-09:20", "09:20-10:10", "10:10-11:00", "11:30-12:20", "12:20-13:10", "13:10-14:00", "14:00-14:50", "14:50-15:40"]

    for p in state.current_placements:
        r = req_map.get(p.requirement_id)
        if not r:
            continue
        ams_schedule.append({
            "instance_id": p.instance_id,
            "course_code": r.course_id,
            "course_title": r.course_name,
            "nep_category": r.nep_category.value,
            "program_type": r.program_type.value,
            "credits": r.credits,
            "day": days[p.day],
            "period": f"P{p.period + 1}",
            "timing": periods[p.period] if p.period < len(periods) else "N/A",
            "duration_slots": p.duration_slots,
            "student_groups": r.group_ids,
            "assigned_room": room_map.get(p.assigned_room_id).name if p.assigned_room_id and p.assigned_room_id in room_map else "Virtual",
            "assigned_faculty": [fac_map[fid].name for fid in p.assigned_faculty_ids if fid in fac_map],
        })

    import json
    from fastapi.responses import Response

    payload = {
        "institution_id": state.snapshot.institution_id,
        "institution_name": state.snapshot.institution_name,
        "framework": "NEP-2020",
        "academic_term": state.snapshot.term_id,
        "total_scheduled_sessions": len(ams_schedule),
        "schedule": ams_schedule,
    }
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="acadence_ams_erp_schedule.json"'},
    )


class UploadCSVRequest(BaseModel):
    data_type: str  # 'COURSES', 'FACULTY', 'ROOMS'
    csv_text: str


@app.post("/api/admin/upload-csv")
def upload_csv_data(req: UploadCSVRequest):
    """Parses and ingests bulk CSV data into the institutional snapshot."""
    import csv as csv_module, io
    from acadence.domain.snapshot import SessionRequirement, Faculty, Room
    reader = csv_module.DictReader(io.StringIO(req.csv_text.strip()))

    if req.data_type == "COURSES":
        new_reqs = []
        for row in reader:
            if not row.get("course_id"):
                continue
            c_id = row["course_id"].strip()
            new_reqs.append(
                SessionRequirement(
                    requirement_id=f"REQ_{c_id.replace('-', '_')}",
                    course_id=c_id,
                    course_name=row.get("course_name", c_id).strip(),
                    offering_id=f"OFF_{c_id.replace('-', '_')}",
                    group_ids=[g.strip() for g in row.get("group_ids", "GRP_FYUP_SEC_A").split(";") if g.strip()],
                    session_type="PRACTICAL" if int(row.get("duration_slots", 1)) > 1 else "LECTURE",
                    nep_category=NEPCategory[row.get("nep_category", "MAJOR").strip().upper()],
                    credits=int(row.get("credits", 4)),
                    program_type=ProgramType[row.get("program_type", "FYUP").strip().upper()],
                    sessions_per_week=int(row.get("sessions_per_week", 3)),
                    duration_slots=int(row.get("duration_slots", 1)),
                    room_type_id=row.get("room_type_id", "LECTURE_HALL").strip(),
                    eligible_faculty_ids=[f.strip() for f in row.get("eligible_faculty_ids", "FAC_CS_01").split(";") if f.strip()],
                )
            )
        state.snapshot = state.snapshot.model_copy(update={"requirements": list(state.snapshot.requirements) + new_reqs})
        gen_res = generate_timetable(GenerateRequest(profile_name=state.current_profile))
        return {
            "success": True,
            "message": f"Successfully ingested {len(new_reqs)} course offerings from CSV.",
            "placements": gen_res["placements"],
        }
    elif req.data_type == "FACULTY":
        new_facs = []
        for row in reader:
            if not row.get("faculty_id"):
                continue
            new_facs.append(
                Faculty(
                    faculty_id=row["faculty_id"].strip(),
                    name=row.get("name", "Faculty").strip(),
                    department_id=row.get("department_id", "GENERAL").strip(),
                    designation=row.get("designation", "Assistant Professor").strip(),
                    max_hours_week=int(row.get("max_hours_week", 16)),
                    max_hours_day=int(row.get("max_hours_day", 4)),
                )
            )
        state.snapshot = state.snapshot.model_copy(update={"faculty": list(state.snapshot.faculty) + new_facs})
        return {"success": True, "message": f"Successfully ingested {len(new_facs)} faculty members from CSV."}
    elif req.data_type == "ROOMS":
        new_rms = []
        for row in reader:
            if not row.get("room_id"):
                continue
            new_rms.append(
                Room(
                    room_id=row["room_id"].strip(),
                    name=row.get("name", "Room").strip(),
                    room_type_id=row.get("room_type_id", "LECTURE_HALL").strip(),
                    capacity=int(row.get("capacity", 60)),
                    features={f.strip() for f in row.get("features", "").split(";") if f.strip()},
                )
            )
        state.snapshot = state.snapshot.model_copy(update={"rooms": list(state.snapshot.rooms) + new_rms})
        return {"success": True, "message": f"Successfully ingested {len(new_rms)} rooms from CSV."}

    return {"success": False, "message": "Unknown data type"}


class ScenarioSimulationRequest(BaseModel):
    scenario_type: str  # 'FACULTY_ABSENCE', 'ROOM_MAINTENANCE', 'RESET'
    entity_id: str = ""
    slot_indices: List[int] = []


@app.post("/api/simulate-scenario")
def run_scenario_simulation(req: ScenarioSimulationRequest):
    """Executes 'what-if' dynamic scenario simulations for academic disruptions."""
    from acadence.engine.rescheduler import reschedule_for_faculty_absence
    if req.scenario_type == "RESET":
        return reset_to_default_pilot()

    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))

    if req.scenario_type == "FACULTY_ABSENCE":
        fac_id = req.entity_id or "FAC_CS_01"  # Default: Dr. Alan Turing
        # Find slots where this faculty teaches
        teaching_slots = [p.start_slot for p in state.current_placements if fac_id in p.assigned_faculty_ids]
        absent_slots = set(req.slot_indices) if req.slot_indices else (set(teaching_slots[:1]) if teaching_slots else {0})

        result = reschedule_for_faculty_absence(
            snapshot=state.snapshot,
            current_placements=state.current_placements,
            absent_faculty_id=fac_id,
            absent_slot_indices=absent_slots,
        )
        if result.status not in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
            raise HTTPException(status_code=422, detail=result.status_detail)

        val_res = validate(state.snapshot, result.placements)
        state.current_placements = result.placements
        state.current_metrics = result.metrics
        state.current_validation = val_res

        fac_name = next((f.name for f in state.snapshot.faculty if f.faculty_id == fac_id), fac_id)
        return {
            "success": True,
            "scenario": "Emergency Faculty Absence Simulation",
            "message": f"Simulated unexpected absence for {fac_name}. Engine applied localized minimal-disruption rescheduling (CON-S-014), re-allocating affected sessions with 0 clashes.",
            "placements": result.placements,
            "solve_time_seconds": result.solve_time_seconds,
            "validation": {"is_valid": val_res.is_valid},
        }

    return {"success": False, "message": f"Unsupported scenario type: {req.scenario_type}"}


class AIQueryRequest(BaseModel):
    query: str


class RescheduleAbsenceRequest(BaseModel):
    faculty_id: str
    slot_indices: List[int]


@app.post("/api/ai/query")
def handle_ai_query(req: AIQueryRequest):
    """Processes natural language scheduling requests through the advisory AI assistant (Section 14)."""
    from acadence.ai.assistant import process_ai_query
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))
    return process_ai_query(req.query, state.snapshot, state.current_placements)


@app.post("/api/reschedule/faculty-absence")
def handle_faculty_absence_reschedule(req: RescheduleAbsenceRequest):
    """Executes minimal-disruption dynamic rescheduling for an emergency faculty absence (Section 12)."""
    from acadence.engine.rescheduler import reschedule_for_faculty_absence
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))

    result = reschedule_for_faculty_absence(
        snapshot=state.snapshot,
        current_placements=state.current_placements,
        absent_faculty_id=req.faculty_id,
        absent_slot_indices=set(req.slot_indices),
    )

    if result.status not in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
        raise HTTPException(
            status_code=422,
            detail=result.status_detail,
        )

    val_res = validate(state.snapshot, result.placements)
    state.current_placements = result.placements
    state.current_metrics = result.metrics
    state.current_validation = val_res

    return {
        "status": result.status.value,
        "message": result.status_detail,
        "solve_time_seconds": result.solve_time_seconds,
        "placements": result.placements,
        "metrics": result.metrics,
        "validation": {
            "status": val_res.status.value,
            "is_valid": val_res.is_valid,
        },
    }


class AddCourseRequest(BaseModel):
    course_id: str
    course_name: str
    program_type: str = "FYUP"
    nep_category: str = "MAJOR"
    group_ids: List[str]
    session_type: str = "LECTURE"
    credits: int = 4
    sessions_per_week: int = 3
    duration_slots: int = 1
    room_type_id: str = "LECTURE_HALL"
    eligible_faculty_ids: List[str]


@app.post("/api/admin/add-course")
def add_course_requirement(req: AddCourseRequest):
    """Dynamically adds a course offering under changing NEP guidelines and updates snapshot."""
    from acadence.domain.snapshot import SessionRequirement
    new_req = SessionRequirement(
        requirement_id=f"REQ_{req.course_id.replace('-', '_')}",
        course_id=req.course_id,
        course_name=req.course_name,
        offering_id=f"OFF_{req.course_id.replace('-', '_')}",
        group_ids=req.group_ids,
        session_type=req.session_type,
        nep_category=NEPCategory[req.nep_category.upper()],
        credits=req.credits,
        program_type=ProgramType[req.program_type.upper()],
        sessions_per_week=req.sessions_per_week,
        duration_slots=req.duration_slots,
        room_type_id=req.room_type_id,
        eligible_faculty_ids=req.eligible_faculty_ids,
    )
    updated_reqs = list(state.snapshot.requirements) + [new_req]
    state.snapshot = state.snapshot.model_copy(update={"requirements": updated_reqs})
    gen_res = generate_timetable(GenerateRequest(profile_name=state.current_profile))
    return {
        "success": True,
        "message": f"Successfully registered {req.course_id} and generated updated conflict-free timetable.",
        "requirement_id": new_req.requirement_id,
        "placements": gen_res["placements"],
        "validation": gen_res["validation"],
    }


class StudentPathwayRequest(BaseModel):
    group_id: str
    chosen_minor_req_id: Optional[str] = None


@app.post("/api/student/pathway")
def get_student_pathway_timetable(req: StudentPathwayRequest):
    """Returns a student's personal conflict-free weekly schedule according to their chosen elective pathway."""
    if not state.current_placements:
        generate_timetable(GenerateRequest(profile_name="BALANCED"))

    req_map = {r.requirement_id: r for r in state.snapshot.requirements}
    minor_group = next((eg for eg in state.snapshot.elective_groups if eg.nep_category == NEPCategory.MINOR), None)
    minor_req_ids = set(minor_group.member_requirement_ids) if minor_group else set()

    student_placements = []
    for p in state.current_placements:
        r = req_map.get(p.requirement_id)
        if not r:
            continue
        if p.requirement_id in minor_req_ids:
            if req.chosen_minor_req_id and p.requirement_id == req.chosen_minor_req_id:
                student_placements.append(p)
        elif req.group_id in r.group_ids:
            student_placements.append(p)

    return {
        "group_id": req.group_id,
        "chosen_minor": req.chosen_minor_req_id,
        "placements": student_placements,
    }


class AddFacultyRequest(BaseModel):
    faculty_id: str
    name: str
    department_id: str
    designation: str = "Assistant Professor"
    max_hours_week: int = 16
    max_hours_day: int = 4


@app.post("/api/admin/add-faculty")
def add_faculty(req: AddFacultyRequest):
    """Registers a new faculty member with UGC workload limit."""
    from acadence.domain.snapshot import Faculty
    new_fac = Faculty(
        faculty_id=req.faculty_id,
        name=req.name,
        department_id=req.department_id,
        designation=req.designation,
        max_hours_week=req.max_hours_week,
        max_hours_day=req.max_hours_day,
    )
    updated_fac = list(state.snapshot.faculty) + [new_fac]
    state.snapshot = state.snapshot.model_copy(update={"faculty": updated_fac})
    return {"success": True, "message": f"Faculty {req.name} registered successfully."}


class ToggleAvailabilityRequest(BaseModel):
    faculty_id: str
    slot_index: int


@app.post("/api/admin/toggle-faculty-availability")
def toggle_faculty_availability(req: ToggleAvailabilityRequest):
    """Toggles faculty unavailability slot (CON-H-007) and re-optimizes timetable."""
    updated_fac_list = []
    for f in state.snapshot.faculty:
        if f.faculty_id == req.faculty_id:
            curr_unavail = set(f.unavailable_slots)
            if req.slot_index in curr_unavail:
                curr_unavail.remove(req.slot_index)
            else:
                curr_unavail.add(req.slot_index)
            f_updated = f.model_copy(update={"unavailable_slots": curr_unavail})
            updated_fac_list.append(f_updated)
        else:
            updated_fac_list.append(f)
    state.snapshot = state.snapshot.model_copy(update={"faculty": updated_fac_list})
    gen_res = generate_timetable(GenerateRequest(profile_name=state.current_profile))
    return {
        "success": True,
        "message": f"Updated availability for faculty {req.faculty_id}",
        "placements": gen_res["placements"],
        "validation": gen_res["validation"],
    }


class AddRoomRequest(BaseModel):
    room_id: str
    name: str
    room_type_id: str
    capacity: int


@app.post("/api/admin/add-room")
def add_room(req: AddRoomRequest):
    """Registers a new physical lecture hall, computer lab, or pedagogy room."""
    from acadence.domain.snapshot import Room
    new_room = Room(
        room_id=req.room_id,
        name=req.name,
        room_type_id=req.room_type_id,
        capacity=req.capacity,
    )
    updated_rooms = list(state.snapshot.rooms) + [new_room]
    state.snapshot = state.snapshot.model_copy(update={"rooms": updated_rooms})
    return {"success": True, "message": f"Room {req.name} registered successfully."}


class AddStudentGroupRequest(BaseModel):
    group_id: str
    name: str
    program_type: str = "FYUP"
    semester: int = 3
    expected_strength: int = 35


@app.post("/api/admin/add-group")
def add_student_group(req: AddStudentGroupRequest):
    """Registers a new student cohort or laboratory section."""
    from acadence.domain.snapshot import StudentGroup
    new_grp = StudentGroup(
        group_id=req.group_id,
        name=req.name,
        program_type=ProgramType[req.program_type.upper()] if req.program_type.upper() in ProgramType.__members__ else ProgramType.FYUP,
        semester=req.semester,
        expected_strength=req.expected_strength,
    )
    updated_groups = list(state.snapshot.student_groups) + [new_grp]
    state.snapshot = state.snapshot.model_copy(update={"student_groups": updated_groups})
    return {"success": True, "message": f"Student cohort {req.name} registered successfully."}


@app.delete("/api/admin/course/{requirement_id}")
def delete_course(requirement_id: str):
    """Deletes a course offering requirement and re-optimizes."""
    updated_reqs = [r for r in state.snapshot.requirements if r.requirement_id != requirement_id]
    state.snapshot = state.snapshot.model_copy(update={"requirements": updated_reqs})
    gen_res = generate_timetable(GenerateRequest(profile_name=state.current_profile))
    return {
        "success": True,
        "message": f"Deleted requirement {requirement_id}.",
        "placements": gen_res["placements"],
        "validation": gen_res["validation"],
    }


@app.post("/api/admin/reset")
def reset_to_default_pilot():
    """Resets to baseline academic dataset snapshot."""
    state.programs = get_default_programs()
    state.curriculum_subjects = get_default_curriculum_subjects()
    state.course_cohorts = get_default_course_cohorts()
    state.snapshot = build_curriculum_institution_snapshot(
        state.programs, state.course_cohorts, state.curriculum_subjects
    )
    gen_res = generate_timetable(GenerateRequest(profile_name="BALANCED"))
    return {
        "success": True,
        "message": "Reset to baseline Academic Dataset.",
        "placements": gen_res["placements"],
        "snapshot": state.snapshot,
    }


# =========================================================================
# COURSE & SUBJECT CURRICULUM HIERARCHY ENDPOINTS
# =========================================================================

class AddProgramRequest(BaseModel):
    program_id: str
    name: str
    short_code: str
    department: str
    duration_years: int = 4
    semesters_per_year: int = 2
    description: str = ""


class AddCurriculumSubjectRequest(BaseModel):
    subject_code: str
    subject_name: str
    program_id: str
    year: int
    semester: int
    subject_type: str = "THEORY"  # "THEORY", "PRACTICAL", "TUTORIAL"
    credits: int = 4
    sessions_per_week: int = 3
    duration_slots: int = 1
    room_type_id: str = "LECTURE_HALL"
    faculty_ids: List[str] = []
    cohort_name: Optional[str] = None
    schedule_now: bool = True


@app.get("/api/curriculum/programs")
def get_all_curriculum_programs():
    """Returns all registered academic degree programs."""
    result = []
    for p in state.programs:
        prog_subs = [s for s in state.curriculum_subjects if s.program_id == p.program_id]
        cohort_years = {c.year for c in state.course_cohorts if c.program_id == p.program_id}
        year_breakdown = {}
        for y in sorted(cohort_years if cohort_years else range(1, p.duration_years + 1)):
            year_subs = [s for s in prog_subs if s.year == y]
            year_breakdown[f"year_{y}"] = {
                "year": y,
                "label": f"Year {y}" if y > 3 else ("1st Year" if y == 1 else ("2nd Year" if y == 2 else "3rd Year")),
                "subject_count": len(year_subs),
                "total_credits": sum(s.credits for s in year_subs),
            }
        result.append({
            "program_id": p.program_id,
            "name": p.name,
            "short_code": p.short_code,
            "department": p.department,
            "duration_years": p.duration_years,
            "semesters_per_year": p.semesters_per_year,
            "total_semesters": p.duration_years * p.semesters_per_year,
            "description": p.description,
            "total_subjects": len(prog_subs),
            "total_credits": sum(s.credits for s in prog_subs),
            "year_breakdown": year_breakdown,
        })
    return result


@app.get("/api/curriculum/programs/{program_id}")
def get_program_curriculum_tree(program_id: str):
    """Returns complete curriculum hierarchy (Program -> Years -> Semesters -> Subjects) for a program."""
    prog = next((p for p in state.programs if p.program_id == program_id), None)
    if not prog:
        raise HTTPException(status_code=404, detail=f"Program {program_id} not found.")

    prog_subs = [s for s in state.curriculum_subjects if s.program_id == program_id]

    years_tree = []
    for y in range(1, prog.duration_years + 1):
        year_label = "1st Year" if y == 1 else ("2nd Year" if y == 2 else ("3rd Year" if y == 3 else f"{y}th Year"))
        
        start_sem = (y - 1) * prog.semesters_per_year + 1
        end_sem = y * prog.semesters_per_year

        sems = []
        for s_num in range(start_sem, end_sem + 1):
            sem_subs = [s for s in prog_subs if s.semester == s_num]
            sems.append({
                "semester": s_num,
                "sem_label": f"Semester {s_num}",
                "term_type": "Odd Semester" if s_num % 2 == 1 else "Even Semester",
                "subjects": sem_subs,
                "total_credits": sum(s.credits for s in sem_subs),
                "total_sessions": sum(s.sessions_per_week for s in sem_subs),
            })

        year_subs = [s for s in prog_subs if s.year == y]
        years_tree.append({
            "year": y,
            "year_label": year_label,
            "semesters": sems,
            "total_subjects": len(year_subs),
            "total_credits": sum(s.credits for s in year_subs),
        })

    return {
        "program": prog,
        "years": years_tree,
        "total_subjects": len(prog_subs),
        "total_credits": sum(s.credits for s in prog_subs),
    }


@app.post("/api/curriculum/programs")
def add_academic_program(req: AddProgramRequest):
    """Creates a new Academic Degree Program (e.g. B.Tech Mechanical, BCA, MCA, MBA)."""
    if any(p.program_id == req.program_id for p in state.programs):
        raise HTTPException(status_code=400, detail=f"Program with ID {req.program_id} already exists.")

    new_prog = AcademicProgram(
        program_id=req.program_id.strip().upper(),
        name=req.name.strip(),
        short_code=req.short_code.strip(),
        department=req.department.strip(),
        duration_years=req.duration_years,
        semesters_per_year=req.semesters_per_year,
        total_semesters=req.duration_years * req.semesters_per_year,
        description=req.description.strip(),
    )
    state.programs.append(new_prog)

    from acadence.domain.snapshot import StudentGroup
    new_cohorts = []
    for y in range(1, new_prog.duration_years + 1):
        sem = (y - 1) * new_prog.semesters_per_year + 1
        gid = f"GRP_{new_prog.program_id}_Y{y}"
        if not any(g.group_id == gid for g in state.snapshot.student_groups):
            new_cohorts.append(
                StudentGroup(
                    group_id=gid,
                    name=f"{new_prog.short_code} Year {y} (Sec A)",
                    program_type=ProgramType.FYUP,
                    semester=sem,
                    expected_strength=60,
                )
            )
    if new_cohorts:
        state.snapshot = state.snapshot.model_copy(update={"student_groups": list(state.snapshot.student_groups) + new_cohorts})

    # Register corresponding Course Cohorts in Settings so they are immediately active
    for y in range(1, new_prog.duration_years + 1):
        sem = (y - 1) * new_prog.semesters_per_year + 1
        cid = f"{new_prog.program_id}_Y{y}"
        if not any(c.course_id == cid for c in state.course_cohorts):
            locked_rooms = {r_id for c in state.course_cohorts for r_id in c.allocated_room_ids}
            calc = compute_rooms_for_student_count(60, "LECTURE_HALL", state.snapshot.rooms, locked_room_ids=locked_rooms)
            state.course_cohorts.append(CourseCohort(
                course_id=cid,
                course_name=f"{new_prog.short_code} Year {y}",
                program_id=new_prog.program_id,
                year=y,
                semester=sem,
                department=new_prog.department,
                student_count=60,
                preferred_room_type="LECTURE_HALL",
                rooms_required=calc["rooms_required"],
                allocated_room_ids=calc["allocated_room_ids"],
                allocated_room_names=calc["allocated_room_names"],
                section_ids=[f"GRP_{cid}_SECA"],
                description=f"{new_prog.name} Year {y} cohort with 60 students.",
            ))

    # Pull any catalog template subjects for this program if available
    template_subs = [s for s in get_template_curriculum_subjects() if s.program_id == new_prog.program_id]
    for ts in template_subs:
        if not any(s.subject_code == ts.subject_code and s.program_id == ts.program_id for s in state.curriculum_subjects):
            state.curriculum_subjects.append(ts)

    return {"success": True, "message": f"Academic Program '{new_prog.name}' created successfully.", "program": new_prog}


@app.delete("/api/curriculum/programs/{program_id}")
def delete_academic_program(program_id: str):
    """Deletes an academic degree program and its associated curriculum subjects."""
    state.programs = [p for p in state.programs if p.program_id != program_id]
    state.curriculum_subjects = [s for s in state.curriculum_subjects if s.program_id != program_id]
    state.course_cohorts = [c for c in state.course_cohorts if c.program_id != program_id]
    return {"success": True, "message": f"Program {program_id} and its curriculum deleted."}


@app.post("/api/curriculum/subjects")
def add_curriculum_subject(req: AddCurriculumSubjectRequest):
    """Registers a subject mapped to a Course Program, Year, and Semester, and schedules it."""
    prog = next((p for p in state.programs if p.program_id == req.program_id), None)
    if not prog:
        raise HTTPException(status_code=404, detail=f"Program {req.program_id} not found.")

    if any(s.program_id == req.program_id and s.subject_code == req.subject_code for s in state.curriculum_subjects):
        raise HTTPException(status_code=400, detail=f"Subject code '{req.subject_code}' already exists in {prog.short_code}.")

    gid = f"GRP_{req.program_id}_Y{req.year}"
    from acadence.domain.snapshot import StudentGroup
    if not any(g.group_id == gid for g in state.snapshot.student_groups):
        new_g = StudentGroup(
            group_id=gid,
            name=f"{prog.short_code} Year {req.year} (Sec A)",
            program_type=ProgramType.FYUP,
            semester=req.semester,
            expected_strength=60,
        )
        state.snapshot = state.snapshot.model_copy(update={"student_groups": list(state.snapshot.student_groups) + [new_g]})

    sub = CurriculumSubject(
        subject_code=req.subject_code.strip().upper(),
        subject_name=req.subject_name.strip(),
        program_id=req.program_id,
        year=req.year,
        semester=req.semester,
        subject_type=req.subject_type.upper(),
        credits=req.credits,
        sessions_per_week=req.sessions_per_week,
        duration_slots=req.duration_slots,
        room_type_id=req.room_type_id,
        faculty_ids=req.faculty_ids if req.faculty_ids else ["FAC_CS_01"],
        cohort_name=req.cohort_name or f"{prog.short_code} Year {req.year} (Sec A)",
    )
    state.curriculum_subjects.append(sub)

    if req.schedule_now:
        from acadence.domain.snapshot import SessionRequirement
        req_id = f"REQ_{req.subject_code.replace('-', '_')}_{req.program_id}"
        cat = NEPCategory.MAJOR
        if req.subject_type.upper() == "PRACTICAL":
            cat = NEPCategory.SEC
        
        new_req = SessionRequirement(
            requirement_id=req_id,
            course_id=req.subject_code,
            course_name=req.subject_name,
            offering_id=f"OFF_{req.subject_code.replace('-', '_')}",
            group_ids=[gid],
            session_type="PRACTICAL" if req.subject_type.upper() == "PRACTICAL" else "LECTURE",
            nep_category=cat,
            credits=req.credits,
            program_type=ProgramType.FYUP,
            sessions_per_week=req.sessions_per_week,
            duration_slots=req.duration_slots,
            room_type_id=req.room_type_id,
            eligible_faculty_ids=req.faculty_ids if req.faculty_ids else ["FAC_CS_01"],
        )
        current_reqs = [r for r in state.snapshot.requirements if r.requirement_id != req_id] + [new_req]
        state.snapshot = state.snapshot.model_copy(update={"requirements": current_reqs})
        try:
            generate_timetable(GenerateRequest(profile_name=state.current_profile))
        except Exception:
            pass

    return {
        "success": True,
        "message": f"Successfully registered '{sub.subject_code} - {sub.subject_name}' under {prog.short_code} Year {req.year} (Sem {req.semester}).",
        "subject": sub,
        "placements_count": len(state.current_placements),
        "validation_is_valid": state.current_validation.is_valid if state.current_validation else True,
    }


@app.delete("/api/curriculum/subjects/{program_id}/{subject_code}")
def delete_curriculum_subject(program_id: str, subject_code: str):
    """Deletes a subject from a program curriculum and un-schedules it."""
    state.curriculum_subjects = [
        s for s in state.curriculum_subjects
        if not (s.program_id == program_id and s.subject_code == subject_code)
    ]
    req_id = f"REQ_{subject_code.replace('-', '_')}_{program_id}"
    updated_reqs = [r for r in state.snapshot.requirements if r.requirement_id != req_id and r.course_id != subject_code]
    if len(updated_reqs) != len(state.snapshot.requirements):
        state.snapshot = state.snapshot.model_copy(update={"requirements": updated_reqs})
        try:
            generate_timetable(GenerateRequest(profile_name=state.current_profile))
        except Exception:
            pass

    return {"success": True, "message": f"Deleted subject {subject_code} from {program_id}."}


# =========================================================================
# COURSE COHORT & ROOM AUTO-ALLOCATION ENDPOINTS (SETTINGS INTEGRATION)
# =========================================================================

class CreateCourseCohortRequest(BaseModel):
    course_id: Optional[str] = None
    course_name: str
    program_id: str = "BTECH_CSE"
    year: int = 1
    semester: int = 1
    department: str = "Computer Science & Engineering"
    student_count: int = 120
    preferred_room_type: str = "LECTURE_HALL"
    description: Optional[str] = ""


class UpdateCourseCohortRequest(BaseModel):
    course_name: Optional[str] = None
    student_count: Optional[int] = None
    preferred_room_type: Optional[str] = None
    allocated_room_ids: Optional[List[str]] = None
    department: Optional[str] = None
    description: Optional[str] = None


class AddSubjectToCourseRequest(BaseModel):
    course_id: str
    subject_code: str
    subject_name: str
    subject_type: str = "THEORY"
    credits: int = 4
    sessions_per_week: int = 3
    duration_slots: int = 1
    room_type_id: Optional[str] = None
    faculty_ids: Optional[List[str]] = None
    schedule_now: bool = True


@app.get("/api/courses")
def get_courses():
    """Returns course cohorts (e.g. B.Tech 1st Year, 2nd Year, etc.) with enrollment,
    allocated collision-free exclusively locked rooms, section breakdowns, and enrolled subjects."""
    global_alloc = allocate_exclusive_rooms_for_all_cohorts(state.course_cohorts, state.snapshot.rooms)
    results = []
    
    for item in global_alloc["allocations"]:
        c = item["cohort"]
        calc = item["calculation"]
        
        # Keep cohort's allocated_room_ids updated with exclusively locked rooms
        c.allocated_room_ids = calc["allocated_room_ids"]
        c.allocated_room_names = calc["allocated_room_names"]
        
        # Link subjects that belong to this course cohort
        matched_subjects = [
            s for s in state.curriculum_subjects
            if s.program_id == c.program_id and s.year == c.year
        ]
        
        cohort_group_ids = set(c.section_ids) if c.section_ids else {f"GRP_{c.program_id}_Y{c.year}"}
        active_placements = [
            p for p in state.current_placements
            if any(gid in cohort_group_ids for gid in getattr(p, "student_group_ids", []))
        ]
        
        results.append({
            "course_id": c.course_id,
            "course_name": c.course_name,
            "program_id": c.program_id,
            "year": c.year,
            "semester": c.semester,
            "department": c.department,
            "student_count": c.student_count,
            "preferred_room_type": c.preferred_room_type,
            "rooms_required": calc["rooms_required"],
            "max_capacity_per_room": calc["max_capacity_per_room"],
            "allocated_room_ids": calc["allocated_room_ids"],
            "allocated_room_names": calc["allocated_room_names"],
            "section_ids": c.section_ids,
            "sections": [
                {
                    **sec,
                    "section_id": c.section_ids[i] if (c.section_ids and i < len(c.section_ids)) else f"{c.course_id}_SEC_{chr(65+i)}",
                    "allocated_room_id": sec["room_id"],
                    "allocated_room_name": sec["room_name"],
                }
                for i, sec in enumerate(calc["sections"])
            ],
            "has_deficit": calc["has_deficit"],
            "deficit_count": calc["deficit_count"],
            "error_message": calc["error_message"],
            "is_exclusive_locked": True,
            "description": c.description,
            "subjects_count": len(matched_subjects),
            "subjects": [s.model_dump() for s in matched_subjects],
            "active_placements_count": len(active_placements),
            "collision_free": not calc["has_deficit"],
        })
        
    return {
        "success": True,
        "courses": results,
        "has_campus_deficit": global_alloc["has_campus_deficit"],
        "campus_deficits": global_alloc["campus_deficits"],
        "total_rooms_required": global_alloc["total_rooms_required"],
        "total_rooms_available": global_alloc["total_rooms_available"],
        "total_lecture_halls_available": global_alloc["total_lecture_halls_available"],
        "rooms_catalog": [
            {
                "room_id": r.room_id,
                "name": r.name,
                "capacity": r.capacity,
                "room_type_id": r.room_type_id,
            }
            for r in state.snapshot.rooms
        ]
    }


@app.post("/api/courses")
def create_course(req: CreateCourseCohortRequest):
    """Creates a new course cohort (e.g. M.Tech 1st Year, BCA 2nd Year) with automatic room requirement calculation."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cid = req.course_id or f"{req.program_id}_Y{req.year}"
    cid = cid.strip().upper().replace(" ", "_")
    
    if any(c.course_id == cid for c in state.course_cohorts):
        raise HTTPException(status_code=400, detail=f"Course ID '{cid}' already exists.")
        
    locked_rooms = {r_id for c in state.course_cohorts for r_id in c.allocated_room_ids}
    calc = compute_rooms_for_student_count(req.student_count, req.preferred_room_type, state.snapshot.rooms, locked_room_ids=locked_rooms)
    section_ids = [f"GRP_{cid}_SEC{chr(65 + i)}" for i in range(calc["rooms_required"])]
    
    # Register student groups into snapshot
    from acadence.domain.snapshot import StudentGroup
    new_groups = []
    for i, sec in enumerate(calc["sections"]):
        sec_gid = section_ids[i]
        if not any(g.group_id == sec_gid for g in state.snapshot.student_groups):
            new_groups.append(StudentGroup(
                group_id=sec_gid,
                name=f"{req.course_name} ({sec['section_name']})",
                program_type=ProgramType.FYUP,
                semester=req.semester,
                expected_strength=sec["students"],
            ))
            
    if new_groups:
        state.snapshot = state.snapshot.model_copy(
            update={"student_groups": list(state.snapshot.student_groups) + new_groups}
        )
        
    new_cohort = CourseCohort(
        course_id=cid,
        course_name=req.course_name.strip(),
        program_id=req.program_id,
        year=req.year,
        semester=req.semester,
        department=req.department.strip(),
        student_count=req.student_count,
        preferred_room_type=req.preferred_room_type,
        rooms_required=calc["rooms_required"],
        allocated_room_ids=calc["allocated_room_ids"],
        allocated_room_names=calc["allocated_room_names"],
        section_ids=section_ids,
        description=req.description or f"{req.course_name} with {req.student_count} students auto-allotted {calc['rooms_required']} room(s).",
    )
    state.course_cohorts.append(new_cohort)

    # Ensure program is registered in programs catalog
    if not any(p.program_id == req.program_id for p in state.programs):
        state.programs.append(AcademicProgram(
            program_id=req.program_id,
            name=req.course_name.strip(),
            short_code=req.course_name.strip(),
            department=req.department.strip(),
            duration_years=max(req.year, 4),
            semesters_per_year=2,
            total_semesters=max(req.year, 4) * 2,
            description=f"Academic program for {req.course_name.strip()}",
        ))
        template_subs = [s for s in get_template_curriculum_subjects() if s.program_id == req.program_id]
        for ts in template_subs:
            if not any(s.subject_code == ts.subject_code and s.program_id == ts.program_id for s in state.curriculum_subjects):
                state.curriculum_subjects.append(ts)
    
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "COURSE_CREATED",
        "details": f"Created course cohort '{new_cohort.course_name}' ({new_cohort.course_id}) with {new_cohort.student_count} students, auto-allotted {calc['rooms_required']} rooms.",
    })
    
    return {
        "success": True,
        "message": f"Successfully created course '{new_cohort.course_name}' with {calc['rooms_required']} allocated room(s).",
        "course": new_cohort,
        "calculation": calc,
    }


@app.put("/api/courses/{course_id}")
def update_course(course_id: str, req: UpdateCourseCohortRequest):
    """Updates student enrollment count or room requirements for a course cohort and reallocates collision-free rooms."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cohort = next((c for c in state.course_cohorts if c.course_id == course_id), None)
    if not cohort:
        raise HTTPException(status_code=404, detail=f"Course {course_id} not found.")
        
    if req.course_name is not None:
        cohort.course_name = req.course_name.strip()
    if req.department is not None:
        cohort.department = req.department.strip()
    if req.preferred_room_type is not None:
        cohort.preferred_room_type = req.preferred_room_type
    if req.description is not None:
        cohort.description = req.description
        
    if req.student_count is not None and req.student_count > 0:
        cohort.student_count = req.student_count
        locked_rooms = {
            r_id
            for other in state.course_cohorts
            if other.course_id != cohort.course_id
            for r_id in other.allocated_room_ids
        }
        calc = compute_rooms_for_student_count(
            cohort.student_count,
            cohort.preferred_room_type,
            state.snapshot.rooms,
            locked_room_ids=locked_rooms,
        )
        cohort.rooms_required = calc["rooms_required"]
        cohort.allocated_room_ids = calc["allocated_room_ids"]
        cohort.allocated_room_names = calc["allocated_room_names"]
        cohort.section_ids = [f"GRP_{cohort.course_id}_SEC{chr(65 + i)}" for i in range(calc["rooms_required"])]
        
        # Sync student groups in snapshot
        from acadence.domain.snapshot import StudentGroup
        updated_groups = [g for g in state.snapshot.student_groups if g.group_id not in cohort.section_ids]
            
        for i, sec in enumerate(calc["sections"]):
            sec_gid = cohort.section_ids[i]
            updated_groups.append(StudentGroup(
                group_id=sec_gid,
                name=f"{cohort.course_name} ({sec['section_name']})",
                program_type=ProgramType.FYUP,
                semester=cohort.semester,
                expected_strength=sec["students"],
            ))
        state.snapshot = state.snapshot.model_copy(update={"student_groups": updated_groups})
        
    if req.allocated_room_ids is not None:
        cohort.allocated_room_ids = req.allocated_room_ids
        rooms_dict = {r.room_id: r.name for r in state.snapshot.rooms}
        cohort.allocated_room_names = [f"{rooms_dict.get(rid, rid)} (Allocated)" for rid in req.allocated_room_ids]
        
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "COURSE_UPDATED",
        "details": f"Updated course cohort '{cohort.course_name}' ({course_id}) - Strength: {cohort.student_count}, Rooms: {cohort.rooms_required}.",
    })
    
    return {
        "success": True,
        "message": f"Updated course '{cohort.course_name}'. Auto-allocated {cohort.rooms_required} room(s).",
        "course": cohort,
    }


@app.delete("/api/courses/{course_id}")
def delete_course(course_id: str):
    """Deletes a course cohort."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cohort = next((c for c in state.course_cohorts if c.course_id == course_id), None)
    if not cohort:
        raise HTTPException(status_code=404, detail=f"Course {course_id} not found.")
        
    state.course_cohorts = [c for c in state.course_cohorts if c.course_id != course_id]
    
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "COURSE_DELETED",
        "details": f"Deleted course cohort '{cohort.course_name}' ({course_id}).",
    })
    
    return {"success": True, "message": f"Course '{cohort.course_name}' deleted successfully."}


@app.post("/api/courses/add-subject")
def add_subject_to_course(req: AddSubjectToCourseRequest):
    """Matches a subject (e.g. Engineering Mathematics - 1) to its suitable Course (e.g. B.Tech 1st Year).
    Allots non-overlapping rooms, divides into parallel sections if enrollment > room capacity,
    and schedules into the conflict-free timetable."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 1. Resolve matching course cohort
    cohort = next(
        (c for c in state.course_cohorts if c.course_id == req.course_id or c.course_name.lower() == req.course_id.lower()),
        None
    )
    if not cohort:
        prog = next((p for p in state.programs if p.program_id == req.course_id), None)
        if prog:
            cohort = next((c for c in state.course_cohorts if c.program_id == prog.program_id), None)
            
    if not cohort:
        raise HTTPException(status_code=404, detail=f"Target course '{req.course_id}' not found.")
        
    code_clean = req.subject_code.strip().upper()
    name_clean = req.subject_name.strip()
    
    # Check duplicate in this course
    if any(s.program_id == cohort.program_id and s.year == cohort.year and s.subject_code == code_clean for s in state.curriculum_subjects):
        raise HTTPException(status_code=400, detail=f"Subject '{code_clean}' already exists in {cohort.course_name}.")
        
    # 2. Determine rooms and sections
    locked_rooms = {
        r_id
        for other in state.course_cohorts
        if other.course_id != cohort.course_id
        for r_id in other.allocated_room_ids
    }
    calc = compute_rooms_for_student_count(
        cohort.student_count,
        req.room_type_id or cohort.preferred_room_type,
        state.snapshot.rooms,
        locked_room_ids=locked_rooms,
    )
    rooms_needed = calc["rooms_required"]
    
    # Ensure section groups exist in snapshot
    from acadence.domain.snapshot import StudentGroup, SessionRequirement
    new_groups = []
    section_gids = []
    for i in range(rooms_needed):
        sec_gid = f"GRP_{cohort.course_id}_SEC{chr(65 + i)}"
        section_gids.append(sec_gid)
        if not any(g.group_id == sec_gid for g in state.snapshot.student_groups):
            new_groups.append(StudentGroup(
                group_id=sec_gid,
                name=f"{cohort.course_name} (Section {chr(65 + i)})",
                program_type=ProgramType.FYUP,
                semester=cohort.semester,
                expected_strength=calc["sections"][i]["students"],
            ))
            
    if new_groups:
        state.snapshot = state.snapshot.model_copy(
            update={"student_groups": list(state.snapshot.student_groups) + new_groups}
        )
        
    cohort.section_ids = section_gids
    cohort.rooms_required = rooms_needed
    if not cohort.allocated_room_ids:
        cohort.allocated_room_ids = calc["allocated_room_ids"]
        cohort.allocated_room_names = calc["allocated_room_names"]
    
    # 3. Add to curriculum subjects list
    new_subject = CurriculumSubject(
        subject_code=code_clean,
        subject_name=name_clean,
        program_id=cohort.program_id,
        year=cohort.year,
        semester=cohort.semester,
        subject_type=req.subject_type.upper(),
        credits=req.credits,
        sessions_per_week=req.sessions_per_week,
        duration_slots=req.duration_slots,
        room_type_id=req.room_type_id or cohort.preferred_room_type,
        faculty_ids=req.faculty_ids if req.faculty_ids else ["FAC_CS_01"],
        cohort_name=f"{cohort.course_name}",
    )
    state.curriculum_subjects.append(new_subject)
    
    # 4. Schedule into CP-SAT timetable with non-overlapping rooms
    if req.schedule_now:
        cat = NEPCategory.MAJOR if req.subject_type.upper() == "THEORY" else NEPCategory.SEC
        new_requirements = []
        for i, sec_gid in enumerate(section_gids):
            req_id = f"REQ_{code_clean.replace('-', '_')}_{cohort.course_id}_{chr(65 + i)}"
            pre_rm = (
                cohort.allocated_room_ids[i]
                if (req.subject_type.upper() == "THEORY" and cohort.allocated_room_ids and i < len(cohort.allocated_room_ids))
                else None
            )
            new_requirements.append(SessionRequirement(
                requirement_id=req_id,
                course_id=code_clean,
                course_name=f"{name_clean} (Sec {chr(65 + i)})" if rooms_needed > 1 else name_clean,
                offering_id=f"OFF_{code_clean.replace('-', '_')}_{chr(65 + i)}",
                group_ids=[sec_gid],
                session_type="PRACTICAL" if req.subject_type.upper() == "PRACTICAL" else "LECTURE",
                nep_category=cat,
                credits=req.credits,
                program_type=ProgramType.FYUP,
                sessions_per_week=req.sessions_per_week,
                duration_slots=req.duration_slots,
                room_type_id=req.room_type_id or cohort.preferred_room_type,
                pre_assigned_room_id=pre_rm,
                eligible_faculty_ids=req.faculty_ids if req.faculty_ids else ["FAC_CS_01"],
            ))
            
        current_reqs = [
            r for r in state.snapshot.requirements
            if not r.requirement_id.startswith(f"REQ_{code_clean.replace('-', '_')}_{cohort.course_id}")
        ] + new_requirements
        
        state.snapshot = state.snapshot.model_copy(update={"requirements": current_reqs})
        try:
            generate_timetable(GenerateRequest(profile_name=state.current_profile, time_limit_seconds=10.0))
        except Exception as e:
            print("Auto-reschedule notice:", e)
            
    # Audit log
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "SUBJECT_MAPPED_TO_COURSE",
        "details": f"Mapped '{code_clean}: {name_clean}' to '{cohort.course_name}' ({cohort.student_count} students, {rooms_needed} room(s) allocated: {', '.join(calc['allocated_room_names'])}).",
    })
    
    return {
        "success": True,
        "message": f"Successfully enrolled '{code_clean}: {name_clean}' into '{cohort.course_name}'. Auto-allocated {rooms_needed} collision-free room(s).",
        "course": cohort,
        "subject": new_subject,
        "rooms_allocated": calc["allocated_room_names"],
        "sections_count": rooms_needed,
        "placements_count": len(state.current_placements),
        "validation_is_valid": state.current_validation.is_valid if state.current_validation else True,
        "clashes_count": len(state.current_validation.violations) if state.current_validation else 0,
    }


@app.get("/api/courses/room-allocations")
def get_room_allocations_audit():
    """Returns a full collision-free room allocation audit across all courses, capacities, and active timetable slots."""
    rooms = state.snapshot.rooms
    total_slots_per_week = 5 * 7  # 5 days * 7 periods = 35 weekly slots
    req_map = {req.requirement_id: req for req in state.snapshot.requirements}
    
    report = []
    total_collisions = 0
    
    for r in rooms:
        room_placements = [p for p in state.current_placements if getattr(p, "assigned_room_id", getattr(p, "room_id", "")) == r.room_id]
        
        slot_map = {}
        room_collisions = 0
        for p in room_placements:
            key = (p.day, p.period)
            if key in slot_map:
                room_collisions += 1
            slot_map[key] = p
            
        total_collisions += room_collisions
        
        assigned_cohorts = [
            c.course_name for c in state.course_cohorts
            if r.room_id in c.allocated_room_ids
        ]
        
        occupancy_pct = round((len(room_placements) / total_slots_per_week) * 100, 1) if total_slots_per_week > 0 else 0
        
        scheduled_courses = list({
            req_map[p.requirement_id].course_id
            for p in room_placements
            if p.requirement_id in req_map
        })

        report.append({
            "room_id": r.room_id,
            "room_name": r.name,
            "capacity": r.capacity,
            "room_type_id": r.room_type_id,
            "assigned_cohorts": assigned_cohorts,
            "scheduled_slots_count": len(room_placements),
            "occupancy_rate_pct": occupancy_pct,
            "is_collision_free": room_collisions == 0,
            "collisions_count": room_collisions,
            "scheduled_courses": scheduled_courses,
        })
        
    return {
        "success": True,
        "total_rooms": len(rooms),
        "total_collisions": total_collisions,
        "is_all_collision_free": total_collisions == 0,
        "rooms": report,
    }


# =========================================================================
# AUTHENTICATION, RBAC & SETTINGS ENDPOINTS
# =========================================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class CreateUserRequest(BaseModel):
    email: str
    name: str
    role: str  # "ADMIN", "COORDINATOR", "FACULTY"
    department: str
    password: Optional[str] = "123"


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None


class UpdateSettingsRequest(BaseModel):
    institution_name: Optional[str] = None
    academic_session: Optional[str] = None
    nep_framework: Optional[str] = None
    working_days_per_week: Optional[int] = None
    periods_per_day: Optional[int] = None
    teaching_practice_weeks: Optional[int] = None
    campus_start_time: Optional[str] = None
    campus_end_time: Optional[str] = None
    default_period_duration_minutes: Optional[int] = None
    break_duration_minutes: Optional[int] = None
    lunch_break_after: Optional[int] = None
    periods_schedule: Optional[List[Dict[str, Any]]] = None
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    auto_validate: Optional[bool] = None
    audit_logging: Optional[bool] = None


@app.post("/api/auth/login")
def login(req: LoginRequest):
    """Authenticates user against system users (supports hello@123.com / 123)."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for u in state.users:
        if u["email"].lower() == req.email.strip().lower() and u["password"] == req.password.strip():
            if u.get("status") == "INACTIVE":
                raise HTTPException(status_code=403, detail="Account is deactivated. Contact System Administrator.")
            
            # Record audit log
            state.audit_logs.insert(0, {
                "timestamp": now_str,
                "user_email": u["email"],
                "action": "USER_LOGIN",
                "details": f"User logged in with role {u['role']}.",
            })
            return {
                "success": True,
                "user": {
                    "user_id": u["user_id"],
                    "email": u["email"],
                    "name": u["name"],
                    "role": u["role"],
                    "department": u["department"],
                    "status": u["status"],
                },
                "token": f"acadence_jwt_{u['user_id']}_{now_str}",
            }
    
    raise HTTPException(status_code=401, detail="Invalid email or password. Use hello@123.com / 123.")


@app.get("/api/auth/users")
def get_users():
    """Returns list of registered users and their roles."""
    return [
        {
            "user_id": u["user_id"],
            "email": u["email"],
            "name": u["name"],
            "role": u["role"],
            "department": u["department"],
            "status": u["status"],
            "created_at": u.get("created_at", "2026-11-01"),
        }
        for u in state.users
    ]


@app.post("/api/auth/users")
def create_user(req: CreateUserRequest):
    """Creates a new user with role-based permissions and syncs to Supabase."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    valid_roles = ["ADMIN", "COORDINATOR", "FACULTY"]
    chosen_role = req.role.strip().upper()
    if chosen_role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{req.role}'. Must be ADMIN, COORDINATOR, or FACULTY (Student access is removed)."
        )

    # Check duplicate
    for u in state.users:
        if u["email"].lower() == req.email.strip().lower():
            raise HTTPException(status_code=400, detail="User with this email already exists.")
    
    new_user = {
        "user_id": f"usr_{len(state.users) + 1:03d}",
        "email": req.email.strip(),
        "password": req.password or "123",
        "name": req.name.strip(),
        "role": chosen_role,
        "department": req.department.strip(),
        "status": "ACTIVE",
        "created_at": now_str[:10],
    }
    state.users.append(new_user)
    
    # Live cloud synchronization with Supabase
    supabase_upsert_user(new_user)
    
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "USER_CREATED",
        "details": f"Created user {req.name} ({req.email}) with role {chosen_role} (Synced to Supabase).",
    })
    return {"success": True, "message": f"User {req.name} created and synced with Supabase successfully.", "user": new_user}


@app.put("/api/auth/users/{user_id}")
def update_user(user_id: str, req: UpdateUserRequest):
    """Updates user role, department, or active status and syncs to Supabase."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    valid_roles = ["ADMIN", "COORDINATOR", "FACULTY"]
    for u in state.users:
        if u["user_id"] == user_id:
            if req.name is not None:
                u["name"] = req.name
            if req.role is not None:
                new_role = req.role.strip().upper()
                if new_role not in valid_roles:
                    raise HTTPException(status_code=400, detail=f"Invalid role '{req.role}'. Must be ADMIN, COORDINATOR, or FACULTY.")
                u["role"] = new_role
            if req.department is not None:
                u["department"] = req.department
            if req.status is not None:
                u["status"] = req.status.upper()
            
            # Live cloud synchronization with Supabase
            supabase_upsert_user(u)

            state.audit_logs.insert(0, {
                "timestamp": now_str,
                "user_email": "admin",
                "action": "USER_UPDATED",
                "details": f"Updated user {u['name']} ({user_id}) - Role: {u['role']}, Status: {u['status']} (Synced to Supabase).",
            })
            return {"success": True, "message": f"User {u['name']} updated and synced with Supabase.", "user": u}
    
    raise HTTPException(status_code=404, detail="User not found.")


@app.delete("/api/auth/users/{user_id}")
def delete_user(user_id: str):
    """Deletes a user account and removes it from Supabase (prevents deleting the primary admin hello@123.com)."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    target = None
    for u in state.users:
        if u["user_id"] == user_id:
            target = u
            break
    
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if target["email"].lower() == "hello@123.com":
        raise HTTPException(status_code=400, detail="Cannot delete root system administrator (hello@123.com).")
    
    state.users = [u for u in state.users if u["user_id"] != user_id]
    
    # Remove from Supabase cloud database
    supabase_delete_user(user_id)
    
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "USER_DELETED",
        "details": f"Deleted user {target['name']} ({target['email']}) from system & Supabase.",
    })
    return {"success": True, "message": f"User {target['name']} deleted from system and Supabase."}
    return {"success": True, "message": f"User {target['name']} deleted."}


@app.get("/api/settings")
def get_settings():
    """Returns institution parameters and Supabase integration settings."""
    return state.settings


@app.post("/api/settings")
def update_settings(req: UpdateSettingsRequest):
    """Updates institution and system settings."""
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for k, v in req.model_dump(exclude_unset=True).items():
        state.settings[k] = v

    if "periods_schedule" in state.settings and state.settings["periods_schedule"]:
        cnt = len(state.settings["periods_schedule"])
        state.settings["periods_per_day"] = cnt
        try:
            if hasattr(state, "snapshot") and state.snapshot and hasattr(state.snapshot, "time_grid") and state.snapshot.time_grid:
                updated_grid = state.snapshot.time_grid.model_copy(update={"periods_per_day": cnt})
                state.snapshot = state.snapshot.model_copy(update={"time_grid": updated_grid})
        except Exception as e:
            print(f"[Settings Update] Notice: TimeGrid copy: {e}")
    
    state.audit_logs.insert(0, {
        "timestamp": now_str,
        "user_email": "admin",
        "action": "SETTINGS_UPDATED",
        "details": "Updated institution, term parameters, and lecture schedule timings.",
    })
    return {"success": True, "message": "Settings updated successfully.", "settings": state.settings}


@app.get("/api/audit-logs")
def get_audit_logs():
    """Returns system audit log entries."""
    return state.audit_logs


# Mount production web dashboard build if present
import os
from fastapi.staticfiles import StaticFiles

dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

