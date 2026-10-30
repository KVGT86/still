import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { icon } from "./shared-icon.mjs";
await mkdir("desktop", { recursive: true });
await writeFile("desktop/icon.png", icon(512));
const stage = "artifacts/linux/app";
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp("dist", `${stage}/dist`, { recursive: true });
await cp("desktop", `${stage}/desktop`, { recursive: true });
await cp("LICENSE", `${stage}/LICENSE`);
const { name, version, description, author, license, main, desktopName } =
  JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  `${stage}/package.json`,
  JSON.stringify({
    name,
    version,
    description,
    author,
    license,
    main,
    desktopName,
    dependencies: {},
  }),
);
execFileSync(
  "node_modules/.bin/electron-builder",
  ["--linux", "--dir", "--x64"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_BUILDER_COMPRESSION_LEVEL:
        process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || "3",
      ELECTRON_BUILDER_CACHE:
        process.env.ELECTRON_BUILDER_CACHE ||
        "/tmp/still-electron-builder-cache",
    },
  },
);
const output = "artifacts/linux",
  bundle = `${output}/linux-unpacked`,
  debRoot = `${output}/deb-root`;
execFileSync(
  "tar",
  ["-czf", `${output}/Still-${version}-linux-x64.tar.gz`, "-C", bundle, "."],
  { stdio: "inherit" },
);
await rm(debRoot, { recursive: true, force: true });
for (const dir of [
  "DEBIAN",
  "opt/Still",
  "usr/bin",
  "usr/share/applications",
  "usr/share/icons/hicolor/512x512/apps",
])
  await mkdir(`${debRoot}/${dir}`, { recursive: true });
await cp(bundle, `${debRoot}/opt/Still`, { recursive: true });
await symlink("/opt/Still/still", `${debRoot}/usr/bin/still`);
await cp(
  "desktop/icon.png",
  `${debRoot}/usr/share/icons/hicolor/512x512/apps/io.still.client.png`,
);
await writeFile(
  `${debRoot}/usr/share/applications/io.still.client.desktop`,
  "[Desktop Entry]\nType=Application\nName=Still\nComment=Stremio client\nExec=/opt/Still/still\nIcon=io.still.client\nTerminal=false\nCategories=AudioVideo;Video;\nStartupWMClass=io.still.client\n",
);
await writeFile(
  `${debRoot}/DEBIAN/control`,
  `Package: still-client\nVersion: ${version}\nArchitecture: amd64\nSection: video\nPriority: optional\nMaintainer: Still contributors\nDepends: libc6 (>= 2.31), libgtk-3-0, libnss3, libxss1, libasound2t64 | libasound2, libgbm1, libxkbcommon0\nDescription: ${description}\n`,
);
execFileSync(
  "dpkg-deb",
  [
    "--build",
    "--root-owner-group",
    "-Zgzip",
    "-z3",
    debRoot,
    `${output}/Still-${version}-linux-amd64.deb`,
  ],
  { stdio: "inherit" },
);
console.log("Linux portable archive and Debian package ready.");
