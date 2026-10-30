import { test, expect } from "@playwright/test";
test("preview navigates, saves titles, changes preferences and themes", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Preview app" }).click();
  await expect(
    page.getByRole("heading", { name: "Continue watching" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Recommended", exact: true }).click();
  await page.getByRole("button", { name: "Big Buck Bunny" }).click();
  await page.screenshot({ path: "artifacts/details-glass.png" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Big Buck Bunny" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
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
  await page.getByLabel("Autoplay mode").selectOption("off");
  await expect(page.getByLabel("Autoplay mode")).toHaveValue("off");
  await page.screenshot({ path: "artifacts/settings-dark.png" });
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.screenshot({ path: "artifacts/home-light.png" });
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
  const items = Array.from({ length: 8 }, (_, i) => ({
    _id: `fixture-${i}`,
    name: `Film ${i + 1}`,
    type: "movie",
    poster:
      "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg",
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
  await page.screenshot({ path: "artifacts/continue-watching-tiers.png" });
  await page
    .getByRole("button", { name: "Remove Film 1 from Continue Watching" })
    .click();
  await expect(
    page.locator(".continue-card.featured").getByText("Film 2"),
  ).toBeVisible();
});
test("portrait displays rotate message", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto("http://localhost:5173");
  await expect(
    page.getByRole("heading", { name: "Rotate to landscape" }),
  ).toBeVisible();
});
