@echo off
cd /d C:\Users\Admin\.gemini\antigravity\scratch\hustleup\backend
echo Running: mvn clean install -DskipTests
mvn clean install -DskipTests
echo.
echo Build completed. Check output above for errors.
