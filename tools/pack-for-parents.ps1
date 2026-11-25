# Builds a ZIP ready to send to parents (no secrets, no .runtime)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Stamp = Get-Date -Format "yyyyMMdd"
$OutDir = Join-Path $Root "dist"
$Stage = Join-Path $OutDir "HamrahUlum"
$Zip = Join-Path $OutDir "HamrahUlum-Windows-$Stamp.zip"

Write-Host "Packing for parents from: $Root"

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

$excludeDirNames = @(
  ".runtime", "dist", "node_modules", "__pycache__", ".git",
  "agent-tools", ".cursor"
)
$excludeFileNames = @(
  "agent-proxy.json", "app.sqlite", "app.sqlite-wal", "app.sqlite-shm"
)
$excludeExt = @(".zip", ".pyc", ".log")

function ShouldSkip($item, $rootPath) {
  $rel = $item.FullName.Substring($rootPath.Length).TrimStart("\", "/")
  foreach ($p in ($rel -split "[\\/]")) {
    if ($excludeDirNames -contains $p) { return $true }
  }
  if ($excludeFileNames -contains $item.Name) { return $true }
  if ($excludeExt -contains $item.Extension.ToLowerInvariant()) { return $true }
  return $false
}

$files = Get-ChildItem -LiteralPath $Root -Recurse -Force -File | Where-Object {
  -not (ShouldSkip $_ $Root.Path)
}

foreach ($f in $files) {
  $rel = $f.FullName.Substring($Root.Path.Length).TrimStart("\")
  $target = Join-Path $Stage $rel
  $tdir = Split-Path $target -Parent
  if (-not (Test-Path $tdir)) { New-Item -ItemType Directory -Force -Path $tdir | Out-Null }
  Copy-Item -LiteralPath $f.FullName -Destination $target -Force
}

$dataDir = Join-Path $Stage "data"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
Set-Content -LiteralPath (Join-Path $dataDir "shared-adds.json") -Value "{}" -Encoding UTF8
@"
{
  "target": "http://127.0.0.1:20128/v1",
  "apiKey": ""
}
"@ | Set-Content -LiteralPath (Join-Path $Stage "agent-proxy.json") -Encoding UTF8

Copy-Item -LiteralPath (Join-Path $Stage "BARAYE-VALEDIN.txt") -Destination (Join-Path $Stage "00-BEKHAN.txt") -Force

Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip -Force

$sizeMb = [math]::Round((Get-Item $Zip).Length / 1MB, 1)
Write-Host ""
Write-Host "Ready for parents ($sizeMb MB):"
Write-Host "  $Zip"
Write-Host ""
Write-Host "1) Upload ZIP to Google Drive / Telegram / Dropbox"
Write-Host "2) Turn on 'anyone with the link can download'"
Write-Host "3) Send that link + say: extract then double-click START.bat"
Write-Output $Zip
