@echo off
title MASTER PROJECT LAUNCHER - Deepfake Video Conferencing
echo =======================================================
echo     STARTING ALL ADVANCED AI BACKEND SERVICES
echo =======================================================

echo.
echo [1/4] Starting WebRTC Signaling Server (server.js)...
start "WebRTC Signaling Server" cmd /k "node server.js"
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Starting Deepfake Python Server...
start "Deepfake AI Server" cmd /c "cd deepfake_server && call start.bat"
timeout /t 2 /nobreak >nul

echo.
echo [3/4] Starting Local Ollama AI Tutor Server (llama3.2)...
start "Ollama AI Tutor Server" cmd /k "set OLLAMA_ORIGINS=* && ollama serve"
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Starting Next.js Web Application...
start "Next.js Web App" cmd /k "npm run dev"

echo.
echo =======================================================
echo All systems are booting up!
echo Waiting for Next.js to start, then opening browser...
echo =======================================================
timeout /t 7 /nobreak >nul

start http://localhost:3000

echo Launch complete! You can close this window.
exit
