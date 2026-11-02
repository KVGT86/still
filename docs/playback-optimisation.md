# Playback optimisation and acceptance record

Baseline inspected: `899fd37` (0.2.4), confirmed against upstream main.
The LG changes in this revision fix file-origin loading and layout, not video playback.

## Confirmed paths

| Device            | Torrent path                                                                             | Potential bottleneck                            |
| ----------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Android TV/tablet | Remote Stremio engine → original media → Media3                                          | Peers, host-to-TV network, decoder, buffering   |
| LG webOS          | Remote engine → original media → native video; one HLS compatibility fallback on failure | Peers, network, decoder; conversion on fallback |
| Linux             | Managed or remote engine → same HLS conversion → browser player                          | Conversion and peers                            |

Still shares Stremio's account/addon and engine contracts, not its entire player implementation. No measured parity claim is justified yet.

## Changes under evaluation

- Android reports its installed video and audio decoders and distinguishes hardware from software decoding. Browser and webOS builds probe their native media element for H.264, HEVC, VP9, AV1, AAC, AC-3, E-AC-3, DTS and TrueHD support.
- Declared unsupported codecs are tried after compatible sources. Healthy swarms still take priority, then hardware-decoded formats. Uncertain sources remain available and are labelled in manual selection.
- Decoder failures use the existing bounded next-source fallback; Still does not transcode or permanently block a codec.
- Android targets a 50–90 second in-memory buffer subject to Media3's byte threshold; startup requests 3 seconds and recovery requests 8 seconds. These are targets, not guarantees. No persistent media cache is added.
- Android touch scrubbing commits one seek on release; remote key seeks remain immediate.
- HLS.js gets at most two additional network recovery attempts and one media recovery per source. Timers are cancelled on teardown and media recovery retains position.
- Browser playback options show buffered seconds, startup time, stalls and dropped frames without exposing stream URLs or credentials.
- Android retries connection failures/timeouts twice and resumes after backgrounding only when playback was active beforehand.
- Source searches abort their outstanding requests when cancelled or replaced.

## Automated evidence

- 20 Node tests and production TypeScript/Vite build passed.
- Eight browser checks passed, including the LG source-exhaustion journey: original media fails, one compatibility session is tried per source, then failures are marked. This simulates webOS detection in Chrome, not an LG decoder.
- Real loopback BitTorrent integration passed: metadata/pieces, automatic file selection, byte-range seeking, HLS conversion, origin checks and engine-session cleanup.
- Android debug APK and webOS IPK built. The APK was rebuilt after the Android retry/resume changes.
- No physical-device comparative results are recorded yet.

## Remaining implementation and validation

- Validate LG native playback and its single compatibility fallback on physical hardware; exercise bounded recovery under injected failures.
- Android diagnostics report buffered time, estimated network rate, startup, stalls, dropped frames and the active video format; compare their measurements on hardware.
- Verify remote conversion sessions expire after disconnect; source-search cancellation is covered by a browser test, and LAN proxy disconnect handling is present.
- Measure native HLS recovery separately: HLS.js recovery does not apply to the native LG player.
- Confirm memory, host temporary storage and cleanup over long sessions, keeping total storage within the agreed 10 GB limit.
- Compile and package Android/webOS, then run the physical-device comparison below.

## Comparison protocol

Use identical source/hash, file index, resolution, audio track, subtitle choice and network for both apps. Record cold and warm engine runs separately; alternate app order and repeat each scenario three times.

Record device model/firmware, host/network path, first-frame seconds, stalls and stalled seconds, seek recovery, dropped frames, audio sync, host CPU and peak storage. Test H.264 and HEVC, 1080p and 4K where supported, direct HTTP/HLS and authorised torrents, subtitle/audio changes, resume, autoplay, remote controls and sleep/wake. Include a long playback session and temporary network interruption.

Release gate: no repeatable startup/stall/seek regression against Stremio on the agreed sources, stable memory/storage, correct resume and successful physical LG and Android TV playback. Automated tests alone cannot prove this gate.
