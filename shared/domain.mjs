export const defaults = {
  theme: "light",
  interfaceSounds: false,
  audio: "en",
  subtitle: "en",
  subtitles: true,
  autoplay: "scheduled",
  maxQuality: 2160,
  maxBitrate: 0,
  audioPassthrough: false,
  frameRateMatching: true,
  autoSourceSwitch: true,
  subtitleOffset: 0,
  textScale: 1,
  reducedMotion: false,
  highContrastFocus: false,
  continueFilter: "all",
  sourceSort: "smart",
};
export function themeAtTime(mode, date = new Date()) {
  if (mode === "dark") return "dark";
  if (mode !== "scheduled") return "light";
  const hour = date.getHours();
  return hour >= 7 && hour < 19 ? "light" : "dark";
}
export function blankState() {
  return {
    saved: {},
    progress: {},
    feedback: {},
    sourceHistory: {},
    devices: {},
    collections: {},
    settings: { ...defaults },
    settingsAt: 0,
  };
}
export function compactMeta(meta) {
  const {
    id,
    type,
    name,
    poster,
    background,
    genres,
    releaseInfo,
    imdbRating,
    runtime,
  } = meta;
  return {
    id,
    type,
    name,
    poster,
    background,
    genres,
    releaseInfo,
    imdbRating,
    runtime,
  };
}
export function autoplayAllowed(mode, date = new Date()) {
  return (
    mode === "on" ||
    (mode === "scheduled" && date.getHours() >= 7 && date.getHours() < 22)
  );
}
export function languageCode(value = "") {
  const code = String(value).toLowerCase().trim();
  return (
    {
      eng: "en",
      english: "en",
      fra: "fr",
      fre: "fr",
      french: "fr",
      spa: "es",
      spanish: "es",
      deu: "de",
      ger: "de",
      german: "de",
      ita: "it",
      italian: "it",
      jpn: "ja",
      japanese: "ja",
      kor: "ko",
      korean: "ko",
      hin: "hi",
      hindi: "hi",
      por: "pt",
      portuguese: "pt",
      rus: "ru",
      russian: "ru",
      zho: "zh",
      chi: "zh",
      chinese: "zh",
      ara: "ar",
      arabic: "ar",
    }[code] || code.split("-")[0]
  );
}
export function sourceInfo(stream) {
  const text = [
    stream.name,
    stream.title,
    stream.description,
    stream.behaviorHints?.filename,
    stream.quality,
    stream.videoCodec,
    stream.videoCodecs,
    stream.audioCodec,
    stream.audioCodecs,
  ]
    .filter(Boolean)
    .join(" ");
  const quality =
    Number(stream.quality) ||
    (/2160|4k|uhd/i.test(text)
      ? 2160
      : /1080/.test(text)
        ? 1080
        : /720/.test(text)
          ? 720
          : /480/.test(text)
            ? 480
            : 0);
  const supplied = stream.languages || stream.audioLanguages || [];
  const languages = (
    Array.isArray(supplied)
      ? supplied
      : typeof supplied === "string"
        ? supplied.split(/[,\s]+/)
        : []
  ).map(languageCode);
  for (const [flag, code] of Object.entries({
    "🇬🇧": "en",
    "🇺🇸": "en",
    "🇫🇷": "fr",
    "🇪🇸": "es",
    "🇩🇪": "de",
    "🇮🇹": "it",
    "🇯🇵": "ja",
    "🇰🇷": "ko",
    "🇮🇳": "hi",
    "🇵🇹": "pt",
    "🇷🇺": "ru",
    "🇨🇳": "zh",
  }))
    if (text.includes(flag)) languages.push(code);
  for (const [word, code] of Object.entries({
    english: "en",
    eng: "en",
    french: "fr",
    fra: "fr",
    spanish: "es",
    spa: "es",
    german: "de",
    deu: "de",
    italian: "it",
    ita: "it",
    japanese: "ja",
    jpn: "ja",
    korean: "ko",
    kor: "ko",
    hindi: "hi",
    hin: "hi",
    portuguese: "pt",
    por: "pt",
    russian: "ru",
    rus: "ru",
    chinese: "zh",
    zho: "zh",
    arabic: "ar",
    ara: "ar",
  }))
    if (new RegExp("\\b" + word + "\\b", "i").test(text)) languages.push(code);
  const peers = Number(
    stream.seeders ??
      stream.peers ??
      text.match(/(?:👤|👥|seeders?\s*[:=]?|peers?\s*[:=]?)\s*(\d+)/i)?.[1] ??
      0,
  );
  const size = Number(
    stream.size ??
      stream.behaviorHints?.videoSize ??
      text.match(/([\d.]+)\s*(GB|MB)\b/i)?.[1] ??
      0,
  );
  const sizeUnit = text.match(/[\d.]+\s*(GB|MB)\b/i)?.[1]?.toUpperCase();
  const sizeBytes =
    sizeUnit === "GB"
      ? size * 1024 ** 3
      : sizeUnit === "MB"
        ? size * 1024 ** 2
        : size > 1024 ** 2
          ? size
          : 0;
  const bitrate = Number(stream.bitrate || 0);
  const hdr = /dolby[ .-]?vision|\bdv\b/i.test(text)
    ? "Dolby Vision"
    : /hdr10\+/i.test(text)
      ? "HDR10+"
      : /hdr10|\bhdr\b/i.test(text)
        ? "HDR10"
        : "";
  const videoCodec = /\b(?:av1|av01)\b/i.test(text)
    ? "av1"
    : /\b(?:h[ .-]?265|hevc|x265)\b/i.test(text)
      ? "hevc"
      : /\b(?:vp[ .-]?9|vp09)\b/i.test(text)
        ? "vp9"
        : /\b(?:h[ .-]?264|avc|x264)\b/i.test(text)
          ? "h264"
          : "";
  const audioCodec = /\b(?:true[ .-]?hd)\b/i.test(text)
    ? "truehd"
    : /\b(?:dts(?:[ .-]?hd)?|dts:x)\b/i.test(text)
      ? "dts"
      : /\b(?:e[ .-]?ac[ .-]?3|ddp|dd\+)\b/i.test(text)
        ? "eac3"
        : /\b(?:ac[ .-]?3|dolby digital)\b/i.test(text)
          ? "ac3"
          : /\baac\b/i.test(text)
            ? "aac"
            : "";
  return {
    quality,
    languages: [...new Set(languages)],
    peers,
    videoCodec,
    audioCodec,
    sizeBytes,
    bitrate,
    hdr,
    provider: String(stream.name || "Unknown provider")
      .split(/[\n|]/)[0]
      .trim(),
  };
}
const MIN_HEALTHY_PEERS = 15;
export function sourceCompatibility(info, codecSupport = {}) {
  const codecs = [info.videoCodec, info.audioCodec].filter(Boolean);
  if (!codecs.length || !Object.keys(codecSupport).length) return 1;
  return Math.min(...codecs.map((codec) => codecSupport[codec] ?? 1));
}
export function sourceHistoryKey(stream) {
  const info = sourceInfo(stream);
  return [
    info.provider,
    info.videoCodec || "unknown-video",
    info.audioCodec || "unknown-audio",
    info.quality || "unknown-quality",
  ]
    .join(":")
    .toLowerCase();
}
export function sourceCompatibilityParts(info, codecSupport = {}) {
  return {
    video: info.videoCodec ? (codecSupport[info.videoCodec] ?? 1) : 1,
    audio: info.audioCodec ? (codecSupport[info.audioCodec] ?? 1) : 1,
  };
}
export function rankSources(
  streams,
  audio,
  maxQuality,
  codecSupport = {},
  history = {},
  options = {},
) {
  // Unknown resolution cannot prove the quality ceiling; keep it for manual selection.
  // Language never excludes a source (add-ons rarely tag it); sources clearly in another language go last.
  const wanted = languageCode(audio);
  const foreign = (s) =>
    s.info.languages.length > 0 && !s.info.languages.includes(wanted);
  const healthy = (s) => s.info.peers >= MIN_HEALTHY_PEERS;
  const compatibility = (s) => sourceCompatibility(s.info, codecSupport);
  const reliability = (s) => {
    const h = history[sourceHistoryKey(s)] || {};
    return (
      Number(h.successes || 0) * 3 -
      Number(h.failures || 0) * 5 -
      Number(h.stalls || 0)
    );
  };
  const oversized = (s) =>
    Number(options.maxBitrate || 0) > 0 &&
    Number(s.info.bitrate || 0) > Number(options.maxBitrate);
  return streams
    .map((s, i) => ({ ...s, key: s.key || String(i), info: sourceInfo(s) }))
    .filter((s) => s.info.quality > 0 && s.info.quality <= maxQuality)
    .sort(
      (a, b) =>
        foreign(a) - foreign(b) ||
        (compatibility(a) === 0) - (compatibility(b) === 0) ||
        oversized(a) - oversized(b) ||
        (options.sort === "size"
          ? Number(a.info.sizeBytes || 0) - Number(b.info.sizeBytes || 0)
          : options.sort === "peers"
            ? b.info.peers - a.info.peers
            : options.sort === "quality"
              ? b.info.quality - a.info.quality
              : reliability(b) - reliability(a)) ||
        healthy(b) - healthy(a) ||
        compatibility(b) - compatibility(a) ||
        b.info.quality - a.info.quality ||
        b.info.peers - a.info.peers,
    );
}
export function mergeState(current, incoming) {
  const next = {
    ...blankState(),
    ...current,
    settings: { ...defaults, ...current.settings },
  };
  // Return `current` itself when nothing is newer, so callers can skip saving and redrawing.
  let changed =
    !current.settings ||
    Object.keys(defaults).some((k) => !(k in current.settings)) ||
    [
      "saved",
      "progress",
      "feedback",
      "sourceHistory",
      "devices",
      "collections",
      "settingsAt",
    ].some((k) => !(k in current));
  for (const field of [
    "saved",
    "progress",
    "feedback",
    "sourceHistory",
    "devices",
    "collections",
  ]) {
    next[field] = { ...next[field] };
    for (const [key, item] of Object.entries(incoming[field] || {}))
      if (
        item &&
        Number(item.updatedAt) > Number(next[field][key]?.updatedAt || 0)
      ) {
        next[field][key] = item;
        changed = true;
      }
  }
  if (Number(incoming.settingsAt) > Number(next.settingsAt)) {
    next.settings = { ...defaults, ...next.settings, ...incoming.settings };
    next.settingsAt = incoming.settingsAt;
    changed = true;
  }
  return changed ? next : current;
}
// Titles touched since the last Stremio library write; everything else is left alone.
export function changedMetas(state, since) {
  const metas = new Map();
  for (const field of ["saved", "progress", "feedback"])
    for (const v of Object.values(state[field]))
      if (v.updatedAt > since) metas.set(v.meta.id, v.meta);
  return [...metas.values()];
}
export function sourceReason(stream, audio, codecSupport = {}, history = {}) {
  const info = sourceInfo(stream);
  const parts = sourceCompatibilityParts(info, codecSupport);
  const past = history[sourceHistoryKey(stream)] || {};
  if (parts.video === 0) return "Video codec is not supported on this device";
  if (parts.audio === 0) return "Audio codec is not supported on this device";
  if (past.failures > past.successes)
    return "Previously unreliable on your devices";
  if (past.successes)
    return `Worked ${past.successes} time${past.successes === 1 ? "" : "s"} before`;
  if (info.languages.length && info.languages.includes(languageCode(audio)))
    return "Matches your audio language";
  if (info.peers >= MIN_HEALTHY_PEERS) return "Healthy peer availability";
  return "Best available match for this device";
}
export function recordSourceResult(state, stream, result, now = Date.now()) {
  const key = sourceHistoryKey(stream);
  const old = state.sourceHistory?.[key] || {};
  return {
    ...state,
    sourceHistory: {
      ...(state.sourceHistory || {}),
      [key]: {
        successes: Number(old.successes || 0) + (result === "success" ? 1 : 0),
        failures: Number(old.failures || 0) + (result === "failure" ? 1 : 0),
        stalls: Number(old.stalls || 0) + (result === "stall" ? 1 : 0),
        updatedAt: now,
      },
    },
  };
}
export function newEpisodesFromSaved(state, now = Date.now()) {
  return Object.values(state.saved)
    .filter((item) => !item.deleted && item.meta.type === "series")
    .flatMap((item) =>
      releasedEpisodes({ ...item.meta, videos: item.episodes || [] }, now)
        .filter((episode) => !state.progress[episode.id]?.completed)
        .slice(-1)
        .map((episode) => ({ meta: item.meta, episode })),
    );
}
export function recentlyReleasedSaved(state, now = Date.now()) {
  const floor = now - 90 * 86400000;
  return Object.values(state.saved)
    .filter((item) => {
      if (item.deleted) return false;
      const year = Number(
        String(item.meta.releaseInfo || "").match(/\d{4}/)?.[0],
      );
      return year && year >= new Date(floor).getFullYear();
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((item) => item.meta);
}
export function releasedEpisodes(meta, now = Date.now()) {
  return (meta.videos || [])
    .filter(
      (v) => v.season > 0 && (!v.released || Date.parse(v.released) <= now),
    )
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
}
export function nextEpisode(meta, videoId, progress) {
  const videos = releasedEpisodes(meta);
  const index = videos.findIndex((v) => v.id === videoId);
  return index < 0
    ? undefined
    : videos.slice(index + 1).find((v) => !progress[v.id]?.completed);
}
export function continueItems(state) {
  return Object.values(state.progress)
    .filter(
      (p) =>
        !p.hidden &&
        !p.completed &&
        (p.queued ||
          (p.duration > 0 &&
            p.position / p.duration >= 0.02 &&
            p.position / p.duration < 0.95)),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
export function recordProgress(
  state,
  meta,
  videoId,
  position,
  duration,
  now = Date.now(),
) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position))
    return state;
  const old = state.progress[videoId];
  const completed = position / duration >= 0.95 || !!old?.completed;
  const progress = {
    ...state.progress,
    [videoId]: {
      meta: compactMeta(meta),
      videoId,
      position,
      duration,
      completed,
      hidden: old?.hidden || false,
      updatedAt: now,
    },
  };
  if (completed && meta.type === "series") {
    const next = nextEpisode(meta, videoId, progress);
    if (next && !progress[next.id])
      progress[next.id] = {
        meta: compactMeta(meta),
        videoId: next.id,
        position: 0,
        duration: 0,
        completed: false,
        hidden: false,
        queued: true,
        updatedAt: now,
      };
  }
  return { ...state, progress };
}
export function recommend(metas, state) {
  const affinities = {};
  for (const signal of Object.values(state.feedback))
    if (signal.value === "more")
      for (const genre of signal.meta.genres || [])
        affinities[genre] = (affinities[genre] || 0) + 3;
  for (const p of Object.values(state.progress))
    if (p.completed)
      for (const genre of p.meta.genres || [])
        affinities[genre] = (affinities[genre] || 0) + 1;
  const finished = new Set(
    Object.values(state.progress)
      .filter((p) => p.completed)
      .map((p) => p.meta.id),
  );
  return metas
    .filter(
      (m) =>
        !["hide", "watched"].includes(state.feedback[m.id]?.value) &&
        !(m.type === "movie" && finished.has(m.id)),
    )
    .map((m, i) => ({
      m,
      score:
        (m.genres || []).reduce((n, g) => n + (affinities[g] || 0), 0) +
        1 / (i + 1),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}
