"""Live Delta-Validation and Valid-Targets engine for interactive timetable editing.
Follows Section 12 (Timetable Editing, Drag-and-Drop, Live Incremental Validation).
"""
from typing import List, Optional, Set
from acadence.domain.enums import ValidationStatus
from acadence.domain.snapshot import ConfigSnapshot, Placement
from acadence.validator.report import ValidationReport
from acadence.validator.validator import validate


def apply_move(
    snapshot: ConfigSnapshot,
    current_placements: List[Placement],
    instance_id: str,
    new_start_slot: int,
    new_room_id: Optional[str] = None,
    new_faculty_ids: Optional[List[str]] = None,
) -> tuple[bool, List[Placement], ValidationReport]:
    """Applies a candidate move and validates it against the independent validator oracle."""
    # Find target placement
    target_idx = -1
    for idx, p in enumerate(current_placements):
        if p.instance_id == instance_id:
            target_idx = idx
            break

    if target_idx == -1:
        empty_report = ValidationReport(
            status=ValidationStatus.INVALID,
            violations=[],
        )
        return False, current_placements, empty_report

    old_placement = current_placements[target_idx]
    grid = snapshot.time_grid
    periods_per_day = grid.periods_per_day
    new_day = new_start_slot // periods_per_day
    new_period = new_start_slot % periods_per_day

    updated_placement = old_placement.model_copy(
        update={
            "start_slot": new_start_slot,
            "day": new_day,
            "period": new_period,
            "assigned_room_id": new_room_id if new_room_id is not None else old_placement.assigned_room_id,
            "assigned_faculty_ids": new_faculty_ids if new_faculty_ids is not None else old_placement.assigned_faculty_ids,
        }
    )

    candidate_placements = [p.model_copy() for p in current_placements]
    candidate_placements[target_idx] = updated_placement

    report = validate(snapshot, candidate_placements)
    return report.is_valid, candidate_placements, report


def compute_valid_targets(
    snapshot: ConfigSnapshot,
    current_placements: List[Placement],
    instance_id: str,
) -> List[int]:
    """Computes all clash-free target start slots for an instance in sub-second time.
    Used by the UI to highlight valid drop zones during drag-and-drop.
    """
    target = next((p for p in current_placements if p.instance_id == instance_id), None)
    if not target:
        return []

    req = next((r for r in snapshot.requirements if r.requirement_id == target.requirement_id), None)
    if not req:
        return []

    # Filter out other placements
    other_placements = [p for p in current_placements if p.instance_id != instance_id]

    # Pre-index occupancy of other placements
    grid = snapshot.time_grid
    periods_per_day = grid.periods_per_day
    num_days = grid.num_days
    slot_map = {s.global_index: s for s in grid.slots}
    d = req.duration_slots

    # Build leaf paths
    parent_map = {g.group_id: g.parent_id for g in snapshot.student_groups}
    req_map = {r.requirement_id: r for r in snapshot.requirements}

    def get_path(gid: str) -> Set[str]:
        path = set()
        curr = gid
        while curr:
            path.add(curr)
            curr = parent_map.get(curr)
        return path

    req_groups_path = set()
    for gid in req.group_ids:
        req_groups_path.update(get_path(gid))

    # Precompute busy slots for target's faculty, room, and cohort
    target_faculty = set(target.assigned_faculty_ids)
    target_room = target.assigned_room_id

    faculty_busy_slots: Set[int] = set()
    room_busy_slots: Set[int] = set()
    group_busy_slots: Set[int] = set()

    for p in other_placements:
        # Check faculty overlap
        if set(p.assigned_faculty_ids) & target_faculty:
            for step in range(p.duration_slots):
                faculty_busy_slots.add(p.start_slot + step)
        # Check room overlap
        if target_room and p.assigned_room_id == target_room:
            for step in range(p.duration_slots):
                room_busy_slots.add(p.start_slot + step)
        # Check group overlap
        p_req = req_map.get(p.requirement_id)
        if p_req:
            p_groups_path = set()
            for gid in p_req.group_ids:
                p_groups_path.update(get_path(gid))
            if req_groups_path & p_groups_path:
                for step in range(p.duration_slots):
                    group_busy_slots.add(p.start_slot + step)

    # Faculty unavailability
    fac_unavail: Set[int] = set()
    for f_id in target.assigned_faculty_ids:
        fac = next((f for f in snapshot.faculty if f.faculty_id == f_id), None)
        if fac:
            fac_unavail.update(fac.unavailable_slots)

    # Room unavailability
    rm_unavail: Set[int] = set()
    if target_room:
        for ru in snapshot.room_unavailability:
            if ru.room_id == target_room:
                rm_unavail.update(ru.unavailable_slots)

    valid_targets: List[int] = []

    # Check each potential start slot in the grid
    for day in range(num_days):
        for period in range(periods_per_day):
            s = day * periods_per_day + period
            if period + d > periods_per_day:
                continue

            # Check consecutive slots exist, are teachable, and have no breaks
            valid_span = True
            for step in range(d):
                slot_idx = s + step
                slot = slot_map.get(slot_idx)
                if not slot or not slot.is_teachable or slot.day != day:
                    valid_span = False
                    break
                if step < d - 1 and slot.break_after:
                    valid_span = False
                    break
                if slot_idx in faculty_busy_slots or slot_idx in fac_unavail:
                    valid_span = False
                    break
                if slot_idx in room_busy_slots or slot_idx in rm_unavail:
                    valid_span = False
                    break
                if slot_idx in group_busy_slots:
                    valid_span = False
                    break

            if valid_span:
                valid_targets.append(s)

    return valid_targets

