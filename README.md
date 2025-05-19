# Game Meta-Store Microservices

This project implements a meta-store for games using a microservices architecture. It allows users to compare game prices across different platforms, manage their game collection, and receive notifications about price changes.

## Services

1. **Authentication Service** (Port 3000)
   - Handles user registration and login
   - JWT-based authentication
   - Health check endpoint

2. **Game Catalog Service** (Port 3001)
   - Manages game metadata
   - Provides game information
   - Health check endpoint

3. **Price Comparison Service** (Port 3002)
   - Compares game prices across different stores
   - Implements circuit breaker pattern for resilience
   - Health check endpoint

## Monitoring

The project includes monitoring using:
- Prometheus for metrics collection
- Grafana for visualization

## Prerequisites

- Docker
- Kubernetes cluster (or Minikube)
- kubectl

## Setup

1. Build the Docker images:
```bash
# Build auth service
cd services/auth
docker build -t auth-service:latest .

# Build game catalog service
cd ../game-catalog
docker build -t game-catalog-service:latest .

# Build price comparison service
cd ../price-comparison
docker build -t price-comparison-service:latest .
```

2. Apply Kubernetes configurations in order:
```bash
# Apply all configurations from the manifests directory
kubectl apply -f k8s/manifests/00-namespaces.yaml
kubectl apply -f k8s/manifests/00-secrets.yaml
kubectl apply -f k8s/manifests/01-auth-deployment.yaml
kubectl apply -f k8s/manifests/02-game-catalog-deployment.yaml
kubectl apply -f k8s/manifests/03-price-comparison-deployment.yaml
kubectl apply -f k8s/manifests/03-ingress.yaml
kubectl apply -f k8s/manifests/04-price-comparison-hpa.yaml
kubectl apply -f k8s/manifests/04-prometheus.yaml
kubectl apply -f k8s/manifests/05-grafana.yaml
```

3. Access the services:
```bash
# Port forward the services
kubectl port-forward svc/auth-service 3000:80 -n game-store
kubectl port-forward svc/game-catalog-service 3001:80 -n game-store
kubectl port-forward svc/price-comparison-service 3002:80 -n game-store
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
kubectl port-forward svc/grafana 3003:3000 -n monitoring
```

## Testing

You can test the services using curl:

1. Register a new user:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'
```

2. Get game catalog:
```bash
curl http://localhost:3001/games
```

3. Get game prices:
```bash
curl http://localhost:3002/prices/1
```

## Monitoring

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3003 (admin/admin123)

## Architecture

The project follows a microservices architecture with:
- Independent services with their own databases
- Service discovery through Kubernetes
- Circuit breaker pattern for resilience
- Health checks and monitoring
- JWT-based authentication

## Development

To add new features or modify existing ones:
1. Update the relevant service code
2. Rebuild the Docker image
3. Update the Kubernetes deployment in k8s/manifests
4. Apply the changes using kubectl