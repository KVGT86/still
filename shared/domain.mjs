export const defaults = {
  theme: "light",
  audio: "en",
  subtitle: "en",
  subtitles: true,
  autoplay: "scheduled",
};
export function blankState() {
  return {
    saved: {},
    progress: {},
    feedback: {},
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
  return { quality, languages: [...new Set(languages)], peers };
}
export function rankSources(streams, audio, maxQuality) {
  // Unknown language/resolution cannot prove mandatory constraints; keep it for manual selection.
  return streams
    .map((s, i) => ({ ...s, key: s.key || String(i), info: sourceInfo(s) }))
    .filter(
      (s) =>
        s.info.quality > 0 &&
        s.info.quality <= maxQuality &&
        s.info.languages.includes(languageCode(audio)),
    )
    .sort(
      (a, b) => b.info.quality - a.info.quality || b.info.peers - a.info.peers,
    );
}
export function mergeState(current, incoming) {
  const next = {
    ...blankState(),
    ...current,
    settings: { ...defaults, ...current.settings },
  };
  for (const field of ["saved", "progress", "feedback"]) {
    next[field] = { ...next[field] };
    for (const [key, item] of Object.entries(incoming[field] || {}))
      if (
        item &&
        Number(item.updatedAt) > Number(next[field][key]?.updatedAt || 0)
      )
        next[field][key] = item;
  }
  if (Number(incoming.settingsAt) > Number(next.settingsAt)) {
    next.settings = { ...defaults, ...next.settings, ...incoming.settings };
    next.settingsAt = incoming.settingsAt;
  }
  return next;
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
  return metas
    .filter(
      (m) =>
        !["hide", "watched"].includes(state.feedback[m.id]?.value) &&
        !Object.values(state.progress).some(
          (p) => p.meta.id === m.id && p.completed && m.type === "movie",
        ),
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
