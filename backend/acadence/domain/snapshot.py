"""Immutable configuration snapshot models for Acadence.
Follows DATA-039 and Section 7.4 / Section 10.3 specifications.
"""
from __future__ import annotations
import hashlib
import json
from typing import List, Optional, Set
from pydantic import BaseModel, Field


class TimeSlot(BaseModel):
    """Single period slot in a term time-grid."""
    slot_id: str
    day: int  # 0 to num_days - 1
    period: int  # 0 to periods_per_day - 1
    global_index: int  # day * periods_per_day + period
    is_teachable: bool = True
    break_after: bool = False  # e.g., lunch break or tea break after this slot

    model_config = {"frozen": True}


class TimeGrid(BaseModel):
    """Grid header and slot layout for a term (ADR-006)."""
    grid_id: str
    name: str
    num_days: int = 5  # e.g. Mon-Fri
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

    model_config = {"frozen": True}


class Room(BaseModel):
    """Physical lecture hall or laboratory (DATA-024)."""
    room_id: str
    name: str
    room_type_id: str  # e.g., 'LECTURE_HALL', 'COMPUTER_LAB'
    capacity: int
    features: Set[str] = Field(default_factory=set)

    model_config = {"frozen": True}


class Faculty(BaseModel):
    """Teaching faculty member (DATA-019)."""
    faculty_id: str
    name: str
    department_id: str
    max_hours_week: int = 40
    max_hours_day: int = 8
    unavailable_slots: Set[int] = Field(default_factory=set)  # global slot indices

    model_config = {"frozen": True}


class RoomAvailability(BaseModel):
    """Unavailability windows for rooms (DATA-025)."""
    room_id: str
    unavailable_slots: Set[int] = Field(default_factory=set)

    model_config = {"frozen": True}


class SessionRequirement(BaseModel):
    """Teaching pattern requirement for a course offering (DATA-018 / Section 7.3)."""
    requirement_id: str
    course_id: str
    course_name: str
    offering_id: str
    group_ids: List[str]  # Student groups that attend this session
    session_type: str  # 'LECTURE', 'TUTORIAL', 'PRACTICAL'
    sessions_per_week: int = 1
    duration_slots: int = 1  # 1 for lecture, 2 or 3 for practicals
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


class ConfigSnapshot(BaseModel):
    """Frozen, immutable configuration snapshot (DATA-039)."""
    snapshot_id: str
    institution_id: str
    term_id: str
    time_grid: TimeGrid
    student_groups: List[StudentGroup]
    rooms: List[Room]
    faculty: List[Faculty]
    requirements: List[SessionRequirement]
    room_unavailability: List[RoomAvailability] = Field(default_factory=list)

    model_config = {"frozen": True}

    def compute_hash(self) -> str:
        """Computes deterministic SHA-256 hash of the snapshot content."""
        data_str = self.model_dump_json(exclude={"snapshot_id"})
        return hashlib.sha256(data_str.encode("utf-8")).hexdigest()

