Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting Acadence System (Backend :8000 + Frontend :5173)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "py -3.13 -m uvicorn acadence.api.app:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd web; npm run dev"

Write-Host "Backend running at:  http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "Frontend running at: http://localhost:5173" -ForegroundColor Yellow
