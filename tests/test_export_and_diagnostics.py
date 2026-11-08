"""Tests for Export (CSV & Excel) and Infeasibility Diagnostics.
"""
from fastapi.testclient import TestClient
from acadence.api.app import app
from acadence.test_data.synthetic import generate_tier_s_snapshot
from acadence.engine.diagnostics import run_diagnostics
from acadence.export.exporter import export_to_csv, export_to_xlsx
from acadence.engine.solver import solve, SolverParameters

client = TestClient(app)


def test_diagnostics_on_tier_s():
    """Verify diagnostics reports Tier S as feasible with zero bottlenecks."""
    snapshot = generate_tier_s_snapshot(seed=42)
    report = run_diagnostics(snapshot)
    assert report.is_feasible is True
    assert len(report.bottlenecks) == 0


def test_diagnostics_detects_bottleneck():
    """Verify diagnostics catches an impossible group load."""
    snapshot = generate_tier_s_snapshot(seed=42)
    # Inflate requirement to 50 hours (exceeding 40 grid slots)
    corrupted_reqs = list(snapshot.requirements)
    corrupted_reqs[0] = corrupted_reqs[0].model_copy(update={"sessions_per_week": 45})
    corrupted_snapshot = snapshot.model_copy(update={"requirements": corrupted_reqs})

    report = run_diagnostics(corrupted_snapshot)
    assert report.is_feasible is False
    assert any(b.category == "GROUP_CAPACITY" for b in report.bottlenecks)
    assert len(report.suggested_relaxations) > 0


def test_csv_and_xlsx_export():
    """Verify CSV and Excel exports generate valid non-empty files."""
    snapshot = generate_tier_s_snapshot(seed=42)
    result = solve(snapshot, SolverParameters(time_limit_seconds=10.0))

    # CSV
    csv_out = export_to_csv(snapshot, result.placements)
    assert "Monday" in csv_out
    assert "Period 1" in csv_out
    assert "CS201" in csv_out

    # Excel
    xlsx_bytes = export_to_xlsx(snapshot, result.placements)
    assert len(xlsx_bytes) > 1000  # valid binary zip/xlsx archive


def test_export_api_endpoints():
    """Verify /api/export/csv and /api/export/xlsx endpoints."""
    # Ensure timetable is generated
    client.post("/api/generate", json={"profile_name": "BALANCED"})

    csv_res = client.get("/api/export/csv")
    assert csv_res.status_code == 200
    assert "Monday" in csv_res.text

    xlsx_res = client.get("/api/export/xlsx")
    assert xlsx_res.status_code == 200
    assert len(xlsx_res.content) > 1000

    diag_res = client.get("/api/diagnostics")
    assert diag_res.status_code == 200
    assert "is_feasible" in diag_res.json()

