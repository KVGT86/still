# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Still is primarily for one household using Stremio across an LG TV, an Android TV, an Android tablet and Linux computers. A single Stremio-backed profile must remain simple; households that want separate profiles connect a private Still service.

## Product Purpose

Still is a polished, uncluttered Stremio client with a light-first interface. It preserves configured Stremio addons and library data while making browsing, source choice, playback and household profiles feel coherent across the user's devices. Success means playback is at least as reliable as Stremio, preferences follow the active profile, and the interface remains calm at TV distance.

## Positioning

Still is a client and personal presentation layer over a user's existing Stremio ecosystem. It neither supplies nor promotes content sources. Its differentiator is one considered interface with profile-aware preferences, source transparency and self-hosted household continuity.

## Operating Context

The app is operated in landscape with a TV remote, LG Magic Remote, touch or keyboard. It is usually online. Torrent sources use a reachable Stremio streaming engine on the local network or Tailnet. A private Still service stores multi-profile state and is expected to use minimal storage.

## Capabilities and Constraints

- Continue Watching is the home view, followed by Recommended, Search, Saved and Settings.
- A profile remembers its theme, language, subtitle, autoplay and interface-sound preferences.
- Autoplay may be scheduled from 7 am until 10 pm.
- Playback uses the built-in player and must expose every source for manual selection.
- Automatic selection favours compatible quality, the preferred language, healthy peers and past reliability while never hiding manual choices.
- Audio is mandatory; subtitles are optional and must not delay playback.
- Playback marks a title complete at 95% and shows Continue Watching after 2%.
- One profile can rely on Stremio. Multiple profiles require the self-hosted Still service and sync across connected devices.
- Distribution is by sideloading. Still does not provide illegal torrents or content.
- British spelling is required in user-facing and repository prose. Em dashes are not used.

## Brand Commitments

The product name is “still.” with an inverted light squircle and green mark used consistently for the app icon. The interface is Apple-influenced, light-first and supports a full dark theme. Rewa branding must not appear.

## Evidence on Hand

The repository contains the shipping web client, Electron Linux wrapper, Android TV/tablet wrapper, webOS package, self-hosted profile service, tests, generated application icons and installation documentation. No commercial claims, supplied content catalogue or third-party endorsements are available and none should be fabricated.

## Product Principles

- Playback reliability outranks visual novelty.
- Keep the common path quiet while making source and health detail available on demand.
- Explain automatic choices and preserve manual control.
- Store only profile state and operational metadata, never media.
- Make failure recoverable without losing watch position.

## Accessibility & Inclusion

Controls must work by remote, keyboard and touch, expose screen-reader names, retain visible focus, avoid colour-only status, honour reduced motion and allow profile-scoped text size and contrast preferences.
