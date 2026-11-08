"""Objective profiles and metric definitions for Acadence.
Follows Section 10.6, Section 10.7, and Section 11 specifications.
"""
from __future__ import annotations
from typing import Dict
from pydantic import BaseModel, Field


class ObjectiveProfile(BaseModel):
    """Configuration for soft constraint optimization weights."""
    name: str
    weights: Dict[str, int] = Field(default_factory=dict)
    description: str = ""

    model_config = {"frozen": True}


class MetricReport(BaseModel):
    """Raw and normalized metrics computed on a timetable version."""
    faculty_gaps: int = 0  # CON-S-003: total faculty idle gap periods
    student_gaps: int = 0  # CON-S-004: total student group idle gap periods
    room_capacity_waste: int = 0  # CON-S-005: total seat capacity waste
    distribution_excess: int = 0  # CON-S-008: sessions on same day > 1 for same requirement
    peak_daily_load: int = 0  # CON-S-002: sum of peak day loads across faculty
    rooms_used: int = 0  # CON-S-007: number of distinct rooms utilized
    composite_score: int = 0  # Weighted objective value (lower is better)

    model_config = {"frozen": True}


# Seeded Profiles per Table in Section 11.1
SEEDED_PROFILES: Dict[str, ObjectiveProfile] = {
    "BALANCED": ObjectiveProfile(
        name="Balanced",
        description="Even trade-off across faculty comfort, student compactness, and space utilization.",
        weights={
            "CON-S-003": 4,  # faculty gaps
            "CON-S-004": 4,  # group gaps
            "CON-S-005": 2,  # room waste
            "CON-S-008": 5,  # session distribution
            "CON-S-002": 2,  # peak day load
        },
    ),
    "FACULTY_FRIENDLY": ObjectiveProfile(
        name="Faculty-Friendly",
        description="Prioritizes faculty comfort: minimal idle gaps between classes and balanced daily load.",
        weights={
            "CON-S-003": 8,  # faculty gaps (heavy)
            "CON-S-002": 4,  # peak day load
            "CON-S-004": 1,  # group gaps
            "CON-S-005": 0,  # room waste
            "CON-S-008": 2,  # session distribution
        },
    ),
    "STUDENT_FRIENDLY": ObjectiveProfile(
        name="Student-Friendly",
        description="Prioritizes student experience: zero student waiting gaps and spread-out lecture days.",
        weights={
            "CON-S-003": 1,  # faculty gaps
            "CON-S-004": 8,  # group gaps (heavy)
            "CON-S-005": 0,  # room waste
            "CON-S-008": 8,  # session distribution (heavy: spread courses evenly)
            "CON-S-002": 0,  # peak day load
        },
    ),
    "SPACE_EFFICIENT": ObjectiveProfile(
        name="Space-Efficient",
        description="Minimizes empty seats and consolidates room usage.",
        weights={
            "CON-S-003": 1,
            "CON-S-004": 1,
            "CON-S-005": 8,  # room waste (heavy)
            "CON-S-008": 2,
            "CON-S-002": 1,
        },
    ),
}

