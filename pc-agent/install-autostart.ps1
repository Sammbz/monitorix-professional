# Registers the Monitorix agent to start automatically (and invisibly) at
# user logon, via a per-user Scheduled Task running pythonw.exe. No admin
# rights required. Run uninstall-autostart.ps1 to remove.
#
# Usage (from the pc-agent folder, after setting up .venv and .env):
#   powershell -ExecutionPolicy Bypass -File install-autostart.ps1

$ErrorActionPreference = "Stop"

$taskName = "MonitorixAgent"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonw = Join-Path $agentDir ".venv\Scripts\pythonw.exe"

if (-not (Test-Path $pythonw)) {
    throw "pythonw.exe not found at $pythonw - create the venv first (python -m venv .venv; pip install -r requirements.txt)"
}
if (-not (Test-Path (Join-Path $agentDir ".env"))) {
    throw ".env not found in $agentDir - copy .env.example to .env and set ENROLLMENT_TOKEN first"
}

# Headless agents log to a file (there is no console under pythonw).
$envFile = Join-Path $agentDir ".env"
$envContent = Get-Content $envFile -Raw
if ($envContent -notmatch "(?m)^LOG_FILE=.+") {
    Add-Content $envFile "`nLOG_FILE=agent.log" -Encoding utf8
    Write-Host "Added LOG_FILE=agent.log to .env (agent logs land there when headless)."
}

$action = New-ScheduledTaskAction -Execute $pythonw -Argument "main.py" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "Task '$taskName' installed and started. The agent now runs at every logon, without a window."
Write-Host "Logs: $agentDir\agent.log - Remove with uninstall-autostart.ps1."
