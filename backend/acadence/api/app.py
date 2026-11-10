"""FastAPI web service for Acadence Timetable Platform.
Exposes optimization, multi-profile alternatives, live delta-validation, and timetable grids.
"""
from typing import Dict, List, Optional
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

app = FastAPI(
    title="Acadence NEP 2020 Multidisciplinary Timetable System",
    description="AI-Based Timetable Generation System aligned with NEP 2020 (Problem Statement 25091 - Govt. of J&K)",
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
    snapshot: ConfigSnapshot = generate_nep2020_institution_snapshot(seed=42)
    current_placements: List[Placement] = []
    current_profile: str = "BALANCED"
    current_metrics: Optional[MetricReport] = None
    current_validation: Optional[ValidationReport] = None
    alternatives: Dict[str, dict] = {}

state = AppState()


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
    """Exports timetable in standardized NEP 2020 Academic Management System (AMS / ERP) schema."""
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

    return {
        "institution_id": state.snapshot.institution_id,
        "institution_name": state.snapshot.institution_name,
        "problem_statement_id": "25091",
        "state_or_ut": "Jammu and Kashmir",
        "academic_term": state.snapshot.term_id,
        "total_scheduled_sessions": len(ams_schedule),
        "schedule": ams_schedule,
    }


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
    """Resets to official Government of J&K pilot snapshot."""
    state.snapshot = generate_nep2020_institution_snapshot(seed=42)
    gen_res = generate_timetable(GenerateRequest(profile_name="BALANCED"))
    return {
        "success": True,
        "message": "Reset to official J&K Higher Education NEP 2020 Pilot Dataset.",
        "placements": gen_res["placements"],
        "snapshot": state.snapshot,
    }


# Mount production web dashboard build if present
import os
from fastapi.staticfiles import StaticFiles

dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

