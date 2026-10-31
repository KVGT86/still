import "./polyfills";
import appIcon from "./assets/app-icon.svg";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Addon,
  Episode,
  Meta,
  Profile,
  Progress,
  ProfileState,
  Session,
  Stream,
} from "./types";
import * as api from "./api";
import {
  blankState,
  continueItems,
  compactMeta,
  nextEpisode,
  rankSources,
  recommend,
  recordProgress,
  releasedEpisodes,
  sourceInfo,
} from "../shared/domain.mjs";
import { readLocal, useProfileStore } from "./store";
import { Player } from "./Player";
import { LoadScreen } from "./LoadScreen";
import { Icon, Avatar, avatarOptions, type IconName } from "./Icon";
import "./style.css";
const demoMeta: Meta = {
  id: "still-demo",
  type: "movie",
  name: "Big Buck Bunny",
  description:
    "Big Buck Bunny, the open movie from the Blender Foundation. Preview playback without signing in.",
  genres: ["Animation", "Comedy"],
  releaseInfo: "2008",
  runtime: "10 min",
  poster: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg",
  background:
    "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg",
};
const demoSource: Stream = {
  key: "demo",
  name: "Blender Foundation",
  title: "480p · English",
  url: "https://media.w3.org/2010/05/bunny/movie.mp4",
  quality: 480,
  languages: ["en"],
};
const icons: Record<string, IconName> = {
  Home: "home",
  Recommended: "sparkles",
  Search: "search",
  Saved: "saved",
  Settings: "settings",
};
const languages = [
  ["en", "English"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["de", "German"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["hi", "Hindi"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["zh", "Chinese"],
  ["ar", "Arabic"],
];
function detectedQuality() {
  if (window.StillNative) return window.StillNative.maxQuality();
  let width = screen.width * devicePixelRatio;
  try {
    width =
      JSON.parse(window.PalmSystem?.deviceInfo || "{}").screenWidth || width;
  } catch {}
  return width >= 3840 ? 2160 : width >= 1920 ? 1080 : 720;
}
function ContinueCard({
  item,
  variant = "standard",
  disabled,
  onPlay,
  onRemove,
}: {
  item: Progress;
  variant?: "featured" | "recent" | "standard";
  disabled: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const remaining = item.duration
    ? `${Math.max(1, Math.ceil((item.duration - item.position) / 60))} min remaining`
    : "Up next";
  return (
    <article className={`continue-card ${variant}`}>
      <button
        className="art-button"
        disabled={disabled}
        onClick={onPlay}
        aria-label={`Continue ${item.meta.name}`}
      >
        {(item.meta.background || item.meta.poster) && (
          <img
            src={item.meta.background || item.meta.poster}
            alt=""
            loading={variant === "featured" ? "eager" : "lazy"}
            decoding="async"
          />
        )}
        <div className="art-shade" />
        <span className="media-label">
          {item.meta.type === "series" ? "SERIES" : "FILM"}
        </span>
        <span className="art-play">
          <Icon name="play" size={variant === "recent" ? 16 : 20} />
        </span>
        {item.queued && <span className="new-episode">NEXT EPISODE</span>}
        <div className="art-title">
          <span>
            {item.meta.genres?.slice(0, 2).join(" / ") ||
              (item.meta.type === "series" ? "Series" : "Film")}
          </span>
          <h2>{item.meta.name}</h2>
        </div>
        <div className="progress-line">
          <span
            style={{
              width: `${Math.max(2, (item.position / (item.duration || 1)) * 100)}%`,
            }}
          />
        </div>
      </button>
      <div className="card-caption">
        <div>
          <strong>
            {item.queued
              ? "Next episode"
              : item.meta.type === "series"
                ? item.videoId.split(":").length > 2
                  ? "Episode " + item.videoId.split(":").at(-1)
                  : "Continue episode"
                : "Continue film"}
          </strong>
          <small>{remaining}</small>
        </div>
        <button
          className="text-button remove"
          aria-label={`Remove ${item.meta.name} from Continue Watching`}
          onClick={onRemove}
        >
          <Icon name="close" size={15} />
          <span>Remove</span>
        </button>
      </div>
    </article>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(
      readLocal("still.session", null),
    ),
    [demo, setDemo] = useState(false),
    [active, setActive] = useState<Profile | null>(null),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [profileToken, setProfileToken] = useState("");
  const [service, setService] = useState(readLocal("still.service", "")),
    [serviceToken, setServiceToken] = useState(
      readLocal("still.serviceToken", ""),
    );
  const [page, setPage] = useState("Home"),
    [quality, setQuality] = useState(
      readLocal("still.quality", detectedQuality()),
    ),
    [streamingServer, setStreamingServer] = useState(
      readLocal("still.streamingServer", ""),
    );
  const { state, update, syncStatus } = useProfileStore(
    session,
    service,
    serviceToken,
    active?.id || "",
    profileToken,
  );
  const [demoState, setDemoState] = useState<ProfileState>(blankState());
  const data = demo ? demoState : state;
  const change = (fn: (s: ProfileState) => ProfileState) =>
    demo ? setDemoState(fn) : update(fn);
  const [addons, setAddons] = useState<Addon[]>([]),
    [catalog, setCatalog] = useState<Meta[]>([]),
    [search, setSearch] = useState(""),
    [results, setResults] = useState<Meta[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<Meta | null>(null),
    [season, setSeason] = useState(1),
    [resolving, setResolving] = useState(false),
    [loadTitle, setLoadTitle] = useState<Meta | null>(null),
    [stage, setStage] = useState({ label: "", floor: 0, ceil: 0.3 });
  const [sources, setSources] = useState<{
      meta: Meta;
      videoId: string;
      items: Stream[];
      failed: string[];
      message?: string;
    } | null>(null),
    [play, setPlay] = useState<{
      meta: Meta;
      videoId: string;
      source: Stream;
      url: string;
      tracks: any[];
      auto: Stream[];
      all: Stream[];
      failed: string[];
    } | null>(null);
  const [dialog, setDialog] = useState<
      "create" | "edit" | "unlock" | "service" | null
    >(null),
    [target, setTarget] = useState<Profile | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    const highlight = (event: PointerEvent) => {
      const element = (event.target as Element)?.closest<HTMLElement>(
        "nav button,.account,.segmented,.modal,.player-options",
      );
      if (!element) return;
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--glass-x", `${event.clientX - rect.left}px`);
      element.style.setProperty("--glass-y", `${event.clientY - rect.top}px`);
    };
    window.addEventListener("pointermove", highlight, { passive: true });
    return () => window.removeEventListener("pointermove", highlight);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);
  useEffect(() => {
    const expired = () => {
      setSession(null);
      setActive(null);
      setError(
        "Your Stremio session expired. Sign in again; your profiles are preserved.",
      );
    };
    window.addEventListener("stremio-auth-expired", expired);
    return () => window.removeEventListener("stremio-auth-expired", expired);
  }, []);
  async function refreshProfiles() {
    if (!session) return;
    if (!service) {
      setProfiles([
        {
          id: "single",
          name: session.user.email?.split("@")[0] || "You",
          avatar: "◒",
          locked: false,
        },
      ]);
      return;
    }
    try {
      setProfiles(await api.companion(service, "/profiles", serviceToken));
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    if (!session) return;
    void refreshProfiles();
    let alive = true;
    setLoading(true);
    api
      .loadAddons(session.authKey)
      .then(async (a) => {
        if (!alive) return;
        setAddons(a);
        const titles = await api.catalogs(a);
        if (alive) setCatalog(titles);
      })
      .catch((e) => setError(message(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session?.authKey, service, serviceToken]);
  useEffect(() => {
    if (page !== "Search") return;
    let alive = true;
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      (demo
        ? Promise.resolve(
            [demoMeta].filter((m) =>
              m.name.toLowerCase().includes(search.toLowerCase()),
            ),
          )
        : api.catalogs(addons, search.trim())
      )
        .then((r) => {
          if (alive) setResults(r);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, page, addons, demo]);
  useEffect(() => {
    const root =
      document.querySelector('[role="dialog"]') ||
      document.querySelector("main");
    (root?.querySelector("button,input,select") as HTMLElement)?.focus();
  }, [page, dialog, detail, active, sources]);
  useEffect(() => {
    const remote = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement;
      const form =
        el?.tagName === "INPUT" &&
        !["range", "checkbox"].includes((el as HTMLInputElement).type);
      if (
        (e.key === "Escape" ||
          e.key === "Backspace" ||
          e.key === "GoBack" ||
          e.keyCode === 461) &&
        !form
      ) {
        e.preventDefault();
        if (resolving) cancelLoad();
        else if (play) setPlay(null);
        else if (sources) {
          setSources(null);
          requestId.current++;
        } else if (dialog) setDialog(null);
        else if (detail) setDetail(null);
        else if (page !== "Home") setPage("Home");
        else setActive(null);
        return;
      }
      const scope =
        document.querySelector('[role="dialog"]') ||
        document.querySelector(".player") ||
        document.body;
      const els = Array.from(
        scope.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
        ),
      ).filter((x) => x.getBoundingClientRect().width > 0);
      if (e.key === "Tab" && document.querySelector('[role="dialog"]')) {
        const index = els.indexOf(el);
        if (e.shiftKey && index <= 0) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && index === els.length - 1) {
          e.preventDefault();
          els[0]?.focus();
        }
        return;
      }
      if (
        !e.key.startsWith("Arrow") ||
        form ||
        ["SELECT", "INPUT"].includes(el?.tagName)
      )
        return;
      e.preventDefault();
      const r = el?.getBoundingClientRect();
      if (!r) {
        els[0]?.focus();
        return;
      }
      const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0,
        dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      const x = r.left + r.width / 2,
        y = r.top + r.height / 2;
      const candidates = els
        .filter((x) => x !== el)
        // Remove buttons are only reachable from their own card, or they outrank the artwork.
        .filter(
          (x) =>
            !x.classList.contains("remove") ||
            x.closest(".continue-card") === el?.closest(".continue-card"),
        )
        .map((item) => {
          const b = item.getBoundingClientRect();
          const xx = b.left + b.width / 2 - x,
            yy = b.top + b.height / 2 - y;
          return {
            item,
            along: dx ? xx * dx : yy * dy,
            cross: dx ? Math.abs(yy) : Math.abs(xx),
          };
        })
        .filter((x) => x.along > 5)
        .sort((a, b) => a.along + a.cross * 3 - (b.along + b.cross * 3));
      candidates[0]?.item.focus();
      candidates[0]?.item.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    };
    window.addEventListener("keydown", remote);
    return () => window.removeEventListener("keydown", remote);
  }, [page, detail, dialog, play, sources, resolving]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 9000);
    return () => clearTimeout(timer);
  }, [error]);
  async function signedIn(value: Session) {
    if (service) {
      try {
        const { token } = await api.companion(service, "/session", "", {
          authKey: value.authKey,
        });
        setServiceToken(token);
        localStorage.setItem("still.serviceToken", JSON.stringify(token));
      } catch {
        setServiceToken("");
        localStorage.removeItem("still.serviceToken");
      }
    }
    localStorage.setItem("still.session", JSON.stringify(value));
    setSession(value);
    setError("");
  }
  function signOut() {
    if (service && serviceToken)
      void api
        .companion(service, "/session/revoke", serviceToken, {})
        .catch(() => {});
    setSession(null);
    setActive(null);
    setProfileToken("");
    setServiceToken("");
    localStorage.removeItem("still.session");
    localStorage.removeItem("still.serviceToken");
  }
  function startDemo() {
    setDemo(true);
    setActive({ id: "preview", name: "Preview", avatar: "◒", locked: false });
    setDemoState({
      ...blankState(),
      progress: {
        [demoMeta.id]: {
          meta: demoMeta,
          videoId: demoMeta.id,
          position: 125,
          duration: 596,
          completed: false,
          hidden: false,
          updatedAt: Date.now(),
        },
      },
    });
    setCatalog([demoMeta]);
  }
  async function selectProfile(p: Profile, pin = "") {
    try {
      if (service) {
        const r = await api.companion(
          service,
          `/profiles/${p.id}/unlock`,
          serviceToken,
          { pin },
        );
        setProfileToken(r.token);
      }
      setActive(p);
      setPage("Home");
      setDialog(null);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  async function open(meta: Meta) {
    setDetail(meta);
    setSeason(1);
    if (!demo) {
      const value = await api.details(addons, meta);
      setDetail((current) => (current?.id === meta.id ? value : current));
      const first = releasedEpisodes(value)[0];
      if (first) setSeason(first.season);
    }
  }
  async function launch(meta: Meta, videoId: string) {
    const id = ++requestId.current;
    change((s) => {
      const old = s.progress[videoId];
      return old && (old.completed || old.hidden)
        ? {
            ...s,
            progress: {
              ...s.progress,
              [videoId]: {
                ...old,
                completed: false,
                hidden: false,
                position: old.completed ? 0 : old.position,
                updatedAt: Date.now(),
              },
            },
          }
        : s;
    });
    setResolving(true);
    setLoadTitle(meta);
    setStage({ label: "Finding sources", floor: 0.04, ceil: 0.3 });
    setError("");
    const list = demo
      ? [demoSource]
      : await api.streams(addons, meta.type, videoId);
    if (id !== requestId.current) return;
    setResolving(false);
    const matching = rankSources(list, data.settings.audio, quality);
    if (!matching.length) {
      setSources({ meta, videoId, items: list, failed: [] });
      return;
    }
    await begin(meta, videoId, matching[0], matching.slice(1), list, [], id);
  }
  async function begin(
    meta: Meta,
    videoId: string,
    source: Stream,
    auto: Stream[],
    all: Stream[],
    failed: string[],
    id = requestId.current,
  ) {
    if (source.infoHash) {
      setResolving(true);
      setStage({
        label: failed.length
          ? `Trying another source (${failed.length + 1})`
          : "Connecting to the streaming engine",
        floor: 0.3,
        ceil: 0.5,
      });
    }
    try {
      // Fetched alongside the stream URL so the player opens once, with subtitles, never restarts for them.
      const [url, extra] = await Promise.all([
        api.resolvePlayUrl(source, streamingServer),
        demo
          ? []
          : Promise.race([
              api.subtitles(addons, meta.type, videoId).catch(() => []),
              new Promise<never[]>((done) => setTimeout(() => done([]), 2500)),
            ]),
      ]);
      const tracks = [...(source.subtitles || []), ...extra];
      if (id !== requestId.current) return;
      setResolving(false);
      setSources(null);
      setPlay({ meta, videoId, source, url, tracks, auto, all, failed });
    } catch (e) {
      if (id !== requestId.current) return;
      setResolving(false);
      setError(`${message(e)} ${auto.length ? "Trying another source…" : ""}`);
      if (auto.length)
        await begin(
          meta,
          videoId,
          auto[0],
          auto.slice(1),
          all,
          [...failed, source.key],
          id,
        );
      else
        setSources({
          meta,
          videoId,
          items: all,
          failed: [...failed, source.key],
          message: message(e),
        });
    }
  }
  function cancelLoad() {
    requestId.current++;
    setResolving(false);
  }
  function failed(reason: string) {
    if (!play) return;
    const p = play;
    setPlay(null);
    setError(`${reason} ${p.auto.length ? "Trying another source…" : ""}`);
    if (p.auto.length)
      void begin(p.meta, p.videoId, p.auto[0], p.auto.slice(1), p.all, [
        ...p.failed,
        p.source.key,
      ]);
    else
      setSources({
        meta: p.meta,
        videoId: p.videoId,
        items: p.all,
        failed: [...p.failed, p.source.key],
        message: reason,
      });
  }
  function feedback(meta: Meta, value: string) {
    change((s) => {
      const updatedAt = Date.now(),
        progress = { ...s.progress };
      if (value === "watched")
        for (const videoId of meta.type === "series"
          ? releasedEpisodes(meta).map((v: Episode) => v.id)
          : [meta.id])
          progress[videoId] = {
            meta: compactMeta(meta),
            videoId,
            position: 0,
            duration: 0,
            completed: true,
            hidden: true,
            updatedAt,
          };
      return {
        ...s,
        progress,
        feedback: {
          ...s.feedback,
          [meta.id]: { meta: compactMeta(meta), value, updatedAt },
        },
      };
    });
  }
  function save(meta: Meta) {
    change((s) => ({
      ...s,
      saved: {
        ...s.saved,
        [meta.id]: {
          meta: compactMeta(meta),
          deleted: !!s.saved[meta.id] && !s.saved[meta.id].deleted,
          updatedAt: Date.now(),
        },
      },
    }));
  }
  function hide(videoId: string) {
    change((s) => ({
      ...s,
      progress: {
        ...s.progress,
        [videoId]: {
          ...s.progress[videoId],
          hidden: true,
          updatedAt: Date.now(),
        },
      },
    }));
  }
  const recommended = useMemo(
    () => (page === "Recommended" ? recommend(catalog, data) : []),
    [page, catalog, data.feedback, data.progress],
  );
  const continuation = continueItems(data) as any[];
  const recentContinuation = continuation.slice(1, 6);
  const earlierContinuation = continuation.slice(6);
  const titles =
    page === "Saved"
      ? Object.values(data.saved)
          .filter((x) => !x.deleted)
          .map((x) => x.meta)
      : page === "Search"
        ? results
        : recommended;
  const resume = detail
    ? Object.values(data.progress)
        .filter((p) => p.meta.id === detail.id && !p.completed && !p.hidden)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    : null;
  const episodeList: Episode[] = detail ? releasedEpisodes(detail) : [];
  const next = play
    ? nextEpisode(play.meta, play.videoId, data.progress)
    : undefined;
  return (
    <>
      {!session && !demo ? (
        <Login onLogin={signedIn} onDemo={startDemo} />
      ) : !active ? (
        <div className="profile-page">
          <Brand />
          <div className="profile-content">
            <h1>Who’s watching?</h1>
            <div className="profiles">
              {profiles.map((p) => (
                <div key={p.id}>
                  <button
                    className="profile-tile"
                    onClick={() => {
                      setTarget(p);
                      p.locked ? setDialog("unlock") : void selectProfile(p);
                    }}
                  >
                    <span>
                      <Avatar value={p.avatar} size={52} />
                    </span>
                    <strong>{p.name}</strong>
                    {p.locked && <small>PIN protected</small>}
                  </button>
                </div>
              ))}
              {service && (
                <button
                  className="profile-tile add-profile"
                  onClick={() => setDialog("create")}
                >
                  <span>
                    <Icon name="plus" size={40} />
                  </span>
                  <strong>Add profile</strong>
                </button>
              )}
            </div>
            <div className="profile-actions">
              <button onClick={() => setDialog("service")}>
                {service ? "Connection settings" : "Set up household profiles"}
              </button>
              <button className="text-button" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="app-shell"
          style={
            {
              "--ambient-art": `url("${continuation[0]?.meta.background || continuation[0]?.meta.poster || ""}")`,
            } as React.CSSProperties
          }
        >
          <aside>
            <Brand />
            <nav aria-label="Main navigation">
              {["Home", "Recommended", "Search", "Saved", "Settings"].map(
                (item) => (
                  <button
                    key={item}
                    aria-label={item}
                    aria-current={page === item ? "page" : undefined}
                    onClick={() => {
                      setPage(item);
                      setDetail(null);
                    }}
                  >
                    <Icon name={icons[item]} size={21} className="nav-icon" />
                    {item}
                  </button>
                ),
              )}
            </nav>
            <button
              className="account"
              onClick={() => {
                setActive(null);
                if (demo) {
                  setDemo(false);
                  setCatalog([]);
                } else void refreshProfiles();
              }}
            >
              <span className="avatar-mini">
                <Avatar value={active.avatar} size={22} />
              </span>
              <span>
                {active.name}
                <small>{demo ? "Exit preview" : "Switch profile"}</small>
              </span>
              <Icon name="switch" size={15} />
            </button>
          </aside>
          <main>
            <header className="topbar">
              <span>{page}</span>
              <div>
                <span className="connection-dot" />
                {demo
                  ? "INTERACTIVE PREVIEW"
                  : "STILL / " + (service ? "HOUSEHOLD" : "PERSONAL")}
              </div>
            </header>
            <div className="main-scroll">
              {page === "Settings" ? (
                <Settings
                  {...{
                    data,
                    change,
                    quality,
                    setQuality,
                    streamingServer,
                    setStreamingServer,
                    service,
                    demo,
                  }}
                  onService={() => setDialog("service")}
                  onProfile={() => {
                    setTarget(active);
                    setDialog("edit");
                  }}
                />
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>
                        {page === "Home"
                          ? "Continue watching"
                          : page === "Recommended"
                            ? "Recommended"
                            : page === "Saved"
                              ? "Saved"
                              : "Search"}
                      </h1>
                    </div>
                    {page === "Home" && (
                      <span className="item-count">
                        {continuation.length} in progress
                      </span>
                    )}
                  </div>
                  {page === "Search" && (
                    <div className="search-box">
                      <Icon name="search" size={22} />
                      <input
                        aria-label="Search movies and series"
                        placeholder="Search movies and series"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label="Clear search"
                          onClick={() => setSearch("")}
                        >
                          <Icon name="close" />
                        </button>
                      )}
                    </div>
                  )}
                  {page === "Home" ? (
                    continuation.length ? (
                      <>
                        <ContinueCard
                          item={continuation[0]}
                          variant="featured"
                          disabled={resolving}
                          onPlay={() =>
                            void launch(
                              continuation[0].meta,
                              continuation[0].videoId,
                            )
                          }
                          onRemove={() => hide(continuation[0].videoId)}
                        />
                        {!!recentContinuation.length && (
                          <section className="continue-tier">
                            <h2>Recently watched</h2>
                            <div className="continue-row">
                              {recentContinuation.map((p) => (
                                <ContinueCard
                                  item={p}
                                  variant="recent"
                                  disabled={resolving}
                                  key={p.videoId}
                                  onPlay={() => void launch(p.meta, p.videoId)}
                                  onRemove={() => hide(p.videoId)}
                                />
                              ))}
                            </div>
                          </section>
                        )}
                        {!!earlierContinuation.length && (
                          <section className="continue-tier">
                            <h2>Earlier</h2>
                            <div className="continue-grid">
                              {earlierContinuation.map((p) => (
                                <ContinueCard
                                  item={p}
                                  disabled={resolving}
                                  key={p.videoId}
                                  onPlay={() => void launch(p.meta, p.videoId)}
                                  onRemove={() => hide(p.videoId)}
                                />
                              ))}
                            </div>
                          </section>
                        )}
                      </>
                    ) : (
                      <Empty
                        icon="play"
                        title="Nothing in progress"
                        text="Movies and episodes appear here after 2% watched."
                        action="Explore Recommended"
                        onAction={() => setPage("Recommended")}
                      />
                    )
                  ) : (
                    <>
                      {loading ? (
                        <div className="loading" role="status">
                          <Icon name="loading" className="spin" />
                          Loading titles…
                        </div>
                      ) : titles.length ? (
                        <div className="poster-grid">
                          {titles.map((m: Meta) => (
                            <button
                              className="poster-card"
                              key={m.id}
                              onClick={() => void open(m)}
                            >
                              {m.poster ? (
                                <img src={m.poster} alt="" loading="lazy" />
                              ) : (
                                <div className="poster-fallback">{m.name}</div>
                              )}
                              <strong>{m.name}</strong>
                              <small>
                                {m.releaseInfo || m.type}{" "}
                                {m.imdbRating ? " · " + m.imdbRating : ""}
                              </small>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Empty
                          icon={page === "Saved" ? "saved" : "search"}
                          title={
                            page === "Saved"
                              ? "No saved titles"
                              : page === "Search" && !search
                                ? "Search movies and series"
                                : "No titles found"
                          }
                          text={
                            page === "Saved"
                              ? "Save a movie or series from its details to keep it here."
                              : page === "Search"
                                ? "Search the catalogs from your configured addons."
                                : "No results available from your configured addons."
                          }
                        />
                      )}
                    </>
                  )}
                </>
              )}
              {syncStatus && (
                <p className="sync-notice" role="status">
                  {syncStatus}
                </p>
              )}
            </div>
          </main>
        </div>
      )}
      {resolving && loadTitle && (
        <LoadScreen
          art={loadTitle.background || loadTitle.poster}
          title={loadTitle.name}
          label={stage.label}
          floor={stage.floor}
          ceil={stage.ceil}
          onCancel={cancelLoad}
        />
      )}
      {error.trim() && (
        <div className="toast" role="alert">
          <i aria-hidden="true" />
          <span>{error.trim()}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {detail && !play && !sources && (
        <Modal
          onClose={() => {
            setDetail(null);
            cancelLoad();
          }}
          wide
        >
          <div
            className="detail-hero"
            style={{
              backgroundImage: `linear-gradient(0deg,var(--panel),transparent),url("${detail.background || detail.poster || ""}")`,
            }}
          />
          <div className="detail-body">
            <h1>{detail.name}</h1>
            <p className="metadata">
              {[
                detail.releaseInfo,
                detail.runtime,
                detail.imdbRating ? `Rating ${detail.imdbRating}` : null,
                ...(detail.genres || []),
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            <p className="description">
              {detail.description ||
                "Discover this title through your configured Stremio addons."}
            </p>
            <div className="actions">
              <button
                className="primary"
                disabled={
                  resolving || (detail.type === "series" && !episodeList.length)
                }
                onClick={() =>
                  void launch(
                    detail,
                    resume?.videoId || episodeList[0]?.id || detail.id,
                  )
                }
              >
                <Icon name={resolving ? "loading" : "play"} />
                {resolving ? "Preparing playback…" : resume ? "Resume" : "Play"}
              </button>
              <button onClick={() => save(detail)}>
                <Icon
                  name={
                    data.saved[detail.id] && !data.saved[detail.id].deleted
                      ? "check"
                      : "plus"
                  }
                />
                {data.saved[detail.id] && !data.saved[detail.id].deleted
                  ? "Saved"
                  : "Save"}
              </button>
              <button
                onClick={() => feedback(detail, "more")}
                aria-pressed={data.feedback[detail.id]?.value === "more"}
              >
                <Icon name="heart" />
                More like this
              </button>
              <button
                onClick={() => feedback(detail, "hide")}
                aria-pressed={data.feedback[detail.id]?.value === "hide"}
              >
                Not interested
              </button>
              <button
                onClick={() => feedback(detail, "watched")}
                aria-pressed={data.feedback[detail.id]?.value === "watched"}
              >
                Already watched
              </button>
            </div>
            {detail.type === "series" && (
              <>
                <div className="episode-heading">
                  <h3>Episodes</h3>
                  <select
                    aria-label="Season"
                    value={season}
                    onChange={(e) => setSeason(Number(e.target.value))}
                  >
                    {[...new Set(episodeList.map((v) => v.season))].map((s) => (
                      <option key={s} value={s}>
                        Season {s}
                      </option>
                    ))}
                  </select>
                </div>
                {episodeList.length ? (
                  episodeList
                    .filter((v) => v.season === season)
                    .map((v) => (
                      <button
                        className="episode"
                        key={v.id}
                        disabled={resolving}
                        onClick={() => void launch(detail, v.id)}
                      >
                        <span>{v.episode}</span>
                        <div>
                          <strong>
                            {v.title || v.name || `Episode ${v.episode}`}
                          </strong>
                          <small>
                            {data.progress[v.id]?.completed
                              ? "Watched"
                              : v.released
                                ? new Date(v.released).toLocaleDateString()
                                : ""}
                          </small>
                        </div>
                        <Icon name="play" size={16} />
                      </button>
                    ))
                ) : (
                  <p>No released episodes available.</p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
      {sources && (
        <Modal
          onClose={() => {
            setSources(null);
            requestId.current++;
          }}
        >
          <h2>{sources.meta.name}</h2>
          {sources.message && <p className="muted">{sources.message}</p>}
          {!sources.items.length ? (
            <Empty
              icon="search"
              title="No sources available"
              text="No playable sources were returned by your configured addons."
            />
          ) : (
            <>
              <p className="muted">
                Every available source. Your preferences stay unchanged.
              </p>
              <div className="source-list">
                {sources.items.map((s) => {
                  const info = sourceInfo(s);
                  return (
                    <button
                      key={s.key}
                      onClick={() =>
                        void begin(
                          sources.meta,
                          sources.videoId,
                          s,
                          [],
                          sources.items,
                          sources.failed,
                        )
                      }
                    >
                      <span>
                        <strong>{s.name || "Source"}</strong>
                        <small>
                          {s.title || s.description || s.url || s.infoHash}
                        </small>
                      </span>
                      <span>
                        {sources.failed.includes(s.key)
                          ? "Failed"
                          : info.quality
                            ? `${info.quality}p`
                            : "Unknown quality"}
                        <small>{info.peers ? `${info.peers} peers` : ""}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Modal>
      )}
      {play && (
        <Player
          key={`${play.source.key}:${play.url}`}
          {...play}
          position={
            data.progress[play.videoId]?.completed
              ? 0
              : data.progress[play.videoId]?.position || 0
          }
          settings={data.settings}
          onProgress={(position, duration) =>
            change((s) =>
              recordProgress(s, play.meta, play.videoId, position, duration),
            )
          }
          onError={failed}
          onClose={() => setPlay(null)}
          onSources={() => {
            setSources({
              meta: play.meta,
              videoId: play.videoId,
              items: play.all,
              failed: play.failed,
            });
            setPlay(null);
          }}
          onNext={next ? () => void launch(play.meta, next.id) : undefined}
        />
      )}
      {dialog === "unlock" && target && (
        <Modal onClose={() => setDialog(null)}>
          <h2>Welcome back, {target.name}.</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void selectProfile(
                target,
                String(new FormData(e.currentTarget).get("pin")),
              );
            }}
          >
            <label>
              Profile PIN
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,8}"
                required
                maxLength={8}
                autoFocus
              />
            </label>
            <button className="primary">Unlock profile</button>
          </form>
        </Modal>
      )}
      {(dialog === "create" || dialog === "edit") && (
        <Modal onClose={() => setDialog(null)}>
          <h2>{dialog === "edit" ? "Edit profile" : "Create profile"}</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api.companion(
                  service,
                  dialog === "edit"
                    ? `/profiles/${target!.id}/edit`
                    : "/profiles",
                  serviceToken,
                  {
                    name: f.get("name"),
                    avatar: f.get("avatar"),
                    ...(f.get("pin") ? { pin: f.get("pin") } : {}),
                  },
                  profileToken,
                );
                await refreshProfiles();
                setDialog(null);
                if (dialog === "edit") setActive(null);
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            <label>
              Name
              <input
                name="name"
                defaultValue={dialog === "edit" ? target?.name : ""}
                maxLength={40}
                required
              />
            </label>
            <label>
              Avatar
              <select name="avatar" defaultValue={target?.avatar || "◒"}>
                {avatarOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {dialog === "edit"
                ? "New PIN (leave blank to keep existing)"
                : "PIN (optional)"}
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,8}"
                minLength={4}
                maxLength={8}
              />
            </label>
            <button className="primary">
              {dialog === "edit" ? "Save profile" : "Create profile"}
            </button>
          </form>
          {dialog === "edit" && (
            <div className="danger-actions">
              <button
                onClick={async () => {
                  try {
                    await api.companion(
                      service,
                      `/profiles/${target!.id}/edit`,
                      serviceToken,
                      { name: target!.name, avatar: target!.avatar, pin: "" },
                      profileToken,
                    );
                    setDialog(null);
                    setActive(null);
                    await refreshProfiles();
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              >
                Remove PIN
              </button>
              <button
                className="danger"
                onClick={async () => {
                  if (
                    !confirm(
                      `Delete ${target?.name}? This permanently removes their Saved titles, history and preferences.`,
                    )
                  )
                    return;
                  try {
                    await api.companion(
                      service,
                      `/profiles/${target!.id}/delete`,
                      serviceToken,
                      { confirm: true },
                      profileToken,
                    );
                    setActive(null);
                    setDialog(null);
                    await refreshProfiles();
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              >
                Delete profile
              </button>
            </div>
          )}
        </Modal>
      )}
      {dialog === "service" && (
        <Modal onClose={() => setDialog(null)}>
          <h2>Household profiles</h2>
          <p className="muted">
            Connect your self-hosted Still service to add independent profiles.
            The first profile imports your current Stremio Saved titles and
            progress.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const base = api.safeBase(
                  String(new FormData(e.currentTarget).get("url")),
                );
                const { token } = await api.companion(base, "/session", "", {
                  authKey: session!.authKey,
                });
                let list = await api.companion(base, "/profiles", token);
                if (!list.length) {
                  const imported = api.importLibrary(
                    await api.readLibrary(session!.authKey),
                  );
                  await api.companion(base, "/profiles", token, {
                    name: session!.user.email?.split("@")[0] || "You",
                    avatar: "◒",
                    importState: imported,
                  });
                  list = await api.companion(base, "/profiles", token);
                }
                localStorage.setItem("still.service", JSON.stringify(base));
                localStorage.setItem(
                  "still.serviceToken",
                  JSON.stringify(token),
                );
                setService(base);
                setServiceToken(token);
                setProfiles(list);
                setActive(null);
                setDialog(null);
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            <label>
              Service address
              <input
                name="url"
                type="url"
                defaultValue={service}
                placeholder="https://your-server.your-tailnet.ts.net"
                required
              />
            </label>
            <button className="primary">Connect household</button>
          </form>
          {service && (
            <button
              className="text-button danger"
              onClick={() => {
                localStorage.removeItem("still.service");
                localStorage.removeItem("still.serviceToken");
                setService("");
                setServiceToken("");
                setActive(null);
                setDialog(null);
              }}
            >
              Return to single-profile mode
            </button>
          )}
          <p className="fine-print">
            Switching back leaves the Stremio account’s existing library and
            progress untouched. Your household data stays on your server.
          </p>
        </Modal>
      )}
      <div className="portrait-notice">
        <Brand />
        <h2>Rotate to landscape</h2>
        <p>Still uses a landscape layout.</p>
      </div>
    </>
  );
}
function Brand() {
  return (
    <div className="brand" role="img" aria-label="Still. Built by Rewa.">
      <img className="brand-icon" src={appIcon} alt="" width="38" height="38" />
      <span className="brand-lockup">
        <span className="brand-name">
          still<span className="brand-dot">.</span>
        </span>
        <span className="brand-maker">
          <span>by</span>
          <span className="rewa-mark">Rewa.</span>
        </span>
      </span>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span>
        <Icon name={icon} size={42} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={onAction}>
          {action}
          <Icon name="next" />
        </button>
      )}
    </div>
  );
}
function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Still dialog"
        className={`modal ${wide ? "wide" : ""}`}
      >
        <button
          className="close-modal"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
        {children}
      </section>
    </div>
  );
}
function message(e: unknown) {
  return e instanceof Error
    ? e.message
    : "Something went wrong. Please try again.";
}
function Login({
  onLogin,
  onDemo,
}: {
  onLogin: (s: Session) => void;
  onDemo: () => void;
}) {
  const [qr, setQr] = useState(""),
    [link, setLink] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [generation, setGeneration] = useState(0);
  useEffect(() => {
    let alive = true,
      timer: ReturnType<typeof setInterval>;
    let attempts = 0;
    api
      .linkCreate()
      .then(async (r) => {
        if (!alive) return;
        setLink(r.link);
        setCode(r.code);
        setQr(
          await (
            await import("qrcode")
          ).default.toDataURL(r.link, {
            margin: 1,
            width: 224,
            color: { dark: "#20251f", light: "#ffffff" },
          }),
        );
        timer = setInterval(async () => {
          if (++attempts > 120) {
            clearInterval(timer);
            if (alive) setError("Link expired. Refresh the code to try again.");
            return;
          }
          try {
            const key = await api.linkRead(r.code);
            if (key && alive) {
              clearInterval(timer);
              const session = await api.sessionFromKey(key);
              if (alive) onLogin(session);
            }
          } catch {
            /* A not-yet-linked code is expected. */
          }
        }, 3000);
      })
      .catch((e) => {
        if (alive) setError(message(e));
      });
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [generation]);
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div>
          <h1>
            Stremio.
            <br />
            Simplified.
          </h1>
          <p>Your account and addons, in a simpler interface.</p>
        </div>
      </div>
      <section className="login-panel">
        <h2>Sign in to Stremio</h2>
        <p className="muted">Use your existing account.</p>
        <div className="qr-row">
          {qr ? (
            <img src={qr} alt="Scan to sign in with Stremio" />
          ) : (
            <div className="qr-loading">Creating sign-in code…</div>
          )}
          <div>
            <strong>Scan the QR code</strong>
            <p>Sign in on your phone.</p>
            {code && <code>{code}</code>}
            <button
              className="text-button"
              onClick={() => setGeneration((g) => g + 1)}
            >
              Refresh code
            </button>
            {link && (
              <a href={link} target="_blank" rel="noreferrer">
                Open sign-in link
                <Icon name="external" size={13} />
              </a>
            )}
          </div>
        </div>
        <div className="divider">
          <span>or use your email</span>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              onLogin(
                await api.login(
                  String(f.get("email")),
                  String(f.get("password")),
                ),
              );
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Your Stremio password"
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Connecting…" : "Sign in"}
            <Icon name="next" />
          </button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="text-button preview-link" onClick={onDemo}>
          Preview app
          <Icon name="external" size={14} />
        </button>
        <p className="fine-print">
          Independent client. Your account connects directly to Stremio.
        </p>
      </section>
    </div>
  );
}
function Settings(p: any) {
  const { data, change } = p;
  const set = (key: string, value: any) =>
    change((s: ProfileState) => ({
      ...s,
      settings: { ...s.settings, [key]: value },
      settingsAt: Date.now(),
    }));
  return (
    <div className="settings">
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <section>
        <h2>Appearance</h2>
        <Setting label="Theme" text="Light by default.">
          <div className="segmented">
            {["light", "dark"].map((t) => (
              <button
                key={t}
                aria-pressed={data.settings.theme === t}
                onClick={() => set("theme", t)}
              >
                <Icon name={t === "light" ? "sun" : "moon"} size={16} />
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </Setting>
      </section>
      <section>
        <h2>Playback</h2>
        <Setting
          label="Audio language"
          text="Required when choosing a source automatically."
        >
          <select
            aria-label="Preferred audio language"
            value={data.settings.audio}
            onChange={(e) => set("audio", e.target.value)}
          >
            {languages.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Setting>
        <Setting
          label="Subtitle language"
          text="Applied when available. Playback never waits for subtitles."
        >
          <select
            aria-label="Preferred subtitle language"
            value={data.settings.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
          >
            {languages.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Setting>
        <Setting
          label="Subtitles by default"
          text="Remembered for your profile."
        >
          <button
            className="toggle"
            role="switch"
            aria-label="Subtitles by default"
            aria-checked={data.settings.subtitles}
            onClick={() => set("subtitles", !data.settings.subtitles)}
          >
            <span />
          </button>
        </Setting>
        <Setting
          label="Autoplay"
          text="Scheduled plays the next episode from 7 am to 10 pm, device local time."
        >
          <select
            aria-label="Autoplay mode"
            value={data.settings.autoplay}
            onChange={(e) => set("autoplay", e.target.value)}
          >
            <option value="scheduled">Scheduled · 7 am – 10 pm</option>
            <option value="on">Always on</option>
            <option value="off">Off</option>
          </select>
        </Setting>
        <Setting
          label="Maximum quality"
          text="This device only. Automatically detected; lower it any time."
        >
          <select
            aria-label="Maximum quality"
            value={p.quality}
            onChange={(e) => {
              p.setQuality(Number(e.target.value));
              localStorage.setItem("still.quality", e.target.value);
            }}
          >
            {[480, 720, 1080, 2160]
              .filter((n) => n <= detectedQuality())
              .map((n) => (
                <option value={n} key={n}>
                  {n === 2160 ? "4K UHD" : `${n}p`}
                </option>
              ))}
          </select>
        </Setting>
        <Setting
          label="Stremio streaming server"
          text={
            window.StillDesktop
              ? "Leave blank for the local engine. Installs on first torrent."
              : "Needed for torrent-only sources. Use a reachable Stremio engine."
          }
        >
          <input
            aria-label="Streaming server address"
            type="url"
            placeholder="http://server:11470"
            value={p.streamingServer}
            onChange={(e) => {
              p.setStreamingServer(e.target.value);
              localStorage.setItem(
                "still.streamingServer",
                JSON.stringify(e.target.value),
              );
            }}
          />
        </Setting>
      </section>
      <section>
        <h2>Account & profiles</h2>
        <Setting
          label="Household profiles"
          text={
            p.service
              ? "Connected to your private service."
              : "One profile uses Stremio. More profiles use your own service."
          }
        >
          <button disabled={p.demo} onClick={p.onService}>
            {p.service ? "Manage connection" : "Connect service"}
            <Icon name="next" size={16} />
          </button>
        </Setting>
        {p.service && (
          <Setting label="Profile" text="Name, avatar and optional PIN.">
            <button onClick={p.onProfile}>
              Edit profile
              <Icon name="next" size={16} />
            </button>
          </Setting>
        )}
      </section>
      <p className="fine-print">
        Still 0.2.2 · An independent Stremio client.
        <br />
        Configured addons supply catalogs and sources. No content is hosted by
        Still.
      </p>
    </div>
  );
}
function Setting({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting">
      <div>
        <strong>{label}</strong>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
