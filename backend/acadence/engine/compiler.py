"""Compiler for turning a ConfigSnapshot into CP-SAT mathematical sets and parameters.
Follows Section 10.3 and Section 7.3 specifications.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Set
from acadence.domain.snapshot import ConfigSnapshot, SessionRequirement


@dataclass(frozen=True)
class SessionInstance:
    """An individual schedulable session unit (expanded from SessionRequirement)."""
    instance_id: str
    requirement_id: str
    duration_slots: int
    valid_starts: List[int]  # S_i
    audience_group_ids: List[str]  # \Gamma_i
    expected_strength: int
    eligible_faculty_ids: List[str]  # F_i
    faculty_count: int
    room_required: bool
    eligible_room_ids: List[str]  # R_i


@dataclass
class CompiledModelInput:
    """Compiled domain data ready for the CP-SAT solver."""
    instances: List[SessionInstance]
    leaf_paths: Dict[str, Set[str]]  # leaf_group_id -> set of group_ids in path(leaf)
    faculty_unavailability: Dict[str, Set[int]]  # faculty_id -> set of unavailable slots
    room_unavailability: Dict[str, Set[int]]  # room_id -> set of unavailable slots
    slots_by_index: Dict[int, int]  # slot index -> day


def compile_snapshot(snapshot: ConfigSnapshot) -> CompiledModelInput:
    """Compiles a frozen snapshot into decision sets and domains."""
    grid = snapshot.time_grid
    num_days = grid.num_days
    periods_per_day = grid.periods_per_day

    # Index slots
    slot_map = {s.global_index: s for s in grid.slots}
    slots_by_day: Dict[int, List[int]] = {d: [] for d in range(num_days)}
    for s in grid.slots:
        slots_by_day[s.day].append(s.global_index)

    # Build group hierarchy & find leaves
    all_group_ids = {g.group_id for g in snapshot.student_groups}
    parent_map = {g.group_id: g.parent_id for g in snapshot.student_groups}
    group_strength = {g.group_id: g.expected_strength for g in snapshot.student_groups}
    
    # Children map
    children: Dict[str, List[str]] = {g.group_id: [] for g in snapshot.student_groups}
    for g in snapshot.student_groups:
        if g.parent_id and g.parent_id in children:
            children[g.parent_id].append(g.group_id)

    # Leaf groups are those with no children
    leaves = [gid for gid, ch in children.items() if len(ch) == 0]
    if not leaves:
        leaves = list(all_group_ids)

    # For each leaf, compute path(l) = all ancestors up to root + leaf
    leaf_paths: Dict[str, Set[str]] = {}
    for leaf in leaves:
        curr = leaf
        path = set()
        while curr:
            path.add(curr)
            curr = parent_map.get(curr)
        leaf_paths[leaf] = path

    # Precompute resource unavailabilities
    faculty_unavailability = {
        f.faculty_id: set(f.unavailable_slots) for f in snapshot.faculty
    }
    room_unavailability: Dict[str, Set[int]] = {r.room_id: set() for r in snapshot.rooms}
    for ru in snapshot.room_unavailability:
        if ru.room_id in room_unavailability:
            room_unavailability[ru.room_id].update(ru.unavailable_slots)

    # Expand requirements into instances
    instances: List[SessionInstance] = []
    for req in snapshot.requirements:
        # Calculate audience strength
        strength = max([group_strength.get(gid, 30) for gid in req.group_ids], default=30)

        # Eligible faculty F_i
        if req.pre_assigned_faculty_ids:
            eligible_faculty = list(req.pre_assigned_faculty_ids)
        elif req.eligible_faculty_ids:
            eligible_faculty = list(req.eligible_faculty_ids)
        else:
            eligible_faculty = [f.faculty_id for f in snapshot.faculty]

        # Eligible rooms R_i
        if not req.room_required:
            eligible_rooms = []
        else:
            eligible_rooms = [
                r.room_id
                for r in snapshot.rooms
                if (req.room_type_id is None or r.room_type_id == req.room_type_id)
                and r.capacity >= strength
                and r.features.issuperset(req.required_features)
            ]

        # Compute valid start slots S_i for duration d
        d = req.duration_slots
        valid_starts = []
        for day in range(num_days):
            day_slot_indices = sorted(slots_by_day[day])
            for idx in day_slot_indices:
                # Check if idx .. idx + d - 1 fit in this day
                slot_obj = slot_map.get(idx)
                if not slot_obj or not slot_obj.is_teachable:
                    continue
                
                # Check period fits in day
                p = slot_obj.period
                if p + d > periods_per_day:
                    continue

                # Check all consecutive slots exist, are teachable, and have no break_after in between
                valid = True
                for step in range(d):
                    cur_slot = slot_map.get(idx + step)
                    if not cur_slot or not cur_slot.is_teachable:
                        valid = False
                        break
                    if step < d - 1 and cur_slot.break_after:
                        # Cannot span across break
                        valid = False
                        break
                if valid:
                    valid_starts.append(idx)

        # Generate n instances
        for k in range(1, req.sessions_per_week + 1):
            instance_id = f"{req.requirement_id}-{k}"
            instances.append(
                SessionInstance(
                    instance_id=instance_id,
                    requirement_id=req.requirement_id,
                    duration_slots=d,
                    valid_starts=valid_starts,
                    audience_group_ids=list(req.group_ids),
                    expected_strength=strength,
                    eligible_faculty_ids=eligible_faculty,
                    faculty_count=req.faculty_count,
                    room_required=req.room_required,
                    eligible_room_ids=eligible_rooms,
                )
            )

    slots_by_index = {s.global_index: s.day for s in grid.slots}
    return CompiledModelInput(
        instances=instances,
        leaf_paths=leaf_paths,
        faculty_unavailability=faculty_unavailability,
        room_unavailability=room_unavailability,
        slots_by_index=slots_by_index,
    )

