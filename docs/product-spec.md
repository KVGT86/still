# Stremio Client Redesign - Product Specification v1

## Product statement

An uncluttered, Apple-influenced Stremio client for a personal device ecosystem. It provides a light-first interface, built-in playback, optional synchronized household profiles, and installable sideload packages for LG webOS, Android/Google TV, and Android tablets.

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

### Excluded

- Addon installation or management.
- Live TV, channels, podcasts, local files, downloads, intentional offline use, casting, and external players.
- Child profiles, parental controls, or content restrictions.
- Official app-store publication.
- Portrait tablet layouts, tablet keyboard/trackpad navigation, system text scaling, and reduced-motion adaptation.
- Public internet exposure or a second pairing mechanism beyond Tailscale membership.

## External dependencies

- Stremio owns account authentication and addon configuration.
- Configured addons supply catalogs, metadata, sources, and availability data where available.
- The self-hosted companion service owns multi-profile synchronization and recommendation state.
- The service is reachable through a user-provided Tailscale address. Tailnet membership is sufficient client authorization.

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
- Profile deletion requires explicit confirmation and removes that profile's synchronized data.
- Profiles do not provide child or content-restriction modes.

## Information architecture

The primary navigation contains exactly:

1. Home
2. Recommended
3. Search
4. Saved
5. Settings

Home contains only Continue Watching. Browsing and discovery do not appear on Home.

Saved is one profile-specific collection. There is no Watchlist/Favourites split.

## Continue Watching

- A newly started title enters Continue Watching at 2% progress.
- It leaves automatically at 95% progress and becomes watched.
- A user may remove an item manually without marking it watched.
- Completing an episode at 95% replaces it with the next unwatched episode.
- A completed series disappears when no unwatched episode remains.
- Progress is isolated per profile in multi-profile mode.

## Recommendations

- Recommended ranks titles available through the configured addon catalogs.
- A new profile begins with popular or trending catalog titles.
- Personalization gradually uses viewing history, completion, and explicit feedback.
- Profiles may mark a title More Like This, Not Interested, or Already Watched.
- Not Interested excludes that title from future recommendations.
- Already Watched affects future ranking without recommending the same title again.
- More Like This boosts similar titles.
- The algorithm is a replaceable black box; its required inputs and outcomes are fixed, but its implementation is not.

## Source resolution

Each profile stores preferred audio language, preferred subtitle language, whether subtitles normally start enabled, and autoplay mode.

Each device derives a maximum supported video quality. The app detects the device capability automatically and allows the user to lower the ceiling manually.

Automatic source selection follows this order:

1. Exclude sources above the device's configured quality ceiling.
2. Require the profile's preferred audio language.
3. Prefer the strongest quality available within the device ceiling.
4. Rank otherwise suitable sources by user availability, such as peers or seed count when the addon exposes it.
5. Apply the preferred subtitle language when available; subtitles are optional and never prevent automatic playback.

If no source satisfies the mandatory constraints, the app shows every available source for manual selection. It must not silently relax the requirements.

If the selected automatic source fails, the app tries the next matching ranked source. When every matching source fails, it opens the complete manual list and marks each failed source.

Individual addon failures are silent when other addons return usable results. If no addon supplies a playable source, the client shows **No sources available**.

## Playback

- Playback always uses the built-in player.
- The primary overlay contains play/pause, timeline, audio/subtitle access, and next episode.
- Source switching and advanced playback options live in a secondary menu.
- Scheduled autoplay is active from 07:00 until 22:00 using device-local time.
- Autoplay has three modes: On, Off, and Scheduled.
- On and Off override the schedule.

## Synchronization and resilience

- Intentional offline operation is not supported.
- Brief companion-service interruptions must not block browsing or playback when cached profile data is available.
- Changes made during a brief interruption are queued and synchronized when the service becomes reachable again.
- Multi-device offline conflict resolution is outside scope because the product assumes connectivity.
- Expired Stremio authentication prompts reauthentication without deleting local or companion-service profile data.

## Platform and input behavior

- All supported layouts are landscape-only.
- Android/Google TV uses directional remote navigation.
- LG webOS supports both directional focus navigation and Magic Remote pointer interaction.
- Android tablet uses touch interaction only.
- Every actionable television element has an unambiguous visible focus state.
- Both themes maintain readable contrast; broader system accessibility adaptation is not a v1 requirement.

## Theme behavior

- Light is the default theme.
- A neutral dark theme is also available.
- Purple is not part of the product identity.
- The selected theme persists. Whether persistence is per profile or per device is an implementation choice.

## Acceptance scenarios

### Resume an episode

A user launches the app, chooses a profile, lands on Continue Watching, resumes an episode from its synchronized position, and sees the next unwatched episode replace it after reaching 95%.

### Automatic source success

A selected title has several sources. The client rejects sources above the device quality ceiling and those missing the preferred audio language, ranks the remaining sources by quality and availability, applies preferred subtitles when present, and starts the best match.

### Automatic source failure

The best source fails to start. The client tries each remaining matching source in rank order. When all fail, it opens the full source list and marks the attempted sources.

### Scheduled autoplay

At 21:59 in Scheduled mode, the next episode may autoplay. At 22:00 or later it waits for user action. Scheduled autoplay becomes eligible again at 07:00.

### Multi-profile isolation

Two profiles use the same Stremio account and addon configuration. Their Saved collections, progress, history, preferences, feedback, and recommendations remain independent and synchronize across authorized tailnet clients.

## Deliberately flexible implementation decisions

- Project name and branding assets.
- The recommendation model or ranking algorithm.
- Whether theme persistence is per device or per profile.
- The framework and packaging strategy used to share code across webOS and Android packages.
- The exact mapping of addon-specific availability metadata into a common ranking signal.

