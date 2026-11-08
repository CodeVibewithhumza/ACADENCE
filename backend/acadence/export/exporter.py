"""Timetable export engine for CSV and Excel (.xlsx) formats.
Follows Section 19 (File Export) and HOLE-019 (Formula injection protection).
"""
import io
import csv
import re
from typing import Dict, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from acadence.domain.snapshot import ConfigSnapshot, Placement


def sanitize_cell(value: str) -> str:
    """Sanitizes text against Excel formula injection per HOLE-019."""
    if not value:
        return ""
    if value[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{value}"
    return value


def export_to_csv(
    snapshot: ConfigSnapshot,
    placements: List[Placement],
    filter_group_id: Optional[str] = None,
    filter_faculty_id: Optional[str] = None,
    filter_room_id: Optional[str] = None,
) -> str:
    """Exports timetable placements to standard CSV format."""
    grid = snapshot.time_grid
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods = [f"Period {p+1}" for p in range(grid.periods_per_day)]
    req_map = {r.requirement_id: r for r in snapshot.requirements}
    fac_map = {f.faculty_id: f.name for f in snapshot.faculty}
    room_map = {r.room_id: r.name for r in snapshot.rooms}

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["Day"] + periods)

    # Grid mapping: (day, period) -> list of strings
    cells: Dict[tuple[int, int], List[str]] = {}

    for p in placements:
        req = req_map.get(p.requirement_id)
        if not req:
            continue

        # Check filter
        if filter_group_id and filter_group_id not in req.group_ids:
            continue
        if filter_faculty_id and filter_faculty_id not in p.assigned_faculty_ids:
            continue
        if filter_room_id and p.assigned_room_id != filter_room_id:
            continue

        fac_names = ", ".join([fac_map.get(fid, fid) for fid in p.assigned_faculty_ids])
        rm_name = room_map.get(p.assigned_room_id, p.assigned_room_id or "Virtual")
        cell_text = f"{req.course_id} ({rm_name} - {fac_names})"

        for step in range(p.duration_slots):
            key = (p.day, p.period + step)
            if key not in cells:
                cells[key] = []
            cells[key].append(cell_text)

    # Rows
    for d_idx, day_name in enumerate(days):
        row = [day_name]
        for p_idx in range(grid.periods_per_day):
            val = " / ".join(cells.get((d_idx, p_idx), [])) or "---"
            row.append(sanitize_cell(val))
        writer.writerow(row)

    return output.getvalue()


def export_to_xlsx(
    snapshot: ConfigSnapshot,
    placements: List[Placement],
) -> bytes:
    """Exports formatted multi-sheet timetable to Excel (.xlsx) workbook."""
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    grid = snapshot.time_grid
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    req_map = {r.requirement_id: r for r in snapshot.requirements}
    fac_map = {f.faculty_id: f.name for f in snapshot.faculty}
    room_map = {r.room_id: r.name for r in snapshot.rooms}

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    day_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    day_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    cell_font = Font(name="Calibri", size=9)
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    border_side = Side(style="thin", color="CBD5E1")
    cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)

    # Create sheet for each student section
    sections = [g for g in snapshot.student_groups if not g.parent_id or "SEC_" in g.group_id]

    for sec in sections:
        clean_sheet_title = re.sub(r'[:\\/?*\[\]]', '-', sec.name)[:30]
        ws = wb.create_sheet(title=clean_sheet_title)
        ws.row_dimensions[1].height = 28

        # Title
        ws.cell(row=1, column=1, value=f"ACADENCE Academic Timetable — {sec.name}").font = Font(size=14, bold=True, color="1E1B4B")
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=grid.periods_per_day + 1)

        # Header row
        header_row = 3
        ws.row_dimensions[header_row].height = 24
        ws.cell(row=header_row, column=1, value="Day").font = header_font
        ws.cell(row=header_row, column=1).fill = header_fill
        ws.cell(row=header_row, column=1).alignment = center_align

        for p in range(grid.periods_per_day):
            col = p + 2
            c = ws.cell(row=header_row, column=col, value=f"Period {p+1}")
            c.font = header_font
            c.fill = header_fill
            c.alignment = center_align

        # Map section placements
        grid_map = {}
        for p in placements:
            req = req_map.get(p.requirement_id)
            if not req:
                continue
            if sec.group_id in req.group_ids or any(sec.group_id in g for g in req.group_ids):
                fac_name = ", ".join([fac_map.get(f, f) for f in p.assigned_faculty_ids])
                rm_name = room_map.get(p.assigned_room_id, "Virtual")
                text = f"{req.course_id}\n{rm_name}\n({fac_name})"
                for step in range(p.duration_slots):
                    grid_map[(p.day, p.period + step)] = text

        for d_idx, day_name in enumerate(days):
            curr_row = header_row + 1 + d_idx
            ws.row_dimensions[curr_row].height = 45
            day_cell = ws.cell(row=curr_row, column=1, value=day_name)
            day_cell.font = day_font
            day_cell.fill = day_fill
            day_cell.alignment = center_align
            day_cell.border = cell_border

            for p_idx in range(grid.periods_per_day):
                val = grid_map.get((d_idx, p_idx), "—")
                cell = ws.cell(row=curr_row, column=p_idx + 2, value=sanitize_cell(val))
                cell.font = cell_font
                cell.alignment = center_align
                cell.border = cell_border
                if val != "—":
                    cell.fill = PatternFill(start_color="EEF2FF", end_color="EEF2FF", fill_type="solid")

        # Column widths
        ws.column_dimensions["A"].width = 16
        for p in range(grid.periods_per_day):
            col_letter = openpyxl.utils.get_column_letter(p + 2)
            ws.column_dimensions[col_letter].width = 22

    stream = io.BytesIO()
    wb.save(stream)
    return stream.getvalue()

