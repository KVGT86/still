# Security policy

## Supported version

Security fixes are applied to the current `main` branch and the latest 0.1.x build. Older sideloaded builds should be replaced rather than patched in place.

## Reporting a vulnerability

Use GitHub's private security-advisory reporting for this repository. Do not include Stremio passwords, authentication keys, private addon URLs, tailnet names, IP addresses or real viewing history in a public issue.

Include the affected platform, Still version, reproduction steps, expected impact and whether the problem requires local-device, tailnet or public-network access.

## Intended security boundary

Still is designed for a personal device, private tailnet or explicitly trusted home LAN.

- Do not publish the profile-service or streaming-engine ports directly to the internet.
- The streaming engine relies on network reachability as its access boundary and does not add a Still login layer.
- LG LAN access should bind one reserved private address and use firewall rules limited to the local subnet.
- Tailscale Serve is the preferred remote transport because it supplies private routing and HTTPS.

## Sensitive client data

Still stores its Stremio session, profile-service token, service address, device settings and cached state in platform local storage. The Electron, Android and webOS application sandboxes restrict ordinary cross-app access, but these values are not encrypted with an operating-system keychain. A device administrator, browser-profile owner or attacker with filesystem access may recover them.

Sign out and clear Still's application data before transferring a device or operating-system account. Sign out also asks the profile service to revoke that device's service token. Revoking the Stremio session invalidates the client session used by Still.

## Profile service

The service sends a supplied Stremio authentication key to Stremio's official `getUser` API for verification, then discards it. It persists only a SHA-256 digest of a random 256-bit service token, the verified Stremio account ID and the token expiry.

Profile PINs are salted and hashed with scrypt. PIN attempts and session creation are rate-limited in memory. PINs protect casual profile access, not server administrators. Rate-limit state resets when the service restarts.

The SQLite database contains profile names, avatars, Saved titles, playback progress, preferences and recommendation feedback. Treat the database and its backups as private viewing-history data.

## Third-party boundaries

- Stremio addons control the catalogue metadata, source URLs and subtitle URLs they return.
- Media hosts and torrent peers see normal playback network traffic.
- The managed Linux engine is downloaded from Stremio's official distribution and checked against a pinned SHA-256 before extraction.
- The LG CLI is a local build and device-management tool. Its dependency tree currently contains upstream advisories, so it is isolated under `tools/webos/`, excluded from application packages, and should not run optional development servers on an untrusted network.

The Still security policy does not cover an addon, upstream engine, media host, torrent, operating system or device firmware.

## Repository hygiene

The repository ignores environment files, Android local SDK configuration, build output, app data, generated engine files and signing artifacts. Before a public release, run:

```sh
git grep -n -I -E '(password|passwd|authKey|api[_-]?key|secret|private[_-]?key|tailscale|[0-9]{1,3}(\.[0-9]{1,3}){3})'
npm audit
npm audit --prefix tools/webos
npm run check
npm run test:e2e
```

Review every match rather than assuming a keyword is a credential. Test fixtures use reserved example values and domains.
