@echo off
REM Build and Start All Services for HustleUp
REM This script builds the project and starts all required microservices

setlocal enabledelayedexpansion

echo ========================================
echo HustleUp Backend - Build and Start
echo ========================================
echo.

REM Check if Maven is installed
where mvn >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Maven is not installed or not in PATH
    echo Please install Maven or add it to your PATH
    pause
    exit /b 1
)

echo Step 1: Building entire backend...
echo.
call mvn clean install -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Maven build failed!
    echo Check the error messages above
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.
echo Step 2: Starting services...
echo.
echo NOTE: Each service will open in a new window
echo Services starting:
echo   - API Gateway (port 8000)
echo   - Auth Service (port 8081)
echo   - Social Service (port 8082)
echo.
echo Starting Gateway...
start "HustleUp Gateway" cmd /k "cd hustleup-gateway && java -jar target/hustleup-gateway-0.0.1-SNAPSHOT.jar && pause"
timeout /t 3 /nobreak >nul

echo Starting Auth Service...
start "HustleUp Auth" cmd /k "cd hustleup-auth && java -jar target/hustleup-auth-0.0.1-SNAPSHOT.jar && pause"
timeout /t 3 /nobreak >nul

echo Starting Social Service...
start "HustleUp Social" cmd /k "cd hustleup-social && java -jar target/hustleup-social-0.0.1-SNAPSHOT.jar && pause"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo To verify services are running:
echo   1. Run: CHECK_SERVICES.bat
echo   2. Or check the service windows for startup messages
echo.
echo Frontend should be started separately:
echo   cd frontend
echo   npm run dev
echo.
pause
