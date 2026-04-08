# Setup script to pull required Ollama models
# Run this after Ollama installation completes

Write-Host "Waiting for Ollama to be available..." -ForegroundColor Cyan

# Wait for Ollama to be installed and available
$timeout = 0
$maxWait = 600  # 10 minutes
while ($null -eq (Get-Command ollama -ErrorAction SilentlyContinue)) {
    if ($timeout -ge $maxWait) {
        Write-Host "Timeout waiting for Ollama installation. Please check the installation status." -ForegroundColor Red
        exit 1
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $timeout += 5
}

Write-Host "`nOllama found! Starting service..." -ForegroundColor Green

# Start Ollama service (it runs as a background service on Windows)
# Give it a moment to start
Start-Sleep -Seconds 3

Write-Host "Pulling Ollama models..." -ForegroundColor Cyan
Write-Host "This may take several minutes depending on internet speed." -ForegroundColor Yellow

# Pull required models from .env
$models = @(
    "nomic-embed-text",
    "qwen2.5:3b",
    "mistral"
)

foreach ($model in $models) {
    Write-Host "`nPulling model: $model" -ForegroundColor Yellow
    
    if (ollama pull $model) {
        Write-Host "✓ Successfully pulled $model" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to pull $model" -ForegroundColor Red
        Write-Host "Continuing with other models..." -ForegroundColor Yellow
    }
}

Write-Host "`n✓ Model setup complete!" -ForegroundColor Green
Write-Host "You can now start the AI service with: py -3.11 -m uvicorn api:app --reload" -ForegroundColor Cyan
