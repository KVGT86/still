import { createHash, webcrypto } from "node:crypto";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const root = JSON.parse(await readFile("package.json", "utf8"));
const version = root.version;
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("Package version must use x.y.z.");
const keyPath =
  process.env.STILL_UPDATE_PRIVATE_KEY ||
  join(homedir(), ".config/still/keys/update-private.jwk");
const sources = {
  linux: `artifacts/linux/Still-${version}-linux-x64.tar.gz`,
  android: "android/app/build/outputs/apk/release/app-release.apk",
  webos: `artifacts/webos/io.still.client_${version}_all.ipk`,
};
const names = {
  linux: `Still-${version}-linux-x64.tar.gz`,
  android: `Still-${version}-android.apk`,
  webos: `io.still.client_${version}_all.ipk`,
};
const output = "artifacts/updates";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const packages = {};
for (const platform of Object.keys(sources)) {
  const data = await readFile(sources[platform]).catch(() => {
    throw new Error(`Build the ${platform} package before packaging updates.`);
  });
  const target = join(output, names[platform]);
  await cp(sources[platform], target);
  packages[platform] = {
    url: names[platform],
    sha256: createHash("sha256").update(data).digest("hex"),
    bytes: (await stat(target)).size,
  };
}
const hostName = `Still-${version}-host.tar.gz`;
await cp("artifacts/host/still-host.tar.gz", join(output, hostName)).catch(() => {
  throw new Error("Build the host package before packaging updates.");
});
const payload = {
  schema: 1,
  version,
  publishedAt: new Date().toISOString(),
  packages,
};
const privateJwk = JSON.parse(await readFile(keyPath, "utf8"));
const key = await webcrypto.subtle.importKey(
  "jwk",
  privateJwk,
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["sign"],
);
const signature = Buffer.from(
  await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  ),
).toString("base64url");
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify({ payload, signature }, null, 2) + "\n",
);
console.log(`Signed Still ${version} update bundle ready in ${output}.`);
