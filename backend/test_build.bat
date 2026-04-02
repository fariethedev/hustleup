@echo off
REM Build script to check for compilation errors
REM This will compile the entire project but skip tests

cd /d C:\Users\Admin\.gemini\antigravity\scratch\hustleup\backend

echo.
echo ========================================
echo HustleUp Backend - Maven Build Test
echo ========================================
echo.
echo Running: mvn clean compile -q
echo.

mvn clean compile 2>&1 | tee build.log

echo.
echo ========================================
echo Build completed. Checking for errors...
echo ========================================
echo.

findstr /I "error" build.log

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ERRORS FOUND - See above for details
) else (
    echo.
    echo No errors found!
)

echo.
echo Full log saved to: build.log
pause
