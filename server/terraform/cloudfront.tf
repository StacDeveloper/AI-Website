

# resource "aws_cloudfront_distribution" "app" {
#   enabled             = true
#   comment             = "AI backend Cloudfront"
#   default_root_object = "/"

#   origin {
#     domain_name = data.aws_lb.app.dns_name
#     origin_id   = "alb-origin"

#     custom_origin_config {
#       http_port              = 80
#       https_port             = 443
#       origin_protocol_policy = "http-only"
#       origin_ssl_protocols   = ["TLSv1.2"]
#     }
#   }

#   default_cache_behavior {
#     allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
#     cached_methods         = ["GET", "HEAD"]
#     target_origin_id       = "alb-origin"
#     viewer_protocol_policy = "redirect-to-https"
#     forwarded_values {
#       query_string = true
#       headers      = ["*"]
#       cookies {
#         forward = "all"
#       }
#     }
#     min_ttl     = 0
#     default_ttl = 0
#     max_ttl     = 0
#   }
#   restrictions {
#     geo_restriction {
#       restriction_type = "none"
#     }
#   }
#   viewer_certificate {
#     cloudfront_default_certificate = true
#     minimum_protocol_version = "TLSv1.2_2021"
#   }
#   tags = {
#     Environment = "learning"
#     Project     = "AI-backend"
#   }
# }
# data "aws_lb" "app" {
#   tags = {
#     "ingress.k8s.aws/stack" = "ingress-nginx/alb-ingress"
#   }
#   depends_on = [ helm_release.nginx_ingress ]
# }
# output "cloudfront_url" {
#   value = "https://${aws_cloudfront_distribution.app.domain_name}"
# }
