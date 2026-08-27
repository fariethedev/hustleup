# HustleUp Services Startup Script
# Sets the required environment variables and launches all microservices & frontend in background with logging.

$root = "c:\Users\User\hustleup"
$logDir = "$root\backend\logs"

# 1. Cleanup existing processes
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$frontendPort = 5174
$portProcess = Get-NetTCPConnection -LocalPort $frontendPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($portProcess) {
    foreach ($p in $portProcess) {
        Write-Host "Killing process $p on port $frontendPort" -ForegroundColor Gray
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

# 2. Set environment variables
# -- Secrets ------------------------------------------------------------------
# Loaded from backend\.env (gitignored), never hardcoded here. These values were
# previously pinned inline, which meant committing them to git AND meant services
# started by this script silently disagreed with ones started from .env: a different
# JWT_SECRET makes every cross-service call 401, and a placeholder Stripe key makes
# every payment fail with "Invalid API Key".
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: backend\.env not found. Copy backend\.env.example to backend\.env and fill it in." -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $k, $v = $line -split "=", 2
        [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), "Process")
    }
}
foreach ($required in @("MYSQL_PASSWORD", "JWT_SECRET")) {
    if (-not [Environment]::GetEnvironmentVariable($required, "Process")) {
        Write-Host "ERROR: $required is not set in backend\.env" -ForegroundColor Red
        exit 1
    }
}
$env:UPLOAD_DIR = "$root\uploads"
$env:AWS_REGION = "us-east-1"
$env:AWS_S3_BUCKET = "hustle-up"

Write-Host "🚀 Starting HustleUp Microservices in background..." -ForegroundColor Cyan

# Service array helper
$services = @(
    @{ Name = "gateway"; Jar = "backend/hustleup-gateway/target/hustleup-gateway-1.0.0.jar"; Config = "backend/hustleup-gateway/src/main/resources/application.yml"; Port = 8000 },
    @{ Name = "auth"; Jar = "backend/hustleup-auth/target/hustleup-auth-1.0.0.jar"; Config = "backend/hustleup-auth/src/main/resources/application.yml"; Port = 8081 },
    @{ Name = "social"; Jar = "backend/hustleup-social/target/hustleup-social-1.0.0.jar"; Config = "backend/hustleup-social/src/main/resources/application.yml"; Port = 8082 },
    @{ Name = "marketplace"; Jar = "backend/hustleup-marketplace/target/hustleup-marketplace-1.0.0.jar"; Config = "backend/hustleup-marketplace/src/main/resources/application.yml"; Port = 8083 },
    @{ Name = "subscription"; Jar = "backend/hustleup-subscription/target/hustleup-subscription-1.0.0.jar"; Config = "backend/hustleup-subscription/src/main/resources/application.yml"; Port = 8084 },
    @{ Name = "notification"; Jar = "backend/hustleup-notification/target/hustleup-notification-1.0.0.jar"; Config = "backend/hustleup-notification/src/main/resources/application.yml"; Port = 8085 }
)

# Start each backend service
foreach ($s in $services) {
    Write-Host "✨ Starting $($s.Name) on port $($s.Port)..." -ForegroundColor Yellow
    
    $args = @(
        "-jar",
        "$root\$($s.Jar)",
        "--spring.config.location=file:$root\$($s.Config)"
    )
    
    $outFile = "$logDir\$($s.Name).log"
    $errFile = "$logDir\$($s.Name)_error.log"
    
    # Run in minimized window so it persists independently but standard streams are redirected
    Start-Process -FilePath "java" -ArgumentList $args -WorkingDirectory $root -RedirectStandardOutput $outFile -RedirectStandardError $errFile -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

# 3. Start Frontend
Write-Host "✨ Starting Frontend on port 5174..." -ForegroundColor Yellow
$frontOut = "$logDir\frontend.log"
$frontErr = "$logDir\frontend_error.log"

Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev", "--", "--port", "5174" -WorkingDirectory "$root\frontend" -RedirectStandardOutput $frontOut -RedirectStandardError $frontErr -WindowStyle Minimized

Write-Host "`n✅ All services initiated in background!" -ForegroundColor Green
Write-Host "🔗 Frontend URL: http://localhost:5174" -ForegroundColor Green
Write-Host "🔗 Gateway API URL: http://localhost:8000" -ForegroundColor Green
Write-Host "`nKeep this task running to maintain the services." -ForegroundColor Cyan

# Keep parent script alive to prevent Job Object cleanup
while ($true) {
    Start-Sleep -Seconds 10
}
