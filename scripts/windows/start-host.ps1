$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = 'E:\Still'
& (Join-Path $Root 'setup-storage.ps1') | Out-Null
$config = Get-Content (Join-Path $Root 'host.json') -Raw | ConvertFrom-Json
$env:STILL_VOLUME = Join-Path $Root 'Volume'
$env:STILL_STREMIO_DIRECTORY = $config.StremioDirectory
$env:STILL_LAN_ADDRESS = $config.LanAddress
$env:STILL_ALLOWED_ORIGINS = ConvertTo-Json -Compress -InputObject @($config.AllowedOrigins)
$env:TEMP = Join-Path $env:STILL_VOLUME 'Temp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
& $config.Node (Join-Path $env:STILL_VOLUME 'App\server\windows-host.mjs')
exit $LASTEXITCODE
