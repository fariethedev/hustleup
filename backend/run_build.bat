@echo off
cd /d "%~dp0"
echo Running: mvnw.cmd clean install -DskipTests
mvnw.cmd clean install -DskipTests
echo.
echo Build completed. Check output above for errors.
