@echo off
REM HustleUp Backend Services - Simple Startup
REM Start each service in its own window - manually

setlocal enabledelayedexpansion

cls
echo.
echo =====================================
echo   HustleUp Microservices Launcher
echo =====================================
echo.
echo Starting 6 services...
echo.

cd /d C:\Users\Admin\.gemini\antigravity\scratch\hustleup\backend

REM Gateway
echo [1/6] Starting API Gateway on port 8000...
start "Gateway-8000" cmd /k "mvn spring-boot:run -pl hustleup-gateway"
timeout /t 8 /nobreak

REM Auth Service
echo [2/6] Starting Auth Service on port 8081...
start "Auth-8081" cmd /k "mvn spring-boot:run -pl hustleup-auth"
timeout /t 8 /nobreak

REM Social Service
echo [3/6] Starting Social Service (Stories) on port 8082...
start "Social-8082" cmd /k "mvn spring-boot:run -pl hustleup-social"
timeout /t 8 /nobreak

REM Marketplace Service
echo [4/6] Starting Marketplace Service on port 8083...
start "Marketplace-8083" cmd /k "mvn spring-boot:run -pl hustleup-marketplace"
timeout /t 8 /nobreak

REM Subscription Service
echo [5/6] Starting Subscription Service on port 8084...
start "Subscription-8084" cmd /k "mvn spring-boot:run -pl hustleup-subscription"
timeout /t 8 /nobreak

REM Notification Service
echo [6/6] Starting Notification Service on port 8085...
start "Notification-8085" cmd /k "mvn spring-boot:run -pl hustleup-notification"
timeout /t 8 /nobreak

echo.
echo =====================================
echo   All services started!
echo =====================================
echo.
echo Gateway:       http://localhost:8000
echo Auth:          http://localhost:8081
echo Social:        http://localhost:8082
echo Marketplace:   http://localhost:8083
echo Subscription:  http://localhost:8084
echo Notification:  http://localhost:8085
echo.
echo Frontend:      http://localhost:5173
echo.
echo Each service is in its own window above
echo.
pause
