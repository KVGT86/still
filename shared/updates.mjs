export function compareVersions(left, right) {
  const valid = /^\d+\.\d+\.\d+$/;
  if (!valid.test(left) || !valid.test(right))
    throw new Error("The update service returned an invalid version.");
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value))
    throw new Error("The update signature is invalid.");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validPackage(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.url === "string" &&
    value.url.length <= 300 &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    value.bytes <= 500 * 1024 * 1024
  );
}

export async function verifyUpdateManifest(
  text,
  currentVersion,
  platform,
  manifestUrl,
  publicKey,
) {
  if (text.length > 65_536)
    throw new Error("The update manifest is too large.");
  const manifest = JSON.parse(text);
  const payload = manifest?.payload;
  if (
    payload?.schema !== 1 ||
    typeof payload.version !== "string" ||
    typeof payload.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(payload.publishedAt)) ||
    !payload.packages ||
    typeof manifest.signature !== "string"
  )
    throw new Error("The update manifest is invalid.");
  compareVersions(payload.version, currentVersion);
  const key = await crypto.subtle.importKey(
    "jwk",
    publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    decodeBase64Url(manifest.signature),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  if (!valid) throw new Error("The update signature could not be verified.");
  if (compareVersions(payload.version, currentVersion) <= 0) return null;
  const item = payload.packages[platform];
  if (!validPackage(item))
    throw new Error("No compatible package is available for this device.");
  const packageUrl = new URL(item.url, manifestUrl);
  if (packageUrl.origin !== new URL(manifestUrl).origin)
    throw new Error("The update package must stay on the update service.");
  return {
    version: payload.version,
    publishedAt: payload.publishedAt,
    package: { ...item, url: packageUrl.href },
  };
}
