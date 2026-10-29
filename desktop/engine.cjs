const { spawn } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { once } = require("node:events");

class TorrentEngine {
  constructor(directory, bootstrap = join(__dirname, "engine-bootstrap.cjs")) {
    this.directory = directory;
    this.bootstrap = bootstrap;
  }
  async start() {
    if (this.pending) return this.pending;
    this.pending = this.launch().catch(async (error) => {
      await this.stop();
      throw error;
    });
    return this.pending;
  }
  async launch() {
    this.session = await mkdtemp(join(tmpdir(), "still-torrent-"));
    const child = (this.child = spawn(
      join(this.directory, "stremio-runtime"),
      [this.bootstrap, join(this.directory, "server.js")],
      {
        cwd: this.session,
        detached: true,
        env: {
          ...process.env,
          APP_PATH: this.session,
          SETTINGS_PATH: this.session,
          TMPDIR: this.session,
          DISABLE_CACHING: "1",
          CASTING_DISABLED: "1",
          NO_HTTPS_SERVER: "1",
          NO_NETWORK_INTERFACES: "1",
          FFMPEG_BIN: join(this.directory, "ffmpeg"),
          FFPROBE_BIN: join(this.directory, "ffprobe"),
        },
        stdio: ["ignore", "pipe", "ignore"],
      },
    ));
    child.once("exit", () => {
      if (this.child === child) this.pending = null;
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("The torrent engine did not start.")),
        20000,
      );
      let output = "";
      const finish = (error, value) => {
        clearTimeout(timeout);
        child.stdout.removeListener("data", data);
        child.stdout.resume();
        child.removeListener("error", failure);
        child.removeListener("exit", exited);
        error ? reject(error) : resolve(value);
      };
      const data = (chunk) => {
        output = (output + chunk.toString()).slice(-8192);
        const match = output.match(
          /STILL_ENGINE_URL=(http:\/\/127\.0\.0\.1:\d+)/,
        );
        if (match) finish(null, match[1]);
      };
      const failure = () =>
        finish(new Error("The bundled torrent engine could not be started."));
      const exited = () =>
        finish(new Error("The torrent engine stopped unexpectedly."));
      child.stdout.on("data", data);
      child.once("error", failure);
      child.once("exit", exited);
    });
  }
  async stop() {
    const child = this.child;
    this.child = null;
    this.pending = null;
    if (
      child &&
      child.exitCode === null &&
      child.signalCode === null &&
      child.pid
    ) {
      const exited = once(child, "exit");
      const kill = (signal) => {
        try {
          process.kill(-child.pid, signal);
        } catch {}
      };
      kill("SIGTERM");
      const force = setTimeout(() => kill("SIGKILL"), 3000);
      await exited.catch(() => {});
      clearTimeout(force);
    }
    if (this.session) await rm(this.session, { recursive: true, force: true });
    this.session = null;
  }
}
module.exports = { TorrentEngine };
