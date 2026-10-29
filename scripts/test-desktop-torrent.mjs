import { _electron, expect } from "playwright/test";
import electron from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { torrentFixture } from "./test-torrent.mjs";

const fixture = await torrentFixture({ incompatibleAudio: true });
const userData = await mkdtemp("/tmp/still-player-torrent-");
let app;
try {
  app = await _electron.launch({
    executablePath: process.env.STILL_PACKAGED_BINARY || electron,
    args: process.env.STILL_PACKAGED_BINARY ? [] : ["desktop/main.cjs"],
    env: {
      ...process.env,
      STILL_TEST_USER_DATA: userData,
      STILL_TEST_ENGINE_HOME: resolve("tools"),
    },
  });
  const page = await app.firstWindow();
  const meta = {
    id: "still-torrent-test",
    type: "movie",
    name: "Torrent playback test",
    genres: ["Animation"],
  };
  await page.route("https://api.strem.io/api/**", async (route) => {
    const method = route.request().url().split("/").pop();
    const result =
      method === "login"
        ? {
            authKey: "fixture",
            user: { _id: "torrent-test", email: "fixture@example.test" },
          }
        : method === "addonCollectionGet"
          ? {
              addons: [
                {
                  transportUrl: "https://torrent-fixture.test/manifest.json",
                  manifest: {
                    id: "fixture",
                    name: "Fixture",
                    resources: ["catalog", "meta", "stream"],
                    types: ["movie"],
                    catalogs: [{ id: "test", type: "movie" }],
                  },
                },
              ],
            }
          : [];
    await route.fulfill({ json: { result } });
  });
  await page.route("https://torrent-fixture.test/**", (route) => {
    const url = route.request().url();
    return route.fulfill({
      json: url.includes("/catalog/")
        ? { metas: [meta] }
        : url.includes("/meta/")
          ? { meta }
          : {
              streams: [
                {
                  ...fixture.source,
                  name: "Local seed",
                  title: "720p English",
                },
              ],
            },
    });
  });
  await page.getByLabel("Email address").fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "fixture Profile" }).click();
  await page.getByRole("button", { name: "Recommended", exact: true }).click();
  await page.getByRole("button", { name: meta.name }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const video = page.locator(".player video");
  await expect(video).toBeVisible({ timeout: 30000 });
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 60000 })
    .toBeGreaterThan(1);
  await expect
    .poll(() => video.evaluate((v) => v.webkitAudioDecodedByteCount), {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  await video.evaluate((v) => {
    v.currentTime = 5;
  });
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 20000 })
    .toBeGreaterThan(5);
  console.log(
    "Desktop torrent playback passed: Stremio addon source, built-in engine, sandboxed renderer, HLS video/audio and seeking.",
  );
} finally {
  await app?.close();
  await fixture.close();
  await rm(userData, { recursive: true, force: true });
}
