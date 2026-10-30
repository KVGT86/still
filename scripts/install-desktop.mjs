import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { appIconSvg, icon } from "./shared-icon.mjs";
const iconRoot = join(homedir(), ".local/share/icons/hicolor");
for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
  const dir = join(iconRoot, `${size}x${size}`, "apps");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "io.still.client.png"), icon(size));
}
const scalable = join(iconRoot, "scalable/apps");
await mkdir(scalable, { recursive: true });
await writeFile(join(scalable, "io.still.client.svg"), appIconSvg);
const desktopDir = join(homedir(), ".local/share/applications");
await mkdir(desktopDir, { recursive: true });
await writeFile(
  join(desktopDir, "io.still.client.desktop"),
  `[Desktop Entry]\nVersion=1.0\nType=Application\nName=Still\nComment=Stremio client\nExec=${resolve("artifacts/linux/linux-unpacked/still")}\nIcon=io.still.client\nTerminal=false\nCategories=AudioVideo;Video;\nStartupNotify=true\nStartupWMClass=io.still.client\n`,
);
spawnSync("gtk-update-icon-cache", ["-f", "-t", iconRoot], { stdio: "ignore" });
spawnSync("update-desktop-database", [desktopDir], { stdio: "ignore" });
console.log("Still launcher and matching icon-theme assets installed.");
