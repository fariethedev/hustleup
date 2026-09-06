@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Building with Maven...
echo ========================================
mvn clean install -DskipTests

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo BUILD FAILED! Check errors above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build successful! Starting services...
echo ========================================
echo.

call START_SERVICES_NOW.bat
