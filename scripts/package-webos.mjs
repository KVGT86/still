import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { icon } from "./shared-icon.mjs";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("artifacts/webos", { recursive: true });
execFileSync(process.execPath, ["scripts/notices.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/generate-icons.mjs"], {
  stdio: "inherit",
});
const packager = "tools/webos/node_modules/.bin/ares-package";
try {
  await access(packager);
} catch {
  execFileSync("npm", ["ci", "--prefix", "tools/webos"], { stdio: "inherit" });
}
execFileSync(
  "node_modules/.bin/vite",
  ["build", "--config", "vite.webos.config.ts"],
  { stdio: "inherit" },
);
await cp("dist-webos", "artifacts/webos/app", { recursive: true });
await writeFile(
  "artifacts/webos/app/index.html",
  "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https: http:; media-src 'self' blob: https: http:; connect-src 'self' https: http:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\"><title>Still</title><link rel=\"icon\" href=\"icon.png\"><link rel=\"stylesheet\" href=\"app.css\"></head><body><div id=\"root\"></div><script defer src=\"app.js\"></script></body></html>",
);
await writeFile(
  "artifacts/webos/app/appinfo.json",
  JSON.stringify(
    {
      id: "io.still.client",
      version,
      vendor: "Still contributors",
      type: "web",
      main: "index.html",
      title: "Still",
      icon: "icon.png",
      largeIcon: "icon.png",
      appDescription: "A quieter Stremio experience",
      resolution: "1920x1080",
      requiredMemory: 128,
      requiredACG: [],
      disableBackHistoryAPI: true,
    },
    null,
    2,
  ),
);
await writeFile("artifacts/webos/app/icon.png", icon(130));
execFileSync(packager, ["artifacts/webos/app", "-o", "artifacts/webos"], {
  stdio: "inherit",
});
