@echo off
echo Deleting UserIdFinder.java...
del /F "hustleup-social\src\main\java\com\hustleup\social\UserIdFinder.java"
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: UserIdFinder.java deleted
    echo.
    echo Now rebuild with: mvn clean install -DskipTests
) else (
    echo ERROR: Could not delete file
)
pause
