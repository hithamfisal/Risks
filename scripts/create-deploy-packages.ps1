param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $projectRoot "dist"
$packageDir = Join-Path $projectRoot "deploy-packages"
$workDir = Join-Path $packageDir "_work"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$frontendZip = Join-Path $packageDir "risks-dashboard-frontend-$timestamp.zip"
$backendZip = Join-Path $packageDir "risks-dashboard-api-$timestamp.zip"

if (-not $SkipBuild) {
  Push-Location $projectRoot
  try {
    yarn build
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $distDir)) {
  throw "Build output folder not found: $distDir"
}

if (Test-Path $workDir) {
  Remove-Item -LiteralPath $workDir -Recurse -Force
}
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

Compress-Archive -Path (Join-Path $distDir "*") -DestinationPath $frontendZip -Force

$backendWork = Join-Path $workDir "api"
New-Item -ItemType Directory -Path (Join-Path $backendWork "server") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "server/index.cjs") -Destination (Join-Path $backendWork "server/index.cjs")
Copy-Item -LiteralPath (Join-Path $projectRoot "server/schema.mysql.sql") -Destination (Join-Path $backendWork "server/schema.mysql.sql")
Copy-Item -LiteralPath (Join-Path $projectRoot "package.json") -Destination (Join-Path $backendWork "package.json")
Copy-Item -LiteralPath (Join-Path $projectRoot "yarn.lock") -Destination (Join-Path $backendWork "yarn.lock")
Copy-Item -LiteralPath (Join-Path $projectRoot ".env.example") -Destination (Join-Path $backendWork ".env.example")
Compress-Archive -Path (Join-Path $backendWork "*") -DestinationPath $backendZip -Force

Remove-Item -LiteralPath $workDir -Recurse -Force

Write-Host "Frontend package: $frontendZip"
Write-Host "Backend package:  $backendZip"
Write-Host "Upload frontend ZIP contents to public_html."
Write-Host "Upload backend ZIP contents to the Node.js app root. Do not upload real .env to GitHub."
