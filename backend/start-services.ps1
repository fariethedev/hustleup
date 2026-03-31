# HustleUp Microservices Startup Script

$services = @(
    @{ Name = "Gateway"; Port = 8000; Dir = "hustleup-gateway" },
    @{ Name = "Auth"; Port = 8081; Dir = "hustleup-auth" },
    @{ Name = "Social"; Port = 8082; Dir = "hustleup-social" },
    @{ Name = "Marketplace"; Port = 8083; Dir = "hustleup-marketplace" },
    @{ Name = "Subscription"; Port = 8084; Dir = "hustleup-subscription" },
    @{ Name = "Notification"; Port = 8085; Dir = "hustleup-notification" }
)

Write-Host "🚀 Launching HustleUp Microservices Mesh..." -ForegroundColor Cyan

foreach ($s in $services) {
    Write-Host "✨ Starting $($s.Name) on port $($s.Port)..." -ForegroundColor Yellow
    Start-Process -FilePath "mvn" -ArgumentList "spring-boot:run", "-pl", "$($s.Dir)" -WindowStyle Minimized -WorkingDirectory (Get-Location)
}

Write-Host "✅ All services initiated. Use 'localhost:8000' for the API Gateway." -ForegroundColor Green
Write-Host "💡 NOTE: Each service is running in a minimized window. Check taskbar for logs." -ForegroundColor Gray
