# ═══════════════════════════════════════════════════════════════
# QuickBite — Terraform EKS Infrastructure
# Provisions: VPC · EKS Cluster · Node Group · RDS · ECR repos
# ═══════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws        = { source = "hashicorp/aws",        version = "~> 5.0" }
    kubernetes = { source = "hashicorp/kubernetes",  version = "~> 2.23" }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "quickbite", ManagedBy = "terraform", Owner = "musty101" }
  }
}

# ── VPC ───────────────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "quickbite-vpc"
  cidr = "10.0.0.0/16"

  azs              = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets  = ["10.0.10.0/24", "10.0.11.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  # Required tags for EKS
  public_subnet_tags  = { "kubernetes.io/role/elb" = "1" }
  private_subnet_tags = { "kubernetes.io/role/internal-elb" = "1" }
}

# ── EKS Cluster ───────────────────────────────────────────────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.21.0"

  cluster_name    = "quickbite-cluster"
  cluster_version = "1.28"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    main = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 6
      desired_size   = 2

      labels = { role = "application" }
    }
  }
}

# ── RDS PostgreSQL ────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "quickbite-db-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "rds" {
  name   = "quickbite-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "quickbite-db"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "quickbite"
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  storage_encrypted      = true
}

# ── ECR Repositories ──────────────────────────────────────────
locals {
  services = ["api-gateway", "user-service", "restaurant-service", "order-service", "delivery-service", "notification-service", "frontend"]
}

resource "aws_ecr_repository" "services" {
  for_each             = toset(local.services)
  name                 = "quickbite/${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ── Outputs ───────────────────────────────────────────────────
output "cluster_name"      { value = module.eks.cluster_name }
output "cluster_endpoint"  { value = module.eks.cluster_endpoint }
output "rds_endpoint"      { value = aws_db_instance.postgres.address }
output "ecr_registry"      { value = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com" }
output "configure_kubectl" { value = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}" }

data "aws_caller_identity" "current" {}

variable "aws_region"   { default = "us-east-1" }
variable "db_username"  { default = "quickbite_user" }
variable "db_password"  { sensitive = true }
