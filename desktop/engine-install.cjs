const {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  copyFile,
  chmod,
  writeFile,
} = require("node:fs/promises");
const { createWriteStream } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const archiveURL =
  "https://dl.strem.io/stremio-service/v0.1.21/stremio-service_amd64.deb";
const archiveSHA =
  "7d55ddafc46d683b56c720855a3f8c8cb7cac1dce817314bfabe098ae5868c67";
const files = ["stremio-runtime", "server.js", "ffmpeg", "ffprobe"];

async function ensureEngine(parent, archive, signal) {
  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error(
      "The built-in torrent engine currently supports x86-64 Linux. Set a remote engine address on this device.",
    );
  const directory = join(parent, "torrent-engine-0.1.21");
  try {
    await Promise.all(
      [...files, "package.json"].map((file) => access(join(directory, file))),
    );
    return directory;
  } catch {}
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(join(parent, ".engine-install-"));
  try {
    const deb = archive || join(staging, "engine.deb");
    if (!archive) {
      const response = await fetch(archiveURL, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(300000)])
          : AbortSignal.timeout(300000),
      });
      if (!response.ok || !response.body)
        throw new Error("The torrent engine download failed. Try again.");
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(deb, { flags: "wx" }),
      );
    }
    if (
      createHash("sha256")
        .update(await readFile(deb))
        .digest("hex") !== archiveSHA
    )
      throw new Error(
        "The torrent engine download failed its integrity check.",
      );
    const extracted = join(staging, "extracted");
    await promisify(execFile)("dpkg-deb", ["-x", deb, extracted]);
    const ready = join(staging, "ready");
    await mkdir(ready);
    await writeFile(join(ready, "package.json"), '{"type":"commonjs"}');
    for (const file of files) {
      await copyFile(
        join(extracted, "usr/share/stremio-service", file),
        join(ready, file),
      );
      await chmod(join(ready, file), 0o755);
    }
    await copyFile(
      join(extracted, "usr/share/doc/stremio-service/copyright"),
      join(ready, "COPYRIGHT"),
    );
    await rm(directory, { recursive: true, force: true });
    await rename(ready, directory);
    return directory;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
module.exports = { ensureEngine };
