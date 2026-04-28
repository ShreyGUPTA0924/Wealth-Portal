@echo off
set "PYTHON_PATH="

if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set "PYTHON_PATH=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
    set "PYTHON_PATH=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else (
    echo Could not find Python 3.12 or 3.13 in AppData\Local\Programs\Python
    pause
    exit /b 1
)

echo Using Python from: %PYTHON_PATH%

REM Check if venv is using msys64/mingw, if so, remove it to force recreation
if exist venv\pyvenv.cfg (
    findstr /i "msys64" venv\pyvenv.cfg >nul
    if not errorlevel 1 (
        echo MinGW Python detected in venv. Rebuilding using AppData Python...
        rmdir /s /q venv
    )
)

if not exist venv (
    echo Creating new virtual environment...
    "%PYTHON_PATH%" -m venv venv
    call venv\Scripts\activate.bat
    echo Installing requirements...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo Starting AI Service...
python -m uvicorn app.main:app --reload --port 8000
pause