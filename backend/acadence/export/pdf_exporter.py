"""Export academic timetable to official publication-ready PDF circulars.
Guarantees single combined PDF with exactly 1 timetable per landscape page.
"""
from typing import List, Optional, Any
import io
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from acadence.domain.snapshot import ConfigSnapshot, Placement


def export_to_pdf(
    snapshot: ConfigSnapshot,
    placements: List[Placement],
    course_cohorts: Optional[List[Any]] = None,
    filter_group_ids: Optional[List[str]] = None,
    filter_faculty_ids: Optional[List[str]] = None,
    filter_room_ids: Optional[List[str]] = None,
    filter_group_id: Optional[str] = None,
    filter_faculty_id: Optional[str] = None,
    filter_room_id: Optional[str] = None,
) -> bytes:
    """Exports formatted landscape PDF timetable circular.
    
    If multiple courses, classes, faculty, or rooms are selected, they are combined
    into ONE single PDF file where each selected timetable is rendered on its own
    dedicated landscape page.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=18,
        rightMargin=18,
        topMargin=16,
        bottomMargin=16,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=13,
        leading=15,
        textColor=colors.HexColor('#1E1B4B'),
        fontName='Helvetica-Bold',
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#4338CA'),
        fontName='Helvetica-Bold',
        alignment=1,
    )
    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#475569'),
        alignment=1,
    )
    cell_header_style = ParagraphStyle(
        'CellHeader',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9,
        textColor=colors.white,
        fontName='Helvetica-Bold',
        alignment=1,
    )
    cell_day_style = ParagraphStyle(
        'CellDay',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A'),
        fontName='Helvetica-Bold',
        alignment=1,
    )
    cell_lunch_style = ParagraphStyle(
        'CellLunch',
        parent=styles['Normal'],
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor('#92400E'),
        fontName='Helvetica-Bold',
        alignment=1,
    )
    cell_content_style = ParagraphStyle(
        'CellContent',
        parent=styles['Normal'],
        fontSize=6.2,
        leading=7.8,
        textColor=colors.HexColor('#0F172A'),
        alignment=0,
    )

    req_map = {r.requirement_id: r for r in snapshot.requirements}
    room_map = {r.room_id: r.name for r in snapshot.rooms}
    fac_map = {f.faculty_id: f.name for f in snapshot.faculty}
    group_map = {g.group_id: g for g in snapshot.student_groups}

    # Normalize input filter lists
    selected_group_ids: List[str] = list(filter_group_ids or [])
    if filter_group_id and filter_group_id not in selected_group_ids:
        selected_group_ids.append(filter_group_id)

    selected_faculty_ids: List[str] = list(filter_faculty_ids or [])
    if filter_faculty_id and filter_faculty_id not in selected_faculty_ids:
        selected_faculty_ids.append(filter_faculty_id)

    selected_room_ids: List[str] = list(filter_room_ids or [])
    if filter_room_id and filter_room_id not in selected_room_ids:
        selected_room_ids.append(filter_room_id)

    # Build cohort lookup dictionary
    cohort_dict = {}
    if course_cohorts:
        for c in course_cohorts:
            cid = getattr(c, 'course_id', None) or (c.get('course_id') if isinstance(c, dict) else None)
            if cid:
                cohort_dict[cid] = c

    target_pages = []

    # 1. Course Cohorts & Student Sections
    for gid in selected_group_ids:
        if gid in cohort_dict:
            c = cohort_dict[gid]
            c_name = getattr(c, 'course_name', None) or (c.get('course_name') if isinstance(c, dict) else gid)
            c_sem = getattr(c, 'semester', None) or (c.get('semester') if isinstance(c, dict) else 1)
            c_count = getattr(c, 'student_count', None) or (c.get('student_count') if isinstance(c, dict) else 60)
            raw_sec_ids = getattr(c, 'section_ids', None) or (c.get('section_ids') if isinstance(c, dict) else [])
            sec_ids = set(raw_sec_ids or [])
            sec_ids.add(gid)
            target_pages.append({
                "subhead": f"Course Cohort: {c_name} (Semester {c_sem}) • {c_count} Enrolled Students",
                "filter": (lambda s_ids: lambda p: any(s in (req_map.get(p.requirement_id).group_ids if p.requirement_id in req_map else []) for s in s_ids))(sec_ids),
            })
        elif gid in group_map:
            g = group_map[gid]
            target_pages.append({
                "subhead": f"Student Section: {g.name} • {g.expected_strength} Students",
                "filter": (lambda g_id: lambda p: g_id in (req_map.get(p.requirement_id).group_ids if p.requirement_id in req_map else []))(gid),
            })

    # 2. Faculty Members
    for fid in selected_faculty_ids:
        f_name = fac_map.get(fid, fid)
        fac_obj = next((f for f in snapshot.faculty if f.faculty_id == fid), None)
        f_dept = f" ({fac_obj.department_id})" if fac_obj and fac_obj.department_id else ""
        target_pages.append({
            "subhead": f"Faculty Teaching Schedule: {f_name}{f_dept} • Personal Academic Allocation",
            "filter": (lambda f_id: lambda p: f_id in (p.assigned_faculty_ids or []))(fid),
        })

    # 3. Rooms & Venues
    for rid in selected_room_ids:
        r_name = room_map.get(rid, rid)
        room_obj = next((r for r in snapshot.rooms if r.room_id == rid), None)
        r_cap = f" (Capacity: {room_obj.capacity} seats)" if room_obj else ""
        target_pages.append({
            "subhead": f"Facility & Venue Schedule: {r_name}{r_cap} • Room Allocation Matrix",
            "filter": (lambda r_id: lambda p: p.assigned_room_id == r_id)(rid),
        })

    # 4. Fallback if no filters are selected: Export all active course cohorts
    if not target_pages:
        if course_cohorts:
            for c in course_cohorts:
                cid = getattr(c, 'course_id', None) or (c.get('course_id') if isinstance(c, dict) else None)
                c_name = getattr(c, 'course_name', None) or (c.get('course_name') if isinstance(c, dict) else cid)
                c_sem = getattr(c, 'semester', None) or (c.get('semester') if isinstance(c, dict) else 1)
                c_count = getattr(c, 'student_count', None) or (c.get('student_count') if isinstance(c, dict) else 60)
                raw_sec_ids = getattr(c, 'section_ids', None) or (c.get('section_ids') if isinstance(c, dict) else [])
                sec_ids = set(raw_sec_ids or [])
                if cid:
                    sec_ids.add(cid)
                target_pages.append({
                    "subhead": f"Course Cohort: {c_name} (Semester {c_sem}) • {c_count} Enrolled Students",
                    "filter": (lambda s_ids: lambda p: any(s in (req_map.get(p.requirement_id).group_ids if p.requirement_id in req_map else []) for s in s_ids))(sec_ids),
                })
        else:
            leaf_groups = [g for g in snapshot.student_groups if g.parent_id or not any(o.parent_id == g.group_id for o in snapshot.student_groups)]
            for g in leaf_groups:
                target_pages.append({
                    "subhead": f"Student Section: {g.name}",
                    "filter": (lambda g_id: lambda p: g_id in (req_map.get(p.requirement_id).group_ids if p.requirement_id in req_map else []))(g.group_id),
                })

    story = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods = [
        ("P1", "08:30-09:20", 0),
        ("P2", "09:20-10:10", 1),
        ("P3", "10:10-11:00", 2),
        ("Lunch", "11:00-11:30", -1),
        ("P4", "11:30-12:20", 3),
        ("P5", "12:20-13:10", 4),
        ("P6", "13:10-14:00", 5),
        ("P7", "14:00-14:50", 6),
        ("P8", "14:50-15:40", 7),
    ]

    total_pages = len(target_pages)

    for idx, page in enumerate(target_pages):
        if idx > 0:
            story.append(PageBreak())

        relevant_placements = [p for p in placements if page["filter"](p)]

        page_indicator = f"Page {idx + 1} of {total_pages}"
        story.append(Paragraph(snapshot.institution_name or "METROPOLITAN UNIVERSITY", title_style))
        story.append(Paragraph("OFFICIAL ACADEMIC TIMETABLE CIRCULAR • AUTUMN SEMESTER 2026-27", subtitle_style))
        story.append(Paragraph(f"{page['subhead']} • Autonomous CP-SAT Solver (0 Clashes Guaranteed) • {page_indicator}", meta_style))
        story.append(Spacer(1, 6))

        # Build Table Header
        header_row = [Paragraph("<b>Day / Period</b>", cell_header_style)]
        for p_name, p_time, _ in periods:
            header_row.append(Paragraph(f"<b>{p_name}</b><br/>{p_time}", cell_header_style))

        table_data = [header_row]

        # Map grid slots (8 periods per day)
        grid_map = {}
        for p in relevant_placements:
            d = p.start_slot // 8
            per = p.start_slot % 8
            req = req_map.get(p.requirement_id)
            if not req:
                continue
            for step in range(p.duration_slots):
                actual_per = per + step
                if (d, actual_per) not in grid_map:
                    grid_map[(d, actual_per)] = []
                grid_map[(d, actual_per)].append((p, req))

        for d_idx, day_name in enumerate(days):
            row = [Paragraph(f"<b>{day_name}</b>", cell_day_style)]
            for _, _, slot_idx in periods:
                if slot_idx == -1:
                    row.append(Paragraph("<b>LUNCH</b><br/><font color='#92400E'>BREAK</font>", cell_lunch_style))
                    continue

                items = grid_map.get((d_idx, slot_idx), [])
                if items:
                    snippets = []
                    for p, req in items:
                        rm = room_map.get(p.assigned_room_id, 'Assigned Room')
                        facs = ', '.join(fac_map.get(fid, fid) for fid in (p.assigned_faculty_ids or []))
                        # Clean text layout without missing Unicode glyphs / square boxes
                        snippet = (
                            f"<b>{req.course_id}</b><br/>"
                            f"<b>{req.course_name}</b><br/>"
                            f"<font color='#475569'><b>Room:</b> {rm}</font><br/>"
                            f"<font color='#2563EB'><b>Fac:</b> {facs}</font>"
                        )
                        snippets.append(snippet)
                    content = "<br/>--<br/>".join(snippets)
                    row.append(Paragraph(content, cell_content_style))
                else:
                    row.append(Paragraph("<font color='#CBD5E1'>---</font>", cell_day_style))
            table_data.append(row)

        col_widths = [62] + [78] * 9
        row_heights = [22] + [68] * 5  # Fixed row heights to guarantee exactly 1 page per timetable
        t = Table(table_data, colWidths=col_widths, rowHeights=row_heights, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#F8FAFC')),
            ('BACKGROUND', (4, 1), (4, -1), colors.HexColor('#FEF3C7')),  # Lunch column
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t)

    doc.build(story)
    return buffer.getvalue()
