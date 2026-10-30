param([string]$Root = 'E:\Still')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($Root -ne 'E:\Still') { throw 'This installation is scoped to E:\Still.' }
$identity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as Administrator.' }
$null = Get-Volume -DriveLetter E -ErrorAction Stop
$imagePath = Join-Path $Root 'still.vhdx'
$mountPath = Join-Path $Root 'Volume'
New-Item -ItemType Directory -Force $Root,$mountPath | Out-Null
$created = -not (Test-Path $imagePath)
if ($created) {
    $diskpart = Join-Path $Root 'create-volume.diskpart'
    @("create vdisk file=`"$imagePath`" maximum=8192 type=expandable", 'exit') | Set-Content -Encoding ASCII $diskpart
    $result = & diskpart.exe /s $diskpart
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $imagePath)) { throw "Virtual disk creation failed: $result" }
}
$image = Get-DiskImage -ImagePath $imagePath
if (-not $image.Attached) { $image = Mount-DiskImage -ImagePath $imagePath -NoDriveLetter -PassThru }
$disk = $image | Get-Disk
if ($disk.Size -gt 9GB -or $disk.Size -lt 7GB) { throw 'Unexpected virtual disk size. No disk will be formatted.' }
if ($disk.PartitionStyle -eq 'RAW') {
    if (-not $created) { throw 'Existing image is uninitialized. Refusing to format existing storage.' }
    $disk | Initialize-Disk -PartitionStyle GPT -PassThru | Out-Null
    $partition = New-Partition -DiskNumber $disk.Number -UseMaximumSize
    $partition | Format-Volume -FileSystem NTFS -NewFileSystemLabel 'Still' -Confirm:$false | Out-Null
} else {
    $partition = Get-Partition -DiskNumber $disk.Number | Where-Object {$_.Type -eq 'Basic'} | Select-Object -First 1
    if (-not $partition) { throw 'The Still virtual disk has no data partition.' }
}
$accessPath = $mountPath.TrimEnd('\') + '\'
if ($partition.AccessPaths -notcontains $accessPath) { $partition | Add-PartitionAccessPath -AccessPath $accessPath }
$volume = $partition | Get-Volume
if ($volume.FileSystemLabel -ne 'Still') { throw 'Unexpected volume label. No application data will be changed.' }
[ordered]@{Root=$Root; Volume=$mountPath; VirtualBytes=$disk.Size; UsedBytes=($volume.Size-$volume.SizeRemaining); RemainingBytes=$volume.SizeRemaining} | ConvertTo-Json
