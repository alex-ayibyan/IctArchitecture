# Kill any existing port-forward processes
Get-Process -Name "kubectl" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force

# Start port-forwarding for all services
Start-Process powershell -ArgumentList "kubectl port-forward -n gameportal/game-catalog-service 3001:80"
Start-Process powershell -ArgumentList "kubectl port-forward -n gameeportal svc/auth-service 3000:80"
Start-Process powershell -ArgumentList "kubectl port-forward -n gameportal/price-comparison-service 3002:80"
Start-Process powershell -ArgumentList "kubectl port-forward -n game-store svc/collection-management-service 3003:80"
Start-Process powershell -ArgumentList "kubectl port-forward -n monitoring svc/prometheus 9090:9090"
Start-Process powershell -ArgumentList "kubectl port-forward -n monitoring svc/grafana 3004:3000"

Write-Host "Building collection management service..."
docker build -t collection-management-service:latest ./services/collection-management

Write-Host "Applying collection management Kubernetes configuration..."
kubectl apply -f k8s/manifests/04-collection-management-deployment.yaml

Write-Host "All services started!"
Write-Host "Authentication Service: http://localhost:3000"
Write-Host "Game Catalog Service: http://localhost:3001"
Write-Host "Price Comparison Service: http://localhost:3002"
Write-Host "Collection Management Service: http://localhost:3003"
Write-Host "Prometheus: http://localhost:9090"
Write-Host "Grafana: http://localhost:3004"