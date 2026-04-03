module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~>5.0"

  name = "${var.cluster_name}-vpc"
  cidr = "192.168.0.0/16"

  azs             = ["${var.region}a", "${var.region}b", "${var.region}c"]
  private_subnets = ["192.168.1.0/24", "192.168.2.0/24", "192.168.3.0/24"]
  public_subnets  = ["192.168.101.0/24", "192.168.102.0/24", "192.168.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name                   = var.cluster_name
  cluster_version                = var.cluster_version
  cluster_endpoint_public_access = true
  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets

  cluster_compute_config = {
    enabled    = true
    node_pools = ["general-purpose"]
  }

  tags = {
    Environment = "learning"
    Project     = "AI-backend"
  }
}

resource "aws_eks_access_entry" "admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = "arn:aws:iam::526335608044:user/John"
  type          = "STANDARD"
}
resource "aws_eks_access_policy_association" "admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = "arn:aws:iam::526335608044:user/John"
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }
  depends_on = [aws_eks_access_entry.admin]
}
