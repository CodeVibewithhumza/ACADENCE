# ACADENCE AI — Intelligent Autonomous Timetable & Academic Scheduling Engine

[![Python 3.13](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![OR-Tools](https://img.shields.io/badge/Google%20OR--Tools-CP--SAT%209.15-orange.svg)](https://developers.google.com/optimization)
[![React 19](https://img.shields.io/badge/React-19%20%2B%20Tailwind%204-cyan.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-25%20Passing-emerald.svg)](https://pytest.org/)

**Enterprise Academic Timetable & Scheduling Platform**  
**Theme:** Smart Academic Automation | **Category:** Enterprise Higher Education Software  
**Reference Institution:** *Metropolitan University*

---

## 🏛️ 1. Executive Summary & Architecture

Modern universities and colleges manage complex, credit-based, multidisciplinary curricula where students select individual course combinations across majors, multidisciplinary minors, skill labs, and electives. 

Constructing conflict-free timetables across diverse academic departments, faculty workload quotas, specialized laboratory facilities, and student cohorts is combinatorially intractable when done manually.

**Acadence AI** provides an autonomous, conflict-free, mathematically verified academic timetable generation and scheduling platform powered by Google OR-Tools CP-SAT and an independent verification oracle.

```
                           ACADENCE AI ARCHITECTURE
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 ACADEMIC DATA INPUT STUDIO & SETTINGS                  │
  │  • Course Catalog   • Faculty Workload   • Room / Lab Infrastructure   │
  │  • Student Pathways • Bulk CSV Ingestion • AMS / ERP Integration       │
  │  • Role-Based Access Control (RBAC)      • Supabase Ready              │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    GOOGLE OR-TOOLS CP-SAT ENGINE                       │
  │  • 12 Hard Constraints (CON-H-001 - CON-H-012)                         │
  │  • Parallel Elective Basket Synchronization (CON-H-011)                │
  │  • Faculty Workload Norms (14h Prof / 16h Asst Prof, Max 4h/day)       │
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
         ┌────────────────────────────────────────────────────────┐
         ▼                                                        ▼
┌──────────────────┐                                     ┌─────────────────┐
│ REACT WEB DASH   │                                     │ MULTI-FORMAT    │
│ • Schedule Grid  │                                     │ EXPORT          │
│ • Drag/Drop Move │                                     │ • Master Excel  │
│ • Student Pathway│                                     │ • AMS JSON      │
│ • RBAC & Sidebar │                                     │ • Official PDF  │
│ • Settings Mgmt  │                                     │ • CSV Data      │
└──────────────────┘                                     └─────────────────┘
```

---

## 🎯 2. Core Functional Capabilities Checklist

| Institutional Capability | Acadence Implementation | Verification / Oracle |
|---|---|---|
| **Accepts structured inputs from academic, student, & faculty databases** | Academic Data Input Studio with Course, Faculty, Room, & CSV Ingestion portals | Snapshot validation + Pydantic v2 schemas |
| **Generates semester-wise timetable for multiple programs & cohorts** | Unified CP-SAT solver partitioning cohorts into conflict-free rooms & slots | Hard constraints `CON-H-001` - `CON-H-012` |
| **Prevents scheduling conflicts across faculty & infrastructure** | Zero teacher double-booking, zero room collision, zero cohort overlap | `VAL-001`, `VAL-002`, `VAL-003`, `VAL-004` |
| **Concurrent Elective Basket Synchronization** | Exact concurrent start-slot equality (`CON-H-011`) for parallel multidisciplinary electives | `VAL-011` Basket Concurrency Check |
| **Faculty Workload & Availability Compliance** | Professor 14h cap, Asst Prof 16h cap, 4h daily cap, unavailable slots | `CON-H-007`, `CON-H-008`, `VAL-007`, `VAL-008` |
| **Multi-Hour Lab & Practice Blocks** | Laboratory and practicum sessions placed in contiguous slots without lunch splits | `CON-H-006`, `CON-H-009`, `VAL-006`, `VAL-009` |
| **Dynamic Editing & Live Delta-Move** | Click-to-move interactive validator computing valid target slots in real-time | `POST /api/timetable/move` + Oracle re-check |
| **Role-Based Access Control (RBAC)** | Admin, Coordinator, Faculty, and Student roles with fine-grained view and action controls | JWT-ready auth + live role simulation |
| **System Administration & Settings** | User account management, role permissions matrix, institutional parameters, Supabase config | `/api/settings`, `/api/auth/users`, `/api/audit-logs` |
| **Exportable Formats (PDF, Excel, AMS JSON)** | Master Multi-Sheet Excel, Standardized ERP/AMS JSON, CSV, and Print Circular | `GET /api/export/xlsx`, `ams-json`, `csv`, `window.print()` |

---

## 🔐 3. Authentication & Role-Based Access Control (RBAC)

Acadence includes a built-in authentication and permission system designed for easy integration with Supabase or enterprise identity providers:

- **Default Root Administrator:**
  - **Email:** `hello@123.com`
  - **Password:** `123`
- **Supported Roles:**
  - `ADMIN`: Complete system access, user management, solver execution, settings editing, and snapshot resets.
  - `COORDINATOR`: Course/faculty creation, schedule optimization, and live session moves.
  - `FACULTY`: Personal schedule inspection, availability toggle requests, and department calendar views.
  - `STUDENT`: Read-only personalized elective pathway schedule view.

---

## 🚀 4. Quickstart Guide

### Prerequisites
- **Python 3.11+** (Tested on Python 3.13)
- **Node.js 18+** and **npm**

### Quick Start (1-Click Run)
Double-click `run.bat` or run:
```powershell
.\run.ps1
```
This automatically launches both the FastAPI backend (`:8000`) and the Vite web client (`:5173`).

---

### Manual Step-by-Step Setup

### Step 1: Install Backend Dependencies
```bash
# Clone the repository
git clone https://github.com/organization/acadence.git
cd acadence

# Install backend dependencies
py -3.13 -m pip install -r backend/requirements.txt
```

### Step 2: Run the Backend API Service
```bash
# From repository root (or cd backend)
py -3.13 -m uvicorn acadence.api.app:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI documentation will be live at `http://127.0.0.1:8000/docs`.

### Step 3: Run the React Frontend
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:5173` in your browser and log in with `hello@123.com` / `123`.

### Step 4: Run the Complete Automated Test Suite
```bash
# From repository root
py -3.13 -m pytest tests -v
```
All automated test suites verify solver optimality, oracle checks, API endpoints, exports, and scenario simulations.

---

## 💻 5. Where & How to Provide Inputs

Acadence provides **three input avenues** catering to timetable committees, administrators, and ERP engineers:

### Avenue A: Interactive Academic Data Input Studio (Web UI)
Click **`[ ⚙️ Academic Data Input Studio ]`** in the top navbar or sidebar:
1. **Course Catalog Portal:** Add single-slot theory or multi-slot practical lab courses with category tags, credit hours, student cohorts, and teacher assignments.
2. **Faculty Workload & Availability Portal:** Configure weekly workload caps and click any slot in the 5-day interactive matrix to mark a teacher unavailable (e.g. administrative duties, leave, or research days).
3. **Room & Specialized Infrastructure Portal:** Register Lecture Halls, Computer/AI Labs, Pedagogy Practice Rooms, and Science Labs with seat capacities.
4. **Student Pathway Simulator:** Select any student major cohort and their chosen minor elective to visualize their personalized conflict-free schedule.
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
  "csv_content": "course_id,course_name,program_type,nep_category,credits,sessions_per_week,duration_slots,group_ids,room_type_id,eligible_faculty_ids\nCS-301,Deep Learning,UG,MAJOR,4,3,1,GRP_UG_SEC_A,LECTURE_HALL,FAC_CS_01"
}
```

### Avenue C: REST API Endpoints
Academic management systems can feed data programmatically:
- `POST /api/admin/add-course` — Add a new curriculum course offering.
- `DELETE /api/admin/course/{id}` — Remove a course offering.
- `POST /api/admin/add-faculty` — Register faculty with designation and workload caps.
- `POST /api/admin/toggle-faculty-availability` — Restrict/enable specific day-period slots.
- `POST /api/admin/add-room` — Add classrooms, lecture halls, or labs.
- `POST /api/admin/reset` — Reset to default baseline snapshot.

---

## 🧠 6. Mathematical Constraint Specification

Acadence implements a discrete constraint model in Google OR-Tools CP-SAT:

### Hard Constraints (Must NEVER be Violated)
1. `CON-H-001` **Session Completeness:** Exactly $N$ weekly sessions scheduled for every registered course requirement.
2. `CON-H-002` **Faculty Uniqueness:** A teacher cannot be scheduled in two places simultaneously.
3. `CON-H-003` **Room Uniqueness:** A physical classroom or lab cannot hold two sessions at the same time.
4. `CON-H-004` **Student Group Uniqueness:** A student cohort cannot be scheduled in two concurrent courses.
5. `CON-H-005` **Room Suitability & Capacity:** Practical labs are placed in specialized rooms with capacity $\ge$ class size.
6. `CON-H-006` **Contiguous Block Integrity:** Multi-hour labs and practice blocks are scheduled in consecutive periods without mid-session breaks.
7. `CON-H-007` **Faculty Weekly Workload Cap:** Professor $\le 14$ hours/week; Assistant Professor $\le 16$ hours/week.
8. `CON-H-008` **Faculty Daily Cap & Availability:** Faculty cannot exceed daily teaching hour limits and cannot be assigned to unavailable/leave slots.
9. `CON-H-009` **Lunch Break Protection:** Multi-hour sessions cannot bridge over the designated daily lunch interval.
10. `CON-H-010` **Daily Course Limit:** A student group cannot have more than 1 session of the same course on the same day.
11. `CON-H-011` **Parallel Elective Basket Synchronization:** Cross-departmental electives running across shared student cohorts are constrained to start at the exact identical period in distinct rooms.
12. `CON-H-012` **Dedicated Field / Practice Blocks:** Dedicated practicum or internship blocks reserved without collisions.

### Independent Verification Oracle
The Independent Validator (`acadence/validator/validator.py`) contains **zero solver code** and operates purely as an audit oracle (`VAL-001` through `VAL-011`). Every timetable generation, move, or rescheduling operation is independently verified before being accepted.

---

## 📊 7. Multi-Format Exports

1. **Master Multi-Sheet Excel Workbook (`.xlsx`):**
   - Individual formatted grid sheets for every student section, faculty member, and classroom.
   - Formula injection sanitization and automated sheet name compliance.
2. **Standardized ERP / AMS JSON (`/api/export/ams-json`):**
   - Standardized schema for seamless sync with existing University Academic Management Systems.
3. **Official Printable Timetable Circular (PDF / Print):**
   - Clean, professional, high-contrast institutional circular formatted for university circulation with `@media print` styling.

---

## 🏛️ Default Institutional Configuration

- **Institution:** Metropolitan University
- **Institution Code:** `INST_DEMO_001`
- **Curriculum Model:** Semester & Credit-Based System
- **Weekly Schedule Grid:** Monday to Friday (5 Days), 7 Periods/Day with dedicated lunch break.

---

## 📄 License & Intellectual Property

Acadence AI — Autonomous Academic Timetable & Scheduling Optimization System. All rights reserved.
