"""Tests for Course Cohort & Collision-Free Room Auto-Allocation Engine.
Verifies multi-room calculation when student enrollment > single room capacity,
subject-to-course matching, parallel section creation, and zero room/cohort clashes.
"""
import pytest
from fastapi.testclient import TestClient
from acadence.api.app import app, state


@pytest.fixture
def client():
    return TestClient(app)


def test_get_courses_cohorts(client):
    """Verifies that GET /api/courses returns pre-seeded cohorts with correct room allocation."""
    response = client.get("/api/courses")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["courses"]) == 4
    
    # B.Tech 1st Year has 140 students > 75 cap, so requires 2 rooms
    btech_y1 = next(c for c in data["courses"] if c["course_id"] == "BTECH_Y1")
    assert btech_y1["student_count"] == 140
    assert btech_y1["rooms_required"] == 2
    assert len(btech_y1["sections"]) == 2
    assert btech_y1["collision_free"] is True


def test_create_and_update_course_cohort(client):
    """Verifies creating a course cohort and dynamic room recalculation when student count changes."""
    # 1. Create a cohort with 60 students (fits in 1 room)
    res_create = client.post("/api/courses", json={
        "course_id": "TEST_CS_Y1",
        "course_name": "Test CS 1st Year",
        "program_id": "BTECH_CSE",
        "year": 1,
        "semester": 1,
        "department": "Computer Science",
        "student_count": 60,
        "preferred_room_type": "LECTURE_HALL",
    })
    assert res_create.status_code == 200
    c_data = res_create.json()
    assert c_data["course"]["rooms_required"] == 1

    # 2. Update student count to 150 (> 75 cap), verifying 2 rooms auto-calculated
    res_update = client.put("/api/courses/TEST_CS_Y1", json={
        "student_count": 150,
    })
    assert res_update.status_code == 200
    u_data = res_update.json()
    assert u_data["course"]["rooms_required"] == 2
    assert len(u_data["course"]["section_ids"]) == 2

    # 3. Clean up
    res_delete = client.delete("/api/courses/TEST_CS_Y1")
    assert res_delete.status_code == 200


def test_add_subject_with_course_matching(client):
    """Verifies adding a subject matched to B.Tech 1st Year auto-allots 2 rooms without overlap."""
    res = client.post("/api/courses/add-subject", json={
        "course_id": "BTECH_Y1",
        "subject_code": "EM-101",
        "subject_name": "Engineering Mathematics - 1",
        "subject_type": "THEORY",
        "credits": 4,
        "sessions_per_week": 3,
        "schedule_now": True,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["sections_count"] == 2  # 2 sections for 140 students
    assert len(data["rooms_allocated"]) == 2
    assert data["validation_is_valid"] is True
    assert data["clashes_count"] == 0


def test_room_allocations_zero_overlap_audit(client):
    """Verifies full campus room matrix audit reports 0 collisions."""
    response = client.get("/api/courses/room-allocations")
    assert response.status_code == 200
    data = response.json()
    assert data["is_all_collision_free"] is True
    assert data["total_collisions"] == 0
    assert len(data["rooms"]) >= 8
