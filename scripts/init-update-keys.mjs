import { randomBytes, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const directory = join(homedir(), ".config/still/keys");
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const privatePath = join(directory, "update-private.jwk");
const publicPath = join(directory, "update-public.jwk");
try {
  await access(privatePath, constants.F_OK);
} catch {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  await writeFile(
    privatePath,
    JSON.stringify(await webcrypto.subtle.exportKey("jwk", pair.privateKey)),
    { mode: 0o600, flag: "wx" },
  );
  await writeFile(
    publicPath,
    JSON.stringify(await webcrypto.subtle.exportKey("jwk", pair.publicKey)),
    { mode: 0o644, flag: "wx" },
  );
}
const publicKey = JSON.parse(await readFile(publicPath, "utf8"));
await writeFile(
  "src/update-public-key.ts",
  `export const updatePublicKey: JsonWebKey = ${JSON.stringify(publicKey, null, 2)};\n`,
);
const keystore = join(directory, "android-release.jks");
const signingEnvironment = join(directory, "android-signing.env");
try {
  await access(keystore, constants.F_OK);
  await access(signingEnvironment, constants.F_OK);
} catch {
  const password = randomBytes(24).toString("base64url");
  execFileSync("keytool", [
    "-genkeypair",
    "-keystore",
    keystore,
    "-alias",
    "still",
    "-keyalg",
    "RSA",
    "-keysize",
    "4096",
    "-validity",
    "10000",
    "-storepass",
    password,
    "-keypass",
    password,
    "-dname",
    "CN=Still, OU=Personal, O=Still, L=Private, C=GB",
  ]);
  await chmod(keystore, 0o600);
  await writeFile(
    signingEnvironment,
    `STILL_ANDROID_KEYSTORE=${keystore}\nSTILL_ANDROID_KEY_ALIAS=still\nSTILL_ANDROID_STORE_PASSWORD=${password}\nSTILL_ANDROID_KEY_PASSWORD=${password}\n`,
    { mode: 0o600, flag: "wx" },
  );
}
console.log(
  `Private update keys are ready in ${directory}. Back up this folder.`,
);
