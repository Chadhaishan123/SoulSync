@echo off
echo ===================================================
echo               Starting SoulSync...
echo ===================================================

cd /d "%~dp0"

echo 1. Starting FastAPI Backend on port 8000...
start "SoulSync Backend" cmd /k "cd /d %~dp0backend && ..\venv\Scripts\uvicorn.exe app.main:app --port 8000"

echo 2. Starting Next.js Frontend on port 3000...
start "SoulSync Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo 3. Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo 4. Opening SoulSync in your default browser...
start http://localhost:3000

echo ===================================================
echo  SoulSync is running!
echo  Frontend: http://localhost:3000
echo  Backend:  http://localhost:8000
echo ===================================================
