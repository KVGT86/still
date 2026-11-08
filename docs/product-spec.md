# Still Product Specification v2

## Product statement

An uncluttered, Apple-influenced Stremio client for a personal device ecosystem. It provides a light-first interface, built-in playback, optional synchronised household profiles, and installable sideload packages for LG webOS, Android/Google TV, and Android tablets.

The client consumes a Stremio account and its already-configured addons. Addon installation and configuration remain in the standard Stremio web tool.

## Scope

### Included

- Movies and episodic series from configured Stremio addons.
- Stremio authentication, with QR linking as the primary television method and email/password as fallback.
- Single-profile and multi-profile operating modes.
- Continue Watching, Recommended, Search, Saved, Settings, source selection, and built-in playback.
- Sideloadable packages for LG webOS, Android/Google TV, and Android tablet.
- Remote-first television interaction, LG Magic Remote pointer support, and touch-first tablet interaction.
- Light and neutral dark themes, with light as the default and no purple identity.
- A fully self-hostable profile-sync and recommendation service for multi-profile mode.
- Playback reliability learning, source transparency, profile backup and lightweight Saved collections.
- Profile-scoped text size, reduced motion and high-contrast focus preferences.
- Signed private update checks and packages served through the self-hosted Tailnet service.

### Excluded

- Addon installation or management.
- Live TV, channels, podcasts, local files, downloads, intentional offline use, casting, and external players.
- Child profiles, parental controls, or content restrictions.
- Official app-store publication.
- Portrait tablet layouts and tablet keyboard/trackpad-specific layouts.
- Public internet exposure or a second pairing mechanism beyond Tailscale membership.
- Android TV home recommendations, operating-system media sessions, further LG Magic Remote calibration and crash reporting.

## External dependencies

- Stremio owns account authentication and addon configuration.
- Configured addons supply catalogues, metadata, sources, and availability data where available.
- The self-hosted companion service owns multi-profile synchronisation and recommendation state.
- The service is reachable through a user-provided Tailscale address. Tailnet membership is sufficient client authorisation.

## Operating modes

### Single-profile mode

- Works without the companion service.
- Stremio remains authoritative for Saved titles, watched status, and playback progress.
- The client uses the Stremio account's existing addon configuration.

### Multi-profile mode

- Requires a configured self-hosted companion service.
- Stremio remains authoritative only for authentication and addon configuration.
- The companion service becomes authoritative for each profile's Saved titles, history, progress, preferences, autoplay configuration, recommendation feedback, and recommendation state.
- Enabling multi-profile mode imports the existing Stremio Saved collection and progress into the first profile.
- Disabling multi-profile mode does not export or merge profile activity back into Stremio. Stremio's prior state remains untouched.

## Profiles

- Every fresh app launch opens the profile chooser.
- Each profile has a name and avatar.
- PIN protection is optional per profile.
- Any user may create, rename, PIN-protect, or delete profiles.
- Profile deletion requires explicit confirmation and removes that profile's synchronised data.
- Profiles do not provide child or content-restriction modes.
- Profiles may be reordered and exported or restored as small JSON backups.
- Profile settings include theme, text size, accessibility, language, playback and device-capability preferences.

## Information architecture

The primary navigation contains exactly:

1. Home
2. Recommended
3. Search
4. Saved
5. Settings

Home contains only Continue Watching. Browsing and discovery do not appear on Home.

Saved remains the profile-specific Stremio-backed list. Lightweight collections may group Saved titles without changing that underlying library. There is no Watchlist/Favourites split.

## Continue Watching

- A newly started title enters Continue Watching at 2% progress.
- It leaves automatically at 95% progress and becomes watched.
- A user may remove an item manually without marking it watched.
- Completing an episode at 95% replaces it with the next unwatched episode.
- A completed series disappears when no unwatched episode remains.
- Progress is isolated per profile in multi-profile mode.

## Recommendations

- Recommended ranks titles available through the configured addon catalogues.
- A new profile begins with popular or trending catalogue titles.
- Personalisation gradually uses viewing history, completion, and explicit feedback.
- Profiles may mark a title More Like This, Not Interested, or Already Watched.
- Not Interested excludes that title from future recommendations.
- Already Watched affects future ranking without recommending the same title again.
- More Like This boosts similar titles.
- Hidden titles can be restored from Settings.
- Recommended may show new episodes from Saved; Saved may highlight recently released titles.
- The algorithm is a replaceable black box; its required inputs and outcomes are fixed, but its implementation is not.

## Source resolution

Each profile stores preferred audio language, preferred subtitle language, whether subtitles normally start enabled, and autoplay mode.

Each device derives a maximum supported video quality. A profile stores the preferred quality and bitrate; the current device applies its own lower hardware ceiling when required.

Automatic source selection follows this order:

