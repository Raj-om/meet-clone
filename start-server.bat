@echo off
cd /d "%~dp0"

echo [1/4] Starting Deepfake AI Server...
start /B cmd.exe /c "cd /d "%~dp0deepfake_server" && call start.bat"

echo [2/4] Starting Ollama DeepSeek AI...
start /B cmd.exe /c "set OLLAMA_ORIGINS=* && ollama serve"

echo [3/4] Starting Fast Production Server (Instant)...
start /B npx next start

:: Wait 3 seconds for the Next.js server to spin up
timeout /t 3 /nobreak >nul

echo [4/4] Starting Cloudflare Tunnel...
start /B cloudflared tunnel --url http://localhost:3000 --protocol http2

:: Launch Chrome in App Mode (kiosk-like window without tabs/URL bar)
start chrome --app=http://localhost:3000
