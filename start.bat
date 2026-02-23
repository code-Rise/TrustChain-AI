@echo off
echo ========================================
echo TrustChain AI - Full Stack Startup
echo ========================================
echo.

echo [1/5] Installing backend dependencies...
cd backend
pip install -r requirement.txt

if not exist "sql_app.db" (
    echo [2/5] Seeding database...
    python seed_db.py
) else (
    echo [2/5] Database already exists, skipping seed...
)

echo [3/5] Starting backend server...
start "TrustChain Backend" cmd /k "python main.py"

timeout /t 3 /nobreak > nul

echo [4/5] Installing frontend dependencies...
cd ..\Frontend
if not exist "node_modules" (
    npm install
)

echo [5/5] Starting frontend server...
start "TrustChain Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo ========================================
echo.
echo Press any key to exit this window...
pause > nul
