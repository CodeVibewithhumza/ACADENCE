"""NEP 2020 Multidisciplinary Institution Dataset Generator.
Tailored for Problem Statement 25091 (Higher Education Dept, Govt of Jammu & Kashmir).
Implements Four-Year Undergraduate Programme (FYUP), ITEP, B.Ed., M.Ed.,
Multidisciplinary Minor Baskets, SEC labs, AEC, VAC, and School Teaching Practice blocks.
"""
from typing import List, Set
from acadence.domain.enums import NEPCategory, ProgramType
from acadence.domain.snapshot import (
    ConfigSnapshot,
    TimeGrid,
    TimeSlot,
    StudentGroup,
    Room,
    Faculty,
    SessionRequirement,
    ElectiveGroup,
    CourseRelationship,
)


def generate_nep2020_institution_snapshot(seed: int = 42) -> ConfigSnapshot:
    """Generates a complete, realistic Higher Education Institution aligned with NEP 2020."""
    # 1. Standard 5-day academic grid (Monday to Friday, 8 periods/day = 40 slots)
    num_days = 5
    periods_per_day = 8
    slots: List[TimeSlot] = []

    for d in range(num_days):
        for p in range(periods_per_day):
            g_idx = d * periods_per_day + p
            is_break = (p == 3)  # Lunch break after period 3 (11:00 - 11:30)
            slots.append(
                TimeSlot(
                    slot_id=f"SLOT_{d}_{p}",
                    day=d,
                    period=p,
                    global_index=g_idx,
                    is_teachable=True,
                    break_after=is_break,
                )
            )

    grid = TimeGrid(
        grid_id="GRID_NEP_2020",
        name="NEP 2020 Unified Master Time Grid",
        num_days=num_days,
        periods_per_day=periods_per_day,
        slots=slots,
    )

    # 2. Student Groups: Multidisciplinary Programs
    student_groups = [
        # FYUP (Four-Year Undergraduate Programme - Sem 3)
        StudentGroup(
            group_id="GRP_FYUP_Y2",
            name="FYUP Multidisciplinary (Year 2 / Sem 3)",
            expected_strength=120,
            program_type=ProgramType.FYUP,
            semester=3,
        ),
        StudentGroup(
            group_id="GRP_FYUP_SEC_A",
            name="FYUP Section A (Major: Comp Sci & Physical Sci)",
            parent_id="GRP_FYUP_Y2",
            expected_strength=60,
            program_type=ProgramType.FYUP,
            semester=3,
        ),
        StudentGroup(
            group_id="GRP_FYUP_SEC_B",
            name="FYUP Section B (Major: Humanities & Social Sci)",
            parent_id="GRP_FYUP_Y2",
            expected_strength=60,
            program_type=ProgramType.FYUP,
            semester=3,
        ),
        # ITEP (Integrated Teacher Education Programme - 4-Year B.Sc.-B.Ed. Sem 5)
        StudentGroup(
            group_id="GRP_ITEP_SEM5",
            name="ITEP B.Sc.-B.Ed. (Semester 5)",
            expected_strength=50,
            program_type=ProgramType.ITEP,
            semester=5,
        ),
        # B.Ed. (2-Year Bachelor of Education - Sem 3)
        StudentGroup(
            group_id="GRP_BED_SEM3",
            name="B.Ed. Teacher Education (Semester 3)",
            expected_strength=50,
            program_type=ProgramType.B_ED,
            semester=3,
        ),
        # M.Ed. (2-Year Master of Education - Sem 3)
        StudentGroup(
            group_id="GRP_MED_SEM3",
            name="M.Ed. Advanced Education & Research (Sem 3)",
            expected_strength=30,
            program_type=ProgramType.M_ED,
            semester=3,
        ),
    ]

    # 3. Infrastructure & Classrooms
    rooms = [
        # Smart Lecture Halls
        Room(room_id="SMART_LH_101", name="Smart Lecture Hall 101", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD", "AUDIO_VISUAL"}),
        Room(room_id="SMART_LH_102", name="Smart Lecture Hall 102", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD", "AUDIO_VISUAL"}),
        Room(room_id="SMART_LH_103", name="Smart Lecture Hall 103", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD"}),
        Room(room_id="SMART_LH_104", name="Smart Lecture Hall 104", room_type_id="LECTURE_HALL", capacity=75, features={"SMART_BOARD"}),
        # Specialized Labs
        Room(room_id="COMP_LAB_1", name="Computer & AI Laboratory", room_type_id="COMPUTER_LAB", capacity=65, features={"COMPUTERS", "INTERNET"}),
        Room(room_id="COMP_LAB_2", name="Digital Skills & Analytics Lab", room_type_id="COMPUTER_LAB", capacity=65, features={"COMPUTERS", "INTERNET"}),
        Room(room_id="PEDAGOGY_LAB_1", name="Teacher Education Pedagogy Hall", room_type_id="PEDAGOGY_ROOM", capacity=60, features={"MICRO_TEACHING", "SMART_BOARD"}),
        Room(room_id="SCIENCE_LAB_1", name="Multidisciplinary Science Lab", room_type_id="SCIENCE_LAB", capacity=60, features={"LAB_EQUIPMENT"}),
    ]

    # 4. Multidisciplinary Faculty (UGC/NEP workload rules: 16 hours max per week)
    faculty = [
        # Computer Science
        Faculty(faculty_id="FAC_CS_01", name="Dr. Alan Turing", department_id="COMPUTER_SCIENCE", designation="Professor", unavailable_slots={0}),
        Faculty(faculty_id="FAC_CS_02", name="Dr. Ada Lovelace", department_id="COMPUTER_SCIENCE", designation="Assistant Professor"),
        # Education & Teacher Training (for ITEP & B.Ed)
        Faculty(faculty_id="FAC_EDU_01", name="Prof. S. Radhakrishnan", department_id="EDUCATION", designation="Professor"),
        Faculty(faculty_id="FAC_EDU_02", name="Dr. Maria Montessori", department_id="EDUCATION", designation="Associate Professor"),
        Faculty(faculty_id="FAC_EDU_03", name="Dr. John Dewey", department_id="EDUCATION", designation="Assistant Professor"),
        # Mathematics
        Faculty(faculty_id="FAC_MATH_01", name="Dr. Srinivasa Ramanujan", department_id="MATHEMATICS", designation="Professor"),
        Faculty(faculty_id="FAC_MATH_02", name="Dr. Katherine Johnson", department_id="MATHEMATICS", designation="Assistant Professor"),
        # Economics
        Faculty(faculty_id="FAC_ECO_01", name="Dr. Amartya Sen", department_id="ECONOMICS", designation="Professor"),
        Faculty(faculty_id="FAC_ECO_02", name="Dr. Joan Robinson", department_id="ECONOMICS", designation="Associate Professor"),
        # Psychology & Humanities
        Faculty(faculty_id="FAC_PSY_01", name="Dr. B.F. Skinner", department_id="PSYCHOLOGY", designation="Assistant Professor"),
        Faculty(faculty_id="FAC_ENG_01", name="Dr. Rabindranath Tagore", department_id="HUMANITIES", designation="Professor"),
        Faculty(faculty_id="FAC_ENV_01", name="Dr. Salim Ali", department_id="ENVIRONMENTAL_STUDIES", designation="Assistant Professor"),
    ]

    requirements: List[SessionRequirement] = []

    # -------------------------------------------------------------
    # PROGRAM 1: FYUP (Four-Year Undergraduate Programme) - Semester III
    # -------------------------------------------------------------
    # A. Major (DSC) for Section A: Computer Science (3 Lectures/week, 4 credits)
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_FYUP_SEC_A_MAJOR",
            course_id="DSC-CS-201",
            course_name="Data Structures & Algorithms (Major)",
            offering_id="OFF_FYUP_A_MAJOR",
            group_ids=["GRP_FYUP_SEC_A"],
            session_type="LECTURE",
            nep_category=NEPCategory.MAJOR,
            credits=4,
            program_type=ProgramType.FYUP,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            eligible_faculty_ids=["FAC_CS_01", "FAC_CS_02"],
        )
    )

    # B. Major (DSC) for Section B: Social Science / Literature (3 Lectures/week, 4 credits)
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_FYUP_SEC_B_MAJOR",
            course_id="DSC-ENG-201",
            course_name="Modern Literature & Thought (Major)",
            offering_id="OFF_FYUP_B_MAJOR",
            group_ids=["GRP_FYUP_SEC_B"],
            session_type="LECTURE",
            nep_category=NEPCategory.MAJOR,
            credits=4,
            program_type=ProgramType.FYUP,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            eligible_faculty_ids=["FAC_ENG_01"],
        )
    )

    # C. Multidisciplinary Minor Basket (PARALLEL ALIGNMENT - 3 options, 3 sessions/week each)
    # Students from both Sec A and Sec B choose ONE minor.
    # CON-H-011 ensures all 3 minor offerings run at the EXACT SAME TIME SLOTS!
    minor_requirements = [
        ("REQ_MINOR_ECO", "MIN-ECO-201", "Principles of Microeconomics (Minor)", ["FAC_ECO_01", "FAC_ECO_02"]),
        ("REQ_MINOR_MATH", "MIN-MTH-201", "Applied Linear Algebra (Minor)", ["FAC_MATH_01", "FAC_MATH_02"]),
        ("REQ_MINOR_PSY", "MIN-PSY-201", "Cognitive Psychology (Minor)", ["FAC_PSY_01"]),
    ]

    for req_id, c_id, c_name, fac_list in minor_requirements:
        requirements.append(
            SessionRequirement(
                requirement_id=req_id,
                course_id=c_id,
                course_name=c_name,
                offering_id=f"OFF_{req_id}",
                group_ids=["GRP_FYUP_SEC_A", "GRP_FYUP_SEC_B"],
                session_type="LECTURE",
                nep_category=NEPCategory.MINOR,
                credits=4,
                program_type=ProgramType.FYUP,
                sessions_per_week=3,
                duration_slots=1,
                room_type_id="LECTURE_HALL",
                eligible_faculty_ids=fac_list,
            )
        )

    # D. Skill Enhancement Course (SEC): Practical hands-on in Computer Lab (2 slots, 2 credits)
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_FYUP_SEC_WEB",
            course_id="SEC-CS-201",
            course_name="Python & Web Tech Lab (SEC)",
            offering_id="OFF_FYUP_SEC",
            group_ids=["GRP_FYUP_SEC_A"],
            session_type="PRACTICAL",
            nep_category=NEPCategory.SEC,
            credits=2,
            program_type=ProgramType.FYUP,
            sessions_per_week=1,
            duration_slots=2,  # 2-period lab block
            room_type_id="COMPUTER_LAB",
            required_features={"COMPUTERS"},
            eligible_faculty_ids=["FAC_CS_02"],
        )
    )

    # E. Ability Enhancement Course (AEC): Environmental Studies (2 sessions/week, 2 credits)
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_FYUP_AEC_ENV",
            course_id="AEC-ENV-201",
            course_name="Environmental Studies & Sustainability (AEC)",
            offering_id="OFF_FYUP_AEC",
            group_ids=["GRP_FYUP_SEC_A", "GRP_FYUP_SEC_B"],
            session_type="LECTURE",
            nep_category=NEPCategory.AEC,
            credits=2,
            program_type=ProgramType.FYUP,
            sessions_per_week=2,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            eligible_faculty_ids=["FAC_ENV_01"],
        )
    )

    # F. Value Added Course (VAC): Digital Literacy & Ethics (2 sessions/week, 2 credits)
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_FYUP_VAC_DIG",
            course_id="VAC-DIG-201",
            course_name="Digital Literacy & Cyber Hygiene (VAC)",
            offering_id="OFF_FYUP_VAC",
            group_ids=["GRP_FYUP_SEC_B"],
            session_type="LECTURE",
            nep_category=NEPCategory.VAC,
            credits=2,
            program_type=ProgramType.FYUP,
            sessions_per_week=2,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            eligible_faculty_ids=["FAC_CS_01", "FAC_CS_02"],
        )
    )

    # -------------------------------------------------------------
    # PROGRAM 2: ITEP (Integrated Teacher Education Programme - Sem 5)
    # -------------------------------------------------------------
    # Core Pedagogy of Science
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_ITEP_PEDAGOGY",
            course_id="ITEP-PED-301",
            course_name="Pedagogy of Physical Science (ITEP Core)",
            offering_id="OFF_ITEP_PED",
            group_ids=["GRP_ITEP_SEM5"],
            session_type="LECTURE",
            nep_category=NEPCategory.MAJOR,
            credits=4,
            program_type=ProgramType.ITEP,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="PEDAGOGY_ROOM",
            eligible_faculty_ids=["FAC_EDU_02", "FAC_EDU_03"],
        )
    )
    # School Teaching Practice Block (Immersion in Demo Schools, 2-period practical block)
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_ITEP_SCHOOL_INTERN",
            course_id="ITEP-INT-302",
            course_name="School Internship & Micro-Teaching",
            offering_id="OFF_ITEP_INT",
            group_ids=["GRP_ITEP_SEM5"],
            session_type="FIELD_WORK",
            nep_category=NEPCategory.TEACHING_PRACTICE,
            credits=4,
            program_type=ProgramType.ITEP,
            sessions_per_week=2,
            duration_slots=2,  # 2 consecutive slots in pedagogy hall
            room_type_id="PEDAGOGY_ROOM",
            required_features={"MICRO_TEACHING"},
            eligible_faculty_ids=["FAC_EDU_01", "FAC_EDU_02"],
        )
    )

    # -------------------------------------------------------------
    # PROGRAM 3: B.Ed. (Bachelor of Education - Sem 3)
    # -------------------------------------------------------------
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_BED_CURRICULUM",
            course_id="BED-CUR-201",
            course_name="Curriculum Studies & Inclusive Education",
            offering_id="OFF_BED_CUR",
            group_ids=["GRP_BED_SEM3"],
            session_type="LECTURE",
            nep_category=NEPCategory.MAJOR,
            credits=4,
            program_type=ProgramType.B_ED,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            eligible_faculty_ids=["FAC_EDU_01", "FAC_EDU_03"],
        )
    )
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_BED_PRACTICE",
            course_id="BED-PRAC-202",
            course_name="Supervised Practice Teaching Practice",
            offering_id="OFF_BED_PRAC",
            group_ids=["GRP_BED_SEM3"],
            session_type="FIELD_WORK",
            nep_category=NEPCategory.TEACHING_PRACTICE,
            credits=4,
            program_type=ProgramType.B_ED,
            sessions_per_week=2,
            duration_slots=2,
            room_type_id="PEDAGOGY_ROOM",
            eligible_faculty_ids=["FAC_EDU_02"],
        )
    )

    # -------------------------------------------------------------
    # PROGRAM 4: M.Ed. (Master of Education - Sem 3)
    # -------------------------------------------------------------
    requirements.append(
        SessionRequirement(
            requirement_id="REQ_MED_RESEARCH",
            course_id="MED-RES-301",
            course_name="Advanced Educational Research & Statistics",
            offering_id="OFF_MED_RES",
            group_ids=["GRP_MED_SEM3"],
            session_type="LECTURE",
            nep_category=NEPCategory.MAJOR,
            credits=4,
            program_type=ProgramType.M_ED,
            sessions_per_week=3,
            duration_slots=1,
            room_type_id="LECTURE_HALL",
            eligible_faculty_ids=["FAC_EDU_01"],
        )
    )

    # 5. Multidisciplinary Elective Group (PARALLEL ALIGNMENT CON-H-011)
    # This guarantees that Economics Minor, Math Minor, and Psychology Minor
    # all start at the exact same slots so FYUP students have full choice flexibility!
    elective_groups = [
        ElectiveGroup(
            elective_group_id="ELEC_GRP_FYUP_MINOR",
            name="FYUP Semester 3 Multidisciplinary Minor Basket",
            mode="PARALLEL",
            nep_category=NEPCategory.MINOR,
            member_requirement_ids=[
                "REQ_MINOR_ECO",
                "REQ_MINOR_MATH",
                "REQ_MINOR_PSY",
            ],
            attached_group_ids=["GRP_FYUP_SEC_A", "GRP_FYUP_SEC_B"],
        )
    ]

    return ConfigSnapshot(
        snapshot_id=f"SNAPSHOT_NEP2020_JK_{seed}",
        institution_id="INST_JK_HE_25091",
        institution_name="Govt. College of Education & Multidisciplinary Studies, J&K",
        state_or_ut="Jammu and Kashmir",
        problem_statement_id="25091",
        term_id="TERM_ODD_SEM_2026",
        time_grid=grid,
        student_groups=student_groups,
        rooms=rooms,
        faculty=faculty,
        requirements=requirements,
        elective_groups=elective_groups,
    )
