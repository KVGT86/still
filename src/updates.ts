import { updatePublicKey } from "./update-public-key";
import { compareVersions, verifyUpdateManifest } from "../shared/updates.mjs";

export type UpdatePlatform = "linux" | "android" | "webos";
export type UpdatePackage = {
  url: string;
  sha256: string;
  bytes: number;
};
export type AvailableUpdate = {
  version: string;
  publishedAt: string;
  package: UpdatePackage;
};

export const appVersion = __APP_VERSION__;

export function updatePlatform(): UpdatePlatform | null {
  if (window.StillDesktop) return "linux";
  if (window.StillNative) return "android";
  if (window.PalmSystem || "webOSSystem" in window) return "webos";
  return null;
}

export async function checkForUpdate(
  server: string,
): Promise<AvailableUpdate | null> {
  const platform = updatePlatform();
  if (!platform) return null;
  const base = new URL(server);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Use a plain HTTP or HTTPS update service address.");
  const manifestUrl = new URL("downloads/manifest.json", base.href.replace(/\/?$/, "/"));
  const response = await fetch(manifestUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("The update service is unavailable.");
  return (await verifyUpdateManifest(
    await response.text(),
    appVersion,
    platform,
    manifestUrl.href,
    updatePublicKey,
  )) as AvailableUpdate | null;
}

export { compareVersions };
