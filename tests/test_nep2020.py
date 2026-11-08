"""Tests for NEP 2020 Multidisciplinary Timetable Generation (Problem Statement 25091).
Verifies:
1. Four-Year Undergraduate Programme (FYUP) with Major, Minor Basket, SEC, AEC, VAC.
2. Integrated Teacher Education Programme (ITEP) & B.Ed. with School Teaching Practice blocks.
3. CON-H-011: Parallel alignment of multidisciplinary minor courses (Economics, Math, Psychology).
4. Independent validation (VAL-001 to VAL-011).
"""
import pytest
from acadence.domain.enums import SolverStatus, ValidationStatus, NEPCategory, ProgramType
from acadence.engine.solver import solve, SolverParameters
from acadence.validator.validator import validate
from acadence.test_data.nep2020 import generate_nep2020_institution_snapshot


def test_nep2020_snapshot_structure():
    """Verify NEP 2020 snapshot includes FYUP, ITEP, B.Ed, M.Ed and categories."""
    snapshot = generate_nep2020_institution_snapshot(seed=42)
    assert snapshot.institution_id == "INST_JK_HE_25091"
    assert snapshot.problem_statement_id == "25091"
    assert len(snapshot.student_groups) == 6
    assert len(snapshot.rooms) == 8
    assert len(snapshot.faculty) == 12

    # Verify categories present
    categories = {r.nep_category for r in snapshot.requirements}
    assert NEPCategory.MAJOR in categories
    assert NEPCategory.MINOR in categories
    assert NEPCategory.SEC in categories
    assert NEPCategory.AEC in categories
    assert NEPCategory.VAC in categories
    assert NEPCategory.TEACHING_PRACTICE in categories

    # Verify programs present
    programs = {r.program_type for r in snapshot.requirements}
    assert ProgramType.FYUP in programs
    assert ProgramType.ITEP in programs
    assert ProgramType.B_ED in programs
    assert ProgramType.M_ED in programs


def test_nep2020_solve_and_parallel_minor_alignment():
    """Verify that CP-SAT solves the NEP 2020 institution and enforces CON-H-011 parallel minor alignment."""
    snapshot = generate_nep2020_institution_snapshot(seed=42)
    params = SolverParameters(time_limit_seconds=20.0, random_seed=42)

    result = solve(snapshot, params)
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE), (
        f"Solver failed on NEP 2020: {result.status_detail}"
    )

    # 1. Independent validation oracle
    report = validate(snapshot, result.placements)
    if not report.is_valid:
        violations = [f"[{v.check_id}] {v.message}" for v in report.violations]
        pytest.fail("Independent Validator rejected NEP 2020 schedule:\n" + "\n".join(violations))

    assert report.status == ValidationStatus.VALID
    assert len(report.violations) == 0

    # 2. Verify CON-H-011: Minor courses (Economics, Math, Psychology) start at the EXACT same slots
    eco_starts = sorted([p.start_slot for p in result.placements if "REQ_MINOR_ECO" in p.requirement_id])
    mth_starts = sorted([p.start_slot for p in result.placements if "REQ_MINOR_MATH" in p.requirement_id])
    psy_starts = sorted([p.start_slot for p in result.placements if "REQ_MINOR_PSY" in p.requirement_id])

    assert len(eco_starts) == 3
    assert eco_starts == mth_starts == psy_starts, (
        f"Parallel minor courses misaligned: ECO={eco_starts}, MTH={mth_starts}, PSY={psy_starts}"
    )

    # 3. Verify that each parallel minor is in a DIFFERENT room so students don't collide
    for k in range(3):
        eco_p = next(p for p in result.placements if p.requirement_id == "REQ_MINOR_ECO" and p.start_slot == eco_starts[k])
        mth_p = next(p for p in result.placements if p.requirement_id == "REQ_MINOR_MATH" and p.start_slot == mth_starts[k])
        psy_p = next(p for p in result.placements if p.requirement_id == "REQ_MINOR_PSY" and p.start_slot == psy_starts[k])

        assigned_rooms = {eco_p.assigned_room_id, mth_p.assigned_room_id, psy_p.assigned_room_id}
        assert len(assigned_rooms) == 3, f"Parallel minors must occupy 3 distinct rooms, got: {assigned_rooms}"
