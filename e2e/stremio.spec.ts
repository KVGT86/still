import { test, expect } from "@playwright/test";
for (const webos of [false, true])
  test(`Stremio account journey exhausts sources (${webos ? "LG compatibility fallback" : "HTTP"})`, async ({
    page,
  }) => {
    if (webos)
      await page.addInitScript(() => {
        Object.defineProperty(window, "webOSSystem", { value: {} });
        localStorage.setItem(
          "still.streamingServer",
          JSON.stringify("https://media.test"),
        );
      });
    const enginePaths: string[] = [];
    const meta = {
      id: "fixture-movie",
      type: "movie",
      name: "Fixture Movie",
      description: "Integration fixture",
      genres: ["Drama"],
    };
    await page.route("https://api.strem.io/api/**", async (route) => {
      const method = route.request().url().split("/").pop();
      const result =
        method === "login"
          ? {
              authKey: "fixture-key",
              user: { _id: "fixture-account", email: "fixture@example.test" },
            }
          : method === "addonCollectionGet"
            ? {
                addons: [
                  {
                    transportUrl: "https://fixture.test/manifest.json",
                    manifest: {
                      id: "fixture",
                      name: "Fixture",
                      resources: ["catalog", "meta", "stream", "subtitles"],
                      types: ["movie"],
                      catalogs: [
                        {
                          id: "popular",
                          type: "movie",
                          extra: [{ name: "search" }],
                        },
                      ],
                    },
                  },
                  {
                    transportUrl: "https://broken.test/manifest.json",
                    manifest: {
                      id: "broken",
                      resources: ["catalog", "stream"],
                      catalogs: [{ id: "broken", type: "movie" }],
                    },
                  },
                ],
              }
            : [];
      await route.fulfill({ json: { result } });
    });
    await page.route("https://link.stremio.com/**", (r) =>
      r.fulfill({
        json: { result: { code: "TEST", link: "https://example.test/link" } },
      }),
    );
    await page.route("https://broken.test/**", (r) => r.abort());
    await page.route("https://fixture.test/**", (r) => {
      const url = r.request().url();
      return r.fulfill({
        json: url.includes("/catalog/")
          ? { metas: [meta] }
          : url.includes("/meta/")
            ? { meta }
            : url.includes("/stream/")
              ? {
                  streams: [
                    {
                      name: "First",
                      url: "https://media.test/first.mp4",
                      ...(webos
                        ? {
                            infoHash:
                              "0123456789abcdef0123456789abcdef01234567",
                          }
                        : {}),
                      title: "720p English 👤 50",
                    },
                    {
                      name: "Second",
                      url: "https://media.test/first.mp4",
                      ...(webos
                        ? {
                            infoHash:
                              "1123456789abcdef0123456789abcdef01234567",
                          }
                        : {}),
                      title: "720p English 👤 10",
                    },
                  ],
                }
              : { subtitles: [] },
      });
    });
    await page.route("https://media.test/**", (r) => {
      enginePaths.push(new URL(r.request().url()).pathname);
      return r.fulfill({ body: "not a video", contentType: "video/mp4" });
    });
    await page.goto("http://localhost:5173");
    await page.getByLabel("Email address").fill("fixture@example.test");
    await page.getByLabel("Password", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "fixture" }).click();
    await expect(
      page.getByRole("heading", { name: "Nothing in progress" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Recommended", exact: true })
      .click();
    await page.getByRole("button", { name: "Fixture Movie" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.locator(".source-list button").filter({ hasText: "Failed" }),
    ).toHaveCount(2, { timeout: 20000 });
    if (webos) {
      expect(enginePaths.some((path) => path.startsWith("/0123456789"))).toBe(
        true,
      );
      expect(enginePaths.some((path) => path.startsWith("/1123456789"))).toBe(
        true,
      );
      expect(
        enginePaths.filter((path) => /\/hlsv2\/.+\/master\.m3u8$/.test(path)),
      ).toHaveLength(2);
      await expect
        .poll(
          () =>
            enginePaths.filter((path) => /\/hlsv2\/.+\/destroy$/.test(path))
              .length,
        )
        .toBe(2);
    }
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Saved", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Fixture Movie" }),
    ).toBeVisible();
  });
