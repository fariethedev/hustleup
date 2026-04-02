@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo HustleUp Backend Startup Script
echo ============================================
echo.
echo This script will:
echo 1. Build all services with Maven
echo 2. Start 3 key services (Gateway, Auth, Social)
echo.

REM Check Maven
where mvn >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Maven not found. Install Maven or add to PATH.
    pause
    exit /b 1
)

echo [1/4] Building with Maven (this may take 1-2 minutes)...
echo.

call mvn clean install -DskipTests -q
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Check Maven output above.
    pause
    exit /b 1
)

echo [2/4] Build complete!
echo.
echo [3/4] Starting services (6 new windows will open)...
echo.

REM Gateway
echo Starting Gateway on port 8000...
start "HustleUp Gateway - Port 8000" cmd /k "cd hustleup-gateway && java -jar target/hustleup-gateway-1.0.0.jar"
timeout /t 2 /nobreak >nul

REM Auth
echo Starting Auth on port 8081...
start "HustleUp Auth - Port 8081" cmd /k "cd hustleup-auth && java -jar target/hustleup-auth-1.0.0.jar"
timeout /t 2 /nobreak >nul

REM Social
echo Starting Social on port 8082...
start "HustleUp Social - Port 8082" cmd /k "cd hustleup-social && java -jar target/hustleup-social-1.0.0.jar"
timeout /t 2 /nobreak >nul

REM Marketplace
echo Starting Marketplace on port 8083...
start "HustleUp Marketplace - Port 8083" cmd /k "cd hustleup-marketplace && java -jar target/hustleup-marketplace-1.0.0.jar"
timeout /t 2 /nobreak >nul

REM Subscription
echo Starting Subscription on port 8084...
start "HustleUp Subscription - Port 8084" cmd /k "cd hustleup-subscription && java -jar target/hustleup-subscription-1.0.0.jar"
timeout /t 2 /nobreak >nul

REM Notification
echo Starting Notification on port 8085...
start "HustleUp Notification - Port 8085" cmd /k "cd hustleup-notification && java -jar target/hustleup-notification-1.0.0.jar"
timeout /t 2 /nobreak >nul

echo.
echo [4/4] All 6 services starting...
echo.
echo ============================================
echo IMPORTANT: Wait 20-30 seconds for all services to fully start
echo ============================================
echo.
echo You should see these messages in each window:
echo   - "Started GatewayApplication"       (port 8000)
echo   - "Started AuthApplication"           (port 8081)
echo   - "Started SocialApplication"         (port 8082)
echo   - "Started MarketplaceApplication"    (port 8083)
echo   - "Started SubscriptionApplication"   (port 8084)
echo   - "Started NotificationApplication"   (port 8085)
echo.
echo To verify all running, open another terminal and run:
echo   CHECK_SERVICES.bat
echo.
echo Then your frontend should connect properly!
echo.
pause
