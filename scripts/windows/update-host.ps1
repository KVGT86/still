param(
    [string]$Repository = 'KVGT86/still',
    [string]$Root = 'E:\Still'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($Root -ne 'E:\Still') { throw 'This updater is scoped to E:\Still.' }

$volume = Join-Path $Root 'Volume'
$data = Join-Path $volume 'Data'
$temp = Join-Path $volume 'Temp\HostUpdate'
$app = Join-Path $volume 'App'
$next = Join-Path $volume 'App.next'
$previous = Join-Path $volume 'App.previous'
$log = Join-Path $data 'update.log'
$status = Join-Path $data 'update-status.json'
$swapped = $false
$healthy = $false

function Write-UpdateLog([string]$Message) {
    New-Item -ItemType Directory -Force $data | Out-Null
    Add-Content -Encoding UTF8 $log "$(Get-Date -Format o) $Message"
}
function Save-Status([string]$State, [string]$Version, [string]$Message) {
    [ordered]@{CheckedAt=(Get-Date).ToUniversalTime().ToString('o');State=$State;Version=$Version;Message=$Message} |
        ConvertTo-Json | Set-Content -Encoding UTF8 $status
}
function Download-Asset($Asset, [string]$Destination) {
    if ($Asset.digest -notmatch '^sha256:([a-f0-9]{64})$') { throw "GitHub did not provide a SHA-256 digest for $($Asset.name)." }
    Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $Asset.browser_download_url -OutFile $Destination
    $actual = (Get-FileHash $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Matches[1]) { throw "GitHub digest check failed for $($Asset.name)." }
}

try {
    $headers = @{Accept='application/vnd.github+json'; 'User-Agent'='StillHost'}
    $release = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$Repository/releases/latest"
    if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') { throw 'The latest GitHub release is not a stable semantic version.' }
    $version = $Matches[1]
    $current = (Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json).version
    if ([version]$version -le [version]$current) {
        Save-Status 'current' $current 'Still is up to date.'
        exit 0
    }

    $names = @(
        "Still-$version-host.tar.gz",
        "Still-$version-linux-x64.tar.gz",
        "Still-$version-android.apk",
        "io.still.client_${version}_all.ipk",
        'manifest.json'
    )
    New-Item -ItemType Directory -Force $temp | Out-Null
    foreach ($name in $names) {
        $asset = @($release.assets | Where-Object name -eq $name)
        if ($asset.Count -ne 1) { throw "Release $version must contain exactly one $name asset." }
        Download-Asset $asset[0] (Join-Path $temp $name)
    }

    Remove-Item $next -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $next | Out-Null
    & tar.exe -xzf (Join-Path $temp "Still-$version-host.tar.gz") -C $next
    if ($LASTEXITCODE -ne 0) { throw 'The host package could not be extracted.' }
    $staged = Get-Content (Join-Path $next 'package.json') -Raw | ConvertFrom-Json
    if ($staged.version -ne $version -or -not (Test-Path (Join-Path $next 'server\windows-host.mjs'))) { throw 'The host package does not match the release.' }

    Stop-ScheduledTask -TaskName 'StillHost'
    for ($attempt=0; $attempt -lt 20 -and (Get-ScheduledTask -TaskName 'StillHost').State -eq 'Running'; $attempt++) { Start-Sleep -Milliseconds 500 }
    if ((Get-ScheduledTask -TaskName 'StillHost').State -eq 'Running') { throw 'StillHost did not stop for the update.' }
    Remove-Item $previous -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item $app $previous
    Move-Item $next $app
    $swapped = $true
    Start-ScheduledTask -TaskName 'StillHost'
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $health = Invoke-RestMethod -TimeoutSec 2 -Uri 'http://127.0.0.1:8787/api/health'
            if ($health.ok -and $health.version -eq $version) { $healthy = $true; break }
        } catch {}
    }
    if (-not $healthy) { throw "Still $version did not become healthy." }

    & (Join-Path $Root 'deploy-update.ps1') -Source $temp | Out-Null
    Remove-Item $previous -Recurse -Force
    Write-UpdateLog "Updated Still from $current to $version."
    Save-Status 'updated' $version "Updated from $current."
} catch {
    if ($swapped -and -not $healthy) {
        Stop-ScheduledTask -TaskName 'StillHost' -ErrorAction SilentlyContinue
        Remove-Item $app -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $previous) { Move-Item $previous $app; Start-ScheduledTask -TaskName 'StillHost' }
    }
    Write-UpdateLog "Update failed: $($_.Exception.Message)"
    Save-Status 'error' '' $_.Exception.Message
    throw
} finally {
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $next -Recurse -Force -ErrorAction SilentlyContinue
}
