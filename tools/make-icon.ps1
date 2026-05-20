$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
New-Item -ItemType Directory -Force -Path $assets | Out-Null

function New-NtodoBitmap([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $scale = $size / 256.0
  function S([float]$value) { return [int][Math]::Round($value * $scale) }

  $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(46, 42, 34, 28))
  $paper = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 247, 224))
  $paperEdge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 202, 175, 119)), (S 6)
  $teal = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 28, 124, 104))
  $ink = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 43, 54, 65)), (S 9)
  $muted = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 151, 137, 107)), (S 7)
  $blue = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 38, 63, 115)), (S 12)

  $shadowRect = New-Object System.Drawing.Rectangle (S 38), (S 32), (S 180), (S 190)
  $paperRect = New-Object System.Drawing.Rectangle (S 30), (S 22), (S 180), (S 190)
  $radius = S 28

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($paperRect.X, $paperRect.Y, $radius, $radius, 180, 90)
  $path.AddArc($paperRect.Right - $radius, $paperRect.Y, $radius, $radius, 270, 90)
  $path.AddArc($paperRect.Right - $radius, $paperRect.Bottom - $radius, $radius, $radius, 0, 90)
  $path.AddArc($paperRect.X, $paperRect.Bottom - $radius, $radius, $radius, 90, 90)
  $path.CloseFigure()

  $shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shadowPath.AddArc($shadowRect.X, $shadowRect.Y, $radius, $radius, 180, 90)
  $shadowPath.AddArc($shadowRect.Right - $radius, $shadowRect.Y, $radius, $radius, 270, 90)
  $shadowPath.AddArc($shadowRect.Right - $radius, $shadowRect.Bottom - $radius, $radius, $radius, 0, 90)
  $shadowPath.AddArc($shadowRect.X, $shadowRect.Bottom - $radius, $radius, $radius, 90, 90)
  $shadowPath.CloseFigure()

  $graphics.FillPath($shadow, $shadowPath)
  $graphics.FillPath($paper, $path)
  $graphics.DrawPath($paperEdge, $path)

  $pinRect = New-Object System.Drawing.Rectangle (S 74), (S 6), (S 92), (S 42)
  $graphics.FillEllipse($teal, $pinRect)
  $graphics.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 235, 255, 247))), (S 110), (S 16), (S 20), (S 20))

  $graphics.DrawLine($muted, (S 70), (S 82), (S 166), (S 82))
  $graphics.DrawLine($muted, (S 70), (S 118), (S 170), (S 118))
  $graphics.DrawLine($muted, (S 70), (S 154), (S 132), (S 154))

  $graphics.DrawLines($blue, @(
    (New-Object System.Drawing.Point (S 106), (S 178)),
    (New-Object System.Drawing.Point (S 136), (S 206)),
    (New-Object System.Drawing.Point (S 199), (S 131))
  ))

  $graphics.DrawLine($ink, (S 52), (S 82), (S 54), (S 82))
  $graphics.DrawLine($ink, (S 52), (S 118), (S 54), (S 118))
  $graphics.DrawLine($ink, (S 52), (S 154), (S 54), (S 154))

  $graphics.Dispose()
  return $bitmap
}

function Get-PngBytes([System.Drawing.Bitmap]$bitmap) {
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  $stream.Dispose()
  return $bytes
}

function Write-Icon($path, [int[]]$sizes) {
  $entries = New-Object System.Collections.Generic.List[object]
  $imageData = New-Object System.Collections.Generic.List[byte[]]
  $offset = 6 + (16 * $sizes.Length)

  foreach ($size in $sizes) {
    $bitmap = New-NtodoBitmap $size
    $bytes = Get-PngBytes $bitmap
    $bitmap.Dispose()
    $imageData.Add($bytes)
    $entries.Add([pscustomobject]@{
      Size = $size
      Length = $bytes.Length
      Offset = $offset
    })
    $offset += $bytes.Length
  }

  $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::Create)
  $writer = New-Object System.IO.BinaryWriter $stream
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$sizes.Length)

  foreach ($entry in $entries) {
    $encodedSize = $entry.Size
    if ($entry.Size -eq 256) {
      $encodedSize = 0
    }
    $writer.Write([byte]$encodedSize)
    $writer.Write([byte]$encodedSize)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Length)
    $writer.Write([UInt32]$entry.Offset)
  }

  foreach ($bytes in $imageData) {
    $writer.Write($bytes)
  }

  $writer.Close()
  $stream.Close()
}

$preview = New-NtodoBitmap 512
$preview.Save((Join-Path $assets "ntodo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$preview.Dispose()
Write-Icon (Join-Path $assets "ntodo.ico") @(16, 24, 32, 48, 64, 128, 256)

Write-Host "Generated assets/ntodo.png and assets/ntodo.ico"
