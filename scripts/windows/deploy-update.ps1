param(
    [Parameter(Mandatory=$true)][string]$Source,
    [string]$Destination = 'E:\Still\Volume\Packages'
)
$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $Source 'manifest.json'
if (-not (Test-Path $manifestPath)) { throw 'The update bundle has no manifest.json.' }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.payload.schema -ne 1 -or $manifest.payload.version -notmatch '^\d+\.\d+\.\d+$') {
    throw 'The update manifest is invalid.'
}
New-Item -ItemType Directory -Force $Destination | Out-Null
foreach ($entry in $manifest.payload.packages.PSObject.Properties.Value) {
    $name = [IO.Path]::GetFileName($entry.url)
    if ($name -ne $entry.url) { throw 'Package names must not contain a path.' }
    $sourceFile = Join-Path $Source $name
    if (-not (Test-Path $sourceFile)) { throw "Missing update package: $name" }
    $digest = (Get-FileHash $sourceFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -ne $entry.sha256) { throw "Package checksum failed: $name" }
    Copy-Item $sourceFile (Join-Path $Destination $name) -Force
}
$temporary = Join-Path $Destination 'manifest.json.new'
Copy-Item $manifestPath $temporary -Force
Move-Item $temporary (Join-Path $Destination 'manifest.json') -Force
$versions = Get-ChildItem $Destination -File | ForEach-Object {
    if ($_.Name -match '(\d+\.\d+\.\d+)') { [version]$Matches[1] }
} | Sort-Object -Descending -Unique
$keep = @($versions | Select-Object -First 2 | ForEach-Object { $_.ToString() })
Get-ChildItem $Destination -File | Where-Object {
    $_.Name -ne 'manifest.json' -and $_.Name -match '(\d+\.\d+\.\d+)' -and $keep -notcontains $Matches[1]
} | Remove-Item -Force
Write-Output "Still $($manifest.payload.version) is ready. Retained versions: $($keep -join ', ')."
