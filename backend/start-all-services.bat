@echo off
REM HustleUp Microservices Startup Script (Windows Batch)
REM Starts all services in the correct order

setlocal enabledelayedexpansion

echo.
echo ======================================
echo 🚀 Launching HustleUp Microservices
echo ======================================
echo.

REM Define services with their ports
set "services[0]=hustleup-gateway" & set "ports[0]=8000"
set "services[1]=hustleup-auth" & set "ports[1]=8081"
set "services[2]=hustleup-social" & set "ports[2]=8082"
set "services[3]=hustleup-marketplace" & set "ports[3]=8083"
set "services[4]=hustleup-subscription" & set "ports[4]=8084"
set "services[5]=hustleup-notification" & set "ports[5]=8085"

REM Start each service
for /L %%i in (0,1,5) do (
    echo.
    echo ✨ Starting !services[%%i]! on port !ports[%%i]!...
    start "!services[%%i]!" cmd /k "mvn spring-boot:run -pl !services[%%i]! > spring-boot-!ports[%%i]!.out.log 2> spring-boot-!ports[%%i]!.err.log"
    
    REM Wait 8 seconds for service to start
    timeout /t 8 /nobreak
)

echo.
echo ======================================
echo ✅ All services initiated!
echo ======================================
echo.
echo 📡 API Gateway:  http://localhost:8000
echo 🌐 Frontend:     http://localhost:5173
echo.
echo 📊 Service Ports:
echo    - Gateway:      8000
echo    - Auth:         8081
echo    - Social:       8082
echo    - Marketplace:  8083
echo    - Subscription: 8084
echo    - Notification: 8085
echo.
echo 💡 Each service opens in its own window for easy monitoring
echo 💡 Close any window to stop that service
echo.
pause
