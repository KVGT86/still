import { test, expect } from "@playwright/test";
test("preview navigates, saves titles, changes preferences and themes", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Preview app" }).click();
  await expect(
    page.getByRole("heading", { name: "Continue watching" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue Big Buck Bunny" }).click();
  await page.screenshot({ path: "artifacts/details-glass.png" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Big Buck Bunny" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
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
test("portrait displays rotate message", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  await page.goto("http://localhost:5173");
  await expect(
    page.getByRole("heading", { name: "Rotate to landscape" }),
  ).toBeVisible();
});
