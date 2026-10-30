import { test } from "node:test";
import assert from "node:assert/strict";
import { torrentUrl, torrentHlsUrl } from "../shared/torrent.mjs";
const hash = "0123456789abcdef0123456789abcdef01234567";
test("torrent URLs preserve explicit index zero, trackers and filename selectors", () => {
  const url = new URL(
    torrentUrl(
      {
        infoHash: hash.toUpperCase(),
        fileIdx: 0,
        sources: ["tracker:udp://tracker.example:6969", `dht:${hash}`],
        fileMustInclude: ["S01E02"],
      },
      "http://127.0.0.1:1234/engine",
    ),
  );
  assert.equal(url.pathname, `/engine/${hash}/0`);
  assert.deepEqual(url.searchParams.getAll("tr"), [
    "tracker:udp://tracker.example:6969",
    `dht:${hash}`,
  ]);
  assert.deepEqual(url.searchParams.getAll("f"), ["S01E02"]);
  assert.equal(
    new URL(torrentUrl({ infoHash: hash }, url.origin)).pathname,
    `/${hash}/-1`,
  );
  assert.equal(
    new URL(torrentUrl({ infoHash: hash, fileIdx: null }, url.origin)).pathname,
    `/${hash}/-1`,
  );
});
test("invalid torrent fields cannot become engine paths", () => {
  assert.throws(() =>
    torrentUrl({ infoHash: "../../settings" }, "http://localhost"),
  );
  assert.throws(() =>
    torrentUrl({ infoHash: hash, fileIdx: -2 }, "http://localhost"),
  );
  assert.throws(() =>
    torrentUrl({ infoHash: hash, fileIdx: 1.5 }, "http://localhost"),
  );
});
test("local torrent playback uses the engine's browser-compatible HLS conversion", () => {
  const media = torrentUrl({ infoHash: hash }, "http://localhost:1234");
  const hls = new URL(torrentHlsUrl(media, "http://localhost:1234", "session"));
  assert.equal(hls.pathname, "/hlsv2/session/master.m3u8");
  assert.equal(hls.searchParams.get("mediaURL"), media);
  assert.deepEqual(hls.searchParams.getAll("videoCodecs"), ["h264"]);
  assert.deepEqual(hls.searchParams.getAll("audioCodecs"), ["aac", "mp3"]);
});
