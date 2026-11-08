# Starts the Acadence full-stack platform (FastAPI + React Dashboard on http://127.0.0.1:8000)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ACADENCE Academic Timetable Optimization Platform      " -ForegroundColor Green
Write-Host "   Powered by Google OR-Tools CP-SAT & FastAPI            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$env:PYTHONPATH="backend"
Write-Host "Serving Web UI & API at: http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "API Documentation at:    http://127.0.0.1:8000/docs" -ForegroundColor Yellow

py -3.13 -m uvicorn acadence.api.app:app --host 127.0.0.1 --port 8000
