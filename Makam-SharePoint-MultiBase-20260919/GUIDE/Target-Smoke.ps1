param([Parameter(Mandatory=$true)][string]$ApiBaseUrl,[Parameter(Mandatory=$true)][string]$SharePointOrigin,[string]$BaseId)
$ErrorActionPreference='Stop'
if (-not $ApiBaseUrl.StartsWith('https://') -or -not $ApiBaseUrl.EndsWith('/api')) { throw 'Use exact HTTPS API URL ending in /api' }
$applicationUrl=$ApiBaseUrl.Substring(0,$ApiBaseUrl.Length-4)
function Request-Result([string]$Uri,[string]$Method='GET',[hashtable]$Headers=@{},[switch]$WindowsIdentity) {
  $arguments=@{Uri=$Uri;Method=$Method;Headers=$Headers;UseBasicParsing=$true}
  if ($WindowsIdentity) { $arguments.UseDefaultCredentials=$true }
  if ($Method -eq 'POST') { $arguments.Body='';$arguments.ContentType='text/plain' }
  try { $response=Invoke-WebRequest @arguments;return @{Status=[int]$response.StatusCode;Response=$response} }
  catch { if ($_.Exception.Response) { return @{Status=[int]$_.Exception.Response.StatusCode;Response=$_.Exception.Response} };throw }
}
$health=Request-Result "$ApiBaseUrl/health"
if ($health.Status -ne 200 -or -not ($health.Response.Content | ConvertFrom-Json).ok) { throw 'Health/cold-start failed' }
foreach ($file in @('.env','.env.production','src/server.js','src/app.js','package.json','package-lock.json','node_modules/express/package.json','iisnode/index.html','logs/log.txt','backups/backup.zip','.git/config','web.config')) {
  $result=Request-Result "$applicationUrl/$file"
  if ($result.Status -ne 404 -and $result.Status -ne 403) { throw "File exposure gate failed: $file ($($result.Status))" }
}
$preflight=Request-Result "$ApiBaseUrl/state" 'OPTIONS' @{Origin=$SharePointOrigin;'Access-Control-Request-Method'='PATCH';'Access-Control-Request-Headers'='authorization,content-type,x-readiness-client'}
if ($preflight.Status -ne 204) { throw 'Anonymous CORS preflight must return 204 without Windows challenge' }
$forged=Request-Result "$ApiBaseUrl/auth/session" 'POST' @{Origin=$SharePointOrigin;'X-IISNode-Auth_User'='ARMY\m9267680';'X-IISNode-Auth_Type'='Negotiate'}
if ($forged.Status -ne 403) { throw 'Forged transport identity must be rejected by IIS' }
$valid=Request-Result "$ApiBaseUrl/auth/session" 'POST' @{Origin=$SharePointOrigin} -WindowsIdentity
if ($valid.Status -ne 201) { throw "Windows session failed ($($valid.Status)); account must be explicitly provisioned" }
$session=$valid.Response.Content | ConvertFrom-Json
if (-not $session.token -or -not $session.user.username) { throw 'Invalid session JSON' }
$catalog=Request-Result "$ApiBaseUrl/bases" 'GET' @{Origin=$SharePointOrigin;Authorization="Bearer $($session.token)"}
if ($catalog.Status -ne 200) { throw 'Permitted base catalog failed' }
$bases=@($catalog.Response.Content | ConvertFrom-Json)
if (-not $BaseId) {
  if ($bases.Count -ne 1) { throw 'Use -BaseId with one of the permitted bases for multi-base smoke' }
  $BaseId=$bases[0].id
}
if (-not ($bases | Where-Object { $_.id -eq $BaseId })) { throw 'Requested base is not in permitted catalog' }
$state=Request-Result "$ApiBaseUrl/state" 'GET' @{Origin=$SharePointOrigin;Authorization="Bearer $($session.token)";'X-Base-Id'=$BaseId}
if ($state.Status -ne 200) { throw 'Bearer state access failed' }
$observed=$state.Response.Content | ConvertFrom-Json
if ($observed.user.username -ne $session.user.username) { throw 'Identity consistency failed' }
if ($observed.base.id -ne $BaseId) { throw 'Base identity consistency failed' }
Write-Output "PASS: health, file denials, CORS, forged identity and actual Windows session for $($observed.user.username)."
Write-Output 'Still required: browser SharePoint load, isolated test writes (PUT/PATCH/DELETE), binary upload/Excel/PNG, recycle and SMTP review. Do not mark target ready from this script alone.'
