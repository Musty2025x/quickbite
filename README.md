# 🍔 QuickBite — Microservices Food Delivery Platform

> **Production-grade microservices architecture** deployed on **AWS EKS (Kubernetes)** — built to demonstrate real-world DevOps and Cloud Engineering skills.

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions)](https://github.com)
[![Kubernetes](https://img.shields.io/badge/Orchestration-EKS%20%2F%20K8s-326CE5?logo=kubernetes)](https://kubernetes.io)
[![Docker](https://img.shields.io/badge/Containers-Docker-2496ED?logo=docker)](https://docker.com)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform)](https://terraform.io)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Backend-Python%20FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)

---

## 🏗 Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │          AWS EKS Cluster                 │
                        │                                          │
Internet ──► ALB ──────►│  Ingress Controller                     │
                        │       │                                  │
                        │  ┌────▼──────┐                          │
                        │  │API Gateway│ (Node.js) :3000          │
                        │  └─────┬─────┘                          │
                        │   ┌────┴──────────────────────┐         │
                        │   │                           │          │
                        │ ┌─▼──────┐  ┌─────────────┐  │         │
                        │ │  User  │  │ Restaurant  │  │         │
                        │ │Service │  │   Service   │  │         │
                        │ │Node.js │  │  Node.js    │  │         │
                        │ └────────┘  └─────────────┘  │         │
                        │                              │           │
                        │ ┌──────────┐ ┌────────────┐ │          │
                        │ │  Order   │ │  Delivery  │ │          │
                        │ │ Service  │ │  Service   │ │          │
                        │ │ Node.js  │ │  Node.js   │ │          │
                        │ └──────────┘ └────────────┘ │          │
                        │                             │            │
                        │ ┌─────────────────────────┐ │           │
                        │ │  Notification Service   │ │           │
                        │ │  Python / FastAPI       │ │           │
                        │ └─────────────────────────┘            │
                        └─────────────────────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   AWS RDS PostgreSQL │
                              │   (5 databases)      │
                              └─────────────────────┘
```

---

## 🚀 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Orchestration** | Kubernetes (AWS EKS) | Container orchestration, auto-scaling |
| **Infrastructure** | Terraform | EKS cluster, VPC, RDS, ECR provisioning |
| **CI/CD** | GitHub Actions | Build → ECR → Deploy to EKS |
| **API Gateway** | Node.js + Express | Request routing, JWT auth, rate limiting |
| **User Service** | Node.js + Express | Auth, registration, profiles (PostgreSQL) |
| **Restaurant Service** | Node.js + Express | Menus, listings, search (PostgreSQL) |
| **Order Service** | Node.js + Express | Order lifecycle, transactions (PostgreSQL) |
| **Delivery Service** | Node.js + Express | Driver tracking, assignments (PostgreSQL) |
| **Notification Service** | **Python + FastAPI** | Alerts, push notifications (PostgreSQL) |
| **Frontend** | Vanilla JS + Nginx | SPA served via Nginx container |
| **Database** | PostgreSQL (RDS) | Per-service databases (polyglot persistence) |
| **Container Registry** | AWS ECR | Private Docker image storage |
| **Load Balancer** | AWS ALB | HTTPS termination, Ingress |

---

## 📁 Project Structure

```
quickbite/
├── services/
│   ├── api-gateway/          # Node.js — routes + auth
│   ├── user-service/         # Node.js — users + JWT
│   ├── restaurant-service/   # Node.js — restaurants + menus
│   ├── order-service/        # Node.js — orders + checkout
│   ├── delivery-service/     # Node.js — drivers + tracking
│   └── notification-service/ # 🐍 Python FastAPI — alerts
├── frontend/                 # Static SPA + Nginx
├── k8s/
│   ├── base/                 # Namespace, ConfigMap, Secrets
│   ├── services/             # Deployments, Services, HPA
│   └── ingress/              # ALB Ingress
├── terraform/                # EKS, VPC, RDS, ECR
├── scripts/                  # DB init scripts
├── .github/workflows/        # CI/CD pipeline
└── docker-compose.yml        # Local development
```

---

## ⚡ Key DevOps Features

- **Auto-scaling** — HPA scales API Gateway up to 10 pods, Order Service up to 8 pods based on CPU
- **Rolling deployments** — Zero-downtime updates with `maxUnavailable: 0`
- **Health checks** — Liveness + readiness probes on every service
- **Resource limits** — CPU/memory requests and limits on every container
- **Polyglot** — Node.js for most services, Python/FastAPI for notifications (demonstrates language flexibility)
- **Separate databases** — Each service owns its own database (true microservices pattern)
- **GitOps CI/CD** — Push to main → GitHub Actions builds only changed services → pushes to ECR → rolling deploy to EKS
- **Path filtering** — CI only rebuilds services whose code actually changed
- **Secrets management** — K8s Secrets for DB credentials, JWT secret
- **Non-root containers** — All services run as non-root users

---

## 🏃 Local Development

```bash
# Clone
git clone https://github.com/Musty2025x/quickbite.git
cd quickbite

# Start all services
docker-compose up -d --build

# Access
# Frontend:              http://localhost
# API Gateway:           http://localhost:3000
# User Service:          http://localhost:3001
# Restaurant Service:    http://localhost:3002
# Order Service:         http://localhost:3003
# Delivery Service:      http://localhost:3004
# Notification Service:  http://localhost:5001/docs (FastAPI Swagger UI)
```

---

## ☁️ EKS Deployment

### Step 1 — Provision infrastructure with Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Fill in: db_password

terraform init
terraform plan
terraform apply
# Takes ~15 minutes — creates EKS, VPC, RDS, ECR repos
```

### Step 2 — Configure kubectl

```bash
# Terraform outputs this command:
aws eks update-kubeconfig --name quickbite-cluster --region us-east-1
kubectl get nodes  # verify cluster access
```

### Step 3 — Push images to ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com

# Build and push all services
ECR=$(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com

for svc in api-gateway user-service restaurant-service order-service delivery-service notification-service; do
  docker build -t $ECR/quickbite/$svc:latest services/$svc/
  docker push $ECR/quickbite/$svc:latest
done

docker build -t $ECR/quickbite/frontend:latest frontend/
docker push $ECR/quickbite/frontend:latest
```

### Step 4 — Create K8s secrets

```bash
kubectl apply -f k8s/base/namespace-configmap.yaml

kubectl create secret generic quickbite-secrets \
  --namespace quickbite \
  --from-literal=DB_HOST=$(terraform -chdir=terraform output -raw rds_endpoint) \
  --from-literal=DB_USER=quickbite_user \
  --from-literal=DB_PASSWORD=YourPassword \
  --from-literal=JWT_SECRET=your-jwt-secret-32chars
```

### Step 5 — Deploy to EKS

```bash
# Update ECR account ID in manifests
ECR_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
sed -i "s/YOUR_ECR_ACCOUNT/$ECR_ACCOUNT/g" k8s/services/deployments.yaml

kubectl apply -f k8s/base/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress/

kubectl get pods -n quickbite -w  # watch pods come up
kubectl get ingress -n quickbite  # get ALB URL
```

---

## 🔄 CI/CD Pipeline

```
Push to main
    │
    ├─ Detect changed services (paths-filter)
    │
    ├─ For each changed service:
    │   ├─ Build Docker image
    │   ├─ Tag with commit SHA
    │   └─ Push to ECR
    │
    └─ Deploy to EKS
        ├─ Update image tags in manifests
        ├─ kubectl apply
        ├─ Wait for rollout
        └─ Verify pods healthy
```

---

## 📡 API Reference

All requests go through the API Gateway at `/api/`:

```bash
# Register
POST /api/users/register   { name, email, password, phone }

# Login
POST /api/users/login      { email, password }

# List restaurants
GET  /api/restaurants?cuisine=Nigerian&search=suya

# Restaurant + menu
GET  /api/restaurants/:id

# Place order (auth required)
POST /api/orders           { restaurant_id, items, delivery_address }

# My orders (auth required)
GET  /api/orders

# Track delivery (auth required)
GET  /api/delivery/order/:orderId

# Notifications (auth required)
GET  /api/notifications/:userId
```

---

## 🗂 GitLab Portfolio
```
gitlab.com/musty2025x/devops-portfolio-2025
└── quickbite-microservices-eks/
```
