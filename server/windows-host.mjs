import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statfsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startLanProxy } from "./lan-proxy.mjs";
const root = process.env.STILL_VOLUME;
const engineDirectory = process.env.STILL_STREMIO_DIRECTORY;
if (!root || !engineDirectory || process.platform !== "win32")
  throw new Error("Run the Windows setup script first.");
const runtime = join(root, "Runtime");
const state = join(root, "Data");
mkdirSync(state, { recursive: true });
mkdirSync(join(root, "Backups"), { recursive: true });
const app = resolve(fileURLToPath(new URL("..", import.meta.url)));
const children = new Set();
const proxies = process.env.STILL_LAN_ADDRESS
  ? [
      startLanProxy(process.env.STILL_LAN_ADDRESS, 8787),
      startLanProxy(process.env.STILL_LAN_ADDRESS, 11470),
    ]
  : [];
let quitting = false;
function kill(child) {
  if (!child?.pid) return;
  try {
    execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } catch {}
  children.delete(child);
}
function child(executable, args, env) {
  const process = spawn(executable, args, {
    cwd: app,
    env,
    stdio: "ignore",
    windowsHide: true,
  });
  children.add(process);
  process.on("exit", () => children.delete(process));
  process.on("error", () => children.delete(process));
  return process;
}
function alive(process) {
  return (
    process &&
    process.exitCode === null &&
    process.signalCode === null &&
    process.pid
  );
}
let profile, torrent;
function reconcile() {
  if (quitting) return;
  const volume = statfsSync(root);
  const available = Number(volume.bavail) * Number(volume.bsize);
  if (!alive(profile))
    profile = child(process.execPath, [join(app, "server/index.mjs")], {
      ...process.env,
      DATABASE: join(state, "still.sqlite"),
      BACKUP_DIRECTORY: join(root, "Backups"),
      PACKAGE_DIRECTORY: join(root, "Packages"),
      HOST: "127.0.0.1",
      PORT: "8787",
    });
  if (available < 1024 ** 3) {
    kill(torrent);
    torrent = null;
    rmSync(runtime, { recursive: true, force: true });
    writeFileSync(
      join(state, "host-status.json"),
      JSON.stringify({
        mediaPaused: true,
        reason: "Storage reserve",
        available,
      }),
    );
    return;
  }
  if (!alive(torrent)) {
    rmSync(runtime, { recursive: true, force: true });
    mkdirSync(runtime, { recursive: true });
    torrent = child(
      join(engineDirectory, "stremio-runtime.exe"),
      [
        join(app, "server/windows-engine.cjs"),
        join(engineDirectory, "server.js"),
      ],
      {
        ...process.env,
        APP_PATH: runtime,
        SETTINGS_PATH: runtime,
        TEMP: runtime,
        TMP: runtime,
        CASTING_DISABLED: "1",
        NO_HTTPS_SERVER: "1",
        NO_NETWORK_INTERFACES: "1",
        FFMPEG_BIN: join(engineDirectory, "ffmpeg.exe"),
        FFPROBE_BIN: join(engineDirectory, "ffprobe.exe"),
      },
    );
  }
  writeFileSync(
    join(state, "host-status.json"),
    JSON.stringify({
      mediaPaused: false,
      available,
      profilePid: profile.pid,
      enginePid: torrent.pid,
    }),
  );
}
function stop() {
  quitting = true;
  for (const proxy of proxies) proxy.close();
  for (const process of children) kill(process);
  rmSync(runtime, { recursive: true, force: true });
}
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
process.on("exit", stop);
reconcile();
setInterval(() => {
  try {
    reconcile();
  } catch {
    stop();
    process.exit(1);
  }
}, 5000);
