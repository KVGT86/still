import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

if (process.platform !== "darwin")
  throw new Error("Build the macOS package on a Mac.");

const output = "artifacts/mac";
const stage = `${output}/app`;
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const entry of ["dist", "desktop", "LICENSE"])
  await cp(entry, `${stage}/${entry}`, { recursive: true });
const { name, version, description, author, license, main, desktopName } =
  JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  `${stage}/package.json`,
  JSON.stringify({ name, version, description, author, license, main, desktopName }),
);

execFileSync(
  "node_modules/.bin/electron-builder",
  [
    "--mac",
    "--arm64",
    "--dir",
    `--config.directories.app=${stage}`,
    `--config.directories.output=${output}`,
  ],
  { stdio: "inherit" },
);
const bundle = `${output}/mac-arm64/Still.app`;
const plist = `${bundle}/Contents/Info.plist`;
const plistValue = (key) =>
  execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist], {
    encoding: "utf8",
  }).trim();
if (plistValue("CFBundleIdentifier") !== "io.still.client")
  throw new Error("The macOS bundle identifier is incorrect.");
if (plistValue("CFBundleName") !== "Still")
  throw new Error("The macOS bundle name is incorrect.");
const bundleIcon = plistValue("CFBundleIconFile");
await access(`${bundle}/Contents/Resources/${bundleIcon}`);
if (
  !execFileSync("/usr/bin/lipo", [
    "-archs",
    `${bundle}/Contents/MacOS/Still`,
  ])
    .toString()
    .split(/\s+/)
    .includes("arm64")
)
  throw new Error("The macOS executable does not contain Apple Silicon code.");
const archive = `${output}/Still-${version}-mac-arm64.zip`;
await rm(archive, { force: true });
execFileSync(
  "/usr/bin/ditto",
  ["-c", "-k", "--sequesterRsrc", "--keepParent", bundle, archive],
  { stdio: "inherit" },
);
console.log(`Apple Silicon package ready at ${archive}.`);
