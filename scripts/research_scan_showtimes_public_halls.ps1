<#
Read-only unauthenticated Showtimes theatre hall-label census.

Invokes only public '快速訂票' cinema selector and public movie information cards.
Never touches '座位', seats, ticket quantity, checkout, payment or account areas.
Does not circumvent login; this is a public hall-label inventory only.
#>
param(
  [Parameter(Mandatory=$true)][string]$CinemaName,
  [Parameter(Mandatory=$true)][string]$CinemaSlug,
  [int]$MaxMovies = 25
)
$ErrorActionPreference='Stop'
if ($CinemaSlug -notmatch '^showtime-[a-z0-9-]+$') {throw 'Unknown brand'}
if ($CinemaName -notmatch '秀泰影城') {throw 'Not a Showtime cinema'}
if ($MaxMovies -lt 1 -or $MaxMovies -gt 35) {throw 'Scan limit outside 1..35'}
Add-Type -AssemblyName UIAutomationClient
$processes=@(Get-Process chrome -ErrorAction SilentlyContinue|Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match '秀泰'})
if ($processes.Count -ne 1) {throw "Expected one normal Showtimes Chrome window, found $($processes.Count)"}
$root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$processes[0].MainWindowHandle)
$scope=[System.Windows.Automation.TreeScope]::Descendants
$condition=[System.Windows.Automation.Condition]::TrueCondition
function Snapshot {return $root.FindAll($scope,$condition)}
function FirstByName($list,[string]$role,[string]$name) {
 return $list|Where-Object {$_.Current.ControlType.ProgrammaticName -eq $role -and $_.Current.Name -eq $name}|Select-Object -First 1
}
function ClickAllowed($element,[string]$label) {
 if(-not $element) {throw "Missing public control: $label"}
 $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
}
function Cards {
 $all=Snapshot
 $found=[System.Collections.Generic.List[object]]::new()
 foreach($el in $all) {
   if($el.Current.ControlType.ProgrammaticName -ne 'ControlType.Group') {continue}
   $r=$el.Current.BoundingRectangle
   if($r.Width -lt 140 -or $r.Width -gt 350 -or $r.Height -lt 250 -or $r.Height -gt 570) {continue}
   if(@($el.GetSupportedPatterns()|ForEach-Object {$_.ProgrammaticName}) -notcontains 'InvokePatternIdentifiers.Pattern'){continue}
   $texts=@($el.FindAll($scope,$condition)|Where-Object {$_.Current.ControlType.ProgrammaticName -eq 'ControlType.Text'}|ForEach-Object {$_.Current.Name})
   if($texts -contains '立即訂票') {$found.Add($el)}
 }
 return ,@($found)
}
function SelectCinema {
 $all=Snapshot
 ClickAllowed (FirstByName $all 'ControlType.Hyperlink' '快速訂票') 'quick-booking public navigation'
 Start-Sleep -Milliseconds 450
 $all=Snapshot
 $modal=FirstByName $all 'ControlType.Window' '選擇影城'
 if(-not $modal){throw 'Cannot find public venue selector'}
 $buttons=$modal.FindAll($scope,$condition)
 ClickAllowed (FirstByName $buttons 'ControlType.Button' $CinemaName) "venue $CinemaName"
 Start-Sleep -Milliseconds 600
}
$report=[ordered]@{
 cinemaSlug=$CinemaSlug
 cinemaName=$CinemaName
 observedAt=[DateTime]::UtcNow.ToString('o')
 sourceUrl='https://www.showtimes.com.tw/ticketing'
 method='Windows_UIAutomation_public_schedule_movie_hall_label_review'
 sourceScope='public_movie_information_only_not_authenticated_seat_grid'
 moviesSeen=0
 moviesWithHallLabels=0
 publicHallLabels=@()
 hallOccurrenceCounts=@{}
 errors=@()
 didNotOpenSeatPreview=$true
 didNotBook=$true
 hasCompleteSeatingGeometry=$false
}
SelectCinema
$list=Cards
$number=[Math]::Min($list.Count,$MaxMovies)
for($i=0;$i -lt $number;$i++) {
 $now=Cards
 if($i -ge $now.Count){break}
 try{
   ClickAllowed $now[$i] 'public movie information card'
   Start-Sleep -Milliseconds 460
   $all=Snapshot
   $labels=@($all|Where-Object {$_.Current.ControlType.ProgrammaticName -eq 'ControlType.Text' -and $_.Current.Name -match '^(?:\d+館)?(?:第?\d+|巨幕\d+|丹普|[A-Za-z0-9 ]+)廳$'}|ForEach-Object {$_.Current.Name})
   $report.moviesSeen++
   if($labels.Count -gt 0) {$report.moviesWithHallLabels++}
   foreach($name in $labels){
     if(-not $report.hallOccurrenceCounts.ContainsKey($name)){$report.hallOccurrenceCounts[$name]=0}
     $report.hallOccurrenceCounts[$name]++
   }
 }catch{
   $report.errors+=@{movieCardIndex=$i;message=$_.Exception.Message.Substring(0,[Math]::Min(130,$_.Exception.Message.Length))}
 }finally{
   $all=Snapshot
   $back=FirstByName $all 'ControlType.Button' '返回'
   if(-not $back){throw 'Missing safe browser back control'}
   ClickAllowed $back 'public movie information back'
   Start-Sleep -Milliseconds 470
 }
}
$report.publicHallLabels=@($report.hallOccurrenceCounts.Keys|Sort-Object)
$report.totalUniquePublicHalls=$report.publicHallLabels.Count
$dir=Join-Path (Get-Location).Path 'docs\research\theatgood-2026-11-18'
if(-not (Test-Path $dir)){throw 'Research output directory missing'}
$dest=Join-Path $dir ('showtime_public_hall_census_'+$CinemaSlug+'_2026-11-18.json')
[System.IO.File]::WriteAllText($dest,(ConvertTo-Json $report -Depth 8)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
[pscustomobject]@{venue=$CinemaSlug;movies=$report.moviesSeen;uniquePublicHalls=$report.totalUniquePublicHalls;hallNames=$report.publicHallLabels;errors=@($report.errors);output=$dest;noSeatOrBookingClick=$true}|ConvertTo-Json -Depth 6 -Compress -EscapeHandling EscapeNonAscii
