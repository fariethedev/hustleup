@echo off
setlocal
cd /d C:\Users\Admin\.gemini\antigravity\scratch\hustleup\backend

echo ============================================
echo Rebuilding Marketplace Service (8083)
echo ============================================
echo.

REM Kill marketplace service (8083)
echo Stopping marketplace service on port 8083...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8083" ^| find "LISTENING"') do (
    echo Killing PID %%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo Building hustleup-common...
cd hustleup-common
call mvn clean install -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Common build failed!
    pause
    exit /b 1
)
cd ..

echo Building hustleup-marketplace...
cd hustleup-marketplace
call mvn clean package -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Marketplace build failed!
    pause
    exit /b 1
)
cd ..

echo.
echo Build successful! Starting marketplace service...
echo.
start "HustleUp Marketplace - Port 8083" cmd /k "cd hustleup-marketplace && java -jar target/hustleup-marketplace-1.0.0.jar"

echo.
echo ============================================
echo Marketplace (8083) restarting.
echo Wait ~20 seconds for it to fully start.
echo Listings will be auto-seeded on first run.
echo ============================================
echo.
pause
