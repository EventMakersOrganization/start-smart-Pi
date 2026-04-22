$baseUrl = "https://raw.githubusercontent.com/vladmandic/face-api/master/model/"
$targetDir = "src/assets/models"

if (!(Test-Path $targetDir)) { 
    New-Item -ItemType Directory -Path $targetDir 
}

$files = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1"
)

foreach ($file in $files) {
    Write-Host "Downloading $file..."
    try {
        Invoke-WebRequest -Uri "$($baseUrl)$file" -OutFile "$targetDir/$file"
    } catch {
        Write-Error "Failed to download $file"
    }
}

Write-Host "Download complete!"
