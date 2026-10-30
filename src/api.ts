import type { Addon, Meta, ProfileState, Session, Stream } from "./types";
import { blankState, compactMeta, languageCode } from "../shared/domain.mjs";
import WatchedBitfield from "stremio-watched-bitfield";
let catalogAuth = "";
let addonCache: Addon[] = [];
const metaCache = new Map<string, Meta>();
export async function json(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: init.signal || AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Connection failed (${response.status})`);
  return response.json();
}
export async function stremio(method: string, body: Record<string, unknown>) {
  const data = await json(`https://api.strem.io/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (data.error) {
    const error = new Error(data.error.message || "Stremio request failed");
    if (
      [1, 2].includes(data.error.code) ||
      /auth|session|logged/i.test(error.message)
    )
      window.dispatchEvent(new Event("stremio-auth-expired"));
    throw error;
  }
  return data.result;
}
export async function login(email: string, password: string): Promise<Session> {
  return stremio("login", { type: "Login", email, password, facebook: false });
}
export async function linkCreate() {
  const data = await json("https://link.stremio.com/api/v2/create?type=Create");
  if (data.error) throw new Error(data.error.message);
  return data.result;
}
export async function linkRead(code: string) {
  const data = await json(
    `https://link.stremio.com/api/v2/read?type=Read&code=${encodeURIComponent(code)}`,
  );
  return data.result?.authKey;
}
export async function sessionFromKey(authKey: string): Promise<Session> {
  const user = await stremio("getUser", { authKey });
  return { authKey, user };
}
export async function loadAddons(authKey: string): Promise<Addon[]> {
  const result = await stremio("addonCollectionGet", { authKey, update: true });
  const list = result.addons || result || [];
  if (catalogAuth !== authKey) metaCache.clear();
  catalogAuth = authKey;
  addonCache = Array.isArray(list)
    ? list.filter(
        (a) =>
          a &&
          typeof a.transportUrl === "string" &&
          a.manifest &&
          Array.isArray(a.manifest.resources),
      )
    : [];
  return addonCache;
}
export async function resource(
  addon: Addon,
  name: string,
  type: string,
  id: string,
  extra = "",
) {
  const url = addon.transportUrl.replace(/\/manifest\.json(?:\?.*)?$/, "");
  return json(
    `${url}/${name}/${encodeURIComponent(type)}/${encodeURIComponent(id)}${extra ? "/" + extra : ""}.json`,
  );
}
function supports(addon: Addon, name: string, type: string, id = "") {
  return (addon.manifest.resources || []).some((r) =>
    typeof r === "string"
      ? r === name
      : r.name === name &&
        (!r.types || r.types.includes(type)) &&
        (!r.idPrefixes || r.idPrefixes.some((p) => id.startsWith(p))),
  );
}
export async function catalogs(
  addons: Addon[],
  query?: string,
): Promise<Meta[]> {
  const requests = addons.flatMap((a) =>
    (a.manifest.catalogs || [])
      .filter(
        (c) =>
          ["movie", "series"].includes(c.type) &&
          (query
            ? c.extra?.some((e) => e.name === "search")
            : !c.extra?.some((e) => e.isRequired)),
      )
      .map((c) =>
        resource(
          a,
          "catalog",
          c.type,
          c.id,
          query ? `search=${encodeURIComponent(query)}` : "",
        ),
      ),
  );
  const settled = await Promise.allSettled(requests);
  const unique = new Map<string, Meta>();
  for (const r of settled)
    if (r.status === "fulfilled")
      for (const m of r.value.metas || [])
        if (["movie", "series"].includes(m.type)) unique.set(m.id, m);
  return [...unique.values()];
}
export async function details(addons: Addon[], meta: Meta): Promise<Meta> {
  const results = await Promise.allSettled(
    addons
      .filter((a) => supports(a, "meta", meta.type, meta.id))
      .map((a) => resource(a, "meta", meta.type, meta.id)),
  );
  const found = results.find(
    (r): r is PromiseFulfilledResult<any> =>
      r.status === "fulfilled" &&
      r.value.meta &&
      typeof r.value.meta.name === "string",
  );
  const value = found ? { ...meta, ...found.value.meta } : meta;
  metaCache.set(meta.id, value);
  return value;
}
export async function streams(
  addons: Addon[],
  type: string,
  id: string,
): Promise<Stream[]> {
  const results = await Promise.allSettled(
    addons
      .filter((a) => supports(a, "stream", type, id))
      .map((a) => resource(a, "stream", type, id)),
  );
  return results.flatMap((r, a) =>
    r.status === "fulfilled"
      ? (r.value.streams || []).map((s: any, i: number) => ({
          ...s,
          key: `${a}:${i}`,
        }))
      : [],
  );
}
export async function subtitles(addons: Addon[], type: string, id: string) {
  const results = await Promise.allSettled(
    addons
      .filter((a) => supports(a, "subtitles", type, id))
      .map((a) => resource(a, "subtitles", type, id)),
  );
  return results.flatMap((r) =>
    r.status === "fulfilled" ? r.value.subtitles || [] : [],
  );
}
export async function readLibrary(authKey: string) {
  const items =
    (await stremio("datastoreGet", {
      authKey,
      collection: "libraryItem",
      all: true,
      ids: [],
    })) || [];
  if (!Array.isArray(items))
    throw new Error("Unexpected library response from Stremio.");
  if (catalogAuth !== authKey) await loadAddons(authKey);
  await Promise.allSettled(
    items
      .filter(
        (i) => i.type === "series" && i.state?.watched && !metaCache.has(i._id),
      )
      .map((i) =>
        details(addonCache, {
          id: i._id,
          type: i.type,
          name: i.name,
          poster: i.poster,
        }),
      ),
  );
  return items;
}
export function importLibrary(items: any[]): ProfileState {
  const state = blankState() as ProfileState;
  for (const item of items) {
    if (!["movie", "series"].includes(item.type)) continue;
    const meta: Meta = metaCache.get(item._id) || {
      id: item._id,
      type: item.type,
      name: item.name,
      poster: item.poster,
    };
    const updatedAt = Date.parse(item._mtime) || Date.now();
    const snapshot = compactMeta(meta);
    state.saved[meta.id] = {
      meta: snapshot,
      deleted: !!item.removed || !!item.temp,
      updatedAt,
    };
    const s = item.state || {};
    if (s.watched && meta.videos?.length) {
      const videos = meta.videos
        .slice()
        .sort((a, b) => a.season - b.season || a.episode - b.episode);
      try {
        const bits = WatchedBitfield.constructAndResize(
          s.watched,
          videos.map((v) => v.id),
        );
        for (const v of videos)
          if (bits.getVideo(v.id))
            state.progress[v.id] = {
              meta: snapshot,
              videoId: v.id,
              position: 0,
              duration: 0,
              completed: true,
              hidden: true,
              updatedAt,
            };
      } catch {
        /* Preserve malformed remote bitfields; do not infer watched episodes. */
      }
    }
    if (s.timeOffset > 0 || s.timesWatched > 0) {
      const videoId = s.video_id || meta.id;
      state.progress[videoId] = {
        meta: snapshot,
        videoId,
        position: (s.timeOffset || 0) / 1000,
        duration: (s.duration || 0) / 1000,
        completed:
          !!state.progress[videoId]?.completed ||
          (s.duration > 0
            ? s.timeOffset / s.duration >= 0.95
            : !!s.timesWatched),
        hidden: false,
        queued: s.timeOffset === 1 && !s.duration,
        updatedAt,
      };
    }
  }
  return state;
}
export function libraryChange(meta: Meta, state: ProfileState, original: any) {
  const saved = state.saved[meta.id] && !state.saved[meta.id].deleted;
  const p = Object.values(state.progress)
    .filter((p) => p.meta.id === meta.id)
    .sort(
      (a, b) =>
        b.updatedAt - a.updatedAt || Number(!!b.queued) - Number(!!a.queued),
    )[0];
  const videos = (
    meta.videos ||
    metaCache.get(meta.id)?.videos ||
    p?.meta.videos ||
    []
  )
    .slice()
    .sort((a, b) => a.season - b.season || a.episode - b.episode)
    .map((v) => v.id);
  let watched = original?.state?.watched;
  if (videos.length) {
    let bits;
    try {
      bits = watched
        ? WatchedBitfield.constructAndResize(watched, videos)
        : WatchedBitfield.constructFromArray([], videos);
    } catch {
      bits = WatchedBitfield.constructFromArray([], videos);
    }
    for (const entry of Object.values(state.progress))
      if (entry.meta.id === meta.id && entry.completed)
        bits.setVideo(entry.videoId, true);
    watched = bits.serialize();
  }
  return {
    ...original,
    _id: meta.id,
    name: meta.name,
    type: meta.type,
    poster: meta.poster || null,
    posterShape: "poster",
    removed: !saved,
    temp: !saved,
    _ctime: original?._ctime || new Date().toISOString(),
    _mtime: new Date().toISOString(),
    state: {
      timeOffset: 0,
      timeWatched: 0,
      overallTimeWatched: 0,
      timesWatched: 0,
      flaggedWatched: 0,
      duration: 0,
      ...original?.state,
      ...(watched ? { watched } : {}),
      ...(p
        ? {
            timeOffset:
              p.hidden || p.completed
                ? 0
                : p.queued
                  ? 1
                  : Math.round(p.position * 1000),
            duration: Math.round(p.duration * 1000),
            video_id: p.videoId,
            timesWatched: p.completed ? 1 : 0,
            flaggedWatched: p.completed ? 1 : 0,
            lastWatched: new Date().toISOString(),
          }
        : {}),
    },
  };
}
export async function writeLibrary(authKey: string, changes: any[]) {
  return stremio("datastorePut", {
    authKey,
    collection: "libraryItem",
    changes,
  });
}
export function safeBase(url: string) {
  const u = new URL(url);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new Error("Use a plain HTTP or HTTPS server address.");
  return u.href.replace(/\/$/, "");
}
export function playUrl(stream: Stream, server: string) {
  if (stream.infoHash) {
    if (!server)
      throw new Error(
        "This source needs a Stremio streaming server. Set its address in Settings.",
      );
    return `${safeBase(server)}/${encodeURIComponent(stream.infoHash)}/${stream.fileIdx ?? 0}`;
  }
  if (!stream.url || !/^https?:\/\//i.test(stream.url))
    throw new Error("This source cannot be played by the built-in player.");
  if (stream.behaviorHints?.proxyHeaders?.request && !window.StillNative)
    throw new Error(
      "This source requires request headers. Choose another source or use Android.",
    );
  return stream.url;
}
export async function companion(
  base: string,
  path: string,
  token: string,
  body?: unknown,
  profileToken?: string,
) {
  return json(`${safeBase(base)}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(profileToken ? { "X-Profile-Token": profileToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export { languageCode };
