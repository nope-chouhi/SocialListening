@echo off
chcp 65001 >nul
echo ============================================
echo NOPE ULTRA DEEP PROJECT SCANNER
echo ============================================
echo Dang quet cuc sau du an hien tai...
python nope_ultra_deep_project_scanner.py --root "." --max-file-kb 600 --max-files 260
echo.
echo Neu muon quet ca web deploy:
echo python nope_ultra_deep_project_scanner.py --root "." --base-url "https://frontend.vercel.app" --api-url "https://backend.onrender.com"
pause
