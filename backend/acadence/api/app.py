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


# Mount production web dashboard build if present
import os
from fastapi.staticfiles import StaticFiles

dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

