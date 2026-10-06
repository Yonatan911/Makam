param([Parameter(Mandatory=$true)][string]$IisApplication,[Parameter(Mandatory=$true)][string]$ApprovedNodePath)
$ErrorActionPreference='Stop'
if (-not (Test-Path -LiteralPath $ApprovedNodePath)) { throw 'Approved Node executable not found' }
$appcmd=Join-Path $env:SystemRoot 'System32/inetsrv/appcmd.exe'
Write-Output 'Read-only IIS/Node evidence. Review locally; do not export database credentials.'
& $ApprovedNodePath --version
& $ApprovedNodePath -p 'JSON.stringify({platform:process.platform,arch:process.arch,napi:process.versions.napi})'
& $appcmd list config $IisApplication /section:system.webServer/handlers
& $appcmd list config $IisApplication /section:system.webServer/iisnode
& $appcmd list config $IisApplication /section:system.webServer/security/authentication/anonymousAuthentication
& $appcmd list config "$IisApplication/api/auth/session.js" /section:system.webServer/security/authentication/windowsAuthentication
& $appcmd list config "$IisApplication/api/auth/session.js" /section:system.webServer/security/authentication/anonymousAuthentication
& $appcmd list config $IisApplication /section:system.webServer/rewrite/rules
