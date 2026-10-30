param([switch]$EnableLan)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Root = 'E:\Still'
& (Join-Path $Root 'setup-storage.ps1') | Out-Null
$volume = Join-Path $Root 'Volume'
$app = Join-Path $volume 'App'
New-Item -ItemType Directory -Force $app,(Join-Path $volume 'Packages') | Out-Null
$archive = Join-Path $volume 'still-host.tar.gz'
if (Test-Path $archive) {
    & tar.exe -xzf $archive -C $app
    if ($LASTEXITCODE -ne 0) { throw 'Server package extraction failed.' }
    Remove-Item $archive
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$stremio = Join-Path $env:LOCALAPPDATA 'Programs\Stremio'
foreach ($file in 'stremio-runtime.exe','server.js','ffmpeg.exe','ffprobe.exe') {
    if (-not (Test-Path (Join-Path $stremio $file))) { throw "Missing installed Stremio file: $file" }
}
$dns = ((& tailscale status --json | ConvertFrom-Json).Self.DNSName).TrimEnd('.')
$origins = @('still://app','null','https://appassets.androidplatform.net',"https://${dns}:9443")
$configFile = Join-Path $Root 'host.json'
$lan = $null
if (Test-Path $configFile) { $lan = (Get-Content $configFile -Raw | ConvertFrom-Json).LanAddress }
if ($EnableLan) {
    $lan = Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -and $_.IPv4Address} | Select-Object -First 1 | ForEach-Object {$_.IPv4Address.IPAddress}
    if (-not $lan) { throw 'No LAN address was found.' }
}
@{Node=$node;StremioDirectory=$stremio;AllowedOrigins=$origins;LanAddress=$lan} | ConvertTo-Json | Set-Content -Encoding UTF8 $configFile
if ($lan) {
    foreach ($port in 8787,11470) {
        $name = "Still-LAN-$port"
        Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        New-NetFirewallRule -Name $name -DisplayName "Still local network $port" -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $lan -LocalPort $port -RemoteAddress LocalSubnet -Program $node -Profile Any | Out-Null
    }
}
$task = Get-ScheduledTask -TaskName 'StillHost' -ErrorAction SilentlyContinue
if ($task -and $task.Actions.Arguments -notlike '*E:\Still\start-host.ps1*') { throw 'An unrelated StillHost task already exists.' }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File E:\Still\start-host.ps1'
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'StillHost' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Still profiles and the installed Stremio engine, using the capped E: volume and Tailscale-only access.' -Force | Out-Null
Start-ScheduledTask -TaskName 'StillHost'
$serve = & tailscale serve status --json | ConvertFrom-Json
foreach ($pair in @(@(9443,8787),@(9444,11470))) {
    $port=$pair[0]; $target="http://127.0.0.1:$($pair[1])"
    $existing = $serve.Web.PSObject.Properties["${dns}:$port"]
    if ($existing -and $existing.Value.Handlers.'/'.Proxy -ne $target) { throw "Tailscale port $port already serves another app. Its configuration was left unchanged." }
    & tailscale serve --bg --yes "--https=$port" $target
    if ($LASTEXITCODE -ne 0) { throw "Tailscale proxy setup failed for port $port." }
}
[ordered]@{Service="https://${dns}:9443";Engine="https://${dns}:9444";Database=(Join-Path $volume 'Data\still.sqlite');Task='StillHost'} | ConvertTo-Json
