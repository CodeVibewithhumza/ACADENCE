"""Soft constraint penalty builders for the OR-Tools CP-SAT model.
Implements CON-S-002, CON-S-003, CON-S-004, CON-S-005, and CON-S-008 per Section 10.6.
"""
from collections import defaultdict
from typing import Dict, List, Set, Union
from ortools.sat.python import cp_model
from acadence.domain.objectives import ObjectiveProfile
from acadence.domain.snapshot import ConfigSnapshot
from acadence.engine.compiler import CompiledModelInput


def attach_soft_constraints(
    model: cp_model.CpModel,
    snapshot: ConfigSnapshot,
    compiled: CompiledModelInput,
    profile: ObjectiveProfile,
    st: Dict[str, Dict[int, cp_model.IntVar]],
    a: Dict[str, Dict[str, cp_model.IntVar]],
    q: Dict[str, Dict[str, cp_model.IntVar]],
) -> Dict[str, cp_model.LinearExpr]:
    """Builds soft constraint penalty expressions and sets the model objective."""
    weights = profile.weights
    grid = snapshot.time_grid
    num_days = grid.num_days
    periods_per_day = grid.periods_per_day
    penalties: Dict[str, cp_model.LinearExpr] = {}

    # Map requirement -> list of instances
    req_instances: Dict[str, List] = defaultdict(list)
    for inst in compiled.instances:
        req_instances[inst.requirement_id].append(inst)

    # 1. CON-S-008: Session distribution across days (penalize multiple sessions of same course on same day)
    w_008 = weights.get("CON-S-008", 0)
    if w_008 > 0:
        dist_excess_vars = []
        for req_id, inst_list in req_instances.items():
            if len(inst_list) <= 1:
                continue
            for day in range(num_days):
                day_starts = []
                for inst in inst_list:
                    for s in inst.valid_starts:
                        if s // periods_per_day == day:
                            day_starts.append(st[inst.instance_id][s])

                if day_starts:
                    excess = model.NewIntVar(0, len(inst_list), f"dist_excess_{req_id}_{day}")
                    model.Add(excess >= sum(day_starts) - 1)
                    dist_excess_vars.append(excess)

        if dist_excess_vars:
            penalties["CON-S-008"] = sum(dist_excess_vars)

    # 2. CON-S-005: Room capacity waste: sum((cap_r - n_i) * q[i, r])
    w_005 = weights.get("CON-S-005", 0)
    if w_005 > 0:
        room_cap_map = {r.room_id: r.capacity for r in snapshot.rooms}
        waste_terms = []
        for inst in compiled.instances:
            if inst.room_required and inst.instance_id in q:
                for r_id, q_var in q[inst.instance_id].items():
                    cap = room_cap_map.get(r_id, inst.expected_strength)
                    waste = max(0, cap - inst.expected_strength)
                    if waste > 0:
                        waste_terms.append(waste * q_var)
        if waste_terms:
            penalties["CON-S-005"] = sum(waste_terms)

    # 3. CON-S-004: Student group idle gaps
    w_004 = weights.get("CON-S-004", 0)
    if w_004 > 0:
        gap_vars = []
        for leaf_id, path_groups in compiled.leaf_paths.items():
            visible_insts = [
                inst for inst in compiled.instances if set(inst.audience_group_ids) & path_groups
            ]
            if not visible_insts:
                continue

            for day in range(num_days):
                occ: Dict[int, Union[cp_model.IntVar, int]] = {}
                for p in range(periods_per_day):
                    covering_starts = []
                    for inst in visible_insts:
                        d_len = inst.duration_slots
                        for offset in range(d_len):
                            target_p = p - offset
                            if 0 <= target_p < periods_per_day:
                                s_idx = day * periods_per_day + target_p
                                if s_idx in st[inst.instance_id]:
                                    covering_starts.append(st[inst.instance_id][s_idx])
                    if not covering_starts:
                        occ[p] = 0
                    else:
                        v = model.NewIntVar(0, 1, f"grp_occ_{leaf_id}_{day}_{p}")
                        model.Add(v == sum(covering_starts))
                        occ[p] = v

                # Pre: running max from left to right
                pre: Dict[int, cp_model.IntVar] = {}
                for p in range(periods_per_day):
                    pre[p] = model.NewIntVar(0, 1, f"grp_pre_{leaf_id}_{day}_{p}")
                    val_p = occ[p] if isinstance(occ[p], cp_model.IntVar) else model.NewConstant(occ[p])
                    if p == 0:
                        model.Add(pre[0] == val_p)
                    else:
                        model.AddMaxEquality(pre[p], [pre[p - 1], val_p])

                # Post: running max from right to left
                post: Dict[int, cp_model.IntVar] = {}
                for p in range(periods_per_day - 1, -1, -1):
                    post[p] = model.NewIntVar(0, 1, f"grp_post_{leaf_id}_{day}_{p}")
                    val_p = occ[p] if isinstance(occ[p], cp_model.IntVar) else model.NewConstant(occ[p])
                    if p == periods_per_day - 1:
                        model.Add(post[p] == val_p)
                    else:
                        model.AddMaxEquality(post[p], [post[p + 1], val_p])

                # Gap: gap[p] >= pre[p] + post[p] - occ[p] - 1
                for p in range(periods_per_day):
                    val_p = occ[p] if isinstance(occ[p], cp_model.IntVar) else model.NewConstant(occ[p])
                    g_var = model.NewIntVar(0, 1, f"grp_gap_{leaf_id}_{day}_{p}")
                    model.Add(g_var >= pre[p] + post[p] - val_p - 1)
                    gap_vars.append(g_var)

        if gap_vars:
            penalties["CON-S-004"] = sum(gap_vars)

    # 4. CON-S-003: Faculty idle gaps
    w_003 = weights.get("CON-S-003", 0)
    if w_003 > 0:
        fac_gap_vars = []
        for fac in snapshot.faculty:
            f_id = fac.faculty_id
            candidate_insts = [
                inst for inst in compiled.instances if f_id in inst.eligible_faculty_ids
            ]
            if not candidate_insts:
                continue

            for day in range(num_days):
                occ_f: Dict[int, Union[cp_model.IntVar, int]] = {}
                for p in range(periods_per_day):
                    slot_busy_terms = []
                    for inst in candidate_insts:
                        d_len = inst.duration_slots
                        for offset in range(d_len):
                            target_p = p - offset
                            if 0 <= target_p < periods_per_day:
                                s_idx = day * periods_per_day + target_p
                                if s_idx in st[inst.instance_id] and f_id in a[inst.instance_id]:
                                    # y = st[i, s] AND a[i, f]
                                    y_var = model.NewBoolVar(f"y_{inst.instance_id}_{f_id}_{s_idx}")
                                    model.AddBoolAnd([st[inst.instance_id][s_idx], a[inst.instance_id][f_id]]).OnlyEnforceIf(y_var)
                                    model.AddBoolOr([st[inst.instance_id][s_idx].Not(), a[inst.instance_id][f_id].Not()]).OnlyEnforceIf(y_var.Not())
                                    slot_busy_terms.append(y_var)
                    if not slot_busy_terms:
                        occ_f[p] = 0
                    else:
                        v = model.NewIntVar(0, 1, f"fac_occ_{f_id}_{day}_{p}")
                        model.Add(v == sum(slot_busy_terms))
                        occ_f[p] = v

                pre_f: Dict[int, cp_model.IntVar] = {}
                for p in range(periods_per_day):
                    pre_f[p] = model.NewIntVar(0, 1, f"fac_pre_{f_id}_{day}_{p}")
                    val_p = occ_f[p] if isinstance(occ_f[p], cp_model.IntVar) else model.NewConstant(occ_f[p])
                    if p == 0:
                        model.Add(pre_f[0] == val_p)
                    else:
                        model.AddMaxEquality(pre_f[p], [pre_f[p - 1], val_p])

                post_f: Dict[int, cp_model.IntVar] = {}
                for p in range(periods_per_day - 1, -1, -1):
                    post_f[p] = model.NewIntVar(0, 1, f"fac_post_{f_id}_{day}_{p}")
                    val_p = occ_f[p] if isinstance(occ_f[p], cp_model.IntVar) else model.NewConstant(occ_f[p])
                    if p == periods_per_day - 1:
                        model.Add(post_f[p] == val_p)
                    else:
                        model.AddMaxEquality(post_f[p], [post_f[p + 1], val_p])

                for p in range(periods_per_day):
                    val_p = occ_f[p] if isinstance(occ_f[p], cp_model.IntVar) else model.NewConstant(occ_f[p])
                    g_var = model.NewIntVar(0, 1, f"fac_gap_{f_id}_{day}_{p}")
                    model.Add(g_var >= pre_f[p] + post_f[p] - val_p - 1)
                    fac_gap_vars.append(g_var)

        if fac_gap_vars:
            penalties["CON-S-003"] = sum(fac_gap_vars)

    # Combine weighted objective
    objective_terms = []
    for constraint_id, expr in penalties.items():
        w = weights.get(constraint_id, 0)
        if w > 0:
            objective_terms.append(w * expr)

    if objective_terms:
        model.Minimize(sum(objective_terms))

    return penalties
