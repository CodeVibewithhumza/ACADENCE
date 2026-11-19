@echo off
echo ========================================================
echo Starting Acadence System (Backend :8000 + Frontend :5173)
echo ========================================================
start "Acadence Backend (:8000)" cmd /k "py -3.13 -m uvicorn acadence.api.app:app --host 127.0.0.1 --port 8000 --reload"
start "Acadence Frontend (:5173)" cmd /k "cd web && npm run dev"
echo Both servers started!
echo Open http://localhost:5173 in your browser.
