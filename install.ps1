<#
.SYNOPSIS
  JANUS installer for Windows PowerShell.

.DESCRIPTION
  irm https://raw.githubusercontent.com/TarzEH/janus/main/install.ps1 | iex

  Installs a standalone binary. No Node, no npm, no dependencies on the target.

  Piping a script from the internet into your shell is exactly the supply-chain
  problem this project exists to talk about. Read it first. The binary it
  fetches is checksum-verified against SHA256SUMS from the same release before
  anything lands in your PATH.

.PARAMETER Version
  Release tag to install. Defaults to the latest release.

.PARAMETER InstallDir
  Where to put janus.exe. Defaults to %LOCALAPPDATA%\Programs\janus.

.NOTES
  Optional: set $env:GITHUB_TOKEN to raise the GitHub API rate limit. Needs repo
  read access — an anonymous download will 404.
#>
[CmdletBinding()]
param(
  [string]$Version = $env:JANUS_VERSION,
  [string]$InstallDir = $env:JANUS_INSTALL_DIR
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = 'TarzEH/janus'

function Write-Step { param([string]$Message) Write-Host "  $Message" }
function Die { param([string]$Message) Write-Host "janus: $Message" -ForegroundColor Red; exit 1 }

# TLS 1.2 for Windows PowerShell 5.1, which still defaults to something older.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$Headers = @{}
if ($env:GITHUB_TOKEN) { $Headers['Authorization'] = "Bearer $env:GITHUB_TOKEN" }

# ── platform ────────────────────────────────────────────────────────────────
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
if ($arch -eq 'arm64') {
  # No native windows-arm64 build yet; x64 runs fine under emulation on ARM
  # Windows, and saying so is better than shipping a 404.
  Write-Host "janus: no native windows-arm64 build yet — installing the x64 build, which runs under emulation." -ForegroundColor Yellow
  $arch = 'x64'
}
$Asset = "janus-windows-$arch.exe"

# ── release ─────────────────────────────────────────────────────────────────
$releaseUrl = if ($Version) {
  "https://api.github.com/repos/$Repo/releases/tags/$Version"
} else {
  "https://api.github.com/repos/$Repo/releases/latest"
}

try {
  $release = Invoke-RestMethod -Uri $releaseUrl -Headers $Headers
  $Version = $release.tag_name
} catch {
  Die "could not resolve $(if ($Version) { $Version } else { 'the latest release' }).`nIf you are being rate-limited, set `$env:GITHUB_TOKEN.`nAlternative: npm i -g janus-cli"
}

# On a PRIVATE repository the browser path (…/releases/download/tag/asset) 404s
# even with a valid token; only the asset API endpoint with
# `Accept: application/octet-stream` works. That is also the documented path for
# public repos, so this is the one route rather than a special case.
function Get-AssetUrl { param([string]$Name)
  ($release.assets | Where-Object { $_.name -eq $Name } | Select-Object -First 1).url
}

$binUrl  = Get-AssetUrl $Asset
$sumsUrl = Get-AssetUrl 'SHA256SUMS'
if (-not $binUrl) {
  Die "release $Version has no asset named $Asset.`nAvailable builds: https://github.com/$Repo/releases/tag/$Version"
}
if (-not $sumsUrl) { Die "release $Version has no SHA256SUMS asset — refusing to install an unverified binary" }

$octet = $Headers.Clone()
$octet['Accept'] = 'application/octet-stream'

if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\janus' }
$Target = Join-Path $InstallDir 'janus.exe'

Write-Host ""
Write-Host "janus $Version  (windows-$arch)"

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("janus-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

try {
  Write-Step "downloading $Asset"
  $tmpBin = Join-Path $tmp 'janus.exe'
  try {
    Invoke-WebRequest -Uri $binUrl -OutFile $tmpBin -Headers $octet -UseBasicParsing
  } catch {
    Die "download failed: $binUrl`nIf you are being rate-limited, set `$env:GITHUB_TOKEN, or install with: npm i -g janus-cli"
  }

  Write-Step "verifying checksum"
  $sumsPath = Join-Path $tmp 'SHA256SUMS'
  Invoke-WebRequest -Uri $sumsUrl -OutFile $sumsPath -Headers $octet -UseBasicParsing

  $expected = (Get-Content $sumsPath |
    Where-Object { $_ -match "\s$([regex]::Escape($Asset))$" } |
    ForEach-Object { ($_ -split '\s+')[0] } | Select-Object -First 1)
  if (-not $expected) { Die "$Asset is not listed in SHA256SUMS" }

  $actual = (Get-FileHash -Algorithm SHA256 -Path $tmpBin).Hash.ToLower()
  if ($actual -ne $expected.ToLower()) {
    Die "checksum mismatch.`n  expected $expected`n  actual   $actual`nRefusing to install. Report this at https://github.com/$Repo/issues"
  }

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Move-Item -Path $tmpBin -Destination $Target -Force
  Write-Step "installed to $Target"
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

# ── PATH ────────────────────────────────────────────────────────────────────
# User scope only. A one-liner should never quietly edit machine-wide PATH.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $InstallDir) {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
  $env:Path = "$env:Path;$InstallDir"
  Write-Step "added $InstallDir to your user PATH (open a new terminal for it to stick)"
}

Write-Host ""
& $Target --version
Write-Host ""
Write-Host "  janus --help          what it can do"
Write-Host "  janus --list          the techniques and mutators it has"
Write-Host ""
Write-Host "  Only use it against targets you own or are authorized to test."
