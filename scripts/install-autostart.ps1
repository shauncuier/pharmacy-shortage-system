# install-autostart.ps1
#
# Registers Windows Scheduled Tasks so the pharmacy system runs 24/7 and comes
# back by itself after every reboot:
#
#   * "BMH Pharmacy Server" -> scripts\run-server.bat  (web app on port 3000)
#   * "BMH Pharmacy Tunnel" -> scripts\run-tunnel.bat  (ngrok public web address)
#
# Both tasks run as SYSTEM at computer startup (no login required), have no
# execution time limit, and restart automatically if they crash. Each runner is
# itself a supervisor loop, so a stopped server or a dropped ngrok session comes
# back within seconds.
#
# Usage - run ONCE from an elevated (Administrator) PowerShell:
#     powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
#
# Other modes:
#     powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -DryRun
#         Validate the whole setup without Administrator rights and without
#         changing anything on the machine.
#     powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -Uninstall
#         Remove both scheduled tasks (the site then only runs while launched
#         manually).

[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$ServerRunner = Join-Path $ProjectRoot 'scripts\run-server.bat'
$TunnelRunner = Join-Path $ProjectRoot 'scripts\run-tunnel.bat'

$TaskTargets = @(
    @{
        Name        = 'BMH Pharmacy Server'
        Runner      = $ServerRunner
        Log         = 'logs\server.log'
        Description = 'Runs the BMH Pharmacy shortage-management web server on port 3000, 24/7.'
    },
    @{
        Name        = 'BMH Pharmacy Tunnel'
        Runner      = $TunnelRunner
        Log         = 'logs\tunnel.log'
        Description = 'Keeps the ngrok public internet address online for the BMH Pharmacy server, 24/7.'
    }
)

Write-Host '=============================================================='
Write-Host ' BMH Pharmacy System - 24/7 Auto-Start Installer'
Write-Host '=============================================================='

# --- Verify elevation ---------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin -and -not $DryRun) {
    Write-Host '[ERROR] This script must be run as Administrator.' -ForegroundColor Red
    Write-Host '        Right-click PowerShell -> "Run as administrator", then retry.'
    Write-Host '        (Tip: add -DryRun to validate the setup without admin rights.)'
    exit 1
}

if (-not $isAdmin -and $DryRun) {
    Write-Host '[INFO] Not running as Administrator - DryRun mode, nothing will be changed.'
}

