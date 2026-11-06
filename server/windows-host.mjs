import { spawn, execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startLanProxy } from "./lan-proxy.mjs";
import { clearRuntime, storageLow } from "./host-storage.mjs";
const root = process.env.STILL_VOLUME;
const engineDirectory = process.env.STILL_STREMIO_DIRECTORY;
if (!root || !engineDirectory || process.platform !== "win32")
  throw new Error("Run the Windows setup script first.");
const runtime = join(root, "Runtime");
const state = join(root, "Data");
mkdirSync(state, { recursive: true });
mkdirSync(join(root, "Backups"), { recursive: true });
const app = resolve(fileURLToPath(new URL("..", import.meta.url)));
const logFile = join(state, "host.log");
function log(message) {
  try {
    if (statSync(logFile, { throwIfNoEntry: false })?.size > 1024 ** 2) {
      rmSync(logFile + ".1", { force: true });
      renameSync(logFile, logFile + ".1");
    }
    appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
  } catch {}
}
const children = new Set();
const proxies = process.env.STILL_LAN_ADDRESS
  ? [
      startLanProxy(process.env.STILL_LAN_ADDRESS, 8787),
      startLanProxy(process.env.STILL_LAN_ADDRESS, 11470),
    ]
  : [];
for (const proxy of proxies)
  proxy.on("error", (error) => log(`LAN proxy error: ${error.message}`));
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
  process.on("exit", (code) => {
    children.delete(process);
    if (!quitting) log(`${executable} exited with code ${code}`);
  });
  process.on("error", (error) => {
    children.delete(process);
    log(`${executable} failed: ${error.message}`);
  });
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
function status(value) {
  try {
    writeFileSync(
      join(state, "host-status.json"),
      JSON.stringify({ updatedAt: Date.now(), ...value }),
    );
  } catch (error) {
    log(`Status write failed: ${error.message}`);
  }
}
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
  if (storageLow(available)) {
    kill(torrent);
    torrent = null;
    try {
      clearRuntime(runtime);
    } catch (error) {
      log(`Runtime cleanup will retry: ${error.message}`);
    }
    status({
      mediaPaused: true,
      reason: "Storage reserve",
      available,
      profilePid: alive(profile) ? profile.pid : null,
      enginePid: null,
    });
    return;
  }
  if (!alive(torrent)) {
    try {
      clearRuntime(runtime);
    } catch (error) {
      log(`Runtime preparation will retry: ${error.message}`);
      status({
        mediaPaused: true,
        reason: "Runtime cleanup",
        available,
        profilePid: alive(profile) ? profile.pid : null,
        enginePid: null,
      });
      return;
    }
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
  status({
    mediaPaused: false,
    available,
    profilePid: alive(profile) ? profile.pid : null,
    enginePid: alive(torrent) ? torrent.pid : null,
  });
}
function stop() {
  quitting = true;
  for (const proxy of proxies) proxy.close();
  for (const process of children) kill(process);
  try {
    clearRuntime(runtime);
  } catch (error) {
    log(`Final Runtime cleanup failed: ${error.message}`);
  }
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
function tick() {
  try {
    reconcile();
  } catch (error) {
    log(`Supervisor retrying after error: ${error.message}`);
    status({
      mediaPaused: !alive(torrent),
      reason: "Supervisor retry",
      profilePid: alive(profile) ? profile.pid : null,
      enginePid: alive(torrent) ? torrent.pid : null,
    });
  }
}
tick();
setInterval(tick, 5000);
