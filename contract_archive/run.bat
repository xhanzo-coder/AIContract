@echo off
echo Starting Contract Archive System...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo Error: Virtual environment not found!
    echo Please run setup first or check if venv folder exists
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if dependencies are installed (quick check)
python -c "import fastapi, uvicorn, streamlit" >nul 2>&1
if errorlevel 1 (
    echo Installing missing dependencies...
    pip install -r requirements.txt
)

:: Create directories
if not exist "data\uploads" mkdir data\uploads
if not exist "data\faiss_index" mkdir data\faiss_index

:: Copy config file
if not exist ".env" (
    copy .env.example .env
    echo Please edit .env file to configure API keys
)

:: Start services
echo Starting services...
echo Frontend: http://localhost:8501
echo Backend: http://localhost:8000
echo ========================

start /b venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
timeout /t 3 /nobreak >nul
venv\Scripts\python.exe -m streamlit run frontend\streamlit_app.py --server.port 8501