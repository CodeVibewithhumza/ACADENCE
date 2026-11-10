"""Integration tests for the Acadence FastAPI Web Service.
Verifies health, snapshot retrieval, generation, valid-targets, and live move delta-validation.
"""
from fastapi.testclient import TestClient
from acadence.api.app import app

client = TestClient(app)


def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "snapshot_hash" in data


def test_api_snapshot():
    response = client.get("/api/snapshot")
    assert response.status_code == 200
    data = response.json()
    assert data["institution_id"] in ("INST_JK_HE_25091", "INST_DEMO")
    assert len(data["student_groups"]) >= 6


def test_api_generate_and_get_timetable():
    response = client.post("/api/generate", json={"profile_name": "BALANCED", "time_limit_seconds": 15.0})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("OPTIMAL", "FEASIBLE")
    assert data["validation"]["is_valid"] is True
    assert len(data["placements"]) >= 30
    assert data["metrics"]["distribution_excess"] == 0

    # Test GET current timetable
    get_res = client.get("/api/timetable")
    assert get_res.status_code == 200
    assert len(get_res.json()["placements"]) >= 30


def test_api_valid_targets_and_live_move():
    # Fetch first placement
    res = client.get("/api/timetable")
    placements = res.json()["placements"]
    first_inst = placements[0]["instance_id"]
    current_slot = placements[0]["start_slot"]

    # Compute valid targets
    target_res = client.get(f"/api/timetable/valid-targets/{first_inst}")
    assert target_res.status_code == 200
    valid_slots = target_res.json()["valid_target_slots"]
    assert isinstance(valid_slots, list)

    # Find an alternative valid slot that is not the current slot
    alt_slots = [s for s in valid_slots if s != current_slot]
    if alt_slots:
        target_slot = alt_slots[0]
        # Attempt valid move
        move_res = client.post(
            "/api/timetable/move",
            json={"instance_id": first_inst, "new_start_slot": target_slot},
        )
        assert move_res.status_code == 200
        move_data = move_res.json()
        assert move_data["success"] is True
        assert move_data["validation"]["is_valid"] is True


def test_api_export_templates_and_ams():
    """Verify template CSV downloads and AMS JSON export."""
    t_courses = client.get("/api/export/template/courses")
    assert t_courses.status_code == 200
    assert "course_id" in t_courses.text

    t_faculty = client.get("/api/export/template/faculty")
    assert t_faculty.status_code == 200
    assert "faculty_id" in t_faculty.text

    t_rooms = client.get("/api/export/template/rooms")
    assert t_rooms.status_code == 200
    assert "room_id" in t_rooms.text

    ams_res = client.get("/api/export/ams-json")
    assert ams_res.status_code == 200
    data = ams_res.json()
    assert data["problem_statement_id"] == "25091"
    assert len(data["schedule"]) > 0


def test_api_scenario_simulation():
    """Verify dynamic scenario simulation of unexpected faculty absence."""
    sim_res = client.post("/api/simulate-scenario", json={
        "scenario_type": "FACULTY_ABSENCE",
        "entity_id": "FAC_CS_01",
    })
    assert sim_res.status_code == 200
    data = sim_res.json()
    assert data["success"] is True
    assert "Dr. Alan Turing" in data["message"] or "Emergency" in data["scenario"]
    assert data["validation"]["is_valid"] is True

    # Reset
    reset_res = client.post("/api/simulate-scenario", json={"scenario_type": "RESET"})
    assert reset_res.status_code == 200

