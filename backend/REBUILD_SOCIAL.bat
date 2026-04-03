@echo off
setlocal
cd /d C:\Users\Admin\.gemini\antigravity\scratch\hustleup\backend

echo ============================================
echo Rebuilding Auth + Social Services
echo ============================================
echo.

REM Kill social service (8082)
echo Stopping social service on port 8082...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8082" ^| find "LISTENING"') do (
    echo Killing PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill auth service (8081)
echo Stopping auth service on port 8081...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8081" ^| find "LISTENING"') do (
    echo Killing PID %%a
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo.
echo Building hustleup-common...
cd hustleup-common
call mvn clean install -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Common build failed!
    pause
    exit /b 1
)
cd ..

echo Building hustleup-auth...
cd hustleup-auth
call mvn clean package -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Auth service build failed!
    pause
    exit /b 1
)
cd ..

echo Building hustleup-social...
cd hustleup-social
call mvn clean package -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Social service build failed!
    pause
    exit /b 1
)
cd ..

echo.
echo Build successful! Starting services...
echo.
start "HustleUp Auth - Port 8081" cmd /k "cd hustleup-auth && java -jar target/hustleup-auth-1.0.0.jar"
timeout /t 3 /nobreak >nul
start "HustleUp Social - Port 8082" cmd /k "cd hustleup-social && java -jar target/hustleup-social-1.0.0.jar"

echo.
echo ============================================
echo Auth (8081) and Social (8082) restarting.
echo Wait ~20 seconds for both to fully start.
echo ============================================
echo.
pause

