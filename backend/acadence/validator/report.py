"""Validation report models for Acadence.
Follows DATA-051 and Section 10.12.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional
from acadence.domain.enums import ValidationStatus


@dataclass
class ValidationViolation:
    check_id: str  # e.g., 'VAL-001', 'VAL-002'
    entity_type: str  # 'FACULTY', 'ROOM', 'GROUP', 'INSTANCE'
    entity_id: str
    slot_index: Optional[int] = None
    message: str = ""


@dataclass
class ValidationReport:
    status: ValidationStatus
    violations: List[ValidationViolation] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return self.status == ValidationStatus.VALID and len(self.violations) == 0

