import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir("artifacts/host", { recursive: true });
const stage = "artifacts/host/app";
await rm(stage, { recursive: true, force: true });
await mkdir(stage);
for (const name of ["server", "shared", "dist"])
  await cp(name, `${stage}/${name}`, { recursive: true });
const root = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  `${stage}/package.json`,
  JSON.stringify({
    name: "still-host",
    version: root.version,
    private: true,
    type: "module",
    dependencies: { express: root.dependencies.express },
  }),
);
execFileSync(
  "npm",
  ["install", "--omit=dev", "--ignore-scripts", "--prefix", stage],
  { stdio: "inherit" },
);
execFileSync(
  "tar",
  ["-czf", "artifacts/host/still-host.tar.gz", "-C", stage, "."],
  { stdio: "inherit" },
);
