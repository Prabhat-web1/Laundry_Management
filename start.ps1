$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 20.9 or newer is required."
}

$nodeVersion = node --version
$versionParts = $nodeVersion.TrimStart('v').Split('.') | ForEach-Object { [int]$_ }
if (($versionParts[0] -lt 20) -or (($versionParts[0] -eq 20) -and ($versionParts[1] -lt 9))) {
  throw "Node.js 20.9 or newer is required. Found $nodeVersion."
}

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "Created .env from .env.example."
}

if (-not (Test-Path node_modules\.bin\next.cmd)) {
  npm.cmd install
}

npm.cmd run db:push
npm.cmd run db:seed
Write-Host "Starting Washday at http://localhost:3000"
npm.cmd run dev
