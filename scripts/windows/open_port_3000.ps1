# Opens Windows Firewall inbound TCP port 3000 for AeroGuard backend
# Usage (run as Administrator):
#   powershell -ExecutionPolicy Bypass -File .\scripts\windows\open_port_3000.ps1

$ErrorActionPreference = 'Stop'

$ruleName = 'AeroGuard Backend Port 3000'
$port = 3000

# Check admin
$windowsIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$windowsPrincipal = New-Object Security.Principal.WindowsPrincipal($windowsIdentity)
$admin = $windowsPrincipal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $admin) {
  Write-Error 'This script must be run in an elevated (Administrator) PowerShell session.'
  exit 1
}

# Check if rule already exists
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Firewall rule '$ruleName' already exists. Skipping creation." -ForegroundColor Yellow
  exit 0
}

# Create inbound rule for TCP 3000 on all profiles
New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Enabled True `
  -Protocol TCP `
  -LocalPort $port `
  -Profile Any | Out-Null

# Verify
$created = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($created) {
  Write-Host "Firewall rule created: '$ruleName' for TCP port $port" -ForegroundColor Green
  exit 0
} else {
  Write-Error 'Failed to create firewall rule.'
  exit 2
}
