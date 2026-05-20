param(
  [switch]$Installer,
  [switch]$Portable
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outputName = "release"
if ($Installer) {
  $outputName = "installer"
}
if ($Portable) {
  $outputName = "portable"
}
$outputDir = Join-Path $root $outputName
$env:ELECTRON_CACHE = Join-Path $root ".cache\electron"
$env:ELECTRON_BUILDER_CACHE = Join-Path $root ".cache\electron-builder"
$env:NTODO_BUILD_OUTPUT = $outputDir

New-Item -ItemType Directory -Force -Path $env:ELECTRON_CACHE | Out-Null
New-Item -ItemType Directory -Force -Path $env:ELECTRON_BUILDER_CACHE | Out-Null

& npm run make:icon
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$target = "dir"
if ($Installer) {
  $target = "nsis"
}
if ($Portable) {
  $target = "portable"
}

& npx electron-builder --win $target --config.directories.output="$outputDir"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$fastExe = Join-Path $outputDir "win-unpacked\Ntodo.exe"
if (Test-Path $fastExe) {
  $shortcutPath = Join-Path $outputDir "Ntodo-fast-start.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $fastExe
  $shortcut.WorkingDirectory = Split-Path -Parent $fastExe
  $shortcut.IconLocation = Join-Path $root "assets\ntodo.ico"
  $shortcut.Save()
}

exit $LASTEXITCODE
