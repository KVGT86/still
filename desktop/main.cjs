const { app, BrowserWindow, nativeImage, protocol, net, shell } = require("electron");
const {readFileSync}=require('node:fs');
const path = require("node:path");
const { pathToFileURL } = require("node:url");
if (process.env.STILL_TEST_USER_DATA)
  app.setPath("userData", process.env.STILL_TEST_USER_DATA);
if(process.platform==='linux')app.setDesktopName('io.still.client.desktop');
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
      icon: nativeImage.createFromBuffer(readFileSync(path.join(__dirname, "icon.png"))),
      autoHideMenuBar: true,
      webPreferences: {
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
}
