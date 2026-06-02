@echo off
echo ========================================
echo   Deploying to GitHub...
echo ========================================
echo.

echo Adding changes...
git add .
git diff --cached --quiet || git commit -m "auto-deploy update"

echo.
echo Syncing with remote before pushing...
git pull origin main --rebase

echo.
git push origin main

echo.
echo ========================================
echo   DEPLOYED SUCCESSFULLY!
echo ========================================
echo.
echo Backend:  https://social-listening-backend.onrender.com
echo Frontend: https://social-listening-azure.vercel.app
echo.
echo Auto-deployment will complete in 2-5 minutes.
echo.
timeout /t 5 > NUL
