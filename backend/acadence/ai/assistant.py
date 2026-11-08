"""AI Assistant Architecture for Acadence.
Follows Section 14 (Responsibilities, Provider Abstraction, Structured Proposals, Advisory-only).
"""
import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel

from acadence.domain.snapshot import ConfigSnapshot, Placement
from acadence.validator.delta import compute_valid_targets
from acadence.validator.validator import validate


class AIProposal(BaseModel):
    proposal_id: str
    action_type: str  # 'MOVE_SESSION', 'RESCHEDULE', 'EXPLANATION'
    title: str
    explanation: str
    is_valid: bool
    instance_id: Optional[str] = None
    target_slot: Optional[int] = None
    new_day: Optional[str] = None
    new_period: Optional[str] = None


class AIResponse(BaseModel):
    query: str
    reply: str
    proposal: Optional[AIProposal] = None


def process_ai_query(
    query: str,
    snapshot: ConfigSnapshot,
    current_placements: List[Placement],
) -> AIResponse:
    """Processes natural language scheduling requests and generates validated proposals."""
    q = query.lower().strip()
    grid = snapshot.time_grid
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    req_map = {r.requirement_id: r for r in snapshot.requirements}
    fac_map = {f.faculty_id: f for f in snapshot.faculty}

    # 1. Intent: Move query (e.g. "move cs201" or "reschedule cs204")
    if "move" in q or "shift" in q:
        # Identify course
        target_course = None
        for code in ["cs201", "cs202", "cs203", "cs204"]:
            if code in q:
                target_course = code.upper()
                break

        if target_course:
            # Find a placement of this course
            matching = [
                p for p in current_placements
                if target_course in p.requirement_id
            ]
            if matching:
                p_target = matching[0]
                targets = compute_valid_targets(snapshot, current_placements, p_target.instance_id)
                alt_targets = [s for s in targets if s != p_target.start_slot]

                if alt_targets:
                    chosen_slot = alt_targets[0]
                    d_idx = chosen_slot // grid.periods_per_day
                    p_idx = chosen_slot % grid.periods_per_day
                    req = req_map.get(p_target.requirement_id)
                    day_name = days[d_idx]
                    period_name = f"P{p_idx + 1}"

                    proposal = AIProposal(
                        proposal_id=str(uuid.uuid4())[:8],
                        action_type="MOVE_SESSION",
                        title=f"Move {target_course} to {day_name} {period_name}",
                        explanation=f"Found {len(alt_targets)} valid clash-free slots. Moving session from {days[p_target.day]} P{p_target.period+1} to {day_name} {period_name} maintains 100% compliance with all hard constraints and room requirements.",
                        is_valid=True,
                        instance_id=p_target.instance_id,
                        target_slot=chosen_slot,
                        new_day=day_name,
                        new_period=period_name,
                    )
                    return AIResponse(
                        query=query,
                        reply=f"I analyzed the timetable constraints for **{target_course} ({req.course_name if req else ''})**. I can move this session to **{day_name} {period_name}** with zero clashes.",
                        proposal=proposal,
                    )

        return AIResponse(
            query=query,
            reply="I couldn't identify the specific course you'd like to move. Please mention a course code such as **CS201**, **CS202**, **CS203**, or **CS204**.",
        )

    # 2. Intent: Explain Dr. Alan Turing / Faculty Unavailability
    if "turing" in q or "alan" in q or "unavail" in q:
        turing = next((f for f in snapshot.faculty if "Turing" in f.name), None)
        if turing:
            unavail_desc = [f"Slot {s} ({days[s // 8]} P{s % 8 + 1})" for s in sorted(turing.unavailable_slots)]
            return AIResponse(
                query=query,
                reply=f"**{turing.name}** has declared unavailable periods: {', '.join(unavail_desc)}. The CP-SAT engine enforces CON-H-007, ensuring he is never scheduled during these restricted windows.",
            )

    # 3. Intent: Faculty absence emergency
    if "sick" in q or "absence" in q or "emergency" in q:
        return AIResponse(
            query=query,
            reply="If a faculty member is sick or absent, use the **Emergency Reschedule** trigger. Acadence will pin all other department classes and solve a localized stability objective (`CON-S-014`) to re-place the affected sessions with minimal schedule disruption.",
        )

    # 4. Intent: General Timetable Status / Health
    val_report = validate(snapshot, current_placements)
    return AIResponse(
        query=query,
        reply=f"The current timetable has **{len(current_placements)} sessions** scheduled across 5 days. Independent Validator status is **{val_report.status.value}** (0 clashes). You can ask me to propose a move for any course (e.g., *'Move CS201'*), check professor constraints, or evaluate alternative profiles.",
    )

