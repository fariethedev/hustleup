@echo off
REM Check what services are running

echo.
echo =====================================
echo   HustleUp Service Status Check
echo =====================================
echo.

echo Checking ports...
echo.

REM Check Gateway
echo [1] Gateway (8000):
netstat -ano | findstr :8000 > nul
if errorlevel 1 (
    echo    ❌ NOT RUNNING - Port 8000 is free
) else (
    echo    ✅ RUNNING - Port 8000 is in use
)

REM Check Auth
echo [2] Auth (8081):
netstat -ano | findstr :8081 > nul
if errorlevel 1 (
    echo    ❌ NOT RUNNING - Port 8081 is free
) else (
    echo    ✅ RUNNING - Port 8081 is in use
)

REM Check Social
echo [3] Social (8082):
netstat -ano | findstr :8082 > nul
if errorlevel 1 (
    echo    ❌ NOT RUNNING - Port 8082 is free
) else (
    echo    ✅ RUNNING - Port 8082 is in use
)

REM Check Marketplace
echo [4] Marketplace (8083):
netstat -ano | findstr :8083 > nul
if errorlevel 1 (
    echo    ❌ NOT RUNNING - Port 8083 is free
) else (
    echo    ✅ RUNNING - Port 8083 is in use
)

REM Check Subscription
echo [5] Subscription (8084):
netstat -ano | findstr :8084 > nul
if errorlevel 1 (
    echo    ❌ NOT RUNNING - Port 8084 is free
) else (
    echo    ✅ RUNNING - Port 8084 is in use
)

REM Check Notification
echo [6] Notification (8085):
netstat -ano | findstr :8085 > nul
if errorlevel 1 (
    echo    ❌ NOT RUNNING - Port 8085 is free
) else (
    echo    ✅ RUNNING - Port 8085 is in use
)

echo.
echo =====================================

REM Count running services
for /f %%i in ('netstat -ano ^| find ":800" ^| find /c "LISTENING"') do set running=%%i

echo.
if %running% geq 6 (
    echo ✅ All 6 services are running!
    echo.
    echo You can now:
    echo 1. Open frontend: http://localhost:5173
    echo 2. Test API: curl http://localhost:8000/api/v1/stories
) else (
    echo ⚠️  Only %running% services running (need 6)
    echo.
    echo Run: START_SERVICES_SIMPLE.bat
    echo Or manually start missing services
)

echo.
pause
