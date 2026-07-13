# Builds MonitorixAgent.exe — a standalone agent that needs no Python on the
# target PC. Run from the pc-agent folder after setting up the venv:
#
#   powershell -ExecutionPolicy Bypass -File build-exe.ps1
#
# Output: dist\MonitorixAgent.exe. Copy that single file to any Windows PC,
# double-click it, paste the enrollment code in the connect window, and use
# the tray menu's "Démarrer avec Windows" to make it persist.

$ErrorActionPreference = "Stop"
$py = ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    throw "venv not found — run: python -m venv .venv; .venv\Scripts\activate; pip install -r requirements.txt"
}

& $py -m PyInstaller `
    --noconfirm --clean `
    --onefile --windowed `
    --name MonitorixAgent `
    --icon agent.ico `
    --hidden-import pystray._win32 `
    main.py

Write-Host ""
Write-Host "Done: dist\MonitorixAgent.exe"
