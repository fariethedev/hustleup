# HustleUp Platform — All Services Startup Script
# This launches all core microservices needed for Stories, Messaging, and Social features.

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
    # Using Start-Process to keep logs separate and ensure services stay up
    Start-Process -FilePath "mvn" -ArgumentList "spring-boot:run", "-pl", "$($s.Dir)", "-Dspring-boot.run.jvmArguments='-Xmx512m'" -WindowStyle Minimized -WorkingDirectory (Get-Location)
}

Write-Host "`n✅ All services initiated. Use 'localhost:8000' for the API Gateway and frontend proxy." -ForegroundColor Green
Write-Host "💡 NOTE: Each service is running in a minimized window. Check the taskbar if you need to see logs." -ForegroundColor Gray
