@echo off
cd /d C:\Users\Admin\.gemini\antigravity\scratch\hustleup\backend

echo Starting all 6 services...

start "Gateway  - 8000" cmd /k "cd hustleup-gateway   && java -jar target/hustleup-gateway-1.0.0.jar"
start "Auth     - 8081" cmd /k "cd hustleup-auth      && java -jar target/hustleup-auth-1.0.0.jar"
start "Social   - 8082" cmd /k "cd hustleup-social    && java -jar target/hustleup-social-1.0.0.jar"
start "Market   - 8083" cmd /k "cd hustleup-marketplace  && java -jar target/hustleup-marketplace-1.0.0.jar"
start "Subscr   - 8084" cmd /k "cd hustleup-subscription && java -jar target/hustleup-subscription-1.0.0.jar"
start "Notif    - 8085" cmd /k "cd hustleup-notification && java -jar target/hustleup-notification-1.0.0.jar"

echo Done! Wait 30 seconds for all services to start.
