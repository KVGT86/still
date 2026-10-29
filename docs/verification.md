# Verification and device handoff

## Verified in development

- Clean `npm ci` and TypeScript/Vite production compilation.
- Domain tests for autoplay boundaries, source constraints/ranking, 2% and 95% progress thresholds, next released episode selection, manual removal, merge tombstones, compact progress snapshots and recommendation feedback.
- Service integration test for Stremio account namespaces, PIN protection, incorrect PIN rejection, validation, merge updates and confirmed deletion.
- Chrome browser tests for the preview, Saved collection, themes, preferences, portrait guard, fixture account sign-in, silent addon failure and automatic source exhaustion with failure markings.
- LG IPK creation using the isolated official CLI, with a classic script bundle suitable for a packaged file origin.
- Android Java/Media3 compilation and debug APK creation.
- Linux portable and Debian packaging, plus a smoke test of the packaged executable with sandboxing and context isolation enabled. The local Applications-menu launcher is validated.
- `npm audit` for the main application has no known advisories at the time of the build. The isolated LG development CLI retains upstream advisories and is not shipped with the application or service.

## Needs real-device verification

Docker image execution was not tested in this environment; the Docker Compose plugin is unavailable. The standalone service API is covered by the integration test.

No Stremio credentials, private addon configuration, TV access, or tailnet service address were supplied during development. Browser account tests use labelled fixtures and the preview uses the Blender Foundation's film; they are not a claim that every real addon or codec has been exercised.

On each device:

1. Sideload the relevant package and verify the launcher and landscape layout.
2. Link the real Stremio account, select a profile, and confirm existing Saved titles and progress import correctly.
3. Check directional focus and Back; on LG also check Magic Remote pointer targeting.
4. Confirm detected maximum quality and reduce it if a codec/display combination needs it.
5. Play an authorized HTTP source; test alternate audio, subtitles, resume, source fallback, and next episode.
6. For torrent-only sources, configure a reachable Stremio streaming server and test an authorized source.
7. Connect the profile service using its HTTPS tailnet address. Check that the LG network can route there.
8. Check two separate profiles across devices, optional PINs, Saved isolation, and scheduled autoplay around 07:00/22:00.

The initial LG target is webOS 22+; older devices are not validated. Android requires API 26+ and a current Android System WebView. The debug APK uses a generated local development signing key; preserve the signing identity or use a personal release key for long-lived installations.