# --- Verify the runner scripts exist -----------------------------------------
foreach ($target in $TaskTargets) {
    if (-not (Test-Path $target.Runner)) {
        Write-Host "[ERROR] Runner not found: $($target.Runner)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Project root  : $ProjectRoot"
Write-Host "Server runner : $ServerRunner"
Write-Host "Tunnel runner : $TunnelRunner"
Write-Host ''

# --- Helper: turn an ISO-8601 duration (PT1M) into readable text --------------
function Format-IsoDuration {
    param([string]$Value)

    if ($Value -match '^PT(?:(\d+)H)?(?:(\d+)M)?') {
        $hours = 0
        if ($Matches[1]) { $hours = [int]$Matches[1] }
        $minutes = 0
        if ($Matches[2]) { $minutes = [int]$Matches[2] }
        $totalMinutes = ($hours * 60) + $minutes
        if ($totalMinutes -gt 0) {
            return "$totalMinutes min"
        }
    }
    return $Value
}

# --- Build the scheduled-task objects for a runner ---------------------------
function New-PharmacyTaskDefinition {
    param([Parameter(Mandatory = $true)][string]$RunnerBat)

    # Action: launch the resilient runner via cmd
    $action = New-ScheduledTaskAction `
        -Execute 'cmd.exe' `
        -Argument ('/c "{0}"' -f $RunnerBat) `
        -WorkingDirectory $ProjectRoot

    # Trigger 1: at system startup (before and without any user logging in)
    $startupTrigger = New-ScheduledTaskTrigger -AtStartup

    # Trigger 2: shortly after every logon, as a safety net that relaunches the
    # runner if it was ever closed manually. "MultipleInstances = IgnoreNew"
    # below guarantees a second copy is never started.
    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn
    $logonTrigger.Delay = 'PT1M'

    # Run as SYSTEM with highest privileges (no login required)
    $principal = New-ScheduledTaskPrincipal `
        -UserId 'SYSTEM' `
        -LogonType ServiceAccount `
        -RunLevel Highest

    # Keep it alive: never stop for lack of time, always start (even if the
    # boot trigger was missed), retry on failure, and never run twice.
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 999 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -MultipleInstances IgnoreNew `
        -ExecutionTimeLimit ([TimeSpan]::Zero)

    # IMPORTANT for 24/7: the default idle settings stop the task as soon as the
    # computer has been untouched for 10 minutes (StopOnIdleEnd = True), which
    # would silently kill the server/tunnel in an unattended pharmacy PC.
    $settings.IdleSettings.StopOnIdleEnd = $false
    $settings.IdleSettings.RestartOnIdle = $false

    return @{
        Action    = $action
        Triggers  = @($startupTrigger, $logonTrigger)
        Principal = $principal
        Settings  = $settings
    }
}

# --- Uninstall mode -----------------------------------------------------------
if ($Uninstall) {
    Write-Host 'Removing the 24/7 scheduled tasks...'
    foreach ($target in $TaskTargets) {
        if (Get-ScheduledTask -TaskName $target.Name -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $target.Name -Confirm:$false
            Write-Host "[OK] Removed task '$($target.Name)'." -ForegroundColor Green
        } else {
            Write-Host "[--] Task '$($target.Name)' was not installed."
        }
    }
    Write-Host ''
    Write-Host 'Done. Start the system manually with start-server.bat when needed.'
    exit 0
}

# --- Build all definitions (validates settings; also used by DryRun) ----------
$definitions = @{}
foreach ($target in $TaskTargets) {
    $definitions[$target.Name] = New-PharmacyTaskDefinition -RunnerBat $target.Runner
    Write-Host "[OK] Task definition ready: '$($target.Name)'" -ForegroundColor Green
}
Write-Host ''

# --- DryRun mode --------------------------------------------------------------
if ($DryRun) {
    Write-Host '[DryRun] These scheduled tasks WOULD be registered:' -ForegroundColor Yellow
    foreach ($target in $TaskTargets) {
        $definition = $definitions[$target.Name]
        Write-Host ''
        Write-Host "  Task name : $($target.Name)"
        Write-Host "  Runs      : cmd.exe /c `"$($target.Runner)`""
        Write-Host "  Triggers  : $($definition.Triggers.Count) - at startup + 1 min after any logon"
        Write-Host "  User      : $($definition.Principal.UserId) / highest privileges"
        Write-Host "  Restart   : up to $($definition.Settings.RestartCount) times, every $(Format-IsoDuration -Value $definition.Settings.RestartInterval)"
        Write-Host "  Idle stop : disabled (keeps running while the PC is unattended)"
        Write-Host "  Time limit: unlimited (24/7)"
        Write-Host "  Log file  : $($target.Log)"
    }
    Write-Host ''
    Write-Host '[DryRun] Nothing was changed on this computer.'
    exit 0
}

# --- Install / reinstall both tasks ------------------------------------------
foreach ($target in $TaskTargets) {
    if (Get-ScheduledTask -TaskName $target.Name -ErrorAction SilentlyContinue) {
        Write-Host "Removing existing task '$($target.Name)'..."
        Unregister-ScheduledTask -TaskName $target.Name -Confirm:$false
    }

    $definition = $definitions[$target.Name]
    Register-ScheduledTask `
        -TaskName $target.Name `
        -Action $definition.Action `
        -Trigger $definition.Triggers `
        -Principal $definition.Principal `
        -Settings $definition.Settings `
        -Description $target.Description `
        | Out-Null

    Write-Host "[OK] Installed task '$($target.Name)'." -ForegroundColor Green
}

Write-Host ''
Write-Host 'Starting both tasks now...'
foreach ($target in $TaskTargets) {
    Start-ScheduledTask -TaskName $target.Name
}

Start-Sleep -Seconds 20

Write-Host ''
Write-Host '----------------------- CURRENT STATUS -----------------------'
foreach ($target in $TaskTargets) {
    $task = Get-ScheduledTask -TaskName $target.Name -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host ("  {0,-22} {1}" -f $target.Name, $task.State)
    }
}

# --- Report the addresses ----------------------------------------------------
Write-Host ''
Write-Host 'Addresses on the pharmacy Wi-Fi (for staff phones):'
try {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
        Select-Object -ExpandProperty IPAddress
    if ($addresses) {
        foreach ($address in $addresses) {
            Write-Host "  http://${address}:3000"
        }
    } else {
        Write-Host '  http://localhost:3000'
    }
} catch {
    Write-Host '  http://localhost:3000'
}

$tunnelLog = Join-Path $ProjectRoot 'logs\tunnel.log'
if (Test-Path $tunnelLog) {
    $match = Select-String -Path $tunnelLog -Pattern 'Public URL:\s*(\S+)' -ErrorAction SilentlyContinue |
        Select-Object -Last 1
    if ($match) {
        Write-Host ''
        Write-Host 'Public internet address (ngrok):'
        Write-Host "  $($match.Matches[0].Groups[1].Value)"
        Write-Host '  The first browser visit shows an ngrok page - click "Visit Site".'
    }
}

Write-Host ''
Write-Host 'The web server usually takes ~10-20 seconds to become ready.'
Write-Host ''
Write-Host 'Manage the 24/7 tasks with (elevated PowerShell):'
Write-Host '  Status :  Get-ScheduledTask -TaskName "BMH Pharmacy *" | Format-Table TaskName,State'
Write-Host '  Start  :  Get-ScheduledTask -TaskName "BMH Pharmacy *" | Start-ScheduledTask'
Write-Host '  Stop   :  Get-ScheduledTask -TaskName "BMH Pharmacy *" | Stop-ScheduledTask'
Write-Host '  Remove :  powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1 -Uninstall'
Write-Host ''
Write-Host 'Logs (auto-rotated at ~5 MB):'
Write-Host '  logs\server.log   - web server output'
Write-Host '  logs\tunnel.log   - ngrok tunnel output (the public URL is printed here)'

