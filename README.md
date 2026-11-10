# ACADENCE AI — NEP 2020 Intelligent Multidisciplinary Timetable Engine

[![Python 3.13](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![OR-Tools](https://img.shields.io/badge/Google%20OR--Tools-CP--SAT%209.15-orange.svg)](https://developers.google.com/optimization)
[![React 19](https://img.shields.io/badge/React-19%20%2B%20Tailwind%204-cyan.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-25%20Passing-emerald.svg)](https://pytest.org/)

**Government of Jammu & Kashmir — Higher Education Department**  
**Problem Statement ID:** `25091`  
**Theme:** Smart Automation | **Category:** Software  
**Pilot Institution:** *Govt. College of Education & Multidisciplinary Studies, J&K* (`INST_JK_HE_25091`)

---

## 🏛️ 1. Executive Summary & Problem Statement Alignment

With the rollout of the **National Education Policy (NEP) 2020**, higher education institutions across Jammu & Kashmir and India have transitioned to **Four-Year Undergraduate Programmes (FYUP)** and integrated teacher education curricula (**ITEP**, **B.Ed.**, **M.Ed.**). These programs introduce flexible, credit-based, multidisciplinary course architectures where students choose across Major (DSC), Multidisciplinary Minor, Skill Enhancement (SEC), Ability Enhancement (AEC), and Value-Added (VAC) categories, alongside field work and school teaching practice internships.

Manual timetable construction under this framework is combinatorially intractable. **Acadence AI** provides an autonomous, conflict-free, mathematically verified academic timetable generation system specifically tailored to NEP 2020 multidisciplinary structures.

```
                           ACADENCE AI ARCHITECTURE
  ┌────────────────────────────────────────────────────────────────────────┐
  │                        ACADEMIC DATA INPUT STUDIO                      │
  │  • Course Catalog   • Faculty Workload   • Room / Lab Infrastructure   │
  │  • Student Pathways • Bulk CSV Ingestion • AMS / ERP Integration       │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    GOOGLE OR-TOOLS CP-SAT ENGINE                       │
  │  • 12 Hard Constraints (CON-H-001 - CON-H-012)                         │
  │  • Parallel Minor Basket Synchronization (CON-H-011)                   │
  │  • UGC Workload Norms (14h Prof / 16h Asst Prof, Max 4h/day)           │
  │  • Soft Objectives: Gaps, Spread, Energy (CON-S-003, 004, 005, 008)    │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 DECOUPLED INDEPENDENT VALIDATOR ORACLE                 │
  │  • Zero-solver code dependency (VAL-001 through VAL-011)               │
  │  • Verification Certificate & Audit Trail                              │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼───────────────────────────┐
         ▼                            ▼                           ▼
┌──────────────────┐       ┌──────────────────────┐      ┌─────────────────┐
│ REACT WEB DASH   │       │  DYNAMIC SIMULATOR   │      │ MULTI-FORMAT    │
│ • Schedule Grid  │       │  • Emergency Absence │      │ EXPORT          │
│ • Drag/Drop Move │       │  • Delta-Rescheduler │      │ • Master Excel  │
│ • Student Pathway│       │    (CON-S-014)       │      │ • AMS JSON      │
│ • AI Copilot     │       │  • 0-Clash Guarantee │      │ • Official PDF  │
└──────────────────┘       └──────────────────────┘      └─────────────────┘
```

---

## 🎯 2. Expected Solution Checklist (Problem Statement 25091)

| Requirement from Govt of J&K PS 25091 | Acadence Implementation | Verification / Oracle |
|---|---|---|
| **Accepts structured inputs from academic, student, & faculty databases** | Academic Data Input Studio with Course, Faculty, Room, & CSV Ingestion portals | Snapshot validation + Pydantic v2 schemas |
| **Generates semester-wise timetable for multiple programs (FYUP, ITEP, B.Ed, M.Ed)** | Unified multi-program CP-SAT solver partitioning cohorts into conflict-free rooms & slots | Hard constraints `CON-H-001` - `CON-H-012` |
| **Prevents scheduling conflicts across faculty & infrastructure** | Zero teacher double-booking, zero room collision, zero cohort overlap | `VAL-001`, `VAL-002`, `VAL-003`, `VAL-004` |
| **Multidisciplinary Minor Basket Synchronization** | Exact concurrent start-slot equality (`CON-H-011`) for parallel electives (Economics, Math, Psychology) | `VAL-011` Basket Concurrency Check |
| **UGC Faculty Workload & Availability Compliance** | Professor 14h cap, Asst Prof 16h cap, 4h daily cap, unavailable slots | `CON-H-007`, `CON-H-008`, `VAL-007`, `VAL-008` |
| **Teaching Practice & Lab 2-Hour Blocks** | B.Ed. & ITEP school practice and SEC labs placed in contiguous slots without lunch splits | `CON-H-006`, `CON-H-009`, `VAL-006`, `VAL-009` |
| **Dynamic Editing & Live Delta-Move** | Click-to-move interactive validator computing valid target slots in real-time | `POST /api/timetable/move` + Oracle re-check |
| **Scenario Simulation ("What-If" Disruptions)** | Reschedules unexpected faculty absence using minimal-perturbation stability objective | `CON-S-014` rescheduler (`POST /api/simulate-scenario`) |
| **Exportable Formats (PDF, Excel, AMS JSON)** | Master Multi-Sheet Excel, Standardized ERP/AMS JSON, CSV, and Print Circular | `GET /api/export/xlsx`, `ams-json`, `csv`, `window.print()` |

---

## 🚀 3. Quickstart Guide

### Prerequisites
- **Python 3.11+** (Tested on Python 3.13)
- **Node.js 18+** and **npm**

### Step 1: Install Backend Dependencies
```bash
# Clone the repository
git clone https://github.com/organization/acadence.git
cd acadence

# Install backend dependencies
pip install -r backend/requirements.txt
```

### Step 2: Run the Backend API Service
```bash
# From repository root
python -m uvicorn acadence.api.app:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI documentation will be live at `http://127.0.0.1:8000/docs`.

### Step 3: Run the React Frontend
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Step 4: Run the Complete Automated Test Suite
```bash
# From repository root
python -m pytest tests -v
```
All 25 test suites verify solver optimality, oracle checks, API endpoints, exports, and scenario simulations.

---

## 💻 4. Where & How to Provide Inputs

Acadence provides **three input avenues** catering to timetable committees, administrators, and ERP engineers:

### Avenue A: Interactive Academic Data Input Studio (Web UI)
Click **`[ ⚙️ Academic Data Input Studio ]`** in the top navbar:
1. **Course Catalog Portal:** Add single-slot theory or 2-slot practical lab/internship courses with NEP category tags, credit hours, student cohorts, and teacher assignments.
2. **Faculty Workload & Availability Portal:** Configure weekly workload caps (14h vs 16h) and click any slot in the 5-day interactive matrix to mark a teacher unavailable (e.g. administrative duties or leave).
3. **Room & Specialized Infrastructure Portal:** Register Lecture Halls, Computer/AI Labs, Pedagogy Practice Rooms, and Science Labs with seat capacities.
4. **Student Pathway Simulator:** Select any student major cohort and their chosen minor elective (e.g., *Computer Science Major + Principles of Microeconomics Minor*) to visualize their personalized conflict-free schedule.
5. **Bulk CSV Ingestion:** Download templates, paste CSV content, and merge data directly into the active academic snapshot.

### Avenue B: Bulk CSV Ingestion & Standardized Templates
Standardized CSV templates can be downloaded directly from the UI or API:
- `GET /api/export/template/courses` -> Courses Master Template
- `GET /api/export/template/faculty` -> Faculty Master Template
- `GET /api/export/template/rooms` -> Infrastructure Master Template

Ingest CSV data via `POST /api/admin/upload-csv`:
```json
{
  "data_type": "COURSES",
  "csv_content": "course_id,course_name,program_type,nep_category,credits,sessions_per_week,duration_slots,group_ids,room_type_id,eligible_faculty_ids\nDSC-AI-301,Deep Learning,FYUP,MAJOR,4,3,1,GRP_FYUP_SEC_A,LECTURE_HALL,FAC_CS_01"
}
```

### Avenue C: REST API Endpoints
Academic management systems can feed data programmatically:
- `POST /api/admin/add-course` — Add a new curriculum course offering.
- `DELETE /api/admin/course/{id}` — Remove a course offering.
- `POST /api/admin/add-faculty` — Register faculty with designation and workload caps.
- `POST /api/admin/toggle-faculty-availability` — Restrict/enable specific day-period slots.
- `POST /api/admin/add-room` — Add classrooms, lecture halls, or labs.
- `POST /api/admin/reset` — Reset to default pilot institution baseline.

---

## 🧠 5. Mathematical Constraint Specification

Acadence implements a discrete constraint model in Google OR-Tools CP-SAT:

### Hard Constraints (Must NEVER be Violated)
1. `CON-H-001` **Session Completeness:** Exactly $N$ weekly sessions scheduled for every registered course requirement.
2. `CON-H-002` **Faculty Uniqueness:** A teacher cannot be scheduled in two places simultaneously.
3. `CON-H-003` **Room Uniqueness:** A physical classroom or lab cannot hold two sessions at the same time.
4. `CON-H-004` **Student Group Uniqueness:** A student cohort cannot be scheduled in two concurrent courses, with exact leaf-path handling.
5. `CON-H-005` **Room Suitability & Capacity:** Practical labs are placed in specialized rooms (e.g., Computer Lab, Pedagogy Room) with capacity $\ge$ class size.
6. `CON-H-006` **Contiguous Block Integrity:** 2-hour labs and practice blocks are scheduled in consecutive periods without mid-session breaks.
7. `CON-H-007` **Faculty Weekly Workload Cap:** Professor $\le 14$ hours/week; Assistant Professor $\le 16$ hours/week (UGC Regulations).
8. `CON-H-008` **Faculty Daily Cap & Availability:** Faculty cannot exceed 4 teaching hours per day and cannot be assigned to unavailable/leave slots.
9. `CON-H-009` **Lunch Break Protection:** Multi-hour sessions cannot bridge over the designated daily lunch interval (11:00 AM – 11:30 AM).
10. `CON-H-010` **Daily Course Limit:** A student group cannot have more than 1 session of the same course on the same day.
11. `CON-H-011` **Parallel Minor Basket Synchronization:** Multidisciplinary minor electives running across shared student cohorts are constrained to start at the exact identical period in distinct rooms:
    $$\text{start}(\text{Minor}_{\text{Eco}}) = \text{start}(\text{Minor}_{\text{Math}}) = \text{start}(\text{Minor}_{\text{Psy}})$$
12. `CON-H-012` **School Teaching Practice Block:** Dedicated teacher education internship blocks reserved without collisions.

### Independent Verification Oracle
The Independent Validator (`acadence/validator/validator.py`) contains **zero solver code** and operates purely as an audit oracle (`VAL-001` through `VAL-011`). Every timetable generation, move, or rescheduling operation is independently verified before being accepted.

---

## 🔄 6. Dynamic Scenarios & AI Copilot

### What-If Disruption Simulator
Higher education institutions frequently experience unexpected faculty absences, medical emergencies, or room repairs.
- **Scenario Simulation Modal:** Select any teacher and click "Execute Simulation".
- **Minimal Perturbation (`CON-S-014`):** The CP-SAT rescheduler locks all unaffected classes and moves only the impacted sessions into alternate clash-free slots.

### Acadence AI Copilot
Located in the right drawer, the AI Copilot accepts natural language queries:
- *"Can we move CS201 to another slot?"* -> Evaluates candidate slots and generates a one-click apply proposal.
- *"Why is Dr. Alan Turing restricted?"* -> Explains UGC weekly workload limits and booked slots.
- *"What happens if Dr. Turing is sick on Monday?"* -> Simulates immediate emergency coverage.

---

## 📊 7. Multi-Format Exports

1. **J&K Master Multi-Sheet Excel Workbook (`.xlsx`):**
   - Individual formatted grid sheets for every student section, faculty member, and classroom.
   - Formula injection sanitization (`HOLE-019`) and automated sheet name compliance.
2. **Standardized ERP / AMS JSON (`/api/export/ams-json`):**
   - Standardized schema for seamless sync with existing J&K Academic Management Systems.
3. **Official Printable Timetable Circular (PDF / Print):**
   - Clean, professional, high-contrast institutional circular formatted for government circulation with `@media print` styling.

---

## 🏛️ Pilot Institution Profile

- **Institution:** Govt. College of Education & Multidisciplinary Studies, J&K
- **Institution Code:** `INST_JK_HE_25091`
- **Location:** Srinagar / Jammu, UT of Jammu and Kashmir
- **Programs Covered:**
  - FYUP Semester 3 (Sections A & B)
  - ITEP B.Sc.-B.Ed. Semester 5
  - B.Ed. Secondary Teacher Education Semester 3
  - M.Ed. Postgraduate Teacher Education Semester 3
- **Weekly Schedule Grid:** Monday to Friday (5 Days), 8 Periods/Day (08:30 – 15:40) with dedicated lunch break.

---

## 📄 License & Intellectual Property

Developed for the **Higher Education Department, Government of Jammu & Kashmir** under the **Smart Automation (Software)** theme. All rights reserved.

