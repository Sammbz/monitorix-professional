# Removes the MonitorixAgent autostart task installed by
# install-autostart.ps1 and stops the running agent.
#
# Usage: powershell -ExecutionPolicy Bypass -File uninstall-autostart.ps1

$ErrorActionPreference = "Stop"

$taskName = "MonitorixAgent"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
    Write-Host "Task '$taskName' is not installed - nothing to do."
    exit 0
}

try { Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop } catch {}
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false

Write-Host "Task '$taskName' stopped and removed. The agent will no longer start at logon."
