param(
  [string]$ExtensionId = '',
  [string]$NodeDistRelative = 'dist\\apps\\native-host\\src\\main.js',
  [string]$HostName = 'com.signalforge.host',
  [string]$ManifestTemplateFile = 'com.signalforge.host.json'
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$manifestTemplate = Join-Path $scriptDir $ManifestTemplateFile

if (!(Test-Path $manifestTemplate)) {
  Write-Error "Manifest template not found at $manifestTemplate"
  exit 1
}

$manifest = Get-Content $manifestTemplate -Raw | ConvertFrom-Json

$batchPath = Join-Path $scriptDir 'native_host.bat'

if (!(Test-Path $batchPath)) {
  # create a simple batch that will run the built native host
  $batContent = "@echo off`nnode %~dp0$NodeDistRelative %*"
  Set-Content -Path $batchPath -Value $batContent -Encoding ASCII
  Write-Output "Created batch wrapper at $batchPath"
}

$absBatch = (Get-Item $batchPath).FullName
$manifest.name = $HostName
$manifest.path = $absBatch
if ($ExtensionId -ne '') { $manifest.allowed_origins = @("chrome-extension://$ExtensionId/") }

$manifestOut = Join-Path $scriptDir ("$HostName.register.json")
($manifest | ConvertTo-Json -Depth 5) | Set-Content -Path $manifestOut -Encoding UTF8
Write-Output "Wrote manifest to $manifestOut"

# Write registry key for current user
$regPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\' + $HostName
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name '(default)' -Value $manifestOut

Write-Output "Registered native messaging host at $regPath -> $manifestOut"
Write-Output "NOTE: Ensure you have built the native host (pnpm --filter ./apps/native-host build) so $NodeDistRelative exists."
