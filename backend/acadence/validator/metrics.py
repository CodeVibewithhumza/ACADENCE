"""Independent metric evaluator for Acadence (VAL-020).
Recomputes soft metrics from pure placement data with zero solver code.
"""
from collections import defaultdict
from typing import Dict, List, Optional, Set
from acadence.domain.objectives import MetricReport, ObjectiveProfile, SEEDED_PROFILES
from acadence.domain.snapshot import ConfigSnapshot, Placement


def evaluate_metrics(
    snapshot: ConfigSnapshot,
    placements: List[Placement],
    profile: Optional[ObjectiveProfile] = None,
) -> MetricReport:
    """Independently evaluates raw and composite quality metrics on a timetable."""
    prof = profile or SEEDED_PROFILES["BALANCED"]
    grid = snapshot.time_grid
    periods_per_day = grid.periods_per_day
    num_days = grid.num_days

    req_map = {r.requirement_id: r for r in snapshot.requirements}
    room_map = {r.room_id: r for r in snapshot.rooms}
    group_strength = {g.group_id: g.expected_strength for g in snapshot.student_groups}

    # 1. CON-S-008: Distribution excess (sessions on same day > 1)
    req_day_counts: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for p in placements:
        req_day_counts[p.requirement_id][p.day] += 1

    dist_excess = 0
    for req_id, day_counts in req_day_counts.items():
        for day, count in day_counts.items():
            if count > 1:
                dist_excess += (count - 1)

    # 2. CON-S-005: Room capacity waste
    room_waste = 0
    rooms_used_set: Set[str] = set()
    for p in placements:
        if p.assigned_room_id:
            rooms_used_set.add(p.assigned_room_id)
            rm = room_map.get(p.assigned_room_id)
            req = req_map.get(p.requirement_id)
            if rm and req:
                strength = max([group_strength.get(gid, 30) for gid in req.group_ids], default=30)
                if rm.capacity > strength:
                    room_waste += (rm.capacity - strength)

    # 3. CON-S-004: Student group idle gaps
    # Build leaf paths
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

    student_gaps = 0
    for leaf_id, path_set in leaf_paths.items():
        for d in range(num_days):
            occupied_periods = set()
            for p in placements:
                if p.day == d:
                    req = req_map.get(p.requirement_id)
                    if req and (set(req.group_ids) & path_set):
                        for step in range(p.duration_slots):
                            occupied_periods.add(p.period + step)
            if len(occupied_periods) > 1:
                span = max(occupied_periods) - min(occupied_periods) + 1
                gaps = span - len(occupied_periods)
                student_gaps += max(0, gaps)

    # 4. CON-S-003: Faculty idle gaps
    faculty_gaps = 0
    for fac in snapshot.faculty:
        f_id = fac.faculty_id
        for d in range(num_days):
            occupied_periods = set()
            for p in placements:
                if p.day == d and f_id in p.assigned_faculty_ids:
                    for step in range(p.duration_slots):
                        occupied_periods.add(p.period + step)
            if len(occupied_periods) > 1:
                span = max(occupied_periods) - min(occupied_periods) + 1
                gaps = span - len(occupied_periods)
                faculty_gaps += max(0, gaps)

    # Calculate composite score
    w = prof.weights
    composite = (
        w.get("CON-S-003", 0) * faculty_gaps
        + w.get("CON-S-004", 0) * student_gaps
        + w.get("CON-S-005", 0) * room_waste
        + w.get("CON-S-008", 0) * dist_excess
    )

    return MetricReport(
        faculty_gaps=faculty_gaps,
        student_gaps=student_gaps,
        room_capacity_waste=room_waste,
        distribution_excess=dist_excess,
        rooms_used=len(rooms_used_set),
        composite_score=composite,
    )

