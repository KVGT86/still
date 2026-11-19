import { mkdir, writeFile } from "node:fs/promises";
import { icon } from "./shared-icon.mjs";
for (const directory of ["public", "desktop"])
  await mkdir(directory, { recursive: true });
await writeFile("public/app-icon.png", icon(512));
// Electron Builder converts this source into the multi-resolution macOS ICNS.
// Keep the desktop source at Retina resolution for the Dock and Finder.
await writeFile("desktop/icon.png", icon(1024));
