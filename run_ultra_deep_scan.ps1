Write-Host "============================================"
Write-Host "NOPE ULTRA DEEP PROJECT SCANNER"
Write-Host "============================================"
python .\nope_ultra_deep_project_scanner.py --root "." --max-file-kb 600 --max-files 260
Write-Host ""
Write-Host "Neu muon quet ca web deploy:"
Write-Host 'python .\nope_ultra_deep_project_scanner.py --root "." --base-url "https://frontend.vercel.app" --api-url "https://backend.onrender.com"'
Read-Host "Press Enter to exit"
