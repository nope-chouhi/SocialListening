@echo off
echo ========================================
echo   Deploying to GitHub...
echo ========================================
echo.

set /p commit_msg="Enter commit message (Press Enter for 'auto-deploy update'): "
if "%commit_msg%"=="" set commit_msg=auto-deploy update

echo.
echo Adding changes...
git add .
git diff --cached --quiet || git commit -m "%commit_msg%"

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
pause
