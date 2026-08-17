param(
  [string]$TaskName = "VEX Override Event Data Update",
  [string]$Time = "03:00"
)

$repo = Split-Path -Parent $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) {
  throw "npm.cmd was not found on PATH. Install Node.js first, then rerun this script."
}

$action = New-ScheduledTaskAction -Execute $npm -Argument "run vex:update" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Refresh VEX event JSON for vexoverride.com" -Force | Out-Null
Write-Host "Installed scheduled task '$TaskName' to run daily at $Time."
