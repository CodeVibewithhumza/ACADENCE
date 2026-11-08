"""Demo CLI to generate and pretty-print an academic timetable for Tier S.
"""
from collections import defaultdict
from acadence.domain.enums import SolverStatus
from acadence.domain.objectives import SEEDED_PROFILES
from acadence.domain.snapshot import ConfigSnapshot
from acadence.engine.solver import solve, SolverParameters
from acadence.validator.validator import validate
from acadence.test_data.synthetic import generate_tier_s_snapshot


def print_timetable_grid(snapshot: ConfigSnapshot, placements):
    grid = snapshot.time_grid
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods = [f"P{i+1}" for i in range(grid.periods_per_day)]

    # Map placements by group
    group_tables = defaultdict(lambda: defaultdict(str))

    for p in placements:
        # Determine group tag
        req = next(r for r in snapshot.requirements if r.requirement_id == p.requirement_id)
        grp_names = ", ".join(req.group_ids).replace("GRP_", "")
        fac_names = ", ".join(p.assigned_faculty_ids)
        rm = p.assigned_room_id or "NO_ROOM"
        info = f"{req.course_id} ({rm}, {fac_names})"

        for step in range(p.duration_slots):
            slot_idx = p.start_slot + step
            day = slot_idx // grid.periods_per_day
            period = slot_idx % grid.periods_per_day
            for gid in req.group_ids:
                group_tables[gid][(day, period)] = info

    for gid, table in group_tables.items():
        print("\n" + "=" * 90)
        print(f" TIMETABLE FOR: {gid}")
        print("=" * 90)
        header = f"{'Day':<12} | " + " | ".join(f"{p:<14}" for p in periods)
        print(header)
        print("-" * len(header))
        for d_idx, day_name in enumerate(days):
            row = [f"{day_name:<12}"]
            for p_idx in range(grid.periods_per_day):
                cell = table.get((d_idx, p_idx), "---")
                if len(cell) > 14:
                    cell = cell[:12] + ".."
                row.append(f"{cell:<14}")
            print(" | ".join(row))


if __name__ == "__main__":
    print("Generating Tier S synthetic academic institution snapshot...")
    snapshot = generate_tier_s_snapshot(seed=42)
    print(f"Snapshot content hash: {snapshot.compute_hash()}")

    print("\nRunning Google OR-Tools CP-SAT Optimization Engine (BALANCED profile)...")
    result = solve(
        snapshot,
        SolverParameters(
            time_limit_seconds=15.0,
            random_seed=42,
            profile=SEEDED_PROFILES["BALANCED"],
        ),
    )
    print(f"Solver Status: {result.status.value} (in {result.solve_time_seconds:.2f}s)")
    if result.metrics:
        print(f"Quality Metrics (Lower is better):")
        print(f"  - Session Distribution Excess (CON-S-008): {result.metrics.distribution_excess} (0 is perfect spread)")
        print(f"  - Faculty Idle Gaps (CON-S-003): {result.metrics.faculty_gaps} slots")
        print(f"  - Student Idle Gaps (CON-S-004): {result.metrics.student_gaps} slots")
        print(f"  - Room Capacity Waste (CON-S-005): {result.metrics.room_capacity_waste} empty seats")
        print(f"  - Composite Objective Score: {result.metrics.composite_score}")

    print("\nRunning Independent Validator (shares 0 solver code)...")
    report = validate(snapshot, result.placements)
    print(f"Validator Status: {report.status.value} (Violations: {len(report.violations)})")

    if report.is_valid:
        print_timetable_grid(snapshot, result.placements)

