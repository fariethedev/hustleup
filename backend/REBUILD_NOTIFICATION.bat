@echo off
echo Stopping notification service on port 8085...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8085"') do (
    taskkill /PID %%a /F 2>nul
)
timeout /t 3 /nobreak >nul

echo Building common module...
cd hustleup-common
call mvn clean install -DskipTests -q
if %errorlevel% neq 0 ( echo Common build FAILED & pause & exit /b 1 )
cd ..

echo Building notification service...
cd hustleup-notification
call mvn clean package -DskipTests -q
if %errorlevel% neq 0 ( echo Notification build FAILED & pause & exit /b 1 )
cd ..

echo Starting notification service...
start "Notification-8085" java -jar hustleup-notification\target\hustleup-notification-*.jar > spring-boot-8085.out.log 2> spring-boot-8085.err.log

echo.
echo Notification service restarting on port 8085.
echo Tail logs: spring-boot-8085.out.log
pause
