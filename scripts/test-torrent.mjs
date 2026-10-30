import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createServer as createPeer } from "node:net";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promisify } from "node:util";
import Protocol from "bittorrent-protocol";
import utMetadata from "ut_metadata";
import createTorrent from "create-torrent";
import bencode from "bencode";
import { TorrentEngine } from "../desktop/engine.cjs";
import { torrentUrl, torrentHlsUrl } from "../shared/torrent.mjs";

// Generate an original video and seed it over real BitTorrent on loopback.
// No public trackers, third-party media, credentials or external peers are needed.
export async function torrentFixture({ incompatibleAudio = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "still-torrent-fixture-"));
  const filename = incompatibleAudio ? "video.mkv" : "video.mp4";
  const file = join(directory, filename);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=24",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440",
    "-t",
    "8",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    incompatibleAudio ? "ac3" : "aac",
    ...(incompatibleAudio ? [] : ["-movflags", "+faststart"]),
    file,
  ]);
  const video = await readFile(file);
  const readme = Buffer.from(
    "Still generated torrent playback fixture. CC0.\n",
  );
  readme.name = "aaa-readme.txt";
  video.name = filename;
  const torrent = Buffer.from(
    await promisify(createTorrent)([readme, video], {
      name: "Still test",
      pieceLength: 16384,
      private: true,
      announceList: [],
    }),
  );
  const info = bencode.decode(torrent).info;
  const hash = createHash("sha1").update(bencode.encode(info)).digest("hex");
  const content = Buffer.concat(
    info.files.map((f) =>
      Buffer.from(f.path[0]).toString() === filename ? video : readme,
    ),
  );
  const sockets = new Set();
  const peer = createPeer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    const wire = new Protocol();
    wire.on("error", () => socket.destroy());
    wire.use(utMetadata(torrent));
    socket.pipe(wire).pipe(socket);
    wire.on("handshake", () => {
      wire.handshake(hash, Buffer.from("-ST0001-123456789012"));
      const pieces = Math.ceil(content.length / 16384);
      wire.bitfield(Buffer.alloc(Math.ceil(pieces / 8), 255));
      wire.unchoke();
    });
    wire.on("request", (index, offset, length, callback) => {
      const start = index * 16384 + offset;
      callback(null, content.subarray(start, start + length));
    });
  });
  peer.listen(0, "127.0.0.1");
  await once(peer, "listening");
  const tracker = createServer((_req, res) => {
    const peers = Buffer.from([
      127,
      0,
      0,
      1,
      peer.address().port >> 8,
      peer.address().port & 255,
    ]);
    res.end(bencode.encode({ interval: 5, complete: 1, incomplete: 0, peers }));
  });
  tracker.listen(0, "127.0.0.1");
  await once(tracker, "listening");
  return {
    source: {
      infoHash: hash,
      sources: [`tracker:http://127.0.0.1:${tracker.address().port}/announce`],
    },
    video,
    async close() {
      for (const socket of sockets) socket.destroy();
      await Promise.all([
        new Promise((r) => peer.close(r)),
        new Promise((r) => tracker.close(r)),
      ]);
      await rm(directory, { recursive: true, force: true });
    },
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const fixture = await torrentFixture();
  const engine = new TorrentEngine(resolve("tools/torrent-engine-0.1.21"));
  try {
    const base = await engine.start();
    assert.equal(
      await engine.start(),
      base,
      "concurrent requests share one engine",
    );
    const settings = await (await fetch(`${base}/settings`)).json();
    assert.equal(settings.values.cacheSize, 0);
    const blocked = await fetch(`${base}/settings`, {
      headers: { Origin: "https://example.test" },
    });
    assert.equal(blocked.status, 403);
    const allowed = await fetch(`${base}/settings`, {
      headers: { Origin: "still://app" },
    });
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      "still://app",
    );
    const media = torrentUrl(fixture.source, base);
    const response = await fetch(media, {
      headers: { Range: "bytes=0-4095" },
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(response.status, 206);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      fixture.video.subarray(0, 4096),
    );
    const tail = await fetch(media, {
      headers: { Range: `bytes=${fixture.video.length - 1024}-` },
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(tail.status, 206);
    assert.deepEqual(
      Buffer.from(await tail.arrayBuffer()),
      fixture.video.subarray(-1024),
    );
    const hls = await fetch(torrentHlsUrl(media, base, "fixture"), {
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(hls.status, 200);
    assert.match(await hls.text(), /#EXTM3U/);
    const session = engine.session;
    await engine.stop();
    await assert.rejects(readFile(join(session, "server-settings.json")));
    console.log(
      "Torrent integration passed: real metadata and pieces, automatic file selection, range seeking, HLS, origin checks and cleanup.",
    );
  } finally {
    await engine.stop();
    await fixture.close();
  }
}
