import { test, expect, type Page } from "@playwright/test";

async function capture(page: Page, path: string) {
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete),
  );
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) =>
        image.decode().catch(() => undefined),
      ),
    ),
  );
  await page.evaluate(() => {
    const urls = Array.from(document.querySelectorAll("*"))
      .flatMap((element) =>
        Array.from(
          getComputedStyle(element).backgroundImage.matchAll(
            /url\(["']?([^"')]+)["']?\)/g,
          ),
        ),
      )
      .map((match) => match[1]);
    return Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = image.onerror = () => resolve();
            image.src = url;
          }),
      ),
    );
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path });
}
test("preview navigates, saves titles, changes preferences and themes", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Preview app" }).click();
  await expect(
    page.getByRole("heading", { name: "Continue watching" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recommended", exact: true }).click();
  await capture(page, "artifacts/recommended-light.png");
  await page.getByRole("button", { name: "Big Buck Bunny" }).click();
  await capture(page, "artifacts/details-light.png");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Search movies and series").fill("Big Buck Bunny");
  await expect(
    page.getByRole("button", { name: "Big Buck Bunny" }),
  ).toBeVisible();
  await capture(page, "artifacts/search-light.png");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Big Buck Bunny" }),
  ).toBeVisible();
  await capture(page, "artifacts/saved-light.png");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await capture(page, "artifacts/settings-light.png");
  const toggle = page.getByRole("switch", { name: "Subtitles by default" });
  const knob = toggle.locator("span");
  const wasChecked = (await toggle.getAttribute("aria-checked")) === "true";
  const left = await knob.boundingBox();
  await toggle.click();
  await page.waitForTimeout(200);
  const right = await knob.boundingBox();
  expect(Math.abs(right!.x - left!.x)).toBeGreaterThan(15);
  expect(right!.x > left!.x).toBe(!wasChecked);
  expect(right!.x + right!.width).toBeLessThanOrEqual(
    (await toggle.boundingBox())!.x + (await toggle.boundingBox())!.width,
  );
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Autoplay mode").selectOption("off");
  await expect(page.getByLabel("Autoplay mode")).toHaveValue("off");
  await capture(page, "artifacts/settings-dark.png");
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.locator(".poster-card")).toHaveCount(1);
  await capture(page, "artifacts/saved-dark.png");
  await page.getByRole("button", { name: "Recommended", exact: true }).click();
  await expect(page.locator(".poster-card")).toHaveCount(1);
  await capture(page, "artifacts/recommended-dark.png");
  await page.getByRole("button", { name: "Big Buck Bunny" }).click();
  await capture(page, "artifacts/details-dark.png");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Big Buck Bunny" }),
  ).toBeVisible();
  await expect(page.locator(".loading")).toHaveCount(0);
  await capture(page, "artifacts/search-dark.png");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await capture(page, "artifacts/home-light.png");
  await page
    .getByRole("button", {
      name: "Remove Big Buck Bunny from Continue Watching",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nothing in progress" }),
  ).toBeVisible();
});
test("Continue Watching tiers the latest item, next five and earlier items", async ({
  page,
}) => {
  const fixtureArtwork = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="slategray"/><text x="800" y="470" fill="honeydew" font-family="sans-serif" font-size="64" font-weight="700" letter-spacing="12" text-anchor="middle">STILL PREVIEW</text></svg>',
  )}`;
  const items = Array.from({ length: 8 }, (_, i) => ({
    _id: `fixture-${i}`,
    name: `Film ${i + 1}`,
    type: "movie",
    poster: fixtureArtwork,
    _mtime: new Date(Date.UTC(2026, 9, 30, 12, 0, -i)).toISOString(),
    state: {
      video_id: `fixture-${i}`,
      timeOffset: 20_000,
      duration: 100_000,
    },
  }));
  await page.addInitScript((seed) => {
    localStorage.setItem(
      "still:tier-account:single:single",
      JSON.stringify({
        saved: {},
        progress: Object.fromEntries(
          seed.map((item) => [
            item._id,
            {
              meta: {
                id: item._id,
                name: item.name,
                type: item.type,
                poster: item.poster,
              },
              videoId: item._id,
              position: 20,
              duration: 100,
              completed: false,
              hidden: false,
              updatedAt: Date.parse(item._mtime),
            },
          ]),
        ),
        feedback: {},
        settings: {
          theme: "light",
          audio: "en",
          subtitle: "en",
          subtitles: true,
          autoplay: "scheduled",
        },
        settingsAt: 0,
      }),
    );
  }, items);
  await page.route("https://api.strem.io/api/**", async (route) => {
    const method = route.request().url().split("/").pop();
    const result =
      method === "login"
        ? {
            authKey: "tier-key",
            user: { _id: "tier-account", email: "tier@example.test" },
          }
        : method === "addonCollectionGet"
          ? { addons: [] }
          : [];
    await route.fulfill({ json: { result } });
  });
  await page.route("https://link.stremio.com/**", (route) =>
    route.fulfill({
      json: { result: { code: "TEST", link: "https://example.test/link" } },
    }),
  );
  await page.goto("http://localhost:5173");
  await page.getByLabel("Email address").fill("tier@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "tier Profile" }).click();
  await expect(page.locator(".continue-card.featured")).toHaveCount(1);
  await expect(page.locator(".continue-row .continue-card")).toHaveCount(5);
  await expect(page.locator(".continue-grid .continue-card")).toHaveCount(2);
  await expect(
    page.locator(".continue-card.featured").getByText("Film 1"),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/home-light.png" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await capture(page, "artifacts/home-dark.png");
  await page
    .getByRole("button", { name: "Remove Film 1 from Continue Watching" })
    .click();
  await expect(
    page.locator(".continue-card.featured").getByText("Film 2"),
  ).toBeVisible();
});
test("household profile chooser contains no real account data", async ({
  page,
}) => {
  let revoked = false;
  await page.addInitScript(() => {
    localStorage.setItem(
      "still.service",
      JSON.stringify("https://profiles.test"),
    );
  });
  await page.route("https://api.strem.io/api/**", async (route) => {
    const method = route.request().url().split("/").pop();
    await route.fulfill({
      json: {
        result:
          method === "login"
            ? {
                authKey: "household-key",
                user: {
                  _id: "household-account",
                  email: "viewer@example.test",
                },
              }
            : { addons: [] },
      },
    });
  });
  await page.route("https://link.stremio.com/**", (route) =>
    route.fulfill({
      json: { result: { code: "TEST", link: "https://example.test/link" } },
    }),
  );
  await page.route("https://profiles.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/session/revoke") revoked = true;
    await route.fulfill({
      json:
        url.pathname === "/api/session"
          ? { token: "service-token" }
          : url.pathname === "/api/session/revoke"
            ? { ok: true }
            : [
                { id: "one", name: "Living room", avatar: "◒", locked: false },
                { id: "two", name: "Guest", avatar: "✦", locked: true },
              ],
    });
  });
  await page.goto("http://localhost:5173");
  await page.getByLabel("Email address").fill("viewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Who’s watching?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Living room Profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guest PIN protected" }),
  ).toBeVisible();
  await capture(page, "artifacts/profiles-light.png");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await capture(page, "artifacts/profiles-dark.png");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Stremio" }),
  ).toBeVisible();
  await expect.poll(() => revoked).toBe(true);
});
test("portrait displays rotate message", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto("http://localhost:5173");
  await expect(
    page.getByRole("heading", { name: "Rotate to landscape" }),
  ).toBeVisible();
});
