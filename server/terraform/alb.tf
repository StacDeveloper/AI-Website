locals {
  cluster_name = var.cluster_name
}
resource "aws_iam_policy" "alb_controller" {
  name        = "AwsLoadBalancerControllerIamPolicy"
  description = "Iam policy for AWS Balanacer Controller"
  policy      = file("${path.module}/alb-iam-policy.json")
}

module "alb_controller_irsa" {
  source                                 = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version                                = "~>5.0"
  role_name                              = "alb-controller-${var.cluster_name}"
  attach_load_balancer_controller_policy = true
  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}

resource "helm_release" "alb_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts/"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.11.0"

  set {
    name  = "clusterName"
    value = local.cluster_name
  }

  set{
    name = "region"
    value = var.region
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }
  set {
    name  = "serviceAccount.name"
    value = var.region
  }
  set {
    name  = "vpcId"
    value = module.vpc.vpc_id
  }
  depends_on = [
    module.eks,
    module.alb_controller_irsa,
    aws_eks_access_entry.admin,
    aws_eks_access_entry.github_actions
  ]
}
