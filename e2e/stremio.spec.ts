import { test, expect } from "@playwright/test";
test("Stremio account journey silently tolerates a broken addon and marks exhausted sources", async ({
  page,
}) => {
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
                    title: "720p English 👤 50",
                  },
                  {
                    name: "Second",
                    url: "https://media.test/first.mp4",
                    title: "720p English 👤 10",
                  },
                ],
              }
            : { subtitles: [] },
    });
  });
  await page.route("https://media.test/**", (r) =>
    r.fulfill({ body: "not a video", contentType: "video/mp4" }),
  );
  await page.goto("http://localhost:5173");
  await page.getByLabel("Email address").fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "fixture" }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing in progress" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recommended", exact: true }).click();
  await page.getByRole("button", { name: "Fixture Movie" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.locator(".source-list button").filter({ hasText: "Failed" }),
  ).toHaveCount(2, { timeout: 20000 });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fixture Movie" }),
  ).toBeVisible();
});
