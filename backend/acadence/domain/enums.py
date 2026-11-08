"""Domain enumerations for Acadence."""
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

