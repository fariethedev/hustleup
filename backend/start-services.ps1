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

Write-Host "🚀 Launching HustleUp Microservices Mesh..." -ForegroundColor Cyan

foreach ($s in $services) {
    Write-Host "✨ Starting $($s.Name) on port $($s.Port)..." -ForegroundColor Yellow
    $cmdArgs = "/c set `"JAVA_HOME=C:\Program Files\Java\jdk-21`" && set `"PATH=C:\Program Files\Java\jdk-21\bin;%PATH%`" && set `"MYSQL_PASSWORD=francis`" && set `"JWT_SECRET=5f7a2c1d8e3b9f4a6c2e1d0b7a5c3e9f8d2a4b6c8e1f3a5b7d9e2c4f6a8b0c2`" && set `"UPLOAD_DIR=$uploadPath`" && set `"STRIPE_SECRET_KEY=sk_test_placeholder`" && set `"STRIPE_WEBHOOK_SECRET=whsec_placeholder`" && `"C:\Users\User\maven-dist\apache-maven-3.9.6\bin\mvn.cmd`" spring-boot:run -pl $($s.Dir) -Dmaven.test.skip=true"
    Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArgs -WindowStyle Minimized -WorkingDirectory (Get-Location)
}

Write-Host "✅ All services initiated. Use 'localhost:8000' for the API Gateway." -ForegroundColor Green
Write-Host "💡 NOTE: Each service is running in a minimized window. Check taskbar for logs." -ForegroundColor Gray

