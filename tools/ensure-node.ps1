# Ensures Node.js 22.5+. Prefers PATH, else portable under .runtime\node
# Writes absolute path to .runtime\node-exe.txt (for START.bat). Progress goes to stderr.
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Runtime = Join-Path $Root ".runtime"
$PortableDir = Join-Path $Runtime "node"
$PortableExe = Join-Path $PortableDir "node.exe"
$PathFile = Join-Path $Runtime "node-exe.txt"
$NodeVer = "v22.15.0"
$ZipName = "node-$NodeVer-win-x64.zip"
$Url = "https://nodejs.org/dist/$NodeVer/$ZipName"

function Write-Info([string]$Msg) {
  [Console]::Error.WriteLine($Msg)
}

function Save-Path([string]$Exe) {
  New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
  Set-Content -LiteralPath $PathFile -Value $Exe.Trim() -Encoding ASCII
  Write-Output $Exe.Trim()
}

function Test-NodeOk([string]$Exe) {
  if (-not $Exe -or -not (Test-Path -LiteralPath $Exe)) { return $false }
  try {
    $v = & $Exe -p "process.versions.node" 2>$null
    if (-not $v) { return $false }
    $parts = ($v.Trim() -split "\.")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    return ($major -gt 22) -or ($major -eq 22 -and $minor -ge 5)
  } catch {
    return $false
  }
}

$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd -and (Test-NodeOk $cmd.Source)) {
  Save-Path $cmd.Source
  exit 0
}

if (Test-NodeOk $PortableExe) {
  Save-Path $PortableExe
  exit 0
}

Write-Info ""
Write-Info "Node.js not found. Downloading portable Node $NodeVer (one-time)..."
Write-Info "Needs internet. Please wait..."
Write-Info ""

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
$zipPath = Join-Path $Runtime $ZipName
$extractTo = Join-Path $Runtime "extract"

try {
  Invoke-WebRequest -Uri $Url -OutFile $zipPath -UseBasicParsing
} catch {
  Write-Info "Download failed: $($_.Exception.Message)"
  Write-Info "Install Node 22 LTS from https://nodejs.org then run START.bat again."
  exit 1
}

if (Test-Path $extractTo) { Remove-Item -Recurse -Force $extractTo }
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractTo -Force

$inner = Get-ChildItem -Path $extractTo -Directory | Select-Object -First 1
if (-not $inner) {
  Write-Info "Zip extract failed."
  exit 1
}

if (Test-Path $PortableDir) { Remove-Item -Recurse -Force $PortableDir }
Move-Item -LiteralPath $inner.FullName -Destination $PortableDir
Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $extractTo -ErrorAction SilentlyContinue

if (-not (Test-NodeOk $PortableExe)) {
  Write-Info "Portable Node installed but version check failed."
  exit 1
}

Write-Info "Node ready."
Save-Path $PortableExe
exit 0
