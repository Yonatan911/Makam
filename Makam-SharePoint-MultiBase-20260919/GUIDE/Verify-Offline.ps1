param([Parameter(Mandatory=$true)][string]$ApprovedNodePath,[string]$ReleaseRoot=(Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
if (-not (Test-Path -LiteralPath $ApprovedNodePath)) { throw 'Use absolute path to the approved target Node executable' }
$script=Join-Path $PSScriptRoot 'verify-release.mjs'
& $ApprovedNodePath $script $ReleaseRoot
if ($LASTEXITCODE -ne 0) { throw 'Offline release verification failed' }
