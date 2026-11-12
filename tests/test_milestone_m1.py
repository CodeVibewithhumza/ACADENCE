"""Comprehensive test suite for Milestone M1 (Engine & Independent Validator).
Verifies:
1. Tier S instance generation and CP-SAT solving
2. Validator agreement (VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, VAL-006, VAL-007, VAL-008)
3. Batch concurrency (sibling batches running parallel sessions without false clash)
4. Mutation/fault-injection tests proving the independent validator catches all clashes
"""
import copy
import pytest
from acadence.domain.enums import SolverStatus, ValidationStatus
from acadence.domain.snapshot import Placement
from acadence.engine.solver import solve, SolverParameters
from acadence.validator.validator import validate
from acadence.test_data.synthetic import generate_tier_s_snapshot


def test_tier_s_snapshot_creation():
    """Verify Tier S synthetic snapshot creates properly with immutable hash."""
    snapshot = generate_tier_s_snapshot(seed=1)
    assert snapshot.institution_id == "INST_DEMO"
    assert len(snapshot.student_groups) == 7
    assert len(snapshot.rooms) == 8
    assert len(snapshot.faculty) == 12
    h1 = snapshot.compute_hash()
    h2 = snapshot.compute_hash()
    assert h1 == h2
    assert len(h1) == 64


def test_m1_solver_and_validator_agreement():
    """Milestone M1 Core Acceptance: Solve Tier S and verify independent validator certifies it VALID."""
    snapshot = generate_tier_s_snapshot(seed=42)
    params = SolverParameters(time_limit_seconds=20.0, random_seed=42, num_search_workers=1)

    result = solve(snapshot, params)

    # 1. Assert solver reached a solution
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE), (
        f"Solver failed: {result.status} - {result.status_detail}"
    )
    # Total instances = 4 courses * (3 SecA + 3 SecB) + 3 lab courses * (2 batches A + 2 batches B)
    # = 24 theory lectures + 12 practical labs = 36 session instances
    assert len(result.placements) == 36

    # 2. Pass solver output directly to the Independent Validator
    report = validate(snapshot, result.placements)

    # 3. Assert zero violations
    if not report.is_valid:
        violation_msgs = [f"[{v.check_id}] {v.entity_type} {v.entity_id}: {v.message}" for v in report.violations]
        pytest.fail("Independent Validator rejected solver output:\n" + "\n".join(violation_msgs))

    assert report.status == ValidationStatus.VALID
    assert len(report.violations) == 0


def test_batch_parallel_concurrency():
    """Verifies HOLE-002: Sibling batches (A1 and A2) can be scheduled simultaneously in different labs."""
    snapshot = generate_tier_s_snapshot(seed=101)
    params = SolverParameters(time_limit_seconds=15.0, random_seed=101)
    result = solve(snapshot, params)

    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    # Find placements of Batch A1 and Batch A2
    a1_placements = [p for p in result.placements if "LAB_A1" in p.requirement_id]
    a2_placements = [p for p in result.placements if "LAB_A2" in p.requirement_id]

    assert len(a1_placements) > 0
    assert len(a2_placements) > 0

    # Ensure validator passes on this schedule
    report = validate(snapshot, result.placements)
    assert report.is_valid is True


def test_validator_catches_faculty_double_booking():
    """Fault injection: deliberate faculty collision must be caught by VAL-002."""
    snapshot = generate_tier_s_snapshot(seed=1)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    # Mutate: make session 1 occupy same faculty and slot as session 0
    corrupted_placements = [p.model_copy() for p in result.placements]
    target_fac = corrupted_placements[0].assigned_faculty_ids[0]
    corrupted_placements[1] = corrupted_placements[1].model_copy(
        update={
            "start_slot": corrupted_placements[0].start_slot,
            "assigned_faculty_ids": [target_fac],
        }
    )

    report = validate(snapshot, corrupted_placements)
    assert not report.is_valid
    assert any(v.check_id == "VAL-002" for v in report.violations)


def test_validator_catches_room_double_booking():
    """Fault injection: deliberate room collision must be caught by VAL-003."""
    snapshot = generate_tier_s_snapshot(seed=1)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    corrupted_placements = [p.model_copy() for p in result.placements]
    target_room = corrupted_placements[0].assigned_room_id
    corrupted_placements[1] = corrupted_placements[1].model_copy(
        update={
            "start_slot": corrupted_placements[0].start_slot,
            "assigned_room_id": target_room,
        }
    )

    report = validate(snapshot, corrupted_placements)
    assert not report.is_valid
    assert any(v.check_id == "VAL-003" for v in report.violations)


def test_validator_catches_student_cohort_clash():
    """Fault injection: Section A lecture overlapping Batch A1 lab must be caught by VAL-004."""
    snapshot = generate_tier_s_snapshot(seed=1)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    corrupted_placements = [p.model_copy() for p in result.placements]
    # Find a Sec A lecture and a Batch A1 lab
    sec_a_idx = next(i for i, p in enumerate(corrupted_placements) if "SEC_A" in p.requirement_id)
    batch_a1_idx = next(i for i, p in enumerate(corrupted_placements) if "LAB_A1" in p.requirement_id)

    # Move batch A1 to exact same start slot as section A
    corrupted_placements[batch_a1_idx] = corrupted_placements[batch_a1_idx].model_copy(
        update={"start_slot": corrupted_placements[sec_a_idx].start_slot}
    )

    report = validate(snapshot, corrupted_placements)
    assert not report.is_valid
    assert any(v.check_id == "VAL-004" for v in report.violations)


def test_validator_catches_faculty_unavailability():
    """Fault injection: assigning a faculty member during their unavailable slots must trigger VAL-007."""
    snapshot = generate_tier_s_snapshot(seed=1)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    corrupted_placements = [p.model_copy() for p in result.placements]
    # FAC_01 has unavailable_slots={0, 1}
    corrupted_placements[0] = corrupted_placements[0].model_copy(
        update={
            "start_slot": 0,
            "assigned_faculty_ids": ["FAC_01"],
        }
    )

    report = validate(snapshot, corrupted_placements)
    assert not report.is_valid
    assert any(v.check_id == "VAL-007" for v in report.violations)


def test_validator_catches_workload_exceeded():
    """Fault injection: assigning a faculty member beyond their daily cap must trigger VAL-009."""
    snapshot = generate_tier_s_snapshot(seed=1)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    corrupted_placements = [p.model_copy() for p in result.placements]
    # Set faculty limit to 1h daily
    snap_copy = snapshot.model_copy(deep=True)
    snap_copy.faculty[0].max_hours_day = 1

    report = validate(snap_copy, corrupted_placements)
    assert not report.is_valid
    assert any(v.check_id == "VAL-009" for v in report.violations)


def test_validator_catches_session_incompleteness():
    """Fault injection: missing a scheduled session must trigger VAL-018."""
    snapshot = generate_tier_s_snapshot(seed=1)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    # Drop one placement
    incomplete_placements = result.placements[1:]
    report = validate(snapshot, incomplete_placements)
    assert not report.is_valid
    assert any(v.check_id == "VAL-018" for v in report.violations)


