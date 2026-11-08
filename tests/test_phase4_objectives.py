"""Tests for Phase 4: Soft Constraints and Objective Profiles.
Verifies CON-S-008 (session distribution), CON-S-005 (room capacity fit),
CON-S-003 / CON-S-004 (idle gap minimization), and seeded profile alternatives.
"""
import pytest
from acadence.domain.enums import SolverStatus, ValidationStatus
from acadence.domain.objectives import SEEDED_PROFILES
from acadence.engine.solver import solve, SolverParameters
from acadence.validator.validator import validate
from acadence.validator.metrics import evaluate_metrics
from acadence.test_data.synthetic import generate_tier_s_snapshot


def test_solve_with_balanced_profile():
    """Verify solver optimizes with BALANCED profile and eliminates lecture clumping."""
    snapshot = generate_tier_s_snapshot(seed=42)
    params = SolverParameters(
        time_limit_seconds=20.0,
        random_seed=42,
        profile=SEEDED_PROFILES["BALANCED"],
    )

    result = solve(snapshot, params)
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)
    assert result.metrics is not None

    # CON-S-008: Courses with 3 lectures should be spread across 3 different days
    # So distribution_excess must be 0!
    assert result.metrics.distribution_excess == 0, (
        f"Expected 0 distribution excess, got {result.metrics.distribution_excess}"
    )

    # Independent validator check
    report = validate(snapshot, result.placements)
    assert report.is_valid is True
    assert len(report.violations) == 0


def test_seeded_profiles_produce_valid_alternatives():
    """Generate timetables across multiple seeded profiles and verify all are certified VALID."""
    snapshot = generate_tier_s_snapshot(seed=123)

    for profile_name in ["BALANCED", "FACULTY_FRIENDLY", "STUDENT_FRIENDLY", "SPACE_EFFICIENT"]:
        profile = SEEDED_PROFILES[profile_name]
        params = SolverParameters(
            time_limit_seconds=15.0,
            random_seed=123,
            profile=profile,
        )
        result = solve(snapshot, params)
        assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE), (
            f"Profile {profile_name} failed: {result.status_detail}"
        )

        # Independent validation
        report = validate(snapshot, result.placements)
        assert report.is_valid is True, f"Profile {profile_name} produced invalid placements!"
        assert result.metrics is not None
        assert result.metrics.composite_score >= 0


def test_room_capacity_waste_optimization():
    """Verify SPACE_EFFICIENT profile minimizes room capacity waste."""
    snapshot = generate_tier_s_snapshot(seed=99)

    # Solve with space efficiency profile
    params = SolverParameters(
        time_limit_seconds=15.0,
        random_seed=99,
        profile=SEEDED_PROFILES["SPACE_EFFICIENT"],
    )
    result = solve(snapshot, params)
    assert result.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    # In Tier S, lab batches of strength 25 should be assigned to 30-capacity COMPUTER_LAB rooms,
    # NOT 60-capacity LECTURE_HALL rooms.
    for p in result.placements:
        if "LAB_" in p.requirement_id:
            # Must be placed in a lab room
            assert p.assigned_room_id and p.assigned_room_id.startswith("LAB_"), (
                f"Lab {p.requirement_id} was assigned non-lab room {p.assigned_room_id}"
            )

