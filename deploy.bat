@echo off
chcp 65001 > nul
echo ========================================
echo    DEPLOY TO GITHUB / VERCEL
echo ========================================
echo.

echo 1. Tao thay doi de ep Vercel build...
echo Deploy triggered at %date% %time% > deploy_trigger.txt

echo.
echo 2. Add va Commit code...
git add .
git commit -m "Auto deploy update (forced)"

echo.
echo 3. Dong bo code moi nhat (Pull)...
git pull origin main --rebase

echo.
echo 4. Day code len mang (Push)...
git push origin main

echo.
echo ========================================
echo   DA DAY CODE LEN THANH CONG!
echo ========================================
echo Backend:  https://social-listening-backend.onrender.com
echo Frontend: https://social-listening-azure.vercel.app
echo.
echo Vercel dang bat dau build, doi mot chut la len nhe!
echo.
REM pause
