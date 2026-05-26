$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
Write-Host "========================================"
Write-Host "Social Listening Project Scanner"
Write-Host "========================================"
python .\project_scanner.py --root "$PWD"
