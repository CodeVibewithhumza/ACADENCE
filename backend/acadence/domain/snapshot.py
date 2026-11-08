"""Immutable configuration snapshot models for Acadence with NEP 2020 Multidisciplinary Framework.
Follows DATA-039 and Section 7.4 / Section 10.3 / Problem Statement 25091.
"""
from __future__ import annotations
import hashlib
import json
from typing import List, Optional, Set
from pydantic import BaseModel, Field

from acadence.domain.enums import NEPCategory, ProgramType


class TimeSlot(BaseModel):
    """Single period slot in a term time-grid."""
    slot_id: str
    day: int  # 0 to num_days - 1
    period: int  # 0 to periods_per_day - 1
    global_index: int  # day * periods_per_day + period
    is_teachable: bool = True
    break_after: bool = False  # e.g., lunch break after this slot

    model_config = {"frozen": True}


class TimeGrid(BaseModel):
    """Grid header and slot layout for a term (ADR-006)."""
    grid_id: str
    name: str
    num_days: int = 5  # Mon-Fri
    periods_per_day: int = 8
    slots: List[TimeSlot] = Field(default_factory=list)

    model_config = {"frozen": True}

    def get_slot(self, global_index: int) -> Optional[TimeSlot]:
        for s in self.slots:
            if s.global_index == global_index:
                return s
        return None


class StudentGroup(BaseModel):
    """Student cohort, section, or laboratory batch (DATA-013)."""
    group_id: str
    name: str
    parent_id: Optional[str] = None  # None for root cohorts, section id for batches
    expected_strength: int = 30
    program_type: ProgramType = ProgramType.FYUP
    semester: int = 3

    model_config = {"frozen": True}


class Room(BaseModel):
    """Physical lecture hall, laboratory, or pedagogy classroom (DATA-024)."""
    room_id: str
    name: str
    room_type_id: str  # e.g., 'LECTURE_HALL', 'COMPUTER_LAB', 'SCIENCE_LAB', 'PEDAGOGY_ROOM'
    capacity: int
    features: Set[str] = Field(default_factory=set)

    model_config = {"frozen": True}


class Faculty(BaseModel):
    """Teaching faculty member (DATA-019)."""
    faculty_id: str
    name: str
    department_id: str  # e.g., 'COMPUTER_SCIENCE', 'EDUCATION', 'PHYSICAL_SCIENCES', 'HUMANITIES'
    designation: str = "Assistant Professor"
    max_hours_week: int = 16  # UGC / NEP 2020 workload norm (16h for Asst Prof)
    max_hours_day: int = 4
    unavailable_slots: Set[int] = Field(default_factory=set)

    model_config = {"frozen": True}


class RoomAvailability(BaseModel):
    """Unavailability windows for rooms (DATA-025)."""
    room_id: str
    unavailable_slots: Set[int] = Field(default_factory=set)

    model_config = {"frozen": True}


class SessionRequirement(BaseModel):
    """Teaching pattern requirement for a course offering under NEP 2020."""
    requirement_id: str
    course_id: str
    course_name: str
    offering_id: str
    group_ids: List[str]
    session_type: str  # 'LECTURE', 'TUTORIAL', 'PRACTICAL', 'FIELD_WORK', 'SCHOOL_INTERNSHIP'
    nep_category: NEPCategory = NEPCategory.MAJOR
    credits: int = 4
    program_type: ProgramType = ProgramType.FYUP
    sessions_per_week: int = 1
    duration_slots: int = 1  # 1 for theory, 2 for practicals / internships
    room_type_id: Optional[str] = None
    room_required: bool = True
    required_features: Set[str] = Field(default_factory=set)
    faculty_count: int = 1
    pre_assigned_faculty_ids: List[str] = Field(default_factory=list)
    eligible_faculty_ids: List[str] = Field(default_factory=list)

    model_config = {"frozen": True}


class Placement(BaseModel):
    """Assigned placement for a single session instance (DATA-048)."""
    instance_id: str
    requirement_id: str
    start_slot: int  # global slot index
    duration_slots: int
    day: int
    period: int
    assigned_faculty_ids: List[str] = Field(default_factory=list)
    assigned_room_id: Optional[str] = None

    model_config = {"frozen": True}


class ElectiveGroup(BaseModel):
    """Multidisciplinary elective basket (Minor, SEC, VAC) with parallel alignment (DATA-032)."""
    elective_group_id: str
    name: str
    mode: str = "PARALLEL"  # 'PARALLEL' (CON-H-011) or 'INDEPENDENT'
    nep_category: NEPCategory = NEPCategory.MINOR
    member_requirement_ids: List[str] = Field(default_factory=list)
    attached_group_ids: List[str] = Field(default_factory=list)

    model_config = {"frozen": True}


class CourseRelationship(BaseModel):
    """Pairwise relationship between course offerings (DATA-034 / CON-H-012)."""
    relationship_id: str
    requirement_id_a: str
    requirement_id_b: str
    relationship_type: str = "CANNOT_OVERLAP"  # 'CANNOT_OVERLAP' or 'ALLOW_OVERLAP'

    model_config = {"frozen": True}


class ConfigSnapshot(BaseModel):
    """Frozen, immutable configuration snapshot (DATA-039)."""
    snapshot_id: str
    institution_id: str
    institution_name: str = "Govt. College of Education & Multidisciplinary Studies, J&K"
    state_or_ut: str = "Jammu and Kashmir"
    problem_statement_id: str = "25091"
    term_id: str
    time_grid: TimeGrid
    student_groups: List[StudentGroup]
    rooms: List[Room]
    faculty: List[Faculty]
    requirements: List[SessionRequirement]
    room_unavailability: List[RoomAvailability] = Field(default_factory=list)
    elective_groups: List[ElectiveGroup] = Field(default_factory=list)
    course_relationships: List[CourseRelationship] = Field(default_factory=list)

    model_config = {"frozen": True}

    def compute_hash(self) -> str:
        """Computes deterministic SHA-256 hash of the snapshot content."""
        data_str = self.model_dump_json(exclude={"snapshot_id"})
        return hashlib.sha256(data_str.encode("utf-8")).hexdigest()
