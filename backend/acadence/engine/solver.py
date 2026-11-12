"""CP-SAT optimization solver for Acadence.
Follows Section 10 (Decision Variables, CON-H-001 to CON-H-004, CON-H-007, CON-H-008).
"""
from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from ortools.sat.python import cp_model

from acadence.domain.enums import SolverStatus
from acadence.domain.snapshot import ConfigSnapshot, Placement
from acadence.domain.objectives import ObjectiveProfile, MetricReport
from acadence.engine.compiler import compile_snapshot, CompiledModelInput, SessionInstance
from acadence.engine.objectives import attach_soft_constraints


@dataclass
class SolverParameters:
    time_limit_seconds: float = 30.0
    random_seed: int = 42
    num_search_workers: int = 1  # 1 for deterministic reproducibility per ADR-012
    profile: Optional[ObjectiveProfile] = None


@dataclass
class SolveResult:
    status: SolverStatus
    placements: List[Placement] = field(default_factory=list)
    solve_time_seconds: float = 0.0
    wall_time_seconds: float = 0.0
    status_detail: str = ""
    metrics: Optional[MetricReport] = None


def solve(
    snapshot: ConfigSnapshot,
    parameters: Optional[SolverParameters] = None,
) -> SolveResult:
    """Pure solver function: snapshot -> solve_result."""
    start_wall_time = time.time()
    params = parameters or SolverParameters()

    # 1. Compile snapshot into decision structures
    compiled: CompiledModelInput = compile_snapshot(snapshot)
    if not compiled.instances:
        return SolveResult(
            status=SolverStatus.OPTIMAL,
            placements=[],
            solve_time_seconds=0.0,
            wall_time_seconds=time.time() - start_wall_time,
            status_detail="No session instances to schedule.",
        )

    model = cp_model.CpModel()
    grid = snapshot.time_grid
    periods_per_day = grid.periods_per_day

    # 2. Decision Variables
    # st[i, s]: bool indicating if instance i starts at slot s
    st: Dict[str, Dict[int, cp_model.IntVar]] = {}
    start_vars: Dict[str, cp_model.IntVar] = {}
    interval_vars: Dict[str, cp_model.IntervalVar] = {}

    # Faculty assignment: a[i, f]
    a: Dict[str, Dict[str, cp_model.IntVar]] = {}
    faculty_intervals: Dict[str, List[cp_model.IntervalVar]] = {
        f.faculty_id: [] for f in snapshot.faculty
    }

    # Room assignment: q[i, r]
    q: Dict[str, Dict[str, cp_model.IntVar]] = {}
    room_intervals: Dict[str, List[cp_model.IntervalVar]] = {
        r.room_id: [] for r in snapshot.rooms
    }

    # CON-H-001: Completeness of domain and start variables
    for inst in compiled.instances:
        i_id = inst.instance_id
        if not inst.valid_starts:
            # Domain is empty: immediately infeasible
            return SolveResult(
                status=SolverStatus.INFEASIBLE,
                placements=[],
                solve_time_seconds=0.0,
                wall_time_seconds=time.time() - start_wall_time,
                status_detail=f"Instance {i_id} has zero valid starting slots (S_i is empty).",
            )

        st[i_id] = {}
        for s in inst.valid_starts:
            st[i_id][s] = model.NewBoolVar(f"st_{i_id}_{s}")

        # Exactly one start slot
        model.Add(sum(st[i_id].values()) == 1)

        # start_i = sum(s * st[i, s])
        min_start = min(inst.valid_starts)
        max_start = max(inst.valid_starts)
        start_var = model.NewIntVar(min_start, max_start, f"start_{i_id}")
        model.Add(start_var == sum(s * st[i_id][s] for s in inst.valid_starts))
        start_vars[i_id] = start_var

        # Interval variable for instance i
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

        # Faculty decision variables
        a[i_id] = {}
        for f_id in inst.eligible_faculty_ids:
            a_var = model.NewBoolVar(f"a_{i_id}_{f_id}")
            a[i_id][f_id] = a_var

            # Optional interval for faculty f_id
            f_interval = model.NewOptionalIntervalVar(
                start_var,
                inst.duration_slots,
                end_var,
                a_var,
                f"opt_f_{i_id}_{f_id}",
            )
            faculty_intervals[f_id].append(f_interval)

            # CON-H-007: Faculty availability
            f_unavail = compiled.faculty_unavailability.get(f_id, set())
            if f_unavail:
                for s in inst.valid_starts:
                    # check if span [s, s + d_i) touches any unavailable slot
                    span = set(range(s, s + inst.duration_slots))
                    if span & f_unavail:
                        # st[i, s] + a[i, f] <= 1
                        model.Add(st[i_id][s] + a_var <= 1)

        # Require exactly faculty_count assignments
        if inst.eligible_faculty_ids:
            model.Add(sum(a[i_id].values()) == inst.faculty_count)

        # Room decision variables
        q[i_id] = {}
        if inst.room_required:
            if not inst.eligible_room_ids:
                return SolveResult(
                    status=SolverStatus.INFEASIBLE,
                    placements=[],
                    solve_time_seconds=0.0,
                    wall_time_seconds=time.time() - start_wall_time,
                    status_detail=f"Instance {i_id} requires a room but no eligible rooms match capacity/features.",
                )

            for r_id in inst.eligible_room_ids:
                q_var = model.NewBoolVar(f"q_{i_id}_{r_id}")
                q[i_id][r_id] = q_var

                # Optional interval for room r_id
                r_interval = model.NewOptionalIntervalVar(
                    start_var,
                    inst.duration_slots,
                    end_var,
                    q_var,
                    f"opt_r_{i_id}_{r_id}",
                )
                room_intervals[r_id].append(r_interval)

                # CON-H-008: Room availability
                r_unavail = compiled.room_unavailability.get(r_id, set())
                if r_unavail:
                    for s in inst.valid_starts:
                        span = set(range(s, s + inst.duration_slots))
                        if span & r_unavail:
                            model.Add(st[i_id][s] + q_var <= 1)

            # Require exactly 1 room
            model.Add(sum(q[i_id].values()) == 1)

    # 3. CON-H-002: Faculty NoOverlap
    for f_id, intervals in faculty_intervals.items():
        if len(intervals) > 1:
            model.AddNoOverlap(intervals)

    # 4. CON-H-003: Room NoOverlap
    for r_id, intervals in room_intervals.items():
        if len(intervals) > 1:
            model.AddNoOverlap(intervals)

    # 5. CON-H-004: Student group leaf-path NoOverlap
    # For parallel elective groups, only include the anchor member so parallel electives can run concurrently (Section 9.2)
    parallel_non_anchors = set()
    for eg in snapshot.elective_groups:
        if eg.mode == "PARALLEL" and len(eg.member_requirement_ids) > 1:
            for other_req_id in eg.member_requirement_ids[1:]:
                parallel_non_anchors.add(other_req_id)

    for leaf_id, path_groups in compiled.leaf_paths.items():
        # Find all session intervals visible to this leaf path
        group_intervals = []
        for inst in compiled.instances:
            if set(inst.audience_group_ids) & path_groups:
                if inst.requirement_id not in parallel_non_anchors:
                    group_intervals.append(interval_vars[inst.instance_id])
        if len(group_intervals) > 1:
            model.AddNoOverlap(group_intervals)

    # 5.1 CON-H-011: Parallel Elective Alignment
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

    # 5.2 CON-H-012: Declared CANNOT_OVERLAP pairs
    for cr in snapshot.course_relationships:
        if cr.relationship_type == "CANNOT_OVERLAP":
            insts_a = [inst.instance_id for inst in compiled.instances if inst.requirement_id == cr.requirement_id_a]
            insts_b = [inst.instance_id for inst in compiled.instances if inst.requirement_id == cr.requirement_id_b]
            for ia in insts_a:
                for ib in insts_b:
                    model.AddNoOverlap([interval_vars[ia], interval_vars[ib]])

    # 5.3 CON-H-009: Faculty Workload Limits (Weekly and Daily)
    for fac in snapshot.faculty:
        # Weekly cap: sum(d_i * a[i, f]) <= fac.max_hours_week
        weekly_terms = [
            inst.duration_slots * a[inst.instance_id][fac.faculty_id]
            for inst in compiled.instances
            if fac.faculty_id in a[inst.instance_id]
        ]
        if weekly_terms:
            model.Add(sum(weekly_terms) <= fac.max_hours_week)

        # Daily cap: sum(d_i * z[i, f, d]) <= fac.max_hours_day
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
                    z_var = model.NewBoolVar(f"z_{inst.instance_id}_{fac.faculty_id}_{d}")
                    model.AddMultiplicationEquality(z_var, [on_day, a[inst.instance_id][fac.faculty_id]])
                    day_terms.append(inst.duration_slots * z_var)
            if day_terms:
                model.Add(sum(day_terms) <= fac.max_hours_day)

    # 5.4 CON-H-014: Maximum sessions per day for a requirement
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

    # 6. Attach Soft Constraints and Objectives if profile provided
    if params.profile:
        attach_soft_constraints(
            model=model,
            snapshot=snapshot,
            compiled=compiled,
            profile=params.profile,
            st=st,
            a=a,
            q=q,
        )

    # 7. Execute solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = params.time_limit_seconds
    solver.parameters.random_seed = params.random_seed
    solver.parameters.num_search_workers = params.num_search_workers

    status_code = solver.Solve(model)
    solve_duration = solver.WallTime()
    total_wall_time = time.time() - start_wall_time

    # 7. Map status and extract placements
    if status_code == cp_model.OPTIMAL:
        status = SolverStatus.OPTIMAL
    elif status_code == cp_model.FEASIBLE:
        status = SolverStatus.FEASIBLE
    elif status_code == cp_model.INFEASIBLE:
        return SolveResult(
            status=SolverStatus.INFEASIBLE,
            solve_time_seconds=solve_duration,
            wall_time_seconds=total_wall_time,
            status_detail="Problem is mathematically INFEASIBLE under hard constraints.",
        )
    else:
        return SolveResult(
            status=SolverStatus.TIMEOUT,
            solve_time_seconds=solve_duration,
            wall_time_seconds=total_wall_time,
            status_detail=f"Solver stopped with status {solver.StatusName(status_code)}.",
        )

    # Extract placements
    placements: List[Placement] = []
    for inst in compiled.instances:
        i_id = inst.instance_id
        assigned_start = -1
        for s in inst.valid_starts:
            if solver.Value(st[i_id][s]) == 1:
                assigned_start = s
                break

        assigned_faculty = [
            f_id for f_id, var in a[i_id].items() if solver.Value(var) == 1
        ]

        assigned_room = None
        if inst.room_required and i_id in q:
            for r_id, var in q[i_id].items():
                if solver.Value(var) == 1:
                    assigned_room = r_id
                    break

        day = assigned_start // periods_per_day
        period = assigned_start % periods_per_day

        placements.append(
            Placement(
                instance_id=i_id,
                requirement_id=inst.requirement_id,
                start_slot=assigned_start,
                duration_slots=inst.duration_slots,
                day=day,
                period=period,
                assigned_faculty_ids=assigned_faculty,
                assigned_room_id=assigned_room,
            )
        )

    # 8. Compute quality metrics using independent evaluator
    from acadence.validator.metrics import evaluate_metrics
    metrics = evaluate_metrics(snapshot, placements, params.profile)

    return SolveResult(
        status=status,
        placements=placements,
        solve_time_seconds=solve_duration,
        wall_time_seconds=total_wall_time,
        status_detail=f"Solved successfully with status {status.value}.",
        metrics=metrics,
    )

