param(
  [int]$DelaySeconds = 10,
  [string]$Remote = "origin"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path
$syncScript = Join-Path $PSScriptRoot "sync-to-github.ps1"
$ignoredDirectories = @(".git", "node_modules", "dist")
$pendingChanges = @{}
$syncRunning = $false

function Start-Sync {
  if ($script:syncRunning) {
    return
  }

  $script:syncRunning = $true
  try {
    & $syncScript -Remote $Remote
  } catch {
    Write-Host "[watch] Sync failed: $($_.Exception.Message)" -ForegroundColor Red
  } finally {
    $script:syncRunning = $false
  }
}

function Test-IsIgnored([string]$Path) {
  $relativePath = $Path.Substring($repositoryRoot.Length).TrimStart("\\", "/")
  return $ignoredDirectories | Where-Object {
    $relativePath -eq $_ -or $relativePath.StartsWith("$_\")
  }
}

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $repositoryRoot
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::DirectoryName
$watcher.EnableRaisingEvents = $true

$action = {
  $path = $Event.SourceEventArgs.FullPath
  if (-not (Test-IsIgnored $path)) {
    $script:pendingChanges[$path] = Get-Date
    Write-Host "[watch] Change detected: $($Event.SourceEventArgs.Name)"
  }
}

$subscriptions = @(
  Register-ObjectEvent $watcher Created -Action $action
  Register-ObjectEvent $watcher Changed -Action $action
  Register-ObjectEvent $watcher Deleted -Action $action
  Register-ObjectEvent $watcher Renamed -Action $action
)

Write-Host "[watch] Monitoring $repositoryRoot"
Write-Host "[watch] Changes will sync after $DelaySeconds seconds of inactivity. Press Ctrl+C to stop."

try {
  while ($true) {
    Wait-Event -Timeout 1 | Out-Null
    $now = Get-Date
    $readyChanges = @($pendingChanges.GetEnumerator() | Where-Object { ($now - $_.Value).TotalSeconds -ge $DelaySeconds })
    if ($readyChanges.Count -gt 0) {
      $pendingChanges.Clear()
      Start-Sync
    }
  }
} finally {
  $subscriptions | Unregister-Event -Force
  $subscriptions | Remove-Job -Force
  $watcher.Dispose()
}