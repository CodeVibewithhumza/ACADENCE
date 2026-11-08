"""Domain enumerations for Acadence with NEP 2020 Multidisciplinary Framework.
Aligned with Problem Statement 25091 (Higher Education Dept, Govt of Jammu & Kashmir).
"""
from enum import Enum


class Hardness(str, Enum):
    HARD = "HARD"
    SOFT = "SOFT"


class AudienceKind(str, Enum):
    SECTION = "SECTION"
    BATCH = "BATCH"
    COHORT = "COHORT"


class SolverStatus(str, Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    TIMEOUT = "TIMEOUT"
    FAILED = "FAILED"


class ValidationStatus(str, Enum):
    VALID = "VALID"
    INVALID = "INVALID"


class NEPCategory(str, Enum):
    """NEP 2020 Curriculum Components."""
    MAJOR = "MAJOR"  # Disciplinary Major (DSC)
    MINOR = "MINOR"  # Multidisciplinary Minor Basket (DSE)
    SEC = "SEC"      # Skill Enhancement Course (Hands-on / Lab)
    AEC = "AEC"      # Ability Enhancement Course (Languages / Environmental)
    VAC = "VAC"      # Value Added Course (Ethics / Digital Literacy / Yoga)
    TEACHING_PRACTICE = "TEACHING_PRACTICE"  # School Internship / Practice Teaching (B.Ed / ITEP)


class ProgramType(str, Enum):
    """Academic Programmes under NEP 2020."""
    FYUP = "FYUP"      # Four-Year Undergraduate Programme (B.A./B.Sc./B.Com)
    ITEP = "ITEP"      # Integrated Teacher Education Programme (4-Year B.Sc.-B.Ed. / B.A.-B.Ed.)
    B_ED = "B_ED"      # Bachelor of Education (2-Year)
    M_ED = "M_ED"      # Master of Education (2-Year)
