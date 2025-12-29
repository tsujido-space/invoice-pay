provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.service_name
  description   = "Docker repository for Gemini Invoice Pay"
  format        = "DOCKER"
}

# Cloud Run Service (using google-beta for IAP)
resource "google_cloud_run_v2_service" "default" {
  provider = google-beta
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/${var.service_name}:${var.image_tag}"
      ports {
        container_port = 80
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # Enable Identity-Aware Proxy
  iap_enabled = true
}

# Grant IAP Service Agent permission to invoke Cloud Run
# The service agent email format is service-<PROJECT_NUMBER>@gcp-sa-iap.iam.gserviceaccount.com
data "google_project" "project" {}

resource "google_cloud_run_v2_service_iam_member" "iap_invoker" {
  location = google_cloud_run_v2_service.default.location
  name     = google_cloud_run_v2_service.default.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-iap.iam.gserviceaccount.com"
}

# Grant access to the allowed domain via IAP
resource "google_iap_web_cloud_run_service_iam_member" "member" {
  project = data.google_project.project.project_id
  location = google_cloud_run_v2_service.default.location
  service = google_cloud_run_v2_service.default.name
  role    = "roles/iap.httpsResourceAccessor"
  member  = "domain:${var.allowed_domain}"
}
