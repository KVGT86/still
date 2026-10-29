import { mkdir, writeFile } from "node:fs/promises";
import { icon } from "./shared-icon.mjs";
for (const directory of ["public", "desktop"])
  await mkdir(directory, { recursive: true });
await writeFile("public/app-icon.png", icon(512));
await writeFile("desktop/icon.png", icon(512));
