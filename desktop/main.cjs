const {
  app,
  BrowserWindow,
  nativeImage,
  protocol,
  net,
  shell,
  ipcMain,
} = require("electron");
const { TorrentEngine } = require("./engine.cjs");
const { ensureEngine } = require("./engine-install.cjs");
const {
  chmodSync,
  createReadStream,
  createWriteStream,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { homedir } = require("node:os");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { pathToFileURL } = require("node:url");
if (process.env.STILL_TEST_USER_DATA)
  app.setPath("userData", process.env.STILL_TEST_USER_DATA);
if (process.platform === "linux") app.setDesktopName("io.still.client.desktop");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "still",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
let window;
let engine;
let engineStart;
const engineAbort = new AbortController();
let quitting = false;
function trustedSender(event) {
  return (
    event.sender === window?.webContents &&
    event.senderFrame.url.startsWith("still://app/")
  );
}
function versionParts(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error("Invalid version.");
  return value.split(".").map(Number);
}
function newerVersion(left, right) {
  const a = versionParts(left),
    b = versionParts(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
async function fileDigest(file) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) =>
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", resolve)
      .on("error", reject),
  );
  return hash.digest("hex");
}
function validateExtractedTree(root, directory = root) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const item = path.join(directory, entry.name);
    const target = realpathSync(item);
    if (target !== root && !target.startsWith(root + path.sep))
      throw new Error("The update archive contains an unsafe link.");
    if (entry.isDirectory()) validateExtractedTree(root, item);
  }
}
async function installUpdate(update) {
  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error("Automatic updates require 64-bit Linux.");
  if (
    !update ||
    typeof update.version !== "string" ||
    !newerVersion(update.version, app.getVersion()) ||
    typeof update.url !== "string" ||
    !/^[a-f0-9]{64}$/.test(update.sha256) ||
    !Number.isSafeInteger(update.bytes) ||
    update.bytes < 1 ||
    update.bytes > 500 * 1024 * 1024
  )
    throw new Error("The update package is invalid.");
  const url = new URL(update.url);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("The update address is invalid.");
  const updates = path.join(app.getPath("userData"), "updates");
  const versions = path.join(app.getPath("userData"), "versions");
  mkdirSync(updates, { recursive: true });
  mkdirSync(versions, { recursive: true });
  const archive = path.join(updates, `Still-${update.version}.tar.gz`);
  rmSync(archive, { force: true });
  const response = await net.fetch(url.href, { redirect: "error" });
  if (!response.ok || !response.body)
    throw new Error("The update package could not be downloaded.");
  let received = 0;
  const count = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(
        received > update.bytes
          ? new Error("The update package is larger than expected.")
          : null,
        chunk,
      );
    },
  });
  await pipeline(
    Readable.fromWeb(response.body),
    count,
    createWriteStream(archive, { flags: "wx", mode: 0o600 }),
  );
  if (
    received !== update.bytes ||
    (await fileDigest(archive)) !== update.sha256
  )
    throw new Error("The update package failed verification.");
  const members = execFileSync("tar", ["-tzf", archive], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  if (
    !members.length ||
    members.some(
      (member) =>
        member.startsWith("/") ||
        member.split("/").some((part) => part === ".."),
    )
  )
    throw new Error("The update archive contains an unsafe path.");
  const destination = path.join(versions, update.version);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination);
  execFileSync("tar", ["-xzf", archive, "-C", destination]);
  validateExtractedTree(realpathSync(destination));
  const executable = path.join(destination, "still");
  chmodSync(executable, 0o755);
  const iconRoot = path.join(
    homedir(),
    ".local/share/icons/hicolor/512x512/apps",
  );
  const desktopRoot = path.join(homedir(), ".local/share/applications");
  mkdirSync(iconRoot, { recursive: true });
  mkdirSync(desktopRoot, { recursive: true });
  writeFileSync(
    path.join(iconRoot, "io.still.client.png"),
    readFileSync(path.join(__dirname, "icon.png")),
  );
  writeFileSync(
    path.join(desktopRoot, "io.still.client.desktop"),
    `[Desktop Entry]\nVersion=1.0\nType=Application\nName=Still\nComment=Stremio client\nExec="${executable.replaceAll('"', '\\"')}"\nIcon=io.still.client\nTerminal=false\nCategories=AudioVideo;Video;\nStartupNotify=true\nStartupWMClass=io.still.client\n`,
  );
  const installed = readdirSync(versions)
    .filter((entry) => /^\d+\.\d+\.\d+$/.test(entry))
    .sort((a, b) => (newerVersion(a, b) ? -1 : newerVersion(b, a) ? 1 : 0));
  for (const old of installed.slice(2))
    rmSync(path.join(versions, old), { recursive: true, force: true });
  app.relaunch({ execPath: executable });
  setImmediate(() => app.quit());
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    ipcMain.handle("torrent-engine-url", (event) => {
      if (!trustedSender(event))
        throw new Error("Torrent engine access denied.");
      if (!engineStart)
        engineStart = (async () => {
          const directory = await ensureEngine(
            process.env.STILL_TEST_ENGINE_HOME || app.getPath("userData"),
            undefined,
            engineAbort.signal,
          );
          if (quitting) throw new Error("Still is closing.");
          engine = new TorrentEngine(
            directory,
            app.isPackaged
              ? path.join(process.resourcesPath, "engine-bootstrap.cjs")
              : undefined,
          );
          return engine;
        })().catch((error) => {
          engineStart = null;
          throw error;
        });
      return engineStart.then((engine) => engine.start());
    });
    ipcMain.handle("install-update", (event, update) => {
      if (!trustedSender(event)) throw new Error("Update access denied.");
      return installUpdate(update);
    });
    const root = path.resolve(__dirname, "../dist");
    protocol.handle("still", (request) => {
      try {
        const url = new URL(request.url);
        const asset = path.resolve(
          root,
          "." + decodeURIComponent(url.pathname),
        );
        if (url.hostname !== "app" || !asset.startsWith(root + path.sep))
          return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(asset).href);
      } catch {
        return new Response("Not found", { status: 404 });
      }
    });
    window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 960,
      minHeight: 600,
      title: "Still",
      backgroundColor: "#f6f5f1",
      icon: nativeImage.createFromBuffer(
        readFileSync(path.join(__dirname, "icon.png")),
      ),
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    window.setMenu(null);
    window.webContents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    const external = (url) => {
      try {
        const parsed = new URL(url);
        if (["https:", "http:"].includes(parsed.protocol))
          void shell.openExternal(parsed.href);
      } catch {}
    };
    window.webContents.setWindowOpenHandler(({ url }) => {
      external(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("still://app/")) {
        event.preventDefault();
        external(url);
      }
    });
    void window.loadURL("still://app/index.html");
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    engineAbort.abort();
    Promise.resolve(engineStart)
      .catch(() => {})
      .then(() => engine?.stop())
      .finally(() => app.quit());
  });
}
