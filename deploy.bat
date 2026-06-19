@echo off
chcp 65001 > nul
echo ========================================
echo    ERROR: DIRECT DEPLOY DISABLED
echo ========================================
echo.
echo Direct push and deployment to the main branch is no longer allowed.
echo The project now follows a professional Pull Request workflow.
echo.
echo Please create a new branch, commit your changes, push the branch,
echo and create a Pull Request on GitHub.
echo.
exit /b 1
