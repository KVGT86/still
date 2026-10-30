import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { torrentFixture } from "./test-torrent.mjs";
import { torrentUrl, torrentHlsUrl } from "../shared/torrent.mjs";
const base = process.env.STILL_REMOTE_ENGINE;
if (!base) throw new Error("Set STILL_REMOTE_ENGINE to the test engine URL.");
const fixture = await torrentFixture({ incompatibleAudio: true });
try {
  const media = torrentUrl(fixture.source, base);
  const range = await fetch(media, {
    headers: { Range: "bytes=0-4095" },
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(range.status, 206);
  assert.deepEqual(
    Buffer.from(await range.arrayBuffer()),
    fixture.video.subarray(0, 4096),
  );
  const hls = torrentHlsUrl(media, base, `verification-${Date.now()}`);
  const playlist = await fetch(hls, { signal: AbortSignal.timeout(120000) });
  assert.equal(playlist.status, 200);
  assert.match(await playlist.text(), /#EXTM3U/);
  const { stdout } = await promisify(execFile)(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name",
      "-of",
      "json",
      hls,
    ],
    { timeout: 120000 },
  );
  const streams = JSON.parse(stdout).streams;
  assert.ok(
    streams.some((s) => s.codec_type === "audio" && s.codec_name === "aac"),
  );
  assert.ok(
    streams.some((s) => s.codec_type === "video" && s.codec_name === "h264"),
  );
  console.log(
    JSON.stringify({
      torrentRange: true,
      httpsHls: true,
      ac3ConvertedToAac: true,
      video: "h264",
    }),
  );
} finally {
  await fixture.close();
}
