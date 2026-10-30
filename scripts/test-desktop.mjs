import { _electron } from "playwright";
import electron from "electron";
import { mkdtemp, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const userData = await mkdtemp("/tmp/still-desktop-test-");
const app = await _electron.launch({
  executablePath: process.env.STILL_PACKAGED_BINARY || electron,
  args: process.env.STILL_PACKAGED_BINARY ? [] : ["desktop/main.cjs"],
  env: { ...process.env, STILL_TEST_USER_DATA: userData },
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  const desktopIdentity = await app.evaluate(({ app, nativeImage }) => {
    const fs = process.getBuiltinModule("fs"),
      path = process.getBuiltinModule("path");
    const appPath = app.getAppPath();
    const root = fs.existsSync(path.join(appPath, "package.json"))
      ? appPath
      : path.dirname(appPath);
    const metadata = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    const image = nativeImage.createFromBuffer(
      fs.readFileSync(path.join(root, "desktop/icon.png")),
    );
    return { desktopName: metadata.desktopName, iconSize: image.getSize() };
  });
  assert.equal(desktopIdentity.desktopName, "io.still.client");
  assert.deepEqual(desktopIdentity.iconSize, { width: 512, height: 512 });
  await page.getByRole("heading", { name: "Sign in to Stremio" }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  await page.getByRole("button", { name: "Preview app" }).click();
  await page.getByRole("heading", { name: "Continue watching" }).waitFor();
  assert.equal(
    await page
      .locator(".brand-icon")
      .evaluateAll(
        (images) =>
          images.length > 0 && images.every((image) => image.naturalWidth > 0),
      ),
    true,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await mkdir("artifacts/linux", { recursive: true });
  await page.screenshot({ path: "artifacts/linux/desktop-smoke.png" });
  console.log(
    "Linux desktop smoke test passed: secure renderer, sign-in, preview, navigation and themes.",
  );
} finally {
  await app.close();
}
