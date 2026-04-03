variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-north-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "AI-backend"
}
variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.32"
}
