<#
Single-tab, user-authorised, bounded Showtime missing-hall scan.
Uses ONLY the EXISTING toolbar popup in the current signed-in Chrome, without opening
or closing tabs or windows. The user must not be interacting with this popup during a run.

Example:
  pwsh -NoProfile -File scripts/research_trigger_showtime_existing_popup_once.ps1 -CinemaSlug showtime-taitung -Halls '3廳,7廳,8廳' -StartMovie 0
This checks the official sampled hall allowlist AND the current private missing-hall source audit;
same-hall conflicts are excluded pending independent manual review.
#>
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^showtime-[a-z0-9-]+$')][string]$CinemaSlug,
  [Parameter(Mandatory=$true)][string]$Halls,
  [ValidateSet(0,8,16,24,32)][int]$StartMovie=0,
  [switch]$DryRun,
  [switch]$ReviewConflict
)
$ErrorActionPreference='Stop'
$cinemas=@{
  'showtime-taipei-dome'='大巨蛋秀泰影城'
  'showtime-taipei-xinxin'='台北欣欣秀泰影城'
  'showtime-tucheng'='土城秀泰影城'
  'showtime-shulin'='樹林秀泰影城'
  'showtime-taichung-station'='台中站前秀泰影城'
  'showtime-taichung-wenxin'='台中文心秀泰影城'
  'showtime-taichung-lipao'='台中麗寶秀泰影城'
  'showtime-chiayi'='嘉義秀泰影城'
  'showtime-keelung'='基隆秀泰影城'
  'showtime-hualien'='花蓮秀泰影城'
  'showtime-taitung'='台東秀泰影城'
  'showtime-yunlin-beigang'='北港秀泰影城'
  'showtime-tainan-rende'='台南仁德秀泰影城'
  'showtime-kaohsiung-gangshan'='高雄岡山秀泰影城'
  'showtime-kaohsiung-dreammall'='高雄夢時代秀泰影城'
}
if(-not $cinemas.ContainsKey($CinemaSlug)){throw 'Unknown Showtime venue'}
$targets=@($Halls -split '[,，]'|ForEach-Object{$_.Trim()})
if($targets.Count -lt 1 -or $targets.Count -gt 35 -or @($targets|Where-Object{$_ -notmatch '^(?:[一二三四五六七八九十\d]+館)?(?:巨幕\d+|丹普|\d+)廳$'}).Count -ne 0 -or (@($targets|Select-Object -Unique).Count -ne $targets.Count)){
  throw 'Invalid or duplicated target hall labels'
}
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$research=Join-Path $root 'docs\research\theatgood-2026-11-18'
$downloads=Join-Path $env:USERPROFILE 'Downloads\TheatGood'
$censusFile=Join-Path $root 'scripts\showtime-chrome-extension\operator-public-hall-census.json'
$census=Get-Content $censusFile -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
$approved=@($census.venues[$CinemaSlug])
if(@($targets|Where-Object{$_ -notin $approved}).Count -gt 0){throw 'Target hall is not in sampled official source allowlist'}
$tmp=Join-Path $env:TEMP ('showtime-toolbar-audit-'+[guid]::NewGuid().ToString('N')+'.json')
try{
  & node (Join-Path $root 'scripts\research_showtime_coverage_gaps.mjs') $research $downloads $censusFile ('--output='+$tmp) | Out-Null
  if(-not(Test-Path $tmp)){throw 'Source audit report was not generated'}
  $audit=Get-Content $tmp -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
  if(@($audit.errors).Count -gt 0){throw 'Source audit has malformed or unsafe downloads'}
  $venue=@($audit.venues|Where-Object{$_.cinemaSlug -eq $CinemaSlug})
  if($venue.Count -ne 1){throw 'Venue is not uniquely represented in source audit'}
  $missing=@($venue[0].missingHallLabels)
  if(@($targets|Where-Object{$_ -notin $missing}).Count -gt 0){throw 'One or more halls already have confirmed sources'}
  $conflicts=@($audit.sourceDiscrepancies|Where-Object{$_.cinemaSlug -eq $CinemaSlug -and $_.hallLabel -in $targets})
  if($ReviewConflict){
    if($conflicts.Count -ne 1 -or $targets.Count -ne 1){
      throw 'Conflict review requires exactly one documented and unresolved same-hall conflict'
    }
  }elseif($conflicts.Count){
    throw 'Conflicted hall requires independent review; pass -ReviewConflict only to gather NEW read-only evidence, never to auto-import or clear the conflict'
  }
}finally{Remove-Item $tmp -Force -ErrorAction SilentlyContinue}
if($DryRun){
  [pscustomobject]@{invoked=$false;cinemaSlug=$CinemaSlug;targetHalls=$targets;startMovie=$StartMovie;newChromeTabs=0;scanLimitMovies=8;existingChromePopupRequired=$true;reviewOnly=[bool]$ReviewConflict}|ConvertTo-Json -Compress -Depth 3
  exit 0
}
$roots=@(Get-CimInstance Win32_Process -Filter "name='chrome.exe'"|Where-Object{$_.CommandLine -like '*theatgood-showtimes-chrome-profile*' -and $_.CommandLine -notmatch ' --type='})
if($roots.Count -ne 1 -or $roots[0].CommandLine -match '--no-sandbox'){throw 'Ambiguous or unsafe dedicated Chrome'}
Add-Type -AssemblyName UIAutomationClient
$proc=Get-Process -Id $roots[0].ProcessId
$window=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$proc.MainWindowHandle)
$scope=[System.Windows.Automation.TreeScope]::Descendants
$condition=[System.Windows.Automation.Condition]::TrueCondition
function FindExactlyOne($nodes,$control,$pattern){
  $found=@($nodes|Where-Object{$_.Current.ControlType.ProgrammaticName -eq $control -and $_.Current.Name -match $pattern})
  if($found.Count -ne 1){throw ('Expected one '+$control+' '+$pattern+', found '+$found.Count)}
  return $found[0]
}
$nodes=$window.FindAll($scope,$condition)
$popup=@($nodes|Where-Object{$_.Current.ControlType.ProgrammaticName -eq 'ControlType.ComboBox' -and $_.Current.Name -eq '分館'})
if($popup.Count -eq 0){
  # The extension popup disappears when Windows focus leaves Chrome. Re-open it
  # in THIS existing Chrome window, never create a browser tab or second window.
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class ToolbarMouse { [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x; public int y; } [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p); [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId(); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint first,uint second,bool attach); [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint data,UIntPtr extra); }'
  $toolbar=FindExactlyOne $nodes 'ControlType.Button' '^TheatGood 秀泰座位蒐集'
  $r=$toolbar.Current.BoundingRectangle
  $x=[int]($r.Left+$r.Width/2)
  $y=[int]($r.Top+$r.Height/2)
  if($x -lt 30 -or $x -gt 1840 -or $y -lt 30 -or $y -gt 1000){throw 'Chrome toolbar is not on the visible desktop; refuse to move or open windows'}
  $front=[ToolbarMouse]::GetForegroundWindow()
  $frontPid=[uint32]0
  $frontThread=[ToolbarMouse]::GetWindowThreadProcessId($front,[ref]$frontPid)
  $frontProcess=Get-Process -Id $frontPid -ErrorAction SilentlyContinue
  if($frontProcess.ProcessName -eq 'LockApp'){
    throw 'Windows is locked. Unlock MSI normally before operating the existing Showtime popup; never bypass LockApp.'
  }
  $targetPid=[uint32]0
  $targetThread=[ToolbarMouse]::GetWindowThreadProcessId([IntPtr]$proc.MainWindowHandle,[ref]$targetPid)
  $currentThread=[ToolbarMouse]::GetCurrentThreadId()
  $frontAttached=$false
  $chromeAttached=$false
  try{
    if($currentThread -ne $frontThread){$frontAttached=[ToolbarMouse]::AttachThreadInput($currentThread,$frontThread,$true)}
    if($currentThread -ne $targetThread){$chromeAttached=[ToolbarMouse]::AttachThreadInput($currentThread,$targetThread,$true)}
    [ToolbarMouse]::SetForegroundWindow([IntPtr]$proc.MainWindowHandle)|Out-Null
    Start-Sleep -Milliseconds 180
    if([ToolbarMouse]::GetForegroundWindow() -ne [IntPtr]$proc.MainWindowHandle){throw 'Chrome could not safely gain focus; refuse to click other software'}
  }finally{
    if($chromeAttached){[ToolbarMouse]::AttachThreadInput($currentThread,$targetThread,$false)|Out-Null}
    if($frontAttached){[ToolbarMouse]::AttachThreadInput($currentThread,$frontThread,$false)|Out-Null}
  }
  $old=New-Object ToolbarMouse+POINT
  [ToolbarMouse]::GetCursorPos([ref]$old)|Out-Null
  try{
    [ToolbarMouse]::SetCursorPos($x,$y)|Out-Null
    Start-Sleep -Milliseconds 90
    [ToolbarMouse]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 55
    [ToolbarMouse]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  }finally{
    [ToolbarMouse]::SetCursorPos($old.x,$old.y)|Out-Null
  }
  Start-Sleep -Milliseconds 480
  $nodes=$window.FindAll($scope,$condition)
}
$site=@($nodes|Where-Object{$_.Current.ControlType.ProgrammaticName -eq 'ControlType.TabItem' -and $_.Current.Name -match '^秀泰影城 ShowTimes'})
if($site.Count -ne 1){throw 'Expected exactly one existing official Showtime Chrome tab'}
$venue=FindExactlyOne $nodes 'ControlType.ComboBox' '^分館$'
$hallInput=FindExactlyOne $nodes 'ControlType.Edit' '^指定缺廳'
$offset=FindExactlyOne $nodes 'ControlType.ComboBox' '^從哪張電影卡'
$button=FindExactlyOne $nodes 'ControlType.Button' '^讀取這間影城的座位預覽$'
if(-not $button.Current.IsEnabled){throw 'Scanner is busy or disabled'}
$running=@($nodes|Where-Object{$_.Current.ControlType.ProgrammaticName -eq 'ControlType.Text' -and $_.Current.Name -match '^正在背景檢查'})
if($running.Count){throw 'Existing scan is still running'}
$offsetLabel=@{
  0='第 1–8 張'
  8='第 9–16 張'
  16='第 17–24 張'
  24='第 25–32 張'
  32='第 33–40 張'
}[$StartMovie]
function SelectCombo($combo,$value){
  $selected=$combo.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
  if($selected -eq $value){return}
  $expand=$combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
  if($expand.Current.ExpandCollapseState -ne [System.Windows.Automation.ExpandCollapseState]::Expanded){$expand.Expand()}
  $item=$null
  for($attempt=0;$attempt -lt 4;$attempt++){
    Start-Sleep -Milliseconds 260
    $options=$window.FindAll($scope,$condition)
    $candidates=@($options|Where-Object{$_.Current.ControlType.ProgrammaticName -eq 'ControlType.ListItem' -and $_.Current.Name -eq $value})
    if($candidates.Count -eq 1){$item=$candidates[0];break}
  }
  if($null -eq $item){throw ('Choice not visible in existing popup: '+$value)}
  $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select()
  Start-Sleep -Milliseconds 350
  if($combo.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value -ne $value){throw 'Failed to select '+$value}
  if($expand.Current.ExpandCollapseState -eq [System.Windows.Automation.ExpandCollapseState]::Expanded){$expand.Collapse()}
}
SelectCombo $venue $cinemas[$CinemaSlug]
SelectCombo $offset $offsetLabel
$typed=($targets -join ',')
$hallInput.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($typed)
Start-Sleep -Milliseconds 400
if($hallInput.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value -ne $typed){throw 'Target hall edit did not apply'}
$button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
Start-Sleep -Milliseconds 950
$after=$window.FindAll($scope,$condition)
$siteAfter=@($after|Where-Object{$_.Current.ControlType.ProgrammaticName -eq 'ControlType.TabItem' -and $_.Current.Name -match '^秀泰影城 ShowTimes'})
if($siteAfter.Count -ne 1){throw 'Tab count changed unexpectedly; stop'}
$messages=@($after|Where-Object{$_.Current.ControlType.ProgrammaticName -eq 'ControlType.Text' -and $_.Current.Name -match '^正在背景檢查|^已完成：|^未完成：|^不能啟動：|^指定廳號不在'}|ForEach-Object{$_.Current.Name})
[pscustomobject]@{invoked=$true;cinemaSlug=$CinemaSlug;targetHalls=$targets;startMovie=$StartMovie;newChromeTabs=0;status=($messages|Select-Object -Last 1)}|ConvertTo-Json -Compress -Depth 4
