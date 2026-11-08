import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { compareVersions, verifyUpdateManifest } from "../shared/updates.mjs";

test("signed update manifests accept newer same-origin packages", async () => {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const payload = {
    schema: 1,
    version: "1.2.0",
    publishedAt: new Date().toISOString(),
    packages: {
      android: { url: "Still-1.2.0.apk", sha256: "a".repeat(64), bytes: 42 },
    },
  };
  const signature = Buffer.from(
    await webcrypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  ).toString("base64url");
  const update = await verifyUpdateManifest(
    JSON.stringify({ payload, signature }),
    "1.1.9",
    "android",
    "https://still.test/downloads/manifest.json",
    await webcrypto.subtle.exportKey("jwk", pair.publicKey),
  );
  assert.equal(update.version, "1.2.0");
  assert.equal(
    update.package.url,
    "https://still.test/downloads/Still-1.2.0.apk",
  );
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  payload.packages.android.url = "https://elsewhere.test/update.apk";
  await assert.rejects(
    verifyUpdateManifest(
      JSON.stringify({ payload, signature }),
      "1.1.9",
      "android",
      "https://still.test/downloads/manifest.json",
      await webcrypto.subtle.exportKey("jwk", pair.publicKey),
    ),
    /signature/,
  );
});
