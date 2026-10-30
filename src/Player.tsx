import { LoadScreen } from "./LoadScreen";
import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { Meta, Stream } from "./types";
import { autoplayAllowed } from "../shared/domain.mjs";
import { languageCode } from "./api";
import { Icon } from "./Icon";
type Props = {
  meta: Meta;
  videoId: string;
  source: Stream;
  url: string;
  position: number;
  settings: {
    audio: string;
    subtitle: string;
    subtitles: boolean;
    autoplay: string;
  };
  tracks: { url: string; lang: string }[];
  onProgress: (p: number, d: number) => void;
  onError: (message: string) => void;
  onClose: () => void;
  onSources: () => void;
  onNext?: () => void;
};
export function Player(p: Props) {
  const video = useRef<HTMLVideoElement>(null),
    latest = useRef(p),
    lastWrite = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  latest.current = p;
  const [playing, setPlaying] = useState(false),
    [current, setCurrent] = useState(p.position),
    [duration, setDuration] = useState(0),
    [controls, setControls] = useState(true),
    [advanced, setAdvanced] = useState(false),
    [caption, setCaption] = useState(p.settings.subtitles),
    [countdown, setCountdown] = useState<number | null>(null),
    [status, setStatus] = useState(""),
    [loaded, setLoaded] = useState(false),
    [covered, setCovered] = useState(true),
    [floor, setFloor] = useState(0.5);
  useEffect(() => {
    const v = video.current!;
    let hls: Hls | undefined;
    let failed = false;
    let ready = false;
    let disposed = false;
    let startup: ReturnType<typeof setTimeout>;
    const fail = (message: string) => {
      if (failed) return;
      failed = true;
      latest.current.onError(message);
    };
    const write = () => {
      if (Number.isFinite(v.duration) && v.duration > 0)
        latest.current.onProgress(v.currentTime, v.duration);
    };
    window.stillProgress = (data) => {
      ready = true;
      setLoaded(true);
      clearTimeout(startup);
      setCurrent(data.position);
      setDuration(data.duration);
      if (data.final || Date.now() - lastWrite.current > 5000) {
        lastWrite.current = Date.now();
        latest.current.onProgress(data.position, data.duration);
      }
    };
    window.stillPlaybackEnded = (ended?: boolean) => {
      if (
        ended &&
        latest.current.onNext &&
        autoplayAllowed(latest.current.settings.autoplay)
      )
        setCountdown(10);
      else latest.current.onClose();
    };
    window.stillPlaybackFailed = fail;
    window.stillNext = () => latest.current.onNext?.();
    window.stillShowSources = () => latest.current.onSources();
    if (window.StillNative) {
      window.StillNative.play(
        JSON.stringify({
          url: p.url,
          title: p.meta.name,
          art: p.meta.background || p.meta.poster || "",
          position: p.position,
          headers: p.source.behaviorHints?.proxyHeaders?.request || {},
          audio: p.settings.audio,
          subtitle: p.settings.subtitle,
          subtitles: p.settings.subtitles,
          tracks: p.tracks,
          hasNext: !!p.onNext,
          torrent: !!p.source.infoHash,
        }),
      );
      return () => {
        delete window.stillProgress;
        delete window.stillPlaybackEnded;
        delete window.stillPlaybackFailed;
        delete window.stillNext;
        delete window.stillShowSources;
      };
    }
    const metadata = () => {
      v.currentTime = p.position;
      setDuration(v.duration);
      v.play().catch(() => setStatus("Press Play to start"));
    };
    const time = () => {
      setCurrent(v.currentTime);
      if (Date.now() - lastWrite.current > 5000) {
        lastWrite.current = Date.now();
        write();
      }
    };
    const canPlay = () => {
      ready = true;
      setLoaded(true);
      clearTimeout(startup);
      setStatus("");
    };
    const error = () => fail("This source could not be played.");
    v.addEventListener("loadedmetadata", metadata);
    v.addEventListener("timeupdate", time);
    v.addEventListener("playing", canPlay);
    v.addEventListener("error", error);
    if (
      /\.m3u8(?:\?|$)/i.test(p.url) &&
      !v.canPlayType("application/vnd.apple.mpegurl")
    ) {
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            fail("HLS playback is unavailable on this device.");
            return;
          }
          hls = new Hls(
            p.source.infoHash
              ? {
                  manifestLoadingTimeOut: 120000,
                  levelLoadingTimeOut: 120000,
                  fragLoadingTimeOut: 60000,
                }
              : {},
          );
          hls.loadSource(p.url);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => setFloor(0.75));
          hls.on(Hls.Events.FRAG_LOADED, () => setFloor(0.9));
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) fail("The HLS source failed.");
          });
        })
        .catch(() => fail("The HLS player could not be loaded."));
    } else v.src = p.url;
    startup = setTimeout(
      () => {
        if (!ready)
          fail(
            p.source.infoHash
              ? "This torrent did not start. Try a source with more peers."
              : "This source did not start within 30 seconds.",
          );
      },
      p.source.infoHash ? 120000 : 30000,
    );
    return () => {
      disposed = true;
      write();
      clearTimeout(startup);
      hls?.destroy();
      v.removeEventListener("loadedmetadata", metadata);
      v.removeEventListener("timeupdate", time);
      v.removeEventListener("playing", canPlay);
      v.removeEventListener("error", error);
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
  }, [p.url]);
  useEffect(() => {
    if (!controls) return;
    timer.current = setTimeout(() => {
      if (playing && !advanced) setControls(false);
    }, 4500);
    return () => clearTimeout(timer.current);
  }, [controls, playing, advanced]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    for (const t of Array.from(v.textTracks))
      t.mode =
        caption &&
        languageCode(t.language) === languageCode(p.settings.subtitle)
          ? "showing"
          : "disabled";
  }, [caption, p.tracks]);
  useEffect(() => {
    if (countdown === null) return;
    if (!autoplayAllowed(p.settings.autoplay)) {
      setCountdown(null);
      return;
    }
    if (countdown === 0) {
      p.onNext?.();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
  function ended() {
    p.onProgress(duration, duration);
    if (p.onNext && autoplayAllowed(p.settings.autoplay)) setCountdown(10);
    else {
      setControls(true);
      setStatus("Finished");
    }
  }
  function toggle() {
    const v = video.current!;
    if (v.paused)
      void v.play().catch(() => setStatus("Unable to start playback"));
    else v.pause();
    setControls(true);
  }
  const stamp = (time: number) =>
    `${Math.floor((time || 0) / 60)}:${String(Math.floor((time || 0) % 60)).padStart(2, "0")}`;
  return (
    <section
      className="player"
      onPointerMove={() => setControls(true)}
      onClick={() => setControls(true)}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          p.onClose();
        }
        if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault();
          toggle();
        }
      }}
      tabIndex={-1}
    >
      <video
        ref={video}
        playsInline
        crossOrigin={p.tracks.length ? "anonymous" : undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={ended}
        onClick={toggle}
      >
        {p.tracks
          .filter((t) => /\.vtt(?:\?|$)/i.test(t.url))
          .slice(0, 8)
          .map((t, i) => (
            <track
              key={i}
              kind="subtitles"
              label={t.lang}
              srcLang={languageCode(t.lang)}
              src={t.url}
              default={
                p.settings.subtitles &&
                languageCode(t.lang) === p.settings.subtitle
              }
            />
          ))}
      </video>
      {covered && (
        <LoadScreen
          inPlayer
          art={p.meta.background || p.meta.poster}
          title={p.meta.name}
          label={p.source.infoHash ? "Finding peers" : "Connecting"}
          floor={floor}
          ceil={0.92}
          done={loaded}
          onDone={() => setCovered(false)}
          onCancel={p.onClose}
        />
      )}
      {status && <div className="player-status">{status}</div>}
      {countdown !== null && (
        <div className="up-next">
          <span>Next episode in {countdown}</span>
          <button onClick={() => setCountdown(null)}>Cancel</button>
          <button onClick={p.onNext}>Play now</button>
        </div>
      )}
      <div className={`player-controls ${controls ? "visible" : ""}`}>
        <div className="player-top">
          <button onClick={p.onClose}>
            <Icon name="back" />
            Back
          </button>
          <span>{p.meta.name}</span>
          <button
            aria-label="More playback options"
            onClick={() => setAdvanced(!advanced)}
          >
            <Icon name="more" />
          </button>
        </div>
        {advanced && (
          <div className="player-options">
            <h3>Playback</h3>
            <button onClick={() => setCaption(!caption)}>
              Subtitles: {caption ? "On" : "Off"} ·{" "}
              {p.settings.subtitle.toUpperCase()}
            </button>
            <label>
              Speed
              <select
                defaultValue="1"
                onChange={(e) => {
                  video.current!.playbackRate = Number(e.target.value);
                }}
              >
                {[0.75, 1, 1.25, 1.5, 2].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button onClick={p.onSources}>Change source</button>
            <p>
              Preferred audio: {p.settings.audio.toUpperCase()}. Available
              tracks depend on the source.
            </p>
          </div>
        )}
        <div className="player-bottom">
          <input
            aria-label="Playback position"
            type="range"
            min="0"
            max={duration || 1}
            value={current}
            onChange={(e) => {
              video.current!.currentTime = Number(e.target.value);
              setCurrent(Number(e.target.value));
            }}
          />
          <div className="transport">
            <span>
              {stamp(current)} <small>/ {stamp(duration)}</small>
            </span>
            <button
              className="play-pause"
              aria-label={playing ? "Pause" : "Play"}
              autoFocus
              onClick={toggle}
            >
              <Icon name={playing ? "pause" : "play"} size={23} />
            </button>
            <div>
              <button onClick={() => setAdvanced(!advanced)}>
                <Icon name="captions" />
                Audio & subtitles
              </button>
              {p.onNext && (
                <button onClick={p.onNext}>
                  Next episode
                  <Icon name="next" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
