param(
  [string]$OutputRoot = "deploy\nonenull\out\srv\nonenull",
  [string]$WindowsInstaller = "release\Ntodo-Setup-1.0.exe",
  [string]$AndroidApk = "E:\Project\2\mobile\android\app\release\Ntodo-Android-1.0.apk"
)

$ErrorActionPreference = "Stop"

function Copy-Directory($Source, $Destination) {
  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
}

function Write-LatestJson($Path, $Data) {
  $Data | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$root = Resolve-Path "."
$output = Join-Path $root $OutputRoot
$downloadsRoot = Join-Path $output "downloads"
$windowsDownloads = Join-Path $downloadsRoot "windows\desktop-main"
$androidDownloads = Join-Path $downloadsRoot "android\android-release"
$apiDir = Join-Path $output "api"

New-Item -ItemType Directory -Force -Path $output | Out-Null
Remove-Item -LiteralPath (Join-Path $output "www") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $output "ntodo") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $output "account") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $downloadsRoot -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $windowsDownloads, $androidDownloads, $apiDir | Out-Null
Get-ChildItem -LiteralPath "release" -Filter "Ntodo-Setup-*.exe" -File |
  Copy-Item -Destination $windowsDownloads -Force
if (-not (Test-Path -LiteralPath (Join-Path $windowsDownloads "Ntodo-Setup-1.0.exe"))) {
  Copy-Item -LiteralPath $WindowsInstaller -Destination (Join-Path $windowsDownloads "Ntodo-Setup-1.0.exe") -Force
}
Copy-Item -LiteralPath $AndroidApk -Destination (Join-Path $androidDownloads "Ntodo-Android-1.0.apk") -Force

Write-LatestJson (Join-Path $windowsDownloads "latest.json") @{
  product = "Ntodo"
  platform = "windows"
  source = "desktop-main"
  version = "1.0"
  file = "Ntodo-Setup-1.0.exe"
  url = "https://ntodo.nonenull.top/downloads/windows/desktop-main/Ntodo-Setup-1.0.exe"
}

Write-LatestJson (Join-Path $androidDownloads "latest.json") @{
  product = "Ntodo"
  platform = "android"
  source = "android-release"
  version = "1.0"
  package = "com.ntodo.mobile"
  file = "Ntodo-Android-1.0.apk"
  url = "https://ntodo.nonenull.top/downloads/android/android-release/Ntodo-Android-1.0.apk"
}

Copy-Item -LiteralPath "deploy\nonenull\docker-compose.prod.yml" -Destination (Join-Path $apiDir "docker-compose.yml") -Force
Copy-Item -LiteralPath "deploy\nonenull\.env.example" -Destination (Join-Path $apiDir ".env.example") -Force
Copy-Item -LiteralPath "deploy\nonenull\nginx.conf" -Destination (Join-Path $output "nginx.conf") -Force
Copy-Directory "server" (Join-Path $apiDir "server")

Write-Host "Prepared dynamic release package at $output"
