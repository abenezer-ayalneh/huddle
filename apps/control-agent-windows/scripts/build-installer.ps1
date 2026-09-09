[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Flutter = 'flutter',
  [string]$Iscc = 'iscc.exe',
  [string]$ReleaseChannel = $env:WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL,
  [string]$UpdatePublicKey = $env:WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$releaseDirectory = Join-Path $projectRoot 'build\windows\x64\runner\Release'
$installer = Join-Path $projectRoot 'installer\HuddleControlAgent.iss'
$dist = Join-Path $projectRoot 'dist'

$buildArguments = @('build', 'windows', '--release')
if (($ReleaseChannel.Length -gt 0) -xor ($UpdatePublicKey.Length -gt 0)) { throw 'WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL and WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY must be configured together.' }
if ($ReleaseChannel.Length -gt 0) {
  $buildArguments += "--dart-define=WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL=$ReleaseChannel"
  $buildArguments += "--dart-define=WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY=$UpdatePublicKey"
}
& $Flutter @buildArguments
if ($LASTEXITCODE -ne 0) { throw 'Flutter Windows build failed.' }
if (!(Test-Path (Join-Path $releaseDirectory 'HuddleControlAgent.exe'))) { throw 'Flutter did not produce HuddleControlAgent.exe.' }

New-Item -ItemType Directory -Force -Path $dist | Out-Null
& $Iscc "/DAppVersion=$Version" "/DSourceDir=$releaseDirectory" $installer
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup packaging failed.' }

$artifact = Join-Path $dist 'Huddle-Control-Agent-windows-x64.exe'
if (!(Test-Path $artifact)) { throw 'Inno Setup did not produce the Windows installer.' }
$hash = (Get-FileHash -Algorithm SHA256 $artifact).Hash.ToLowerInvariant()
Set-Content -NoNewline -Encoding ascii -Path "$artifact.sha256" -Value "$hash  Huddle-Control-Agent-windows-x64.exe"
Write-Output "Built $artifact"
