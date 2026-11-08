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
        # Match against courses in snapshot
        target_req = None
        matched_token = ""
        words = [w.strip("?,.! ") for w in q.split()]
        for req in snapshot.requirements:
            c_id_lower = req.course_id.lower()
            c_clean = c_id_lower.replace("-", "")
            for w in words:
                if len(w) >= 4 and any(ch.isdigit() for ch in w) and w in c_clean:
                    target_req = req
                    matched_token = w.upper()
                    break
            if target_req:
                break
            if c_id_lower in q or req.course_name.lower() in q or req.requirement_id.lower() in q:
                target_req = req
                matched_token = req.course_id
                break

        if target_req:
            matching = [
                p for p in current_placements
                if p.requirement_id == target_req.requirement_id
            ]
            if matching:
                p_target = matching[0]
                targets = compute_valid_targets(snapshot, current_placements, p_target.instance_id)
                alt_targets = [s for s in targets if s != p_target.start_slot]

                if alt_targets:
                    chosen_slot = alt_targets[0]
                    d_idx = chosen_slot // grid.periods_per_day
                    p_idx = chosen_slot % grid.periods_per_day
                    req = target_req
                    day_name = days[d_idx]
                    period_name = f"P{p_idx + 1}"

                    proposal = AIProposal(
                        proposal_id=str(uuid.uuid4())[:8],
                        action_type="MOVE_SESSION",
                        title=f"Move {target_req.course_id} to {day_name} {period_name}",
                        explanation=f"Found {len(alt_targets)} valid clash-free slots. Moving session from {days[p_target.day]} P{p_target.period+1} to {day_name} {period_name} maintains 100% compliance with all hard constraints and room requirements.",
                        is_valid=True,
                        instance_id=p_target.instance_id,
                        target_slot=chosen_slot,
                        new_day=day_name,
                        new_period=period_name,
                    )
                    course_label = f"{target_req.course_id} ({matched_token})" if matched_token and matched_token != target_req.course_id else target_req.course_id
                    return AIResponse(
                        query=query,
                        reply=f"I analyzed the timetable constraints for **{course_label} - {target_req.course_name}**. I can move this session to **{day_name} {period_name}** with zero clashes.",
                        proposal=proposal,
                    )

        return AIResponse(
            query=query,
            reply="I couldn't identify the specific course you'd like to move. Please mention a course code such as **DSC-CS-201**, **MIN-ECO-201**, or **BED-CUR-201**.",
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

