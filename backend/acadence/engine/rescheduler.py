"""Dynamic Rescheduling and Stability Engine.
Follows Section 12 (Dynamic Rescheduling, Partial Regeneration, Stability Objective CON-S-014).
Minimizes disruption by pinning unaffected sessions and re-solving only affected placements.
"""
from typing import Dict, List, Optional, Set
from ortools.sat.python import cp_model

from acadence.domain.enums import SolverStatus
from acadence.domain.snapshot import ConfigSnapshot, Placement
from acadence.engine.compiler import compile_snapshot, CompiledModelInput
from acadence.engine.solver import SolveResult, SolverParameters
from acadence.validator.metrics import evaluate_metrics
from acadence.validator.validator import validate


def reschedule_for_faculty_absence(
    snapshot: ConfigSnapshot,
    current_placements: List[Placement],
    absent_faculty_id: str,
    absent_slot_indices: Set[int],
    time_limit_seconds: float = 15.0,
) -> SolveResult:
    """Performs minimal-disruption partial regeneration when a faculty member has an unexpected absence.
    Pins unaffected sessions and uses CON-S-014 to minimize movement of other classes.
    """
    model = cp_model.CpModel()
    compiled: CompiledModelInput = compile_snapshot(snapshot)
    grid = snapshot.time_grid
    periods_per_day = grid.periods_per_day

    # Identify which placements clash with the new absence
    affected_instance_ids = set()
    for p in current_placements:
        if absent_faculty_id in p.assigned_faculty_ids:
            for step in range(p.duration_slots):
                if (p.start_slot + step) in absent_slot_indices:
                    affected_instance_ids.add(p.instance_id)
                    break

    st: Dict[str, Dict[int, cp_model.IntVar]] = {}
    start_vars: Dict[str, cp_model.IntVar] = {}
    interval_vars: Dict[str, cp_model.IntervalVar] = {}
    a: Dict[str, Dict[str, cp_model.IntVar]] = {}
    q: Dict[str, Dict[str, cp_model.IntVar]] = {}

    faculty_intervals: Dict[str, List[cp_model.IntervalVar]] = {
        f.faculty_id: [] for f in snapshot.faculty
    }
    room_intervals: Dict[str, List[cp_model.IntervalVar]] = {
        r.room_id: [] for r in snapshot.rooms
    }

    # CON-S-014: Stability penalty (track number of moved sessions)
    moved_penalties = []

    for inst in compiled.instances:
        i_id = inst.instance_id
        st[i_id] = {}
        for s in inst.valid_starts:
            st[i_id][s] = model.NewBoolVar(f"st_{i_id}_{s}")

        model.Add(sum(st[i_id].values()) == 1)

        min_start = min(inst.valid_starts)
        max_start = max(inst.valid_starts)
        start_var = model.NewIntVar(min_start, max_start, f"start_{i_id}")
        model.Add(start_var == sum(s * st[i_id][s] for s in inst.valid_starts))
        start_vars[i_id] = start_var

        end_var = model.NewIntVar(
            min_start + inst.duration_slots,
            max_start + inst.duration_slots,
            f"end_{i_id}",
        )
        model.Add(end_var == start_var + inst.duration_slots)
        interval_var = model.NewIntervalVar(
            start_var, inst.duration_slots, end_var, f"interval_{i_id}"
        )
        interval_vars[i_id] = interval_var

        # Reference placement
        ref_p = next((p for p in current_placements if p.instance_id == i_id), None)

        # If not affected, try to pin to reference start slot (or heavily penalize moving it)
        if ref_p and i_id not in affected_instance_ids:
            if ref_p.start_slot in st[i_id]:
                # Pin unaffected session
                model.Add(st[i_id][ref_p.start_slot] == 1)
        elif ref_p:
            # Affected session: CON-S-014 penalty if moved to a different slot
            if ref_p.start_slot in st[i_id]:
                moved_var = model.NewBoolVar(f"moved_{i_id}")
                model.Add(st[i_id][ref_p.start_slot] == 0).OnlyEnforceIf(moved_var)
                model.Add(st[i_id][ref_p.start_slot] == 1).OnlyEnforceIf(moved_var.Not())
                moved_penalties.append(100 * moved_var)

        # Faculty decision variables
        a[i_id] = {}
        for f_id in inst.eligible_faculty_ids:
            a_var = model.NewBoolVar(f"a_{i_id}_{f_id}")
            a[i_id][f_id] = a_var

            f_interval = model.NewOptionalIntervalVar(
                start_var, inst.duration_slots, end_var, a_var, f"opt_f_{i_id}_{f_id}"
            )
            faculty_intervals[f_id].append(f_interval)

            # Combined unavailabilities: base + new emergency absence
            total_unavail = set(compiled.faculty_unavailability.get(f_id, set()))
            if f_id == absent_faculty_id:
                total_unavail.update(absent_slot_indices)

            for s in inst.valid_starts:
                span = set(range(s, s + inst.duration_slots))
                if span & total_unavail:
                    model.Add(st[i_id][s] + a_var <= 1)

        if inst.eligible_faculty_ids:
            model.Add(sum(a[i_id].values()) == inst.faculty_count)

        # Room decision variables
        q[i_id] = {}
        if inst.room_required and inst.eligible_room_ids:
            for r_id in inst.eligible_room_ids:
                q_var = model.NewBoolVar(f"q_{i_id}_{r_id}")
                q[i_id][r_id] = q_var
                r_interval = model.NewOptionalIntervalVar(
                    start_var, inst.duration_slots, end_var, q_var, f"opt_r_{i_id}_{r_id}"
                )
                room_intervals[r_id].append(r_interval)

            model.Add(sum(q[i_id].values()) == 1)

    # Hard NoOverlap constraints
    for intervals in faculty_intervals.values():
        if len(intervals) > 1:
            model.AddNoOverlap(intervals)

    for intervals in room_intervals.values():
        if len(intervals) > 1:
            model.AddNoOverlap(intervals)

    # Student group leaf-path NoOverlap (exclude parallel non-anchors per CON-H-011)
    parallel_non_anchors = set()
    for eg in snapshot.elective_groups:
        if eg.mode == "PARALLEL" and len(eg.member_requirement_ids) > 1:
            for other_req_id in eg.member_requirement_ids[1:]:
                parallel_non_anchors.add(other_req_id)

    for path_groups in compiled.leaf_paths.values():
        group_intervals = [
            interval_vars[inst.instance_id]
            for inst in compiled.instances
            if (set(inst.audience_group_ids) & path_groups) and (inst.requirement_id not in parallel_non_anchors)
        ]
        if len(group_intervals) > 1:
            model.AddNoOverlap(group_intervals)

    # CON-H-011: Parallel Elective Alignment
    for eg in snapshot.elective_groups:
        if eg.mode == "PARALLEL" and len(eg.member_requirement_ids) > 1:
            req_inst_map: Dict[str, List[str]] = {}
            for req_id in eg.member_requirement_ids:
                req_inst_map[req_id] = [
                    inst.instance_id for inst in compiled.instances if inst.requirement_id == req_id
                ]
            first_req_id = eg.member_requirement_ids[0]
            num_sessions = len(req_inst_map.get(first_req_id, []))
            for k in range(num_sessions):
                anchor_inst_id = req_inst_map[first_req_id][k]
                for other_req_id in eg.member_requirement_ids[1:]:
                    if k < len(req_inst_map.get(other_req_id, [])):
                        other_inst_id = req_inst_map[other_req_id][k]
                        model.Add(start_vars[anchor_inst_id] == start_vars[other_inst_id])

    # CON-H-012: Declared CANNOT_OVERLAP pairs
    for cr in snapshot.course_relationships:
        if cr.relationship_type == "CANNOT_OVERLAP":
            insts_a = [inst.instance_id for inst in compiled.instances if inst.requirement_id == cr.requirement_id_a]
            insts_b = [inst.instance_id for inst in compiled.instances if inst.requirement_id == cr.requirement_id_b]
            for ia in insts_a:
                for ib in insts_b:
                    model.AddNoOverlap([interval_vars[ia], interval_vars[ib]])

    # CON-H-009: Faculty Workload Limits (Weekly and Daily)
    for fac in snapshot.faculty:
        weekly_terms = [
            inst.duration_slots * a[inst.instance_id][fac.faculty_id]
            for inst in compiled.instances
            if fac.faculty_id in a[inst.instance_id]
        ]
        if weekly_terms:
            model.Add(sum(weekly_terms) <= fac.max_hours_week)

        for d in range(grid.num_days):
            day_terms = []
            for inst in compiled.instances:
                if fac.faculty_id not in a[inst.instance_id]:
                    continue
                day_starts = [
                    st[inst.instance_id][s]
                    for s in inst.valid_starts
                    if s // periods_per_day == d
                ]
                if not day_starts:
                    continue
                on_day = sum(day_starts)
                if len(inst.eligible_faculty_ids) == 1:
                    day_terms.append(inst.duration_slots * on_day)
                else:
                    z_var = model.NewBoolVar(f"resched_z_{inst.instance_id}_{fac.faculty_id}_{d}")
                    model.AddMultiplicationEquality(z_var, [on_day, a[inst.instance_id][fac.faculty_id]])
                    day_terms.append(inst.duration_slots * z_var)
            if day_terms:
                model.Add(sum(day_terms) <= fac.max_hours_day)

    # CON-H-014: Maximum sessions per day for a requirement
    for req in snapshot.requirements:
        max_daily = getattr(req, "max_sessions_per_day", None)
        if max_daily is not None and max_daily > 0:
            req_inst_ids = [inst.instance_id for inst in compiled.instances if inst.requirement_id == req.requirement_id]
            for d in range(grid.num_days):
                day_terms = []
                for i_id in req_inst_ids:
                    day_starts = [st[i_id][s] for s in st[i_id] if s // periods_per_day == d]
                    if day_starts:
                        day_terms.append(sum(day_starts))
                if day_terms:
                    model.Add(sum(day_terms) <= max_daily)

    # Minimize disruptions (CON-S-014)
    if moved_penalties:
        model.Minimize(sum(moved_penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    status_code = solver.Solve(model)

    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveResult(
            status=SolverStatus.INFEASIBLE,
            placements=current_placements,
            solve_time_seconds=solver.WallTime(),
            status_detail="Unable to reschedule without violating hard constraints (no clash-free replacement found).",
        )

    # Extract new placements
    new_placements: List[Placement] = []
    for inst in compiled.instances:
        i_id = inst.instance_id
        assigned_start = next(s for s in inst.valid_starts if solver.Value(st[i_id][s]) == 1)
        assigned_fac = [f_id for f_id, v in a[i_id].items() if solver.Value(v) == 1]
        assigned_room = next((r_id for r_id, v in q[i_id].items() if solver.Value(v) == 1), None)

        new_placements.append(
            Placement(
                instance_id=i_id,
                requirement_id=inst.requirement_id,
                start_slot=assigned_start,
                duration_slots=inst.duration_slots,
                day=assigned_start // periods_per_day,
                period=assigned_start % periods_per_day,
                assigned_faculty_ids=assigned_fac,
                assigned_room_id=assigned_room,
            )
        )

    metrics = evaluate_metrics(snapshot, new_placements)
    return SolveResult(
        status=SolverStatus.OPTIMAL if status_code == cp_model.OPTIMAL else SolverStatus.FEASIBLE,
        placements=new_placements,
        solve_time_seconds=solver.WallTime(),
        status_detail=f"Successfully rescheduled {len(affected_instance_ids)} affected session(s) with minimal disruption.",
        metrics=metrics,
    )

