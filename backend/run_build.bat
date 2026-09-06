@echo off
cd /d "%~dp0"
echo Running: mvn clean install -DskipTests
mvn clean install -DskipTests
echo.
echo Build completed. Check output above for errors.
