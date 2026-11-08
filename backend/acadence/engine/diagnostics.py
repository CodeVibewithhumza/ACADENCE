"""Infeasibility Diagnostics and Pre-solve Bottleneck Analyzer.
Follows Section 13 (Pre-solve counting, Hall-style checks, Suggested Relaxations).
"""
from dataclasses import dataclass, field
from typing import Dict, List, Set
from acadence.domain.snapshot import ConfigSnapshot


@dataclass
class Bottleneck:
    category: str  # 'GROUP_CAPACITY', 'FACULTY_SUPPLY', 'ROOM_SUPPLY'
    entity_id: str
    entity_name: str
    demand: int
    supply: int
    deficit: int
    message: str


@dataclass
class SuggestedRelaxation:
    action_type: str  # 'ADD_ROOM', 'RELEASE_FACULTY_SLOTS', 'EXPAND_FACULTY_POOL', 'REDUCE_HOURS'
    entity_id: str
    description: str
    academic_impact: str  # 'LOW', 'MEDIUM', 'HIGH'


@dataclass
class DiagnosticReport:
    is_feasible: bool
    summary: str
    bottlenecks: List[Bottleneck] = field(default_factory=list)
    suggested_relaxations: List[SuggestedRelaxation] = field(default_factory=list)


def run_diagnostics(snapshot: ConfigSnapshot) -> DiagnosticReport:
    """Runs deterministic counting and capacity checks to find obvious bottlenecks."""
    grid = snapshot.time_grid
    total_teachable_slots = sum(1 for s in grid.slots if s.is_teachable)
    bottlenecks: List[Bottleneck] = []
    relaxations: List[SuggestedRelaxation] = []

    # 1. Group teaching load vs teachable slots
    group_hours: Dict[str, int] = {g.group_id: 0 for g in snapshot.student_groups}
    for req in snapshot.requirements:
        hours = req.sessions_per_week * req.duration_slots
        for gid in req.group_ids:
            if gid in group_hours:
                group_hours[gid] += hours

    for g in snapshot.student_groups:
        demand = group_hours.get(g.group_id, 0)
        if demand > total_teachable_slots:
            deficit = demand - total_teachable_slots
            bottlenecks.append(
                Bottleneck(
                    category="GROUP_CAPACITY",
                    entity_id=g.group_id,
                    entity_name=g.name,
                    demand=demand,
                    supply=total_teachable_slots,
                    deficit=deficit,
                    message=f"Group {g.name} demands {demand} teaching slots, exceeding total grid capacity of {total_teachable_slots}.",
                )
            )
            relaxations.append(
                SuggestedRelaxation(
                    action_type="REDUCE_HOURS",
                    entity_id=g.group_id,
                    description=f"Reduce {deficit} session hours from group courses.",
                    academic_impact="HIGH",
                )
            )

    # 2. Faculty Supply vs Exclusively Assigned Demand
    fac_unavail = {f.faculty_id: set(f.unavailable_slots) for f in snapshot.faculty}
    fac_demand: Dict[str, int] = {f.faculty_id: 0 for f in snapshot.faculty}

    for req in snapshot.requirements:
        hours = req.sessions_per_week * req.duration_slots
        # If pre-assigned or only 1 eligible faculty
        candidates = req.pre_assigned_faculty_ids or req.eligible_faculty_ids
        if len(candidates) == 1:
            fac_id = candidates[0]
            if fac_id in fac_demand:
                fac_demand[fac_id] += hours

    for fac in snapshot.faculty:
        f_id = fac.faculty_id
        demand = fac_demand.get(f_id, 0)
        unavail_count = len(fac_unavail.get(f_id, set()))
        supply = total_teachable_slots - unavail_count
        if demand > supply:
            deficit = demand - supply
            bottlenecks.append(
                Bottleneck(
                    category="FACULTY_SUPPLY",
                    entity_id=f_id,
                    entity_name=fac.name,
                    demand=demand,
                    supply=supply,
                    deficit=deficit,
                    message=f"Faculty {fac.name} is exclusively assigned {demand} slots, but is only available for {supply} slots.",
                )
            )
            relaxations.append(
                SuggestedRelaxation(
                    action_type="RELEASE_FACULTY_SLOTS",
                    entity_id=f_id,
                    description=f"Unblock at least {deficit} unavailable time slots for {fac.name}.",
                    academic_impact="LOW",
                )
            )
            relaxations.append(
                SuggestedRelaxation(
                    action_type="EXPAND_FACULTY_POOL",
                    entity_id=f_id,
                    description=f"Add co-teachers or eligible substitute faculty for courses assigned to {fac.name}.",
                    academic_impact="MEDIUM",
                )
            )

    # 3. Room Type Supply vs Demand
    room_types: Dict[str, int] = {}
    for r in snapshot.rooms:
        room_types[r.room_type_id] = room_types.get(r.room_type_id, 0) + total_teachable_slots

    req_room_demand: Dict[str, int] = {}
    for req in snapshot.requirements:
        if req.room_required and req.room_type_id:
            hours = req.sessions_per_week * req.duration_slots
            req_room_demand[req.room_type_id] = req_room_demand.get(req.room_type_id, 0) + hours

    for r_type, demand in req_room_demand.items():
        supply = room_types.get(r_type, 0)
        if demand > supply:
            deficit = demand - supply
            bottlenecks.append(
                Bottleneck(
                    category="ROOM_SUPPLY",
                    entity_id=r_type,
                    entity_name=r_type,
                    demand=demand,
                    supply=supply,
                    deficit=deficit,
                    message=f"Total room demand for {r_type} ({demand} slots) exceeds total room supply ({supply} slots).",
                )
            )
            relaxations.append(
                SuggestedRelaxation(
                    action_type="ADD_ROOM",
                    entity_id=r_type,
                    description=f"Add at least 1 additional room of type {r_type}.",
                    academic_impact="MEDIUM",
                )
            )

    is_feasible = len(bottlenecks) == 0
    summary = (
        "No algebraic capacity bottlenecks detected. Grid capacity, faculty supply, and room inventory are sufficient."
        if is_feasible
        else f"Detected {len(bottlenecks)} severe capacity bottleneck(s). Solve will be infeasible without adjustments."
    )

    return DiagnosticReport(
        is_feasible=is_feasible,
        summary=summary,
        bottlenecks=bottlenecks,
        suggested_relaxations=relaxations,
    )

