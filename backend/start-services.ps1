# HustleUp Microservices Startup Script

$services = @(
    @{ Name = "Gateway"; Port = 8000; Dir = "hustleup-gateway" },
    @{ Name = "Auth"; Port = 8081; Dir = "hustleup-auth" },
    @{ Name = "Social"; Port = 8082; Dir = "hustleup-social" },
    @{ Name = "Marketplace"; Port = 8083; Dir = "hustleup-marketplace" },
    @{ Name = "Subscription"; Port = 8084; Dir = "hustleup-subscription" },
    @{ Name = "Notification"; Port = 8085; Dir = "hustleup-notification" }
)

$uploadPath = Join-Path (Get-Location) "uploads"
if (!(Test-Path -Path $uploadPath)) {
    New-Item -ItemType Directory -Force -Path $uploadPath | Out-Null
}

# ── Secrets ──────────────────────────────────────────────────────────────────
# SECURITY: the database password and JWT signing key used to be hardcoded in the
# command line below, in a file committed to git. A leaked JWT_SECRET lets anyone
# mint valid tokens for any account, so treat both as compromised: generate a new
# secret and rotate the MySQL password before using this against anything real.
#
# They now come from backend\.env (excluded by .gitignore). Copy .env.example to
# .env and fill it in.
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: backend\.env not found. Copy backend\.env.example to backend\.env and fill in your values." -ForegroundColor Red
    exit 1
}

$envVars = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $key, $value = $line -split "=", 2
        $envVars[$key.Trim()] = $value.Trim()
    }
}

foreach ($required in @("MYSQL_PASSWORD", "JWT_SECRET")) {
    if (-not $envVars[$required]) {
        Write-Host "ERROR: $required is not set in backend\.env" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🚀 Launching HustleUp Microservices Mesh..." -ForegroundColor Cyan

foreach ($s in $services) {
    Write-Host "✨ Starting $($s.Name) on port $($s.Port)..." -ForegroundColor Yellow

    # Pass secrets through the child process's environment rather than interpolating
    # them into a command line — command lines are visible to any local process via
    # the process list, environment blocks are not.
    $childEnv = @{
        JAVA_HOME  = "C:\Program Files\Java\jdk-21"
        UPLOAD_DIR = $uploadPath
    }
    foreach ($k in $envVars.Keys) { $childEnv[$k] = $envVars[$k] }

    $previous = @{}
    foreach ($k in $childEnv.Keys) {
        $previous[$k] = [Environment]::GetEnvironmentVariable($k, "Process")
        [Environment]::SetEnvironmentVariable($k, $childEnv[$k], "Process")
    }

    $cmdArgs = "/c set `"PATH=C:\Program Files\Java\jdk-21\bin;%PATH%`" && `"C:\Users\User\maven-dist\apache-maven-3.9.6\bin\mvn.cmd`" spring-boot:run -pl $($s.Dir) -Dmaven.test.skip=true"
    Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WindowStyle Minimized -WorkingDirectory (Get-Location)

    # Restore this shell's own environment so the secrets don't linger in the session.
    foreach ($k in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($k, $previous[$k], "Process")
    }
}

Write-Host "✅ All services initiated. Use 'localhost:8000' for the API Gateway." -ForegroundColor Green
Write-Host "💡 NOTE: Each service is running in a minimized window. Check taskbar for logs." -ForegroundColor Gray

