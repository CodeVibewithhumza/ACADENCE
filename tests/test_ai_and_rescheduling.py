"""Tests for Section 14 (AI Assistant) and Section 12 (Dynamic Rescheduling).
"""
from fastapi.testclient import TestClient
from acadence.api.app import app
from acadence.domain.enums import SolverStatus
from acadence.engine.rescheduler import reschedule_for_faculty_absence
from acadence.test_data.synthetic import generate_tier_s_snapshot
from acadence.engine.solver import solve, SolverParameters

client = TestClient(app)


def test_dynamic_rescheduling_on_faculty_absence():
    """Verify minimal-disruption rescheduling when a faculty member reports unexpected absence."""
    snapshot = generate_tier_s_snapshot(seed=42)
    initial_res = solve(snapshot, SolverParameters(time_limit_seconds=10.0))
    assert initial_res.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)

    # Pick a faculty who has classes on Thursday (e.g. slots 24..31)
    target_p = initial_res.placements[0]
    fac_id = target_p.assigned_faculty_ids[0]
    absent_slot = target_p.start_slot

    # Reschedule with new absence
    res = reschedule_for_faculty_absence(
        snapshot=snapshot,
        current_placements=initial_res.placements,
        absent_faculty_id=fac_id,
        absent_slot_indices={absent_slot},
    )

    assert res.status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE)
    # Check that the affected session moved away from absent_slot
    updated_p = next(p for p in res.placements if p.instance_id == target_p.instance_id)
    assert updated_p.start_slot != absent_slot


def test_ai_query_move_course():
    """Verify AI assistant analyzes natural language move request and drafts a validated proposal."""
    client.post("/api/generate", json={"profile_name": "BALANCED"})
    res = client.post("/api/ai/query", json={"query": "Can we move CS201 to another slot?"})
    assert res.status_code == 200
    data = res.json()
    assert "CS201" in data["reply"]
    assert data["proposal"] is not None
    assert data["proposal"]["action_type"] == "MOVE_SESSION"
    assert data["proposal"]["is_valid"] is True


def test_ai_query_explain_professor():
    """Verify AI assistant explains constraint rules for professors."""
    res = client.post("/api/ai/query", json={"query": "Why is Dr. Alan Turing restricted?"})
    assert res.status_code == 200
    data = res.json()
    assert "Alan Turing" in data["reply"]
    assert "CON-H-007" in data["reply"]

