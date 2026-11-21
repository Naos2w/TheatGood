<#
One explicitly authorised, read-only Showtime seat-grid sample for STILL-MISSING hall labels.

Usage from clean TheatGood development worktree (original MSI research/downloads stay private):
  pwsh -NoProfile -File scripts/research_trigger_showtime_targeted_once.ps1 -CinemaSlug showtime-yunlin-beigang -StartMovie 0

The helper recomputes a metadata-only source gap audit from original local
downloads and the pre-existing public hall-name census. It never opens
unknown/private APIs, reads credentials, clicks seats, or collects ticket states.
Only installed, reloaded TheatGood extension v0.1.6 performs the actual scan.
One browser tab and one venue per invocation; NO unattended loop.
#>
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^showtime-[a-z0-9-]+$')]
  [string]$CinemaSlug,
  [ValidateRange(0,35)][int]$StartMovie=0,
  [switch]$DryRun
)
$ErrorActionPreference='Stop'
$worktree=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceRoot=$worktree
if(-not(Test-Path (Join-Path $sourceRoot 'docs\research\theatgood-2026-11-18'))){
  $sourceRoot=(Resolve-Path (Join-Path $worktree '..\..')).Path
}
$research=Join-Path $sourceRoot 'docs\research\theatgood-2026-11-18'
$downloads=Join-Path $env:USERPROFILE 'Downloads\TheatGood'
$census=Join-Path $sourceRoot 'scripts\showtime-chrome-extension\operator-public-hall-census.json'
$auditScript=Join-Path $worktree 'scripts\research_showtime_coverage_gaps.mjs'
foreach($file in @($research,$downloads,$census,$auditScript)){
  if(-not(Test-Path -LiteralPath $file)){throw "Missing required local source: $file"}
}
$tempFile=Join-Path $env:TEMP ('theatgood-showtime-targets-'+[guid]::NewGuid().ToString('N')+'.json')
try{
  $outputArg='--output='+$tempFile
  $auditOutput=& node $auditScript $research $downloads $census $outputArg
  if($LASTEXITCODE -ne 0){throw 'Original source audit has conflicts or invalid provenance; no scan'}
  if(-not(Test-Path $tempFile)){throw 'No source-based coverage report'}
  $report=Get-Content -LiteralPath $tempFile -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable
  $venue=@($report.venues|Where-Object {$_.cinemaSlug -eq $CinemaSlug})
  if($venue.Count -ne 1){throw 'Unknown Showtime cinema in verified public source inventory'}
  $missing=@($venue[0].missingHallLabels)
  if($missing.Count -eq 0){
    [pscustomobject]@{invoked=$false;reason='all sampled halls already verified';cinemaSlug=$CinemaSlug}|ConvertTo-Json -Compress
    exit 0
  }
  if($missing.Count -gt 35){throw 'Safety limit: too many source hall targets'}
  $source=Get-Content -LiteralPath $census -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable
  $known=@($source.venues[$CinemaSlug])
  if(@($missing|Where-Object {$_ -notin $known}).Count -ne 0){
    throw 'Target hall is not part of the operator public screening hall sample'
  }
  if($DryRun){
    [pscustomobject]@{
      invoked=$false
      dryRun=$true
      cinemaSlug=$CinemaSlug
      missingHallCount=$missing.Count
      sourceSampleHallCount=$venue[0].sampledHallNames
      movieStartIndex=$StartMovie
      movieCardLimit=8
      missingHallLabels=$missing
      sourceAuditErrors=@($report.errors).Count
    }|ConvertTo-Json -Compress -Depth 6
    exit 0
  }

  $chrome='C:\Program Files\Google\Chrome\Application\chrome.exe'
  $profile=Join-Path $env:LOCALAPPDATA 'OpenChatX\theatgood-showtimes-chrome-profile'
  $extPath=Join-Path $sourceRoot 'scripts\showtime-chrome-extension'
  $manifest=Join-Path $extPath 'manifest.json'
  if(-not(Test-Path $chrome) -or -not(Test-Path $manifest)){
    throw 'Dedicated stock Chrome or installed extension source unavailable'
  }
  $version=Get-Content $manifest -Raw -Encoding UTF8|ConvertFrom-Json
  if($version.version -ne '0.1.6'){
    throw 'Install/reload version 0.1.6 before running targeted research'
  }
  $roots=@(Get-CimInstance Win32_Process -Filter "name='chrome.exe'"|
    Where-Object {$_.CommandLine -like '*theatgood-showtimes-chrome-profile*' -and $_.CommandLine -notmatch ' --type='})
  if($roots.Count -ne 1){throw 'Exactly one existing dedicated Chrome must be running'}
  if($roots[0].CommandLine -match '--no-sandbox'){
    throw 'Refuse unsafe Chrome process'
  }
  $prefs=Join-Path $profile 'Default\Secure Preferences'
  if(-not(Test-Path $prefs)){throw 'Installed extension identity unavailable'}
  $installed=Get-Content $prefs -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable
  $id='pgogmmdmpkfmeefdfkjijmaijjfldeoi'
  if($installed.extensions.settings[$id].path -ne $extPath){
    throw 'The dedicated Chrome extension path does not match the approved project'
  }

  $once=[guid]::NewGuid().ToString('N')
  $encoded=[uri]::EscapeDataString(($missing -join ','))
  $url='chrome-extension://'+$id+'/popup.html?autorun='+$CinemaSlug+
    '&once='+$once+'&ack=read-only&targets='+$encoded+'&start='+$StartMovie
  & $chrome "--user-data-dir=$profile" --new-tab $url | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Chrome did not accept the one-shot request'}
  [pscustomobject]@{
    invoked=$true
    cinemaSlug=$CinemaSlug
    requestId=$once
    missingHallCount=$missing.Count
    startMovie=$StartMovie
    movieCardLimit=8
    mode='read-only-targeted-missing-halls'
    sourceNotYetVerified=$true
    noBooking=$true
    noCredentialAccess=$true
  }|ConvertTo-Json -Compress
} finally{
  if(Test-Path $tempFile){Remove-Item -LiteralPath $tempFile -Force}
}
