# Installation script for Guardian Redact

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Green
pip install -r python-worker/requirements.txt

# Install Ollama (if not already installed)
Write-Host "Checking for Ollama installation..." -ForegroundColor Green
if (!(Get-Command "ollama" -ErrorAction SilentlyContinue)) {
    Write-Host "Ollama not found. Please install Ollama from https://ollama.ai" -ForegroundColor Yellow
    Write-Host "After installing Ollama, run: ollama pull gemma3n" -ForegroundColor Yellow
} else {
    Write-Host "Ollama found. Pulling Gemma 3n model..." -ForegroundColor Green
    ollama pull gemma3n
}

# Install Tauri CLI globally
Write-Host "Installing Tauri CLI..." -ForegroundColor Green
npm install -g @tauri-apps/cli

Write-Host "Setup complete! Run 'npm run tauri:dev' to start development." -ForegroundColor Green
