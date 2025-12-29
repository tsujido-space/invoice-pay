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

# Enable APIs
resource "google_project_service" "services" {
  for_each = toset([
    "firestore.googleapis.com",
    "drive.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# Cloud Run Service (using google-beta for IAP)
resource "google_cloud_run_v2_service" "default" {
  provider = google-beta
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false
  launch_stage = "BETA"

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
  cloud_run_service_name = google_cloud_run_v2_service.default.name
  role    = "roles/iap.httpsResourceAccessor"
  member  = "domain:${var.allowed_domain}"
}

# Firestore Database
resource "google_firestore_database" "database" {
  provider                          = google-beta
  name                              = "invoice"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  deletion_policy                   = "DELETE"
  depends_on                        = [google_project_service.services]
}

# Grant Firestore User role to the default compute service account
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Firestore Security Rules (Allow all within the project context)
# Since IAP is protecting the front-end, we can allow read/write from authenticated web clients.
resource "google_firebaserules_ruleset" "firestore" {
  project = var.project_id
  source {
    files {
      name    = "firestore.rules"
      content = "service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }"
    }
  }
}
resource "google_firebaserules_release" "firestore" {
  name         = "cloud.firestore/invoice"
  ruleset_name = google_firebaserules_ruleset.firestore.name
  project      = var.project_id
}
