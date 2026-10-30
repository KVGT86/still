# Still

A quieter place for your Stremio stories. Light by default, focused on Continue Watching, and built for the sofa and a landscape tablet.

Still is an independent client, not an official Stremio product. It hosts no media, installs no addons, and uses the addons already attached to your Stremio account. Only play content you are entitled to access.

![Still's light interface, showing the clearly labelled preview](docs/images/home-light.png)

## Run locally

Requires Node 22.16 or newer.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Sign in with Stremio using the QR link or email/password. **Preview app** opens an explicitly labelled preview with Blender Foundation's Big Buck Bunny; it never touches a Stremio account.

```sh
npm run check
npm exec -- playwright test
npm run build
npm run preview
```

Browser tests use installed Chrome by default. Set `PLAYWRIGHT_CHANNEL=chromium` and install Playwright Chromium if preferred.

## What is included

- Home containing Continue Watching only; Recommended, Search, Saved and Settings.
- Stremio login and QR linking, existing addon catalogs, metadata, episodes, streams and subtitles.
- Automatic source selection with mandatory known audio language and a device quality ceiling. Unknown metadata is kept for manual selection. Highest resolution within the ceiling is preferred, then reported peers/seeders; this is availability metadata, not telemetry gathered from other Still users.
- Automatic fallback through matching sources, then a complete manual list with failures marked.
- Profile preferences for audio, optional subtitles and autoplay: on, off, or 07:00–22:00 device local time.
- Continue Watching begins at 2%; completion at 95% queues the next released unwatched episode. Manual removal does not mark watched.
- One Saved collection and feedback-driven catalog ranking: More Like This, Not Interested, Already Watched. This is a deterministic genre-affinity recommendation model and requires no paid AI service.
- Light and neutral dark themes, directional remote focus, Magic Remote pointer interaction, and a landscape-only tablet UI.
- Android's built-in Media3 player; browser/webOS HTML video with HLS fallback.

## Two account modes

**Single profile:** works with no Still service. Library and playback state sync with Stremio. Device-local settings and recommendation feedback are retained on that device. Stremio's watched-episode bitfield is preserved when updating a series.

**Household profiles:** connect the optional Still service in Settings. The first profile imports the Stremio library and progress. Additional profiles start empty. Saved titles, progress, preferences and feedback are independent, synchronized through the service, and do not write back to Stremio. Disconnecting the service restores the original Stremio state without merging household activity.

Every app launch shows the profile chooser. Optional PINs protect profile entry and data reads. Editing or removing the PIN of a protected profile requires first unlocking it. Profile management otherwise has no owner/child roles. A PIN protects casual access in the app; an administrator with filesystem access to the server or device can inspect cached data.

## Self-host over Tailscale

For a Windows host on E: with capped storage and an existing Stremio installation, see [Windows hosting](docs/windows-host.md). It includes automatic startup, persistent Saved/progress, seven daily SQLite snapshots and private HTTPS endpoints.

```sh
docker compose up -d --build
tailscale serve --bg http://127.0.0.1:8787
```

Enter the resulting **HTTPS** tailnet URL under Settings → Connect service. The service and production web client share this address. The compose port binds to loopback. No public exposure, extra device pairing, paid account or external recommendation API is needed.

Enter a running service URL, not a folder or file path. The service creates its database automatically in its data directory; Docker manages that directory through the named volume below. It stores profile names, PIN hashes, Saved titles, playback progress, preferences, recommendation feedback and temporary service sessions. It stores no videos, downloaded artwork, Stremio passwords or Stremio authentication keys. The database starts small and grows with your saved titles and viewing history. A single-profile setup can leave Connect service blank and needs no self-hosted database.

Without Docker:

```sh
npm run build
npm run server
```

The service defaults to `127.0.0.1:8787`; override `HOST`, `PORT` or `DATABASE` when needed. SQLite lives at `data/still.sqlite`. Back up the SQLite database using SQLite's backup mechanism, or stop the service and back up the entire data directory including WAL files. Docker stores it in the `still-data` volume.

The service verifies the signed-in Stremio account, stores hashed short-lived service tokens, and namespaces profiles by Stremio user ID. It does not store your Stremio password or authentication key. PINs use salted scrypt hashes, have a retry limit, and are never returned by the API. Brief interruptions queue changes locally; item timestamps merge independent updates. It is not designed for sustained offline use.

An LG TV needs a route to the tailnet address through your network: installing the app does not install Tailscale on webOS. Use a Tailscale-capable gateway/router or another network arrangement that makes the server reachable. Android devices can use their normal Tailscale client.

## Linux desktop

```sh
npm ci
npm run package:linux
```

The x86-64 Linux builds are in `artifacts/linux/`: a portable `.tar.gz`, a Debian `.deb`, and an unpacked executable at `artifacts/linux/linux-unpacked/still`. The desktop app has its own window and persistent profile storage; it does not require the local preview server to run. Sign in again inside the desktop app because its storage is independent of the browser preview.

The Electron renderer is sandboxed with Node integration disabled and context isolation enabled. External sign-in links open in the normal browser. The desktop application includes only the compiled client and native shell; the optional profile service stays separate.

Torrent playback is built into the x86-64 Linux app. Leave **Settings → Stremio streaming server** blank to use it. On first torrent playback, Still downloads the official Stremio Service 0.1.21 engine archive (about 62 MiB), verifies its pinned SHA-256, and installs the runtime and FFmpeg tools in its own application data directory (about 240 MiB installed). `dpkg-deb` must be available; it is included on Debian/Ubuntu systems. No separate Stremio application or profile service is required.

The engine starts on demand on a private loopback port. Torrents use the addon's trackers and requested file index; an omitted index selects the largest file. Local playback uses the engine's HLS conversion, with H.264 and AAC/MP3 audio support. Unsupported audio such as AC3 is converted; demanding video conversions depend on the laptop's CPU. Persistent torrent caching is disabled. Temporary video/transcode files live in an isolated session directory and are removed when Still closes, along with its owned engine and conversion processes. The installed engine programs remain for future launches.

The engine is downloaded directly from [Stremio's official distribution](https://github.com/Stremio/stremio-service), separately from Still's MIT application source. Upstream components retain their own licensing and copyright notices. Setting a remote streaming-server address overrides the local engine and uses that server's playback path instead.

`npm run install:desktop` adds a per-user Applications-menu launcher and icon-theme assets pointing at the unpacked build. The Linux app ID and desktop entry both use `io.still.client` for correct dock grouping. Quit and reopen an already-running older version after updating its icon or app identity.

All branded icons come from `src/assets/app-icon.svg`. PNG sizes for the window, dock, Linux package, Android and webOS are generated from that same squircle artwork. In-app controls use Lucide.

```sh
npm run desktop
npm run test:desktop
```

Desktop tests need a graphical session or `xvfb-run`. For the actual Stremio connection and playback checks, follow [Testing the Stremio connection](docs/testing-stremio.md).

## Android TV / Google TV / Galaxy Tab S7

The Android project requires JDK 17+ and Android SDK platform/build tools 35. Set `ANDROID_HOME` or create an untracked `android/local.properties` with `sdk.dir=/path/to/sdk`.

```sh
npm ci
npm run package:android
cd android
sh gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The launcher appears on both TV and tablet. Landscape is enforced. The bundled client is served from Android's secure asset origin. Only bundled UI pages load inside the WebView; native playback uses Media3 with preferred audio/text language selection and request headers. The debug APK is for personal sideloading. Sign a release build with your own key for a long-lived release identity.

## LG webOS

The initial engine target is **webOS 22+** (Chromium 87+); exact codec/firmware behavior needs testing on the real TV.

```sh
npm ci
npm run package:webos
tools/webos/node_modules/.bin/ares-setup-device
tools/webos/node_modules/.bin/ares-install -d YOUR_TV artifacts/webos/io.still.client_0.1.1_all.ipk
tools/webos/node_modules/.bin/ares-launch -d YOUR_TV io.still.client
```

Enable LG's Developer Mode app and configure its key first. Sideloads remain subject to LG Developer Mode session expiry/renewal rules. See the [LG CLI guide](https://webostv.developer.lge.com/develop/tools/cli-dev-guide).

webOS uses a classic IIFE JavaScript bundle rather than ES module script tags, because packaged file-origin apps cannot safely rely on module loading. App resources are bundled; catalog artwork and media remain remote. The app supports standard directional keys and pointer events. Magic Remote hardware calibration must be verified on-device.

LG's CLI is isolated in `tools/webos/` and installed automatically by the webOS packaging command. Its upstream dependency tree currently has security advisories; it is used only for local packaging/device operations and is never included in the application or companion-service image. Do not run its optional development servers on an untrusted network.

## Playback requirements and limits

- HTTP(S) streams play directly when their codecs are supported by the device.
- Linux desktop handles torrent sources through its managed local engine. Browser, Android and webOS clients still need a reachable Stremio streaming server under Playback settings. Sharing a Windows or tailnet engine is separate from the Linux integration.
- HLS works through native support or hls.js; Android also handles DASH through Media3. DRM-protected services are outside the addon playback contract.
- Browser and webOS audio-track selection depends on the source/engine; automatic source filtering still requires matching audio metadata. Android selects the preferred track natively.
- Browser/webOS external subtitles currently require WebVTT URLs and CORS. Android supports WebVTT and SubRip external tracks. ASS conversion is not implemented.
- An HTTPS-hosted client requires HTTPS media/server endpoints unless the platform permits mixed content. Prefer HTTPS tailnet service URLs.
- Resolution detection reflects the current display mode, not a guarantee about every codec/HDR combination. Lower the per-device ceiling if required.
- LG uses the native device video width rather than the app's graphics resolution; a 1080p app surface can therefore still select 4K video on a UHD television.
- Actual account/addon compatibility and codec behavior require device testing. No credentials, private addon URLs, or TV connection were supplied during development.

## Repository layout

| Path                | Purpose                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `src/`              | Shared React interface, Stremio API integration, profile sync and web playback |
| `shared/domain.mjs` | Source ranking, thresholds, autoplay, recommendations and merge rules          |
| `server/`           | Optional Express + SQLite profile service                                      |
| `android/`          | Android WebView shell and native Media3 player                                 |
| `scripts/`          | webOS IPK packaging and Android asset sync                                     |
| `tests/`            | Domain and API isolation checks                                                |
| `e2e/`              | Browser interaction checks                                                     |
| `docs/`             | Product specification and verification notes                                   |

The application code is licensed MIT. The Stremio watched-bitfield package is MIT; dependencies retain their own licenses. Stremio and the Blender films retain their respective names and artwork rights. No Stremio client code was copied or forked.
