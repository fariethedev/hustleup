@echo off
REM HustleUp Backend Services - Start from Jars with Environment Variables
REM This script sets required environment variables and overrides internal JAR config

setlocal enabledelayedexpansion

cls
echo.
echo =====================================
echo   HustleUp Microservices (Full Environment)
echo =====================================
echo.

REM Set required environment variables
set "MYSQL_PASSWORD=francis"
set "JWT_SECRET=HustleUpSecretKeyForJWTTokenGenerationMustBe256BitsLongAtLeast!!2026"
set "UPLOAD_DIR=./uploads"
set "AWS_REGION=us-east-1"
set "AWS_S3_BUCKET=hustle-up"

echo Environment variables set.
echo Starting 6 services...
echo.

REM Gateway
echo [1/6] Starting API Gateway on port 8000...
start "Gateway-8000" cmd /k "java -jar hustleup-gateway/target/hustleup-gateway-1.0.0.jar --spring.config.location=file:hustleup-gateway/src/main/resources/application.yml"
timeout /t 3 /nobreak > nul

REM Auth Service
echo [2/6] Starting Auth Service on port 8086...
start "Auth-8086" cmd /k "java -jar hustleup-auth/target/hustleup-auth-1.0.0.jar --spring.config.location=file:hustleup-auth/src/main/resources/application.yml"
timeout /t 3 /nobreak > nul

REM Social Service
echo [3/6] Starting Social Service on port 8082...
start "Social-8082" cmd /k "java -jar hustleup-social/target/hustleup-social-1.0.0.jar --spring.config.location=file:hustleup-social/src/main/resources/application.yml"
timeout /t 3 /nobreak > nul

REM Marketplace Service
echo [4/6] Starting Marketplace Service on port 8083...
start "Marketplace-8083" cmd /k "java -jar hustleup-marketplace/target/hustleup-marketplace-1.0.0.jar --spring.config.location=file:hustleup-marketplace/src/main/resources/application.yml"
timeout /t 3 /nobreak > nul

REM Subscription Service
echo [5/6] Starting Subscription Service on port 8084...
start "Subscription-8084" cmd /k "java -jar hustleup-subscription/target/hustleup-subscription-1.0.0.jar --spring.config.location=file:hustleup-subscription/src/main/resources/application.yml"
timeout /t 3 /nobreak > nul

REM Notification Service
echo [6/6] Starting Notification Service on port 8085...
start "Notification-8085" cmd /k "java -jar hustleup-notification/target/hustleup-notification-1.0.0.jar --spring.config.location=file:hustleup-notification/src/main/resources/application.yml"
timeout /t 3 /nobreak > nul

echo.
echo =====================================
echo   All services starting!
echo =====================================
echo.
echo Port mapping:
echo Gateway:       8000
echo Auth:          8086
echo.
echo Please check the "Auth-8086" window for errors.
echo.