1. Exclude sources above the device's configured quality ceiling.
2. Never exclude a source for its language, because add-ons rarely tag it. Sources clearly tagged with a different language than the profile's preferred audio language are tried last.
3. Demote sources whose declared video or audio codec is unsupported and explain the incompatible part separately.
4. Prefer sources that previously played successfully for this profile and penalise repeated failures or stalls.
5. Prefer sources with a healthy swarm (at least 15 peers), then the strongest quality available within the device ceiling.
6. Rank otherwise suitable sources by user availability, such as peers or seed count when the addon exposes it.
7. Apply the preferred subtitle language when available; subtitles are optional and never prevent automatic playback.

If no source fits the quality ceiling, the app shows every available source for manual selection. It must not silently relax the ceiling.

If the selected automatic source fails, the app tries the next matching ranked source. When every matching source fails, it opens the complete manual list and marks each failed source.

The manual list always includes every source. It exposes temporary sorting, a plain-language selection reason, separate codec compatibility, HDR, file size, peer and provider badges when that metadata is available.

Individual addon failures are silent when other addons return usable results. If no addon supplies a playable source, the client shows **No sources available**.

## Playback

- Playback always uses the built-in player.
- The primary overlay contains play/pause, timeline, audio/subtitle access, and next episode.
- Source switching and advanced playback options live in a secondary menu.
- Scheduled autoplay is active from 07:00 until 22:00 using device-local time.
- Autoplay has three modes: On, Off, and Scheduled.
- On and Off override the schedule.
- Switching sources keeps the most recent playback position.
- Direct HTTP sources receive a short non-blocking availability preflight.
- Buffer targets adapt from the profile's stall history. Sustained buffering may switch to the next source when automatic recovery is enabled.
- Android supports a profile bitrate cap, hardware audio offload and frame-rate matching where the television and operating system permit them.
- Subtitle timing may be adjusted by the profile without delaying playback.

## Synchronisation and resilience

- Intentional offline operation is not supported.
- Brief companion-service interruptions must not block browsing or playback when cached profile data is available.
- Changes made during a brief interruption are queued and synchronised when the service becomes reachable again.
- The client exposes pending changes, cached-data use and the last successful sync. If local and remote copies overlap, the user may choose which copy leads.
- Settings shows profile-service version, engine reachability, database size, host reserve and backup age when available.
- Expired Stremio authentication prompts reauthentication without deleting local or companion-service profile data.

## Platform and input behaviour

- All supported layouts are landscape-only.
- Android/Google TV uses directional remote navigation.
- LG webOS supports both directional focus navigation and Magic Remote pointer interaction.
- Android tablet uses touch interaction only.
- Every actionable television element has an unambiguous visible focus state.
- Both themes maintain readable contrast. Profile preferences provide text scaling, reduced motion and a stronger focus treatment, while controls expose screen-reader names and status does not rely on colour alone.

## Private updates

- A device-level setting enables automatic checks at launch and every six hours.
- The profile service exposes a signed manifest and same-origin packages through its private `/downloads` path.
- Clients reject unsigned manifests, unexpected package sizes, checksum mismatches and cross-origin package addresses.
- Linux installs a verified per-user version, retains two local versions and restarts into the update.
- Android releases use one stable private signing identity. Android always presents its package-installation confirmation.
- LG reports an available IPK but cannot install it without webOS Developer Mode tools.
- The Windows deployment retains only the current and previous package sets.

## Theme behaviour

- Light is the default theme.
- A neutral dark theme is also available.
- Purple is not part of the product identity.
- The selected theme persists per profile. Household profiles synchronise it through the profile service; the single profile keeps it on each device.

## Acceptance scenarios

### Resume an episode

A user launches the app, chooses a profile, lands on Continue Watching, resumes an episode from its synchronised position, and sees the next unwatched episode replace it after reaching 95%.

### Automatic source success

A selected title has several sources. The client rejects sources above the device quality ceiling, ranks the remaining sources by language fit, swarm health, quality and availability, applies preferred subtitles when present, and starts the best match.

### Automatic source failure

The best source fails to start. The client tries each remaining matching source in rank order. When all fail, it opens the full source list and marks the attempted sources.

### Scheduled autoplay

At 21:59 in Scheduled mode, the next episode may autoplay. At 22:00 or later it waits for user action. Scheduled autoplay becomes eligible again at 07:00.

### Multi-profile isolation

Two profiles use the same Stremio account and addon configuration. Their Saved collections, progress, history, preferences, feedback, and recommendations remain independent and synchronise across authorised tailnet clients.

### Private update

A newer signed manifest is published on the Tailnet service. Still reports the update automatically. Linux verifies, installs and restarts; Android verifies the APK before handing it to the system installer; LG reports the version for manual Developer Mode installation.

## Deliberately flexible implementation decisions

- Project name and branding assets.
- The recommendation model or ranking algorithm.
- The framework and packaging strategy used to share code across webOS and Android packages.
- The exact mapping of addon-specific availability metadata into a common ranking signal.
