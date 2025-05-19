# Kill any existing port-forward processes
Get-Process -Name "kubectl" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*port-forward*" } | Stop-Process -Force

# Start port-forwarding for all services
Start-Process powershell -ArgumentList "kubectl port-forward -n gameportal svc/game-catalog-svc 8081:3000"
Start-Process powershell -ArgumentList "kubectl port-forward -n gameportal svc/authentication-svc 8082:80"
Start-Process powershell -ArgumentList "kubectl port-forward -n gameportal svc/price-comparison-svc 8083:80"
Start-Process powershell -ArgumentList "kubectl port-forward -n monitoring svc/prometheus-svc 9090:9090"
Start-Process powershell -ArgumentList "kubectl port-forward -n monitoring svc/grafana 3000:3000"

Write-Host "All services started!"
Write-Host "Game Catalog: http://localhost:8081"
Write-Host "Authentication: http://localhost:8082"
Write-Host "Price Comparison: http://localhost:8083"
Write-Host "Prometheus: http://localhost:9090"
Write-Host "Grafana: http://localhost:3000" 