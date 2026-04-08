resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  namespace        = "argocd"
  create_namespace = true
  version          = "7.7.0"

  set {
    name  = "server.service.type"
    value = "ClusterIP"
  }
  depends_on = [module.eks, aws_eks_access_entry.admin, aws_eks_access_entry.github_actions, helm_release.alb_controller]
}

resource "helm_release" "argo_rollouts" {
  name             = "argo-rollouts"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-rollouts"
  namespace        = "argo-rollouts"
  create_namespace = true
  depends_on       = [module.eks, aws_eks_access_entry.admin, aws_eks_access_entry.github_actions, helm_release.alb_controller]
}

resource "helm_release" "sealed_secrets" {
  name             = "sealed-secrets"
  repository       = "https://bitnami-labs.github.io/sealed-secrets"
  chart            = "sealed-secrets"
  namespace        = "kube-system"
  create_namespace = false
  depends_on       = [module.eks, aws_eks_access_entry.admin, aws_eks_access_entry.github_actions, helm_release.alb_controller]
}

resource "helm_release" "nginx_ingress" {
  name             = "nginx-ingress"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  namespace        = "ingress-nginx"
  create_namespace = true

  set {
    name  = "controller.service.type"
    value = "NodePort"
  }
  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type"
    value = "external"
  }
  depends_on = [module.eks, helm_release.alb_controller]
}

resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"

  set {
    name  = "args[0]"
    value = "--kubelet-insecure-tls"
  }
  depends_on = [module.eks, aws_eks_access_entry.admin, aws_eks_access_entry.github_actions]
}

resource "helm_release" "prometheus" {
  name             = "prometheus"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  namespace        = "monitoring"
  create_namespace = true
  version          = "67.9.0"
  timeout          = 600

  values = [file("${path.module}/prometheus-values.yaml")]

  set {
    name  = "grafana.enabled"
    value = "true"
  }
  set {
    name  = "grafana.service.type"
    value = "ClusterIP"
  }
  set {
    name  = "prometheus.service.type"
    value = "ClusterIP"
  }
  set {
    name  = "alertmanager.enabled"
    value = "true"
  }
  set {
    name  = "grafana.persistence.size"
    value = "5Gi"
  }
  set {
    name  = "prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues"
    value = "false"
  }
  set {
    name  = "prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues"
    value = "false"
  }
  depends_on = [module.eks, helm_release.metrics_server, aws_eks_access_entry.admin, aws_eks_access_entry.github_actions, helm_release.alb_controller, null_resource.alertmanager_slack_secret]
}

resource "null_resource" "alertmanager_slack_secret" {
  provisioner "local-exec" {
    command = "kubectl apply -f ${path.module}/alertmanager-slack-sealed.yaml"
  }
  triggers = {
    sealed_secrets_hash = filesha256("${path.module}/alertmanager-slack-sealed.yaml")
  }
  depends_on = [ helm_release.sealed_secrets ]
}
