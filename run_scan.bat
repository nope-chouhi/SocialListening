@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo Social Listening Project Scanner
echo ========================================
python project_scanner.py --root "%cd%"
pause
