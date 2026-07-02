@echo off
echo ================================================
echo  DIRE Deepfake Detection Server - Setup ^& Start
echo ================================================

cd /d "%~dp0"

REM Check if venv exists
if not exist "venv" (
    echo [1/3] Creating Python virtual environment...
    python -m venv venv
)

REM Activate and install
echo [2/3] Installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

REM Start server
echo [3/3] Starting DIRE server on http://localhost:5001 ...
echo.
echo  ^> Health check: http://localhost:5001/health
echo  ^> To use DIRE model: place dire.pth in deepfake_server\models\
echo.
python app.py
