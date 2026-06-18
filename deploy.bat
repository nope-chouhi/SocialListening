@echo off
setlocal enabledelayedexpansion

:: 1. Show user info
echo ========================================
echo   TH CONTRIBUTION WORKFLOW
echo ========================================
for /f "delims=" %%i in ('git config user.name') do set GIT_USER=%%i
for /f "delims=" %%i in ('git config user.email') do set GIT_EMAIL=%%i
for /f "delims=" %%i in ('git branch --show-current') do set GIT_BRANCH=%%i

echo User: %GIT_USER% (%GIT_EMAIL%)
echo Current Branch: %GIT_BRANCH%
echo.

:: 2. Block main/master
if "%GIT_BRANCH%"=="main" (
    echo ERROR: Cannot run this script on the 'main' branch.
    echo Please create a feature branch first.
    pause
    exit /b 1
)
if "%GIT_BRANCH%"=="master" (
    echo ERROR: Cannot run this script on the 'master' branch.
    echo Please create a feature branch first.
    pause
    exit /b 1
)

:: 3. Show status
echo --- Current Status ---
git status --short
echo ----------------------
echo.

:: 4. Confirm staging
set /p STAGE_CONFIRM="Do you want to stage all safe changes? (Y/N): "
if /i not "%STAGE_CONFIRM%"=="Y" (
    echo Aborted.
    pause
    exit /b 0
)

:: Stage changes safely
git add .
:: Unstage dangerous files to prevent accidental commits
git reset .env* deploy_trigger.txt .gemini/ .cursor/ .kiro/ .codex/ AGENTS.md GEMINI.md CLAUDE.md local-rules.md >nul 2>&1

echo.
echo --- Staged Changes ---
git status --short
echo ----------------------

:: 5. Commit
set /p COMMIT_MSG="Enter commit message: "
if "%COMMIT_MSG%"=="" (
    echo Error: Commit message cannot be empty.
    git reset >nul 2>&1
    pause
    exit /b 1
)

git commit -m "%COMMIT_MSG%"

:: 6. Push
echo.
echo Pushing branch %GIT_BRANCH% to origin...
git push -u origin %GIT_BRANCH%

:: 7. Pull Request Instructions
echo.
echo ========================================
echo   SUCCESS!
echo ========================================
echo Your changes have been pushed to branch '%GIT_BRANCH%'.
echo Please open a Pull Request on GitHub to merge into main.
echo DO NOT deploy to production directly.
echo ========================================
pause
