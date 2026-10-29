import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
const visited = new Set(),
  sections = [];
async function collect(name, from) {
  const require = createRequire(join(from, "package.json"));
  let file;
  try {
    file = require.resolve(name + "/package.json");
  } catch {
    try {
      let dir = dirname(require.resolve(name));
      while (dir !== dirname(dir)) {
        try {
          const p = JSON.parse(
            await readFile(join(dir, "package.json"), "utf8"),
          );
          if (p.name === name) {
            file = join(dir, "package.json");
            break;
          }
        } catch {}
        dir = dirname(dir);
      }
    } catch {}
  }
  if (!file || visited.has(file)) return;
  visited.add(file);
  const dir = dirname(file),
    pkg = JSON.parse(await readFile(file, "utf8"));
  const licenses = (await readdir(dir)).filter((f) =>
    /^(licen[cs]e|copying)([.\-_]|$)/i.test(f),
  );
  const text = await Promise.all(
    licenses.map((f) => readFile(join(dir, f), "utf8").catch(() => "")),
  );
  sections.push(
    `${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license)}\n${text.join("\n")}`,
  );
  for (const dependency of Object.keys(pkg.dependencies || {}))
    await collect(dependency, dir);
}
const root = resolve("."),
  pkg = JSON.parse(await readFile("package.json", "utf8"));
for (const name of Object.keys(pkg.dependencies)) await collect(name, root);
await mkdir("public/licenses", { recursive: true });
await writeFile(
  "public/licenses/THIRD-PARTY.txt",
  sections.join("\n\n" + "=".repeat(72) + "\n\n"),
);
for (const font of ["Manrope", "DMSans"])
  await writeFile(
    `public/licenses/${font}-OFL.txt`,
    await readFile(`src/fonts/${font}-OFL.txt`),
  );
