param(
  [string]$ExePath
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if (-not $ExePath) {
  $ExePath = Join-Path $root "release\win-unpacked\Ntodo.exe"
}

$iconPath = Join-Path $root "assets\ntodo.ico"
if (-not (Test-Path $ExePath)) {
  Write-Host "Executable not found: $ExePath" -ForegroundColor Yellow
  exit 1
}
if (-not (Test-Path $iconPath)) {
  Write-Host "Icon not found: $iconPath" -ForegroundColor Yellow
  exit 1
}

$rcedit = Join-Path $root "node_modules\rcedit\bin\rcedit-x64.exe"
if (-not (Test-Path $rcedit)) {
  $rcedit = Join-Path $root "node_modules\rcedit\bin\rcedit.exe"
}
if (-not (Test-Path $rcedit)) {
  Write-Host "rcedit executable not found. Run npm install first." -ForegroundColor Yellow
  exit 1
}

& $rcedit "$ExePath" --set-icon "$iconPath"
exit $LASTEXITCODE
