variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "asia-northeast1"
}

variable "service_name" {
  description = "Cloud Run Service Name"
  type        = string
  default     = "gemini-invoice-pay"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "allowed_domain" {
  description = "Domain allowed to access the service via IAP"
  type        = string
  default     = "tsujido.co.jp"
}

variable "gemini_api_key" {
  description = "API Key for Gemini"
  type        = string
  sensitive   = true
}
