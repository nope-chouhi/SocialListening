@echo off
chcp 65001 > nul
echo ========================================
echo   Deploying to GitHub...
echo ========================================
echo.

echo 1. Adding changes...
git add .

echo.
echo 2. Committing changes...
git commit --allow-empty -m "Auto deploy update"

echo.
echo 3. Syncing with remote...
git pull origin main --rebase

echo.
echo 4. Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo   DEPLOYED SUCCESSFULLY!
echo ========================================
echo Backend:  https://social-listening-backend.onrender.com
echo Frontend: https://social-listening-azure.vercel.app
echo.
echo Vui long doi vai phut de Render va Vercel build.
echo.
pause
