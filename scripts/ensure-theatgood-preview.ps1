# TheatGood Beta — private Windows logon preview
# Runs only the existing Vite production preview (127.0.0.1:4184).
# Does not build, install packages, push, deploy, or change Tailscale configuration.
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$port = 4184
$logDir = Join-Path $repo '.tmp\preview-startup'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir 'startup.log'

function Write-Status([string]$message) {
  Add-Content -LiteralPath $logPath -Value ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message)
}

try {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($null -ne $listener) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $command = [string]$owner.CommandLine
    if ($command -match 'TheatGood' -and $command -match 'vite' -and $command -match 'preview' -and $command -match '4184') {
      Write-Status "Already running as PID $($listener.OwningProcess); no duplicate started."
      exit 0
    }
    throw "TCP $port belongs to an unexpected process. No takeover attempted."
  }

  $index = Join-Path $repo 'dist\index.html'
  $vite = Join-Path $repo 'node_modules\vite\bin\vite.js'
  if (!(Test-Path -LiteralPath $index)) {
    throw 'Build missing. Run npm run build in TheatGood before starting the preview.'
  }
  if (!(Test-Path -LiteralPath $vite)) {
    throw 'Vite missing. Existing dependencies must be restored manually.'
  }

  $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
  $node = if ($nodeCmd) { $nodeCmd.Source } else {
    Join-Path $env:LOCALAPPDATA 'Author Software\nvm\installs\v24.21.0\node.exe'
  }
  if (!(Test-Path -LiteralPath $node)) {
    throw 'node.exe unavailable. Check Node.js PATH or the existing NVM installation.'
  }

  Write-Status "Starting private preview via $node; PID=$PID"
  Set-Location -LiteralPath $repo
  & $node $vite preview --host 127.0.0.1 --port $port --strictPort *>> $logPath
  if ($LASTEXITCODE -ne 0) { throw "Preview exited with code $LASTEXITCODE" }
} catch {
  Write-Status ("ERROR: " + $_.Exception.Message)
  exit 1
}
