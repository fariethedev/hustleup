@echo off
cd /d "%~dp0"
mvnw.cmd clean install -DskipTests
pause
