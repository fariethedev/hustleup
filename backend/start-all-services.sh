#!/bin/bash

# HustleUp Microservices Startup Script (Bash version)
# Starts all services in proper order with correct timing

SERVICES=(
    "hustleup-gateway:8000"
    "hustleup-auth:8081"
    "hustleup-social:8082"
    "hustleup-marketplace:8083"
    "hustleup-subscription:8084"
    "hustleup-notification:8085"
)

echo "🚀 Launching HustleUp Microservices..."
echo ""

for service in "${SERVICES[@]}"; do
    IFS=':' read -r dir port <<< "$service"
    name=$(echo $dir | sed 's/hustleup-//' | tr '[:lower:]' '[:upper:]')
    
    echo "✨ Starting $name on port $port..."
    mvn spring-boot:run -pl "$dir" > "spring-boot-$port.out.log" 2> "spring-boot-$port.err.log" &
    
    # Wait for service to start before moving to next
    sleep 5
done

echo ""
echo "✅ All services started!"
echo "📡 API Gateway running on: http://localhost:8000"
echo "🌐 Frontend should connect to: http://localhost:8000/api/v1"
echo ""
echo "📊 Service Ports:"
echo "  - Gateway:      8000"
echo "  - Auth:         8081"
echo "  - Social:       8082"
echo "  - Marketplace:  8083"
echo "  - Subscription: 8084"
echo "  - Notification: 8085"
