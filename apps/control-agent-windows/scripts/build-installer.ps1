[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][ValidateSet('x64', 'arm64')][string]$Architecture,
  [string]$Flutter = 'flutter',
  [string]$Iscc = 'iscc.exe',
  [string]$ReleaseChannel = $env:WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL,
  [string]$UpdatePublicKey = $env:WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$releaseDirectory = Join-Path $projectRoot "build\windows\$Architecture\runner\Release"
$installer = Join-Path $projectRoot 'installer\HuddleControlAgent.iss'
$dist = Join-Path $projectRoot 'dist'

$buildArguments = @('build', 'windows', '--release', "--dart-define=WINDOWS_CONTROL_AGENT_VERSION=$Version")
if (($ReleaseChannel.Length -gt 0) -xor ($UpdatePublicKey.Length -gt 0)) { throw 'WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL and WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY must be configured together.' }
if ($ReleaseChannel.Length -gt 0) {
  $buildArguments += "--dart-define=WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL=$ReleaseChannel"
  $buildArguments += "--dart-define=WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY=$UpdatePublicKey"
}
& $Flutter @buildArguments
if ($LASTEXITCODE -ne 0) { throw 'Flutter Windows build failed.' }
if (!(Test-Path (Join-Path $releaseDirectory 'HuddleControlAgent.exe'))) { throw 'Flutter did not produce HuddleControlAgent.exe.' }

$executable = Join-Path $releaseDirectory 'HuddleControlAgent.exe'
$bytes = [System.IO.File]::ReadAllBytes($executable)
$peOffset = [System.BitConverter]::ToInt32($bytes, 0x3c)
$machine = [System.BitConverter]::ToUInt16($bytes, $peOffset + 4)
$expectedMachine = if ($Architecture -eq 'x64') { 0x8664 } else { 0xaa64 }
if ($machine -ne $expectedMachine) {
  throw ("Flutter produced PE machine 0x{0:X4}; expected {1}. Build on a native {1} Windows host with Flutter 3.44 or later." -f $machine, $Architecture)
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
& $Iscc "/DAppVersion=$Version" "/DArchitecture=$Architecture" "/DSourceDir=$releaseDirectory" $installer
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup packaging failed.' }

$artifact = Join-Path $dist "Huddle-Control-Agent-windows-$Architecture.exe"
if (!(Test-Path $artifact)) { throw 'Inno Setup did not produce the Windows installer.' }
$hash = (Get-FileHash -Algorithm SHA256 $artifact).Hash.ToLowerInvariant()
Set-Content -NoNewline -Encoding ascii -Path "$artifact.sha256" -Value "$hash  $([System.IO.Path]::GetFileName($artifact))"
Write-Output "Built $artifact"
