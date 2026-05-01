@echo off
echo Stopping any existing DocFlow processes...
taskkill /F /IM uvicorn.exe >nul 2>&1
powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*uvicorn*app.main*' -or $_.CommandLine -like '*multiprocessing*parent_pid*' -and $_.CommandLine -like '*python*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul
start "DocFlow Backend" cmd /k "cd /d %~dp0backend && uvicorn app.main:app --reload --port 8000"
start "DocFlow Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
