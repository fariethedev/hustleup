@echo off
REM Build script to check for compilation errors
REM This will compile the entire project but skip tests

cd /d "%~dp0"

echo.
echo ========================================
echo HustleUp Backend - Maven Build Test
echo ========================================
echo.
echo Running: mvnw.cmd clean compile -q
echo.

mvnw.cmd clean compile -q > build.log 2>&1

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
