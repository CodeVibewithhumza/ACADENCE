"""Independent timetable validator for Acadence (VAL-001 to VAL-008).
Shares ZERO solver code per ADR-008 and Section 10.12.
Uses independent data derivation and sweep-line slot occupancy checks.
"""
from __future__ import annotations
from collections import defaultdict
from typing import Dict, List, Set
from acadence.domain.enums import ValidationStatus
from acadence.domain.snapshot import ConfigSnapshot, Placement
from acadence.validator.report import ValidationReport, ValidationViolation



def validate(
    snapshot: ConfigSnapshot,
    placements: List[Placement],
) -> ValidationReport:
    """Independently verifies timetable placements against domain constraints."""
    violations: List[ValidationViolation] = []

    grid = snapshot.time_grid
    num_days = grid.num_days
    periods_per_day = grid.periods_per_day
    slot_map = {s.global_index: s for s in grid.slots}
    req_map = {r.requirement_id: r for r in snapshot.requirements}
    room_map = {r.room_id: r for r in snapshot.rooms}
    faculty_map = {f.faculty_id: f for f in snapshot.faculty}
    group_strength = {g.group_id: g.expected_strength for g in snapshot.student_groups}

    # 1. Independent instance derivation & VAL-001 (Completeness & Valid Starts)
    expected_instance_ids = set()
    for req in snapshot.requirements:
        for k in range(1, req.sessions_per_week + 1):
            expected_instance_ids.add(f"{req.requirement_id}-{k}")

    placed_instance_ids = set()
    for p in placements:
        placed_instance_ids.add(p.instance_id)

    # Check for missing instances
    missing = expected_instance_ids - placed_instance_ids
    for m in missing:
        violations.append(
            ValidationViolation(
                check_id="VAL-001",
                entity_type="INSTANCE",
                entity_id=m,
                message=f"Missing session instance: {m} was not scheduled.",
            )
        )

    # Check for duplicate placements
    if len(placed_instance_ids) < len(placements):
        seen = set()
        for p in placements:
            if p.instance_id in seen:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-001",
                        entity_type="INSTANCE",
                        entity_id=p.instance_id,
                        message=f"Duplicate placement for session instance: {p.instance_id}.",
                    )
                )
            seen.add(p.instance_id)

    # 2. Check each placement's start, duration, eligibility, and availability
    for p in placements:
        req = req_map.get(p.requirement_id)
        if not req:
            violations.append(
                ValidationViolation(
                    check_id="VAL-001",
                    entity_type="INSTANCE",
                    entity_id=p.instance_id,
                    message=f"Unknown requirement_id {p.requirement_id}.",
                )
            )
            continue

        d = req.duration_slots
        start = p.start_slot

        # Independent check: is start slot within the grid?
        start_slot = slot_map.get(start)
        if not start_slot or not start_slot.is_teachable:
            violations.append(
                ValidationViolation(
                    check_id="VAL-001",
                    entity_type="INSTANCE",
                    entity_id=p.instance_id,
                    slot_index=start,
                    message=f"Start slot {start} is invalid or non-teachable.",
                )
            )
            continue

        # Check span does not exceed day bounds and has no breaks
        day = start_slot.day
        period = start_slot.period
        if period + d > periods_per_day:
            violations.append(
                ValidationViolation(
                    check_id="VAL-013",
                    entity_type="INSTANCE",
                    entity_id=p.instance_id,
                    slot_index=start,
                    message=f"Session spans across day boundary (day {day}, period {period}+{d}).",
                )
            )

        for step in range(d):
            slot = slot_map.get(start + step)
            if not slot or not slot.is_teachable or slot.day != day:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-013",
                        entity_type="INSTANCE",
                        entity_id=p.instance_id,
                        slot_index=start + step,
                        message=f"Slot {start + step} occupied by {p.instance_id} is invalid or spans days.",
                    )
                )
            if step < d - 1 and slot and slot.break_after:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-013",
                        entity_type="INSTANCE",
                        entity_id=p.instance_id,
                        slot_index=start + step,
                        message=f"Session {p.instance_id} spans over break after slot {start + step}.",
                    )
                )

        # VAL-006: Faculty eligibility
        if len(p.assigned_faculty_ids) != req.faculty_count:
            violations.append(
                ValidationViolation(
                    check_id="VAL-006",
                    entity_type="INSTANCE",
                    entity_id=p.instance_id,
                    message=f"Expected {req.faculty_count} faculty, assigned {len(p.assigned_faculty_ids)}.",
                )
            )

        allowed_fac = (
            set(req.pre_assigned_faculty_ids)
            if req.pre_assigned_faculty_ids
            else (set(req.eligible_faculty_ids) if req.eligible_faculty_ids else set(faculty_map.keys()))
        )
        for f_id in p.assigned_faculty_ids:
            if f_id not in allowed_fac:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-006",
                        entity_type="FACULTY",
                        entity_id=f_id,
                        message=f"Faculty {f_id} is not eligible for requirement {req.requirement_id}.",
                    )
                )

            # VAL-007: Faculty availability
            fac = faculty_map.get(f_id)
            if fac:
                for step in range(d):
                    cur_slot = start + step
                    if cur_slot in fac.unavailable_slots:
                        violations.append(
                            ValidationViolation(
                                check_id="VAL-007",
                                entity_type="FACULTY",
                                entity_id=f_id,
                                slot_index=cur_slot,
                                message=f"Faculty {f_id} is assigned during unavailable slot {cur_slot}.",
                            )
                        )

        # VAL-005: Room eligibility
        strength = max([group_strength.get(gid, 30) for gid in req.group_ids], default=30)
        if req.room_required:
            if not p.assigned_room_id:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-005",
                        entity_type="INSTANCE",
                        entity_id=p.instance_id,
                        message="Room required but none assigned.",
                    )
                )
            else:
                rm = room_map.get(p.assigned_room_id)
                if not rm:
                    violations.append(
                        ValidationViolation(
                            check_id="VAL-005",
                            entity_type="ROOM",
                            entity_id=p.assigned_room_id,
                            message=f"Unknown room {p.assigned_room_id}.",
                        )
                    )
                else:
                    if req.room_type_id and rm.room_type_id != req.room_type_id:
                        violations.append(
                            ValidationViolation(
                                check_id="VAL-005",
                                entity_type="ROOM",
                                entity_id=rm.room_id,
                                message=f"Room type mismatch: {rm.room_type_id} vs required {req.room_type_id}.",
                            )
                        )
                    if rm.capacity < strength:
                        violations.append(
                            ValidationViolation(
                                check_id="VAL-005",
                                entity_type="ROOM",
                                entity_id=rm.room_id,
                                message=f"Room capacity {rm.capacity} is less than audience strength {strength}.",
                            )
                        )
                    if not rm.features.issuperset(req.required_features):
                        violations.append(
                            ValidationViolation(
                                check_id="VAL-005",
                                entity_type="ROOM",
                                entity_id=rm.room_id,
                                message=f"Room {rm.room_id} missing required features.",
                            )
                        )

                # VAL-008: Room availability
                r_unavail = set()
                for ru in snapshot.room_unavailability:
                    if ru.room_id == p.assigned_room_id:
                        r_unavail.update(ru.unavailable_slots)
                for step in range(d):
                    cur_slot = start + step
                    if cur_slot in r_unavail:
                        violations.append(
                            ValidationViolation(
                                check_id="VAL-008",
                                entity_type="ROOM",
                                entity_id=p.assigned_room_id,
                                slot_index=cur_slot,
                                message=f"Room {p.assigned_room_id} assigned during unavailable slot {cur_slot}.",
                            )
                        )

    # 3. VAL-002: Faculty Clashes (Sweep-line over all assigned slots)
    faculty_slot_usage: Dict[str, Dict[int, List[str]]] = defaultdict(lambda: defaultdict(list))
    for p in placements:
        for f_id in p.assigned_faculty_ids:
            for step in range(p.duration_slots):
                faculty_slot_usage[f_id][p.start_slot + step].append(p.instance_id)

    for f_id, slots in faculty_slot_usage.items():
        for slot_idx, instances in slots.items():
            if len(instances) > 1:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-002",
                        entity_type="FACULTY",
                        entity_id=f_id,
                        slot_index=slot_idx,
                        message=f"Faculty clash: {f_id} double-booked at slot {slot_idx} for instances {instances}.",
                    )
                )

    # 4. VAL-003: Room Clashes (Sweep-line over all assigned room slots)
    room_slot_usage: Dict[str, Dict[int, List[str]]] = defaultdict(lambda: defaultdict(list))
    for p in placements:
        if p.assigned_room_id:
            for step in range(p.duration_slots):
                room_slot_usage[p.assigned_room_id][p.start_slot + step].append(p.instance_id)

    for r_id, slots in room_slot_usage.items():
        for slot_idx, instances in slots.items():
            if len(instances) > 1:
                violations.append(
                    ValidationViolation(
                        check_id="VAL-003",
                        entity_type="ROOM",
                        entity_id=r_id,
                        slot_index=slot_idx,
                        message=f"Room clash: {r_id} double-booked at slot {slot_idx} for instances {instances}.",
                    )
                )

    # 5. VAL-004: Student Group Leaf-Path Clashes
    # Build tree independently
    parent_map = {g.group_id: g.parent_id for g in snapshot.student_groups}
    children: Dict[str, List[str]] = {g.group_id: [] for g in snapshot.student_groups}
    for g in snapshot.student_groups:
        if g.parent_id and g.parent_id in children:
            children[g.parent_id].append(g.group_id)

    leaves = [gid for gid, ch in children.items() if len(ch) == 0]
    if not leaves:
        leaves = list(parent_map.keys())

    leaf_paths: Dict[str, Set[str]] = {}
    for leaf in leaves:
        curr = leaf
        path = set()
        while curr:
            path.add(curr)
            curr = parent_map.get(curr)
        leaf_paths[leaf] = path

    for leaf_id, path_set in leaf_paths.items():
        group_slot_usage: Dict[int, List[str]] = defaultdict(list)
        for p in placements:
            req = req_map.get(p.requirement_id)
            if not req:
                continue
            if set(req.group_ids) & path_set:
                for step in range(p.duration_slots):
                    group_slot_usage[p.start_slot + step].append(p.instance_id)

        # Find parallel elective member sets to permit parallel elective alignment
        parallel_member_sets = []
        for eg in snapshot.elective_groups:
            if eg.mode == "PARALLEL":
                parallel_member_sets.append(set(eg.member_requirement_ids))

        for slot_idx, instances in group_slot_usage.items():
            if len(instances) > 1:
                # Check if all instances belong to the same parallel elective group
                inst_reqs = {next(p.requirement_id for p in placements if p.instance_id == i_id) for i_id in instances}
                is_parallel_elective_basket = any(inst_reqs.issubset(pm_set) for pm_set in parallel_member_sets)

                if not is_parallel_elective_basket:
                    violations.append(
                        ValidationViolation(
                            check_id="VAL-004",
                            entity_type="GROUP",
                            entity_id=leaf_id,
                            slot_index=slot_idx,
                            message=f"Student group clash along path of leaf {leaf_id} at slot {slot_idx} for instances {instances}.",
                        )
                    )

    # 6. VAL-011: Parallel Elective Alignment
    for eg in snapshot.elective_groups:
        if eg.mode == "PARALLEL" and len(eg.member_requirement_ids) > 1:
            req_starts: Dict[str, List[int]] = {}
            for req_id in eg.member_requirement_ids:
                req_starts[req_id] = sorted([p.start_slot for p in placements if p.requirement_id == req_id])

            first_req_id = eg.member_requirement_ids[0]
            anchor_starts = req_starts.get(first_req_id, [])
            for other_req_id in eg.member_requirement_ids[1:]:
                other_starts = req_starts.get(other_req_id, [])
                if anchor_starts != other_starts:
                    violations.append(
                        ValidationViolation(
                            check_id="VAL-011",
                            entity_type="ELECTIVE_GROUP",
                            entity_id=eg.elective_group_id,
                            message=f"Parallel elective basket {eg.name} is misaligned: {first_req_id} starts at {anchor_starts} while {other_req_id} starts at {other_starts}.",
                        )
                    )

    status = ValidationStatus.VALID if len(violations) == 0 else ValidationStatus.INVALID
    return ValidationReport(status=status, violations=violations)

