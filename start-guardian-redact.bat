@echo off
title Guardian Redact - Private AI Redaction Suite
echo.
echo ======================================================
echo  🛡️ Guardian Redact - Starting Application
echo  🧠 Powered by Gemma 3n AI Intelligence
echo ======================================================
echo.

echo ⚡ Checking Ollama service...
ollama serve >nul 2>&1 &

echo 🎯 Starting Gemma 3n model...
timeout /t 2 /nobreak >nul
ollama pull gemma3n >nul 2>&1

echo 🚀 Launching Guardian Redact...
echo.
echo 📱 The application will open in a new window
echo 🧠 All processing happens locally with Gemma 3n
echo 🔒 Your data never leaves this device
echo.

npm run tauri:dev

echo.
echo Application closed. Press any key to exit...
pause >nul
