# Testing the Stremio connection

## Use your real account

1. If the bottom-left profile says Preview, click it to exit the preview.
2. Sign in with the same Stremio account used on your televisions. Use the QR code or email/password. In the Linux app, the sign-in link opens in your normal browser.
3. Select your profile. The status at the top-right should say `STILL / PERSONAL`, not `INTERACTIVE PREVIEW`.
4. Open Recommended or Search. These screens now query the addons already configured on that account. Still does not install or configure addons.
5. Open a movie or episode. Set the audio language and maximum quality in Settings, then press Play. Sources with unknown audio or resolution are available for manual selection, but cannot be selected automatically.

The labelled Big Buck Bunny preview is separate. Successfully playing it verifies the player but does not verify your Stremio account or addons.

The live public QR endpoint was checked from the packaged Linux app and returned HTTP 200 with a valid link code. Private account sign-in and playback still need your account.

## Check playback

Start with an authorized direct HTTP/HLS source if your configured addons provide one. This requires no Still companion service and no torrent engine.

The Linux desktop app now manages its own torrent engine. Leave **Settings → Stremio streaming server** blank, sign in, and choose an authorized torrent source. First use downloads the official engine; subsequent launches reuse it. Allow up to two minutes for a torrent to find peers and prepare playback after installation. An unavailable source still falls back to the next matching source.

On browser, Android and webOS clients, torrent-only sources return an `infoHash` and need a reachable Stremio streaming server. To use an existing official Stremio desktop service on the same device, set **Settings → Stremio streaming server** to:

```text
http://127.0.0.1:11470
```

You can instead use the reachable address of an existing streaming server. The server address is distinct from the optional Still profile-sync service. Prefer HTTPS for remote services when using the browser client. The Linux desktop shell keeps Chromium's web security enabled.

Still's managed Linux engine uses its own random loopback port and does not modify another Stremio installation. The profile-service URL is unrelated to this engine.

## Verify account synchronization

1. In single-profile mode, save a title in Still and wait approximately five seconds.
2. Refresh the standard Stremio web interface and confirm the title appears in its library.
3. Play past 2%, stop, and check Continue Watching. Reach 95% to mark the item completed and queue the next released episode where available.
4. For household mode, configure the Still self-hosted service first. Profile changes then synchronize through that service rather than writing back to the shared Stremio account.

## Understand failures

| Result                          | What to check                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| No catalog/search results       | Confirm addons are configured on the same account in standard Stremio. Individual addon failures are intentionally silent.               |
| No sources available            | The configured addons returned no sources for that movie or episode.                                                                     |
| Manual source list              | No source proved the required audio/quality match, or all matching sources failed. Your preferences were not relaxed.                    |
| Source needs a streaming server | Configure a reachable Stremio streaming server for torrent-only sources.                                                                 |
| Sources marked Failed           | Check the error above the list. The source may be unreachable, require request headers, or use a codec the current player cannot decode. |
| Sign-in expired                 | Sign in again. Profile data is preserved.                                                                                                |

For a reproducible report, include the device, app version, movie/episode ID, selected quality/audio settings, and the visible error. Do not paste your password, auth key, or private addon URLs containing access tokens into a public issue.

## Automated checks

```sh
npm run check
npm run test:e2e
npm run test:desktop
npm run engine:prepare
npm run test:torrent
npm run test:desktop:torrent
```

The account browser test uses fixtures to verify sign-in, addon reads, silent addon failure, source ranking, exhausted-source fallback and Saved behavior. It does not log into your account. The desktop smoke test verifies the app window, isolated renderer, preview, navigation and theme switching.

Torrent tests require system FFmpeg to generate an original test video. They run a real loopback BitTorrent seed and HTTP tracker, exchange torrent metadata and video pieces, verify automatic file selection and byte-range seeks, and exercise HLS conversion. The desktop torrent test signs into a fixture account and plays an MKV with AC3 audio through the actual player, checking decoded audio and seeking. It can target an installed bundle with `STILL_PACKAGED_BINARY=artifacts/linux/linux-unpacked/still npm run test:desktop:torrent`. No public swarm or private account is needed for these checks.
