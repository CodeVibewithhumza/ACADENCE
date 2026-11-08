"""Synthetic reference institution generator for Tier S workloads.
Follows Section 22.1 and Section 30.9 specifications.
"""
from typing import List, Set
from acadence.domain.snapshot import (
    ConfigSnapshot,
    TimeGrid,
    TimeSlot,
    StudentGroup,
    Room,
    Faculty,
    SessionRequirement,
)


def generate_tier_s_snapshot(seed: int = 1) -> ConfigSnapshot:
    """Generates a complete, realistic Tier S benchmark institution snapshot."""
    # 1. 5-day time grid with 8 periods per day (40 slots total)
    # Lunch break after period 3 (0-indexed: period 3 has break_after=True)
    num_days = 5
    periods_per_day = 8
    slots: List[TimeSlot] = []

    for d in range(num_days):
        for p in range(periods_per_day):
            g_idx = d * periods_per_day + p
            is_break = (p == 3)  # Lunch break after period 3
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
        grid_id="GRID_SEM1",
        name="Standard 5-day 8-period Grid",
        num_days=num_days,
        periods_per_day=periods_per_day,
        slots=slots,
    )

    # 2. Student Groups hierarchy:
    # Root: CS_Y2 (100)
    #   ├── SEC_A (50)
    #   │   ├── BATCH_A1 (25)
    #   │   └── BATCH_A2 (25)
    #   └── SEC_B (50)
    #       ├── BATCH_B1 (25)
    #       └── BATCH_B2 (25)
    student_groups = [
        StudentGroup(group_id="GRP_CS_Y2", name="B.Tech CS Year 2", expected_strength=100),
        StudentGroup(group_id="GRP_SEC_A", name="Section A", parent_id="GRP_CS_Y2", expected_strength=50),
        StudentGroup(group_id="GRP_SEC_B", name="Section B", parent_id="GRP_CS_Y2", expected_strength=50),
        StudentGroup(group_id="GRP_BATCH_A1", name="Batch A1", parent_id="GRP_SEC_A", expected_strength=25),
        StudentGroup(group_id="GRP_BATCH_A2", name="Batch A2", parent_id="GRP_SEC_A", expected_strength=25),
        StudentGroup(group_id="GRP_BATCH_B1", name="Batch B1", parent_id="GRP_SEC_B", expected_strength=25),
        StudentGroup(group_id="GRP_BATCH_B2", name="Batch B2", parent_id="GRP_SEC_B", expected_strength=25),
    ]

    # 3. Rooms
    # 4 Lecture Halls (capacity 60)
    # 4 Computer Labs (capacity 30, with 'COMPUTERS' feature)
    rooms = [
        Room(room_id="LH_101", name="Lecture Hall 101", room_type_id="LECTURE_HALL", capacity=60),
        Room(room_id="LH_102", name="Lecture Hall 102", room_type_id="LECTURE_HALL", capacity=60),
        Room(room_id="LH_103", name="Lecture Hall 103", room_type_id="LECTURE_HALL", capacity=60),
        Room(room_id="LH_104", name="Lecture Hall 104", room_type_id="LECTURE_HALL", capacity=60),
        Room(room_id="LAB_201", name="Computing Lab 1", room_type_id="COMPUTER_LAB", capacity=30, features={"COMPUTERS"}),
        Room(room_id="LAB_202", name="Computing Lab 2", room_type_id="COMPUTER_LAB", capacity=30, features={"COMPUTERS"}),
        Room(room_id="LAB_203", name="Computing Lab 3", room_type_id="COMPUTER_LAB", capacity=30, features={"COMPUTERS"}),
        Room(room_id="LAB_204", name="Computing Lab 4", room_type_id="COMPUTER_LAB", capacity=30, features={"COMPUTERS"}),
    ]

    # 4. Faculty (12 members)
    # Give some realistic unavailable slots to test CON-H-007
    faculty = [
        Faculty(faculty_id="FAC_01", name="Dr. Alan Turing", department_id="CSE", unavailable_slots={0, 1}),  # Mon morning
        Faculty(faculty_id="FAC_02", name="Dr. Ada Lovelace", department_id="CSE"),
        Faculty(faculty_id="FAC_03", name="Dr. John von Neumann", department_id="CSE", unavailable_slots={38, 39}),  # Fri afternoon
        Faculty(faculty_id="FAC_04", name="Dr. Grace Hopper", department_id="CSE"),
        Faculty(faculty_id="FAC_05", name="Dr. Claude Shannon", department_id="CSE"),
        Faculty(faculty_id="FAC_06", name="Dr. Donald Knuth", department_id="CSE"),
        Faculty(faculty_id="FAC_07", name="Dr. Edsger Dijkstra", department_id="CSE"),
        Faculty(faculty_id="FAC_08", name="Dr. Barbara Liskov", department_id="CSE"),
        Faculty(faculty_id="FAC_09", name="Dr. Leslie Lamport", department_id="CSE"),
        Faculty(faculty_id="FAC_10", name="Dr. Tim Berners-Lee", department_id="CSE"),
        Faculty(faculty_id="FAC_11", name="Dr. Dennis Ritchie", department_id="CSE"),
        Faculty(faculty_id="FAC_12", name="Dr. Ken Thompson", department_id="CSE"),
    ]

    # 5. Courses & Requirements
    # 4 Courses: CS201 (DS), CS202 (DBMS), CS203 (CN), CS204 (Math)
    # Theory lectures go to Sections A & B (duration 1)
    # Labs go to Batches A1, A2, B1, B2 (duration 2)
    requirements: List[SessionRequirement] = []

    courses = [
        ("CS201", "Data Structures", ["FAC_01", "FAC_02"]),
        ("CS202", "Database Systems", ["FAC_03", "FAC_04"]),
        ("CS203", "Computer Networks", ["FAC_05", "FAC_06"]),
        ("CS204", "Discrete Mathematics", ["FAC_07", "FAC_08"]),
    ]

    for code, name, fac_pair in courses:
        # Section A Theory: 3 sessions/week
        requirements.append(
            SessionRequirement(
                requirement_id=f"REQ_{code}_SEC_A_TH",
                course_id=code,
                course_name=name,
                offering_id=f"OFF_{code}_A",
                group_ids=["GRP_SEC_A"],
                session_type="LECTURE",
                sessions_per_week=3,
                duration_slots=1,
                room_type_id="LECTURE_HALL",
                eligible_faculty_ids=fac_pair,
            )
        )
        # Section B Theory: 3 sessions/week
        requirements.append(
            SessionRequirement(
                requirement_id=f"REQ_{code}_SEC_B_TH",
                course_id=code,
                course_name=name,
                offering_id=f"OFF_{code}_B",
                group_ids=["GRP_SEC_B"],
                session_type="LECTURE",
                sessions_per_week=3,
                duration_slots=1,
                room_type_id="LECTURE_HALL",
                eligible_faculty_ids=fac_pair,
            )
        )

        # For CS201, CS202, CS203: Lab session (duration 2) for each batch
        if code != "CS204":
            for sec, batches in [("A", ["A1", "A2"]), ("B", ["B1", "B2"])]:
                for b in batches:
                    requirements.append(
                        SessionRequirement(
                            requirement_id=f"REQ_{code}_LAB_{b}",
                            course_id=code,
                            course_name=f"{name} Lab",
                            offering_id=f"OFF_{code}_{sec}",
                            group_ids=[f"GRP_BATCH_{b}"],
                            session_type="PRACTICAL",
                            sessions_per_week=1,
                            duration_slots=2,  # 2-period lab block
                            room_type_id="COMPUTER_LAB",
                            required_features={"COMPUTERS"},
                            eligible_faculty_ids=fac_pair + ["FAC_09", "FAC_10", "FAC_11", "FAC_12"],
                        )
                    )

    return ConfigSnapshot(
        snapshot_id=f"SNAPSHOT_TIER_S_{seed}",
        institution_id="INST_DEMO",
        term_id="TERM_FALL_2026",
        time_grid=grid,
        student_groups=student_groups,
        rooms=rooms,
        faculty=faculty,
        requirements=requirements,
    )

