# Windows host on E:

This deployment reuses an installed Stremio desktop application's `stremio-runtime.exe`, `server.js`, FFmpeg and FFprobe. It runs them with isolated settings and media work files. The Stremio interface does not need to remain open, and its existing account/library/configuration files are left unchanged.

Requires administrator PowerShell, Node 22.16 or newer, an existing Stremio installation under the installing user's `LocalAppData\Programs\Stremio`, Tailscale, and an NTFS E: drive. The runtime is an existing prerequisite, so the host package has no additional torrent engine or development dependencies.

## Storage

`scripts/windows/setup-storage.ps1` creates a new expanding 8 GiB VHDX at `E:\Still\still.vhdx` and mounts it at `E:\Still\Volume`. Only that new virtual disk is initialized. The E: drive is never formatted. Existing uninitialized disk images are not automatically reformatted.

The volume contains App, Data, Backups, Packages, Temp and Runtime directories. Persistent profile state lives in `Data\still.sqlite`; media cleanup only removes Runtime. The database has a 256 MiB page limit, full synchronous commits and a bounded retained journal. Online backups refresh hourly and retain seven daily snapshots. Backups are checkpointed into single-file SQLite snapshots before rotation.

Permanent torrent caching is disabled. The supervisor pauses the engine and clears its disposable Runtime directory when available space drops below 1 GiB. The 8 GiB volume constrains app data, media work files and backups together, with margin below 10 decimal GB. A few small launcher/configuration files live alongside the image. Existing Node and Stremio program files are reused in place.

## Prepare and deploy

From a built source checkout:

```sh
npm ci
npm run build
node scripts/package-host.mjs
```

Copy these files onto the Windows PC:

- `scripts/windows/setup-storage.ps1` → `E:\Still\setup-storage.ps1`
- `scripts/windows/start-host.ps1` → `E:\Still\start-host.ps1`
- `scripts/windows/setup-host.ps1` → `E:\Still\setup-host.ps1`

Run `setup-storage.ps1` in Administrator PowerShell. Put `artifacts/host/still-host.tar.gz` inside `E:\Still\Volume`, then run `setup-host.ps1`.

The setup installs a SYSTEM scheduled task named **StillHost**, triggered at boot, without storing a user password. The task mounts the VHDX and supervises the profile service and existing Stremio engine. Both HTTP listeners bind to `127.0.0.1`. Tailscale Serve publishes two private HTTPS endpoints on the PC's MagicDNS name:

| Port | Purpose |
| --- | --- |
| 9443 | Still web app, profile API and `/downloads` sideload packages |
| 9444 | Stremio torrent engine and HLS conversion |

Existing Tailscale Serve listeners are preserved. Setup refuses to replace a conflicting proxy on either chosen port.

For explicitly authorized access by a webOS TV on the same trusted home network, run `setup-host.ps1 -EnableLan`. It adds reverse proxies bound to the PC's specific LAN IPv4 address on 8787 and 11470, plus Windows Firewall rules scoped to that address, the Node executable and LocalSubnet. It does not bind a wildcard address or change existing Tailscale proxies. Reserve the PC's LAN address in DHCP. LAN access is opt-in and remains recorded in the host configuration for subsequent starts.

Connect each signed-in Still client to the profile service, then select the same profile to synchronize Saved titles and progress. Set its streaming-server address to the engine endpoint. Android uses its native player; browser, Linux and LG clients can use the server's HLS conversion. Android/Google TV and tablets can run Tailscale themselves. LG webOS can use the opt-in LAN endpoints when on the same network; otherwise it needs a tailnet-capable gateway.

## Check and restart

```powershell
Get-ScheduledTask -TaskName StillHost
Get-Content E:\Still\Volume\Data\host-status.json
Get-ChildItem E:\Still\Volume\Backups
Stop-ScheduledTask -TaskName StillHost
Start-ScheduledTask -TaskName StillHost
```

Stop the task before updating App or restoring the database. Preserve Data and Backups during upgrades. After restoring a database, remove stale WAL/SHM sidecars from the stopped database before starting it. Backup snapshots are on the same E: drive and do not protect against its physical failure.

## Verification

`tests/persistence.test.mjs` checks Saved/progress across a real SQLite restart and backup restore, including retention. `scripts/test-remote-engine.mjs` uses a generated MKV/AC3 fixture and loopback BitTorrent seed to check range bytes, HTTPS HLS and AAC conversion against a running engine. Set `STILL_REMOTE_ENGINE` to its HTTPS endpoint and ensure FFmpeg/FFprobe are on PATH.

See [Microsoft's virtual-disk guide](https://learn.microsoft.com/en-us/windows-server/storage/disk-management/manage-virtual-hard-disks), [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve), and [Stremio Service](https://github.com/Stremio/stremio-service).
